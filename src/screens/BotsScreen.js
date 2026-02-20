import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { C } from '../theme';
import Card from '../components/Card';

const BOTS = [
  {id:1, name:'Even/Odd Streak Reversal', color:C.ac, market:'V75/V100 (1s)', contract:'Even/Odd',
   specs:[['Duration','10 ticks'],['Stake','R10 base'],['Window','08:06-20:00 UTC']],
   conds:[
     {l:'Streak Count', t:'4-5 consecutive same parity digits'},
     {l:'RSI Filter',   t:'RSI(14) NOT in 40-60 dead zone'},
     {l:'Bet Opposite', t:'5 evens in a row → BET ODD (and vice versa)'},
     {l:'Time Window',  t:'08:06 - 20:00 UTC only'},
     {l:'No Flat Market',t:'Market must be moving'},
   ],
   dnt:['News events','Spread ≥ 0.5','RSI dead zone 40-60','Flat/choppy market']},
  {id:2, name:'Over/Under Digit Hunter', color:C.or, market:'V75 (1s)', contract:'Over/Under',
   specs:[['Duration','20 ticks'],['Stake','1-5% balance'],['Window','09:00-15:00 UTC']],
   conds:[
     {l:'BULL Signal',  t:'Green candle body ≥ 11% (strong bullish)'},
     {l:'High Digit',   t:'Last digit in [5,6,7,8,9] for OVER 5'},
     {l:'BEAR Signal',  t:'Red candle body ≥ 4-6% (strong bearish)'},
     {l:'Low Digit',    t:'Last digit in [0,1,2,3,4] for UNDER 5'},
     {l:'Time Window',  t:'09:00-15:00 UTC'},
   ],
   dnt:['Candle body < 4%','Outside optimal hours'],
   perf:[['V75 Bull','74%'],['V75 Bear','71%'],['V50 Bull','89%'],['V50 Bear','87%']]},
  {id:3, name:'Berlin X9 RSI Momentum', color:C.pu2, market:'V75/V50/V100 (1s)', contract:'Rise/Fall',
   specs:[['Duration','5 ticks'],['Stake','2% balance'],['Window','09:00-17:00 UTC']],
   conds:[
     {l:'RSI(4) < 33',  t:'RISE — oversold, bounce expected'},
     {l:'RSI(4) > 67',  t:'FALL — overbought, pullback expected'},
     {l:'EMA RISE',     t:'EMA5 must be BELOW EMA10'},
     {l:'EMA FALL',     t:'EMA5 must be ABOVE EMA10'},
     {l:'Momentum ≥0.02', t:'3T price change confirming direction'},
     {l:'Time Window',  t:'09:00-17:00 UTC strictly'},
   ],
   dnt:['RSI(4) in 33-67','Outside 09:00-17:00 UTC','No momentum']},
  {id:4, name:'BeastO7 Multi-EMA', color:C.gr, market:'V10/V25 (1s)', contract:'Rise/Fall',
   specs:[['Primary','V10 (1s)'],['Duration','5 ticks'],['Stake','1% balance'],['Window','08:00-20:00 UTC']],
   conds:[
     {l:'RSI Zone Break', t:'RSI(14) < 38 OR > 62'},
     {l:'EMA Separated',  t:'EMA 5,10,20 separated. Sep ≥ 0.02'},
     {l:'RISE config',    t:'EMA5 > EMA10 > EMA20'},
     {l:'FALL config',    t:'EMA5 < EMA10 < EMA20'},
     {l:'No Spikes',      t:'Max tick jump < 0.5 in last 10T'},
     {l:'Momentum',       t:'5T change ≥ 0.04'},
   ],
   dnt:['EMA sep < 0.02','RSI dead zone','Spikes detected'],
   perf:[['Sep>0.05','82%'],['Sep 0.03-0.05','76%'],['Sep 0.02-0.03','68%'],['Sep<0.02','Skip']]},
  {id:5, name:'Gas Hunter Dominance', color:C.ye, market:'V10 (1s)', contract:'Over/Under',
   specs:[['Primary','V10 (1s)'],['Stake','1% balance'],['Window','07:00-19:00 UTC']],
   conds:[
     {l:'Digit Dom.',    t:'Last 20T: HIGH (5-9) > 60% = OVER, LOW (0-4) > 60% = UNDER'},
     {l:'RSI for OVER',  t:'RSI(14) > 55'},
     {l:'RSI for UNDER', t:'RSI(14) < 45'},
     {l:'Movement',      t:'Last 3T change ≥ 0.01'},
     {l:'Time Window',   t:'07:00-19:00 UTC'},
   ],
   dnt:['Dom < 60%','RSI 45-55 dead zone'],
   perf:[['≥75% dom','84%'],['65-75%','78%'],['60-65%','71%']]},
  {id:6, name:'Hawk Under5 Sniper', color:C.re, market:'V25 (1s)', contract:'Under 5',
   specs:[['Primary','V25 (1s)'],['Duration','3 ticks'],['Stake','1% balance'],['Window','08:00-18:00 UTC']],
   conds:[
     {l:'Low Digit Dom.', t:'Last 10T: ≥ 40% digits 0-4'},
     {l:'RSI < 42',       t:'Avoids fakeout rallies'},
     {l:'Movement',       t:'5T change ≥ 0.02'},
     {l:'Lower BB',       t:'Price near/touching lower Bollinger Band'},
     {l:'Volatility',     t:'10T range ≥ 0.03'},
     {l:'Time Window',    t:'08:00-18:00 UTC'},
   ],
   dnt:['RSI ≥ 42','Outside 08:00-18:00','Price far from lower BB']},
  {id:7, name:'Even Streak Sniper', color:C.pk, market:'V10/V25 (1s)', contract:'Even',
   specs:[['Primary','V10 (1s)'],['Duration','3 ticks'],['Stake','1.5% balance'],['Window','05:00-18:00 UTC']],
   conds:[
     {l:'Even Streak',    t:'Last 20T: ALL EVEN digits (perfect streak)'},
     {l:'Historical Bias',t:'Last 100T: Even > 50%'},
     {l:'RSI < 48',       t:'Not overbought territory'},
     {l:'BB Squeeze',     t:'BB width < 0.05 (squeeze state)'},
     {l:'Time Window',    t:'05:00-18:00 UTC'},
   ],
   dnt:['RSI ≥ 48','Outside 05:00-18:00','No even streak','BB not squeezed']},
];

