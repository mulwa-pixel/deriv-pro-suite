# Background Mode — Full Setup

## What works out of the box (no extra setup)
When you press the home button, React Native keeps the JS thread alive
for ~3 minutes on Android and longer on iOS. During this time:
- WebSocket stays connected
- Signals keep computing
- Trade engine stays active

## For permanent background (survives screen off / battery optimization)

### Android — Battery settings
1. Settings → Apps → Deriv Pro Suite → Battery
2. Set to "Unrestricted" or "Not optimized"
3. This prevents Android from killing the app

### Android — Full background service (advanced)
Add to package.json dependencies:
```
"expo-task-manager": "~11.8.4",
"expo-background-fetch": "~12.0.6",
```

Add to App.js:
```js
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BG_TASK = 'DERIV_SIGNAL_CHECK';

TaskManager.defineTask(BG_TASK, async () => {
  // Re-check connection, send notification if signal active
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

// Register in App useEffect:
BackgroundFetch.registerTaskAsync(BG_TASK, {
  minimumInterval: 60, // check every 60s
  stopOnTerminate: false,
  startOnBoot: true,
});
```

### iOS — Background modes
In app.json add:
```json
"ios": {
  "infoPlist": {
    "UIBackgroundModes": ["fetch", "remote-notification"]
  }
}
```

## Push notifications for signals
Add: `expo-notifications`
In App.js when conf.score >= 70, trigger:
```js
Notifications.scheduleNotificationAsync({
  content: {
    title: '📡 DERIV SIGNAL',
    body: `${conf.direction} — Score ${conf.score} — ${conf.bot}`,
    data: { screen: 'Signal' },
  },
  trigger: null, // immediate
});
```
