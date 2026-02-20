import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, StyleSheet
} from 'react-native';
import { C } from '../theme';
import Card from '../components/Card';
import MemoryDB from '../memory';

const BOTS  = ['Bot#1 Even/Odd','Bot#2 Over/Under','Bot#3 Berlin X9','Bot#4 BeastO7','Bot#5 Gas Hunter','Bot#6 Hawk U5','Bot#7 Even Streak'];
const MKTS  = ['V75','V100','V25','V50','V10','1HZ100V'];
const CTS   = ['Even','Odd','Over 5','Under 5','Rise','Fall'];

function WinRateBar({ rate, label, color=C.gr }) {
  return (
    <View style={{marginBottom:8}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
        <Text style={{fontSize:10,color:C.tx2,fontFamily:'monospace'}}>{label}</Text>
        <Text style={{fontSize:10,color:color,fontFamily:'monospace',fontWeight:'700'}}>{rate}%</Text>
      </View>
      <View style={{height:5,backgroundColor:C.sf2,borderRadius:3,overflow:'hidden'}}>
        <View style={{width:rate+'%',height:'100%',backgroundColor:color,borderRadius:3}}/>
      </View>
    </View>
  );
}

export default function LogScreen({ trades, onAdd, onClear }) {
  const [form,   setForm]   = useState(false);
  const [tab,    setTab]    = useState('log');  // 'log'|'memory'|'insights'
  const [bot,    setBot]    = useState(0);
  const [mkt,    setMkt]    = useState(0);
  const [ct,     setCt]     = useState(0);
  const [stake,  setStake]  = useState('10');
  const [result, setResult] = useState('WIN');
  const [pnl,    setPnl]    = useState('');
  const [score,  setScore]  = useState('');
  const [notes,  setNotes]  = useState('');
  const [memStats, setMemStats] = useState([]);
  const [selBot, setSelBot] = useState(null);

  const wins   = trades.filter(t=>t.res==='WIN').length;
  const pnlTot = trades.reduce((a,t)=>a+(t.pnl||0), 0);
  const wr     = trades.length ? Math.round((wins/trades.length)*100) : 0;
  const streak = MemoryDB.getCurrentStreak();
  const martingale = MemoryDB.getMartingaleAdvice(parseFloat(stake)||10);

  // BinaryTool-style: consecutive analysis
  const recentResults = useMemo(()=>trades.slice(0,20).map(t=>t.res==='WIN'?'W':'L'), [trades]);
  const lastConsec = useMemo(()=>{
    if (!recentResults.length) return {type:'--',count:0};
    const first=recentResults[0]; let n=0;
    for (const r of recentResults) { if(r===first) n++; else break; }
    return {type:first==='W'?'WIN':'LOSS', count:n};
  },[recentResults]);

  const loadMemory = () => {
    setMemStats(MemoryDB.getAllStats());
    setTab('memory');
  };

  const submit = () => {
    const t = {
      id:Date.now(), time:new Date().toISOString(),
      bot:BOTS[bot], mkt:MKTS[mkt], ct:CTS[ct],
      stake:parseFloat(stake)||0, res:result,
      pnl:parseFloat(pnl)||0, score, notes,
    };
    onAdd(t);
    setForm(false); setPnl(''); setScore(''); setNotes('');
  };

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      {/* Tab bar */}
      <View style={s.tabRow}>
        {[['log','📋 Log'],['memory','🧠 Memory'],['insights','💡 Insights']].map(([k,l])=>(
          <TouchableOpacity key={k} onPress={()=>{ setTab(k); if(k==='memory') loadMemory(); }}
            style={[s.tabBtn, tab===k&&s.tabOn]}>
            <Text style={[s.tabTxt, tab===k&&{color:C.bg}]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:12}}>

        {/* ── TRADE LOG ─────────────────────────────────────────────────── */}
        {tab==='log' && (
          <>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <Text style={{fontSize:16,fontWeight:'800',color:C.tx}}>Trade Log</Text>
              <View style={{flexDirection:'row',gap:8}}>
                <TouchableOpacity onPress={()=>setForm(!form)}
                  style={{backgroundColor:C.ac,paddingHorizontal:14,paddingVertical:6,borderRadius:7}}>
                  <Text style={{color:C.bg,fontSize:10,fontWeight:'700',fontFamily:'monospace'}}>+ LOG</Text>
                </TouchableOpacity>
                {trades.length>0&&<TouchableOpacity
                  onPress={()=>Alert.alert('Clear All?','Delete all trades?',[{text:'Cancel'},{text:'Delete',style:'destructive',onPress:onClear}])}
                  style={{borderWidth:1,borderColor:'rgba(230,57,70,.35)',paddingHorizontal:12,paddingVertical:6,borderRadius:7}}>
                  <Text style={{color:C.re,fontSize:10,fontFamily:'monospace'}}>CLEAR</Text>
                </TouchableOpacity>}
              </View>
            </View>

            {/* Stats */}
            <View style={{flexDirection:'row',gap:0,marginBottom:10}}>
              {[['Trades',trades.length,C.ac],['Wins',wins,C.gr],['Losses',trades.length-wins,C.re],
                ['P&L',(pnlTot>=0?'+$':'-$')+Math.abs(pnlTot).toFixed(2),pnlTot>=0?C.gr:C.re]].map(([l,v,col])=>(
                <View key={l} style={{flex:1,backgroundColor:C.sf,borderTopWidth:2,borderTopColor:col,borderWidth:1,borderColor:C.bd,borderRadius:8,padding:10,margin:3}}>
                  <Text style={{fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',marginBottom:2}}>{l}</Text>
                  <Text style={{fontSize:17,fontWeight:'800',color:col}}>{v}</Text>
                </View>
              ))}
            </View>

            {/* BinaryTool-style analysis strip */}
            <View style={s.analysisStrip}>
              <View style={s.stripItem}>
                <Text style={s.stripLabel}>WIN RATE</Text>
                <Text style={[s.stripVal,{color:wr>=60?C.gr:wr>=50?C.ye:C.re}]}>{wr}%</Text>
              </View>
              <View style={s.stripDiv}/>
              <View style={s.stripItem}>
                <Text style={s.stripLabel}>STREAK</Text>
                <Text style={[s.stripVal,{color:lastConsec.type==='WIN'?C.gr:C.re}]}>
                  {lastConsec.count}{lastConsec.type==='WIN'?'W':'L'}
                </Text>
              </View>
              <View style={s.stripDiv}/>
              <View style={s.stripItem}>
                <Text style={s.stripLabel}>NEXT STAKE</Text>
                <Text style={[s.stripVal,{color:C.ye}]}>${martingale.suggested}</Text>
              </View>
              <View style={s.stripDiv}/>
              <View style={s.stripItem}>
                <Text style={s.stripLabel}>RISK</Text>
                <Text style={[s.stripVal,{color:martingale.risk==='HIGH'?C.re:martingale.risk==='MODERATE'?C.ye:C.gr}]}>
                  {martingale.risk}
                </Text>
              </View>
            </View>

            {/* Martingale advice */}
            {streak.count>=2&&(
              <View style={{backgroundColor:streak.type==='loss'?'rgba(230,57,70,.1)':'rgba(6,214,160,.08)',borderWidth:1,borderColor:streak.type==='loss'?'rgba(230,57,70,.35)':'rgba(6,214,160,.25)',borderRadius:8,padding:10,marginBottom:10}}>
                <Text style={{color:streak.type==='loss'?C.re:C.gr,fontWeight:'700',fontSize:11,fontFamily:'monospace',marginBottom:2}}>
                  {streak.type==='loss'?'⚠️ LOSS STREAK':'✅ WIN STREAK'} ({streak.count})
                </Text>
                <Text style={{color:C.tx2,fontSize:11}}>{martingale.reason}</Text>
              </View>
            )}

            {/* Recent results strip — binarytool style */}
            <View style={s.resultStrip}>
              <Text style={s.stripLabel2}>LAST 20 TRADES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{flexDirection:'row',gap:4}}>
                  {recentResults.map((r,i)=>(
                    <View key={i} style={[s.resultDot,{backgroundColor:r==='W'?C.gr:C.re}]}>
                      <Text style={{color:C.bg,fontSize:8,fontWeight:'800'}}>{r}</Text>
                    </View>
                  ))}
                  {recentResults.length===0&&<Text style={{color:C.tx3,fontSize:11}}>No trades yet</Text>}
                </View>
              </ScrollView>
            </View>

            {/* Add form */}
            {form&&(
              <View style={{backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,padding:12,marginBottom:12}}>
                <Text style={{fontSize:12,fontWeight:'700',color:C.ac,fontFamily:'monospace',marginBottom:10}}>NEW TRADE</Text>
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
                <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
                  <View style={{flex:1}}><Text style={s.fl}>Stake</Text><TextInput style={s.inp} value={stake} onChangeText={setStake} keyboardType="decimal-pad" placeholderTextColor={C.tx3}/></View>
                  <View style={{flex:1}}><Text style={s.fl}>P&L ($)</Text><TextInput style={s.inp} value={pnl} onChangeText={setPnl} keyboardType="decimal-pad" placeholder="e.g. 8.50" placeholderTextColor={C.tx3}/></View>
                  <View style={{flex:1}}><Text style={s.fl}>Score</Text><TextInput style={s.inp} value={score} onChangeText={setScore} keyboardType="numeric" placeholder="0-100" placeholderTextColor={C.tx3}/></View>
                </View>
                <Text style={s.fl}>Result</Text>
                <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
                  {['WIN','LOSS'].map(r=>(<TouchableOpacity key={r} onPress={()=>setResult(r)} style={{flex:1,paddingVertical:9,borderRadius:7,borderWidth:1,borderColor:result===r?(r==='WIN'?C.gr:C.re):C.bd2,backgroundColor:result===r?(r==='WIN'?'rgba(6,214,160,.15)':'rgba(230,57,70,.12)'):'transparent',alignItems:'center'}}><Text style={{color:result===r?(r==='WIN'?C.gr:C.re):C.tx3,fontWeight:'700',fontFamily:'monospace'}}>{r}</Text></TouchableOpacity>))}
                </View>
                <Text style={s.fl}>Notes</Text>
                <TextInput style={[s.inp,{marginBottom:12,height:60,textAlignVertical:'top'}]} value={notes} onChangeText={setNotes} multiline placeholder="What conditions did you see?" placeholderTextColor={C.tx3}/>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity onPress={submit} style={{flex:2,backgroundColor:'rgba(6,214,160,.12)',borderWidth:1,borderColor:'rgba(6,214,160,.3)',borderRadius:7,padding:11,alignItems:'center'}}><Text style={{color:C.gr,fontWeight:'700',fontFamily:'monospace'}}>SAVE</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>setForm(false)} style={{flex:1,borderWidth:1,borderColor:C.bd2,borderRadius:7,padding:11,alignItems:'center'}}><Text style={{color:C.tx3,fontFamily:'monospace'}}>CANCEL</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {/* Trade list */}
            {trades.map((t,i)=>(
              <View key={t.id} style={{backgroundColor:C.sf,borderRadius:8,borderWidth:1,borderColor:C.bd,borderLeftWidth:3,borderLeftColor:t.res==='WIN'?C.gr:C.re,padding:12,marginBottom:7}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                  <Text style={{fontSize:12,fontWeight:'600',color:C.tx}}>{t.bot?.replace('Bot','#')}</Text>
                  <Text style={{fontSize:14,fontWeight:'800',color:t.res==='WIN'?C.gr:C.re}}>{t.res}</Text>
                  <Text style={{fontSize:13,fontWeight:'700',color:t.pnl>=0?C.gr:C.re}}>{t.pnl>=0?'+$':'-$'}{Math.abs(t.pnl||0).toFixed(2)}</Text>
                </View>
                <View style={{flexDirection:'row',gap:12}}>
                  <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace'}}>{t.mkt} · {t.ct}</Text>
                  <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace'}}>$Stake:{t.stake}</Text>
                  {t.score?<Text style={{fontSize:9,color:C.ac,fontFamily:'monospace'}}>Score:{t.score}</Text>:null}
                </View>
                {t.notes?<Text style={{fontSize:10,color:C.tx2,marginTop:4,lineHeight:16}}>{t.notes}</Text>:null}
                <Text style={{fontSize:8,color:C.tx4,marginTop:3}}>{new Date(t.time).toLocaleString()}</Text>
              </View>
            ))}
            {trades.length===0&&<Text style={{color:C.tx3,textAlign:'center',padding:40,fontFamily:'monospace'}}>No trades yet. Log every trade — it builds your edge.</Text>}
          </>
        )}

        {/* ── MEMORY / PERFORMANCE DB ────────────────────────────────────── */}
        {tab==='memory' && (
          <>
            <Text style={{fontSize:16,fontWeight:'800',color:C.tx,marginBottom:4}}>Strategy Memory</Text>
            <Text style={{fontSize:11,color:C.tx3,marginBottom:14}}>Performance data derived from your logged trades. More trades = more accurate.</Text>

            {memStats.length===0?(
              <Text style={{color:C.tx3,textAlign:'center',padding:40,fontFamily:'monospace'}}>No memory yet — log trades to build your strategy database</Text>
            ):memStats.map(b=>(
              <TouchableOpacity key={b.bot} onPress={()=>setSelBot(selBot===b.bot?null:b.bot)}
                style={{backgroundColor:C.sf,borderRadius:9,borderWidth:1,borderColor:selBot===b.bot?C.ac:C.bd,padding:14,marginBottom:8}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <Text style={{fontSize:13,fontWeight:'700',color:C.tx}}>{b.bot?.replace('Bot','#')}</Text>
                  <Text style={{fontSize:18,fontWeight:'800',color:b.winRate>=60?C.gr:b.winRate>=50?C.ye:C.re}}>{b.winRate}%</Text>
                </View>
                <WinRateBar rate={b.winRate} label={`${b.wins}W / ${b.losses}L · ${b.count} trades`}
                  color={b.winRate>=60?C.gr:b.winRate>=50?C.ye:C.re}/>
                <View style={{flexDirection:'row',gap:14,marginTop:6}}>
                  <Text style={{fontSize:10,color:C.tx3,fontFamily:'monospace'}}>Avg score: <Text style={{color:C.ac}}>{Math.round(b.avgScore)}</Text></Text>
                  <Text style={{fontSize:10,color:C.tx3,fontFamily:'monospace'}}>Win avg: <Text style={{color:C.gr}}>{b.avgWinScore}</Text></Text>
                  <Text style={{fontSize:10,color:C.tx3,fontFamily:'monospace'}}>Loss avg: <Text style={{color:C.re}}>{b.avgLossScore}</Text></Text>
                  <Text style={{fontSize:10,color:C.tx3,fontFamily:'monospace'}}>P&L: <Text style={{color:b.totalPnl>=0?C.gr:C.re}}>${b.totalPnl.toFixed(2)}</Text></Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── INSIGHTS ─────────────────────────────────────────────────────── */}
        {tab==='insights' && (
          <>
            <Text style={{fontSize:16,fontWeight:'800',color:C.tx,marginBottom:4}}>AI Insights</Text>
            <Text style={{fontSize:11,color:C.tx3,marginBottom:14}}>Pattern analysis from your trade history. Updates automatically as you log more trades.</Text>

            <Text style={{fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>SELECT BOT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
              <View style={{flexDirection:'row',gap:6}}>
                {BOTS.map((b,i)=>(
                  <TouchableOpacity key={i} onPress={()=>setSelBot(b)}
                    style={{paddingHorizontal:10,paddingVertical:5,borderRadius:6,borderWidth:1,
                      borderColor:selBot===b?C.ac:C.bd2,backgroundColor:selBot===b?'rgba(230,57,70,.15)':'transparent'}}>
                    <Text style={{color:selBot===b?C.ac:C.tx3,fontSize:10,fontFamily:'monospace',fontWeight:'700'}}>{b.replace('Bot','#')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {selBot ? (
              <View style={{backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,padding:14}}>
                <Text style={{fontSize:13,fontWeight:'700',color:C.tx,marginBottom:10}}>{selBot}</Text>
                {MemoryDB.getInsights(selBot).map((insight,i)=>(
                  <View key={i} style={{flexDirection:'row',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.bd}}>
                    <Text style={{color:C.ac,fontSize:14}}>›</Text>
                    <Text style={{fontSize:12,color:C.tx2,flex:1,lineHeight:18}}>{insight}</Text>
                  </View>
                ))}
              </View>
            ):(
              <Text style={{color:C.tx3,textAlign:'center',padding:30,fontFamily:'monospace'}}>Select a bot above to see insights</Text>
            )}

            {/* Overall risk / session summary */}
            <View style={{backgroundColor:C.sf,borderRadius:10,borderWidth:1,borderColor:C.bd,padding:14,marginTop:14}}>
              <Text style={{fontSize:12,fontWeight:'700',color:C.ye,marginBottom:10,fontFamily:'monospace'}}>SESSION OVERVIEW</Text>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={{color:C.tx3,fontSize:11}}>Overall Win Rate</Text>
                <Text style={{color:wr>=60?C.gr:wr>=50?C.ye:C.re,fontWeight:'700'}}>{wr}%</Text>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={{color:C.tx3,fontSize:11}}>Current Streak</Text>
                <Text style={{color:streak.type==='win'?C.gr:C.re,fontWeight:'700'}}>{streak.count} {streak.type.toUpperCase()}</Text>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
                <Text style={{color:C.tx3,fontSize:11}}>Net P&L</Text>
                <Text style={{color:pnlTot>=0?C.gr:C.re,fontWeight:'700'}}>{pnlTot>=0?'+$':'-$'}{Math.abs(pnlTot).toFixed(2)}</Text>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                <Text style={{color:C.tx3,fontSize:11}}>Suggested Stake</Text>
                <Text style={{color:C.ye,fontWeight:'700'}}>${martingale.suggested} ({martingale.risk})</Text>
              </View>
            </View>
          </>
        )}

        <View style={{height:30}}/>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  tabRow:    {flexDirection:'row',backgroundColor:C.sf,borderBottomWidth:1,borderBottomColor:C.bd,padding:6,gap:5},
  tabBtn:    {flex:1,paddingVertical:7,borderRadius:6,borderWidth:1,borderColor:C.bd2,alignItems:'center'},
  tabOn:     {backgroundColor:C.ac,borderColor:C.ac},
  tabTxt:    {fontSize:10,color:C.tx2,fontFamily:'monospace',fontWeight:'700'},
  fl:        {fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:5},
  inp:       {backgroundColor:C.sf2,borderWidth:1,borderColor:C.bd2,borderRadius:7,paddingHorizontal:11,paddingVertical:8,color:C.tx,fontSize:13},
  chip:      {paddingHorizontal:10,paddingVertical:5,borderRadius:5,borderWidth:1,borderColor:C.bd2},
  chipOn:    {backgroundColor:C.ac,borderColor:C.ac},
  chipTxt:   {fontSize:10,color:C.tx2,fontFamily:'monospace',fontWeight:'700'},
  analysisStrip:{flexDirection:'row',backgroundColor:C.sf,borderRadius:9,borderWidth:1,borderColor:C.bd,marginBottom:10,padding:8},
  stripItem: {flex:1,alignItems:'center'},
  stripDiv:  {width:1,backgroundColor:C.bd2,marginVertical:4},
  stripLabel:{fontSize:7,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:0.8,marginBottom:3},
  stripVal:  {fontSize:16,fontWeight:'800'},
  resultStrip:{backgroundColor:C.sf,borderRadius:8,borderWidth:1,borderColor:C.bd,padding:10,marginBottom:10},
  stripLabel2:{fontSize:8,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:8},
  resultDot: {width:24,height:24,borderRadius:4,justifyContent:'center',alignItems:'center'},
});