import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { initOnnxSession, isNeuralModelAvailable } from './src/backend_ts/onnxSession';
import { runCapacityCheck, runEncodePipeline, runDecodePipeline, getCostMap } from './src/backend_ts/pipeline';
import { parsePNG } from './src/backend_ts/imageUtils';
import { runBenchmarkSuite, runAblationStudy } from './src/backend_ts/benchmarkEngine';

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Backend API Endpoints
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  const neuralReady = isNeuralModelAvailable();
  res.json({
    status: 'ok',
    service: 'SecureStegVault Express + Vite Engine',
    version: '3.2.0',
    torch_available: false,
    neural_onnx_available: neuralReady,
    active_costmap_engine: neuralReady ? 'LF-RINN ONNX Neural Cost Map' : 'Heuristic Cost Map Fallback',
    models: {
      costmap_cnn: true,
      costmap_lfrinn_onnx: neuralReady,
      steganalyzer_net: true,
    },
  });
});

// Real Capacity check
app.post('/api/capacity', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    const threshA = parseFloat((req.body.thresh_a as string) || '0.35');
    const threshB = parseFloat((req.body.thresh_b as string) || '0.65');
    const gamma = parseFloat((req.body.gamma as string) || '0.7');
    const emdN = parseInt((req.body.emd_n as string) || '2', 10);
    const costMapMode = (req.body.cost_map_mode as string) || (isNeuralModelAvailable() ? 'neural' : 'heuristic');

    if (req.file && req.file.buffer) {
      const capResult = await runCapacityCheck(req.file.buffer, threshA, threshB, gamma, costMapMode, emdN);
      return res.json(capResult);
    }

    // Mathematical estimation for 512x512 cover if file buffer not uploaded
    const width = 512;
    const height = 512;
    const channels = 3;
    const totalPixels = width * height;

    const countA = Math.floor(totalPixels * threshA);
    const countB = Math.floor(totalPixels * (threshB - threshA));
    const countC = totalPixels - countA - countB;

    const emdMultiplier = emdN === 3 ? Math.log2(7) / 3 : Math.log2(5) / 2;
    const zoneABits = Math.floor(countA * 3 * emdMultiplier);
    const zoneBBits = countB * 3 * 2;
    const zoneCBits = countC * 3 * 3;
    const totalBits = zoneABits + zoneBBits + zoneCBits;
    const maxBytes = Math.floor(totalBits / 8);

    return res.json({
      width,
      height,
      channels,
      capacity: {
        width,
        height,
        total_pixels: totalPixels,
        zone_a_bytes: Math.floor(zoneABits / 8),
        zone_b_bytes: Math.floor(zoneBBits / 8),
        zone_c_bytes: Math.floor(zoneCBits / 8),
        max_bytes: maxBytes,
        bpp: Number((totalBits / (totalPixels * 3)).toFixed(3)),
        zone_distribution: {
          zoneA: Number(((countA / totalPixels) * 100).toFixed(1)),
          zoneB: Number(((countB / totalPixels) * 100).toFixed(1)),
          zoneC: Number(((countC / totalPixels) * 100).toFixed(1)),
        },
      },
      cost_map_mode: costMapMode,
      emd_n: emdN,
    });
  } catch (err: any) {
    console.error('[API /capacity Error]:', err);
    return res.status(400).json({ error: err.message || 'Capacity calculation failed' });
  }
});

// Cost map endpoint — exposes the REAL trained LF-RINN ONNX cost map (or
// the heuristic, if requested/if the ONNX session is unavailable) to
// client-side callers. The browser cannot load onnxruntime-node directly,
// so any browser code (e.g. Benchmark Lab, Comparison Suite) that wants to
// evaluate the actual neural model — rather than reimplementing an
// approximation client-side — must go through this endpoint.
app.post('/api/costmap', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const gamma = parseFloat((req.body.gamma as string) || '0.7');
    const requestedMode = (req.body.cost_map_mode as string) || 'neural';

    const image = parsePNG(req.file.buffer);
    const neuralWasAvailable = isNeuralModelAvailable();
    const costMap = await getCostMap(image, gamma, requestedMode);

    // getCostMap silently falls back to the heuristic internally if the ONNX
    // session isn't available; report that honestly instead of always
    // claiming 'neural' just because 'neural' was requested.
    const engine: 'neural' | 'heuristic' =
      requestedMode === 'heuristic' ? 'heuristic' : neuralWasAvailable ? 'neural' : 'heuristic';

    return res.json({
      width: image.width,
      height: image.height,
      engine,
      cost_map: Array.from(costMap),
    });
  } catch (err: any) {
    console.error('[API /costmap Error]:', err);
    return res.status(400).json({ error: err.message || 'Cost map computation failed' });
  }
});

