import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react';
import {
  View, Text, StatusBar, Platform, AppState
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
import TradeEngine       from './src/tradeEngine';
import DaliSplash        from './src/screens/SplashScreen';

import DashboardScreen   from './src/screens/DashboardScreen';
import ProChartScreen    from './src/screens/ProChartScreen';
import TickChartScreen   from './src/screens/TickChartScreen';
import ScannerScreen     from './src/screens/ScannerScreen';
import BotsScreen        from './src/screens/BotsScreen';
import DBotScreen        from './src/screens/DBotScreen';
import TradePadScreen    from './src/screens/TradePadScreen';
import SignalScreen      from './src/screens/SignalScreen';
import AnalysisScreen    from './src/screens/AnalysisScreen';
import QuantLabScreen    from './src/screens/QuantLabScreen';
import LogScreen         from './src/screens/LogScreen';
import GuideScreen       from './src/screens/GuideScreen';
import SettingsScreen    from './src/screens/SettingsScreen';

const Tab  = createBottomTabNavigator();
const SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];

const FLUSH_MS = 500;
const MAX_BUF  = 500;

function buildSnapshot(bufs, digBuf) {
  const utcH   = new Date().getUTCHours();
  const prices = {};
  SYMS.forEach(s => { prices[s] = bufs[s] ? [...bufs[s]] : []; });
  const digits = [...digBuf];
  // No need to copy digBySymRef — Analysis screen reads it directly
  const conf   = calcConfluence(prices['R_75'] || [], digits, utcH);
  const lastTick = {}, prevTick = {};
  SYMS.forEach(s => {
    const arr = bufs[s] || [];
    lastTick[s] = arr[arr.length - 1] || 0;
    prevTick[s] = arr[arr.length - 2] || 0;
  });
  return { prices, digits, lastTick, prevTick, conf, utcH };
}

