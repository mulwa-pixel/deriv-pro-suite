import React, { useMemo, memo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { C, SYM_COLORS } from '../theme';
import { calcStreaks, calcDigitDom } from '../indicators';
import StatCard     from '../components/StatCard';
import Card         from '../components/Card';
import ScoreGauge   from '../components/ScoreGauge';
import DigitStrip   from '../components/DigitStrip';
import MiniLineChart from '../components/MiniLineChart';
import Badge        from '../components/Badge';

// ── Balance / P&L strip ──────────────────────────────────────────────────────
const StatsRow = memo(({ balance, trades }) => {
  const wins = trades.filter(t => t.res === 'WIN').length;
  const pnl  = trades.reduce((a, t) => a + (t.pnl || 0), 0);
  const wr   = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  return (
    <View style={s.statRow}>
      <StatCard label="Balance"  value={balance ? '$'+parseFloat(balance.amount).toFixed(2) : '$--'} color={C.gr}/>
      <StatCard label="P&L"      value={(pnl>=0?'+$':'-$')+Math.abs(pnl).toFixed(2)} color={pnl>=0?C.gr:C.re}/>
      <StatCard label="Win Rate" value={wr+'%'} color={wr>=60?C.gr:wr>=50?C.ye:C.re}/>
    </View>
  );
});

// ── Signal panel ─────────────────────────────────────────────────────────────
const SignalPanel = memo(({ conf, session }) => {
  if (!conf) return (
    <Card title="Live Signal">
      <Text style={s.noData}>Connect API → live candle signals load automatically</Text>
      <Text style={[s.noData, {fontSize:9, marginTop:4}]}>
        RSI is now calculated on real OHLC candles — matches TradingView
      </Text>
    </Card>
  );

  const dead      = conf.r14 >= 40 && conf.r14 <= 60;
  const rsiColor  = conf.r14 < 30 ? C.gr : conf.r14 > 70 ? C.re : dead ? '#505060' : C.ye;
  const dirColor  = conf.direction
    ? (conf.direction.includes('RISE')||conf.direction.includes('EVEN')||conf.direction.includes('OVER') ? C.gr : C.re)
    : C.tx3;

  // Multi-confirm display
  const riseScore = conf.riseScore || 0;
  const fallScore = conf.fallScore || 0;

  return (
    <Card title="Live Signal (candle-based RSI)">
      {/* Dead zone banner */}
      {dead && (
        <View style={s.deadBanner}>
          <Text style={s.deadTxt}>⛔  RSI DEAD ZONE {conf.r14?.toFixed(0)} — NO DIRECTIONAL EDGE</Text>
        </View>
      )}

      {/* Warnings */}
      {(conf.warnings||[]).map((w,i) => (
        <View key={i} style={s.warnRow}>
          <Text style={s.warnTxt}>⚠ {w}</Text>
        </View>
      ))}

      {/* Direction + score */}
      <View style={s.sigMain}>
        <ScoreGauge score={conf.score}/>
        <View style={{flex:1}}>
          <Text style={s.sigLabel}>SIGNAL</Text>
          <Text style={[s.sigDir, {color: dirColor}]}>{conf.direction || 'WAIT'}</Text>
          {conf.bot ? <Text style={s.sigBot}>{conf.bot}</Text> : null}
          <View style={{flexDirection:'row', gap:6, marginTop:4}}>
            <Badge label={conf.regime} variant={conf.regime==='BULLISH'?'bull':conf.regime==='BEARISH'?'bear':'warn'}/>
            {conf.candleCount > 0 && (
              <Badge label={`${conf.candleCount} candles`} variant="info"/>
            )}
          </View>
        </View>
      </View>

      {/* Confirm meter for Rise/Fall */}
      {(riseScore > 0 || fallScore > 0) && (
        <View style={s.confirmMeter}>
          <Text style={s.cLabel}>RISE confirms</Text>
          <View style={s.cBar}>
            {[...Array(4)].map((_,i) => (
              <View key={i} style={[s.cDot, {backgroundColor: i < riseScore ? C.gr : C.sf2}]}/>
            ))}
          </View>
          <Text style={s.cLabel}>FALL confirms</Text>
          <View style={s.cBar}>
            {[...Array(4)].map((_,i) => (
              <View key={i} style={[s.cDot, {backgroundColor: i < fallScore ? C.re : C.sf2}]}/>
            ))}
          </View>
          <Text style={[s.cNote, {color: riseScore>=2||fallScore>=2 ? C.gr : C.tx3}]}>
            {riseScore>=2||fallScore>=2 ? '✓ Multi-confirm' : 'Need ≥2 for signal'}
          </Text>
        </View>
      )}

      {/* Indicator grid */}
      <View style={s.indGrid}>
        {[
          { l:'RSI(14)\nCandle', v:conf.r14?.toFixed(1)??'—',
            c:rsiColor,
            ctx: dead ? 'Dead zone' : conf.r14<30 ? 'Oversold' : conf.r14>70 ? 'Overbought' : 'Mid-range' },
          { l:'RSI(7)\nCandle',  v:conf.r4?.toFixed(1)??'—',
            c: conf.r4<33?C.gr:conf.r4>67?C.re:C.tx2,
            ctx: conf.r4<33?'RISE trigger':conf.r4>67?'FALL trigger':'Neutral' },
          { l:'MACD',  v: conf.macd ? (conf.macd.bullish?'▲ Bull':'▼ Bear') : '—',
            c: conf.macd?.bullish?C.gr:conf.macd?.bearish?C.re:C.tx2,
            ctx: conf.macd ? (conf.macd.hist>=0?'+':'')+conf.macd.hist.toFixed(4) : 'Building...' },
          { l:'Stoch', v: conf.stoch ? conf.stoch.k.toFixed(0) : '—',
            c: conf.stoch?.oversold?C.gr:conf.stoch?.overbought?C.re:C.tx2,
            ctx: conf.stoch?.oversold?'Oversold':conf.stoch?.overbought?'Overbought':'Neutral' },
          { l:'EMA\nTrend', v: conf.e5&&conf.e10?(conf.e5>conf.e10?'▲':'▼'):'—',
            c: conf.e5&&conf.e10?(conf.e5>conf.e10?C.gr:C.re):C.tx2,
            ctx: conf.e5&&conf.e10?
              (conf.e5>conf.e10&&conf.e10>conf.e20?'Bull stack':conf.e5<conf.e10&&conf.e10<conf.e20?'Bear stack':'Mixed'):'—' },
          { l:'BB', v: conf.bb ? (conf.bb.width<0.05?'SQUEEZE':'Normal'):'—',
            c: conf.bb?.width<0.05?C.ac:C.tx2,
            ctx: conf.bb ? `W=${conf.bb.width.toFixed(4)}` : 'Building...' },
          { l:'ATR\nVolatility', v: conf.atr ? conf.atr.toFixed(4) : '—',
            c: conf.atr>0.3?C.re:conf.atr>0.1?C.ye:C.gr,
            ctx: conf.atr ? (conf.atr>0.3?'High vol':conf.atr>0.1?'Medium':'Low') : '—' },
          { l:'Session', v: session.name,
            c: session.color,
            ctx: session.bots },
        ].map(r => (
          <View key={r.l} style={s.indCell}>
            <Text style={s.indLabel}>{r.l}</Text>
            <Text style={[s.indVal, {color:r.c}]}>{r.v}</Text>
            <Text style={[s.indCtx, {color:r.c}]}>{r.ctx}</Text>
          </View>
        ))}
      </View>

      {/* Factors checklist */}
      <Text style={[s.indLabel, {marginTop:8, marginBottom:4}]}>CONFLUENCE CHECKLIST</Text>
      <View style={{flexDirection:'row', flexWrap:'wrap', gap:5}}>
        {(conf.factors||[]).map((f,i) => (
          <View key={i} style={[s.chip, {
            borderColor: f.ok ? 'rgba(6,214,160,.3)' : 'rgba(230,57,70,.25)',
            backgroundColor: f.ok ? 'rgba(6,214,160,.07)' : 'rgba(230,57,70,.05)',
          }]}>
            <Text style={{color:f.ok?C.gr:C.re, fontSize:8, fontWeight:'800'}}>{f.ok?'✓':'✗'}</Text>
            <Text style={{color:C.tx2, fontSize:8, fontFamily:'monospace', marginLeft:3}}>{f.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
});

// ── Digit panel ───────────────────────────────────────────────────────────────
const DigitPanel = memo(({ digits, dPct }) => {
  const streaks = useMemo(() => calcStreaks(digits), [digits.length]);
  const dom     = useMemo(() => calcDigitDom(digits), [digits.length]);

  return (
    <Card title="Digit Analysis">
      <DigitStrip digits={digits.slice(-20)}/>
      <View style={s.digitStats}>
        <View style={s.dStat}>
          <Text style={s.dsLabel}>Even streak</Text>
          <Text style={[s.dsVal,{color:C.ye}]}>{streaks.even}</Text>
        </View>
        <View style={s.dStat}>
          <Text style={s.dsLabel}>Odd streak</Text>
          <Text style={[s.dsVal,{color:C.pu2}]}>{streaks.odd}</Text>
        </View>
        <View style={s.dStat}>
          <Text style={s.dsLabel}>High 5-9</Text>
          <Text style={[s.dsVal,{color:C.gr}]}>{dom.high}%</Text>
        </View>
        <View style={s.dStat}>
          <Text style={s.dsLabel}>Low 0-4</Text>
          <Text style={[s.dsVal,{color:C.ac}]}>{dom.low}%</Text>
        </View>
      </View>
      {/* DollarPrinter digit ≥12% alerts */}
      {dPct && (
        <View style={{flexDirection:'row', flexWrap:'wrap', gap:5, marginTop:8}}>
          {dPct.map((pct, d) => pct >= 12 ? (
            <View key={d} style={[s.dpChip, {
              backgroundColor: d===4?'rgba(255,215,64,.15)':d===5?'rgba(181,110,212,.15)':d===6?'rgba(247,127,0,.15)':'rgba(17,138,178,.15)',
              borderColor:     d===4?C.ye:d===5?C.pu2:d===6?C.or:C.bl,
            }]}>
              <Text style={{color:d===4?C.ye:d===5?C.pu2:d===6?C.or:C.bl, fontWeight:'800', fontSize:13}}>{d}</Text>
              <Text style={{color:C.tx3, fontSize:9, fontFamily:'monospace'}}> {pct}%</Text>
              <Text style={{color:C.tx3, fontSize:8}}>
                {d===4?'→EVEN':d===5?'→ODD':d===6?'→OVER3':'→signal'}
              </Text>
            </View>
          ) : null)}
          {dPct.every(p => p < 12) && (
            <Text style={{color:C.tx3, fontSize:10, fontFamily:'monospace'}}>
              No digit ≥12% — no DP signal yet
            </Text>
          )}
        </View>
      )}
    </Card>
  );
});

// ── Mini market grid ──────────────────────────────────────────────────────────
const MiniChartsGrid = memo(({ prices, lastTick, prevTick }) => (
  <Card title="Markets">
    <View style={s.chartGrid}>
      {['R_75','R_100','R_25','R_50','R_10','1HZ100V'].map(sym => {
        const arr  = prices[sym] || [];
        const last = lastTick[sym] || 0;
        const prev = prevTick[sym] || 0;
        const chg  = last - prev;
        return (
          <View key={sym} style={s.mCell}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:2}}>
              <Text style={[s.mSym, {color:SYM_COLORS[sym]}]}>
                {sym.replace('R_','V').replace('1HZ100V','1HZ')}
              </Text>
              <Text style={{color:chg>=0?C.gr:C.re, fontSize:9, fontFamily:'monospace'}}>
                {chg>=0?'+':''}{chg.toFixed(2)}
              </Text>
            </View>
            <Text style={s.mPrice}>{last ? last.toFixed(sym.includes('HZ')?2:4) : '--'}</Text>
            <MiniLineChart data={arr.slice(-40)} color={SYM_COLORS[sym]} height={40}/>
            <Text style={{color:C.tx3, fontSize:7, fontFamily:'monospace', marginTop:2}}>
              {arr.length} ticks
            </Text>
          </View>
        );
      })}
    </View>
  </Card>
));

// ── Main export ───────────────────────────────────────────────────────────────
export default function DashboardScreen({ state }) {
  const { conf, prices, digits, lastTick, prevTick, balance, trades=[], connected, connStatus } = state;
  const utcH = state.utcH || new Date().getUTCHours();

  const session = useMemo(() => {
    if (utcH>=8&&utcH<12)  return {name:'Morning',   bots:'#1,#3,#7', color:C.ye};
    if (utcH>=12&&utcH<16) return {name:'Afternoon', bots:'#2,#4,#7', color:C.ac};
    if (utcH>=16&&utcH<18) return {name:'Evening',   bots:'#5,#6',    color:C.or};
    return                        {name:'Off-Hours',  bots:'—',        color:C.tx3};
  }, [utcH]);

  return (
    <ScrollView style={{flex:1,backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      {/* Status bar */}
      <View style={s.statusBar}>
        <View style={[s.dot,{backgroundColor:connected?C.gr:C.re}]}/>
        <Text style={s.statusTxt}>{connStatus}</Text>
        <Text style={[s.sessionTag,{color:session.color}]}>{session.name} · {session.bots}</Text>
        <Text style={{color:C.tx3,fontSize:8,fontFamily:'monospace'}}>{utcH}:00 UTC</Text>
      </View>

      <StatsRow balance={balance} trades={trades}/>
      <SignalPanel conf={conf} session={session}/>
      <DigitPanel digits={digits} dPct={conf?.dPct}/>
      <MiniChartsGrid prices={prices} lastTick={lastTick} prevTick={prevTick}/>

      <View style={{height:20}}/>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  statusBar:   {flexDirection:'row',alignItems:'center',gap:8,marginBottom:12,
                backgroundColor:C.sf,borderRadius:8,padding:10,borderWidth:1,borderColor:C.bd},
  dot:         {width:8,height:8,borderRadius:4},
  statusTxt:   {fontSize:10,color:C.tx2,fontFamily:'monospace',flex:1},
  sessionTag:  {fontSize:10,fontFamily:'monospace',fontWeight:'700'},
  statRow:     {flexDirection:'row',gap:8,marginBottom:10},
  deadBanner:  {backgroundColor:'rgba(230,57,70,.12)',borderWidth:1,borderColor:'rgba(230,57,70,.4)',
                borderRadius:7,padding:9,marginBottom:10,alignItems:'center'},
  deadTxt:     {color:C.re,fontWeight:'800',fontSize:11,fontFamily:'monospace'},
  warnRow:     {backgroundColor:'rgba(255,215,64,.07)',borderWidth:1,borderColor:'rgba(255,215,64,.2)',
                borderRadius:6,padding:7,marginBottom:6},
  warnTxt:     {color:C.ye,fontSize:10},
  sigMain:     {flexDirection:'row',gap:14,alignItems:'center',marginBottom:12},
  sigLabel:    {fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:2},
  sigDir:      {fontSize:28,fontWeight:'800',marginBottom:2},
  sigBot:      {fontSize:10,color:C.tx3},
  confirmMeter:{backgroundColor:C.sf2,borderRadius:8,padding:10,marginBottom:10,
                flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  cLabel:      {fontSize:9,color:C.tx3,fontFamily:'monospace'},
  cBar:        {flexDirection:'row',gap:4},
  cDot:        {width:18,height:8,borderRadius:4},
  cNote:       {fontSize:9,fontFamily:'monospace',fontWeight:'700'},
  indGrid:     {flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:6},
  indCell:     {backgroundColor:C.sf2,borderRadius:7,borderWidth:1,borderColor:C.bd,
                padding:8,minWidth:88},
  indLabel:    {fontSize:7,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                letterSpacing:0.5,marginBottom:2},
  indVal:      {fontSize:14,fontWeight:'800',marginBottom:1},
  indCtx:      {fontSize:8,fontFamily:'monospace'},
  chip:        {flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:5,
                paddingHorizontal:6,paddingVertical:3},
  noData:      {color:C.tx3,fontFamily:'monospace',textAlign:'center',padding:16,fontSize:11},
  digitStats:  {flexDirection:'row',gap:6,marginTop:10},
  dStat:       {flex:1,backgroundColor:C.sf2,borderRadius:7,padding:8,alignItems:'center'},
  dsLabel:     {fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                letterSpacing:0.5,marginBottom:3},
  dsVal:       {fontSize:16,fontWeight:'800'},
  dpChip:      {flexDirection:'row',alignItems:'center',borderWidth:1,borderRadius:7,
                paddingHorizontal:8,paddingVertical:5,gap:2},
  chartGrid:   {flexDirection:'row',flexWrap:'wrap',gap:8},
  mCell:       {width:'47%',backgroundColor:C.sf2,borderRadius:8,padding:8,
                borderWidth:1,borderColor:C.bd},
  mSym:        {fontSize:10,fontWeight:'700',fontFamily:'monospace'},
  mPrice:      {fontSize:13,fontWeight:'700',color:C.tx,marginBottom:4},
});
