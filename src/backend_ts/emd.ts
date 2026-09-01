/**
 * EMD (Exploiting Modification Direction) algorithm (Zhang & Wang 2006).
 * Features rigorous overflow/underflow boundary compensation for 100% bit-exact recovery.
 */

import { STABILITY_BITS } from './costmap';

// Pixels sitting at the top/bottom edge of a cost-stability bucket (see
// costmap.ts) can't take a plain +/-1 EMD step without flipping their
// cost-map bucket, so they fall back to a larger modular-equivalent jump
// (+/-4 for base-5, +/-6 for base-7 — see embedEMDZoneA below). That
// fallback is ~4-6x more distortive than a normal +/-1 move, so how often
// it fires matters: with a narrower bucket (previously width 8,
// STABILITY_BITS=3) about 1 in 8 pixel touches hit an edge. Using the same
// STABILITY_BITS=4 bucket as the rest of the pipeline roughly halves that
// to 1 in 16, without changing the correctness of the modular substitution
// (still exact, just triggers less often).
const BUCKET_WIDTH = 1 << STABILITY_BITS;
const BUCKET_TOP_RESIDUE = BUCKET_WIDTH - 1;

export function bytesToBase5Digits(bytes: Buffer | Uint8Array): number[] {
  const digits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    let val = bytes[i];
    const d: number[] = [];
    for (let j = 0; j < 4; j++) {
      d.push(val % 5);
      val = Math.floor(val / 5);
    }
    digits.push(...d.reverse());
  }
  return digits;
}

export function base5DigitsToBytes(digits: number[]): Buffer {
  const bytes: number[] = [];
  const numGroups = Math.floor(digits.length / 4);
  for (let g = 0; g < numGroups; g++) {
    const chunk = digits.slice(g * 4, g * 4 + 4);
    let val = 0;
    for (const d of chunk) {
      val = val * 5 + d;
    }
    bytes.push(Math.min(255, Math.max(0, val)));
  }
  return Buffer.from(bytes);
}

export function bytesToBase7Digits(bytes: Buffer | Uint8Array): number[] {
  const digits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    let val = bytes[i];
    const d: number[] = [];
    for (let j = 0; j < 3; j++) {
      d.push(val % 7);
      val = Math.floor(val / 7);
    }
    digits.push(...d.reverse());
  }
  return digits;
}

export function base7DigitsToBytes(digits: number[]): Buffer {
  const bytes: number[] = [];
  const numGroups = Math.floor(digits.length / 3);
  for (let g = 0; g < numGroups; g++) {
    const chunk = digits.slice(g * 3, g * 3 + 3);
    let val = 0;
    for (const d of chunk) {
      val = val * 7 + d;
    }
    bytes.push(Math.min(255, Math.max(0, val)));
  }
  return Buffer.from(bytes);
}

/**
 * Embeds base-5 or base-7 digits into Zone A pixel indices using EMD.
 * Applies boundary overflow wrapping (mod arithmetic) so extraction is 100% loss-free.
 */
