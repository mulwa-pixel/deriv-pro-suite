import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function StatCard({ label, value, sub, accentColor=C.ac }) {
  return (
    <View style={[styles.card, {borderTopColor: accentColor}]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, {color: accentColor}]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex:1, backgroundColor:C.sf, borderRadius:10, padding:12,
          borderTopWidth:2, borderTopColor:C.ac, margin:4 },
  label: { fontSize:9, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
           letterSpacing:1, marginBottom:4 },
  value: { fontSize:20, fontWeight:'800', color:C.ac },
  sub:   { fontSize:10, color:C.tx3, marginTop:2 },
});