// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIAL STORE — save once, auto-connect on every launch
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'deriv_creds_v2';

export async function saveCreds(appId, token, extra = {}) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ appId, token, ...extra, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export async function loadCreds() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearCreds() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
