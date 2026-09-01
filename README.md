# SecureStegVault v3.0

**Research title:** *CNN-Assisted Adaptive EMD-OPAP Steganography with Distortion Optimization and Adversarial Steganalysis Guidance for Secure Image Data Hiding*

Research-grade platform for adaptive image steganography: trainable cost maps, adaptive zoning, EMD+OPAP embedding, experimental STC approximation, multi-objective scoring, classical + CNN steganalysis, and reproducible benchmarks/ablations.

> **Scientific honesty:** Approximations are labelled as such. No fabricated metrics. Results are produced by running the benchmark engines.

---

## Architecture (v3)

```
Cover Image
    → Preprocess
    → Multi-scale CNN CostMap (CostMapCNN / VGG / classical)
    → Adaptive percentile zoning (A/B/C)
    → AES-256-GCM encrypt (versioned payload, PBKDF2 or Argon2id)
    → Cost-ordered embedding (EMD Zone A, OPAP B/C)
         optional experimental STC approximation
         optional adversarial gradient guidance
    → Stego Image
    → Independent evaluation (RS, χ², SPA, histogram, CNN steganalyzer)
    → Metrics + experiment log
```

### Module map

| Path | Role | Status |
|------|------|--------|
| `backend/crypto.py` | Versioned AES-256-GCM + PBKDF2/Argon2id | **Implemented** |
| `backend/emd.py` | Zhang & Wang EMD (n=2,3) | **Implemented** |
| `backend/opap.py` | Chan & Cheng OPAP | **Implemented** |
| `backend/stc/` | Cost-ordered syndrome approx | **Experimental approximation** |
| `backend/zoning.py` | Percentile adaptive zones | **Implemented** |
| `backend/models/` | CostMapCNN, SteganalyzerNet | **Implemented** (synthetic pretrain; retrain on real pairs) |
| `backend/security/` | RS, χ², SPA, histogram, composite | **Implemented** (educational classical) |
| `backend/strategies/` | Benchmarkable embedding strategies | **Implemented** |
| `backend/optimizer/` | Multi-objective J(λ) scoring | **Implemented** |
| `backend/dataset/` | Local dataset layout + stego-pair gen | **Implemented** |
| `backend/benchmark/` | Payload × algorithm experiments | **Implemented** |
| `tests/` | Crypto, EMD/OPAP, pipeline smoke | **Implemented** |

---

## What is exact vs approximate

| Component | Claim |
|-----------|--------|
| EMD | Exact Zhang & Wang 2006 for n=2/3 |
| OPAP | Exact Chan & Cheng 2004 |
| AES-GCM | Exact (cryptography library) |
| Cost ranking | Spatial order for encode/decode stability (cost used for zone membership) |
| STC module | **Experimental** cost-ordered LSB parity coding — **not** classical Filler–Fridrich Viterbi STC |
| Classical steganalysis | Simplified educational implementations |
| CNN steganalyzer scores | Surrogate probabilities; **not** calibrated real-world detection rates |
| Composite suspicion | Uncalibrated average — never called “accuracy” without experiment |

---

## Installation

```bash
./setup.sh
# optional
pip install argon2-cffi   # for Argon2id KDF
python train_models.py    # refresh CNN weights
```

Place cover images under `datasets/covers/` (BOSSBase, BOWS-2, ALASKA2, DIV2K, COCO subsets, etc.). **Nothing is auto-downloaded.**

```bash
./start.sh
```

---

## Research workflows

### Unit tests
```bash
python tests/run_all.py
python tests/test_crypto.py
python tests/test_emd_opap.py
python tests/test_pipeline.py
```

### Benchmark
```bash
# API
curl -X POST http://localhost:3000/api/benchmark -F max_images=3 -F seed=42

# or Python
python -c "from backend.benchmark import run_benchmark, BenchmarkConfig; print(run_benchmark(BenchmarkConfig(max_images=2)))"
```
Results land in `experiments/benchmark_<timestamp>/` as CSV + JSON.

### Ablation (A–E strategies)
```bash
curl -X POST http://localhost:3000/api/ablation -F seed=42
```
Strategies: `emd_opap` · `cnn_emd_opap` · `cnn_emd_opap_adv` · `cnn_stc_emd_opap` · `cnn_stc_emd_opap_adv`

### Security analysis
```bash
curl -X POST http://localhost:3000/api/security/analyze -F file=@stego.png
```

### Dataset stats
```bash
curl http://localhost:3000/api/dataset/stats
```

### System info
```bash
curl http://localhost:3000/api/system
```

---

## Adaptive zoning

Default: **percentile** boundaries (35th / 65th of cost map).  
Ablation baseline: fixed 0.35 / 0.65 via `use_fixed_thresholds=True`.

---

## Multi-objective score

