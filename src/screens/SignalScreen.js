// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL PANEL — Stable signals, no flicker, timeframe-labelled, full context
// Signals persist for 30s minimum, with countdown timer
// Includes enhanced Even/Odd and High/Low from digitIntel
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated
} from 'react-native';
import { C, SYM_COLORS } from '../theme';
import { calcEvenOddSignal, calcHighLowSignal } from '../digitIntel';

const PERSIST_MS = 30000; // signals persist 30 seconds minimum

// ── Stable signal hook — signal only updates if meaningfully different ───────
function useStableSignal(conf, digits) {
  const [stable,    setStable]    = useState(null);
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [lockedAt,  setLockedAt]  = useState(null);
  const timerRef = useRef(null);
  const countRef = useRef(null);

  useEffect(() => {
    if (!conf || !conf.direction || conf.score < 50) return;

    // Only update if score changed significantly or direction changed
    if (stable &&
        stable.direction === conf.direction &&
        Math.abs((stable.score||0) - (conf.score||0)) < 5) return;

    const now = Date.now();
    // Honour 30s lock
    if (lockedAt && now - lockedAt < PERSIST_MS) return;

    const sig = {
      ...conf,
      lockedAt:  now,
      expiresAt: now + PERSIST_MS,
      timeframe: '~1m ticks',
      source:    'Live tick stream',
    };

    setStable(sig);
    setLockedAt(now);
    setTimeLeft(30);

    if (countRef.current) clearInterval(countRef.current);
    countRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sig.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(countRef.current);
    }, 500);

    return () => { if (countRef.current) clearInterval(countRef.current); };
  }, [conf?.direction, conf?.score]);

  return { stable, timeLeft };
}

