import { parsePNG } from './imageUtils';
import { encryptPayload, decryptPayload, inspectPayloadMetadata } from './crypto';
import { computeCostMap as computeHeuristicCostMap } from './costmap';
import { computeCostMapNeural } from './costMapNeural';
import { isNeuralModelAvailable } from './onnxSession';
import { ZoningConfig, classifyZones, calculateCapacity, CapacityInfo } from './zoning';
import {
  embedEMDZoneA,
  extractEMDZoneA,
  bytesToBase5Digits,
  base5DigitsToBytes,
  bytesToBase7Digits,
  base7DigitsToBytes,
} from './emd';
import { embedOPAPZone, extractOPAPZone } from './opap';
import { calculateMetrics, calculateSecurityReport, MetricsResult, SecurityReport } from './metrics';
import { generateVisualizations } from './visualize';

export interface EncodeResult {
  success: boolean;
  metrics: MetricsResult;
  security_report: SecurityReport;
  visuals: {
    stego_b64: string;
    heatmap_b64: string;
    mask_b64: string;
    binary_mask_b64?: string;
    zone_map_b64: string;
    gradient_overlay_b64: string;
    highlight_overlay_b64?: string;
    rgb_bits_b64?: string;
  };
  cost_map_mode: string;
  adversarial_strength: number;
  emd_n: number;
}

export interface DecodeResult {
  success: boolean;
  decrypted_text: string;
  cost_map_mode?: string;
}

/**
 * Helper to dispatch to neural or heuristic cost map based on requested mode.
 */
export async function getCostMap(
  image: { width: number; height: number; channels: number; data: Uint8Array },
  gamma: number = 0.7,
  costMapMode: string = 'neural'
): Promise<Float32Array> {
  const isNeural = costMapMode === 'neural';
  if (isNeural) {
    if (!isNeuralModelAvailable()) {
      throw new Error('LF-RINN ONNX neural model is required for neural cost map, but the ONNX session is unavailable.');
    }
    return await computeCostMapNeural(image, gamma, 'neural');
  }
  return computeHeuristicCostMap(image, gamma, costMapMode);
}

export async function runCapacityCheck(
  imageBuffer: Buffer,
  threshA: number = 0.35,
  threshB: number = 0.65,
  gamma: number = 0.7,
  costMapMode: string = 'neural',
  emdN: number = 2
) {
  const image = parsePNG(imageBuffer);
  const costMap = await getCostMap(image, gamma, costMapMode);
  const config: ZoningConfig = {
    threshA,
    threshB,
    emdGroupSize: emdN,
    kbBits: 2,
    kcBits: 3,
  };

  const cap = calculateCapacity(image.width, image.height, image.channels, costMap, config);

  const totalImagePixels = image.width * image.height;
  const overallBpp = cap.total_capacity_bits / (totalImagePixels || 1);
  const maxPlaintext = Math.max(0, cap.max_bytes - 48);

  const activeMode = costMapMode === 'neural' ? 'neural' : 'heuristic';

  return {
    width: image.width,
    height: image.height,
    channels: image.channels,
    capacity: {
      total_pixels: cap.total_pixels,
      count_zone_a: cap.zone_breakdown.zone_a_count,
      count_zone_b: cap.zone_breakdown.zone_b_count,
      count_zone_c: cap.zone_breakdown.zone_c_count,
      max_bits: cap.total_capacity_bits,
      max_bytes: cap.max_bytes,
      max_plaintext_bytes: maxPlaintext,
      overall_bpp: Number(overallBpp.toFixed(2)),
      zone_a_bpp: cap.zone_breakdown.zone_a_bpp,
      zone_b_bpp: cap.zone_breakdown.zone_b_bpp,
      zone_c_bpp: cap.zone_breakdown.zone_c_bpp,
      zone_breakdown: cap.zone_breakdown,
    },
    cost_map_mode: activeMode,
    model_description:
      activeMode === 'neural'
        ? 'LF-RINN Invertible Transform + CNN Edge/Texture Cost Map'
        : `Heuristic Multi-Scale Edge Fusion (${costMapMode} mode)`,
    emd_n: emdN,
  };
}

