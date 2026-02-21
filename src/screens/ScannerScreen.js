import React, { useMemo, useState, useEffect, useRef, memo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { C } from '../theme';
import { calcDigitDom, calcStreaks } from '../indicators';

// ── Bot definitions — conditions now reference candle-based indicators ────────
const BOTS = [
  { id:1, name:'Even/Odd Streak',   color:C.ac,  contract:'Even/Odd',  market:'V75/V100 (1s)',
    checks:[
      s => s.h>=8&&s.h<20,
      s => s.esc>=4||s.osc>=4,
      s => s.r14!==null&&!(s.r14>=40&&s.r14<=60),
    ],
    labels:['Time 08-20 UTC','4+ same-parity streak','RSI outside 40-60 dead zone'],
    tip:'Bet opposite parity after 4+ consecutive same-parity digits.',
  },
  { id:2, name:'Over/Under Hunter', color:C.ye,  contract:'Over/Under', market:'V75 (1s)',
    checks:[
      s => s.h>=9&&s.h<15,
      s => s.r14!==null&&!(s.r14>=40&&s.r14<=60),
      s => s.dom>=60,
    ],
    labels:['Time 09-15 UTC','RSI clear of dead zone','Digit dominance ≥60%'],
    tip:'Trade Over/Under 5 when one side dominates the last 50 ticks.',
  },
  { id:3, name:'Berlin X9 RSI',     color:C.pu2, contract:'Rise/Fall',  market:'V75/V50/V100',
    checks:[
      s => s.h>=9&&s.h<17,
      s => s.r14!==null&&(s.r14<35||s.r14>65),
      s => s.r14!==null&&!(s.r14>=40&&s.r14<=60),
      s => s.riseScore>=2||s.fallScore>=2,
    ],
    labels:['Time 09-17 UTC','RSI(14) <35 or >65 on candles','RSI clear of dead zone','2+ confirms (RSI+Stoch or RSI+MACD)'],
    tip:'Multi-confirm Rise/Fall. Needs RSI extreme + 1 other indicator agreeing.',
  },
  { id:4, name:'BeastO7 Multi-EMA', color:C.gr,  contract:'Rise/Fall',  market:'V10/V25 (1s)',
    checks:[
      s => s.h>=8&&s.h<20,
      s => s.emaSep>=0.01,
      s => s.emaStacked,
      s => s.r14!==null&&!(s.r14>=40&&s.r14<=60),
    ],
    labels:['Time 08-20 UTC','EMA separation ≥0.01','EMA5/10/20 cleanly stacked','RSI clear of dead zone'],
    tip:'Trade trend direction when all 3 EMAs stack cleanly on candle closes.',
  },
  { id:5, name:'Gas Hunter Dom',    color:C.or,  contract:'Over/Under', market:'V10 (1s)',
    checks:[
      s => s.h>=7&&s.h<19,
      s => s.dom>=65,
      s => s.r14!==null&&(s.r14>55||s.r14<45),
    ],
    labels:['Time 07-19 UTC','Digit dominance ≥65%','RSI confirms direction'],
    tip:'Strong Over/Under play when high or low digits dominate 65%+ of last 50 ticks.',
  },
  { id:6, name:'Hawk Under5',       color:C.bl,  contract:'Under 5',   market:'V25 (1s)',
    checks:[
      s => s.h>=8&&s.h<18,
      s => s.dom>=60&&!s.highLeads,
      s => s.r14!==null&&s.r14<42,
      s => s.bbBelow,
    ],
    labels:['Time 08-18 UTC','Low digit dom ≥60%','RSI(14) <42 on candles','Price at/below lower BB'],
    tip:'Under 5 sniper. Low digits dominating + price oversold near BB lower band.',
  },
  { id:7, name:'DP: Dollar Printer', color:C.ye, contract:'Even/Odd',  market:'V50 (any)',
    checks:[
      s => s.h>=8&&s.h<20,
      s => s.digit4pct>=12||s.digit5pct>=12,
      s => s.dpEvenCount>=2||s.dpOddCount>=2,
    ],
    labels:['Time 08-20 UTC','Digit 4 ≥12% (EVEN) or Digit 5 ≥12% (ODD)','2+ even/odd digits above average'],
    tip:'DollarPrinter method: digit frequency analysis. Digit4≥12%→EVEN, Digit5≥12%→ODD.',
  },
];

// ── Animated signal word ──────────────────────────────────────────────────────
function SignalWord({ word, color }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (word === 'TRADE') {
      Animated.loop(Animated.sequence([
        Animated.timing(op, {toValue:0.4, duration:500, useNativeDriver:true}),
        Animated.timing(op, {toValue:1.0, duration:500, useNativeDriver:true}),
      ])).start();
    } else {
      op.setValue(1);
      op.stopAnimation();
    }
  }, [word]);
  return <Animated.Text style={[styles.signal,{color,opacity:op}]}>{word}</Animated.Text>;
}

