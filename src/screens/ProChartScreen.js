import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Linking, Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../theme';
import { calcConfluence } from '../indicators';

const { width: SW } = Dimensions.get('window');

// ── Symbol map — exactly what charts.deriv.com accepts ──────────────────────
const SYMS = [
  { val:'R_75',    label:'V75',     derivSym:'R_75'    },
  { val:'R_100',   label:'V100',    derivSym:'R_100'   },
  { val:'R_25',    label:'V25',     derivSym:'R_25'    },
  { val:'R_50',    label:'V50',     derivSym:'R_50'    },
  { val:'R_10',    label:'V10',     derivSym:'R_10'    },
  { val:'1HZ100V', label:'1HZ100V', derivSym:'1HZ100V' },
  { val:'1HZ75V',  label:'1HZ75V',  derivSym:'1HZ75V'  },
  { val:'1HZ10V',  label:'1HZ10V',  derivSym:'1HZ10V'  },
];

// Granularity in seconds — same values the HTML file uses
const TFS = [
  { label:'1m',  gran:'60'    },
  { label:'2m',  gran:'120'   },
  { label:'5m',  gran:'300'   },
  { label:'15m', gran:'900'   },
  { label:'30m', gran:'1800'  },
  { label:'1H',  gran:'3600'  },
];

// Signal symbols for the live tick panel
const SIG_SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];

