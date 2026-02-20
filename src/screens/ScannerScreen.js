import React, { useMemo, useState, memo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { C } from '../theme';
import { calcRSI, calcEMA, calcDigitDom, calcStreaks } from '../indicators';

const BOTS = [
  {id:1,name:'Even/Odd Streak',    color:C.ac,  checks:[
    (s)=>s.h>=8&&s.h<20,
    (s)=>s.esc>=4||s.osc>=4,
    (s)=>s.r14!==null&&!(s.r14>=40&&s.r14<=60),
  ], labels:['Time 08-20 UTC','4+ streak','RSI outside dead zone']},
  {id:2,name:'Over/Under Hunter',  color:C.ye,  checks:[
    (s)=>s.h>=9&&s.h<15,
    (s)=>s.r14!==null&&!(s.r14>=40&&s.r14<=60),
    (s)=>s.dom>=60,
  ], labels:['Time 09-15 UTC','RSI clear','Digit dom ≥60%']},
  {id:3,name:'Berlin X9 RSI',      color:C.pu2, checks:[
    (s)=>s.h>=9&&s.h<17,
    (s)=>s.r4!==null&&(s.r4<33||s.r4>67),
    (s)=>s.r14!==null&&!(s.r14>=40&&s.r14<=60),
  ], labels:['Time 09-17 UTC','RSI(4)<33 or >67','RSI(14) clear']},
  {id:4,name:'BeastO7 Multi-EMA',  color:C.gr,  checks:[
    (s)=>s.h>=8&&s.h<20,
    (s)=>s.emaSep>=0.02,
    (s)=>s.r14!==null&&!(s.r14>=40&&s.r14<=60),
  ], labels:['Time 08-20 UTC','EMA sep ≥0.02','RSI clear']},
  {id:5,name:'Gas Hunter Dom',     color:C.or,  checks:[
    (s)=>s.h>=7&&s.h<19,
    (s)=>s.dom>=60,
    (s)=>s.r14!==null&&(s.r14>55||s.r14<45),
  ], labels:['Time 07-19 UTC','Digit dom ≥60%','RSI aligned']},
  {id:6,name:'Hawk Under5',        color:C.bl,  checks:[
    (s)=>s.h>=8&&s.h<18,
    (s)=>s.dom>=60&&!s.highLeads,
    (s)=>s.r14!==null&&s.r14<42,
  ], labels:['Time 08-18 UTC','Low digit dom ≥60%','RSI(14)<42']},
  {id:7,name:'Even Streak Sniper', color:C.pu2, checks:[
    (s)=>s.h>=5&&s.h<18,
    (s)=>s.esc>=4,
    (s)=>s.r14!==null&&s.r14<48,
  ], labels:['Time 05-18 UTC','Even streak ≥4','RSI(14)<48']},
];

const BotCard = memo(({ bot, sig }) => {
  const [open, setOpen] = useState(false);
  const pct = sig.total > 0 ? Math.round((sig.met / sig.total) * 100) : 0;
  const color = pct >= 80 ? C.gr : pct >= 60 ? C.ye : pct >= 40 ? C.or : C.re;
  const word  = pct >= 80 ? 'TRADE' : pct >= 60 ? 'WATCH' : pct >= 40 ? 'PARTIAL' : 'WAIT';
  return (
    <TouchableOpacity onPress={() => setOpen(o => !o)}
      style={[styles.card, {borderLeftColor: bot.color}]}>
      <View style={styles.cardHead}>
        <Text style={styles.botName}>Bot #{bot.id}: {bot.name}</Text>
        <View style={styles.cardRight}>
          <Text style={[styles.signal, {color}]}>{word}</Text>
          <Text style={styles.frac}>{sig.met}/{sig.total}</Text>
        </View>
      </View>
      <View style={styles.barBg}><View style={[styles.barFill,{width:pct+'%',backgroundColor:color}]}/></View>
      {open && (
        <View style={styles.checks}>
          {bot.labels.map((l, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={{color: sig.results[i] ? C.gr : C.re, fontSize:13, marginRight:8}}>
                {sig.results[i] ? '✓' : '✗'}
              </Text>
              <Text style={styles.checkTxt}>{l}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function ScannerScreen({ state }) {
  // Receive pre-computed conf — only do lightweight extra calcs needed for scanner
  const { conf, prices, digits } = state;
  const h = new Date().getUTCHours();

  // Build scanner signal object — cheap lookups only
  const scanData = useMemo(() => {
    const p   = prices['R_75'] || [];
    const r14 = conf?.r14 ?? null;
    const r4  = conf?.r4  ?? null;
    const e5  = conf?.e5  ?? null;
    const e10 = conf?.e10 ?? null;
    const emaSep = (e5 && e10) ? Math.abs(e5 - e10) : 0;
    const domData = calcDigitDom(digits);
    const streaks = calcStreaks(digits);
    return {
      h, r14, r4, emaSep,
      dom: domData.dom, highLeads: domData.highLeads,
      esc: streaks.even, osc: streaks.odd,
    };
  }, [conf?.r14, conf?.r4, conf?.e5, conf?.e10, digits.length, h]);

  const signals = useMemo(() => BOTS.map(bot => {
    const results = bot.checks.map(fn => { try { return fn(scanData); } catch { return false; } });
    return { met: results.filter(Boolean).length, total: results.length, results };
  }), [scanData]);

  return (
    <View style={{flex:1, backgroundColor:C.bg}}>
      <View style={styles.header}>
        <Text style={styles.title}>Bot Signal Scanner</Text>
        <Text style={styles.hint}>Tap a card to see conditions · Updates every 0.5s</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:10}}>
        {BOTS.map((bot, i) => (
          <BotCard key={bot.id} bot={bot} sig={signals[i]}/>
        ))}
        <View style={{height:20}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:    {padding:12, backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd},
  title:     {fontSize:16, fontWeight:'800', color:C.tx},
  hint:      {fontSize:10, color:C.tx3, fontFamily:'monospace', marginTop:2},
  card:      {backgroundColor:C.sf, borderRadius:9, borderWidth:1, borderColor:C.bd,
              borderLeftWidth:3, padding:12, marginBottom:8},
  cardHead:  {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6},
  botName:   {fontSize:12, fontWeight:'700', color:C.tx, flex:1},
  cardRight: {alignItems:'flex-end'},
  signal:    {fontSize:16, fontWeight:'800'},
  frac:      {fontSize:9, color:C.tx3, fontFamily:'monospace'},
  barBg:     {height:4, backgroundColor:C.sf2, borderRadius:2, overflow:'hidden', marginBottom:2},
  barFill:   {height:'100%', borderRadius:2},
  checks:    {marginTop:8, borderTopWidth:1, borderTopColor:C.bd, paddingTop:8},
  checkRow:  {flexDirection:'row', alignItems:'center', paddingVertical:4},
  checkTxt:  {fontSize:11, color:C.tx2, fontFamily:'monospace', flex:1},
});
