import { ImageRGB, rgbToBase64PNG } from './imageUtils';

/**
 * Generates visualization base64 data URLs:
 * - stego_b64
 * - heatmap_b64 (amplified difference heatmap with thermal palette)
 * - mask_b64 / binary_mask_b64 (white pixels = modified)
 * - zone_map_b64 (Zone A = Lilac, Zone B = Pink, Zone C = Fuchsia)
 * - gradient_overlay_b64 (Cyan highlight overlay)
 * - highlight_overlay_b64 (bright gold pixels where any data bit was written)
 * - rgb_bits_b64 (RGB mode: pure R / G / B bright channels show exactly which
 *   color channel holds the embedded data bits)
 */
export function generateVisualizations(
  cover: ImageRGB,
  stegoData: Uint8Array,
  costMap: Float32Array,
  zones: Uint8Array
) {
  const { width, height } = cover;
  const N = width * height;
  const numChannels = N * 3;

  // 1. Stego base64
  const stegoB64 = rgbToBase64PNG(stegoData, width, height);

  // 2. Diff Heatmap & Binary Mask
  const heatmapData = new Uint8Array(numChannels);
  const binaryMaskData = new Uint8Array(numChannels);

  for (let i = 0; i < numChannels; i += 3) {
    const dR = Math.abs(cover.data[i + 0] - stegoData[i + 0]);
    const dG = Math.abs(cover.data[i + 1] - stegoData[i + 1]);
    const dB = Math.abs(cover.data[i + 2] - stegoData[i + 2]);
    const maxDiff = Math.max(dR, dG, dB);

    if (maxDiff > 0) {
      binaryMaskData[i + 0] = 255;
      binaryMaskData[i + 1] = 255;
      binaryMaskData[i + 2] = 255;

      // Amplified thermal heatmap
      const amp = Math.min(255, maxDiff * 40 + 120);
      heatmapData[i + 0] = amp;
      heatmapData[i + 1] = Math.max(0, 220 - amp);
      heatmapData[i + 2] = 40;
    } else {
      const gray = 0.299 * cover.data[i] + 0.587 * cover.data[i + 1] + 0.114 * cover.data[i + 2];
      const faint = Math.floor(gray * 0.12);
      heatmapData[i + 0] = faint;
      heatmapData[i + 1] = faint;
      heatmapData[i + 2] = faint;

      binaryMaskData[i + 0] = 0;
      binaryMaskData[i + 1] = 0;
      binaryMaskData[i + 2] = 0;
    }
  }

  const heatmapB64 = rgbToBase64PNG(heatmapData, width, height);
  const binaryMaskB64 = rgbToBase64PNG(binaryMaskData, width, height);

  // 3. Zone Map visualization
  const zoneMapData = new Uint8Array(numChannels);
  for (let i = 0; i < numChannels; i += 3) {
    const z = zones[i];
    const gray = 0.299 * cover.data[i] + 0.587 * cover.data[i + 1] + 0.114 * cover.data[i + 2];

    let zR = 192, zG = 132, zB = 252; // Zone A – lilac
    if (z === 1) {
      zR = 244; zG = 114; zB = 182;   // Zone B – pink
    } else if (z === 2) {
      zR = 217; zG = 70; zB = 239;    // Zone C – fuchsia
    }

    zoneMapData[i + 0] = Math.floor(0.62 * zR + 0.38 * gray);
    zoneMapData[i + 1] = Math.floor(0.62 * zG + 0.38 * gray);
    zoneMapData[i + 2] = Math.floor(0.62 * zB + 0.38 * gray);
  }

  const zoneMapB64 = rgbToBase64PNG(zoneMapData, width, height);

  // 4. Gradient / cost overlay (cyan)
  const gradOverlayData = new Uint8Array(numChannels);
  for (let i = 0; i < N; i++) {
    const cost = costMap[i];
    const alpha = Math.min(0.85, cost * 0.8);
    const idx = i * 3;
    for (let c = 0; c < 3; c++) {
      const orig = cover.data[idx + c];
      const cyan = c === 0 ? 6 : c === 1 ? 182 : 212;
      gradOverlayData[idx + c] = Math.floor((1 - alpha) * orig + alpha * cyan);
    }
  }
  const gradientOverlayB64 = rgbToBase64PNG(gradOverlayData, width, height);

  // 5. Bright gold highlights – any pixel that received at least one data bit
  const highlightData = new Uint8Array(numChannels);
  for (let i = 0; i < numChannels; i += 3) {
    const dR = Math.abs(cover.data[i + 0] - stegoData[i + 0]);
    const dG = Math.abs(cover.data[i + 1] - stegoData[i + 1]);
    const dB = Math.abs(cover.data[i + 2] - stegoData[i + 2]);
    const isModified = (dR + dG + dB) > 0;

    if (isModified) {
      highlightData[i + 0] = 255;
      highlightData[i + 1] = 230;
      highlightData[i + 2] = 40;
    } else {
      highlightData[i + 0] = Math.floor(stegoData[i + 0] * 0.35);
      highlightData[i + 1] = Math.floor(stegoData[i + 1] * 0.35);
      highlightData[i + 2] = Math.floor(stegoData[i + 2] * 0.35);
    }
  }
  const highlightOverlayB64 = rgbToBase64PNG(highlightData, width, height);

  // 6. RGB Bits Mode – pure channel colours show exactly where data bits live
  //    R channel modified → pure bright red
  //    G channel modified → pure bright green
  //    B channel modified → pure bright blue
  //    Multiple channels → additive mix (yellow / magenta / cyan / white)
  const rgbBitsData = new Uint8Array(numChannels);
  for (let i = 0; i < numChannels; i += 3) {
    const dR = Math.abs(cover.data[i + 0] - stegoData[i + 0]);
    const dG = Math.abs(cover.data[i + 1] - stegoData[i + 1]);
    const dB = Math.abs(cover.data[i + 2] - stegoData[i + 2]);

    // Dark base
    rgbBitsData[i + 0] = 8;
    rgbBitsData[i + 1] = 8;
    rgbBitsData[i + 2] = 12;

    if (dR > 0) rgbBitsData[i + 0] = 255; // bright red
    if (dG > 0) rgbBitsData[i + 1] = 255; // bright green
    if (dB > 0) rgbBitsData[i + 2] = 255; // bright blue
  }
  const rgbBitsB64 = rgbToBase64PNG(rgbBitsData, width, height);

  // 7. Cover base64
  const coverB64 = rgbToBase64PNG(cover.data, width, height);

  // 8. Cost Map base64 (Jet/Thermal colormap of normalized cost map)
  const costMapRGB = new Uint8Array(numChannels);
  for (let i = 0; i < N; i++) {
    const c = Math.min(1.0, Math.max(0.0, costMap[i]));
    const idx = i * 3;
    // Jet/Magma style colormap: low cost (purple/blue), mid cost (red/orange), high cost (yellow)
    let r = 0, g = 0, b = 0;
    if (c < 0.25) {
      r = Math.floor(c * 4 * 80);
      g = Math.floor(c * 4 * 30);
      b = Math.floor(180 + c * 4 * 75);
    } else if (c < 0.5) {
      const t = (c - 0.25) * 4;
      r = Math.floor(80 + t * 140);
      g = Math.floor(30 + t * 40);
      b = Math.floor(255 * (1 - t));
    } else if (c < 0.75) {
      const t = (c - 0.5) * 4;
      r = Math.floor(220 + t * 35);
      g = Math.floor(70 + t * 120);
      b = 0;
    } else {
      const t = (c - 0.75) * 4;
      r = 255;
      g = Math.floor(190 + t * 65);
      b = Math.floor(t * 180);
    }
    costMapRGB[idx + 0] = r;
    costMapRGB[idx + 1] = g;
    costMapRGB[idx + 2] = b;
  }
  const costMapB64 = rgbToBase64PNG(costMapRGB, width, height);

  // 9. Amplified Residual base64 (x25 difference on neutral 128 gray canvas)
  const residualRGB = new Uint8Array(numChannels);
  for (let i = 0; i < numChannels; i += 3) {
    const dR = (stegoData[i + 0] - cover.data[i + 0]) * 25;
    const dG = (stegoData[i + 1] - cover.data[i + 1]) * 25;
    const dB = (stegoData[i + 2] - cover.data[i + 2]) * 25;

    residualRGB[i + 0] = Math.min(255, Math.max(0, 128 + dR));
    residualRGB[i + 1] = Math.min(255, Math.max(0, 128 + dG));
    residualRGB[i + 2] = Math.min(255, Math.max(0, 128 + dB));
  }
  const residualB64 = rgbToBase64PNG(residualRGB, width, height);

  return {
    cover_b64: coverB64,
    cover: coverB64,
    stego_b64: stegoB64,
    stego: stegoB64,
    cost_map_b64: costMapB64,
    cost_map: costMapB64,
    zone_map_b64: zoneMapB64,
    zone_map: zoneMapB64,
    residual_b64: residualB64,
    residual: residualB64,
    heatmap_b64: heatmapB64,
    mask_b64: binaryMaskB64,           // canonical key expected by frontend
    binary_mask_b64: binaryMaskB64,    // keep for backward compatibility
    gradient_overlay_b64: gradientOverlayB64,
    highlight_overlay_b64: highlightOverlayB64,
    rgb_bits_b64: rgbBitsB64,
  };
}
