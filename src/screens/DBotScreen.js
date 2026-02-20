// ─────────────────────────────────────────────────────────────────────────────
// DBOT EXECUTION — Like dollarprinter.com / binarytool.com
// Run bots directly from the app using Deriv API
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Animated } from 'react-native';
import { C } from '../theme';
import TradeEngine from '../tradeEngine';
import MemoryDB from '../memory';

// ── Bot definitions (auto-trade strategies) ──────────────────────────────────
const BOTS = [
  {
    id: 1, name: 'Even/Odd Streak', icon: '⚖️',
    color: C.ye, market: 'R_75', contract: 'Even',
    duration: 10, durationUnit: 't', stake: 1,
    description: 'Bets opposite parity after 4+ same-parity streak',
    condition: (conf, digits) => {
      if (!digits || digits.length < 5) return null;
      const parity = x => x % 2 === 0 ? 'even' : 'odd';
      const last = parity(digits[digits.length-1]);
      let streak = 0;
      for (let i = digits.length-1; i >= 0; i--) {
        if (parity(digits[i]) === last) streak++;
        else break;
      }
      if (streak >= 4 && conf?.r14 && !(conf.r14 >= 40 && conf.r14 <= 60)) {
        return { contract: last === 'even' ? 'Odd' : 'Even', confidence: Math.min(95, 60 + streak*5) };
      }
      return null;
    },
  },
  {
    id: 3, name: 'Berlin X9 RSI', icon: '📡',
    color: C.pu2, market: 'R_75', contract: 'Rise',
    duration: 5, durationUnit: 't', stake: 2,
    description: 'RSI(4) extremes with EMA confirmation',
    condition: (conf) => {
      if (!conf?.r4 || !conf?.r14) return null;
      if (conf.r14 >= 40 && conf.r14 <= 60) return null;
      if (conf.r4 < 33 && conf.e5 < conf.e10)
        return { contract: 'Rise', confidence: Math.round(70 + (33-conf.r4)) };
      if (conf.r4 > 67 && conf.e5 > conf.e10)
        return { contract: 'Fall', confidence: Math.round(70 + (conf.r4-67)) };
      return null;
    },
  },
  {
    id: 4, name: 'BeastO7 EMA', icon: '🦁',
    color: C.gr, market: 'R_10', contract: 'Rise',
    duration: 5, durationUnit: 't', stake: 1,
    description: 'EMA stack with RSI zone break',
    condition: (conf) => {
      if (!conf?.e5 || !conf?.e10 || !conf?.e20) return null;
      if (conf.r14 >= 40 && conf.r14 <= 60) return null;
      const sep = Math.abs(conf.e5 - conf.e10);
      if (sep < 0.02) return null;
      if (conf.e5 > conf.e10 && conf.e10 > conf.e20 && conf.r14 < 38)
        return { contract: 'Rise', confidence: 72 };
      if (conf.e5 < conf.e10 && conf.e10 < conf.e20 && conf.r14 > 62)
        return { contract: 'Fall', confidence: 72 };
      return null;
    },
  },
  {
    id: 5, name: 'Gas Hunter', icon: '⛽',
    color: C.or, market: 'R_10', contract: 'Over 5',
    duration: 5, durationUnit: 't', stake: 1,
    description: 'Digit dominance: 60%+ high/low triggers Over/Under',
    condition: (conf, digits) => {
      if (!digits || digits.length < 20) return null;
      const last20 = digits.slice(-20);
      const high = last20.filter(x => x >= 5).length;
      const highPct = high / 20;
      const lowPct  = 1 - highPct;
      if (highPct > 0.60 && conf?.r14 > 55)
        return { contract: 'Over 5', confidence: Math.round(60 + highPct*40) };
      if (lowPct  > 0.60 && conf?.r14 < 45)
        return { contract: 'Under 5', confidence: Math.round(60 + lowPct*40) };
      return null;
    },
  },
  {
    id: 6, name: 'Hawk Under5', icon: '🦅',
    color: C.bl, market: 'R_25', contract: 'Under 5',
    duration: 5, durationUnit: 't', stake: 1,
    description: 'Low digit dominance + RSI < 42',
    condition: (conf, digits) => {
      if (!digits || digits.length < 10 || !conf?.r14) return null;
      if (conf.r14 > 42) return null;
      const last10 = digits.slice(-10);
      const lowPct = last10.filter(x => x < 5).length / 10;
      if (lowPct >= 0.60)
        return { contract: 'Under 5', confidence: Math.round(60 + lowPct*40) };
      return null;
    },
  },
  {
    id: 7, name: 'Even Streak V2', icon: '🎯',
    color: C.pk, market: 'R_75', contract: 'Even',
    duration: 10, durationUnit: 't', stake: 1,
    description: 'Markov + entropy enhanced even/odd',
    condition: (conf, digits) => {
      if (!digits || digits.length < 20) return null;
      // Markov transition
      const parity = d => d % 2 === 0 ? 0 : 1;
      const par = digits.slice(-30).map(parity);
      const trans = [[0,0],[0,0]];
      for (let i=1;i<par.length;i++) trans[par[i-1]][par[i]]++;
      const last = par[par.length-1];
      const row = trans[last];
      const total = row[0]+row[1];
      if (total < 5) return null;
      const probOpp = row[1-last] / total;
      if (probOpp >= 0.62)
        return { contract: last===0?'Odd':'Even', confidence: Math.round(probOpp*100) };
      return null;
    },
  },
];

