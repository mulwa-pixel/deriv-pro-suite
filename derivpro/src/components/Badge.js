import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

const STYLES = {
  bull: { bg:'rgba(0,230,118,.15)', border:'rgba(0,230,118,.3)', text:C.gr },
  bear: { bg:'rgba(255,23,68,.15)',  border:'rgba(255,23,68,.3)',  text:C.re },
  warn: { bg:'rgba(255,215,64,.1)',  border:'rgba(255,215,64,.2)', text:C.ye },
  info: { bg:'rgba(0,212,255,.1)',   border:'rgba(0,212,255,.2)',  text:C.ac },
  muted:{ bg:C.sf2,                  border:C.bd2,                 text:C.tx3 },
  pur:  { bg:'rgba(124,58,237,.15)', border:'rgba(124,58,237,.3)', text:C.pu2},
};

export default function Badge({ label, variant='warn' }) {
  const s = STYLES[variant] || STYLES.warn;
  return (
    <View style={[styles.b, {backgroundColor:s.bg, borderColor:s.border}]}>
      <Text style={[styles.t, {color:s.text}]}>{label}</Text>
    </View>
  );
}

export function variantFor(val, type) {
  if (type==='rsi14') return val>70?'bear':val<30?'bull':val>=40&&val<=60?'warn':'warn';
  if (type==='rsi4')  return val<33?'bull':val>67?'bear':'warn';
  if (type==='score') return val>=75?'bull':val>=55?'warn':val>=35?'warn':'bear';
  if (type==='bool')  return val?'bull':'bear';
  return 'warn';
}

const styles = StyleSheet.create({
  b: { paddingHorizontal:8, paddingVertical:2, borderRadius:4, borderWidth:1 },
  t: { fontSize:9, fontFamily:'monospace', fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
});