// Encode endpoint
app.post('/api/encode', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No cover image file provided' });
    }

    const secretText = req.body.secret_text as string;
    const passphrase = req.body.passphrase as string;
    const threshA = parseFloat((req.body.thresh_a as string) || '0.35');
    const threshB = parseFloat((req.body.thresh_b as string) || '0.65');
    const gamma = parseFloat((req.body.gamma as string) || '0.7');
    const kbBits = parseInt((req.body.kb_bits as string) || '2', 10);
    const kcBits = parseInt((req.body.kc_bits as string) || '3', 10);
    const costMapMode = (req.body.cost_map_mode as string) || (isNeuralModelAvailable() ? 'neural' : 'heuristic');
    const adversarialStrength = parseFloat((req.body.adversarial_strength as string) || '0.0');
    const emdN = parseInt((req.body.emd_n as string) || '2', 10);

    const result = await runEncodePipeline(
      req.file.buffer,
      secretText,
      passphrase,
      threshA,
      threshB,
      gamma,
      kbBits,
      kcBits,
      costMapMode,
      adversarialStrength,
      emdN
    );

    return res.json(result);
  } catch (err: any) {
    console.error('[API /encode Error]:', err);
    return res.status(400).json({ error: err.message || 'Steganography encoding failed' });
  }
});

// Decode endpoint
app.post('/api/decode', upload.single('file') as any, async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No stego image file provided' });
    }

    const passphrase = req.body.passphrase as string;
    const threshA = parseFloat((req.body.thresh_a as string) || '0.35');
    const threshB = parseFloat((req.body.thresh_b as string) || '0.65');
    const gamma = parseFloat((req.body.gamma as string) || '0.7');
    const kbBits = parseInt((req.body.kb_bits as string) || '2', 10);
    const kcBits = parseInt((req.body.kc_bits as string) || '3', 10);
    const costMapMode = (req.body.cost_map_mode as string) || (isNeuralModelAvailable() ? 'neural' : 'heuristic');
    const emdN = parseInt((req.body.emd_n as string) || '2', 10);

    const result = await runDecodePipeline(
      req.file.buffer,
      passphrase,
      threshA,
      threshB,
      gamma,
      kbBits,
      kcBits,
      costMapMode,
      emdN
    );

    return res.json(result);
  } catch (err: any) {
    console.error('[API /decode Error]:', err);
    return res.status(400).json({ error: err.message || 'Steganography decoding failed' });
  }
});

// Strategies endpoint
app.get('/api/strategies', (req: Request, res: Response) => {
  res.json({
    strategies: [
      {
        id: 'proposed_lf_rinn_neural',
        name: 'Proposed: LF-RINN ONNX Neural Cost Map + Adaptive EMD-OPAP',
        description: 'Low-Frequency Invertible Haar-DWT + Edge CNN ONNX model with percentile-guided EMD & OPAP',
        category: 'Proposed',
        paperReference: 'SecureStegVault 2026 Core Architecture (LF-RINN)',
      },
      {
        id: 'cnn_emd_opap',
        name: 'Baseline / Heuristic: Multi-scale CNN-style + Adaptive EMD-OPAP',
        description: 'Sobel/Texture/HILL heuristic edge fusion with percentile-guided EMD & OPAP',
        category: 'Proposed',
        paperReference: 'SecureStegVault Baseline Engine',
      },
      {
        id: 'classical_lsb',
        name: 'Baseline: Standard Sequential LSB',
        description: 'Sequential naive LSB substitution across RGB channels',
        category: 'Baseline',
      },
      {
        id: 'standard_emd',
        name: 'Baseline: Pure EMD (Zhang & Wang 2006)',
        description: 'Exploiting Modification Direction over all pixels uniformly without cost mapping',
        category: 'Baseline',
      },
      {
        id: 'standard_opap',
        name: 'Baseline: Standard OPAP (Chan & Cheng 2004)',
        description: 'Optimal Pixel Adjustment Process with constant k=2 across image',
        category: 'Baseline',
      },
      {
        id: 'ablation_no_costmap',
        name: 'Ablation A: Uniform Allocation (No CostMap)',
        description: 'Removes neural/CNN cost map; assigns random pixel zoning',
        category: 'Ablation',
      },
      {
        id: 'ablation_no_emd',
        name: 'Ablation B: Pure OPAP (No EMD in Zone A)',
        description: 'Replaces Zone A EMD with 1-bit OPAP',
        category: 'Ablation',
      },
      {
        id: 'ablation_no_opap',
        name: 'Ablation C: Standard LSB (No OPAP)',
        description: 'Replaces Zones B and C OPAP with standard LSB',
        category: 'Ablation',
      },
    ],
  });
});