// ── Mini log line ─────────────────────────────────────────────────────────────
function LogLine({ entry }) {
  const won = entry.result === 'WIN';
  return (
    <View style={[styles.logLine, {borderLeftColor: won?C.gr:C.re}]}>
      <Text style={{color:won?C.gr:C.re,fontWeight:'800',fontSize:10,width:36}}>{won?'WIN':'LOSS'}</Text>
      <Text style={{color:C.tx2,fontSize:10,flex:1,fontFamily:'monospace'}}>{entry.label}</Text>
      <Text style={{color:won?C.gr:C.re,fontWeight:'700',fontSize:10}}>
        {won?'+':''}{entry.pnl?.toFixed(2)}
      </Text>
    </View>
  );
}

// ── Bot card ──────────────────────────────────────────────────────────────────
function BotCard({ bot, state, running, onStart, onStop, log, session }) {
  const { conf, digits, connected } = state;
  const signal = bot.condition(conf, digits);
  const pulse  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (running) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, {toValue:1.03, duration:700, useNativeDriver:true}),
        Animated.timing(pulse, {toValue:1.0,  duration:700, useNativeDriver:true}),
      ])).start();
    } else { pulse.stopAnimation(); pulse.setValue(1); }
    return () => pulse.stopAnimation();
  }, [running]);

  const wins   = log.filter(x=>x.result==='WIN').length;
  const losses = log.filter(x=>x.result==='LOSS').length;
  const wr     = (wins+losses)>0 ? Math.round(wins/(wins+losses)*100) : null;
  const pnl    = log.reduce((s,x) => s+(x.pnl||0), 0);

  return (
    <Animated.View style={[styles.botCard, {
      borderColor:     running ? bot.color : C.bd,
      borderLeftColor: bot.color,
      transform: [{scale: pulse}],
    }]}>
      {/* Header */}
      <View style={styles.botHead}>
        <Text style={{fontSize:22}}>{bot.icon}</Text>
        <View style={{flex:1, marginLeft:10}}>
          <Text style={{color:C.tx,fontSize:13,fontWeight:'800'}}>Bot #{bot.id} · {bot.name}</Text>
          <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace',marginTop:1}}>{bot.description}</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          {running && (
            <View style={[styles.runBadge,{borderColor:bot.color+'80',backgroundColor:bot.color+'15'}]}>
              <Text style={{color:bot.color,fontSize:8,fontWeight:'800',fontFamily:'monospace'}}>RUNNING</Text>
            </View>
          )}
          {signal && !running && (
            <View style={styles.signalDot}>
              <Text style={{color:C.gr,fontSize:8,fontWeight:'800'}}>SIGNAL</Text>
            </View>
          )}
        </View>
      </View>

      {/* Config row */}
      <View style={styles.configRow}>
        {[['Market', bot.market],['Contract', bot.contract],
          ['Duration', bot.duration+bot.durationUnit],['Stake', '$'+bot.stake]
        ].map(([l,v])=>(
          <View key={l} style={styles.cfgCell}>
            <Text style={styles.cfgLabel}>{l}</Text>
            <Text style={{color:bot.color,fontSize:11,fontWeight:'700',fontFamily:'monospace'}}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Live signal */}
      {signal && (
        <View style={[styles.signalRow,{borderColor:C.gr+'40',backgroundColor:'rgba(6,214,160,.06)'}]}>
          <Text style={{color:C.gr,fontSize:11,fontWeight:'800',fontFamily:'monospace'}}>
            ▶ {signal.contract.toUpperCase()}
          </Text>
          <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace'}}>
            Confidence: {signal.confidence}%
          </Text>
        </View>
      )}

      {/* Session stats */}
      {log.length > 0 && (
        <View style={styles.statsRow}>
          <Text style={{color:C.gr,fontSize:10,fontFamily:'monospace'}}>W:{wins}</Text>
          <Text style={{color:C.re,fontSize:10,fontFamily:'monospace'}}>L:{losses}</Text>
          {wr!==null&&<Text style={{color:wr>=60?C.gr:wr>=50?C.ye:C.re,fontSize:10,fontFamily:'monospace'}}>{wr}%</Text>}
          <Text style={{color:pnl>=0?C.gr:C.re,fontSize:10,fontFamily:'monospace',fontWeight:'700'}}>
            {pnl>=0?'+$':'-$'}{Math.abs(pnl).toFixed(2)}
          </Text>
        </View>
      )}

      {/* Start/Stop */}
      {connected ? (
        running ? (
          <TouchableOpacity onPress={() => onStop(bot.id)} style={[styles.actionBtn,{borderColor:'rgba(230,57,70,.4)',backgroundColor:'rgba(230,57,70,.1)'}]}>
            <Text style={{color:C.re,fontWeight:'800',fontFamily:'monospace',fontSize:12}}>⬛ STOP BOT #{bot.id}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => onStart(bot)} style={[styles.actionBtn,{borderColor:bot.color+'50',backgroundColor:bot.color+'12'}]}>
            <Text style={{color:bot.color,fontWeight:'800',fontFamily:'monospace',fontSize:12}}>▶ RUN BOT #{bot.id}</Text>
          </TouchableOpacity>
        )
      ) : (
        <View style={[styles.actionBtn,{borderColor:C.bd2}]}>
          <Text style={{color:C.tx3,fontFamily:'monospace',fontSize:11}}>Connect API to run bots</Text>
        </View>
      )}

      {/* Mini log */}
      {log.slice(-3).reverse().map((e,i)=><LogLine key={i} entry={e}/>)}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DBotScreen({ state }) {
  const [running,  setRunning]  = useState({}); // botId → true
  const [botLogs,  setBotLogs]  = useState({}); // botId → [entries]
  const [session,  setSession]  = useState({ wins:0, losses:0, pnl:0, trades:0 });
  const [paused,   setPaused]   = useState(false);
  const intervalRefs = useRef({});

  const { conf, digits, connected, config } = state;

  const stopBot = useCallback((botId) => {
    if (intervalRefs.current[botId]) {
      clearInterval(intervalRefs.current[botId]);
      delete intervalRefs.current[botId];
    }
    setRunning(r => { const n={...r}; delete n[botId]; return n; });
  }, []);

  const startBot = useCallback((bot) => {
    if (!connected) { Alert.alert('Not Connected','Add API token in Settings first.'); return; }
    if (!config?.token) { Alert.alert('No Token','Add Trade-scoped API token in Settings.'); return; }
    if (running[bot.id]) return;

    setRunning(r => ({...r, [bot.id]: true}));

    // Poll every 1.5s — check condition, fire trade if met
    let lastTrade = 0;
    intervalRefs.current[bot.id] = setInterval(async () => {
      if (paused) return;
      const now = Date.now();
      if (now - lastTrade < 6000) return; // min 6s between trades

      const snap = state; // latest state ref
      const signal = bot.condition(snap.conf, snap.digits);
      if (!signal) return;

      lastTrade = now;
      try {
        const result = await TradeEngine.buy({
          contractType: signal.contract,
          symbol: bot.market,
          stake: (config?.stake || bot.stake),
          duration: bot.duration,
          durationUnit: bot.durationUnit,
        });
        // Result handled by TradeEngine.onUpdate in TradePad
      } catch (e) {
        console.log('Bot trade error:', e.message);
      }
    }, 1500);
  }, [connected, config, running, paused, state]);

  // Clean up on unmount
  useEffect(() => () => {
    Object.values(intervalRefs.current).forEach(clearInterval);
  }, []);

  // Listen to TradeEngine results to update bot logs
  useEffect(() => {
    const prevUpdate = TradeEngine.onUpdate;
    TradeEngine.onUpdate = (type, data) => {
      if (prevUpdate) prevUpdate(type, data);
      if (type === 'settled') {
        const won = data.status === 'won';
        const entry = {
          result: won ? 'WIN' : 'LOSS',
          pnl:    data.finalProfit || 0,
          label:  data.description?.slice(0,30) || 'Trade',
          time:   Date.now(),
        };
        // Associate with running bot (rough heuristic — first running bot)
        const runningId = Object.keys(running)[0];
        if (runningId) {
          setBotLogs(bl => ({
            ...bl,
            [runningId]: [...(bl[runningId]||[]), entry].slice(-20),
          }));
        }
        setSession(s => ({
          wins:   s.wins   + (won?1:0),
          losses: s.losses + (won?0:1),
          pnl:    s.pnl    + (data.finalProfit||0),
          trades: s.trades + 1,
        }));
      }
    };
    return () => { TradeEngine.onUpdate = prevUpdate; };
  }, [running]);

  const anyRunning = Object.keys(running).length > 0;
  const wr = (session.wins+session.losses)>0
    ? Math.round(session.wins/(session.wins+session.losses)*100) : 0;

  return (
    <View style={{flex:1, backgroundColor:C.bg}}>
      {/* Session header */}
      <View style={styles.sessionBar}>
        <View style={{flex:1}}>
          <Text style={{color:C.tx,fontSize:13,fontWeight:'800'}}>
            {anyRunning ? `🤖 ${Object.keys(running).length} BOT(S) ACTIVE` : '🤖 BOT CONTROL'}
          </Text>
          <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace'}}>
            Like dollarprinter.com — run bots directly from app
          </Text>
        </View>
        {anyRunning && (
          <TouchableOpacity onPress={() => setPaused(p=>!p)}
            style={[styles.pauseBtn,{borderColor:paused?C.ye+'50':C.gr+'50',
              backgroundColor:paused?'rgba(255,215,64,.1)':'rgba(6,214,160,.08)'}]}>
            <Text style={{color:paused?C.ye:C.gr,fontWeight:'800',fontFamily:'monospace',fontSize:11}}>
              {paused?'▶ RESUME':'⏸ PAUSE ALL'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Session stats */}
      <View style={styles.statsBar}>
        {[
          ['TRADES',  session.trades, C.tx2],
          ['WINS',    session.wins,   C.gr],
          ['LOSSES',  session.losses, C.re],
          ['WIN RATE',wr+'%',         wr>=60?C.gr:wr>=50?C.ye:C.re],
          ['P&L',     (session.pnl>=0?'+$':'-$')+Math.abs(session.pnl).toFixed(2),
                      session.pnl>=0?C.gr:C.re],
        ].map(([l,v,c])=>(
          <View key={l} style={styles.statCell}>
            <Text style={styles.statLbl}>{l}</Text>
            <Text style={[styles.statVal,{color:c}]}>{v}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{padding:10, paddingBottom:30}}>
        {BOTS.map(bot => (
          <BotCard
            key={bot.id}
            bot={bot}
            state={state}
            running={!!running[bot.id]}
            onStart={startBot}
            onStop={stopBot}
            log={botLogs[bot.id]||[]}
            session={session}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionBar: { flexDirection:'row', alignItems:'center', backgroundColor:C.sf,
                borderBottomWidth:1, borderBottomColor:C.bd, padding:12, gap:10 },
  pauseBtn:   { borderWidth:1, borderRadius:7, paddingHorizontal:12, paddingVertical:7 },
  statsBar:   { flexDirection:'row', backgroundColor:C.sf,
                borderBottomWidth:1, borderBottomColor:C.bd },
  statCell:   { flex:1, alignItems:'center', paddingVertical:8,
                borderRightWidth:1, borderRightColor:C.bd },
  statLbl:    { fontSize:7, color:C.tx3, fontFamily:'monospace',
                textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 },
  statVal:    { fontSize:14, fontWeight:'800' },
  botCard:    { backgroundColor:C.sf, borderRadius:10, borderWidth:1,
                borderLeftWidth:3, padding:13, marginBottom:10 },
  botHead:    { flexDirection:'row', alignItems:'center', marginBottom:10 },
  runBadge:   { borderWidth:1, borderRadius:5, paddingHorizontal:7, paddingVertical:3 },
  signalDot:  { backgroundColor:'rgba(6,214,160,.15)', borderWidth:1,
                borderColor:'rgba(6,214,160,.4)', borderRadius:5,
                paddingHorizontal:7, paddingVertical:3 },
  configRow:  { flexDirection:'row', gap:6, marginBottom:8 },
  cfgCell:    { flex:1, backgroundColor:C.sf2, borderRadius:6, borderWidth:1,
                borderColor:C.bd, padding:7, alignItems:'center' },
  cfgLabel:   { fontSize:7, color:C.tx3, fontFamily:'monospace',
                textTransform:'uppercase', letterSpacing:0.3, marginBottom:2 },
  signalRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                borderWidth:1, borderRadius:7, padding:8, marginBottom:8 },
  statsRow:   { flexDirection:'row', gap:10, marginBottom:8 },
  actionBtn:  { borderWidth:1, borderRadius:7, padding:11,
                alignItems:'center', marginBottom:6 },
  logLine:    { flexDirection:'row', gap:8, paddingVertical:4,
                borderLeftWidth:2, paddingLeft:8, marginTop:3 },
});
