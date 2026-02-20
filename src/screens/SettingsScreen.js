import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Linking, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../theme';
import { saveCreds, clearCreds } from '../credStore';
import Card from '../components/Card';

export default function SettingsScreen({ config, onSave, connected, onConnect, onDisconnect, status }) {
  const [appId,       setAppId]       = useState(config.appId  || '');
  const [token,       setToken]       = useState(config.token  || '');
  const [stake,       setStake]       = useState(String(config.stake       || 10));
  const [lossLimit,   setLossLimit]   = useState(String(config.lossLimit   || 50));
  const [profitTarget,setProfitTarget]= useState(String(config.profitTarget|| 100));
  const [autoConnect, setAutoConnect] = useState(config.autoConnect !== false);
  const [bgAlerts,    setBgAlerts]    = useState(config.bgAlerts !== false);
  const [saved,       setSaved]       = useState(false);

  // Sync when config prop changes (e.g. loaded from storage)
  useEffect(() => {
    setAppId(config.appId || '');
    setToken(config.token || '');
    setAutoConnect(config.autoConnect !== false);
  }, [config.appId, config.token]);

  const save = async () => {
    const c = {
      appId, token,
      stake:        parseFloat(stake)        || 10,
      lossLimit:    parseFloat(lossLimit)    || 50,
      profitTarget: parseFloat(profitTarget) || 100,
      autoConnect, bgAlerts,
    };
    await onSave(c);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const connectNow = () => {
    save();
    onConnect(appId, token);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg }}
      contentContainerStyle={{ padding:12 }}>

      {/* Status bar */}
      <View style={[s.statusBar, {
        backgroundColor: connected ? 'rgba(6,214,160,.08)' : 'rgba(230,57,70,.07)',
        borderColor:     connected ? 'rgba(6,214,160,.3)'  : 'rgba(230,57,70,.3)',
      }]}>
        <View style={[s.dot, {backgroundColor: connected ? C.gr : C.re}]}/>
        <Text style={[s.statusTxt, {color: connected ? C.gr : C.re}]}>
          {connected ? '● LIVE' : '○ DISCONNECTED'}
        </Text>
        <Text style={s.statusSub}>{status}</Text>
      </View>

      {/* API credentials */}
      <Card title="Deriv API — Auto-connect enabled">
        <View style={s.warningBox}>
          <Text style={{color:C.ye,fontSize:11,lineHeight:17}}>
            ⚠  Credentials saved on-device only. Token needs Trade + Read scope.
            Get yours at app.deriv.com/account/api-token
          </Text>
        </View>

        <Text style={s.fl}>App ID</Text>
        <TextInput style={s.inp} value={appId} onChangeText={setAppId}
          keyboardType="numeric" placeholder="e.g. 1089"
          placeholderTextColor={C.tx3} autoCapitalize="none"/>

        <Text style={[s.fl, {marginTop:10}]}>API Token (Read + Trade scopes)</Text>
        <TextInput style={[s.inp, {marginBottom:10}]} value={token}
          onChangeText={setToken} secureTextEntry
          placeholder="Your API token" placeholderTextColor={C.tx3}
          autoCapitalize="none"/>

        {/* Auto-connect toggle */}
        <View style={s.toggleRow}>
          <View style={{flex:1}}>
            <Text style={{color:C.tx,fontSize:12,fontWeight:'700'}}>Auto-connect on start</Text>
            <Text style={{color:C.tx3,fontSize:10,marginTop:2}}>
              App connects automatically when opened — no need to tap Connect every time
            </Text>
          </View>
          <Switch value={autoConnect} onValueChange={setAutoConnect}
            trackColor={{false:C.bd2, true:'rgba(230,57,70,.4)'}}
            thumbColor={autoConnect ? C.ac : C.tx3}/>
        </View>

        <View style={{flexDirection:'row',gap:8,marginTop:10}}>
          <TouchableOpacity onPress={connectNow}
            style={[s.btn, {backgroundColor:'rgba(230,57,70,.15)',
              borderColor:'rgba(230,57,70,.4)'}]}>
            <Text style={{color:C.ac,fontWeight:'800',fontFamily:'monospace'}}>CONNECT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDisconnect}
            style={[s.btn, {borderColor:C.bd2}]}>
            <Text style={{color:C.tx3,fontWeight:'800',fontFamily:'monospace'}}>DISCONNECT</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://app.deriv.com/account/api-token')}
          style={{marginTop:10,alignItems:'center'}}>
          <Text style={{color:C.ac,fontSize:11,textDecorationLine:'underline'}}>
            Get API token from Deriv →
          </Text>
        </TouchableOpacity>
      </Card>

      {/* Background mode */}
      <Card title="Background Mode">
        <View style={s.toggleRow}>
          <View style={{flex:1}}>
            <Text style={{color:C.tx,fontSize:12,fontWeight:'700'}}>
              Background signal alerts
            </Text>
            <Text style={{color:C.tx3,fontSize:10,marginTop:2,lineHeight:15}}>
              When app is in background, the WebSocket stays connected and
              a notification fires when Entry Score reaches 70+.
              Requires Expo Notifications permission.
            </Text>
          </View>
          <Switch value={bgAlerts} onValueChange={setBgAlerts}
            trackColor={{false:C.bd2, true:'rgba(6,214,160,.4)'}}
            thumbColor={bgAlerts ? C.gr : C.tx3}/>
        </View>
        <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace',marginTop:8,lineHeight:14}}>
          {'Note: On Android, enable "Allow background activity" for this app in\n'}
          {'Battery settings → App battery usage → Unrestricted.'}
        </Text>
      </Card>

      {/* Risk management */}
      <Card title="Risk Management">
        {[
          ['Default Stake ($)', stake, setStake],
          ['Daily Loss Limit ($)', lossLimit, setLossLimit],
          ['Profit Target ($)', profitTarget, setProfitTarget],
        ].map(([l,v,set]) => (
          <View key={l} style={{marginBottom:12}}>
            <Text style={s.fl}>{l}</Text>
            <TextInput style={s.inp} value={v} onChangeText={set}
              keyboardType="decimal-pad" placeholderTextColor={C.tx3}/>
          </View>
        ))}

        <TouchableOpacity onPress={save}
          style={[s.btn, {
            backgroundColor: saved ? 'rgba(6,214,160,.15)' : 'rgba(6,214,160,.08)',
            borderColor:     saved ? 'rgba(6,214,160,.5)'  : 'rgba(6,214,160,.25)',
            width:'100%', justifyContent:'center',
          }]}>
          <Text style={{color: saved ? C.gr : C.tx2, fontWeight:'800', fontFamily:'monospace'}}>
            {saved ? '✓ SAVED' : 'SAVE SETTINGS'}
          </Text>
        </TouchableOpacity>
      </Card>

      {/* Bot schedule reference */}
      <Card title="Bot Session Schedule">
        {[
          ['🌅 Morning  08-12 UTC', 'Bot #1, #3, #7', C.ye],
          ['☀️  Afternoon 12-18 UTC','Bot #2, #4, #7', C.ac],
          ['🌆 Evening  16-18 UTC', 'Bot #5, #6',     C.or],
          ['🚫 Off-Hours',          'NO TRADES',       C.re],
        ].map(([sess,bots,col]) => (
          <View key={sess} style={[s.sessRow, {borderBottomColor:C.bd}]}>
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
  statusBar:  { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1,
                borderRadius:10, padding:12, marginBottom:14 },
  dot:        { width:8, height:8, borderRadius:4 },
  statusTxt:  { fontFamily:'monospace', fontSize:12, fontWeight:'800', flex:1 },
  statusSub:  { color:'#505060', fontSize:10 },
  warningBox: { backgroundColor:'rgba(255,215,64,.06)', borderWidth:1,
                borderColor:'rgba(255,215,64,.2)', borderRadius:7, padding:10, marginBottom:12 },
  fl:         { fontSize:9, color:'#505060', fontFamily:'monospace',
                textTransform:'uppercase', letterSpacing:1, marginBottom:5 },
  inp:        { backgroundColor:'#0f0f18', borderWidth:1, borderColor:'#22223a',
                borderRadius:7, paddingHorizontal:11, paddingVertical:8,
                color:'#f0f0f0', fontSize:13 },
  btn:        { flex:1, borderWidth:1, borderRadius:7, padding:11, alignItems:'center' },
  toggleRow:  { flexDirection:'row', alignItems:'center', gap:12,
                paddingVertical:10, borderTopWidth:1, borderTopColor:'#1a1a2e' },
  sessRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                paddingVertical:9, borderBottomWidth:1 },
});
