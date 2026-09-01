import * as ort from 'onnxruntime-node';
import { ImageRGB } from './imageUtils';
import { quantizeForCostStability, computeCostMap as computeHeuristicCostMap, STABILITY_BITS } from './costmap';
import { getOnnxSession, initOnnxSession } from './onnxSession';

let cachedSession: ort.InferenceSession | null = null;

/**
 * Loads the ONNX cost-map model once and caches it. Call at server
 * startup so inference-path latency doesn't include model load time.
 */
export async function loadCostMapSession(
  onnxPath: string = 'cost_map_lfrinn.onnx'
): Promise<ort.InferenceSession> {
  if (cachedSession) return cachedSession;
  const session = await initOnnxSession();
  if (session) {
    cachedSession = session;
    return cachedSession;
  }
  cachedSession = await ort.InferenceSession.create(onnxPath, {
    executionProviders: ['cpu'],
  });
  return cachedSession;
}

/**
 * Neural cost map, same [0,1] output contract as computeCostMap().
 * Applies stability quantization before inference so cover-time and
 * decode-time cost maps agree and zone classification round-trips cleanly.
 *
 * LF-RINN's Haar DWT requires even width/height; odd dimensions are
 * reflect-padded by one row/col and cropped back after inference.
 */
export async function computeCostMapNeural(
  image: ImageRGB,
  sessionOrParam?: ort.InferenceSession | number,
  stabilizeBitsOrMode?: number | string
): Promise<Float32Array> {
  const { width, height, data } = image;
  const N = width * height;

  // Resolve session
  let session: ort.InferenceSession | null = null;
  // Default to the shared STABILITY_BITS constant (see costmap.ts) so the
  // neural path quantizes identically to the heuristic path. A prior
  // hardcoded default of 3 here silently diverged from costmap.ts and was
  // also too narrow relative to OPAP's k=3 zone (see costmap.ts docblock).
  let stabilizeBits = STABILITY_BITS;

  if (sessionOrParam && typeof sessionOrParam === 'object' && 'run' in sessionOrParam) {
    session = sessionOrParam as ort.InferenceSession;
    if (typeof stabilizeBitsOrMode === 'number') {
      stabilizeBits = stabilizeBitsOrMode;
    }
  } else {
    session = getOnnxSession();
    if (!session) {
      session = await initOnnxSession();
    }
    if (typeof sessionOrParam === 'number' && Number.isInteger(sessionOrParam) && sessionOrParam >= 1 && sessionOrParam <= 7) {
      stabilizeBits = sessionOrParam;
    } else if (typeof stabilizeBitsOrMode === 'number') {
      stabilizeBits = stabilizeBitsOrMode;
    }
  }

  // Fail loudly if ONNX session could not be established (scientific integrity: no silent fallbacks)
  if (!session) {
    throw new Error('LF-RINN ONNX neural model session is unavailable. Explicitly select heuristic mode or configure the ONNX runtime model.');
  }

  try {
    // 1. Grayscale conversion with channel stability masking (ITU-R BT.601)
    const mask = ~((1 << stabilizeBits) - 1);
    const gray = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = data[i * 3 + 0] & mask;
      const g = data[i * 3 + 1] & mask;
      const b = data[i * 3 + 2] & mask;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // 2. Stability quantization so cover and stego inputs to network agree
    const stabilized = quantizeForCostStability(gray, stabilizeBits);

    // 3. Normalize to [0,1] for the neural network
    const normalized = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      normalized[i] = stabilized[i] / 255.0;
    }

    // 4. Pad to even dimensions (Haar DWT requirement)
    const padW = width % 2 === 0 ? width : width + 1;
    const padH = height % 2 === 0 ? height : height + 1;
    const padded = new Float32Array(padW * padH);
    for (let y = 0; y < padH; y++) {
      const srcY = y < height ? y : Math.max(0, height - 2); // reflect row
      for (let x = 0; x < padW; x++) {
        const srcX = x < width ? x : Math.max(0, width - 2); // reflect col
        padded[y * padW + x] = normalized[srcY * width + srcX];
      }
    }

    // 5. Run inference: input tensor [1, 1, padH, padW]
    const inputTensor = new ort.Tensor('float32', padded, [1, 1, padH, padW]);
    const inputName = session.inputNames[0] || 'cover_patch';
    const outputName = session.outputNames[0] || 'cost_map';

    const results = await session.run({ [inputName]: inputTensor });
    const outputTensor = results[outputName];
    if (!outputTensor || !outputTensor.data) {
      throw new Error('ONNX inference returned empty tensor.');
    }
    const output = outputTensor.data as Float32Array;

    // 6. Crop back to original size if padded, and clamp to [0, 1]
    const finalMap = new Float32Array(N);
    if (padW === width && padH === height) {
      for (let i = 0; i < N; i++) {
        const val = output[i];
        finalMap[i] = val < 0 ? 0 : val > 1 ? 1 : val;
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const val = output[y * padW + x];
          finalMap[y * width + x] = val < 0 ? 0 : val > 1 ? 1 : val;
        }
      }
    }

    return finalMap;
  } catch (err: any) {
    throw new Error(`[LF-RINN Neural] Inference error: ${err.message}`);
  }
}

/**
 * Releases the cached ONNX session. Call on server shutdown.
 */
export async function disposeCostMapSession(): Promise<void> {
  if (cachedSession) {
    await cachedSession.release();
    cachedSession = null;
  }
}