#!/usr/bin/env bash
# Start the Python Voxtral worker for Apple Silicon / CPU inference.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/../server/workers"

echo "=== Party Babel — Voxtral Worker Setup ==="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.10+."
  exit 1
fi

# Create venv if needed
if [ ! -d "$WORKER_DIR/.venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$WORKER_DIR/.venv"
fi

source "$WORKER_DIR/.venv/bin/activate"

echo "Installing Python dependencies..."
pip install -q -r "$WORKER_DIR/requirements.txt"

echo ""
echo "Starting Voxtral worker..."
echo "Model: ${VOXTRAL_MODEL_ID:-mistralai/Voxtral-Mini-4B-Realtime-2602}"
echo "First run will download the model (~8GB). Be patient."
echo ""

exec python3 "$WORKER_DIR/voxtral_worker.py"
