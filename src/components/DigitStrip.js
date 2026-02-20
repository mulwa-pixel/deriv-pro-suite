import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function DigitStrip({ digits=[] }) {
  const last20 = digits.slice(-20);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {last20.map((d, i) => (
          <View key={i} style={[styles.box, d%2===0 ? styles.even : styles.odd]}>
            <Text style={[styles.txt, {color: d%2===0 ? C.ac : C.pu2}]}>{d}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection:'row', gap:4, paddingVertical:4 },
  box:  { width:28, height:28, borderRadius:5, justifyContent:'center', alignItems:'center', borderWidth:1 },
  even: { backgroundColor:'rgba(0,212,255,.15)', borderColor:'rgba(0,212,255,.3)' },
  odd:  { backgroundColor:'rgba(124,58,237,.15)', borderColor:'rgba(124,58,237,.3)' },
  txt:  { fontSize:11, fontWeight:'700', fontFamily:'monospace' },
});