// ── Bot card ──────────────────────────────────────────────────────────────────
const BotCard = memo(({ bot, sig }) => {
  const [open, setOpen] = useState(false);
  const pct   = sig.total>0 ? Math.round((sig.met/sig.total)*100) : 0;
  const color = pct>=80?C.gr:pct>=60?C.ye:pct>=40?C.or:C.re;
  const word  = pct>=80?'TRADE':pct>=60?'WATCH':pct>=40?'PARTIAL':'WAIT';

  return (
    <TouchableOpacity onPress={()=>setOpen(o=>!o)}
      style={[styles.card,{borderLeftColor:bot.color}]}>
      <View style={styles.cardHead}>
        <View style={{flex:1}}>
          <Text style={styles.botName}>Bot #{bot.id}: {bot.name}</Text>
          <Text style={styles.botMeta}>{bot.contract} · {bot.market}</Text>
        </View>
        <View style={styles.cardRight}>
          <SignalWord word={word} color={color}/>
          <Text style={styles.frac}>{sig.met}/{sig.total} conditions</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barBg}>
        <View style={[styles.barFill,{width:pct+'%',backgroundColor:color}]}/>
      </View>

      {/* Expanded detail */}
      {open && (
        <View style={styles.expanded}>
          <Text style={styles.tipTxt}>{bot.tip}</Text>
          <View style={{height:1,backgroundColor:C.bd,marginVertical:8}}/>
          {bot.labels.map((l,i)=>(
            <View key={i} style={styles.checkRow}>
              <Text style={{color:sig.results[i]?C.gr:C.re,fontSize:14,width:20,fontWeight:'800'}}>
                {sig.results[i]?'✓':'✗'}
              </Text>
              <Text style={[styles.checkTxt,{color:sig.results[i]?C.tx2:C.tx3}]}>{l}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ signals }) {
  const best = signals.reduce((a,s,i)=>
    (s.met/s.total)>(a.pct/100)?{pct:Math.round(s.met/s.total*100),idx:i}:a,
    {pct:0,idx:-1});
  const tradeable = signals.filter(s=>s.met/s.total>=0.8).length;
  const watchable = signals.filter(s=>s.met/s.total>=0.6).length;
  return (
    <View style={styles.summary}>
      <View style={styles.sumCell}>
        <Text style={[styles.sumVal,{color:tradeable>0?C.gr:C.tx3}]}>{tradeable}</Text>
        <Text style={styles.sumLabel}>TRADE</Text>
      </View>
      <View style={styles.sumCell}>
        <Text style={[styles.sumVal,{color:watchable>0?C.ye:C.tx3}]}>{watchable}</Text>
        <Text style={styles.sumLabel}>WATCH</Text>
      </View>
      <View style={[styles.sumCell,{flex:2}]}>
        <Text style={styles.sumLabel}>TOP BOT</Text>
        <Text style={{color:C.ac,fontSize:11,fontWeight:'700',fontFamily:'monospace'}}>
          {best.idx>=0?`#${BOTS[best.idx].id} ${BOTS[best.idx].name} (${best.pct}%)`:'None ready'}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ScannerScreen({ state }) {
  const { conf, prices, digits } = state;
  const h = new Date().getUTCHours();

  const scanData = useMemo(()=>{
    const r14     = conf?.r14 ?? null;
    const r4      = conf?.r4  ?? null;
    const e5      = conf?.e5  ?? null;
    const e10     = conf?.e10 ?? null;
    const e20     = conf?.e20 ?? null;
    const emaSep  = (e5&&e10) ? Math.abs(e5-e10) : 0;
    const emaStacked = e5&&e10&&e20 && ((e5>e10&&e10>e20)||(e5<e10&&e10<e20));
    const bb      = conf?.bb ?? null;
    const lastPrice = (prices['R_75']||[])[((prices['R_75']||[]).length-1)] || 0;
    const bbBelow = bb && lastPrice <= bb.lower;
    const domData = calcDigitDom(digits);
    const streaks = calcStreaks(digits);

    // DollarPrinter digit data
    const d100 = digits.slice(-100);
    const total = d100.length || 1;
    const dcounts = Array(10).fill(0);
    d100.forEach(d=>dcounts[d]++);
    const dPct = dcounts.map(c=>Math.round(c/total*100));
    const digit4pct = dPct[4];
    const digit5pct = dPct[5];
    const dpEvenCount = [0,2,4,6,8].filter(d=>dPct[d]>=11).length;
    const dpOddCount  = [1,3,5,7,9].filter(d=>dPct[d]>=11).length;

    return {
      h, r14, r4, emaSep, emaStacked, bbBelow,
      dom: domData.dom, highLeads: domData.highLeads,
      esc: streaks.even, osc: streaks.odd,
      riseScore: conf?.riseScore||0,
      fallScore: conf?.fallScore||0,
      digit4pct, digit5pct, dpEvenCount, dpOddCount,
    };
  }, [conf?.r14, conf?.r4, conf?.e5, conf?.e10, conf?.e20,
      conf?.bb, conf?.riseScore, conf?.fallScore,
      digits.length, h]);

  const signals = useMemo(()=>BOTS.map(bot=>{
    const results = bot.checks.map(fn=>{ try{return fn(scanData);}catch{return false;} });
    return { met:results.filter(Boolean).length, total:results.length, results };
  }), [scanData]);

  // Current analysis note
  const deadZone = scanData.r14!==null && scanData.r14>=40 && scanData.r14<=60;
  const offHours = h<8||h>=20;

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <View style={styles.header}>
        <Text style={styles.title}>Bot Scanner</Text>
        <Text style={styles.hint}>Candle-based RSI · Updates every 0.5s · Tap card for detail</Text>
      </View>

      {/* Alerts */}
      {deadZone && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertTxt}>⛔  RSI DEAD ZONE — No directional bots viable</Text>
        </View>
      )}
      {offHours && (
        <View style={[styles.alertBanner,{backgroundColor:'rgba(80,80,96,.15)',borderColor:'rgba(80,80,96,.3)'}]}>
          <Text style={[styles.alertTxt,{color:C.tx3}]}>🕐 Off-hours ({h}:xx UTC) — Reduced edge on all bots</Text>
        </View>
      )}

      <SummaryBar signals={signals}/>

      <ScrollView contentContainerStyle={{padding:10}}>
        {BOTS.map((bot,i)=>(
          <BotCard key={bot.id} bot={bot} sig={signals[i]}/>
        ))}
        <View style={{height:20}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:     {padding:12,backgroundColor:C.sf,borderBottomWidth:1,borderBottomColor:C.bd},
  title:      {fontSize:16,fontWeight:'800',color:C.tx},
  hint:       {fontSize:9,color:C.tx3,fontFamily:'monospace',marginTop:2},
  alertBanner:{margin:8,borderRadius:8,padding:10,borderWidth:1,
               backgroundColor:'rgba(230,57,70,.1)',borderColor:'rgba(230,57,70,.35)',
               alignItems:'center'},
  alertTxt:   {color:C.re,fontWeight:'800',fontFamily:'monospace',fontSize:11},
  summary:    {flexDirection:'row',backgroundColor:C.sf,borderBottomWidth:1,
               borderBottomColor:C.bd,paddingVertical:8,paddingHorizontal:12,gap:4},
  sumCell:    {alignItems:'center',paddingHorizontal:10,justifyContent:'center'},
  sumVal:     {fontSize:22,fontWeight:'800'},
  sumLabel:   {fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1},
  card:       {backgroundColor:C.sf,borderRadius:9,borderWidth:1,borderColor:C.bd,
               borderLeftWidth:3,padding:12,marginBottom:8},
  cardHead:   {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6},
  botName:    {fontSize:12,fontWeight:'700',color:C.tx},
  botMeta:    {fontSize:9,color:C.tx3,fontFamily:'monospace',marginTop:2},
  cardRight:  {alignItems:'flex-end'},
  signal:     {fontSize:18,fontWeight:'800'},
  frac:       {fontSize:8,color:C.tx3,fontFamily:'monospace'},
  barBg:      {height:4,backgroundColor:C.sf2,borderRadius:2,overflow:'hidden',marginBottom:2},
  barFill:    {height:'100%',borderRadius:2},
  expanded:   {marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:C.bd},
  tipTxt:     {color:C.tx3,fontSize:10,fontFamily:'monospace',lineHeight:15,marginBottom:4},
  checkRow:   {flexDirection:'row',alignItems:'flex-start',paddingVertical:5,
               borderBottomWidth:1,borderBottomColor:C.bd},
  checkTxt:   {fontSize:11,lineHeight:15,flex:1},
});
