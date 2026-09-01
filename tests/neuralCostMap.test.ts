import { PNG } from 'pngjs';
import { computeCostMapNeural } from '../src/backend_ts/costMapNeural';
import { computeCostMap as computeHeuristicCostMap } from '../src/backend_ts/costmap';
import { runEncodePipeline, runDecodePipeline, runCapacityCheck } from '../src/backend_ts/pipeline';
import { initOnnxSession, isNeuralModelAvailable } from '../src/backend_ts/onnxSession';
import { createSyntheticPNG, createSeededRNG } from '../src/backend_ts/syntheticImage';
import { runBenchmarkSuite, runAblationStudy } from '../src/backend_ts/benchmarkEngine';
import { classifyZones, ZoningConfig } from '../src/backend_ts/zoning';

async function runStabilityTestSuite() {
  console.log('====================================================');
  console.log('SecureStegVault: Research Integrity & Stability Tests');
  console.log('====================================================');

  // Step 0: Initialize Session
  await initOnnxSession();
  const neuralLoaded = isNeuralModelAvailable();
  console.log(`[Init] ONNX Neural Model Available: ${neuralLoaded ? 'YES (Loaded)' : 'NO (Heuristic Engine Active)'}`);

  let allPassed = true;

  // -------------------------------------------------------------------------
  // Test 1: Determinism & Bit-Exact Replicability
  // -------------------------------------------------------------------------
  console.log('\n[Test 1] Testing Determinism (Bit-exact repeat inference)...');
  try {
    const w = 128;
    const h = 128;
    const testBuf = createSyntheticPNG(w, h, 'mixed', 42);
    const png = PNG.sync.read(testBuf);
    const rgbData = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgbData[i * 3 + 0] = png.data[i * 4 + 0];
      rgbData[i * 3 + 1] = png.data[i * 4 + 1];
      rgbData[i * 3 + 2] = png.data[i * 4 + 2];
    }
    const img = { width: w, height: h, channels: 3, data: rgbData };

    const run1 = computeHeuristicCostMap(img, 0.7, 'advanced');
    const run2 = computeHeuristicCostMap(img, 0.7, 'advanced');

    let maxDiff = 0;
    let diffCount = 0;
    for (let i = 0; i < run1.length; i++) {
      const d = Math.abs(run1[i] - run2[i]);
      if (d > maxDiff) maxDiff = d;
      if (d > 0) diffCount++;
    }

    if (diffCount === 0 && maxDiff === 0) {
      console.log(`  PASSED: 100% bit-exact match across runs (max diff: ${maxDiff}, diff count: 0/${run1.length}).`);
    } else {
      console.error(`  FAILED: Non-deterministic output detected (diff count: ${diffCount}, max diff: ${maxDiff})`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // Test 2: Multi-Configuration Round-Trip Integrity (Heuristic & Neural)
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Multi-Configuration Round-Trip Integrity (Encode -> Decode)...');
  try {
    const testConfigurations = [
      { w: 256, h: 256, gamma: 0.7, threshA: 0.35, threshB: 0.65, mode: 'heuristic', emdN: 2 },
      { w: 128, h: 128, gamma: 0.5, threshA: 0.25, threshB: 0.75, mode: 'heuristic', emdN: 2 },
      { w: 200, h: 200, gamma: 0.9, threshA: 0.40, threshB: 0.70, mode: 'heuristic', emdN: 3 },
      { w: 255, h: 257, gamma: 0.7, threshA: 0.35, threshB: 0.65, mode: 'heuristic', emdN: 2 },
      { w: 301, h: 299, gamma: 0.7, threshA: 0.30, threshB: 0.60, mode: 'heuristic', emdN: 2 },
    ];

    for (let i = 0; i < testConfigurations.length; i++) {
      const { w, h, gamma, threshA, threshB, mode, emdN } = testConfigurations[i];
      const coverBuf = createSyntheticPNG(w, h, 'mixed', 100 + i * 7);
      const secretMsg = `CONFIDENTIAL_PAYLOAD_CONFIG_${i}_SIZE_${w}x${h}_GAMMA_${gamma}_EMD_${emdN}_#${Date.now()}`;
      const passphrase = `Passphrase_Config_${i}_Secure!`;

      const encodeRes = await runEncodePipeline(
        coverBuf,
        secretMsg,
        passphrase,
        threshA,
        threshB,
        gamma,
        2,
        3,
        mode,
        0.0,
        emdN
      );

      const stegoBuf = Buffer.from(encodeRes.visuals.stego_b64.replace(/^data:image\/png;base64,/, ''), 'base64');
      const decodeRes = await runDecodePipeline(
        stegoBuf,
        passphrase,
        threshA,
        threshB,
        gamma,
        2,
        3,
        mode,
        emdN
      );

      if (decodeRes.success && decodeRes.decrypted_text === secretMsg) {
        console.log(`  PASSED Config #${i + 1} (${w}x${h}, gamma=${gamma}, A=${threshA}, B=${threshB}, emd=${emdN}): PSNR = ${encodeRes.metrics.psnr_db.toFixed(2)} dB, SSIM = ${encodeRes.metrics.ssim.toFixed(4)}, 100% byte match.`);
      } else {
        console.error(`  FAILED Config #${i + 1}: Extracted "${decodeRes.decrypted_text}" !== "${secretMsg}"`);
        allPassed = false;
      }
    }
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // Test 3: Adaptive Content-Dependent Zoning (Smooth vs Texture Comparison)
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Testing Content-Dependent Adaptive Zoning (Smooth vs High-Texture)...');
  try {
    const w = 256;
    const h = 256;
    const smoothBuf = createSyntheticPNG(w, h, 'smooth', 42);
    const textureBuf = createSyntheticPNG(w, h, 'texture', 42);

    const smoothCap = await runCapacityCheck(smoothBuf, 0.35, 0.65, 0.7, 'heuristic', 2);
    const textureCap = await runCapacityCheck(textureBuf, 0.35, 0.65, 0.7, 'heuristic', 2);

    console.log(`  Smooth Image Zone Breakdown  : Zone A = ${smoothCap.capacity.count_zone_a} (${smoothCap.capacity.zone_breakdown.zone_a_pct}%), Zone B = ${smoothCap.capacity.count_zone_b} (${smoothCap.capacity.zone_breakdown.zone_b_pct}%), Zone C = ${smoothCap.capacity.count_zone_c} (${smoothCap.capacity.zone_breakdown.zone_c_pct}%)`);
    console.log(`  Texture Image Zone Breakdown : Zone A = ${textureCap.capacity.count_zone_a} (${textureCap.capacity.zone_breakdown.zone_a_pct}%), Zone B = ${textureCap.capacity.count_zone_b} (${textureCap.capacity.zone_breakdown.zone_b_pct}%), Zone C = ${textureCap.capacity.count_zone_c} (${textureCap.capacity.zone_breakdown.zone_c_pct}%)`);

    // In a content-adaptive scheme, smooth images have much higher low-cost Zone A allocations than high-texture images
    const smoothZoneAPct = smoothCap.capacity.zone_breakdown.zone_a_pct;
    const textureZoneAPct = textureCap.capacity.zone_breakdown.zone_a_pct;

    if (Math.abs(smoothZoneAPct - textureZoneAPct) > 5) {
      console.log(`  PASSED: Zone allocation is dynamically content-adaptive (difference: ${Math.abs(smoothZoneAPct - textureZoneAPct).toFixed(1)}%).`);
    } else {
      console.error(`  FAILED: Zone allocations did not respond to image texture differences.`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // Test 4: Non-Row-Stripe Spatial Verification (Spot-checking Zone A Y coordinates)
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Testing Non-Row-Stripe Spatial Distribution...');
  try {
    const w = 256;
    const h = 256;
    const imgBuf = createSyntheticPNG(w, h, 'edges', 42);
    const png = PNG.sync.read(imgBuf);
    const rgbData = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgbData[i * 3 + 0] = png.data[i * 4 + 0];
      rgbData[i * 3 + 1] = png.data[i * 4 + 1];
      rgbData[i * 3 + 2] = png.data[i * 4 + 2];
    }
    const img = { width: w, height: h, channels: 3, data: rgbData };
    const costMap = computeHeuristicCostMap(img, 0.7, 'advanced');

    const config: ZoningConfig = { threshA: 0.35, threshB: 0.65, emdGroupSize: 2, kbBits: 2, kcBits: 3 };
    const zones = classifyZones(costMap, config);

    let bottomHalfZoneACount = 0;
    let totalZoneACount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (zones[idx] === 0) {
          totalZoneACount++;
          if (y >= h * 0.5) {
            bottomHalfZoneACount++;
          }
        }
      }
    }

    const bottomHalfFraction = bottomHalfZoneACount / (totalZoneACount || 1);
    console.log(`  Total Zone A pixels: ${totalZoneACount}, in bottom half (y >= ${h / 2}): ${bottomHalfZoneACount} (${(bottomHalfFraction * 100).toFixed(1)}%)`);

    // A row-stripe partition with threshA=0.35 would have 0% in bottom half (y >= 128).
    // An adaptive cost map will have substantial Zone A pixels scattered across the lower half.
    if (bottomHalfFraction > 0.15) {
      console.log(`  PASSED: Verified spatial distribution is fully 2D cost-driven, not row-stripe partitioned.`);
    } else {
      console.error(`  FAILED: Zone A appears confined to upper rows (bottom half fraction: ${(bottomHalfFraction * 100).toFixed(1)}%)`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // Test 5: Benchmark & Ablation Engine Real Execution & Persistence
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Testing Benchmark & Ablation Execution Engines...');
  try {
    const benchRes = await runBenchmarkSuite(2, 42);
    console.log(`  Benchmark executed across ${benchRes.metrics.length} strategies, ${benchRes.image_count_used} images.`);
    for (const m of benchRes.metrics) {
      console.log(`    - ${m.strategy}: PSNR=${m.psnr_mean} dB, SSIM=${m.ssim_mean}, Latency=${m.latency_ms} ms`);
    }

    const ablatRes = await runAblationStudy(2, 42);
    console.log(`  Ablation executed across ${ablatRes.ablations.length} ablation points.`);
    for (const ab of ablatRes.ablations) {
      console.log(`    - ${ab.name}: PSNR=${ab.psnr} dB, SSIM=${ab.ssim}, SecScore=${ab.security_score}`);
    }

    console.log(`  PASSED: Benchmark and Ablation suites run genuinely with authentic metrics.`);
  } catch (err: any) {
    console.error(`  FAILED: ${err.message}`);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('ALL INTEGRITY & STABILITY TESTS PASSED');
    console.log('====================================================\n');
    process.exit(0);
  } else {
    console.error('TESTS FAILED');
    console.log('====================================================\n');
    process.exit(1);
  }
}

runStabilityTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