// ── WebSocket hook ────────────────────────────────────────────────────────────
function useWS() {
  const wsRef    = useRef(null);
  const bufsRef  = useRef({});
  const digRef      = useRef([]);
  const digBySymRef = useRef({});   // per-symbol digit history (all 6 markets)
  const dirtyRef    = useRef(false);
  const timerRef = useRef(null);
  const aidRef   = useRef('');
  const tokRef   = useRef('');

  const [snap,       setSnap]       = useState(null);
  const [balance,    setBalance]    = useState(null);
  const [connected,  setConnected]  = useState(false);
  const [connStatus, setConnStatus] = useState('Not connected');

  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const s = buildSnapshot(bufsRef.current, digRef.current);
    setSnap(s);
  }, []);

  const connect = useCallback((aid, tok) => {
    if (!aid) return;
    aidRef.current = aid; tokRef.current = tok;
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    if (timerRef.current) clearInterval(timerRef.current);

    setConnStatus('Connecting...');
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${aid}`);
    wsRef.current = ws;
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
      // Feed trade engine
      TradeEngine.connect(ws, tok);
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);

        // Let trade engine handle its messages (buy, proposal, portfolio, etc.)
        TradeEngine.handleMessage(d);

        if (d.msg_type === 'authorize') {
          setConnStatus('Live · ' + (d.authorize?.email || 'OK'));
          setBalance({ amount: d.authorize?.balance, currency: d.authorize?.currency });
        }
        if (d.msg_type === 'balance') {
          setBalance({ amount: d.balance?.balance, currency: d.balance?.currency });
        }
        if (d.msg_type === 'history') {
          const sym = d.echo_req?.ticks_history;
          if (sym && d.history?.prices) {
            const prices = d.history.prices.map(parseFloat);
            bufsRef.current[sym] = prices;
            // Populate per-symbol digit buffer from bulk history
            // so QuantEngine gets data immediately after connect
            digBySymRef.current[sym] = prices.map(p => getLastDigit(p));
            if (sym === 'R_75') {
              digRef.current = digBySymRef.current[sym].slice(-200);
            }
            dirtyRef.current = true;
          }
        }
        if (d.msg_type === 'tick') {
          const { symbol: sym, quote } = d.tick;
          const price = parseFloat(quote);
          if (!bufsRef.current[sym]) bufsRef.current[sym] = [];
          bufsRef.current[sym].push(price);
          if (bufsRef.current[sym].length > MAX_BUF) bufsRef.current[sym].shift();
          // Collect digits for ALL symbols (Analysis screen needs them per-market)
          if (!digBySymRef.current[sym]) digBySymRef.current[sym] = [];
          digBySymRef.current[sym].push(getLastDigit(price));
          if (digBySymRef.current[sym].length > 1100) digBySymRef.current[sym].shift();
          // Keep legacy digRef for R_75
          if (sym === 'R_75') {
            digRef.current.push(getLastDigit(price));
            if (digRef.current.length > 200) digRef.current.shift();
          }
          dirtyRef.current = true;
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

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { snap, wsRef, digBySymRef, balance, connected, connStatus, connect, disconnect };
}

// ── Tab icons ─────────────────────────────────────────────────────────────────
const TAB_ICONS = {
  Dashboard: 'stats-chart',
  Signal:    'radio',
  Chart:     'trending-up',
  Ticks:     'pulse',
  Scanner:   'search',
  QuantLab:  'flask',
  Analysis:  'analytics',
  Bots:      'cube',
  Trade:     'flash',
  DBot:      'hardware-chip',
  Log:       'list',
  Guide:     'book',
  Settings:  'settings',
};
function TabIcon({ name, focused }) {
  const base = TAB_ICONS[name] || 'ellipse';
  return (
    <Ionicons name={focused ? base : base+'-outline'} size={21}
      color={focused ? C.ac : C.tx3}/>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState({
    appId:'', token:'', stake:10, lossLimit:50, profitTarget:100,
    autoConnect: true, bgAlerts: true,
  });
  const [trades,      setTrades]      = useState([]);
  const [showSplash,  setShowSplash]  = useState(false);
  const [booting,     setBooting]     = useState(true);
  const ws = useWS();

  // ── Boot: load saved credentials, auto-connect ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await MemoryDB.init();
        const cfg = await AsyncStorage.getItem('config');
        const trd = await AsyncStorage.getItem('trades');
        if (trd) setTrades(JSON.parse(trd));
        if (cfg) {
          const c = JSON.parse(cfg);
          setConfig(c);
          if (c.appId && c.autoConnect !== false) {
            setShowSplash(true);  // show Dali mask on auto-connect
            ws.connect(c.appId, c.token);
          }
        }
      } catch {}
      setBooting(false);
    })();
  }, []);

  // ── Background mode: keep WS alive when app goes to background ───────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        // WS stays alive — React Native keeps the JS thread running
        // for at least 3 minutes on Android, longer on iOS with background modes
        // The flush timer continues, signals keep computing
        // (Full background service needs expo-task-manager — handled in BACKGROUND.md)
      }
    });
    return () => sub.remove();
  }, []);

  const saveConfig = useCallback(async (c) => {
    setConfig(c);
    await AsyncStorage.setItem('config', JSON.stringify(c));
  }, []);

  const handleConnect = useCallback((appId, token) => {
    setShowSplash(true);
    ws.connect(appId, token);
  }, [ws]);

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

  const sharedState = useMemo(() => ({
    prices:     ws.snap?.prices     || {},
    digits:     ws.snap?.digits     || [],
    lastTick:   ws.snap?.lastTick   || {},
    prevTick:   ws.snap?.prevTick   || {},
    conf:       ws.snap?.conf       || null,
    utcH:       ws.snap?.utcH       || 0,
    connected:  ws.connected,
    connStatus: ws.connStatus,
    balance:    ws.balance,
    trades, config,
    connect:    ws.connect,
    disconnect: ws.disconnect,
    _wsRef:        ws.wsRef,        // trade engine needs raw WS ref
    _digBySymRef:  ws.digBySymRef,   // per-symbol digit history for Analysis tab
    sym: 'R_75',
  }), [
    ws.snap, ws.connected, ws.connStatus, ws.balance,
    ws.wsRef, ws.digBySymRef, trades, config,
  ]);

  if (booting) return (
    <View style={{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'}}>
      <Text style={{color:C.ac,fontFamily:'monospace',fontSize:12}}>Loading...</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      <NavigationContainer
        theme={{
          dark:true,
          colors:{background:C.bg,card:C.sf,border:C.bd,text:C.tx,primary:C.ac,notification:C.re}
        }}
      >
        <View style={{flex:1, backgroundColor:C.bg}}>
          <TickerBar
            lastTick={ws.snap?.lastTick || {}}
            prevTick={ws.snap?.prevTick || {}}
          />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({focused}) => <TabIcon name={route.name} focused={focused}/>,
              tabBarActiveTintColor:   C.ac,
              tabBarInactiveTintColor: C.tx3,
              tabBarStyle: {
                backgroundColor: C.sf, borderTopColor: C.bd, borderTopWidth: 1,
                height: Platform.OS === 'ios' ? 82 : 58,
                paddingBottom: Platform.OS === 'ios' ? 20 : 6,
                paddingTop: 5,
              },
              tabBarLabelStyle: { fontSize: 8, fontFamily: 'monospace', letterSpacing: 0.2 },
              headerShown: false, lazy: false, unmountOnBlur: false,
            })}
          >
            <Tab.Screen name="Dashboard"
              children={() => <DashboardScreen state={sharedState}/>}/>
            <Tab.Screen name="QuantLab"
              children={() => <QuantLabScreen state={sharedState}/>}
              options={{ tabBarLabel:'Quant' }}/>
            <Tab.Screen name="Analysis"
              children={() => <AnalysisScreen state={sharedState}/>}
              options={{ tabBarLabel:'Digits' }}/>
            <Tab.Screen name="Signal"
              children={() => <SignalScreen state={sharedState}/>}
              options={{ tabBarLabel:'Signal' }}/>
            <Tab.Screen name="Chart"
              children={() => <ProChartScreen state={sharedState}/>}
              options={{ tabBarLabel:'Chart' }}/>
            <Tab.Screen name="Ticks"
              children={() => <TickChartScreen state={sharedState}/>}
              options={{ tabBarLabel:'Ticks' }}/>
            <Tab.Screen name="Scanner"
              children={() => <ScannerScreen state={sharedState}/>}/>
            <Tab.Screen name="Trade"
              children={() => <TradePadScreen state={sharedState}/>}
              options={{ tabBarLabel:'Trade' }}/>
            <Tab.Screen name="Bots"
              children={() => <BotsScreen/>}
              options={{ tabBarLabel:'Bots' }}/>
            <Tab.Screen name="DBot"
              children={() => <DBotScreen state={sharedState}/>}
              options={{ tabBarLabel:'DBot' }}/>
            <Tab.Screen name="Log"
              children={() =>
                <LogScreen trades={trades} onAdd={addTrade} onClear={clearTrades}/>
              }/>
            <Tab.Screen name="Guide"
              children={() => <GuideScreen/>}
              options={{ tabBarLabel:'Guide' }}/>
            <Tab.Screen name="Settings"
              children={() =>
                <SettingsScreen
                  config={config}
                  onSave={saveConfig}
                  connected={ws.connected}
                  onConnect={handleConnect}
                  onDisconnect={ws.disconnect}
                  status={ws.connStatus}
                />
              }/>
          </Tab.Navigator>
        </View>
      </NavigationContainer>

      {/* Dali mask splash — overlays everything on connect */}
      {showSplash && (
        <DaliSplash onDone={() => setShowSplash(false)}/>
      )}
    </SafeAreaProvider>
  );
}
