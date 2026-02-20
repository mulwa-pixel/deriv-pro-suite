import React, { useMemo, memo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C, SYM_COLORS } from '../theme';
import { calcStreaks, calcDigitDom } from '../indicators';
import StatCard    from '../components/StatCard';
import Card        from '../components/Card';
import ScoreGauge  from '../components/ScoreGauge';
import DigitStrip  from '../components/DigitStrip';
import MiniLineChart from '../components/MiniLineChart';
import Badge       from '../components/Badge';
import SectionHeader from '../components/SectionHeader';

// Each sub-section is memoised — only re-renders when its specific data changes
const StatsRow = memo(({ balance, trades }) => {
  const wins = trades.filter(t => t.res === 'WIN').length;
  const pnl  = trades.reduce((a, t) => a + (t.pnl || 0), 0);
  const wr   = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  return (
    <View style={styles.statRow}>
      <StatCard label="Balance"  value={balance ? '$'+parseFloat(balance.amount).toFixed(2) : '$--'} color={C.gr}/>
      <StatCard label="P&L"      value={(pnl>=0?'+$':'-$')+Math.abs(pnl).toFixed(2)} color={pnl>=0?C.gr:C.re}/>
      <StatCard label="Win Rate" value={wr+'%'} color={wr>=60?C.gr:wr>=50?C.ye:C.re}/>
    </View>
  );
});

