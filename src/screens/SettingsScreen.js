import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { C } from '../theme';
import Card from '../components/Card';

export default function SettingsScreen({ config, onSave, connected, onConnect, onDisconnect, status }) {
  const [appId, setAppId] = useState(config.appId||'');
  const [token, setToken] = useState(config.token||'');
  const [stake, setStake] = useState(String(config.stake||10));
  const [lossLimit, setLossLimit] = useState(String(config.lossLimit||50));
  const [profitTarget, setProfitTarget] = useState(String(config.profitTarget||100));

  return (
    <ScrollView style={{flex:1,backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      <Text style={{fontSize:16,fontWeight:'800',color:C.tx,marginBottom:14}}>Settings</Text>

      {/* Connection status */}
      <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14,
        backgroundColor:connected?'rgba(0,230,118,.07)':'rgba(255,23,68,.07)',
        borderWidth:1,borderColor:connected?'rgba(0,230,118,.3)':'rgba(255,23,68,.3)',
        borderRadius:10,padding:12}}>
        <View style={{width:10,height:10,borderRadius:5,backgroundColor:connected?C.gr:C.re}}/>
        <Text style={{color:connected?C.gr:C.re,fontFamily:'monospace',fontSize:12,fontWeight:'700',flex:1}}>
          {connected?'CONNECTED':'DISCONNECTED'}
        </Text>
        <Text style={{color:C.tx3,fontSize:10}}>{status}</Text>
      </View>

      <Card title="Deriv WebSocket API">
        <View style={{backgroundColor:'rgba(255,215,64,.06)',borderWidth:1,borderColor:'rgba(255,215,64,.2)',borderRadius:7,padding:10,marginBottom:12}}>
          <Text style={{color:C.ye,fontSize:11,lineHeight:17}}>⚠ Credentials stored on-device only. Never share your token. Get your App ID at app.deriv.com/account/api-token</Text>
        </View>
        <Text style={s.fl}>App ID</Text>
        <TextInput style={s.inp} value={appId} onChangeText={setAppId} keyboardType="numeric" placeholder="e.g. 1089" placeholderTextColor={C.tx3}/>
        <Text style={[s.fl,{marginTop:10}]}>API Token (Read + Trade scope)</Text>
        <TextInput style={[s.inp,{marginBottom:14}]} value={token} onChangeText={setToken} secureTextEntry placeholder="Your API token" placeholderTextColor={C.tx3}/>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity onPress={()=>onConnect(appId,token)}
            style={{flex:1,backgroundColor:'rgba(0,212,255,.15)',borderWidth:1,borderColor:'rgba(0,212,255,.3)',borderRadius:7,padding:11,alignItems:'center'}}>
            <Text style={{color:C.ac,fontWeight:'700',fontFamily:'monospace'}}>CONNECT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDisconnect}
            style={{flex:1,borderWidth:1,borderColor:'rgba(255,23,68,.3)',borderRadius:7,padding:11,alignItems:'center'}}>
            <Text style={{color:C.re,fontWeight:'700',fontFamily:'monospace'}}>DISCONNECT</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={()=>Linking.openURL('https://app.deriv.com/account/api-token')}
          style={{marginTop:10,alignItems:'center'}}>
          <Text style={{color:C.ac,fontSize:11,textDecorationLine:'underline'}}>Get API token from Deriv →</Text>
        </TouchableOpacity>
      </Card>

      <Card title="Risk Management">
        {[['Default Stake ($)',stake,setStake],['Daily Loss Limit ($)',lossLimit,setLossLimit],['Profit Target ($)',profitTarget,setProfitTarget]].map(([l,v,set])=>(
          <View key={l} style={{marginBottom:12}}>
            <Text style={s.fl}>{l}</Text>
            <TextInput style={s.inp} value={v} onChangeText={set} keyboardType="decimal-pad" placeholderTextColor={C.tx3}/>
          </View>
        ))}
        <TouchableOpacity onPress={()=>onSave({appId,token,stake:parseFloat(stake)||10,lossLimit:parseFloat(lossLimit)||50,profitTarget:parseFloat(profitTarget)||100})}
          style={{backgroundColor:'rgba(0,230,118,.12)',borderWidth:1,borderColor:'rgba(0,230,118,.25)',borderRadius:7,padding:11,alignItems:'center'}}>
          <Text style={{color:C.gr,fontWeight:'700',fontFamily:'monospace'}}>SAVE SETTINGS</Text>
        </TouchableOpacity>
      </Card>

      <Card title="How to Use — Professional Workflow">
        <Text style={{color:C.tx2,fontSize:12,lineHeight:20}}>
          {'1. '}<Text style={{color:C.ac,fontWeight:'700'}}>Pro Chart tab</Text>{' → Set your symbol + timeframe. Use TradingView to identify the trend direction and key S/R levels on 5m/15m.\n\n'}
          {'2. '}<Text style={{color:C.gr,fontWeight:'700'}}>Tick Chart tab</Text>{' → Analyse sub-minute price action. Watch the Entry Score — only trade when it\'s ≥70.\n\n'}
          {'3. '}<Text style={{color:C.ye,fontWeight:'700'}}>Scanner tab</Text>{' → Confirm which specific bot has a high score. Never trade a bot with <60%.\n\n'}
          {'4. '}<Text style={{color:C.or,fontWeight:'700'}}>Log EVERY trade</Text>{' — wins and losses. Review journal weekly. This is how you stop trading like a gamble.\n\n'}
          <Text style={{color:C.re,fontWeight:'700'}}>GOLDEN RULE: </Text>{'RSI 40-60 = DEAD ZONE. No trades. Walk away.'}
        </Text>
      </Card>

      <Card title="Bot Schedule">
        {[['🌅 Morning 08-12 UTC','Bot#1, #3, #7',C.ye],['☀️ Afternoon 12-18 UTC','Bot#2, #4, #7',C.ac],['🌆 Evening 16-18 UTC','Bot#5, #6',C.or]].map(([sess,bots,col])=>(
          <View key={sess} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.bd}}>
            <Text style={{color:col,fontSize:12,fontWeight:'600'}}>{sess}</Text>
            <Text style={{color:C.tx2,fontSize:11,fontFamily:'monospace'}}>{bots}</Text>
          </View>
        ))}
      </Card>

      <View style={{height:30}}/>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fl:  {fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:5},
  inp: {backgroundColor:C.sf2,borderWidth:1,borderColor:C.bd2,borderRadius:7,paddingHorizontal:11,paddingVertical:8,color:C.tx,fontSize:13,marginBottom:0},
});