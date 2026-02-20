// ─────────────────────────────────────────────────────────────────────────────
// TRADE PAD — Built-in execution panel (dollarprinter / binarytool style)
// Buy, monitor, sell contracts directly from the app
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Animated
} from 'react-native';
import { C } from '../theme';
import TradeEngine, { CONTRACT_TYPES, SYMBOL_MAP } from '../tradeEngine';
import MemoryDB from '../memory';

const SYMBOLS  = ['V75','V100','V25','V50','V10','1HZ100V'];
const CTYPES   = ['Rise','Fall','Even','Odd','Over 5','Under 5'];
const DURATIONS = [
  {label:'5T', val:'t5', d:5, u:'t'},
  {label:'10T',val:'t10',d:10,u:'t'},
  {label:'15T',val:'t15',d:15,u:'t'},
  {label:'20T',val:'t20',d:20,u:'t'},
  {label:'30T',val:'t30',d:30,u:'t'},
  {label:'1m', val:'s60',d:60,u:'s'},
];

const TYPE_COLOR = {
  Rise:'#06d6a0', Fall:'#e63946', Even:'#ffd166', Odd:'#b56ed4',
  'Over 5':'#f77f00', 'Under 5':'#118ab2',
};

function ContractCard({ contract, onSell }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const profit = contract.profit || 0;
  const isOpen = contract.status === 'open';

  useEffect(() => {
    if (isOpen) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
      ])).start();
    }
    return () => pulse.stopAnimation();
  }, [isOpen]);

  return (
    <Animated.View style={[styles.contractCard, {
      borderLeftColor: profit >= 0 ? C.gr : C.re,
      transform: isOpen ? [{scale: pulse}] : [],
    }]}>
      <View style={styles.ccHead}>
        <View>
          <Text style={styles.ccType}>{contract.description?.split(' on ')[0] || 'Contract'}</Text>
          <Text style={styles.ccId}>ID: {contract.id}</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={[styles.ccProfit, {color: profit >= 0 ? C.gr : C.re}]}>
            {profit >= 0 ? '+' : ''}{(profit || 0).toFixed(2)}
          </Text>
          <Text style={[styles.ccStatus, {
            color: contract.status==='won' ? C.gr : contract.status==='lost' ? C.re : C.ye
          }]}>{(contract.status||'').toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.ccRow}>
        <Text style={styles.ccLabel}>Buy price</Text>
        <Text style={styles.ccVal}>${(contract.buyPrice||0).toFixed(2)}</Text>
        <Text style={styles.ccLabel}>Payout</Text>
        <Text style={styles.ccVal}>${(contract.payout||0).toFixed(2)}</Text>
        {contract.currentSpot ? <>
          <Text style={styles.ccLabel}>Spot</Text>
          <Text style={styles.ccVal}>{contract.currentSpot}</Text>
        </> : null}
      </View>
      {isOpen && (
        <TouchableOpacity onPress={() => onSell(contract.id)} style={styles.sellBtn}>
          <Text style={styles.sellBtnTxt}>SELL EARLY</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

export default function TradePadScreen({ state }) {
  const [symbol,   setSymbol]   = useState('V75');
  const [ctype,    setCtype]    = useState('Rise');
  const [durIdx,   setDurIdx]   = useState(0);
  const [stake,    setStake]    = useState('1');
  const [busy,     setBusy]     = useState(false);
  const [contracts,setContracts]= useState([]);
  const [lastMsg,  setLastMsg]  = useState(null);
  const [proposal, setProposal] = useState(null);
  const [propTimer,setPropTimer]= useState(null);
  const [session,  setSession]  = useState({ wins:0, losses:0, pnl:0 });
  const [autoBot,  setAutoBot]  = useState(null); // auto-run bot
  const [autoRunning, setAutoRunning] = useState(false);

  const { connected, conf, config } = state;
  const dur = DURATIONS[durIdx];

  // Feed trade engine the WS reference
  useEffect(() => {
    if (state._wsRef) {
      TradeEngine.connect(state._wsRef, state.config?.token);
      TradeEngine.onUpdate = (type, data) => {
        if (type === 'buy') {
          setContracts(c => [data, ...c]);
          setLastMsg({ type:'info', text:`Bought: ${data.description?.slice(0,40)}` });
        }
        if (type === 'update') {
          setContracts(c => c.map(x => x.id === data.id ? {...x,...data} : x));
        }
        if (type === 'settled') {
          const won = data.status === 'won';
          setContracts(c => c.map(x => x.id === data.id ? {...x,...data} : x));
          setLastMsg({
            type: won ? 'win' : 'loss',
            text: `${won ? '✅ WIN' : '❌ LOSS'} $${Math.abs(data.finalProfit||0).toFixed(2)}`
          });
          setSession(s => ({
            wins:   s.wins   + (won ? 1 : 0),
            losses: s.losses + (won ? 0 : 1),
            pnl:    s.pnl    + (data.finalProfit || 0),
          }));
          // Log to memory
          MemoryDB.logTrade({
            bot: autoBot || 'Manual', res: won ? 'WIN' : 'LOSS',
            pnl: data.finalProfit, stake: parseFloat(stake),
            mkt: symbol, ct: ctype,
            score: conf?.score || 0, time: new Date().toISOString(),
          }).catch(() => {});
        }
        if (type === 'error') {
          setLastMsg({ type:'error', text: `Error: ${data.msg}` });
          setBusy(false);
        }
      };
    }
  }, [state._wsRef, state.config?.token]);

  // Get live proposal price
  const fetchProposal = useCallback(async () => {
    if (!connected || !state._wsRef) return;
    try {
      const res = await TradeEngine.getProposal({
        contractType: ctype, symbol, stake: parseFloat(stake)||1,
        duration: dur.d, durationUnit: dur.u,
      });
      if (res?.proposal) {
        setProposal({ askPrice: res.proposal.ask_price, payout: res.proposal.payout });
      }
    } catch {}
  }, [connected, ctype, symbol, stake, dur]);

  useEffect(() => {
    if (propTimer) clearTimeout(propTimer);
    const t = setTimeout(fetchProposal, 600);
    setPropTimer(t);
    return () => clearTimeout(t);
  }, [ctype, symbol, stake, durIdx]);

  const buy = async () => {
    if (!connected) { Alert.alert('Not Connected', 'Connect your API in Settings first.'); return; }
    if (!state.config?.token) { Alert.alert('No Token', 'Add your Deriv API token (Trade scope) in Settings.'); return; }
    const s = parseFloat(stake);
    if (!s || s <= 0) { Alert.alert('Invalid Stake', 'Enter a valid stake amount.'); return; }

    setBusy(true);
    setLastMsg({ type:'info', text:'Placing trade...' });
    try {
      await TradeEngine.buy({
        contractType: ctype, symbol, stake: s,
        duration: dur.d, durationUnit: dur.u,
      });
    } catch (e) {
      setLastMsg({ type:'error', text: e.message });
    }
    setBusy(false);
  };

  const sell = async (contractId) => {
    try {
      await TradeEngine.sell(contractId, 0);
    } catch (e) {
      Alert.alert('Sell failed', e.message);
    }
  };

  const openContracts  = contracts.filter(c => c.status === 'open');
  const closedContracts= contracts.filter(c => c.status !== 'open');
  const wr = (session.wins + session.losses) > 0
    ? Math.round(session.wins / (session.wins + session.losses) * 100) : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Session stats ─────────────────────────────────────────────── */}
        <View style={styles.sessionStrip}>
          {[
            ['SESSION P&L', (session.pnl>=0?'+$':'-$')+Math.abs(session.pnl).toFixed(2),
             session.pnl>=0?C.gr:C.re],
            ['WIN RATE', wr+'%', wr>=60?C.gr:wr>=50?C.ye:C.re],
            ['WINS', session.wins, C.gr],
            ['LOSSES', session.losses, C.re],
          ].map(([l,v,col]) => (
            <View key={l} style={styles.statPill}>
              <Text style={styles.statLabel}>{l}</Text>
              <Text style={[styles.statVal, {color:col}]}>{v}</Text>
            </View>
          ))}
        </View>

        {/* ── Signal context from analysis ──────────────────────────────── */}
        {conf && (
          <View style={[styles.signalCtx, {
            borderColor: conf.score>=70 ? 'rgba(6,214,160,.35)' : 'rgba(255,215,64,.25)'
          }]}>
            <Text style={styles.signalCtxTitle}>CURRENT SIGNAL (from analysis)</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              <View>
                <Text style={[styles.signalDir, {
                  color: conf.direction?.includes('RISE')||conf.direction?.includes('EVEN')||conf.direction?.includes('OVER')
                    ? C.gr : conf.direction ? C.re : C.tx3
                }]}>{conf.direction || 'WAIT'}</Text>
                <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace'}}>{conf.bot||'—'}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace',marginBottom:3}}>SCORE</Text>
                <View style={{height:8,backgroundColor:C.sf2,borderRadius:4,overflow:'hidden'}}>
                  <View style={{width:conf.score+'%',height:'100%',
                    backgroundColor:conf.score>=70?C.gr:conf.score>=50?C.ye:C.re,borderRadius:4}}/>
                </View>
                <Text style={{color:C.tx2,fontSize:11,fontWeight:'700',marginTop:2}}>{conf.score}/100</Text>
              </View>
              {conf.direction && conf.score >= 60 && (
                <TouchableOpacity onPress={() => {
                  if (conf.direction?.includes('RISE')) setCtype('Rise');
                  else if (conf.direction?.includes('FALL')) setCtype('Fall');
                  else if (conf.direction?.includes('EVEN')) setCtype('Even');
                  else if (conf.direction?.includes('ODD')) setCtype('Odd');
                  else if (conf.direction?.includes('OVER')) setCtype('Over 5');
                  else if (conf.direction?.includes('UNDER')) setCtype('Under 5');
                }} style={styles.useSignalBtn}>
                  <Text style={{color:C.bg,fontSize:9,fontWeight:'800',fontFamily:'monospace'}}>USE SIGNAL</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Contract type ─────────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>CONTRACT TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
          <View style={{flexDirection:'row',gap:6}}>
            {CTYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setCtype(t)}
                style={[styles.typeBtn, {borderColor: ctype===t ? TYPE_COLOR[t] : C.bd2,
                  backgroundColor: ctype===t ? TYPE_COLOR[t]+'22' : 'transparent'}]}>
                <Text style={{color: ctype===t ? TYPE_COLOR[t] : C.tx3,
                  fontWeight:'700', fontFamily:'monospace', fontSize:11}}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Symbol ────────────────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>MARKET</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
          <View style={{flexDirection:'row',gap:6}}>
            {SYMBOLS.map(s => (
              <TouchableOpacity key={s} onPress={() => setSymbol(s)}
                style={[styles.typeBtn, {borderColor: symbol===s ? C.ac : C.bd2,
                  backgroundColor: symbol===s ? 'rgba(230,57,70,.15)' : 'transparent'}]}>
                <Text style={{color: symbol===s ? C.ac : C.tx3,
                  fontWeight:'700', fontFamily:'monospace', fontSize:11}}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Duration ──────────────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>DURATION</Text>
        <View style={{flexDirection:'row',gap:6,marginBottom:14}}>
          {DURATIONS.map((d,i) => (
            <TouchableOpacity key={d.val} onPress={() => setDurIdx(i)}
              style={[styles.durBtn, durIdx===i && styles.durBtnOn]}>
              <Text style={{color: durIdx===i ? C.bg : C.tx3, fontWeight:'700',
                fontFamily:'monospace', fontSize:10}}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stake + proposal ──────────────────────────────────────────── */}
        <View style={{flexDirection:'row',gap:10,alignItems:'center',marginBottom:14}}>
          <View style={{flex:1}}>
            <Text style={styles.fieldLabel}>STAKE (USD)</Text>
            <View style={{flexDirection:'row',alignItems:'center',backgroundColor:C.sf,
              borderWidth:1,borderColor:C.bd2,borderRadius:8}}>
              {['0.5','1','2','5','10'].map(v => (
                <TouchableOpacity key={v} onPress={() => setStake(v)}
                  style={{paddingHorizontal:8,paddingVertical:8,
                    backgroundColor:stake===v?'rgba(230,57,70,.2)':'transparent',
                    borderRadius:6}}>
                  <Text style={{color:stake===v?C.ac:C.tx3,fontSize:10,fontFamily:'monospace',fontWeight:'700'}}>{v}</Text>
                </TouchableOpacity>
              ))}
              <TextInput value={stake} onChangeText={setStake}
                style={{flex:1,color:C.tx,fontFamily:'monospace',fontSize:13,
                  paddingHorizontal:8,paddingVertical:8}}
                keyboardType="decimal-pad" placeholder="custom" placeholderTextColor={C.tx3}/>
            </View>
          </View>
          {proposal && (
            <View style={{alignItems:'flex-end'}}>
              <Text style={styles.fieldLabel}>PAYOUT</Text>
              <Text style={{color:C.gr,fontSize:16,fontWeight:'800'}}>${proposal.payout?.toFixed(2)}</Text>
              <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace'}}>Cost ${proposal.askPrice?.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* ── Last message ──────────────────────────────────────────────── */}
        {lastMsg && (
          <View style={[styles.msgBanner, {
            backgroundColor: lastMsg.type==='win'   ? 'rgba(6,214,160,.12)' :
                             lastMsg.type==='loss'  ? 'rgba(230,57,70,.12)' :
                             lastMsg.type==='error' ? 'rgba(230,57,70,.15)' : 'rgba(255,215,64,.08)',
            borderColor:     lastMsg.type==='win'   ? 'rgba(6,214,160,.35)' :
                             lastMsg.type==='loss'  ? 'rgba(230,57,70,.35)' :
                             lastMsg.type==='error' ? 'rgba(230,57,70,.4)'  : 'rgba(255,215,64,.25)',
          }]}>
            <Text style={{color: lastMsg.type==='win'?C.gr : lastMsg.type==='loss'||lastMsg.type==='error'?C.re : C.ye,
              fontFamily:'monospace', fontWeight:'700', fontSize:12}}>{lastMsg.text}</Text>
          </View>
        )}

        {/* ── BUY button ────────────────────────────────────────────────── */}
        <TouchableOpacity onPress={buy} disabled={busy || !connected}
          style={[styles.buyBtn, {
            backgroundColor: busy ? 'rgba(230,57,70,.3)' : !connected ? 'rgba(80,80,80,.3)' : 'rgba(230,57,70,.2)',
            borderColor:     busy ? 'rgba(230,57,70,.4)' : !connected ? C.bd3 : C.ac,
          }]}>
          <Text style={{color: !connected?C.tx3:C.ac, fontWeight:'800',
            fontFamily:'monospace', fontSize:15, letterSpacing:1}}>
            {busy ? 'PLACING...' : !connected ? 'CONNECT API FIRST' :
              `▶  BUY ${ctype.toUpperCase()} — ${symbol} — ${dur.label}`}
          </Text>
        </TouchableOpacity>

        {/* ── Not connected warning ─────────────────────────────────────── */}
        {!connected && (
          <Text style={{color:C.tx3,fontSize:10,textAlign:'center',marginTop:4,fontFamily:'monospace'}}>
            Go to Settings → Enter App ID + API Token (Trade scope) → Connect
          </Text>
        )}

        {/* ── Open contracts ────────────────────────────────────────────── */}
        {openContracts.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, {marginTop:18}]}>OPEN CONTRACTS ({openContracts.length})</Text>
            {openContracts.map(c => <ContractCard key={c.id} contract={c} onSell={sell}/>)}
          </>
        )}

        {/* ── Closed contracts ──────────────────────────────────────────── */}
        {closedContracts.length > 0 && (
          <>
            <Text style={[styles.fieldLabel, {marginTop:14}]}>SETTLED THIS SESSION</Text>
            {closedContracts.slice(0,10).map(c => <ContractCard key={c.id} contract={c} onSell={sell}/>)}
          </>
        )}

        <View style={{height:30}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex:1, backgroundColor:C.bg },
  content:      { padding:12 },
  sessionStrip: { flexDirection:'row', backgroundColor:C.sf, borderRadius:10,
                  borderWidth:1, borderColor:C.bd, marginBottom:12, overflow:'hidden' },
  statPill:     { flex:1, alignItems:'center', paddingVertical:10,
                  borderRightWidth:1, borderRightColor:C.bd },
  statLabel:    { fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
                  letterSpacing:0.8, marginBottom:3 },
  statVal:      { fontSize:15, fontWeight:'800' },
  signalCtx:    { backgroundColor:C.sf, borderRadius:10, borderWidth:1,
                  padding:12, marginBottom:12 },
  signalCtxTitle:{ fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
                   letterSpacing:1, marginBottom:8 },
  signalDir:    { fontSize:24, fontWeight:'800' },
  useSignalBtn: { backgroundColor:C.ac, paddingHorizontal:10, paddingVertical:7,
                  borderRadius:7, alignItems:'center' },
  fieldLabel:   { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
                  letterSpacing:1, marginBottom:6 },
  typeBtn:      { paddingHorizontal:12, paddingVertical:8, borderRadius:7, borderWidth:1 },
  durBtn:       { flex:1, paddingVertical:8, borderRadius:6, borderWidth:1,
                  borderColor:C.bd2, alignItems:'center' },
  durBtnOn:     { backgroundColor:C.ac, borderColor:C.ac },
  msgBanner:    { borderWidth:1, borderRadius:8, padding:12, marginBottom:10, alignItems:'center' },
  buyBtn:       { borderWidth:2, borderRadius:10, padding:17, alignItems:'center', marginBottom:10 },
  contractCard: { backgroundColor:C.sf, borderRadius:9, borderWidth:1, borderColor:C.bd,
                  borderLeftWidth:3, padding:12, marginBottom:8 },
  ccHead:       { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  ccType:       { fontSize:12, fontWeight:'600', color:C.tx, maxWidth:160 },
  ccId:         { fontSize:8, color:C.tx3, fontFamily:'monospace' },
  ccProfit:     { fontSize:18, fontWeight:'800' },
  ccStatus:     { fontSize:9, fontFamily:'monospace', fontWeight:'700' },
  ccRow:        { flexDirection:'row', gap:8, alignItems:'center', flexWrap:'wrap' },
  ccLabel:      { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase' },
  ccVal:        { fontSize:11, fontWeight:'700', color:C.tx, marginRight:6 },
  sellBtn:      { marginTop:8, borderWidth:1, borderColor:'rgba(255,215,64,.4)',
                  borderRadius:6, padding:7, alignItems:'center' },
  sellBtnTxt:   { color:C.ye, fontFamily:'monospace', fontSize:10, fontWeight:'800' },
});
