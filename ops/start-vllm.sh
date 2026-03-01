#!/usr/bin/env bash
# Start vLLM serving Voxtral Realtime for NVIDIA GPUs.
set -euo pipefail

MODEL_ID="${VOXTRAL_MODEL_ID:-mistralai/Voxtral-Mini-4B-Realtime-2602}"
PORT="${VLLM_PORT:-8000}"

echo "=== Party Babel — vLLM Voxtral Setup ==="
echo ""

# Check NVIDIA GPU
if ! command -v nvidia-smi &>/dev/null; then
  echo "WARNING: nvidia-smi not found. This mode requires an NVIDIA GPU."
  echo "For Apple Silicon, use: ./start-voxtral.sh"
  exit 1
fi

echo "GPU info:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
echo ""

# Check vLLM
if ! command -v vllm &>/dev/null; then
  echo "vLLM not installed. Install with:"
  echo "  pip install vllm"
  exit 1
fi

echo "Starting vLLM server on port ${PORT}..."
echo "Model: ${MODEL_ID}"
echo ""

exec vllm serve "$MODEL_ID" \
  --port "$PORT" \
  --max-model-len 4096 \
  --dtype auto
