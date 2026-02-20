import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { C, SYM_COLORS } from '../theme';
import { calcRSI, calcEMA, calcBB, calcDigitDom, calcStreaks, getLastDigit } from '../indicators';
import Card from '../components/Card';
import DigitStrip from '../components/DigitStrip';
import Badge from '../components/Badge';

const { width: SW } = Dimensions.get('window');
const CW = SW - 24;

const SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];

function TickCandleChart({ prices=[], color=C.ac, height=220, barSize=5, showEMA=true, showBB=false }) {
  const W = CW, H = height;
  const data = prices.slice(-200);
  if (data.length < barSize*2) return (
    <View style={{height:H, justifyContent:'center', alignItems:'center'}}>
      <Text style={{color:C.tx3, fontFamily:'monospace', fontSize:11}}>Waiting for data...</Text>
    </View>
  );

  // Build candles from raw ticks
  const candles = [];
  for (let i=0;i<Math.floor(data.length/barSize);i++) {
    const sl = data.slice(i*barSize,(i+1)*barSize);
    candles.push({o:sl[0], c:sl[sl.length-1], h:Math.max(...sl), l:Math.min(...sl)});
  }
  if (!candles.length) return null;

  const minP = Math.min(...candles.map(c=>c.l));
  const maxP = Math.max(...candles.map(c=>c.h));
  const range = maxP - minP || 0.0001;
  const pad = {t:10, b:20, l:4, r:52};
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const bw = Math.max(2, (cW / candles.length) - 1.5);
  const cx = i => pad.l + (i / (candles.length-1 || 1)) * cW;
  const cy = v => pad.t + cH - ((v-minP)/range)*cH;

  // EMA on close prices — O(n) incremental, not O(n²) slice recalc
  const closes = candles.map(c=>c.c);
  const e5 = showEMA ? (() => {
    const k=2/6, out=new Array(closes.length).fill(null);
    let e=closes.slice(0,5).reduce((a,b)=>a+b,0)/5;
    out[4]=e;
    for(let i=5;i<closes.length;i++){e=closes[i]*k+e*(1-k);out[i]=e;}
    return out;
  })() : [];
  const e10 = showEMA ? (() => {
    const k=2/11, out=new Array(closes.length).fill(null);
    let e=closes.slice(0,10).reduce((a,b)=>a+b,0)/10;
    out[9]=e;
    for(let i=10;i<closes.length;i++){e=closes[i]*k+e*(1-k);out[i]=e;}
    return out;
  })() : [];
  const bb  = showBB  ? calcBB(closes, Math.min(20,closes.length)) : null;

  // Build SVG paths
  let ema5Path='', ema10Path='';
  if (showEMA) {
    e5.forEach((v,i)=>{ if(v){ema5Path+=(ema5Path?`L${cx(i)},${cy(v)}`:`M${cx(i)},${cy(v)}`);} });
    e10.forEach((v,i)=>{ if(v){ema10Path+=(ema10Path?`L${cx(i)},${cy(v)}`:`M${cx(i)},${cy(v)}`);} });
  }

  const priceLabels = [0,0.25,0.5,0.75,1].map(f=>({y:pad.t+cH*f, v:(maxP-range*f).toFixed(4)}));

  return (
    <Svg width={W} height={H}>
      {/* Grid */}
      {priceLabels.map((p,i)=>(
        <React.Fragment key={i}>
          <Line x1={pad.l} y1={p.y} x2={pad.l+cW} y2={p.y} stroke="rgba(28,45,70,.5)" strokeWidth="1"/>
          <SvgText x={pad.l+cW+4} y={p.y+3} fill="rgba(77,100,133,.8)" fontSize="8" fontFamily="monospace">{p.v}</SvgText>
        </React.Fragment>
      ))}
      {/* BB fill */}
      {bb && showBB ? (
        <Rect x={pad.l} y={cy(bb.upper)} width={cW} height={Math.max(1,cy(bb.lower)-cy(bb.upper))} fill="rgba(124,58,237,.06)"/>
      ) : null}
      {/* Candles */}
      {candles.map((c,i)=>{
        const bull=c.c>=c.o;
        const x=cx(i);
        const bodyTop=cy(Math.max(c.o,c.c));
        const bodyBot=cy(Math.min(c.o,c.c));
        const bodyH=Math.max(1,bodyBot-bodyTop);
        return (
          <React.Fragment key={i}>
            <Line x1={x} y1={cy(c.h)} x2={x} y2={cy(c.l)} stroke={bull?C.gr:C.re} strokeWidth="1"/>
            <Rect x={x-bw/2} y={bodyTop} width={bw} height={bodyH}
              fill={bull?'rgba(0,230,118,.8)':'rgba(255,23,68,.8)'}
              stroke={bull?C.gr:C.re} strokeWidth="0.5"/>
          </React.Fragment>
        );
      })}
      {/* EMA lines */}
      {ema5Path  ? <Path d={ema5Path}  stroke={C.gr} strokeWidth="1.3" fill="none" opacity="0.8"/> : null}
      {ema10Path ? <Path d={ema10Path} stroke={C.ye} strokeWidth="1.3" fill="none" opacity="0.8"/> : null}
      {/* BB lines */}
      {bb && showBB ? (
        <>
          <Line x1={pad.l} y1={cy(bb.upper)} x2={pad.l+cW} y2={cy(bb.upper)} stroke="rgba(124,58,237,.7)" strokeWidth="1"/>
          <Line x1={pad.l} y1={cy(bb.lower)} x2={pad.l+cW} y2={cy(bb.lower)} stroke="rgba(124,58,237,.7)" strokeWidth="1"/>
          <Line x1={pad.l} y1={cy(bb.mid)}   x2={pad.l+cW} y2={cy(bb.mid)}   stroke="rgba(124,58,237,.4)" strokeWidth="1" strokeDasharray="4 3"/>
        </>
      ) : null}
    </Svg>
  );
}

