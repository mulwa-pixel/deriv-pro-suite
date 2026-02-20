import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { C, SYM_COLORS } from '../theme';
import { calcConfluence, calcStreaks, calcDigitDom } from '../indicators';
import StatCard from '../components/StatCard';
import Card from '../components/Card';
import ScoreGauge from '../components/ScoreGauge';
import IndicatorRow from '../components/IndicatorRow';
import DigitStrip from '../components/DigitStrip';
import MiniLineChart from '../components/MiniLineChart';
import Badge from '../components/Badge';
import SectionHeader from '../components/SectionHeader';

export default function DashboardScreen({ state }) {
  const { connected, prices, digits, lastTick, balance } = state;
  const sym = state.sym || 'R_75';
  const utcH = new Date().getUTCHours();
  const symPrices = prices[sym] || [];

  const conf = useMemo(() => calcConfluence(symPrices, digits, utcH), [symPrices.length, digits.length, utcH]);
  const {even:esc, odd:osc} = useMemo(() => calcStreaks(digits), [digits.length]);
  const domData = useMemo(() => calcDigitDom(digits), [digits.length]);

  const session = useMemo(() => {
    const h = utcH + new Date().getUTCMinutes()/60;
    if (h>=8&&h<12) return {name:'Morning', bots:'#1,#3,#7', color:C.ye};
    if (h>=12&&h<18) return {name:'Afternoon', bots:'#2,#4,#7', color:C.ac};
    if (h>=16&&h<18) return {name:'Evening', bots:'#5,#6', color:C.or};
    return {name:'Off-Hours', bots:'--', color:C.tx3};
  }, [utcH]);

  const trades = state.trades || [];
  const wins = trades.filter(t=>t.res==='WIN').length;
  const pnl = trades.reduce((a,t)=>a+t.pnl,0);
  const wr = trades.length ? Math.round((wins/trades.length)*100) : 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} tintColor={C.ac}/>}>

      {/* STATUS BAR */}
      <View style={styles.statusRow}>
        <View style={[styles.pill, {backgroundColor: connected?'rgba(0,230,118,.12)':'rgba(255,23,68,.1)', borderColor: connected?'rgba(0,230,118,.35)':'rgba(255,23,68,.3)'}]}>
          <View style={[styles.dot, {backgroundColor: connected?C.gr:C.re}]}/>
          <Text style={{color: connected?C.gr:C.re, fontSize:9, fontFamily:'monospace', textTransform:'uppercase'}}>{connected?'LIVE':'OFFLINE'}</Text>
        </View>
        <View style={[styles.pill, {backgroundColor:'rgba(255,215,64,.07)', borderColor:'rgba(255,215,64,.2)'}]}>
          <View style={[styles.dot, {backgroundColor:session.color}]}/>
          <Text style={{color:session.color, fontSize:9, fontFamily:'monospace', textTransform:'uppercase'}}>{session.name} · Bots {session.bots}</Text>
        </View>
        {conf ? (
          <View style={[styles.pill, {backgroundColor:'rgba(0,212,255,.07)', borderColor:'rgba(0,212,255,.2)'}]}>
            <Text style={{color:C.ac, fontSize:9, fontFamily:'monospace'}}>SCORE: {conf.score}</Text>
          </View>
        ) : null}
      </View>

      {/* STAT TILES */}
      <View style={styles.statsRow}>
        <StatCard label="Balance"  value={balance ? `$${parseFloat(balance.amount).toFixed(2)}` : '$--'} sub={balance?.currency||'Connect'} accentColor={C.gr}/>
        <StatCard label="P&L"      value={(pnl>=0?'+$':'-$')+Math.abs(pnl).toFixed(2)} sub={`${trades.length} trades`} accentColor={pnl>=0?C.gr:C.re}/>
        <StatCard label="Win Rate" value={`${wr}%`} sub={`${wins}W/${trades.length-wins}L`} accentColor={C.ye}/>
      </View>

      {/* ENTRY SCORE + TRADE SETUP */}
      {conf ? (
        <Card title="Entry Quality Score">
          <View style={{flexDirection:'row', alignItems:'center', gap:12}}>
            <ScoreGauge score={conf.score}/>
            <View style={{flex:1}}>
              {conf.direction ? (
                <View style={[styles.setupBox, {borderLeftColor: conf.direction.includes('RISE')||conf.direction.includes('EVEN')||conf.direction.includes('OVER')?C.gr:C.re}]}>
                  <Text style={[styles.setupDir, {color: conf.direction.includes('RISE')||conf.direction.includes('EVEN')||conf.direction.includes('OVER')?C.gr:C.re}]}>{conf.direction}</Text>
                  <Text style={styles.setupBot}>{conf.bot}</Text>
                  <Text style={styles.setupCt}>{conf.contract}</Text>
                </View>
              ) : (
                <View style={[styles.setupBox, {borderLeftColor:C.tx3}]}>
                  <Text style={{color:C.tx3, fontWeight:'800', fontSize:16}}>WAIT</Text>
                  <Text style={{color:C.tx3, fontSize:11, marginTop:4}}>Score too low or conditions missing</Text>
                </View>
              )}
              <Text style={styles.regimeTxt}>Regime: <Text style={{color:conf.regimeColor, fontWeight:'700'}}>{conf.regime}</Text></Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card title="Entry Quality Score">
          <Text style={{color:C.tx3, textAlign:'center', padding:20}}>Connect API in Settings to enable scoring</Text>
        </Card>
      )}

      {/* LIVE INDICATORS */}
      {conf ? (
        <Card title="Live Indicators">
          <IndicatorRow label="RSI (14)" value={conf.r14?.toFixed(1)??'--'}
            badgeLabel={conf.r14>70?'OVERBOUGHT':conf.r14<30?'OVERSOLD':conf.r14>=40&&conf.r14<=60?'DEAD ZONE':'NEUTRAL'}
            badgeVariant={conf.r14>70?'bear':conf.r14<30?'bull':conf.r14>=40&&conf.r14<=60?'warn':'warn'}
            valueColor={conf.r14>70?C.re:conf.r14<30?C.gr:conf.r14>=40&&conf.r14<=60?C.or:C.ye}/>
          <IndicatorRow label="RSI (4) — Berlin X9" value={conf.r4?.toFixed(1)??'--'}
            badgeLabel={conf.r4<33?'RISE':conf.r4>67?'FALL':'NEUTRAL'}
            badgeVariant={conf.r4<33?'bull':conf.r4>67?'bear':'warn'}/>
          <IndicatorRow label="EMA Separation 5-10" value={conf.e5&&conf.e10?Math.abs(conf.e5-conf.e10).toFixed(4):'--'}
            badgeLabel={conf.e5>conf.e10&&conf.e10>conf.e20?'BULLISH':conf.e5<conf.e10&&conf.e10<conf.e20?'BEARISH':'MIXED'}
            badgeVariant={conf.e5>conf.e10&&conf.e10>conf.e20?'bull':conf.e5<conf.e10&&conf.e10<conf.e20?'bear':'warn'}/>
          <IndicatorRow label="Momentum 5T" value={(conf.mom>=0?'+':'')+conf.mom?.toFixed(4)}
            badgeLabel={Math.abs(conf.mom)>=0.04?'STRONG':'WEAK'}
            badgeVariant={Math.abs(conf.mom)>=0.04?'bull':'warn'}/>
          {conf.bb ? (
            <IndicatorRow label="BB Width" value={conf.bb.width?.toFixed(4)}
              badgeLabel={conf.bb.width<0.05?'SQUEEZE':'NORMAL'}
              badgeVariant={conf.bb.width<0.05?'bull':'warn'}/>
          ) : null}
        </Card>
      ) : null}

      {/* DIGIT STREAK */}
      <Card title="Digit Streak — Last 20">
        <DigitStrip digits={digits}/>
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={styles.streakLbl}>Consec. Even</Text>
            <Text style={[styles.streakNum, {color:C.ac}]}>{esc}</Text>
          </View>
          <View style={styles.streakItem}>
            <Text style={styles.streakLbl}>Consec. Odd</Text>
            <Text style={[styles.streakNum, {color:C.pu2}]}>{osc}</Text>
          </View>
          <View style={styles.streakItem}>
            <Text style={styles.streakLbl}>Bot#1 Signal</Text>
            <Badge
              label={esc>=4?'BET ODD':osc>=4?'BET EVEN':'WAIT'}
              variant={esc>=4?'bear':osc>=4?'bull':'warn'}/>
          </View>
          <View style={styles.streakItem}>
            <Text style={styles.streakLbl}>Digit Dom</Text>
            <Text style={{color:C.gr, fontWeight:'800', fontSize:14}}>{domData.dom}%</Text>
          </View>
        </View>
      </Card>

      {/* MINI CHARTS */}
      <SectionHeader title="All Indices"/>
      <View style={styles.miniGrid}>
        {['R_75','R_100','R_25','R_50','R_10','1HZ100V'].map(s => (
          <View key={s} style={styles.miniCard}>
            <View style={styles.miniHdr}>
              <Text style={[styles.miniSym, {color:SYM_COLORS[s]}]}>
                {s.replace('R_','V').replace('1HZ100V','1HZ100')}
              </Text>
              <Text style={styles.miniPx}>{lastTick[s]?lastTick[s].toFixed(3):'--'}</Text>
            </View>
            <MiniLineChart prices={prices[s]||[]} color={SYM_COLORS[s]} width={160} height={60}/>
          </View>
        ))}
      </View>

      <View style={{height:20}}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex:1, backgroundColor:C.bg },
  content: { padding:12 },
  statusRow: { flexDirection:'row', gap:6, marginBottom:12, flexWrap:'wrap' },
  pill:  { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:4, borderRadius:14, borderWidth:1 },
  dot:   { width:6, height:6, borderRadius:3 },
  statsRow:  { flexDirection:'row', gap:0, marginBottom:10 },
  setupBox:  { borderLeftWidth:3, paddingLeft:10, marginBottom:8 },
  setupDir:  { fontSize:20, fontWeight:'800', marginBottom:2 },
  setupBot:  { fontSize:11, color:C.tx2 },
  setupCt:   { fontSize:11, color:C.tx3 },
  regimeTxt: { fontSize:11, color:C.tx3, marginTop:4 },
  streakRow: { flexDirection:'row', justifyContent:'space-between', marginTop:10, flexWrap:'wrap', gap:8 },
  streakItem:{ alignItems:'center', minWidth:70 },
  streakLbl: { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4 },
  streakNum: { fontSize:22, fontWeight:'800' },
  miniGrid:  { flexDirection:'row', flexWrap:'wrap', gap:8 },
  miniCard:  { backgroundColor:C.sf, borderRadius:9, borderWidth:1, borderColor:C.bd, overflow:'hidden', width:'48%' },
  miniHdr:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:8, paddingVertical:5, backgroundColor:C.sf2, borderBottomWidth:1, borderBottomColor:C.bd },
  miniSym:   { fontSize:10, fontWeight:'700', fontFamily:'monospace' },
  miniPx:    { fontSize:9, color:C.tx2, fontFamily:'monospace' },
});