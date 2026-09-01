/**
 * ONNX Runtime Session Singleton for LF-RINN Neural Cost Map.
 *
 * NOTE ON MODEL ARTIFACTS (Task 7):
 * - `cost_map_final.pth` & `cost_map_cnn.pth`: PyTorch training checkpoints
 *   (preserved in `models/lfrinn/checkpoints/` for reproducibility and retraining).
 *   Node.js does not have a PyTorch runtime, so .pth files are never loaded at runtime.
 * - `cost_map_lfrinn.onnx`: The compiled, self-contained ONNX runtime artifact loaded
 *   once at server startup via onnxruntime-node for zero-overhead inference.
 */

import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';

let sessionInstance: ort.InferenceSession | null = null;
let isInitializing = false;
let initError: Error | null = null;

const POSSIBLE_MODEL_PATHS = [
  path.join(process.cwd(), 'cost_map_lfrinn.onnx'),
  path.join(process.cwd(), 'cost_map_lfrinn (1).onnx'),
  path.join(process.cwd(), 'models/lfrinn/checkpoints/cost_map_lfrinn.onnx'),
];

/**
 * Initializes the ONNX InferenceSession singleton.
 * Safe to call multiple times (idempotent).
 */
export async function initOnnxSession(): Promise<ort.InferenceSession | null> {
  if (sessionInstance) {
    return sessionInstance;
  }
  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return sessionInstance;
  }

  isInitializing = true;
  initError = null;

  try {
    let modelPath = '';
    for (const p of POSSIBLE_MODEL_PATHS) {
      if (fs.existsSync(p)) {
        modelPath = p;
        break;
      }
    }

    if (!modelPath) {
      throw new Error(`ONNX model file not found in searched paths: ${POSSIBLE_MODEL_PATHS.join(', ')}`);
    }

    // Configure session options for bit-exact deterministic inference
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
    };

    sessionInstance = await ort.InferenceSession.create(modelPath, options);
    console.log(`[ONNX] Successfully loaded LF-RINN model from: ${modelPath}`);
    return sessionInstance;
  } catch (err: any) {
    initError = err;
    console.warn(`[ONNX] Warning: Failed to initialize LF-RINN ONNX session: ${err.message}. Falling back to heuristic cost map.`);
    sessionInstance = null;
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Returns the loaded ONNX InferenceSession instance, or null if unavailable.
 */
export function getOnnxSession(): ort.InferenceSession | null {
  return sessionInstance;
}

/**
 * Checks if the neural cost map model is loaded and ready for inference.
 */
export function isNeuralModelAvailable(): boolean {
  return sessionInstance !== null;
}