// ── Signal card ───────────────────────────────────────────────────────────────
function SignalCard({ sig, timeLeft }) {
  const flash = useRef(new Animated.Value(1)).current;
  const isHot = sig.score >= 70;
  const dirColor = sig.direction?.includes('RISE')||sig.direction?.includes('EVEN')||sig.direction?.includes('OVER')
    ? C.gr : C.re;

  useEffect(() => {
    if (isHot) {
      Animated.loop(Animated.sequence([
        Animated.timing(flash, {toValue:0.5, duration:800, useNativeDriver:true}),
        Animated.timing(flash, {toValue:1.0, duration:800, useNativeDriver:true}),
      ])).start();
    }
    return () => flash.stopAnimation();
  }, [isHot]);

  return (
    <View style={[styles.sigCard, {borderColor: dirColor+'55'}]}>
      {/* Header */}
      <View style={styles.sigHead}>
        <View style={{flex:1}}>
          <Text style={styles.sigBot}>{sig.bot || '—'}</Text>
          <Text style={{fontSize:8,color:C.tx3,fontFamily:'monospace',marginTop:1}}>
            {sig.source} · {sig.timeframe}
          </Text>
        </View>
        <View style={{alignItems:'flex-end',gap:3}}>
          {/* Score badge */}
          <View style={[styles.scoreBadge, {
            backgroundColor: sig.score>=70?'rgba(6,214,160,.2)':sig.score>=50?'rgba(255,215,64,.15)':'rgba(230,57,70,.15)',
            borderColor:     sig.score>=70?C.gr:sig.score>=50?C.ye:C.re,
          }]}>
            <Text style={{color:sig.score>=70?C.gr:sig.score>=50?C.ye:C.re,
              fontWeight:'800',fontFamily:'monospace',fontSize:12}}>{sig.score}</Text>
          </View>
          {/* Timer */}
          {timeLeft > 0 && (
            <View style={styles.timerBadge}>
              <Text style={{color:timeLeft>15?C.gr:timeLeft>8?C.ye:C.re,
                fontSize:9,fontFamily:'monospace',fontWeight:'700'}}>⏱ {timeLeft}s</Text>
            </View>
          )}
        </View>
      </View>

      {/* Direction */}
      <View style={styles.sigDirRow}>
        <Animated.Text style={[styles.sigDir, {color:dirColor, opacity:isHot?flash:1}]}>
          {sig.direction || 'WAIT'}
        </Animated.Text>
        <Text style={[styles.regime, {color:sig.regimeColor||C.ye}]}>{sig.regime}</Text>
      </View>

      {/* Dead zone warning */}
      {sig.r14 >= 40 && sig.r14 <= 60 && (
        <View style={styles.deadZoneBanner}>
          <Text style={{color:C.re,fontWeight:'800',fontSize:11,fontFamily:'monospace'}}>
            ⛔ DEAD ZONE — RSI {sig.r14?.toFixed(0)} — DO NOT TRADE
          </Text>
        </View>
      )}

      {/* Indicator grid — ALWAYS visible, labelled with context */}
      <View style={styles.indGrid}>
        {[
          {l:'RSI(14)',    v:sig.r14?.toFixed(1)??'—',
           ctx: sig.r14>=70?'Overbought→FALL':sig.r14<=30?'Oversold→RISE':sig.r14>=40&&sig.r14<=60?'DEAD ZONE':'Clear',
           c: sig.r14>=70?C.re:sig.r14<=30?C.gr:sig.r14>=40&&sig.r14<=60?C.or:C.ye},
          {l:'RSI(4)',     v:sig.r4?.toFixed(1)??'—',
           ctx: sig.r4<33?'RISE trigger':sig.r4>67?'FALL trigger':'Neutral',
           c: sig.r4<33?C.gr:sig.r4>67?C.re:C.tx3},
          {l:'EMA Sep',   v:sig.e5&&sig.e10?Math.abs(sig.e5-sig.e10).toFixed(4):'—',
           ctx: sig.e5&&sig.e10?
             (sig.e5>sig.e10&&sig.e10>sig.e20?'Bull stack':
              sig.e5<sig.e10&&sig.e10<sig.e20?'Bear stack':'Mixed'):'No data',
           c: sig.e5&&sig.e10?(sig.e5>sig.e10?C.gr:C.re):C.tx3},
          {l:'Momentum',  v:sig.mom!=null?(sig.mom>=0?'+':'')+sig.mom?.toFixed(4):'—',
           ctx: Math.abs(sig.mom||0)>=0.04?'Strong':'Weak',
           c: Math.abs(sig.mom||0)>=0.04?C.gr:C.tx3},
        ].map(r=>(
          <View key={r.l} style={styles.indCell}>
            <Text style={styles.indLabel}>{r.l}</Text>
            <Text style={[styles.indVal,{color:r.c}]}>{r.v}</Text>
            <Text style={[styles.indCtx,{color:r.c}]}>{r.ctx}</Text>
          </View>
        ))}
      </View>

      {/* Factors checklist */}
      <View style={styles.factorsRow}>
        {(sig.factors||[]).map((f,i)=>(
          <View key={i} style={[styles.factorChip,{
            borderColor:f.ok?'rgba(6,214,160,.3)':'rgba(230,57,70,.3)',
            backgroundColor:f.ok?'rgba(6,214,160,.08)':'rgba(230,57,70,.06)',
          }]}>
            <Text style={{color:f.ok?C.gr:C.re,fontSize:8,fontWeight:'800',marginRight:3}}>
              {f.ok?'✓':'✗'}
            </Text>
            <Text style={{color:C.tx2,fontSize:8,fontFamily:'monospace'}}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Time info */}
      <Text style={{fontSize:8,color:C.tx4,fontFamily:'monospace',marginTop:4}}>
        Locked: {sig.lockedAt ? new Date(sig.lockedAt).toLocaleTimeString() : '—'}
        {sig.expiresAt ? '  |  Expires: '+new Date(sig.expiresAt).toLocaleTimeString() : ''}
      </Text>
    </View>
  );
}

// ── Enhanced Even/Odd card ────────────────────────────────────────────────────
function EvenOddCard({ eoSig }) {
  if (!eoSig) return (
    <View style={styles.eoCard}>
      <Text style={{color:C.tx3,fontFamily:'monospace',textAlign:'center',padding:20}}>
        Waiting for digit data...
      </Text>
    </View>
  );

  const { bet, score, streak, streakDir, reversion, markov, entropy, hotCold, factors, confidence } = eoSig;
  const betColor = bet === 'EVEN' ? C.ye : bet === 'ODD' ? C.pu2 : C.tx3;

  return (
    <View style={styles.eoCard}>
      <Text style={styles.eoTitle}>EVEN / ODD INTELLIGENCE</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10}}>
        <View style={{alignItems:'center'}}>
          <Text style={[styles.eoBet,{color:betColor}]}>{bet || 'WAIT'}</Text>
          <Text style={[styles.eoConf,{color:
            confidence==='HIGH'?C.gr:confidence==='MEDIUM'?C.ye:C.tx3
          }]}>{confidence}</Text>
        </View>
        <View style={{flex:1}}>
          <View style={{height:8,backgroundColor:C.sf2,borderRadius:4,overflow:'hidden',marginBottom:4}}>
            <View style={{width:score+'%',height:'100%',
              backgroundColor:score>=70?C.gr:score>=50?C.ye:C.re,borderRadius:4}}/>
          </View>
          <Text style={{color:C.tx2,fontSize:10,fontFamily:'monospace'}}>{score}/100</Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.eoGrid}>
        <View style={styles.eoCell}>
          <Text style={styles.eoLabel}>STREAK</Text>
          <Text style={styles.eoVal}>{streak}× {streakDir}</Text>
          <Text style={{color:C.tx3,fontSize:8}}>{reversion}% reversion</Text>
        </View>
        <View style={styles.eoCell}>
          <Text style={styles.eoLabel}>MARKOV</Text>
          <Text style={[styles.eoVal,{color:markov.next?betColor:C.tx3}]}>{markov.next||'—'}</Text>
          <Text style={{color:C.tx3,fontSize:8}}>{markov.prob}% prob</Text>
        </View>
        <View style={styles.eoCell}>
          <Text style={styles.eoLabel}>ENTROPY</Text>
          <Text style={[styles.eoVal,{color:entropy<80?C.gr:entropy<90?C.ye:C.re}]}>{entropy}%</Text>
          <Text style={{color:C.tx3,fontSize:8}}>{entropy<80?'Predictable':entropy<90?'Moderate':'Random'}</Text>
        </View>
        <View style={styles.eoCell}>
          <Text style={styles.eoLabel}>CONFIDENCE</Text>
          <Text style={{color:markov.confidence>20?C.gr:C.ye,fontSize:13,fontWeight:'800'}}>{markov.confidence}%</Text>
          <Text style={{color:C.tx3,fontSize:8}}>Markov delta</Text>
        </View>
      </View>

      {/* Hot digits */}
      {hotCold.hot.length > 0 && (
        <View style={{marginTop:8}}>
          <Text style={styles.eoLabel}>HOT DIGITS</Text>
          <View style={{flexDirection:'row',gap:5,marginTop:4,flexWrap:'wrap'}}>
            {hotCold.hot.map(d=>(
              <View key={d.digit} style={[styles.digitBubble,{
                backgroundColor: d.digit%2===0?'rgba(255,215,64,.2)':'rgba(181,110,212,.2)',
                borderColor:     d.digit%2===0?C.ye:C.pu2,
              }]}>
                <Text style={{color:d.digit%2===0?C.ye:C.pu2,fontWeight:'800',fontSize:12}}>{d.digit}</Text>
                <Text style={{color:C.tx3,fontSize:7}}>{d.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Factors */}
      <View style={[styles.factorsRow,{marginTop:8}]}>
        {factors.map((f,i)=>(
          <View key={i} style={[styles.factorChip,{
            borderColor:f.ok?'rgba(6,214,160,.3)':'rgba(230,57,70,.3)',
            backgroundColor:f.ok?'rgba(6,214,160,.08)':'rgba(230,57,70,.06)',
          }]}>
            <Text style={{color:f.ok?C.gr:C.re,fontSize:8,fontWeight:'800',marginRight:3}}>{f.ok?'✓':'✗'}</Text>
            <View>
              <Text style={{color:C.tx2,fontSize:8,fontFamily:'monospace'}}>{f.label}</Text>
              <Text style={{color:C.tx3,fontSize:7}}>{f.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── High/Low card ─────────────────────────────────────────────────────────────
function HighLowCard({ hlSig }) {
  if (!hlSig) return (
    <View style={styles.eoCard}>
      <Text style={{color:C.tx3,fontFamily:'monospace',textAlign:'center',padding:20}}>
        Waiting for digit data...
      </Text>
    </View>
  );

  const { bet, score, dom10, dom20, dom50, trend, entropy, hotCold, factors, confidence } = hlSig;
  const betColor = bet === 'OVER 5' ? C.or : bet === 'UNDER 5' ? C.bl : C.tx3;

  return (
    <View style={styles.eoCard}>
      <Text style={styles.eoTitle}>HIGH / LOW INTELLIGENCE</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10}}>
        <View style={{alignItems:'center'}}>
          <Text style={[styles.eoBet,{color:betColor,fontSize:20}]}>{bet || 'WAIT'}</Text>
          <Text style={[styles.eoConf,{color:
            confidence==='HIGH'?C.gr:confidence==='MEDIUM'?C.ye:C.tx3
          }]}>{confidence}</Text>
        </View>
        <View style={{flex:1}}>
          <View style={{height:8,backgroundColor:C.sf2,borderRadius:4,overflow:'hidden',marginBottom:4}}>
            <View style={{width:score+'%',height:'100%',
              backgroundColor:score>=70?C.gr:score>=50?C.ye:C.re,borderRadius:4}}/>
          </View>
          <Text style={{color:C.tx2,fontSize:10,fontFamily:'monospace'}}>{score}/100</Text>
        </View>
        {trend !== 0 && (
          <View>
            <Text style={{color:trend>0?C.gr:C.re,fontWeight:'800',fontSize:13}}>
              {trend>0?'▲ RISING':'▼ FALLING'}
            </Text>
            <Text style={{color:C.tx3,fontSize:8}}>vs 50T avg</Text>
          </View>
        )}
      </View>

      {/* 3-window dominance comparison */}
      <Text style={styles.eoLabel}>DOMINANCE ACROSS WINDOWS</Text>
      <View style={{marginTop:6,gap:6}}>
        {[['Last 10 ticks',dom10],['Last 20 ticks',dom20],['Last 50 ticks',dom50]].map(([l,d])=>(
          <View key={l} style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace',width:80}}>{l}</Text>
            <View style={{flex:1,height:6,backgroundColor:C.sf2,borderRadius:3,overflow:'hidden'}}>
              <View style={{position:'absolute',left:0,height:'100%',
                width:(d.high)+'%',backgroundColor:C.or,opacity:0.8}}/>
              <View style={{position:'absolute',right:0,height:'100%',
                width:(d.low)+'%',backgroundColor:C.bl,opacity:0.8}}/>
            </View>
            <Text style={{color:C.or,fontSize:8,fontFamily:'monospace',width:28}}>H{d.high}%</Text>
            <Text style={{color:C.bl,fontSize:8,fontFamily:'monospace',width:28}}>L{d.low}%</Text>
          </View>
        ))}
      </View>

      {/* Hot digits */}
      {hotCold.hot.length > 0 && (
        <View style={{marginTop:8}}>
          <Text style={styles.eoLabel}>HOT DIGITS</Text>
          <View style={{flexDirection:'row',gap:5,marginTop:4,flexWrap:'wrap'}}>
            {hotCold.hot.map(d=>(
              <View key={d.digit} style={[styles.digitBubble,{
                backgroundColor:d.digit>=5?'rgba(247,127,0,.2)':'rgba(17,138,178,.2)',
                borderColor:     d.digit>=5?C.or:C.bl,
              }]}>
                <Text style={{color:d.digit>=5?C.or:C.bl,fontWeight:'800',fontSize:12}}>{d.digit}</Text>
                <Text style={{color:C.tx3,fontSize:7}}>{d.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Factors */}
      <View style={[styles.factorsRow,{marginTop:8}]}>
        {factors.map((f,i)=>(
          <View key={i} style={[styles.factorChip,{
            borderColor:f.ok?'rgba(6,214,160,.3)':'rgba(230,57,70,.3)',
            backgroundColor:f.ok?'rgba(6,214,160,.08)':'rgba(230,57,70,.06)',
          }]}>
            <Text style={{color:f.ok?C.gr:C.re,fontSize:8,fontWeight:'800',marginRight:3}}>{f.ok?'✓':'✗'}</Text>
            <View>
              <Text style={{color:C.tx2,fontSize:8,fontFamily:'monospace'}}>{f.label}</Text>
              <Text style={{color:C.tx3,fontSize:7}}>{f.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SignalScreen({ state }) {
  const [tab, setTab] = useState('main'); // 'main' | 'evenodd' | 'highlow'
  const { conf, digits } = state;
  const { stable, timeLeft } = useStableSignal(conf, digits);

  const eoSig = React.useMemo(() => calcEvenOddSignal(digits||[]), [digits?.length]);
  const hlSig = React.useMemo(() => calcHighLowSignal(digits||[]),  [digits?.length]);

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[['main','📡 Main Signal'],['evenodd','⚖️ Even/Odd'],['highlow','📊 High/Low']].map(([k,l])=>(
          <TouchableOpacity key={k} onPress={()=>setTab(k)}
            style={[styles.tabBtn, tab===k&&styles.tabOn]}>
            <Text style={[styles.tabTxt, tab===k&&{color:C.bg}]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{padding:12}}>
        {tab==='main' && (
          <>
            <View style={styles.headerRow}>
              <Text style={{fontSize:14,fontWeight:'800',color:C.tx}}>Live Signal</Text>
              <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace'}}>
                Signals persist 30s · Tick stream
              </Text>
            </View>

            {stable ? (
              <SignalCard sig={stable} timeLeft={timeLeft}/>
            ) : (
              <View style={styles.waitCard}>
                <Text style={{fontSize:28,marginBottom:10}}>📡</Text>
                <Text style={{color:C.tx2,fontSize:13,fontWeight:'700',marginBottom:4}}>
                  Waiting for signal...
                </Text>
                <Text style={{color:C.tx3,fontSize:11,textAlign:'center',lineHeight:17}}>
                  A signal appears when Entry Score ≥50 and a clear direction is detected.
                  {'\n'}Dead zone (RSI 40-60) shows no signal by design.
                </Text>
              </View>
            )}

            {/* Live indicator strip — always shown even without a locked signal */}
            {conf && (
              <View style={styles.liveStrip}>
                <Text style={styles.stripTitle}>LIVE READINGS (updating every 0.5s)</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6}}>
                  {[
                    {l:'RSI(14)', v:conf.r14?.toFixed(1)??'—', c:conf.r14<=30||conf.r14>=70?C.gr:conf.r14>=40&&conf.r14<=60?C.re:C.ye},
                    {l:'RSI(4)',  v:conf.r4?.toFixed(1)??'—',  c:conf.r4<33||conf.r4>67?C.gr:C.ye},
                    {l:'SCORE',  v:conf.score+'', c:conf.score>=70?C.gr:conf.score>=50?C.ye:C.re},
                    {l:'REGIME', v:conf.regime||'—', c:conf.regimeColor||C.ye},
                    {l:'SETUP',  v:conf.direction||'WAIT', c:conf.direction?C.gr:C.tx3},
                    {l:'DEAD?',  v:conf.r14>=40&&conf.r14<=60?'⛔YES':'✓NO',
                     c:conf.r14>=40&&conf.r14<=60?C.re:C.gr},
                  ].map(r=>(
                    <View key={r.l} style={styles.liveCell}>
                      <Text style={styles.liveCellLabel}>{r.l}</Text>
                      <Text style={[styles.liveCellVal,{color:r.c}]}>{r.v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {tab==='evenodd' && <EvenOddCard eoSig={eoSig}/>}
        {tab==='highlow' && <HighLowCard hlSig={hlSig}/>}

        <View style={{height:30}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar:       {flexDirection:'row',backgroundColor:C.sf,borderBottomWidth:1,
                 borderBottomColor:C.bd,padding:6,gap:5},
  tabBtn:       {flex:1,paddingVertical:7,borderRadius:6,borderWidth:1,
                 borderColor:C.bd2,alignItems:'center'},
  tabOn:        {backgroundColor:C.ac,borderColor:C.ac},
  tabTxt:       {fontSize:9,color:C.tx2,fontFamily:'monospace',fontWeight:'700'},
  headerRow:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
  sigCard:      {backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderLeftWidth:3,
                 padding:14,marginBottom:10},
  sigHead:      {flexDirection:'row',alignItems:'flex-start',marginBottom:8},
  sigBot:       {fontSize:13,fontWeight:'700',color:C.tx},
  scoreBadge:   {borderWidth:1,borderRadius:6,paddingHorizontal:8,paddingVertical:3},
  timerBadge:   {backgroundColor:'rgba(0,0,0,.3)',borderRadius:5,paddingHorizontal:6,paddingVertical:2},
  sigDirRow:    {flexDirection:'row',alignItems:'center',gap:12,marginBottom:8},
  sigDir:       {fontSize:30,fontWeight:'800'},
  regime:       {fontSize:11,fontWeight:'700',fontFamily:'monospace',
                 backgroundColor:'rgba(0,0,0,.3)',paddingHorizontal:8,paddingVertical:3,borderRadius:5},
  deadZoneBanner:{backgroundColor:'rgba(230,57,70,.12)',borderWidth:1,borderColor:'rgba(230,57,70,.4)',
                  borderRadius:7,padding:8,marginBottom:8,alignItems:'center'},
  indGrid:      {flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:8},
  indCell:      {backgroundColor:C.sf2,borderRadius:7,borderWidth:1,borderColor:C.bd,
                 padding:8,minWidth:80},
  indLabel:     {fontSize:7,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                 letterSpacing:0.5,marginBottom:2},
  indVal:       {fontSize:14,fontWeight:'800',marginBottom:1},
  indCtx:       {fontSize:8,fontFamily:'monospace'},
  factorsRow:   {flexDirection:'row',flexWrap:'wrap',gap:5},
  factorChip:   {flexDirection:'row',alignItems:'flex-start',borderWidth:1,borderRadius:5,
                 paddingHorizontal:6,paddingVertical:4,gap:3},
  waitCard:     {backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,
                 padding:30,alignItems:'center'},
  liveStrip:    {backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,
                 padding:12,marginTop:8},
  stripTitle:   {fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1},
  liveCell:     {backgroundColor:C.sf2,borderRadius:7,borderWidth:1,borderColor:C.bd,
                 padding:8,minWidth:70,alignItems:'center'},
  liveCellLabel:{fontSize:7,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                 letterSpacing:0.5,marginBottom:2},
  liveCellVal:  {fontSize:13,fontWeight:'800',fontFamily:'monospace'},
  eoCard:       {backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,padding:14,marginBottom:10},
  eoTitle:      {fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                 letterSpacing:1.2,marginBottom:10},
  eoBet:        {fontSize:26,fontWeight:'800'},
  eoConf:       {fontSize:9,fontFamily:'monospace',fontWeight:'700',textTransform:'uppercase'},
  eoGrid:       {flexDirection:'row',gap:6,marginBottom:8},
  eoCell:       {flex:1,backgroundColor:C.sf2,borderRadius:7,borderWidth:1,borderColor:C.bd,
                 padding:8,alignItems:'center'},
  eoLabel:      {fontSize:7,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',
                 letterSpacing:0.5,marginBottom:3},
  eoVal:        {fontSize:14,fontWeight:'800',color:C.tx,marginBottom:1},
  digitBubble:  {width:40,height:44,borderRadius:7,borderWidth:1,alignItems:'center',
                 justifyContent:'center',gap:2},
});
