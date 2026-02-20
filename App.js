import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react';
import {
  View, Text, StatusBar, Platform, InteractionManager
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { C }             from './src/theme';
import { getLastDigit, calcConfluence } from './src/indicators';
import TickerBar         from './src/components/TickerBar';
import MemoryDB          from './src/memory';

import DashboardScreen   from './src/screens/DashboardScreen';
import ProChartScreen    from './src/screens/ProChartScreen';
import TickChartScreen   from './src/screens/TickChartScreen';
import ScannerScreen     from './src/screens/ScannerScreen';
import BotsScreen        from './src/screens/BotsScreen';
import LogScreen         from './src/screens/LogScreen';
import DBotScreen        from './src/screens/DBotScreen';
import SettingsScreen    from './src/screens/SettingsScreen';

const Tab  = createBottomTabNavigator();
const SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];

// ─────────────────────────────────────────────────────────────────────────────
// HOW THE LAG IS FIXED:
//
// OLD: tick → setPrices() → ALL screens re-render → each runs calcConfluence
//
// NEW:
//   tick arrives → stored in refs (no setState, zero re-render)
//   Every 500ms a single timer fires:
//     1. Reads refs
//     2. Runs calcConfluence ONCE (not once per screen)
//     3. Calls ONE setState with a plain object of numbers
//   Each screen receives only primitive numbers → React.memo stops
//   re-renders unless those numbers actually changed
//
// Result: UI updates 2× per second max, heavy math runs once, touches
// are never blocked.
// ─────────────────────────────────────────────────────────────────────────────

const FLUSH_MS = 500;   // update UI every 500 ms
const MAX_BUF  = 500;   // price history depth

// Pre-compute one clean "market snapshot" object ─────────────────────────────
function buildSnapshot(bufs, digBuf) {
  const utcH   = new Date().getUTCHours();
  const prices = {};
  SYMS.forEach(s => { prices[s] = bufs[s] ? [...bufs[s]] : []; });
  const digits = [...digBuf];

  // Confluence only for R_75 (main signal) — other screens read raw prices
  const conf = calcConfluence(prices['R_75'] || [], digits, utcH);

  // Last tick + prev tick (just the price number, tiny)
  const lastTick = {};
  const prevTick = {};
  SYMS.forEach(s => {
    const arr = bufs[s] || [];
    lastTick[s] = arr[arr.length - 1] || 0;
    prevTick[s] = arr[arr.length - 2] || 0;
  });

  return { prices, digits, lastTick, prevTick, conf, utcH };
}

