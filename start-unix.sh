#!/usr/bin/env bash
# ============================================================
#   NSE Stock Predictor - Mac/Linux One-Click Start Script
# ============================================================
#
#   Just run this file from the terminal:
#       ./start-unix.sh
#
#   First run takes 2-3 minutes (installs dependencies).
#   Subsequent runs take ~5 seconds.
#
#   To stop: press Ctrl+C
#
# ============================================================

set -e

# Move to the folder where this script lives
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "  NSE Stock Predictor - Starting..."
echo "============================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo ""
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    echo "Or use Homebrew on Mac:  brew install node"
    echo "Or apt on Ubuntu:        sudo apt install nodejs npm"
    echo ""
    exit 1
fi

# Show Node version
echo "[OK] Node.js found:"
node --version
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "[SETUP] Creating .env file..."
    echo 'DATABASE_URL="file:./db/custom.db"' > .env
    echo "[OK] .env created."
    echo ""
fi

# Install dependencies on first run (when node_modules doesn't exist)
if [ ! -d "node_modules" ]; then
    echo "[SETUP] First run - installing dependencies..."
    echo "[SETUP] This will take 2-3 minutes. Please be patient."
    echo ""
    npm install
    echo ""
    echo "[OK] Dependencies installed."
    echo ""
fi

# Set up the database on first run (when db file doesn't exist)
if [ ! -f "db/custom.db" ]; then
    echo "[SETUP] Setting up local database..."
    mkdir -p db
    npx prisma generate
    npx prisma db push
    echo ""
    echo "[OK] Database ready."
    echo ""
fi

# Create data/bhavcopy folder for NSE uploads
mkdir -p data/bhavcopy

# Start the app
echo "============================================================"
echo "  Starting the predictor..."
echo "  Your browser will open automatically at:"
echo "  http://localhost:3000"
echo ""
echo "  To stop the app: press Ctrl+C"
echo "============================================================"
echo ""

# Open browser after 5 seconds (Mac)
if command -v open &> /dev/null; then
    (sleep 5 && open http://localhost:3000) &
elif command -v xdg-open &> /dev/null; then
    (sleep 5 && xdg-open http://localhost:3000) &
fi

# Run the dev server (this keeps running until you press Ctrl+C)
npm run dev