function RSIChart({ prices=[], height=70 }) {
  const W = CW, H = height;
  // RSI values — limit to last 60 points for speed
  const rv = [];
  const pSlice = prices.slice(-80);
  for (let i=14;i<=pSlice.length;i++) {
    const sl=pSlice.slice(0,i);
    let g=0,l=0;
    for(let j=1;j<sl.length;j++){const d=sl[j]-sl[j-1];if(d>=0)g+=d;else l-=d;}
    const ag=g/14,al=l/14;
    rv.push(al===0?100:100-(100/(1+ag/al)));
  }
  if (rv.length < 2) return <View style={{height:H}}/>;
  const cW=W-56, cH=H-12, pl=4;
  const cx=i=>(i/(rv.length-1))*cW+pl;
  const cy=v=>H-6-((v/100)*cH);
  let path = rv.map((v,i)=>(i===0?`M${cx(i)},${cy(v)}`:`L${cx(i)},${cy(v)}`)).join('');
  const last=rv[rv.length-1];
  const col=last>70?C.re:last<30?C.gr:C.ye;
  return (
    <Svg width={W} height={H}>
      <Rect x={pl} y={cy(70)} width={cW} height={cy(30)-cy(70)} fill="rgba(255,23,68,.05)"/>
      <Rect x={pl} y={cy(30)} width={cW} height={H-6-cy(30)} fill="rgba(0,230,118,.05)"/>
      {[30,50,70].map(l=>(
        <React.Fragment key={l}>
          <Line x1={pl} y1={cy(l)} x2={pl+cW} y2={cy(l)} stroke="rgba(77,100,133,.35)" strokeWidth="1" strokeDasharray={l===50?"":"3 3"}/>
          <SvgText x={pl+cW+4} y={cy(l)+3} fill="rgba(77,100,133,.7)" fontSize="8">{l}</SvgText>
        </React.Fragment>
      ))}
      <Path d={path} stroke={col} strokeWidth="1.5" fill="none"/>
      <SvgText x={pl+cW+4} y={12} fill={col} fontSize="8" fontWeight="bold">RSI {last.toFixed(1)}</SvgText>
    </Svg>
  );
}

const BAR_SIZES = [
  {label:'5T Bars', size:5, color:C.ac},
  {label:'10T Bars', size:10, color:C.ye},
  {label:'20T Bars', size:20, color:C.or},
];