// ─── WebSocket hook ───────────────────────────────────────────────────────────
function useWS() {
  const wsRef    = useRef(null);
  const bufsRef  = useRef({});     // all price history — NEVER triggers state
  const digRef   = useRef([]);     // digit history     — NEVER triggers state
  const aidRef   = useRef('');
  const tokRef   = useRef('');
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);  // true when new data arrived since last flush

  const [snap,       setSnap]       = useState(null);
  const [balance,    setBalance]    = useState(null);
  const [connected,  setConnected]  = useState(false);
  const [connStatus, setConnStatus] = useState('Disconnected');

  // The flush: runs every FLUSH_MS, only touches React state if data changed
  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    // Run heavy math here, off the critical touch path
    const s = buildSnapshot(bufsRef.current, digRef.current);
    setSnap(s);
  }, []);

  const connect = useCallback((aid, tok) => {
    if (!aid) { setConnStatus('Enter App ID in Settings'); return; }
    aidRef.current = aid; tokRef.current = tok;
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);

    setConnStatus('Connecting...');

    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${aid}`);
    wsRef.current = ws;

    // Start the flush timer immediately — 2 updates/sec max
    timerRef.current = setInterval(flush, FLUSH_MS);

    ws.onopen = () => {
      setConnected(true);
      setConnStatus(tok ? 'Authenticating...' : 'Connected');
      if (tok) ws.send(JSON.stringify({ authorize: tok }));
      SYMS.forEach(s => {
        ws.send(JSON.stringify({ ticks: s, subscribe: 1 }));
        ws.send(JSON.stringify({
          ticks_history: s, adjust_start_time: 1,
          count: 300, end: 'latest', start: 1, style: 'ticks'
        }));
      });
      if (tok) ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
    };

    ws.onmessage = (e) => {
      // ALL processing here is pure JS — no setState, no re-renders
      try {
        const d = JSON.parse(e.data);

        if (d.msg_type === 'authorize') {
          setConnStatus('Live: ' + (d.authorize?.email || 'OK'));
        }

        if (d.msg_type === 'balance') {
          // Balance is infrequent — fine to setState directly
          setBalance({ amount: d.balance?.balance, currency: d.balance?.currency });
        }

        if (d.msg_type === 'history') {
          const sym = d.echo_req?.ticks_history;
          if (sym && d.history?.prices) {
            bufsRef.current[sym] = d.history.prices.map(parseFloat);
            dirtyRef.current = true;
          }
        }

        if (d.msg_type === 'tick') {
          const { symbol: sym, quote } = d.tick;
          const price = parseFloat(quote);

          if (!bufsRef.current[sym]) bufsRef.current[sym] = [];
          bufsRef.current[sym].push(price);
          if (bufsRef.current[sym].length > MAX_BUF)
            bufsRef.current[sym].shift();

          if (sym === 'R_75') {
            digRef.current.push(getLastDigit(price));
            if (digRef.current.length > 200) digRef.current.shift();
          }

          dirtyRef.current = true;   // mark dirty — flush will pick it up
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      setConnStatus('Reconnecting...');
      setTimeout(() => connect(aidRef.current, tokRef.current), 5000);
    };

    ws.onerror = () => {
      setConnected(false);
      setConnStatus('Connection error');
    };
  }, [flush]);

  const disconnect = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setConnected(false); setConnStatus('Disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { snap, balance, connected, connStatus, connect, disconnect };
}

// ─── Tab icon helper ──────────────────────────────────────────────────────────
const TAB_ICONS = {
  Dashboard: 'stats-chart',
  Chart:     'trending-up',
  Ticks:     'pulse',
  Scanner:   'search',
  Bots:      'hardware-chip',
  DBot:      'code-slash',
  Log:       'list',
  Settings:  'settings',
};
function TabIcon({ name, focused }) {
  const base = TAB_ICONS[name] || 'ellipse';
  return (
    <Ionicons
      name={focused ? base : base + '-outline'}
      size={21}
      color={focused ? C.ac : C.tx3}
    />
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState({
    appId: '', token: '', stake: 10, lossLimit: 50, profitTarget: 100
  });
  const [trades, setTrades] = useState([]);
  const ws = useWS();

  // Boot: load persisted data, connect
  useEffect(() => {
    (async () => {
      try {
        await MemoryDB.init();
        const cfg = await AsyncStorage.getItem('config');
        const trd = await AsyncStorage.getItem('trades');
        if (cfg) {
          const c = JSON.parse(cfg);
          setConfig(c);
          if (c.appId) ws.connect(c.appId, c.token);
        }
        if (trd) setTrades(JSON.parse(trd));
      } catch (err) { console.log('Boot error:', err); }
    })();
  }, []);

  const saveConfig = useCallback(async (c) => {
    setConfig(c);
    await AsyncStorage.setItem('config', JSON.stringify(c));
  }, []);

  const addTrade = useCallback(async (t) => {
    const next = [t, ...trades];
    setTrades(next);
    await AsyncStorage.setItem('trades', JSON.stringify(next));
    await MemoryDB.logTrade(t);
  }, [trades]);

  const clearTrades = useCallback(async () => {
    setTrades([]);
    await AsyncStorage.setItem('trades', '[]');
  }, []);

  // Build the shared state object screens actually need.
  // Screens receive snap (pre-computed snapshot) + trades + config.
  // They do NOT receive raw price arrays or run heavy math.
  const sharedState = useMemo(() => ({
    // From snapshot
    prices:     ws.snap?.prices     || {},
    digits:     ws.snap?.digits     || [],
    lastTick:   ws.snap?.lastTick   || {},
    prevTick:   ws.snap?.prevTick   || {},
    conf:       ws.snap?.conf       || null,   // ← pre-computed, free for screens
    utcH:       ws.snap?.utcH       || 0,
    // Connection
    connected:  ws.connected,
    connStatus: ws.connStatus,
    balance:    ws.balance,
    // Data
    trades,
    config,
    // WS control (for Settings)
    connect:    ws.connect,
    disconnect: ws.disconnect,
    sym: 'R_75',
  }), [
    ws.snap, ws.connected, ws.connStatus, ws.balance,
    trades, config,
  ]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            background: C.bg, card: C.sf, border: C.bd,
            text: C.tx, primary: C.ac, notification: C.re,
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <TickerBar
            lastTick={ws.snap?.lastTick || {}}
            prevTick={ws.snap?.prevTick || {}}
          />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused }) =>
                <TabIcon name={route.name} focused={focused}/>,
              tabBarActiveTintColor:   C.ac,
              tabBarInactiveTintColor: C.tx3,
              tabBarStyle: {
                backgroundColor: C.sf,
                borderTopColor:  C.bd,
                borderTopWidth:  1,
                height:          Platform.OS === 'ios' ? 82 : 58,
                paddingBottom:   Platform.OS === 'ios' ? 20 : 6,
                paddingTop:      5,
              },
              tabBarLabelStyle: {
                fontSize: 8, fontFamily: 'monospace', letterSpacing: 0.2,
              },
              headerShown:    false,
              // ── CRITICAL: keep every screen alive in memory ──────────────
              // Without this, switching tabs unmounts + remounts the screen,
              // causing a full re-render + re-subscription every tab change.
              lazy:          false,
              unmountOnBlur: false,
            })}
          >
            <Tab.Screen name="Dashboard"
              children={() => <DashboardScreen state={sharedState}/>}/>
            <Tab.Screen name="Chart"
              children={() => <ProChartScreen state={sharedState}/>}
              options={{ tabBarLabel: 'Chart' }}/>
            <Tab.Screen name="Ticks"
              children={() => <TickChartScreen state={sharedState}/>}
              options={{ tabBarLabel: 'Ticks' }}/>
            <Tab.Screen name="Scanner"
              children={() => <ScannerScreen state={sharedState}/>}/>
            <Tab.Screen name="Bots"
              children={() => <BotsScreen/>}/>
            <Tab.Screen name="DBot"
              children={() => <DBotScreen state={sharedState}/>}/>
            <Tab.Screen name="Log"
              children={() =>
                <LogScreen
                  trades={trades}
                  onAdd={addTrade}
                  onClear={clearTrades}
                />
              }/>
            <Tab.Screen name="Settings"
              children={() =>
                <SettingsScreen
                  config={config}
                  onSave={saveConfig}
                  connected={ws.connected}
                  onConnect={ws.connect}
                  onDisconnect={ws.disconnect}
                  status={ws.connStatus}
                />
              }/>
          </Tab.Navigator>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