\[
J = \lambda_1 D + \lambda_2 P_{\mathrm{det}} + \lambda_3 E + \lambda_4 M - \lambda_{\mathrm{adv}} G
\]

Configurable in `backend/optimizer/multi_objective.py`.

---

## Cryptography (v3 payload)

```
MAGIC "SSV3" | VERSION | KDF_ID | FLAGS | ... | SALT | NONCE | CT||TAG
```

- Default KDF: PBKDF2-HMAC-SHA256 (200 000 iterations, configurable)
- Optional: Argon2id if `argon2-cffi` installed
- Legacy unversioned payloads still decrypt

---

## Limitations (explicit)

1. STC is an experimental approximation, not classical STC.
2. Steganalyzer weights shipped with the repo were trained on synthetic pairs; retrain on real cover/stego pairs for meaningful detection estimates.
3. Classical RS/χ²/SPA are simplified; not production forensic tools.
4. Spatial-domain embedding is **not** robust to JPEG/resize (robustness lab is planned, not claimed).
5. No GPU required; CUDA used automatically when present.
6. Benchmark on synthetic covers if `datasets/covers/` is empty — replace with real data for paper results.
7. Frontend Research Lab UI is extended via API; full interactive charts are incremental.

---

## Research contributions supported by this codebase

- Reproducible adaptive EMD–OPAP pipeline with learned cost maps  
- Clear separation of exact algorithms vs experimental approximations  
- Percentile-based adaptive zoning with encode/decode stability  
- Multi-strategy benchmark/ablation harness with CSV/JSON logging  
- Combined classical + CNN security evaluation reporting  
- Versioned authenticated encryption payload format  

**Do not claim** “undetectable”, “state-of-the-art”, or numeric detection rates without running the engines on your dataset and reporting those numbers.

---


### Frontend research pages (v3.1 UI)

The React UI now includes two additional research views:

- **Benchmark** — run or inspect the internal strategy comparison (EMD/OPAP vs CNN-guided vs adversarial vs STC variants) with PSNR / SSIM / suspicion metrics.
- **Compare** — literature comparison of SecureStegVault against five recent peer-reviewed models (Rahman 2025, Sanjalawe 2025, Kanimozhi 2025, Zhang ISS 2025, DL-Steg 2025).

## Version

**SecureStegVault v3.0** — research platform release.

---

## Batch Lab (v3.2)

SecureStegVault v3.2 adds a **Batch Lab** orchestration layer on top of the existing single-image pipeline. Algorithms (EMD, OPAP, STC, CNN, crypto, metrics) are **not** reimplemented — each batch item calls the same strategy / pipeline used for single-image encode.

### Features

- Multi-image encode / decode / experiment matrix
- Job queue + bounded worker pool (configurable workers)
- Partial failure handling (`completed_with_errors`)
- Cancel and retry-failed
- Aggregate metrics (mean / median / min / max / std) from real results
- Export ZIP / CSV / JSON (secrets omitted)
- Message modes: same message → all images, or per-image messages

### UI

Open the **Batch Lab** tab:

1. Select images (multi-file / drag-drop)
2. Configure strategy, passphrase, workers
3. Start Batch → live progress
4. View per-image queue & results
5. Download ZIP / CSV / JSON

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/batch/jobs` | Create encode/decode/experiment job (multipart) |
| GET | `/api/batch/jobs` | List recent jobs |
| GET | `/api/batch/jobs/:id` | Job status + items |
| POST | `/api/batch/jobs/:id/cancel` | Cancel remaining items |
| POST | `/api/batch/jobs/:id/retry` | Re-queue failed items |
| GET | `/api/batch/jobs/:id/summary` | Aggregate metrics |
| GET | `/api/batch/jobs/:id/export?format=json\|csv\|zip` | Download results |

Create job form fields: `type`, `files`, `secret_text`, `passphrase`, `strategy`, `workers`, `message_mode`, `strategies` (JSON), `bpp_list` (JSON), plus standard tuning fields (`thresh_a`, `emd_n`, …).

### Experiment mode

Select multiple strategies × bpp rates × images. The manager expands the cartesian product into individual queue items, each running the existing pipeline once.

### Architecture

```
Batch Lab → Job Manager → Work Queue → Worker Pool → Existing Strategy.embed()
                                                      → Result Aggregator → Export
```

Single-image Encode / Decode tabs are unchanged.

### Security notes

- Filenames sanitized; path traversal blocked
- Passphrases and plaintext never written to exported metadata
- Isolated `tmp/batch_<job_id>/` directories per job
- Max 200 images / batch, 50 MB / file, PNG/BMP only

### Not in v3.2 (reserved for v4.0)

- Distributed secret fragmentation across carriers
- Threshold reconstruction / multi-carrier recovery
