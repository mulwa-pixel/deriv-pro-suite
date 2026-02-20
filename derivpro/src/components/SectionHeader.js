import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function SectionHeader({ title, right }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line}/>
      {right ? right : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', marginBottom:12, marginTop:4 },
  title: { fontSize:13, fontWeight:'800', color:C.tx, marginRight:10 },
  line:  { flex:1, height:1, backgroundColor:C.bd },
});