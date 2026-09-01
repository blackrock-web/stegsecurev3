import { PNG } from 'pngjs';

export interface ImageRGB {
  width: number;
  height: number;
  channels: number; // 3 (R, G, B)
  data: Uint8Array; // size: H * W * 3
}

/**
 * Parses PNG image buffer into RGB Uint8Array data (H * W * 3).
 */
export function parsePNG(buffer: Buffer): ImageRGB {
  const png = PNG.sync.read(buffer);
  const width = png.width;
  const height = png.height;
  const rgbData = new Uint8Array(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    rgbData[i * 3 + 0] = png.data[i * 4 + 0]; // R
    rgbData[i * 3 + 1] = png.data[i * 4 + 1]; // G
    rgbData[i * 3 + 2] = png.data[i * 4 + 2]; // B
  }

  return {
    width,
    height,
    channels: 3,
    data: rgbData,
  };
}

/**
 * Encodes RGB Uint8Array (H * W * 3) into base64 PNG data URL string.
 */
export function rgbToBase64PNG(rgbData: Uint8Array, width: number, height: number): string {
  const png = new PNG({ width, height });

  for (let i = 0; i < width * height; i++) {
    png.data[i * 4 + 0] = rgbData[i * 3 + 0];
    png.data[i * 4 + 1] = rgbData[i * 3 + 1];
    png.data[i * 4 + 2] = rgbData[i * 3 + 2];
    png.data[i * 4 + 3] = 255; // Alpha 100%
  }

  const pngBuffer = PNG.sync.write(png);
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}