export async function runEncodePipeline(
  imageBuffer: Buffer,
  secretText: string,
  passphrase: string,
  threshA: number = 0.35,
  threshB: number = 0.65,
  gamma: number = 0.7,
  kbBits: number = 2,
  kcBits: number = 3,
  costMapMode: string = 'neural',
  adversarialStrength: number = 0.0,
  emdN: number = 2
): Promise<EncodeResult> {
  if (!secretText || !secretText.trim()) {
    throw new Error('Secret message cannot be empty.');
  }
  if (!passphrase) {
    throw new Error('Passphrase is required.');
  }

  const image = parsePNG(imageBuffer);
  const config: ZoningConfig = {
    threshA,
    threshB,
    emdGroupSize: emdN,
    kbBits,
    kcBits,
  };

  const resolvedMode = costMapMode === 'heuristic' ? 'heuristic' : 'neural';

  // Phase 1: Cryptographic pre-processing with header metadata
  const encryptedPayload = encryptPayload(secretText, passphrase, {
    costMapMode: resolvedMode,
    emdN,
    threshA,
    threshB,
  });
  const payloadLenBytes = encryptedPayload.length;

  // Phase 2: Cost map generation (Neural LF-RINN or Heuristic fallback)
  const costMap = await getCostMap(image, gamma, resolvedMode);

  // Repeat cost map 3 times for RGB channels
  const N = image.width * image.height;
  const costMap3D = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const c = costMap[i];
    costMap3D[i * 3 + 0] = c;
    costMap3D[i * 3 + 1] = c;
    costMap3D[i * 3 + 2] = c;
  }

  // Phase 3: Cost-map adaptive zoning & capacity verification
  const zones3D = classifyZones(costMap3D, config);
  const capInfo = calculateCapacity(image.width, image.height, image.channels, costMap, config);

  if (payloadLenBytes > capInfo.max_bytes) {
    const maxChars = Math.max(0, capInfo.max_bytes - 48);
    throw new Error(
      `Message is too long for this image! Image capacity is ${capInfo.max_bytes} bytes (~${maxChars} chars), but encrypted payload requires ${payloadLenBytes} bytes.`
    );
  }

  // Phase 4: Hybrid EMD-OPAP Embedding Engine
  const stegoData = new Uint8Array(image.data);

  const rawZoneA: number[] = [];
  const rawZoneB: number[] = [];
  const rawZoneC: number[] = [];

  for (let i = 0; i < zones3D.length; i++) {
    const z = zones3D[i];
    if (z === 0) rawZoneA.push(i);
    else if (z === 1) rawZoneB.push(i);
    else rawZoneC.push(i);
  }

  // Spatial order — same as decode
  const zoneAIndices = rawZoneA.slice().sort((a, b) => a - b);
  const zoneBIndices = rawZoneB.slice().sort((a, b) => a - b);
  const zoneCIndices = rawZoneC.slice().sort((a, b) => a - b);

  // Convert encrypted payload buffer to bits stream
  const payloadBits: number[] = [];
  for (let bIdx = 0; bIdx < encryptedPayload.length; bIdx++) {
    const byteVal = encryptedPayload[bIdx];
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      payloadBits.push((byteVal >> bitIdx) & 1);
    }
  }

  const totalBitsToEmbed = payloadBits.length;
  let bitsRemaining = totalBitsToEmbed;
  let currentBitIdx = 0;

  let zoneABitsUsed = 0;
  let zoneBBitsUsed = 0;
  let zoneCBitsUsed = 0;

  // 1. Zone A embedding (EMD)
  if (emdN === 3) {
    const zoneAGroups = Math.floor(zoneAIndices.length / 3);
    const zoneAMaxBits = Math.floor(zoneAGroups * Math.log2(7));
    if (zoneAMaxBits > 0 && bitsRemaining > 0) {
      const aBitsCount = Math.min(bitsRemaining, zoneAMaxBits);
      const aBytesCount = Math.ceil(aBitsCount / 8);
      const aPayloadBytes = encryptedPayload.subarray(0, aBytesCount);
      const aDigits = bytesToBase7Digits(aPayloadBytes);

      const digitsEmbedded = embedEMDZoneA(stegoData, zoneAIndices, aDigits, 3);
      zoneABitsUsed = Math.floor(digitsEmbedded * Math.log2(7));
      const aBytesEmbedded = Math.floor(digitsEmbedded / 3);
      currentBitIdx = aBytesEmbedded * 8;
      bitsRemaining = Math.max(0, totalBitsToEmbed - currentBitIdx);
    }
  } else {
    const zoneAGroups = Math.floor(zoneAIndices.length / 2);
    const zoneAMaxBits = Math.floor(zoneAGroups * Math.log2(5));
    if (zoneAMaxBits > 0 && bitsRemaining > 0) {
      const aBitsCount = Math.min(bitsRemaining, zoneAMaxBits);
      const aBytesCount = Math.ceil(aBitsCount / 8);
      const aPayloadBytes = encryptedPayload.subarray(0, aBytesCount);
      const aDigits = bytesToBase5Digits(aPayloadBytes);

      const digitsEmbedded = embedEMDZoneA(stegoData, zoneAIndices, aDigits, 2);
      zoneABitsUsed = Math.floor(digitsEmbedded * Math.log2(5));
      const aBytesEmbedded = Math.floor(digitsEmbedded / 4);
      currentBitIdx = aBytesEmbedded * 8;
      bitsRemaining = Math.max(0, totalBitsToEmbed - currentBitIdx);
    }
  }

  // 2. Zone B embedding (OPAP kbBits)
  if (bitsRemaining > 0 && zoneBIndices.length > 0) {
    const bBitsStream = payloadBits.slice(currentBitIdx, currentBitIdx + bitsRemaining);
    const bEmbeddedCount = embedOPAPZone(stegoData, zoneBIndices, bBitsStream, config.kbBits);
    zoneBBitsUsed = bEmbeddedCount;
    currentBitIdx += bEmbeddedCount;
    bitsRemaining = Math.max(0, totalBitsToEmbed - currentBitIdx);
  }

  // 3. Zone C embedding (OPAP kcBits)
  if (bitsRemaining > 0 && zoneCIndices.length > 0) {
    const cBitsStream = payloadBits.slice(currentBitIdx, currentBitIdx + bitsRemaining);
    const cEmbeddedCount = embedOPAPZone(stegoData, zoneCIndices, cBitsStream, config.kcBits);
    zoneCBitsUsed = cEmbeddedCount;
    currentBitIdx += cEmbeddedCount;
    bitsRemaining = Math.max(0, totalBitsToEmbed - currentBitIdx);
  }

  if (bitsRemaining > 0) {
    throw new Error('Could not fit all bits into available image zones.');
  }

  // Phase 5: Metrics & Visualizations
  const zoneBreakdown = {
    zone_a_bits: zoneABitsUsed,
    zone_b_bits: zoneBBitsUsed,
    zone_c_bits: zoneCBitsUsed,
  };

  const metrics = calculateMetrics(
    image.data,
    stegoData,
    image.width,
    image.height,
    totalBitsToEmbed,
    zoneBreakdown
  );

  const securityReport = calculateSecurityReport(metrics.modified_pixel_percentage, metrics.bpp);
  const visuals = generateVisualizations(image, stegoData, costMap, zones3D);

  return {
    success: true,
    metrics,
    security_report: securityReport,
    visuals,
    cost_map_mode: resolvedMode,
    adversarial_strength: adversarialStrength,
    emd_n: emdN,
  };
}