export default function ProChartScreen({ state }) {
  const [sym,    setSym]    = useState(SYMS[0]);
  const [tf,     setTf]     = useState(TFS[2]);       // default 5m
  const [sigSym, setSigSym] = useState('R_75');
  const [mode,   setMode]   = useState('chart');       // 'chart' | 'signals'
  const webviewRef = useRef(null);

  const { prices, digits } = state;
  const utcH      = new Date().getUTCHours();
  const symPrices = prices[sigSym] || [];
  const conf      = useMemo(
    () => calcConfluence(symPrices, digits, utcH),
    [symPrices.length, digits.length, utcH]
  );

  // ── Exact URL pattern from the working HTML file ──────────────────────────
  const chartUrl = `https://charts.deriv.com/deriv?symbol=${sym.derivSym}&granularity=${tf.gran}&chart_type=candles&theme=dark`;

  const handleSym = (s) => {
    setSym(s);
    // If webview is already loaded, navigate to new symbol
    if (webviewRef.current) {
      const url = `https://charts.deriv.com/deriv?symbol=${s.derivSym}&granularity=${tf.gran}&chart_type=candles&theme=dark`;
      webviewRef.current.injectJavaScript(`window.location.href = '${url}'; true;`);
    }
  };

  const handleTf = (t) => {
    setTf(t);
    if (webviewRef.current) {
      const url = `https://charts.deriv.com/deriv?symbol=${sym.derivSym}&granularity=${t.gran}&chart_type=candles&theme=dark`;
      webviewRef.current.injectJavaScript(`window.location.href = '${url}'; true;`);
    }
  };

  return (
    <View style={styles.root}>

      {/* ── TOP CONTROLS ─────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        {/* Symbol selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symScroll}>
          <View style={styles.row}>
            {SYMS.map(s => (
              <TouchableOpacity key={s.val} onPress={() => handleSym(s)}
                style={[styles.chip, sym.val===s.val && styles.chipOn]}>
                <Text style={[styles.chipTxt, sym.val===s.val && {color:C.bg}]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Timeframe + mode toggle */}
        <View style={[styles.row, {paddingHorizontal:8, paddingVertical:5, gap:4, flexWrap:'wrap'}]}>
          {TFS.map(t => (
            <TouchableOpacity key={t.gran} onPress={() => handleTf(t)}
              style={[styles.tfBtn, tf.gran===t.gran && styles.tfBtnOn]}>
              <Text style={[styles.tfTxt, tf.gran===t.gran && {color:C.bg}]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{flex:1}}/>
          {/* Toggle chart / signals */}
          <TouchableOpacity onPress={() => setMode(mode==='chart'?'signals':'chart')}
            style={[styles.tfBtn, {borderColor:C.pu2+'88', paddingHorizontal:12}]}>
            <Text style={{color:C.pu2, fontSize:9, fontFamily:'monospace', fontWeight:'700'}}>
              {mode==='chart' ? '📡 SIGNALS' : '📊 CHART'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CHART ────────────────────────────────────────────────────────── */}
      {mode === 'chart' ? (
        <WebView
          ref={webviewRef}
          key={chartUrl}                       // force reload on URL change
          source={{ uri: chartUrl }}
          style={styles.chart}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          allowsFullscreenVideo={false}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loading}>
              <Text style={styles.loadingTxt}>Loading Deriv Chart...</Text>
              <Text style={styles.loadingHint}>charts.deriv.com · {sym.label} · {tf.label}</Text>
            </View>
          )}
          renderError={() => (
            <View style={styles.loading}>
              <Text style={{color:C.ye, fontSize:13, marginBottom:8}}>No internet connection</Text>
              <TouchableOpacity onPress={() => Linking.openURL(chartUrl)}
                style={styles.openBtn}>
                <Text style={styles.openBtnTxt}>Open in Browser →</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : (
        /* ── SIGNALS PANEL ─────────────────────────────────────────────── */
        <ScrollView style={styles.sigScroll} contentContainerStyle={{padding:12}}>
          {/* Sym selector for signals */}
          <Text style={styles.sigHead}>Live Entry Signals</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
            <View style={styles.row}>
              {SIG_SYMS.map(s => (
                <TouchableOpacity key={s} onPress={() => setSigSym(s)}
                  style={[styles.chip, sigSym===s && styles.chipOn]}>
                  <Text style={[styles.chipTxt, sigSym===s && {color:C.bg}]}>
                    {s.replace('R_','V').replace('1HZ100V','1HZ100')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {conf ? (
            <>
              {/* Score + Direction */}
              <View style={styles.scoreRow}>
                <View style={[styles.scoreBox, {
                  borderColor: (conf.score>=70?C.gr:conf.score>=50?C.ye:C.re)+'88',
                  backgroundColor: (conf.score>=70?C.gr:conf.score>=50?C.ye:C.re)+'12',
                }]}>
                  <Text style={styles.scoreLbl}>ENTRY SCORE</Text>
                  <Text style={[styles.scoreNum, {color: conf.score>=70?C.gr:conf.score>=50?C.ye:C.re}]}>
                    {conf.score}
                  </Text>
                  <Text style={[styles.scoreWord, {color: conf.score>=70?C.gr:conf.score>=50?C.ye:C.re}]}>
                    {conf.score>=80?'TRADE NOW':conf.score>=65?'LIKELY':conf.score>=50?'PARTIAL':'WAIT'}
                  </Text>
                </View>
                <View style={styles.dirBox}>
                  <Text style={styles.scoreLbl}>SETUP</Text>
                  <Text style={[styles.dirTxt, {
                    fontSize: conf.direction?22:15,
                    color: conf.direction
                      ? (conf.direction.includes('RISE')||conf.direction.includes('EVEN')||conf.direction.includes('OVER')?C.gr:C.re)
                      : C.tx3,
                  }]}>{conf.direction||'WAIT'}</Text>
                  {conf.bot ? <Text style={{fontSize:10, color:C.tx3, marginTop:4}}>{conf.bot}</Text> : null}
                  <Text style={{fontSize:10, color:conf.regimeColor, fontWeight:'700', marginTop:4}}>{conf.regime}</Text>
                </View>
              </View>

              {/* Dead zone alert */}
              {conf.r14>=40 && conf.r14<=60 ? (
                <View style={styles.deadZone}>
                  <Text style={styles.deadTxt}>⛔ RSI DEAD ZONE ({conf.r14?.toFixed(1)}) — DO NOT TRADE</Text>
                </View>
              ) : null}

              {/* Indicator cells */}
              <View style={styles.indGrid}>
                {[
                  {l:'RSI(14)', v:conf.r14?.toFixed(1)??'--',
                   c:conf.r14>70?C.re:conf.r14<30?C.gr:conf.r14>=40&&conf.r14<=60?C.or:C.ye,
                   s:conf.r14>70?'OVERBOUGHT':conf.r14<30?'OVERSOLD':conf.r14>=40&&conf.r14<=60?'DEAD ZONE':'CLEAR'},
                  {l:'RSI(4)',  v:conf.r4?.toFixed(1)??'--',
                   c:conf.r4<33?C.gr:conf.r4>67?C.re:C.tx2,
                   s:conf.r4<33?'RISE <33':conf.r4>67?'FALL >67':'Neutral'},
                  {l:'EMA Sep', v:conf.e5&&conf.e10?Math.abs(conf.e5-conf.e10).toFixed(4):'--',
                   c:conf.e5&&conf.e10&&Math.abs(conf.e5-conf.e10)>0.02?C.gr:C.tx2,
                   s:conf.e5>conf.e10&&conf.e10>conf.e20?'BULL':conf.e5<conf.e10&&conf.e10<conf.e20?'BEAR':'MIXED'},
                  {l:'Momentum',v:conf.mom!=null?(conf.mom>=0?'+':'')+conf.mom.toFixed(4):'--',
                   c:Math.abs(conf.mom||0)>=0.04?C.gr:C.tx2,
                   s:Math.abs(conf.mom||0)>=0.04?'STRONG':'WEAK'},
                  {l:'BB Width', v:conf.bb?.width.toFixed(4)??'--',
                   c:conf.bb?.width<0.05?C.ac:C.tx2,
                   s:conf.bb?.width<0.05?'SQUEEZE':'NORMAL'},
                  {l:'Streak',  v:conf.esc>=4?conf.esc+'E':conf.osc>=4?conf.osc+'O':'--',
                   c:conf.esc>=4||conf.osc>=4?C.gr:C.tx3,
                   s:conf.esc>=4?'BET ODD':conf.osc>=4?'BET EVEN':'None'},
                ].map(ind=>(
                  <View key={ind.l} style={styles.indCell}>
                    <Text style={styles.indLabel}>{ind.l}</Text>
                    <Text style={[styles.indVal, {color:ind.c}]}>{ind.v}</Text>
                    <Text style={[styles.indSub, {color:ind.c+'cc'}]}>{ind.s}</Text>
                  </View>
                ))}
              </View>

              {/* Confluence factors */}
              <View style={styles.factCard}>
                <Text style={styles.factTitle}>Confluence Factors</Text>
                {conf.factors.map(f=>(
                  <View key={f.key} style={styles.factRow}>
                    <Text style={{color:f.ok?C.gr:C.re, fontSize:13, marginRight:8}}>{f.ok?'✓':'✗'}</Text>
                    <Text style={styles.factLabel}>{f.label}</Text>
                    <View style={{flex:1}}/>
                    <Text style={[styles.factVal, {color:f.ok?C.gr:C.re}]}>{f.desc}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.noData}>
              <Text style={styles.noDataTxt}>Connect API in Settings to see live signals</Text>
            </View>
          )}
          <View style={{height:20}}/>
        </ScrollView>
      )}

      {/* ── BOTTOM STATUS STRIP (always visible) ────────────────────────── */}
      {mode === 'chart' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.strip} contentContainerStyle={styles.stripRow}>
          <SigPill label="SCORE"   value={conf?.score??'--'}  color={conf?(conf.score>=70?C.gr:conf.score>=50?C.ye:C.re):C.tx3}/>
          <Sep/><SigPill label="RSI14"  value={conf?.r14?.toFixed(1)??'--'} color={conf?.r14>70?C.re:conf?.r14<30?C.gr:C.ye}/>
          <Sep/><SigPill label="RSI4"   value={conf?.r4?.toFixed(1)??'--'}  color={conf?.r4<33?C.gr:conf?.r4>67?C.re:C.tx2}/>
          <Sep/><SigPill label="REGIME" value={conf?.regime??'--'}          color={conf?.regimeColor??C.tx3}/>
          <Sep/><SigPill label="SETUP"  value={conf?.direction||'WAIT'}     color={conf?.direction?C.gr:C.tx3}/>
          <Sep/><SigPill label="DEAD?"  value={conf?.r14>=40&&conf?.r14<=60?'⛔YES':'✓NO'} color={conf?.r14>=40&&conf?.r14<=60?C.re:C.gr}/>
        </ScrollView>
      )}
    </View>
  );
}

function SigPill({ label, value, color }) {
  return (
    <View style={{alignItems:'center', paddingHorizontal:12}}>
      <Text style={{fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.8, marginBottom:2}}>{label}</Text>
      <Text style={{fontSize:13, fontWeight:'800', color: color||C.tx}}>{value}</Text>
    </View>
  );
}
function Sep() {
  return <View style={{width:1, height:28, backgroundColor:C.bd2}}/>;
}

const styles = StyleSheet.create({
  root:      { flex:1, backgroundColor:C.bg },
  controls:  { backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd },
  symScroll: { maxHeight:42, borderBottomWidth:1, borderBottomColor:C.bd },
  row:       { flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:5, gap:5 },
  chip:      { paddingHorizontal:10, paddingVertical:4, borderRadius:5, borderWidth:1, borderColor:C.bd2 },
  chipOn:    { backgroundColor:C.ac, borderColor:C.ac },
  chipTxt:   { fontSize:10, color:C.tx2, fontFamily:'monospace', fontWeight:'700' },
  tfBtn:     { paddingHorizontal:9, paddingVertical:4, borderRadius:4, borderWidth:1, borderColor:C.bd3 },
  tfBtnOn:   { backgroundColor:C.ac, borderColor:C.ac },
  tfTxt:     { fontSize:10, color:C.tx2, fontFamily:'monospace', fontWeight:'700' },

  chart:     { flex:1, backgroundColor:C.bg },
  loading:   { position:'absolute', inset:0, flex:1, justifyContent:'center', alignItems:'center', backgroundColor:C.bg },
  loadingTxt:{ color:C.tx3, fontFamily:'monospace', fontSize:13, marginBottom:5 },
  loadingHint:{ color:C.tx4, fontSize:10, fontFamily:'monospace' },
  openBtn:   { backgroundColor:'rgba(0,212,255,.15)', borderWidth:1, borderColor:'rgba(0,212,255,.3)', borderRadius:7, paddingHorizontal:16, paddingVertical:8 },
  openBtnTxt:{ color:C.ac, fontFamily:'monospace', fontSize:12, fontWeight:'700' },

  strip:     { maxHeight:52, backgroundColor:C.sf, borderTopWidth:1, borderTopColor:C.bd },
  stripRow:  { flexDirection:'row', alignItems:'center', paddingHorizontal:6, height:52 },

  sigScroll: { flex:1 },
  sigHead:   { fontSize:16, fontWeight:'800', color:C.tx, marginBottom:12 },
  scoreRow:  { flexDirection:'row', gap:10, marginBottom:10 },
  scoreBox:  { flex:1, borderWidth:1.5, borderRadius:10, padding:12, alignItems:'center' },
  scoreLbl:  { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:5 },
  scoreNum:  { fontSize:40, fontWeight:'800', lineHeight:44 },
  scoreWord: { fontSize:13, fontWeight:'700', marginTop:2 },
  dirBox:    { flex:1, backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, padding:12, justifyContent:'center' },
  dirTxt:    { fontWeight:'800', marginBottom:2 },
  deadZone:  { backgroundColor:'rgba(255,23,68,.1)', borderWidth:1, borderColor:'rgba(255,23,68,.4)', borderRadius:8, padding:12, marginBottom:10, alignItems:'center' },
  deadTxt:   { color:C.re, fontWeight:'800', fontSize:13, fontFamily:'monospace' },
  indGrid:   { flexDirection:'row', flexWrap:'wrap', gap:7, marginBottom:10 },
  indCell:   { width:(SW-24-14)/3-5, backgroundColor:C.sf, borderRadius:8, borderWidth:1, borderColor:C.bd, padding:10 },
  indLabel:  { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  indVal:    { fontSize:15, fontWeight:'800', marginBottom:2 },
  indSub:    { fontSize:9 },
  factCard:  { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, padding:12 },
  factTitle: { fontSize:10, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.8, marginBottom:10 },
  factRow:   { flexDirection:'row', alignItems:'center', paddingVertical:5, borderBottomWidth:1, borderBottomColor:C.bd },
  factLabel: { fontSize:11, color:C.tx2, fontFamily:'monospace' },
  factVal:   { fontSize:10, fontFamily:'monospace', fontWeight:'700' },
  noData:    { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, padding:30, alignItems:'center' },
  noDataTxt: { color:C.tx3, fontFamily:'monospace', textAlign:'center' },
});
