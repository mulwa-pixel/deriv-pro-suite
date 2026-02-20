# Build APK via GitHub Actions (Free)

This method builds the APK automatically every time you push code.
No setup needed on your phone. The APK downloads from GitHub.

## One-time setup (5 minutes)

### 1. Create GitHub account
Go to github.com → Sign up (free)

### 2. Create Expo account  
Go to expo.dev → Sign up (free)
Get your token: expo.dev/accounts/[you]/settings/access-tokens → New Token

### 3. Create GitHub repository
- github.com → New repository
- Name: deriv-pro-suite
- Private (recommended)
- Don't add README

### 4. Push this project to GitHub
In Termux:
```bash
cd ~/derivpro
pkg install git -y
git init
git add .
git commit -m "Deriv Pro Suite"
git remote add origin https://github.com/YOUR_USERNAME/deriv-pro-suite.git
git push -u origin main
```

### 5. Add your Expo token to GitHub
- Go to: github.com/YOUR_USERNAME/deriv-pro-suite/settings/secrets/actions
- Click "New repository secret"
- Name: EXPO_TOKEN
- Value: [your token from step 2]
- Save

### 6. Trigger the build
The build starts automatically when you push.
Or go to: Actions tab → Build APK → Run workflow

### 7. Download APK
- Actions tab → your completed build → Artifacts
- Or check your Expo dashboard: expo.dev/builds

APK installs directly on your phone — no Expo Go needed.

## After first build

Every time you update the app:
```bash
cd ~/derivpro
git add .
git commit -m "Update"
git push
```
GitHub automatically builds a new APK.