export default function BotsScreen() {
  const [selected, setSelected] = useState(null);
  const [checks, setChecks] = useState({});

  const bot = BOTS.find(b=>b.id===selected);

  const toggle = (i) => {
    setChecks(c=>({...c, [i]: c[i]==='ok'?'fail':c[i]==='fail'?null:'ok'}));
  };

  const met = Object.values(checks).filter(v=>v==='ok').length;
  const failed = Object.values(checks).filter(v=>v==='fail').length;
  const total = bot ? bot.conds.length : 0;
  const pct = total>0?Math.round((met/total)*100):0;
  const signalWord = failed>0?'BLOCKED':pct>=100?'TRADE NOW':pct>=80?'STRONG':pct>=60?'LIKELY':pct>=40?'PARTIAL':'WAIT';
  const signalCol  = failed>0?C.re:pct>=100?C.gr:pct>=80?'#a3e635':pct>=60?C.ye:pct>=40?C.or:C.tx3;

  if (selected && bot) {
    return (
      <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
        <TouchableOpacity onPress={()=>{setSelected(null);setChecks({});}}
          style={{flexDirection:'row', alignItems:'center', gap:8, marginBottom:12}}>
          <Text style={{color:C.ac, fontSize:20}}>←</Text>
          <Text style={{color:C.ac, fontSize:13, fontFamily:'monospace'}}>All Bots</Text>
        </TouchableOpacity>

        <Text style={{fontSize:18, fontWeight:'800', color:C.tx, marginBottom:2}}>Bot #{bot.id}: {bot.name}</Text>
        <Text style={{fontSize:11, color:C.tx3, marginBottom:14, fontFamily:'monospace'}}>{bot.market} · {bot.contract}</Text>

        {/* Signal Meter */}
        <View style={{backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, padding:16, alignItems:'center', marginBottom:10}}>
          <Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:8}}>Signal Strength</Text>
          <Text style={{fontSize:36, fontWeight:'800', color:signalCol, marginBottom:8}}>{signalWord}</Text>
          <View style={{width:'100%', height:6, backgroundColor:C.sf2, borderRadius:3, overflow:'hidden', marginBottom:6}}>
            <View style={{width:pct+'%', height:'100%', backgroundColor:signalCol, borderRadius:3}}/>
          </View>
          <Text style={{fontSize:10, color:C.tx3, fontFamily:'monospace'}}>{met}/{total} conditions met</Text>
          <TouchableOpacity onPress={()=>setChecks({})} style={{marginTop:8, paddingHorizontal:12, paddingVertical:4, borderRadius:5, borderWidth:1, borderColor:C.bd3}}>
            <Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace'}}>RESET</Text>
          </TouchableOpacity>
        </View>

        {/* Conditions Checklist */}
        <Card title="Entry Conditions — Tap to Check">
          {bot.conds.map((c,i)=>{
            const st=checks[i];
            return (
              <TouchableOpacity key={i} onPress={()=>toggle(i)}
                style={{flexDirection:'row', gap:10, alignItems:'flex-start', paddingVertical:9, borderBottomWidth:i<bot.conds.length-1?1:0, borderBottomColor:C.bd}}>
                <View style={{width:22, height:22, borderRadius:5, borderWidth:2,
                  borderColor:st==='ok'?C.gr:st==='fail'?C.re:C.bd2,
                  backgroundColor:st==='ok'?C.gr:st==='fail'?C.re:'transparent',
                  justifyContent:'center', alignItems:'center', marginTop:1, flexShrink:0}}>
                  <Text style={{color:st==='ok'?C.bg:st==='fail'?'#fff':'transparent', fontSize:11, fontWeight:'900'}}>
                    {st==='ok'?'✓':st==='fail'?'✗':''}
                  </Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2}}>{c.l}</Text>
                  <Text style={{fontSize:12, color:C.tx, lineHeight:18}}>{c.t}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Specs */}
        <Card title="Specifications">
          {bot.specs.map(([k,v],i)=>(
            <View key={i} style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center',
              backgroundColor:C.sf2, borderRadius:6, borderWidth:1, borderColor:C.bd, padding:10, marginBottom:5}}>
              <Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase'}}>{k}</Text>
              <Text style={{fontSize:12, fontWeight:'600', color:C.tx}}>{v}</Text>
            </View>
          ))}
        </Card>

        {/* DO NOT TRADE */}
        <Card title="DO NOT TRADE — Red Lights">
          {bot.dnt.map((d,i)=>(
            <View key={i} style={{flexDirection:'row', gap:8, alignItems:'center', paddingVertical:7,
              borderBottomWidth:i<bot.dnt.length-1?1:0, borderBottomColor:C.bd}}>
              <Text style={{color:C.re, fontSize:14, fontWeight:'700'}}>✗</Text>
              <Text style={{fontSize:12, color:C.tx, flex:1}}>{d}</Text>
            </View>
          ))}
        </Card>

        {bot.perf ? (
          <Card title="Performance Data">
            {bot.perf.map(([k,v],i)=>(
              <View key={i} style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                backgroundColor:C.sf2, borderRadius:6, borderWidth:1, borderColor:C.bd, padding:10, marginBottom:5}}>
                <Text style={{fontSize:10, color:C.tx3, fontFamily:'monospace'}}>{k}</Text>
                <Text style={{fontSize:13, fontWeight:'700', color:C.gr}}>{v}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{height:20}}/>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      <Text style={{fontSize:16, fontWeight:'800', color:C.tx, marginBottom:14}}>Bot Handbook</Text>
      {BOTS.map(b=>(
        <TouchableOpacity key={b.id} onPress={()=>{setSelected(b.id);setChecks({});}}
          style={{backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
            borderLeftWidth:3, borderLeftColor:b.color, padding:14, marginBottom:8}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <View style={{flex:1}}>
              <Text style={{fontSize:14, fontWeight:'700', color:C.tx, marginBottom:3}}>Bot #{b.id} · {b.name}</Text>
              <Text style={{fontSize:10, color:C.tx3, fontFamily:'monospace'}}>{b.market} · {b.contract}</Text>
            </View>
            <Text style={{color:C.tx3, fontSize:20}}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}