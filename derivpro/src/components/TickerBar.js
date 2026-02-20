import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { C, SYMS, SYM_LABELS, SYM_COLORS } from '../theme';

export default function TickerBar({ lastTick, prevTick }) {
  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {SYMS.map(sym => {
            const px = lastTick[sym];
            const prev = prevTick?.[sym];
            const chg = px && prev ? px - prev : 0;
            const col = chg > 0 ? C.gr : chg < 0 ? C.re : C.tx3;
            return (
              <View key={sym} style={styles.item}>
                <Text style={[styles.name, {color: SYM_COLORS[sym]}]}>
                  {SYM_LABELS[sym]?.replace('Index','').replace('Volatility','V').trim()}
                </Text>
                <Text style={styles.price}>{px ? px.toFixed(4) : '--'}</Text>
                <Text style={[styles.chg, {color: col}]}>
                  {px && prev ? (chg>=0?'+':'')+chg.toFixed(4) : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:   { height:32, backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd },
  row:   { flexDirection:'row', alignItems:'center', paddingHorizontal:8, height:32 },
  item:  { flexDirection:'row', alignItems:'center', gap:5, marginRight:20 },
  name:  { fontSize:10, fontFamily:'monospace', fontWeight:'700' },
  price: { fontSize:10, fontFamily:'monospace', color:C.tx },
  chg:   { fontSize:9, fontFamily:'monospace' },
});