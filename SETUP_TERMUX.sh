#!/data/data/com.termux/files/usr/bin/bash
# Deriv Pro Suite — Termux Setup Script
# Run this ONCE after unzipping the project

set -e
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   DERIV PRO SUITE — SETUP SCRIPT    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Update Termux packages
echo "[1/5] Updating Termux packages..."
pkg update -y && pkg upgrade -y

# Install Node.js
echo "[2/5] Installing Node.js..."
pkg install nodejs -y

# Install watchman (needed by Metro bundler)
echo "[3/5] Installing build tools..."
pkg install python make gcc binutils -y 2>/dev/null || true

# Move to project folder
echo "[4/5] Installing npm packages..."
cd ~/derivpro
npm install --legacy-peer-deps

# Done
echo ""
echo "╔══════════════════════════════════════╗"
echo "║         SETUP COMPLETE ✓             ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "To start the app:"
echo "  cd ~/derivpro"
echo "  npx expo start"
echo ""
echo "Then scan the QR code with Expo Go app"
echo "(install from Play Store if not already)"
echo ""