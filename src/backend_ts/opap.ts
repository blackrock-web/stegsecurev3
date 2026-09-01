/**
 * Optimal Pixel Adjustment Process (OPAP) (Chan & Cheng 2004).
 */

import { STABILITY_BITS } from './costmap';

export function embedOPAPZone(
  imageFlat: Uint8Array,
  indices: number[],
  bitsStream: number[],
  k: number
): number {
  let embeddedCount = 0;
  const totalBits = bitsStream.length;
  const numPixels = Math.floor(totalBits / k);

  const mask = (1 << k) - 1;
  const twoK = 1 << k;

  for (let pIdx = 0; pIdx < numPixels && pIdx < indices.length; pIdx++) {
    const idx = indices[pIdx];
    const origP = imageFlat[idx];

    // Extract k bits from bitsStream
    let val = 0;
    for (let b = 0; b < k; b++) {
      val = (val << 1) | bitsStream[pIdx * k + b];
    }

    // Direct LSB replacement
    const pPrime = (origP & ~mask) | val;

    // OPAP candidate search in [pPrime, pPrime + 2^k, pPrime - 2^k]
    // Bound candidates within the same cost-stability bucket (STABILITY_BITS
    // wide, see costmap.ts) so a candidate shift never flips the pixel's
    // cost-map bucket. NOTE: this bucket must be wider than 2^k for the
    // +/-2^k candidates to ever be reachable at all — with STABILITY_BITS=3
    // (bucket width 8) and k=3 (shift +/-8), every +/-2^k candidate always
    // crossed the bucket boundary and was rejected, silently degrading Zone
    // C's OPAP into plain LSB replacement 100% of the time. STABILITY_BITS=4
    // (bucket width 16) gives the shift room to land in-bucket on one side.
    const bucketWidth = 1 << STABILITY_BITS;
    const bucketBase = origP & ~(bucketWidth - 1);
    const bucketTop = Math.min(255, bucketBase + bucketWidth - 1);
    const candidates = [pPrime, pPrime + twoK, pPrime - twoK];
    let bestP = pPrime;
    let minDiff = Math.abs(pPrime - origP);

    for (const cand of candidates) {
      if (cand >= bucketBase && cand <= bucketTop) {
        const diff = Math.abs(cand - origP);
        if (diff < minDiff) {
          minDiff = diff;
          bestP = cand;
        }
      }
    }

    imageFlat[idx] = bestP;
    embeddedCount += k;
  }

  return embeddedCount;
}

export function extractOPAPZone(
  imageFlat: Uint8Array,
  indices: number[],
  maxBits: number,
  k: number
): number[] {
  const bits: number[] = [];
  const mask = (1 << k) - 1;
  const numPixels = Math.floor(maxBits / k);

  for (let pIdx = 0; pIdx < numPixels && pIdx < indices.length; pIdx++) {
    const idx = indices[pIdx];
    const val = imageFlat[idx] & mask;

    for (let b = k - 1; b >= 0; b--) {
      bits.push((val >> b) & 1);
    }
  }

  return bits;
}