import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { C } from '../theme';
import Card from '../components/Card';
import SectionHeader from '../components/SectionHeader';

const BOTS = ['Bot#1 Even/Odd','Bot#2 Over/Under','Bot#3 Berlin X9','Bot#4 BeastO7','Bot#5 Gas Hunter','Bot#6 Hawk U5','Bot#7 Even Streak'];
const MKTS = ['V75','V100','V25','V50','V10','1HZ100V'];
const CTS  = ['Even','Odd','Over 5','Under 5','Rise','Fall'];

export default function LogScreen({ trades, onAdd, onClear }) {
  const [form, setForm] = useState(false);
  const [bot, setBot] = useState(0);
  const [mkt, setMkt] = useState(0);
  const [ct, setCt] = useState(0);
  const [stake, setStake] = useState('10');
  const [result, setResult] = useState('WIN');
  const [pnl, setPnl] = useState('');
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');

  const submit = () => {
    onAdd({id:Date.now(),time:new Date().toISOString(),bot:BOTS[bot],mkt:MKTS[mkt],ct:CTS[ct],stake:parseFloat(stake)||0,res:result,pnl:parseFloat(pnl)||0,score,notes});
    setForm(false); setPnl(''); setScore(''); setNotes('');
  };

  const wins=trades.filter(t=>t.res==='WIN').length;
  const pnlTotal=trades.reduce((a,t)=>a+t.pnl,0);
  const wr=trades.length?Math.round((wins/trades.length)*100):0;

  return (
    <ScrollView style={{flex:1,backgroundColor:C.bg}} contentContainerStyle={{padding:12}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <Text style={{fontSize:16,fontWeight:'800',color:C.tx}}>Trade Log</Text>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity onPress={()=>setForm(!form)}
            style={{backgroundColor:C.ac,paddingHorizontal:14,paddingVertical:6,borderRadius:7}}>
            <Text style={{color:C.bg,fontSize:10,fontWeight:'700',fontFamily:'monospace'}}>+ LOG TRADE</Text>
          </TouchableOpacity>
          {trades.length>0&&<TouchableOpacity onPress={()=>{Alert.alert('Clear All?','Delete all trades?',[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:onClear}])}}
            style={{borderWidth:1,borderColor:'rgba(255,23,68,.35)',paddingHorizontal:12,paddingVertical:6,borderRadius:7}}>
            <Text style={{color:C.re,fontSize:10,fontFamily:'monospace'}}>CLEAR</Text>
          </TouchableOpacity>}
        </View>
      </View>

      {/* Stats */}
      <View style={{flexDirection:'row',gap:0,marginBottom:10}}>
        {[['Total',trades.length,C.ac],['Wins',wins,C.gr],['Losses',trades.length-wins,C.re],['P&L',(pnlTotal>=0?'+$':'-$')+Math.abs(pnlTotal).toFixed(2),pnlTotal>=0?C.gr:C.re]].map(([l,v,col])=>(
          <View key={l} style={{flex:1,backgroundColor:C.sf,borderTopWidth:2,borderTopColor:col,borderWidth:1,borderColor:C.bd,borderRadius:9,padding:10,margin:3}}>
            <Text style={{fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',marginBottom:3}}>{l}</Text>
            <Text style={{fontSize:18,fontWeight:'800',color:col}}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Add Form */}
      {form&&(
        <Card title="New Trade Entry">
          <Text style={s.fl}>Bot</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
            <View style={{flexDirection:'row',gap:5}}>
              {BOTS.map((b,i)=>(<TouchableOpacity key={i} onPress={()=>setBot(i)} style={[s.chip,bot===i&&s.chipOn]}><Text style={[s.chipTxt,bot===i&&{color:C.bg}]}>{b.replace('Bot','#')}</Text></TouchableOpacity>))}
            </View>
          </ScrollView>
          <Text style={s.fl}>Market</Text>
          <View style={{flexDirection:'row',gap:5,marginBottom:10,flexWrap:'wrap'}}>
            {MKTS.map((m,i)=>(<TouchableOpacity key={i} onPress={()=>setMkt(i)} style={[s.chip,mkt===i&&s.chipOn]}><Text style={[s.chipTxt,mkt===i&&{color:C.bg}]}>{m}</Text></TouchableOpacity>))}
          </View>
          <Text style={s.fl}>Contract</Text>
          <View style={{flexDirection:'row',gap:5,marginBottom:10,flexWrap:'wrap'}}>
            {CTS.map((c,i)=>(<TouchableOpacity key={i} onPress={()=>setCt(i)} style={[s.chip,ct===i&&s.chipOn]}><Text style={[s.chipTxt,ct===i&&{color:C.bg}]}>{c}</Text></TouchableOpacity>))}
          </View>
          <View style={{flexDirection:'row',gap:10,marginBottom:10}}>
            <View style={{flex:1}}>
              <Text style={s.fl}>Stake ($)</Text>
              <TextInput style={s.inp} value={stake} onChangeText={setStake} keyboardType="decimal-pad" placeholderTextColor={C.tx3}/>
            </View>
            <View style={{flex:1}}>
              <Text style={s.fl}>P&L ($)</Text>
              <TextInput style={s.inp} value={pnl} onChangeText={setPnl} keyboardType="decimal-pad" placeholder="e.g. 8.50" placeholderTextColor={C.tx3}/>
            </View>
          </View>
          <Text style={s.fl}>Result</Text>
          <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
            {['WIN','LOSS'].map(r=>(<TouchableOpacity key={r} onPress={()=>setResult(r)} style={{flex:1,paddingVertical:8,borderRadius:7,borderWidth:1,borderColor:result===r?(r==='WIN'?C.gr:C.re):C.bd2,backgroundColor:result===r?(r==='WIN'?'rgba(0,230,118,.15)':'rgba(255,23,68,.12)'):'transparent',alignItems:'center'}}><Text style={{color:result===r?(r==='WIN'?C.gr:C.re):C.tx3,fontWeight:'700',fontFamily:'monospace'}}>{r}</Text></TouchableOpacity>))}
          </View>
          <Text style={s.fl}>Entry Score</Text>
          <TextInput style={[s.inp,{marginBottom:10}]} value={score} onChangeText={setScore} keyboardType="numeric" placeholder="e.g. 78" placeholderTextColor={C.tx3}/>
          <Text style={s.fl}>Notes</Text>
          <TextInput style={[s.inp,{marginBottom:12,height:70,textAlignVertical:'top'}]} value={notes} onChangeText={setNotes} multiline placeholder="RSI was 28, conditions met..." placeholderTextColor={C.tx3}/>
          <View style={{flexDirection:'row',gap:8}}>
            <TouchableOpacity onPress={submit} style={{flex:1,backgroundColor:'rgba(0,230,118,.15)',borderWidth:1,borderColor:'rgba(0,230,118,.3)',borderRadius:7,padding:10,alignItems:'center'}}>
              <Text style={{color:C.gr,fontWeight:'700',fontFamily:'monospace'}}>SAVE TRADE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setForm(false)} style={{flex:1,backgroundColor:'rgba(255,23,68,.1)',borderWidth:1,borderColor:'rgba(255,23,68,.25)',borderRadius:7,padding:10,alignItems:'center'}}>
              <Text style={{color:C.re,fontWeight:'700',fontFamily:'monospace'}}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Trade Table */}
      {trades.length>0 ? (
        <Card title="Trade History">
          {trades.map((t,i)=>(
            <View key={t.id} style={{borderBottomWidth:i<trades.length-1?1:0,borderBottomColor:C.bd,paddingVertical:9}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <Text style={{fontSize:11,fontWeight:'600',color:C.tx}}>{t.bot.replace('Bot#','#')}</Text>
                <Text style={[{fontSize:13,fontWeight:'800'},{color:t.res==='WIN'?C.gr:C.re}]}>{t.res}</Text>
                <Text style={[{fontSize:13,fontWeight:'700'},{color:t.pnl>=0?C.gr:C.re}]}>{t.pnl>=0?'+$':'-$'}{Math.abs(t.pnl).toFixed(2)}</Text>
              </View>
              <View style={{flexDirection:'row',gap:10}}>
                <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace'}}>{t.mkt} · {t.ct}</Text>
                <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace'}}>Stake: ${t.stake}</Text>
                {t.score?<Text style={{fontSize:9,color:C.ac,fontFamily:'monospace'}}>Score:{t.score}</Text>:null}
              </View>
              {t.notes?<Text style={{fontSize:10,color:C.tx2,marginTop:3,lineHeight:15}}>{t.notes}</Text>:null}
              <Text style={{fontSize:8,color:C.tx4,marginTop:2}}>{new Date(t.time).toLocaleString()}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <View style={{alignItems:'center',padding:40}}>
          <Text style={{color:C.tx3,fontFamily:'monospace',textAlign:'center'}}>No trades yet.{'\n'}Every trade logged = every mistake avoided.</Text>
        </View>
      )}
      <View style={{height:20}}/>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fl:   {fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:5},
  inp:  {backgroundColor:C.sf2,borderWidth:1,borderColor:C.bd2,borderRadius:7,paddingHorizontal:11,paddingVertical:8,color:C.tx,fontSize:13},
  chip: {paddingHorizontal:10,paddingVertical:5,borderRadius:5,borderWidth:1,borderColor:C.bd2},
  chipOn:{backgroundColor:C.ac,borderColor:C.ac},
  chipTxt:{fontSize:10,color:C.tx2,fontFamily:'monospace',fontWeight:'700'},
});