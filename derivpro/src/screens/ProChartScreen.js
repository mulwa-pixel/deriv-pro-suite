import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { C, TV_SYMS } from '../theme';
import { calcConfluence } from '../indicators';
import Card from '../components/Card';
import IndicatorRow from '../components/IndicatorRow';
import ScoreGauge from '../components/ScoreGauge';

const TFs = ['1','5','15','60','240','D'];
const TF_LABELS = {'1':'1m','5':'5m','15':'15m','60':'1H','240':'4H','D':'1D'};

const SYMS = [
  {val:'R_75',   tv:'VOLATILITY_75'},
  {val:'R_100',  tv:'VOLATILITY_100'},
  {val:'R_25',   tv:'VOLATILITY_25'},
  {val:'R_50',   tv:'VOLATILITY_50'},
  {val:'R_10',   tv:'VOLATILITY_10'},
  {val:'1HZ100V',tv:'VOLATILITY_100_1S'},
];

const {width: SW} = Dimensions.get('window');

export default function ProChartScreen({ state }) {
  const [sym, setSym] = useState('R_75');
  const [tf, setTf] = useState('5');
  const { prices, digits } = state;
  const utcH = new Date().getUTCHours();
  const symPrices = prices[sym] || [];
  const conf = useMemo(() => calcConfluence(symPrices, digits, utcH), [symPrices.length, digits.length]);
  const tvSym = SYMS.find(s=>s.val===sym)?.tv || 'VOLATILITY_75';

  const tvUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tv1&symbol=Deriv%3A${tvSym}&interval=${tf}&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=0d1628&studies=RSI%40tv-basicstudies%1FMACD%40tv-basicstudies%1FBB%40tv-basicstudies&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&locale=en`;

  return (
    <View style={styles.container}>
      {/* SYMBOL SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symBar}>
        <View style={styles.symRow}>
          {SYMS.map(s => (
            <TouchableOpacity key={s.val} onPress={()=>setSym(s.val)}
              style={[styles.chip, sym===s.val&&styles.chipOn]}>
              <Text style={[styles.chipTxt, sym===s.val&&{color:C.bg}]}>
                {s.val.replace('R_','V').replace('1HZ100V','1HZ100')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* TIMEFRAME SELECTOR */}
      <View style={styles.tfBar}>
        {TFs.map(t => (
          <TouchableOpacity key={t} onPress={()=>setTf(t)}
            style={[styles.tfBtn, tf===t&&styles.tfBtnOn]}>
            <Text style={[styles.tfTxt, tf===t&&{color:C.bg}]}>{TF_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
        <View style={{flex:1}}/>
        <Text style={styles.tvCredit}>TradingView</Text>
      </View>

      {/* TRADINGVIEW CHART */}
      <WebView
        source={{uri: tvUrl}}
        style={styles.chart}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        allowsFullscreenVideo={false}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <Text style={{color:C.tx3, fontFamily:'monospace'}}>Loading TradingView...</Text>
            <Text style={{color:C.tx4, fontSize:10, marginTop:4}}>Requires internet connection</Text>
          </View>
        )}
      />

      {/* TICK SIGNAL STRIP */}
      {conf ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sigStrip}>
          <View style={styles.sigRow}>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>SCORE</Text>
              <Text style={{color: conf.score>=70?C.gr:conf.score>=50?C.ye:C.re, fontSize:16, fontWeight:'800'}}>{conf.score}</Text>
            </View>
            <View style={styles.sigDivider}/>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>RSI(14)</Text>
              <Text style={{color: conf.r14>70?C.re:conf.r14<30?C.gr:C.ye, fontSize:13, fontWeight:'700'}}>{conf.r14?.toFixed(1)??'--'}</Text>
            </View>
            <View style={styles.sigDivider}/>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>RSI(4)</Text>
              <Text style={{color: conf.r4<33?C.gr:conf.r4>67?C.re:C.tx2, fontSize:13, fontWeight:'700'}}>{conf.r4?.toFixed(1)??'--'}</Text>
            </View>
            <View style={styles.sigDivider}/>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>REGIME</Text>
              <Text style={{color: conf.regimeColor, fontSize:11, fontWeight:'700'}}>{conf.regime}</Text>
            </View>
            <View style={styles.sigDivider}/>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>SETUP</Text>
              <Text style={{color: conf.direction?C.gr:C.tx3, fontSize:11, fontWeight:'700'}}>{conf.direction||'WAIT'}</Text>
            </View>
            <View style={styles.sigDivider}/>
            <View style={styles.sigItem}>
              <Text style={styles.sigLbl}>BOT</Text>
              <Text style={{color:C.ac, fontSize:10, fontWeight:'600'}}>{conf.bot||'--'}</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.sigStrip}>
          <Text style={{color:C.tx3, fontSize:10, textAlign:'center', padding:10, fontFamily:'monospace'}}>Connect API for live tick signals alongside chart</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:C.bg },
  symBar:    { backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd, maxHeight:44 },
  symRow:    { flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:6, gap:6 },
  chip:      { paddingHorizontal:10, paddingVertical:4, borderRadius:5, borderWidth:1, borderColor:C.bd2, backgroundColor:'transparent' },
  chipOn:    { backgroundColor:C.ac, borderColor:C.ac },
  chipTxt:   { fontSize:10, color:C.tx2, fontFamily:'monospace', fontWeight:'700' },
  tfBar:     { flexDirection:'row', alignItems:'center', paddingHorizontal:8, paddingVertical:5, backgroundColor:C.sf2, borderBottomWidth:1, borderBottomColor:C.bd, gap:4 },
  tfBtn:     { paddingHorizontal:10, paddingVertical:4, borderRadius:4, borderWidth:1, borderColor:C.bd3, backgroundColor:'transparent' },
  tfBtnOn:   { backgroundColor:C.ac, borderColor:C.ac },
  tfTxt:     { fontSize:10, color:C.tx2, fontFamily:'monospace', fontWeight:'700' },
  tvCredit:  { fontSize:9, color:C.tx4, fontFamily:'monospace' },
  chart:     { flex:1, backgroundColor:C.bg },
  loading:   { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:C.bg },
  sigStrip:  { maxHeight:56, backgroundColor:C.sf, borderTopWidth:1, borderTopColor:C.bd },
  sigRow:    { flexDirection:'row', alignItems:'center', paddingHorizontal:10, height:56 },
  sigItem:   { alignItems:'center', paddingHorizontal:12 },
  sigLbl:    { fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.8, marginBottom:2 },
  sigDivider:{ width:1, height:28, backgroundColor:C.bd2 },
});