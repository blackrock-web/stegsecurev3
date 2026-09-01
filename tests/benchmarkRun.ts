import { BENCHMARK_MODELS, executeBenchmarkOperation } from '../src/lib/benchmarkModels';
import { initOnnxSession } from '../src/backend_ts/onnxSession';

// Polyfill ImageData for node environment
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
(global as any).ImageData = MockImageData;

async function runAll() {
  await initOnnxSession();
  const payloadText = 'CONFIDENTIAL RESEARCH PAYLOAD: Adaptive EMD-OPAP Verification Sequence 2026';
  const passphrase = 'VaultSecretPass2026!';

  const w = 256, h = 256;
  const covers = [
    { name: 'BossBase High-Texture Simulation', cat: 'High-Frequency Texture', gen: (x: number, y: number) => Math.floor(128 + Math.sin(x * 0.1) * Math.cos(y * 0.1) * 60 + (((x ^ y) & 8) ? 20 : -20)) },
    { name: 'Smooth Atmospheric Gradient', cat: 'Low-Frequency Smooth', gen: (x: number, y: number) => Math.floor((x / w) * 120 + (y / h) * 100) },
    { name: 'Architectural Geometric Edges', cat: 'Sharp Structural Edges', gen: (x: number, y: number) => (((x % 32 === 0 || y % 32 === 0) ? 220 : 40)) },
    { name: 'Complex Sensor Noise', cat: 'Random Entropy', gen: (x: number, y: number) => (((x * 37 + y * 73 + (x ^ y)) & 255)) }
  ];

  console.log(`Testing ${BENCHMARK_MODELS.length} models on 4 covers...\n`);
  
  let totalTests = 0;
  let successfulExtractions = 0;

  for (const cover of covers) {
    console.log(`=== Cover: ${cover.name} ===`);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = Math.min(255, Math.max(0, cover.gen(x, y)));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    const imgData = new MockImageData(data, w, h);
    
    for (const model of BENCHMARK_MODELS) {
      totalTests++;
      const rec = await executeBenchmarkOperation(model, imgData as any, payloadText, passphrase, cover.name, 1, cover.cat);
      if (rec.extractionSuccess) successfulExtractions++;
      console.log(`  [${rec.extractionSuccess ? 'SUCCESS' : 'FAILED'}] ${model.name.padEnd(50)} | PSNR: ${(rec.psnrDb?.toFixed(2) ?? 'N/A').padStart(6)} dB | SSIM: ${rec.ssim?.toFixed(4) ?? 'N/A'} | Status: ${rec.status}`);
    }
    console.log('');
  }

  console.log(`========================================`);
  console.log(`Benchmark Complete: ${successfulExtractions}/${totalTests} extractions successful.`);
  console.log(`========================================`);
}

runAll();
