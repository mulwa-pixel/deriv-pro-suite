import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { C } from './src/theme';
import { getLastDigit } from './src/indicators';
import TickerBar from './src/components/TickerBar';

import DashboardScreen from './src/screens/DashboardScreen';
import ProChartScreen   from './src/screens/ProChartScreen';
import TickChartScreen  from './src/screens/TickChartScreen';
import ScannerScreen    from './src/screens/ScannerScreen';
import BotsScreen       from './src/screens/BotsScreen';
import LogScreen        from './src/screens/LogScreen';
import SettingsScreen   from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];
const MAX_BUF = 500;

// ─── WebSocket hook ───────────────────────────────────────────────────────────
function useWS(appId, token) {
  const wsRef    = useRef(null);
  const bufsRef  = useRef({});
  const prevRef  = useRef({});
  const digRef   = useRef([]);
  const [connected, setConnected] = useState(false);
  const [prices,    setPrices]    = useState({});
  const [digits,    setDigits]    = useState([]);
  const [lastTick,  setLastTick]  = useState({});
  const [prevTick,  setPrevTick]  = useState({});
  const [balance,   setBalance]   = useState(null);
  const [connStatus, setConnStatus] = useState('');

  const connect = useCallback((aid, tok) => {
    if (!aid) { setConnStatus('Enter App ID in Settings'); return; }
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    setConnStatus('Connecting...');
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${aid}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true); setConnStatus(tok ? 'Authenticating...' : 'Connected (no token)');
      if (tok) ws.send(JSON.stringify({authorize: tok}));
      SYMS.forEach(s => {
        ws.send(JSON.stringify({ticks: s, subscribe: 1}));
        ws.send(JSON.stringify({ticks_history: s, adjust_start_time:1, count:300, end:'latest', start:1, style:'ticks'}));
      });
      if (tok) ws.send(JSON.stringify({balance:1, subscribe:1}));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'authorize') setConnStatus('Live: ' + (d.authorize?.email || 'OK'));
        if (d.msg_type === 'balance') setBalance({amount: d.balance?.balance, currency: d.balance?.currency});
        if (d.msg_type === 'history') {
          const sym = d.echo_req?.ticks_history;
          if (sym && d.history?.prices) {
            bufsRef.current[sym] = d.history.prices.map(parseFloat);
            setPrices(p => ({...p, [sym]: [...bufsRef.current[sym]]}));
          }
        }
        if (d.msg_type === 'tick') {
          const {symbol: sym, quote} = d.tick;
          const price = parseFloat(quote);
          if (!bufsRef.current[sym]) bufsRef.current[sym] = [];
          bufsRef.current[sym].push(price);
          if (bufsRef.current[sym].length > MAX_BUF) bufsRef.current[sym].shift();
          setPrices(p => ({...p, [sym]: [...bufsRef.current[sym]]}));
          setPrevTick(p => ({...p, [sym]: prevRef.current[sym]}));
          prevRef.current[sym] = price;
          setLastTick(t => ({...t, [sym]: price}));
          if (sym === 'R_75') {
            const dig = getLastDigit(price);
            digRef.current.push(dig);
            if (digRef.current.length > 100) digRef.current.shift();
            setDigits([...digRef.current]);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false); setConnStatus('Reconnecting...');
      setTimeout(() => connect(aid, tok), 5000);
    };
    ws.onerror = () => { setConnected(false); setConnStatus('Connection error'); };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    setConnected(false); setConnStatus('Disconnected');
  }, []);

  return { connected, prices, digits, lastTick, prevTick, balance, connect, disconnect, connStatus };
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState({appId:'', token:'', stake:10, lossLimit:50, profitTarget:100});
  const [trades, setTrades] = useState([]);
  const ws = useWS(config.appId, config.token);

  // Load persisted data
  useEffect(() => {
    (async () => {
      try {
        const cfg = await AsyncStorage.getItem('config');
        const trd = await AsyncStorage.getItem('trades');
        if (cfg) {
          const c = JSON.parse(cfg);
          setConfig(c);
          if (c.appId) ws.connect(c.appId, c.token);
        }
        if (trd) setTrades(JSON.parse(trd));
      } catch {}
    })();
  }, []);

  const saveConfig = async (c) => {
    setConfig(c);
    await AsyncStorage.setItem('config', JSON.stringify(c));
  };

  const addTrade = async (t) => {
    const next = [t, ...trades];
    setTrades(next);
    await AsyncStorage.setItem('trades', JSON.stringify(next));
  };

  const clearTrades = async () => {
    setTrades([]);
    await AsyncStorage.setItem('trades', '[]');
  };

  const sharedState = {
    ...ws, trades, sym:'R_75',
    config,
  };

  const tabIcon = (name, focused) => {
    const icons = {
      Dashboard: focused ? 'stats-chart' : 'stats-chart-outline',
      Chart:     focused ? 'trending-up' : 'trending-up-outline',
      Ticks:     focused ? 'pulse' : 'pulse-outline',
      Scanner:   focused ? 'search' : 'search-outline',
      Bots:      focused ? 'hardware-chip' : 'hardware-chip-outline',
      Log:       focused ? 'list' : 'list-outline',
      Settings:  focused ? 'settings' : 'settings-outline',
    };
    return <Ionicons name={icons[name]||'ellipse'} size={22} color={focused ? C.ac : C.tx3}/>;
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <NavigationContainer theme={{colors:{background:C.bg}}}>
        <View style={{flex:1, backgroundColor:C.bg}}>
          <TickerBar lastTick={ws.lastTick} prevTick={ws.prevTick}/>
          <Tab.Navigator
            screenOptions={({route}) => ({
              tabBarIcon: ({focused}) => tabIcon(route.name, focused),
              tabBarActiveTintColor: C.ac,
              tabBarInactiveTintColor: C.tx3,
              tabBarStyle: {
                backgroundColor: C.sf,
                borderTopColor: C.bd,
                borderTopWidth: 1,
                height: Platform.OS==='ios' ? 82 : 60,
                paddingBottom: Platform.OS==='ios' ? 20 : 8,
                paddingTop: 6,
              },
              tabBarLabelStyle: { fontSize: 9, fontFamily:'monospace', letterSpacing:0.3 },
              headerShown: false,
            })}>
            <Tab.Screen name="Dashboard" children={()=><DashboardScreen state={sharedState}/>}/>
            <Tab.Screen name="Chart"     children={()=><ProChartScreen state={sharedState}/>}
              options={{tabBarLabel:'Pro Chart'}}/>
            <Tab.Screen name="Ticks"     children={()=><TickChartScreen state={sharedState}/>}
              options={{tabBarLabel:'Tick Chart'}}/>
            <Tab.Screen name="Scanner"   children={()=><ScannerScreen state={sharedState}/>}/>
            <Tab.Screen name="Bots"      children={()=><BotsScreen/>}/>
            <Tab.Screen name="Log"       children={()=><LogScreen trades={trades} onAdd={addTrade} onClear={clearTrades}/>}/>
            <Tab.Screen name="Settings"  children={()=>(
              <SettingsScreen
                config={config} onSave={saveConfig}
                connected={ws.connected} onConnect={ws.connect}
                onDisconnect={ws.disconnect} status={ws.connStatus}/>
            )}/>
          </Tab.Navigator>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}