export default function TickChartScreen({ state }) {
  const { prices, digits, lastTick } = state;
  const [sym, setSym] = useState('R_75');
  const [barSize, setBarSize] = useState(5);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(true);
  const symPrices = prices[sym] || [];
  const lastPx = lastTick[sym];
  const domData = useMemo(()=>calcDigitDom(digits), [digits.length]);
  const {even:esc, odd:osc} = useMemo(()=>calcStreaks(digits), [digits.length]);

  return (
    <ScrollView style={{flex:1, backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      {/* Sym selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
        <View style={{flexDirection:'row', gap:6}}>
          {SYMS.map(s=>(
            <TouchableOpacity key={s} onPress={()=>setSym(s)}
              style={[{paddingHorizontal:12, paddingVertical:5, borderRadius:6, borderWidth:1, borderColor: sym===s?SYM_COLORS[s]:C.bd2, backgroundColor:sym===s?SYM_COLORS[s]+'22':'transparent'}]}>
              <Text style={{color:sym===s?SYM_COLORS[s]:C.tx3, fontSize:10, fontFamily:'monospace', fontWeight:'700'}}>
                {s.replace('R_','V').replace('1HZ100V','1HZ100')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Price + Stats row */}
      <View style={{flexDirection:'row', gap:8, marginBottom:10}}>
        <View style={{flex:1, backgroundColor:C.sf, borderRadius:9, padding:12, borderWidth:1, borderColor:C.bd}}>
          <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:3}}>Price</Text>
          <Text style={{fontSize:22, fontWeight:'800', color:SYM_COLORS[sym]}}>{lastPx?lastPx.toFixed(4):'--'}</Text>
        </View>
        <View style={{flex:1, backgroundColor:C.sf, borderRadius:9, padding:12, borderWidth:1, borderColor:C.bd}}>
          <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:3}}>Ticks Stored</Text>
          <Text style={{fontSize:22, fontWeight:'800', color:C.ye}}>{symPrices.length}</Text>
        </View>
        <View style={{flex:1, backgroundColor:C.sf, borderRadius:9, padding:12, borderWidth:1, borderColor:C.bd}}>
          <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:3}}>Bar Size</Text>
          <Text style={{fontSize:22, fontWeight:'800', color:C.gr}}>{barSize}T</Text>
        </View>
      </View>

      {/* Bar size + Overlays */}
      <View style={{flexDirection:'row', gap:5, marginBottom:10, flexWrap:'wrap'}}>
        {BAR_SIZES.map(b=>(
          <TouchableOpacity key={b.size} onPress={()=>setBarSize(b.size)}
            style={{paddingHorizontal:10, paddingVertical:4, borderRadius:5, borderWidth:1,
              borderColor: barSize===b.size?b.color:C.bd2, backgroundColor: barSize===b.size?b.color+'22':'transparent'}}>
            <Text style={{color:barSize===b.size?b.color:C.tx3, fontSize:9, fontFamily:'monospace', fontWeight:'700'}}>{b.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{width:1, backgroundColor:C.bd2, marginHorizontal:4}}/>
        {[['EMA',showEMA,setShowEMA,C.gr],['BB',showBB,setShowBB,C.pu2],['RSI',showRSI,setShowRSI,C.ye]].map(([lbl,on,set,col])=>(
          <TouchableOpacity key={lbl} onPress={()=>set(!on)}
            style={{paddingHorizontal:10, paddingVertical:4, borderRadius:5, borderWidth:1,
              borderColor:on?col:C.bd2, backgroundColor:on?col+'22':'transparent'}}>
            <Text style={{color:on?col:C.tx3, fontSize:9, fontFamily:'monospace', fontWeight:'700'}}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* MAIN CHART */}
      <View style={{backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, overflow:'hidden', marginBottom:10}}>
        <TickCandleChart prices={symPrices} color={SYM_COLORS[sym]} height={240} barSize={barSize} showEMA={showEMA} showBB={showBB}/>
        {showRSI ? (
          <View style={{borderTopWidth:1, borderTopColor:C.bd, padding:4}}>
            <RSIChart prices={symPrices} height={72}/>
          </View>
        ) : null}
        <View style={{flexDirection:'row', gap:12, padding:8, borderTopWidth:1, borderTopColor:C.bd}}>
          {showEMA ? (
            <>
              <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                <View style={{width:16, height:2, backgroundColor:C.gr}}/>
                <Text style={{color:C.tx3, fontSize:8, fontFamily:'monospace'}}>EMA5</Text>
              </View>
              <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                <View style={{width:16, height:2, backgroundColor:C.ye}}/>
                <Text style={{color:C.tx3, fontSize:8, fontFamily:'monospace'}}>EMA10</Text>
              </View>
            </>
          ) : null}
          {showBB ? (
            <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
              <View style={{width:16, height:2, backgroundColor:C.pu2}}/>
              <Text style={{color:C.tx3, fontSize:8, fontFamily:'monospace'}}>Bollinger</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Digit Analysis */}
      <Card title="Digit Stream Analysis">
        <DigitStrip digits={digits}/>
        <View style={{flexDirection:'row', justifyContent:'space-around', marginTop:12}}>
          <View style={{alignItems:'center'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>High (5-9)</Text>
            <Text style={{fontSize:24, fontWeight:'800', color:C.ac}}>{domData.high}%</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>Low (0-4)</Text>
            <Text style={{fontSize:24, fontWeight:'800', color:C.or}}>{domData.low}%</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>Dominance</Text>
            <Text style={{fontSize:24, fontWeight:'800', color:C.gr}}>{domData.dom}%</Text>
          </View>
          <View style={{alignItems:'center'}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:4}}>Signal</Text>
            <Badge
              label={domData.dom>=65?(domData.highLeads?'OVER 5':'UNDER 5'):'WAIT'}
              variant={domData.dom>=65?'bull':'warn'}/>
          </View>
        </View>
        <View style={{flexDirection:'row', gap:12, marginTop:10}}>
          <View style={{flex:1, backgroundColor:C.sf2, borderRadius:6, padding:8, borderWidth:1, borderColor:C.bd}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:3}}>Consec. Even</Text>
            <Text style={{fontSize:20, fontWeight:'800', color:C.ac}}>{esc}</Text>
            {esc>=4 ? <Text style={{fontSize:9, color:C.gr, marginTop:2}}>→ BET ODD</Text> : null}
          </View>
          <View style={{flex:1, backgroundColor:C.sf2, borderRadius:6, padding:8, borderWidth:1, borderColor:C.bd}}>
            <Text style={{fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', marginBottom:3}}>Consec. Odd</Text>
            <Text style={{fontSize:20, fontWeight:'800', color:C.pu2}}>{osc}</Text>
            {osc>=4 ? <Text style={{fontSize:9, color:C.gr, marginTop:2}}>→ BET EVEN</Text> : null}
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}