const ConfluencePanel = memo(({ conf, session }) => {
  if (!conf) return (
    <Card title="Entry Quality">
      <Text style={styles.noData}>Connect API → Dashboard shows live signals</Text>
    </Card>
  );
  return (
    <Card title="Entry Quality">
      <View style={styles.confRow}>
        <ScoreGauge score={conf.score}/>
        <View style={styles.confRight}>
          <Text style={styles.confLabel}>SETUP</Text>
          <Text style={[styles.confDir, {
            color: conf.direction
              ? (conf.direction.includes('RISE')||conf.direction.includes('EVEN')||conf.direction.includes('OVER')
                  ? C.gr : C.re)
              : C.tx3
          }]}>{conf.direction || 'WAIT'}</Text>
          {conf.bot ? <Text style={styles.confBot}>{conf.bot}</Text> : null}
          <Badge
            label={conf.regime}
            variant={conf.regime==='BULLISH'?'bull':conf.regime==='BEARISH'?'bear':'warn'}
            style={{marginTop:6}}
          />
          {conf.r14>=40&&conf.r14<=60 ? (
            <Text style={styles.deadZone}>⛔ DEAD ZONE</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.indGrid}>
        {[
          {l:'RSI(14)',v:conf.r14?.toFixed(1)??'--', c:conf.r14>70?C.re:conf.r14<30?C.gr:conf.r14>=40&&conf.r14<=60?C.or:C.ye},
          {l:'RSI(4)', v:conf.r4?.toFixed(1)??'--',  c:conf.r4<33?C.gr:conf.r4>67?C.re:C.tx2},
          {l:'EMA Sep',v:conf.e5&&conf.e10?Math.abs(conf.e5-conf.e10).toFixed(4):'--', c:C.tx2},
          {l:'Mom 5T', v:conf.mom!=null?(conf.mom>=0?'+':'')+conf.mom.toFixed(4):'--', c:Math.abs(conf.mom||0)>=0.04?C.gr:C.tx2},
          {l:'BB',     v:conf.bb?.width<0.05?'SQUEEZE':'Normal', c:conf.bb?.width<0.05?C.ac:C.tx2},
          {l:'Session',v:session.name, c:session.color},
        ].map(r => (
          <View key={r.l} style={styles.indCell}>
            <Text style={styles.indLabel}>{r.l}</Text>
            <Text style={[styles.indVal,{color:r.c}]}>{r.v}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
});

const DigitPanel = memo(({ digits }) => {
  const streaks = useMemo(() => calcStreaks(digits), [digits.length]);
  const dom     = useMemo(() => calcDigitDom(digits), [digits.length]);
  return (
    <Card title="Digit Stream (last 20)">
      <DigitStrip digits={digits.slice(-20)}/>
      <View style={styles.digitStats}>
        <View style={styles.digitStat}><Text style={styles.dsLabel}>Even streak</Text><Text style={[styles.dsVal,{color:C.ac}]}>{streaks.even}</Text></View>
        <View style={styles.digitStat}><Text style={styles.dsLabel}>Odd streak</Text><Text style={[styles.dsVal,{color:C.pu2}]}>{streaks.odd}</Text></View>
        <View style={styles.digitStat}><Text style={styles.dsLabel}>High (5-9)</Text><Text style={[styles.dsVal,{color:C.gr}]}>{dom.high}%</Text></View>
        <View style={styles.digitStat}><Text style={styles.dsLabel}>Low (0-4)</Text><Text style={[styles.dsVal,{color:C.ye}]}>{dom.low}%</Text></View>
      </View>
    </Card>
  );
});

const MiniChartsGrid = memo(({ prices, lastTick, prevTick }) => (
  <Card title="Markets">
    <View style={styles.chartGrid}>
      {['R_75','R_100','R_25','R_50','R_10','1HZ100V'].map(sym => {
        const arr = prices[sym] || [];
        const last = lastTick[sym] || 0;
        const prev = prevTick[sym] || 0;
        const chg  = last - prev;
        return (
          <View key={sym} style={styles.miniChartCell}>
            <View style={styles.miniChartHeader}>
              <Text style={[styles.miniSym, {color: SYM_COLORS[sym]}]}>
                {sym.replace('R_','V').replace('1HZ100V','1HZ')}
              </Text>
              <Text style={[styles.miniChg, {color: chg>=0 ? C.gr : C.re}]}>
                {chg>=0?'+':''}{chg.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.miniPrice}>{last ? last.toFixed(sym.includes('1HZ')?2:4) : '--'}</Text>
            <MiniLineChart data={arr.slice(-40)} color={SYM_COLORS[sym]} height={40}/>
          </View>
        );
      })}
    </View>
  </Card>
));

// Main screen — receives pre-computed conf, no heavy math here
export default function DashboardScreen({ state }) {
  const { conf, prices, digits, lastTick, prevTick, balance, trades = [], connected, connStatus } = state;

  const session = useMemo(() => {
    const h = (state.utcH || new Date().getUTCHours());
    if (h>=8&&h<12)  return {name:'Morning',   bots:'#1,#3,#7', color:C.ye};
    if (h>=12&&h<18) return {name:'Afternoon', bots:'#2,#4,#7', color:C.ac};
    if (h>=16&&h<18) return {name:'Evening',   bots:'#5,#6',    color:C.or};
    return               {name:'Off-Hours',  bots:'--',        color:C.tx3};
  }, [state.utcH]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Connection status */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, {backgroundColor: connected ? C.gr : C.re}]}/>
        <Text style={styles.statusTxt}>{connStatus}</Text>
        <Text style={[styles.sessionBadge, {color: session.color}]}>{session.name} · {session.bots}</Text>
      </View>

      <StatsRow     balance={balance} trades={trades}/>
      <ConfluencePanel conf={conf} session={session}/>
      <DigitPanel   digits={digits}/>
      <MiniChartsGrid prices={prices} lastTick={lastTick} prevTick={prevTick}/>

      <View style={{height:20}}/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:       {flex:1, backgroundColor:C.bg},
  content:      {padding:12},
  statusBar:    {flexDirection:'row', alignItems:'center', gap:8, marginBottom:12,
                 backgroundColor:C.sf, borderRadius:8, padding:10, borderWidth:1, borderColor:C.bd},
  dot:          {width:8, height:8, borderRadius:4},
  statusTxt:    {fontSize:10, color:C.tx2, fontFamily:'monospace', flex:1},
  sessionBadge: {fontSize:10, fontFamily:'monospace', fontWeight:'700'},
  statRow:      {flexDirection:'row', gap:8, marginBottom:10},
  confRow:      {flexDirection:'row', gap:14, alignItems:'center', marginBottom:12},
  confRight:    {flex:1},
  confLabel:    {fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:3},
  confDir:      {fontSize:26, fontWeight:'800', marginBottom:2},
  confBot:      {fontSize:10, color:C.tx3},
  deadZone:     {color:C.re, fontWeight:'800', fontSize:11, fontFamily:'monospace', marginTop:4},
  indGrid:      {flexDirection:'row', flexWrap:'wrap', gap:6},
  indCell:      {backgroundColor:C.sf2, borderRadius:7, borderWidth:1, borderColor:C.bd, padding:8, minWidth:90},
  indLabel:     {fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.5, marginBottom:3},
  indVal:       {fontSize:14, fontWeight:'800'},
  noData:       {color:C.tx3, fontFamily:'monospace', textAlign:'center', padding:20},
  digitStats:   {flexDirection:'row', gap:6, marginTop:10},
  digitStat:    {flex:1, backgroundColor:C.sf2, borderRadius:7, padding:8, alignItems:'center'},
  dsLabel:      {fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.5, marginBottom:3},
  dsVal:        {fontSize:16, fontWeight:'800'},
  chartGrid:    {flexDirection:'row', flexWrap:'wrap', gap:8},
  miniChartCell:{width:'47%', backgroundColor:C.sf2, borderRadius:8, padding:8, borderWidth:1, borderColor:C.bd},
  miniChartHeader:{flexDirection:'row', justifyContent:'space-between', marginBottom:2},
  miniSym:      {fontSize:10, fontWeight:'700', fontFamily:'monospace'},
  miniChg:      {fontSize:9, fontFamily:'monospace'},
  miniPrice:    {fontSize:13, fontWeight:'700', color:C.tx, marginBottom:4},
});
