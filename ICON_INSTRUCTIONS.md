# App Icon Setup

## Current Status
React Native / Expo requires a PNG file at `assets/icon.png`.
The icon appears on your home screen.

## To add the Dali Mask icon:

### Option 1 — Use an existing image
1. Find a Dali mask / Money Heist style image (red mask on black background)
2. Resize to 1024×1024 PNG
3. Save as `assets/icon.png` in the project folder
4. In `app.json`, icon is already set to `./assets/icon.png`
5. Rebuild with `eas build`

### Option 2 — Generate with AI
Prompt for an AI image generator (Midjourney, DALL-E, etc.):
> "Dali mask from Money Heist, flat icon, deep red on black background,
>  minimalist, high contrast, no text, square format, app icon style"

### Option 3 — Use provided placeholder
We've configured app.json to use a red background (#e63946) as the adaptive
icon background, which matches the Money Heist / hacker theme.

## Adaptive icon (Android)
`app.json` → `android.adaptiveIcon.backgroundColor: "#e63946"` ← Already set
Add `assets/adaptive-icon.png` (1024×1024, foreground only, transparent background)