// Genuine Benchmark endpoint — executes baseline & proposed algorithms over test covers
app.post('/api/benchmark', async (req: Request, res: Response) => {
  try {
    const maxImages = parseInt((req.body.max_images as string) || (req.query.max_images as string) || '3', 10);
    const seed = parseInt((req.body.seed as string) || (req.query.seed as string) || '42', 10);

    const result = await runBenchmarkSuite(maxImages, seed);
    return res.json(result);
  } catch (err: any) {
    console.error('[API /benchmark Error]:', err);
    return res.status(500).json({ error: err.message || 'Benchmark suite execution failed' });
  }
});

// Genuine Ablation endpoint — evaluates full model vs individual components
app.post('/api/ablation', async (req: Request, res: Response) => {
  try {
    const maxImages = parseInt((req.body.max_images as string) || (req.query.max_images as string) || '3', 10);
    const seed = parseInt((req.body.seed as string) || (req.query.seed as string) || '42', 10);

    const result = await runAblationStudy(maxImages, seed);
    return res.json(result);
  } catch (err: any) {
    console.error('[API /ablation Error]:', err);
    return res.status(500).json({ error: err.message || 'Ablation study execution failed' });
  }
});

// Comparison Papers endpoint
app.get('/api/comparison/papers', (req: Request, res: Response) => {
  res.json([
    {
      id: 'paper1_deep_stego',
      title: 'SteganoGAN: High Capacity Image Steganography with GANs',
      authors: 'Zhang et al.',
      year: 2019,
      venue: 'NeurIPS',
      methodology: 'End-to-end Encoder-Decoder CNN trained with DenseNet residual skip connections',
      typicalPsnr: 41.2,
      maxBpp: 4.4,
      stegResistance: 'Moderate (Susceptible to StegExpose)',
      robustnessAgainstJpg: 'High',
      status: 'Official Checkpoint Available',
    },
    {
      id: 'paper2_adaptive_texture',
      title: 'Adaptive Pixel-Value Differencing with EMD',
      authors: 'Khodaei & Faez',
      year: 2012,
      venue: 'Computers & Electrical Engineering',
      methodology: 'Heuristic edge & difference quantization coupled with base-5 EMD',
      typicalPsnr: 52.8,
      maxBpp: 1.8,
      stegResistance: 'Good against Chi-Square',
      robustnessAgainstJpg: 'Low',
      status: 'Integrated',
    },
    {
      id: 'paper3_stc_trellis',
      title: 'Minimizing Additive Distortion in Steganography using Syndrome-Trellis Codes',
      authors: 'Filler, Judas & Fridrich',
      year: 2011,
      venue: 'IEEE TIFS',
      methodology: 'Viterbi decoding on syndrome trellis minimizing spatial HILL/S-UNIWARD costs',
      typicalPsnr: 58.6,
      maxBpp: 1.0,
      stegResistance: 'High (State-of-the-Art Classical)',
      robustnessAgainstJpg: 'Medium',
      status: 'Integrated',
    },
    {
      id: 'paper4_adversarial_steg',
      title: 'Adversarial Attacks on CNN Steganalyzers for Data Hiding',
      authors: 'Tang et al.',
      year: 2021,
      venue: 'IEEE TIFS',
      methodology: 'Gradient sign perturbations targeting YeNet/XuNet feature maps',
      typicalPsnr: 61.4,
      maxBpp: 0.8,
      stegResistance: 'Very High against CNN Detectors',
      robustnessAgainstJpg: 'Low',
      status: 'Integrated',
    },
  ]);
});

// System info endpoint
app.get('/api/system', (req: Request, res: Response) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime_sec: Math.floor(process.uptime()),
    memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    neural_onnx_loaded: isNeuralModelAvailable(),
  });
});

// ---------------------------------------------------------------------------
// Vite Middleware / Static Serving
// ---------------------------------------------------------------------------

async function startServer() {
  // Initialize LF-RINN ONNX runtime session singleton at startup
  await initOnnxSession();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SecureStegVault] Server running on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();