export async function runDecodePipeline(
  imageBuffer: Buffer,
  passphrase: string,
  threshA: number = 0.35,
  threshB: number = 0.65,
  gamma: number = 0.7,
  kbBits: number = 2,
  kcBits: number = 3,
  costMapMode: string = 'neural',
  emdN: number = 2
): Promise<DecodeResult> {
  if (!passphrase) {
    throw new Error('Passphrase is required.');
  }

  const image = parsePNG(imageBuffer);
  const config: ZoningConfig = {
    threshA,
    threshB,
    emdGroupSize: emdN,
    kbBits,
    kcBits,
  };

  const N = image.width * image.height;

  const resolvedMode = costMapMode === 'heuristic' ? 'heuristic' : 'neural';
  const costMap = await getCostMap(image, gamma, resolvedMode);

  const costMap3D = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const c = costMap[i];
    costMap3D[i * 3 + 0] = c;
    costMap3D[i * 3 + 1] = c;
    costMap3D[i * 3 + 2] = c;
  }

  const zones3D = classifyZones(costMap3D, config);

  const rawZoneA: number[] = [];
  const rawZoneB: number[] = [];
  const rawZoneC: number[] = [];
  for (let i = 0; i < zones3D.length; i++) {
    const z = zones3D[i];
    if (z === 0) rawZoneA.push(i);
    else if (z === 1) rawZoneB.push(i);
    else rawZoneC.push(i);
  }

  // Spatial order (sorted indices) — invariant under embedding noise
  const zoneAIndices = rawZoneA.slice().sort((a, b) => a - b);
  const zoneBIndices = rawZoneB.slice().sort((a, b) => a - b);
  const zoneCIndices = rawZoneC.slice().sort((a, b) => a - b);

  const extractedBytes: number[] = [];

  const appendBytes = (src: Uint8Array | Buffer | number[]) => {
    for (let i = 0; i < src.length; i++) extractedBytes.push(src[i]);
  };

  // Zone A extraction (EMD)
  const zoneAGroups = Math.floor(zoneAIndices.length / emdN);
  if (zoneAGroups > 0) {
    const digits = extractEMDZoneA(image.data, zoneAIndices, zoneAGroups, emdN);
    const aBytes = emdN === 3 ? base7DigitsToBytes(digits) : base5DigitsToBytes(digits);
    appendBytes(aBytes);
  }

  // Zone B extraction (OPAP)
  if (zoneBIndices.length > 0) {
    const bBitsAvail = zoneBIndices.length * config.kbBits;
    const bBits = extractOPAPZone(image.data, zoneBIndices, bBitsAvail, config.kbBits);
    const nBytes = Math.floor(bBits.length / 8);
    for (let byteI = 0; byteI < nBytes; byteI++) {
      let bVal = 0;
      for (let bitI = 0; bitI < 8; bitI++) {
        bVal = (bVal << 1) | bBits[byteI * 8 + bitI];
      }
      extractedBytes.push(bVal);
    }
  }

  // Zone C extraction (OPAP)
  if (zoneCIndices.length > 0) {
    const cBitsAvail = zoneCIndices.length * config.kcBits;
    const cBits = extractOPAPZone(image.data, zoneCIndices, cBitsAvail, config.kcBits);
    const nBytes = Math.floor(cBits.length / 8);
    for (let byteI = 0; byteI < nBytes; byteI++) {
      let bVal = 0;
      for (let bitI = 0; bitI < 8; bitI++) {
        bVal = (bVal << 1) | cBits[byteI * 8 + bitI];
      }
      extractedBytes.push(bVal);
    }
  }

  try {
    const { plaintext, metadata } = decryptPayload(Buffer.from(extractedBytes), passphrase);
    return {
      success: true,
      decrypted_text: plaintext,
      cost_map_mode: metadata?.costMapMode || costMapMode,
    };
  } catch (err: any) {
    throw new Error('Message could not be decrypted — wrong passphrase or corrupted image.');
  }
}
