/**
 * Ranks pixel indices in cost-minimizing order within each zone.
 * Higher cost (more complex/edge/textured pixel) is sorted first.
 */
export function rankZoneIndices(
  costFlat: Float32Array,
  zoneIndices: number[],
  isEMD: boolean = false,
  groupSize: number = 2
): number[] {
  if (zoneIndices.length === 0) return [];

  // Sort indices by cost in descending order (highest cost = safest first)
  const sorted = Array.from(zoneIndices).sort((a, b) => costFlat[b] - costFlat[a]);

  if (isEMD) {
    // Truncate to multiple of groupSize
    const validLen = Math.floor(sorted.length / groupSize) * groupSize;
    return sorted.slice(0, validLen);
  }

  return sorted;
}
