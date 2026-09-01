export interface ZoningConfig {
  threshA: number; // default 0.35
  threshB: number; // default 0.65
  emdGroupSize: number; // default 2
  kbBits: number; // default 2
  kcBits: number; // default 3
}

export interface CapacityInfo {
  total_pixels: number;
  total_capacity_bits: number;
  max_bytes: number;
  zone_breakdown: {
    zone_a_count: number;
    zone_b_count: number;
    zone_c_count: number;
    zone_a_pct: number;
    zone_b_pct: number;
    zone_c_pct: number;
    zone_a_bits: number;
    zone_b_bits: number;
    zone_c_bits: number;
    zone_a_bpp: number;
    zone_b_bpp: number;
    zone_c_bpp: number;
  };
}

/**
 * Classifies 1D pixel channels into Zone 0 (A - smooth), Zone 1 (B - medium), Zone 2 (C - complex/edge).
 */
export function classifyZones(
  costMap3D: Float32Array,
  config: ZoningConfig
): Uint8Array {
  const N = costMap3D.length;
  const zones = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const cost = costMap3D[i];
    if (cost < config.threshA) {
      zones[i] = 0; // Zone A
    } else if (cost < config.threshB) {
      zones[i] = 1; // Zone B
    } else {
      zones[i] = 2; // Zone C
    }
  }

  return zones;
}

/**
 * Calculates max payload capacity in bits and bytes based on cost map zoning.
 */
export function calculateCapacity(
  width: number,
  height: number,
  channels: number,
  costMap: Float32Array,
  config: ZoningConfig
): CapacityInfo {
  const totalPixels = width * height * channels;
  let countA = 0, countB = 0, countC = 0;

  for (let i = 0; i < costMap.length; i++) {
    const cost = costMap[i];
    if (cost < config.threshA) {
      countA += channels;
    } else if (cost < config.threshB) {
      countB += channels;
    } else {
      countC += channels;
    }
  }

  const emdGroupSize = config.emdGroupSize || 2;
  const bppA = emdGroupSize === 3 ? Math.log2(7) / 3 : Math.log2(5) / 2;
  const bppB = config.kbBits || 2;
  const bppC = config.kcBits || 3;

  const bitsA = Math.floor(countA * bppA);
  const bitsB = Math.floor(countB * bppB);
  const bitsC = Math.floor(countC * bppC);

  const totalBits = bitsA + bitsB + bitsC;
  const maxBytes = Math.floor(totalBits / 8);

  return {
    total_pixels: totalPixels,
    total_capacity_bits: totalBits,
    max_bytes: maxBytes,
    zone_breakdown: {
      zone_a_count: countA,
      zone_b_count: countB,
      zone_c_count: countC,
      zone_a_pct: Number(((countA / (totalPixels || 1)) * 100).toFixed(1)),
      zone_b_pct: Number(((countB / (totalPixels || 1)) * 100).toFixed(1)),
      zone_c_pct: Number(((countC / (totalPixels || 1)) * 100).toFixed(1)),
      zone_a_bits: bitsA,
      zone_b_bits: bitsB,
      zone_c_bits: bitsC,
      zone_a_bpp: Number(bppA.toFixed(2)),
      zone_b_bpp: Number(bppB.toFixed(2)),
      zone_c_bpp: Number(bppC.toFixed(2)),
    },
  };
}
