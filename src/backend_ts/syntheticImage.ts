import { PNG } from 'pngjs';

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 * Deterministic: identical seeds produce identical floating point sequence in [0, 1).
 */
export function createSeededRNG(seed: number = 42): () => number {
  let s = (seed >>> 0) || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticPatternType = 'mixed' | 'smooth' | 'texture' | 'edges' | 'noise';

/**
 * Generates a synthetic test image PNG buffer with controlled texture, gradient, and edge characteristics.
 */
export function createSyntheticPNG(
  width: number,
  height: number,
  pattern: SyntheticPatternType = 'mixed',
  seed: number = 42
): Buffer {
  const rng = createSeededRNG(seed);
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let r = 128;
      let g = 128;
      let b = 128;

      switch (pattern) {
        case 'smooth': {
          // Low-frequency continuous gradient across image (very low texture/edges)
          r = Math.floor((x / width) * 200 + 25);
          g = Math.floor((y / height) * 180 + 35);
          b = Math.floor(100 + Math.sin((x / width) * Math.PI) * 50);
          break;
        }
        case 'texture': {
          // High-frequency texture and checker patterns everywhere
          const checker1 = ((x ^ y) & 4) ? 90 : 0;
          const checker2 = ((x * 3 + y * 5) & 8) ? 70 : 0;
          const trig = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 80;
          r = Math.min(255, Math.max(0, Math.floor(100 + trig + checker1)));
          g = Math.min(255, Math.max(0, Math.floor(80 + trig + checker2)));
          b = Math.min(255, Math.max(0, Math.floor(120 + checker1 - checker2 / 2)));
          break;
        }
        case 'edges': {
          // Sharp grid lines and geometric step transitions
          const isGrid = x % 24 === 0 || y % 24 === 0;
          const isDiag = (x + y) % 32 === 0;
          const base = ((Math.floor(x / 48) + Math.floor(y / 48)) % 2 === 0) ? 220 : 35;
          r = isGrid ? 255 : isDiag ? 0 : base;
          g = isGrid ? 255 : isDiag ? 200 : base;
          b = isGrid ? 0 : isDiag ? 255 : base;
          break;
        }
        case 'noise': {
          // Seeded pseudo-random noise
          r = Math.floor(rng() * 256);
          g = Math.floor(rng() * 256);
          b = Math.floor(rng() * 256);
          break;
        }
        case 'mixed':
        default: {
          // Synthesize gradient + high frequency texture + edges
          const gradient = Math.sin((x / width) * Math.PI) * 128 + 64;
          const checker = ((x ^ y) & 8) ? 40 : 0;
          const edge = (x % 32 === 0 || y % 32 === 0) ? 60 : 0;

          r = Math.min(255, Math.max(0, Math.floor(gradient + checker + edge)));
          g = Math.min(255, Math.max(0, Math.floor((y / height) * 200 + checker)));
          b = Math.min(255, Math.max(0, Math.floor(128 + Math.cos(x * 0.1) * 64)));
          break;
        }
      }

      png.data[idx + 0] = Math.min(255, Math.max(0, r));
      png.data[idx + 1] = Math.min(255, Math.max(0, g));
      png.data[idx + 2] = Math.min(255, Math.max(0, b));
      png.data[idx + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}
