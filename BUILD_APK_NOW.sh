#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════
# DERIV PRO SUITE — Standalone APK Builder
# Run this ONCE in Termux. It handles everything.
# ═══════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

header() { echo -e "\n${CYAN}${BOLD}══ $1 ══${NC}"; }
ok()     { echo -e "${GREEN}✓ $1${NC}"; }
warn()   { echo -e "${YELLOW}⚠ $1${NC}"; }
err()    { echo -e "${RED}✗ $1${NC}"; exit 1; }
step()   { echo -e "\n${BOLD}[$1]${NC} $2"; }

echo -e "${RED}${BOLD}"
echo "  ██████  ███████ ██████  ██ ██    ██ "
echo "  ██   ██ ██      ██   ██ ██ ██    ██ "
echo "  ██   ██ █████   ██████  ██ ██    ██ "
echo "  ██   ██ ██      ██   ██ ██  ██  ██  "
echo "  ██████  ███████ ██   ██ ██   ████   "
echo -e "${NC}"
echo -e "${BOLD}Deriv Pro Suite — APK Builder${NC}"
echo "This script will build a standalone APK."
echo "You will NEVER need Expo Go or Termux to RUN the app after this."
echo ""

# ─── STEP 1: Check internet ────────────────────────────────────────────────
header "CHECKING CONNECTION"
if ! curl -s --max-time 8 https://expo.dev > /dev/null 2>&1; then
  err "No internet. Connect to WiFi/data and try again."
fi
ok "Internet connected"

# ─── STEP 2: Check/install Node ───────────────────────────────────────────
header "NODE.JS"
if ! command -v node &>/dev/null; then
  step "→" "Installing Node.js..."
  pkg install nodejs -y || err "Failed to install Node.js"
fi
NODE_VER=$(node --version)
ok "Node $NODE_VER"

# ─── STEP 3: Install EAS CLI globally ─────────────────────────────────────
header "EAS CLI"
if ! command -v eas &>/dev/null; then
  step "→" "Installing EAS CLI (Expo's cloud build tool)..."
  npm install -g eas-cli --prefer-offline 2>/dev/null || \
  npm install -g eas-cli || err "Failed to install EAS CLI"
fi
EAS_VER=$(eas --version 2>/dev/null || echo "installed")
ok "EAS CLI $EAS_VER"

# ─── STEP 4: Project setup ────────────────────────────────────────────────
header "PROJECT"
PROJECT_DIR="$HOME/derivpro"
if [ ! -d "$PROJECT_DIR" ]; then
  err "Project not found at $PROJECT_DIR. Run SETUP_TERMUX.sh first."
fi
cd "$PROJECT_DIR"
ok "Project at $PROJECT_DIR"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  step "→" "Installing npm packages..."
  npm install --legacy-peer-deps || err "npm install failed"
fi
ok "Dependencies ready"

# ─── STEP 5: Expo account ─────────────────────────────────────────────────
header "EXPO ACCOUNT"
echo ""
echo -e "${YELLOW}You need a FREE Expo account to use cloud builds.${NC}"
echo "If you don't have one: https://expo.dev/signup (free, 30 builds/month)"
echo ""

# Check if already logged in
LOGGED_IN=$(eas whoami 2>/dev/null)
if [ -z "$LOGGED_IN" ] || echo "$LOGGED_IN" | grep -q "Not logged in"; then
  echo "Logging in to Expo..."
  eas login
  LOGGED_IN=$(eas whoami 2>/dev/null)
  if [ -z "$LOGGED_IN" ]; then
    err "Login failed. Try: eas login"
  fi
fi
ok "Logged in as: $LOGGED_IN"

# ─── STEP 6: Link project to Expo ─────────────────────────────────────────
header "LINKING PROJECT"
# Check if project is already linked (has projectId in app.json)
if ! grep -q "projectId" app.json 2>/dev/null; then
  step "→" "Linking project to your Expo account..."
  echo "This will update app.json with your project ID."
  eas project:init --non-interactive 2>/dev/null || \
  eas init --id $(eas project:create --non-interactive --slug deriv-pro-suite 2>/dev/null | grep -oP 'projectId.*?"\K[^"]+' | head -1) 2>/dev/null || \
  warn "Linking may need manual confirmation — follow any prompts above"
fi
ok "Project linked"

# ─── STEP 7: BUILD ────────────────────────────────────────────────────────
header "BUILDING APK"
echo ""
echo -e "${BOLD}Starting cloud build now.${NC}"
echo "• The APK is built on Expo's servers (not your phone)"
echo "• Build time: 10–20 minutes"  
echo "• You'll get a DOWNLOAD LINK when done"
echo "• Keep Termux open while building"
echo ""
echo -e "${YELLOW}Starting build...${NC}"
echo ""

eas build \
  --platform android \
  --profile preview \
  --non-interactive \
  2>&1 | tee /tmp/eas_build.log

# ─── STEP 8: Get download link ────────────────────────────────────────────
header "BUILD COMPLETE"
DOWNLOAD=$(grep -oP 'https://expo\.dev/artifacts/eas/[^\s]+' /tmp/eas_build.log | head -1)
DOWNLOAD2=$(grep -oP 'https://[^\s]+\.apk' /tmp/eas_build.log | head -1)
LINK="${DOWNLOAD:-$DOWNLOAD2}"

if [ -n "$LINK" ]; then
  echo ""
  echo -e "${GREEN}${BOLD}✅ APK BUILD SUCCESSFUL!${NC}"
  echo ""
  echo -e "${BOLD}Download link:${NC}"
  echo -e "${CYAN}$LINK${NC}"
  echo ""
  echo "To install:"
  echo "1. Open the link above in your browser"
  echo "2. Download the .apk file"
  echo "3. Tap the downloaded file to install"
  echo "4. If blocked: Settings → Security → Allow unknown sources"
  echo ""
  # Try to download directly to phone
  echo -e "${YELLOW}Attempting direct download to /sdcard/Download/...${NC}"
  curl -L "$LINK" -o /sdcard/Download/DerivProSuite.apk 2>/dev/null && \
    ok "Downloaded to /sdcard/Download/DerivProSuite.apk — tap to install!" || \
    warn "Open the link in your browser to download"
else
  echo ""
  warn "Build completed but couldn't extract link automatically."
  echo "Check your email or visit https://expo.dev/accounts/[your-account]/projects/deriv-pro-suite/builds"
  echo ""
  echo "Full build log saved to: /tmp/eas_build.log"
fi

echo ""
echo -e "${GREEN}${BOLD}Done! Once installed, the app works completely offline.${NC}"
echo "No Expo Go. No Termux. Just your app on your home screen."
