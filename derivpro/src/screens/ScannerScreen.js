import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { C } from '../theme';
import { calcRSI, calcEMA, calcBB, calcStreaks, calcDigitDom } from '../indicators';
import Card from '../components/Card';
import Badge from '../components/Badge';
import SectionHeader from '../components/SectionHeader';

const BOTS = [
  {id:1, name:'Even/Odd Streak', short:'E/O', color:C.ac},
  {id:2, name:'Over/Under Hunter', short:'O/U', color:C.or},
  {id:3, name:'Berlin X9 RSI', short:'X9', color:C.pu2},
  {id:4, name:'BeastO7 Multi-EMA', short:'B07', color:C.gr},
  {id:5, name:'Gas Hunter Dom.', short:'GH', color:C.ye},
  {id:6, name:'Hawk Under5', short:'HU5', color:C.re},
  {id:7, name:'Even Streak Sniper', short:'ESS', color:C.pk},
];

function scanBot(id, prices, digits, utcH) {
  const r14=calcRSI(prices,14), r4=calcRSI(prices,4);
  const e5=calcEMA(prices,5), e10=calcEMA(prices,10), e20=calcEMA(prices,20);
  const bb=calcBB(prices, Math.min(20,prices.length));
  const last=prices[prices.length-1]||0;
  const mom=prices.length>=6?Math.abs(last-prices[prices.length-6]):0;
  const {dom}=calcDigitDom(digits);
  const {even:esc, odd:osc}=calcStreaks(digits);
  const tws=[[8.1,20],[9,15],[9,17],[8,20],[7,19],[8,18],[5,18]];
  const tw=tws[id-1]; const inT=utcH>=tw[0]&&utcH<tw[1];
  const dead=r14!==null&&r14>=40&&r14<=60;
  const checks=[];
  const add=(l,ok,d)=>checks.push({label:l,ok,detail:d});

  add('Time Window', inT, `${tw[0]}-${tw[1]} UTC`);
  if (r14!==null) add('RSI(14) Clear', !dead, `RSI=${r14.toFixed(1)}${dead?' DEAD ZONE':' OK'}`);
  if (id===3&&r4!==null) { const sig=r4<33||r4>67; add('RSI(4) Signal', sig, `RSI4=${r4.toFixed(1)}${sig?(r4<33?' RISE':' FALL'):' neutral'}`); }
  if (id===4&&e5&&e10) { const sep=Math.abs(e5-e10); add('EMA Sep≥0.02', sep>=0.02, `Sep=${sep.toFixed(4)}`); add('Momentum', mom>=0.04, `5T=${mom.toFixed(4)}`); }
  if ([5,6].includes(id)) add('Digit Dom≥60%', dom>=60, `Dom=${dom}%`);
  if (id===6&&r14!==null) add('RSI<42', r14<42, `RSI=${r14.toFixed(1)}`);
  if (id===7&&bb) { add('BB Squeeze', bb.width<0.05, `BW=${bb.width.toFixed(4)}`); add('Even Streak≥5', esc>=5, `Streak=${esc}`); }
  if (id===1) { const sk=esc>=4||osc>=4; add('Streak≥4', sk, sk?(esc>=4?`${esc}E`:`${osc}O`):'None'); }

  const met=checks.filter(c=>c.ok).length;
  const score=Math.round((met/checks.length)*100);
  return {score, checks, met, total:checks.length};
}

