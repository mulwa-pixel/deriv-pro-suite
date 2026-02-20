#!/data/data/com.termux/files/usr/bin/bash
# Deriv Pro Suite — Termux Setup
# Run once after extracting the zip

echo "Setting up Deriv Pro Suite..."
pkg update -y && pkg upgrade -y
pkg install nodejs git curl -y

cd ~/derivpro 2>/dev/null || { mkdir ~/derivpro && cd ~/derivpro; }

echo "Installing npm packages..."
npm install --legacy-peer-deps

echo ""
echo "✅ Setup complete!"
echo ""
echo "TO RUN (Expo Go — quick, for testing):"
echo "  cd ~/derivpro && npx expo start"
echo ""
echo "TO BUILD STANDALONE APK (permanent install, no Expo Go):"
echo "  cd ~/derivpro && bash BUILD_APK_NOW.sh"
echo ""
