import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';
import Badge from './Badge';

export default function IndicatorRow({ label, value, badgeLabel, badgeVariant='warn', valueColor=C.tx }) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, {color:valueColor}]}>{value}</Text>
      </View>
      {badgeLabel ? <Badge label={badgeLabel} variant={badgeVariant}/> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
           backgroundColor:C.sf2, borderRadius:7, borderWidth:1, borderColor:C.bd,
           paddingHorizontal:12, paddingVertical:8, marginBottom:5 },
  left:  { flex:1 },
  label: { fontSize:9, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:0.5, marginBottom:2 },
  value: { fontSize:14, fontWeight:'700', color:C.tx },
});