export default function ScannerScreen({ state }) {
  const { prices, digits } = state;
  const sym = state.sym || 'R_75';
  const utcH = new Date().getUTCHours();
  const symPrices = prices[sym] || [];
  const [expanded, setExpanded] = useState(null);

  const results = useMemo(()=>
    BOTS.map(b=>({...b, ...scanBot(b.id, symPrices, digits, utcH)})),
    [symPrices.length, digits.length, utcH]
  );

  const r14 = useMemo(()=>calcRSI(symPrices,14), [symPrices.length]);
  const r4  = useMemo(()=>calcRSI(symPrices,4),  [symPrices.length]);

  return (
    <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      <SectionHeader title="Bot Signal Scanner"
        right={<Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace'}}>{sym}</Text>}/>

      {/* RSI Quick Read */}
      <Card title="RSI Quick Read">
        <View style={{flexDirection:'row', gap:10}}>
          <View style={{flex:1, backgroundColor:C.sf2, borderRadius:8, padding:12, borderWidth:1,
            borderColor: r14>70?'rgba(255,23,68,.4)':r14<30?'rgba(0,230,118,.4)':r14>=40&&r14<=60?'rgba(255,109,0,.3)':'rgba(255,215,64,.2)'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>RSI (14)</Text>
            <Text style={{fontSize:32, fontWeight:'800', color: r14>70?C.re:r14<30?C.gr:r14>=40&&r14<=60?C.or:C.ye}}>
              {r14?.toFixed(1)??'--'}
            </Text>
            <Text style={{fontSize:10, color:C.tx2, marginTop:2}}>
              {r14>70?'OVERBOUGHT — Fall bots':r14<30?'OVERSOLD — Rise bots':r14>=40&&r14<=60?'DEAD ZONE — Avoid ALL':'Neutral zone'}
            </Text>
          </View>
          <View style={{flex:1, backgroundColor:C.sf2, borderRadius:8, padding:12, borderWidth:1,
            borderColor: r4<33?'rgba(0,230,118,.4)':r4>67?'rgba(255,23,68,.4)':'rgba(255,215,64,.2)'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>RSI (4) — Berlin X9</Text>
            <Text style={{fontSize:32, fontWeight:'800', color: r4<33?C.gr:r4>67?C.re:C.ye}}>
              {r4?.toFixed(1)??'--'}
            </Text>
            <Text style={{fontSize:10, color:C.tx2, marginTop:2}}>
              {r4<33?'< 33 → RISE trade':r4>67?'> 67 → FALL trade':'Neutral — no signal'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Bot Scan Results */}
      <SectionHeader title="All Bots"/>
      {results.map(b => {
        const col = b.score>=80?C.gr:b.score>=60?C.ye:b.score>=40?C.or:C.re;
        const word = b.score>=80?'TRADE':b.score>=60?'WATCH':b.score>=40?'PARTIAL':'WAIT';
        const isExp = expanded===b.id;
        return (
          <TouchableOpacity key={b.id} onPress={()=>setExpanded(isExp?null:b.id)}
            style={{backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:isExp?col:C.bd, marginBottom:8, overflow:'hidden'}}>
            <View style={{flexDirection:'row', alignItems:'center', padding:12}}>
              <View style={[{width:3, height:40, borderRadius:2, marginRight:12}, {backgroundColor:b.color}]}/>
              <View style={{flex:1}}>
                <Text style={{fontSize:13, fontWeight:'700', color:C.tx, marginBottom:2}}>Bot#{b.id} · {b.name}</Text>
                <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                  <View style={{flex:1, height:5, backgroundColor:C.sf2, borderRadius:3, overflow:'hidden'}}>
                    <View style={{width:b.score+'%', height:'100%', backgroundColor:col, borderRadius:3}}/>
                  </View>
                  <Text style={{fontSize:9, color:C.tx3, fontFamily:'monospace'}}>{b.met}/{b.total}</Text>
                </View>
              </View>
              <View style={{alignItems:'center', marginLeft:12}}>
                <Text style={{fontSize:16, fontWeight:'800', color:col}}>{word}</Text>
                <Text style={{fontSize:10, color:C.tx3}}>{b.score}%</Text>
              </View>
            </View>
            {isExp ? (
              <View style={{borderTopWidth:1, borderTopColor:C.bd, padding:12}}>
                {b.checks.map((c,i)=>(
                  <View key={i} style={{flexDirection:'row', alignItems:'center', gap:8, marginBottom:5}}>
                    <Text style={{fontSize:14, color:c.ok?C.gr:C.re}}>{c.ok?'✓':'✗'}</Text>
                    <Text style={{fontSize:11, color:C.tx3, flex:1, fontFamily:'monospace'}}>{c.label}</Text>
                    <Text style={{fontSize:10, color:c.ok?C.gr:C.re, fontFamily:'monospace'}}>{c.detail}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}