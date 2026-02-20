import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function ScoreGauge({ score=0 }) {
  const color = score>=75?C.gr : score>=55?C.ye : score>=35?C.or : C.re;
  const word  = score>=80?'TRADE NOW':score>=65?'LIKELY':score>=50?'PARTIAL':score>=35?'WAIT':'NO SETUP';
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, {borderColor: color+'55'}]}>
        <Text style={[styles.num, {color}]}>{score}</Text>
        <Text style={styles.denom}>/100</Text>
      </View>
      <Text style={[styles.word, {color}]}>{word}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, {width: score+'%', backgroundColor: color}]}/>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { alignItems:'center', padding:12 },
  ring:    { width:96, height:96, borderRadius:48, borderWidth:3, justifyContent:'center', alignItems:'center', marginBottom:8 },
  num:     { fontSize:32, fontWeight:'800' },
  denom:   { fontSize:11, color:C.tx3 },
  word:    { fontSize:18, fontWeight:'800', marginBottom:8 },
  bar:     { width:'100%', height:6, backgroundColor:C.sf2, borderRadius:3, overflow:'hidden' },
  barFill: { height:'100%', borderRadius:3 },
});