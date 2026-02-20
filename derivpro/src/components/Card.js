import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export default function Card({ title, right, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:   { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, overflow:'hidden', marginBottom:10 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            paddingHorizontal:13, paddingVertical:9, backgroundColor:C.sf2,
            borderBottomWidth:1, borderBottomColor:C.bd },
  title:  { fontSize:10, fontWeight:'700', fontFamily:'monospace', textTransform:'uppercase',
            letterSpacing:1, color:C.tx3 },
  body:   { padding:12 },
});