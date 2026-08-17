#!/bin/bash
set -e

# Keep terminal window open on exit (both success and error)
cleanup() {
    local exit_code=$?
    echo ""
    if [ $exit_code -ne 0 ]; then
        echo "==========================================="
        echo "   [!] Setup failed with exit code $exit_code"
        echo "==========================================="
    fi

    echo ""
    if [ -t 0 ]; then
        read -r -p "Press [Enter] to exit..." || true
    elif [ -c /dev/tty ]; then
        read -r -p "Press [Enter] to exit..." </dev/tty || true
    fi
}

trap cleanup EXIT

echo "==========================================="
echo "   CertiProof Setup & Installation Script"
echo "==========================================="

echo -e "\n[1/5] Installing Backend dependencies..."
cd backend
npm install
cd ..

echo -e "\n[2/5] Installing Frontend dependencies..."
cd frontend
npm install
cd ..

echo -e "\n[3/5] Setting up Python virtual environment..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install torch onnx ezkl transformers numpy

echo -e "\n[4/5] Compiling and Certifying OMR Circuit..."
echo "(Note: EZKL calibration output like 'fail: X, pass: Y' is normal parameter search)"
cd ml/circuit
python3 build_circuit.py
python3 model_commitment.py certify "omr-scorer-v1"

echo -e "\n[5/5] Compiling and Certifying LLM Circuit..."
python3 build_circuit.py --llm
python3 model_commitment.py certify "llm-scorer-v1" --llm
cd ../..

echo -e "\n==========================================="
echo "   Setup Complete! You can now run the app."
echo "==========================================="
echo "To start the backend:"
echo "  cd backend && npm run dev"
echo ""
echo "To start the frontend:"
echo "  cd frontend && npm run dev"
echo "==========================================="

