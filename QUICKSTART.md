# SecureStegVault v3.2 — Quick Start

Research-grade **CNN-Assisted Adaptive EMD-OPAP** steganography platform  
with live comparison against four paper methods + SecureStegVault ablation ladder.

## Requirements

- Node.js 18+ and npm
- Python 3.10+ (3.12 recommended)
- ~2 GB disk (PyTorch)

## Setup (once)

```bash
cd SecureStegVault
chmod +x setup.sh start.sh
./setup.sh
```

This creates `.venv`, installs `requirements.txt` (FastAPI, torch, opencv, scipy, scikit-image, psutil, …) and `npm install`.

## Start

```bash
./start.sh          # development: UI + Python API
./start.sh python   # FastAPI only on :8001
./start.sh prod     # production build
./start.sh stop     # stop background services
```

| Service | URL |
|---------|-----|
| UI      | http://localhost:3000 |
| API     | http://127.0.0.1:8001 |
| Health  | http://127.0.0.1:8001/api/health |

## Comparison tab

1. Open **Compare** in the top nav.
2. Review **Published paper figures (reference only)**.
3. Check **Model status (checkpoint audit)**.
4. Under **Live benchmark results**, upload one cover (PNG/BMP), enter secret + passphrase.
5. Click **Compare this input across all models**.

### Method honesty

| Method | Live benchmark? |
|--------|-----------------|
| Paper 1 (Joint CNN) | Architecture test only until you place weights in `models/paper1/official/` |
| Paper 2 (CycleGAN-style) | No official checkpoint found |
| Paper 3 (Prep/Hide/Reveal) | No official checkpoint found |
| Paper 4 (LSB + Magic Matrix) | **Yes — deterministic LIVE** |
| SecureStegVault | **Yes — LIVE** |

Optional Paper 1 checkpoint path:

```text
models/paper1/official/best_model.pth
```

(Expected keys from authors’ script: `encoder_state_dict`, `decoder_state_dict`, `mixer_state_dict`.)

## Tests

```bash
source .venv/bin/activate
export PYTHONPATH=.
pytest backend/comparison/tests -q
```

## Key API routes

- `POST /api/encode` / `POST /api/decode`
- `POST /api/comparison/compare-one`
- `POST /api/comparison/run`
- `POST /api/comparison/ablation`
- `GET  /api/comparison/papers`
- `GET  /api/comparison/checkpoints`
- `GET  /api/comparison/report/{run_id}`

## Project layout (comparison)

```text
backend/comparison/
  adapters/           bitstream, image-tile, grayscale
  external_models/    paper1–4 strategies + official Paper1 arch
  checkpoint/         discovery / load status (no auto-download)
  metrics/            quality, BER, robustness, security, efficiency
  scoring/            weights, normalize, Pareto, Friedman/Nemenyi
  orchestrator.py     single-input pipeline
  ablation.py         SSV rungs A–E
  single_input_compare.py
```