export function embedEMDZoneA(
  imageFlat: Uint8Array,
  indices: number[],
  digits: number[],
  emdN: number = 2
): number {
  let embeddedCount = 0;
  const totalDigits = digits.length;

  if (emdN === 3) {
    const numGroups = Math.floor(indices.length / 3);
    for (let g = 0; g < numGroups && embeddedCount < totalDigits; g++) {
      const idx1 = indices[g * 3 + 0];
      const idx2 = indices[g * 3 + 1];
      const idx3 = indices[g * 3 + 2];

      const g1 = imageFlat[idx1];
      const g2 = imageFlat[idx2];
      const g3 = imageFlat[idx3];

      const d = digits[embeddedCount];
      const f = (g1 + 2 * g2 + 3 * g3) % 7;
      const diff = (d - f + 7) % 7;

      let ng1 = g1, ng2 = g2, ng3 = g3;
      if (diff === 1) ng1 = (g1 % BUCKET_WIDTH === BUCKET_TOP_RESIDUE) ? g1 - 6 : (g1 < 255 ? g1 + 1 : g1 - 6);
      else if (diff === 2) ng2 = (g2 % BUCKET_WIDTH === BUCKET_TOP_RESIDUE) ? g2 - 6 : (g2 < 255 ? g2 + 1 : g2 - 6);
      else if (diff === 3) ng3 = (g3 % BUCKET_WIDTH === BUCKET_TOP_RESIDUE) ? g3 - 6 : (g3 < 255 ? g3 + 1 : g3 - 6);
      else if (diff === 4) ng3 = (g3 % BUCKET_WIDTH === 0) ? g3 + 6 : (g3 > 0 ? g3 - 1 : g3 + 6);
      else if (diff === 5) ng2 = (g2 % BUCKET_WIDTH === 0) ? g2 + 6 : (g2 > 0 ? g2 - 1 : g2 + 6);
      else if (diff === 6) ng1 = (g1 % BUCKET_WIDTH === 0) ? g1 + 6 : (g1 > 0 ? g1 - 1 : g1 + 6);

      imageFlat[idx1] = Math.min(255, Math.max(0, ng1));
      imageFlat[idx2] = Math.min(255, Math.max(0, ng2));
      imageFlat[idx3] = Math.min(255, Math.max(0, ng3));

      embeddedCount++;
    }
  } else {
    const numGroups = Math.floor(indices.length / 2);
    for (let g = 0; g < numGroups && embeddedCount < totalDigits; g++) {
      const idx1 = indices[g * 2 + 0];
      const idx2 = indices[g * 2 + 1];

      const g1 = imageFlat[idx1];
      const g2 = imageFlat[idx2];

      const d = digits[embeddedCount];
      const f = (g1 + 2 * g2) % 5;
      const diff = (d - f + 5) % 5;

      let ng1 = g1, ng2 = g2;
      if (diff === 1) ng1 = (g1 % BUCKET_WIDTH === BUCKET_TOP_RESIDUE) ? g1 - 4 : (g1 < 255 ? g1 + 1 : g1 - 4);
      else if (diff === 2) ng2 = (g2 % BUCKET_WIDTH === BUCKET_TOP_RESIDUE) ? g2 - 4 : (g2 < 255 ? g2 + 1 : g2 - 4);
      else if (diff === 3) ng2 = (g2 % BUCKET_WIDTH === 0) ? g2 + 4 : (g2 > 0 ? g2 - 1 : g2 + 4);
      else if (diff === 4) ng1 = (g1 % BUCKET_WIDTH === 0) ? g1 + 4 : (g1 > 0 ? g1 - 1 : g1 + 4);

      imageFlat[idx1] = Math.min(255, Math.max(0, ng1));
      imageFlat[idx2] = Math.min(255, Math.max(0, ng2));

      embeddedCount++;
    }
  }

  return embeddedCount;
}

/**
 * Extracts EMD digits from Zone A pixel indices.
 */
export function extractEMDZoneA(
  imageFlat: Uint8Array,
  indices: number[],
  numGroups: number,
  emdN: number = 2
): number[] {
  const digits: number[] = [];

  if (emdN === 3) {
    for (let g = 0; g < numGroups && (g * 3 + 2) < indices.length; g++) {
      const g1 = imageFlat[indices[g * 3 + 0]];
      const g2 = imageFlat[indices[g * 3 + 1]];
      const g3 = imageFlat[indices[g * 3 + 2]];
      const f = (g1 + 2 * g2 + 3 * g3) % 7;
      digits.push(f);
    }
  } else {
    for (let g = 0; g < numGroups && (g * 2 + 1) < indices.length; g++) {
      const g1 = imageFlat[indices[g * 2 + 0]];
      const g2 = imageFlat[indices[g * 2 + 1]];
      const f = (g1 + 2 * g2) % 5;
      digits.push(f);
    }
  }

  return digits;
}