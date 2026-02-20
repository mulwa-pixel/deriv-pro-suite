# DERIV PRO SUITE — Android App

## Quick Setup (2 steps)

### Step 1 — Termux
1. Open Termux
2. Run:
```bash
cp -r /sdcard/derivpro ~/derivpro
bash ~/derivpro/SETUP_TERMUX.sh
```

### Step 2 — Start App
```bash
cd ~/derivpro
npx expo start
```
Scan the QR code with **Expo Go** (from Play Store).

---

## Features
- **Dashboard** — Live stats, entry score, digit streak, mini charts
- **Pro Chart** — Full TradingView (1m/5m/15m/1H/4H/Daily) with all indicators
- **Tick Chart** — Sub-minute candle chart (5T/10T/20T bars) + RSI + EMA
- **Scanner** — All 7 bots scored against live conditions
- **Bots** — Full handbook with clickable checklists
- **Trade Log** — Record every trade with P&L tracking
- **Settings** — API connection + risk management

## API Setup
1. Go to https://app.deriv.com/account/api-token
2. Create token with **Read + Trade** scope
3. Note your **App ID** (use 1089 for testing)
4. Enter in Settings tab of app

## Professional Workflow
1. Check **Pro Chart** 5m/15m — identify trend + key levels
2. Check **Tick Chart** — wait for Entry Score ≥ 70
3. Check **Scanner** — confirm bot scores ≥ 60%
4. Place trade, **log it** in Trade Log
5. Review journal weekly

## GOLDEN RULE
**RSI 40-60 = DEAD ZONE. No trades.**