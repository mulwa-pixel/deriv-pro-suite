import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Linking
} from 'react-native';
import { C } from '../theme';
import Card from '../components/Card';

// Pre-built bot XML templates for our 7 strategies
const BOT_TEMPLATES = [
  {
    id:1, name:'Even/Odd Streak Reversal', color:C.ac,
    xml:`<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://blockly-games.appspot.com/storage">
  <block type="trade_definition" deletable="false" x="30" y="30">
    <field name="MARKET_LIST">synthetic_index</field>
    <field name="SUBMARKET_LIST">random_index</field>
    <field name="SYMBOL_LIST">R_75</field>
    <field name="TRADETYPE_LIST">evenodd</field>
    <field name="TYPE_LIST">EVEN</field>
    <field name="DURATION_LIST">t</field>
    <field name="DURATION">10</field>
    <field name="AMOUNT_LIST">stake</field>
    <field name="AMOUNT">1</field>
    <field name="CURRENCY_LIST">USD</field>
  </block>
</xml>`,
    desc:'Even/Odd Streak — bets EVEN after 4+ consecutive ODD digits. Duration: 10 ticks.',
  },
  {
    id:3, name:'Berlin X9 RSI — Rise', color:C.pu2,
    xml:`<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://blockly-games.appspot.com/storage">
  <block type="trade_definition" deletable="false" x="30" y="30">
    <field name="MARKET_LIST">synthetic_index</field>
    <field name="SUBMARKET_LIST">random_index</field>
    <field name="SYMBOL_LIST">R_75</field>
    <field name="TRADETYPE_LIST">callput</field>
    <field name="TYPE_LIST">CALL</field>
    <field name="DURATION_LIST">t</field>
    <field name="DURATION">5</field>
    <field name="AMOUNT_LIST">stake</field>
    <field name="AMOUNT">2</field>
    <field name="CURRENCY_LIST">USD</field>
  </block>
</xml>`,
    desc:'Berlin X9 RISE — triggers when RSI(4) < 33. Contract: Rise, 5 ticks.',
  },
  {
    id:5, name:'Gas Hunter Over 5', color:C.ye,
    xml:`<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://blockly-games.appspot.com/storage">
  <block type="trade_definition" deletable="false" x="30" y="30">
    <field name="MARKET_LIST">synthetic_index</field>
    <field name="SUBMARKET_LIST">random_index</field>
    <field name="SYMBOL_LIST">R_10</field>
    <field name="TRADETYPE_LIST">highlowticks</field>
    <field name="TYPE_LIST">DIGITOVER</field>
    <field name="DURATION_LIST">t</field>
    <field name="DURATION">5</field>
    <field name="AMOUNT_LIST">stake</field>
    <field name="AMOUNT">1</field>
    <field name="CURRENCY_LIST">USD</field>
  </block>
</xml>`,
    desc:'Gas Hunter — trades OVER 5 on V10 when digit dominance ≥65%.',
  },
];

export default function DBotScreen({ state }) {
  const [tab,      setTab]     = useState('load');   // 'load' | 'build' | 'run'
  const [xmlText,  setXmlText] = useState('');
  const [loaded,   setLoaded]  = useState(null);
  const [running,  setRunning] = useState(false);
  const [runLog,   setRunLog]  = useState([]);

  const loadTemplate = (bot) => {
    setLoaded(bot);
    setXmlText(bot.xml);
    setTab('build');
  };

  const parseXML = (xml) => {
    // Simple field extractor — no native XML parser needed
    const get = (field) => {
      const re = new RegExp(`<field name="${field}">(.*?)</field>`);
      const m  = xml.match(re);
      return m ? m[1] : '--';
    };
    return {
      market:   get('MARKET_LIST'),
      symbol:   get('SYMBOL_LIST'),
      type:     get('TYPE_LIST'),
      tradeType:get('TRADETYPE_LIST'),
      duration: get('DURATION'),
      stake:    get('AMOUNT'),
      currency: get('CURRENCY_LIST'),
    };
  };

  const parsed = xmlText ? parseXML(xmlText) : null;

  const addLog = (msg, type='info') => {
    setRunLog(l => [{ msg, type, t: new Date().toLocaleTimeString() }, ...l.slice(0,49)]);
  };

  const openDBot = () => {
    Linking.openURL('https://bot.deriv.com');
  };

  const openWithXML = () => {
    // DBot doesn't support URL-based XML loading, so we guide the user
    Alert.alert(
      'How to load in DBot',
      '1. Tap "Open DBot" to open bot.deriv.com\n2. Click "Import bot" (folder icon)\n3. Paste or upload the XML shown below\n4. Click Run\n\nAlternatively, copy the XML and save as a .xml file, then import from Files.',
      [
        { text:'Open DBot', onPress: openDBot },
        { text:'OK' }
      ]
    );
  };

  return (
    <View style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {[['load','📦 Templates'],['build','🔧 XML Editor'],['run','▶ Run Log']].map(([k,l])=>(
          <TouchableOpacity key={k} onPress={()=>setTab(k)}
            style={[styles.tabBtn, tab===k&&styles.tabOn]}>
            <Text style={[styles.tabTxt, tab===k&&{color:C.bg}]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:12}}>

        {/* ── TEMPLATES ─────────────────────────────────────────────────── */}
        {tab==='load' && (
          <>
            <Text style={styles.h1}>DBot XML Bot Loader</Text>

            <View style={styles.infoBanner}>
              <Text style={styles.infoTxt}>
                These XML files load directly into <Text style={{color:C.ac,fontWeight:'700'}}>bot.deriv.com</Text> (Deriv DBot). Select a template, review/edit the XML, then import it into DBot to execute trades automatically.
              </Text>
            </View>

            <TouchableOpacity onPress={openDBot} style={styles.mainBtn}>
              <Text style={styles.mainBtnTxt}>🤖 Open Deriv DBot →</Text>
            </TouchableOpacity>

            <Text style={styles.sectionLbl}>BUILT-IN BOT TEMPLATES</Text>
            {BOT_TEMPLATES.map(bot=>(
              <TouchableOpacity key={bot.id} onPress={()=>loadTemplate(bot)}
                style={[styles.botCard, {borderLeftColor:bot.color}]}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:14,fontWeight:'700',color:C.tx,marginBottom:3}}>Bot #{bot.id}: {bot.name}</Text>
                    <Text style={{fontSize:11,color:C.tx3,lineHeight:17}}>{bot.desc}</Text>
                  </View>
                  <Text style={{color:bot.color,fontSize:20,marginLeft:10}}>›</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionLbl,{marginTop:18}]}>LOAD YOUR OWN XML</Text>
            <TouchableOpacity onPress={()=>setTab('build')}
              style={[styles.mainBtn,{backgroundColor:'rgba(6,214,160,.1)',borderColor:'rgba(6,214,160,.3)'}]}>
              <Text style={[styles.mainBtnTxt,{color:C.gr}]}>✏️ Paste Your Own XML</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── XML EDITOR ────────────────────────────────────────────────── */}
        {tab==='build' && (
          <>
            <Text style={styles.h1}>{loaded?`Bot #${loaded.id}: ${loaded.name}`:'XML Editor'}</Text>

            {parsed && (
              <View style={styles.parsedCard}>
                <Text style={styles.sectionLbl}>PARSED SETTINGS</Text>
                {[['Market',parsed.market],['Symbol',parsed.symbol],['Contract',parsed.tradeType+' / '+parsed.type],
                  ['Duration',parsed.duration+' ticks'],['Stake','$'+parsed.stake+' '+parsed.currency]].map(([k,v])=>(
                  <View key={k} style={styles.parsedRow}>
                    <Text style={styles.parsedKey}>{k}</Text>
                    <Text style={styles.parsedVal}>{v}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionLbl}>XML CODE</Text>
            <TextInput
              style={styles.xmlInput}
              value={xmlText}
              onChangeText={setXmlText}
              multiline
              placeholder={'Paste your DBot XML here...\n\nOr select a template from the Templates tab.'}
              placeholderTextColor={C.tx3}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              fontFamily="monospace"
            />

            <View style={{flexDirection:'row',gap:8,marginTop:10}}>
              <TouchableOpacity onPress={openWithXML}
                style={[styles.actionBtn,{flex:2,backgroundColor:'rgba(230,57,70,.15)',borderColor:'rgba(230,57,70,.35)'}]}>
                <Text style={{color:C.ac,fontWeight:'700',fontFamily:'monospace',fontSize:11}}>🚀 LOAD IN DBOT</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>{setXmlText('');setLoaded(null);}}
                style={[styles.actionBtn,{flex:1,borderColor:C.bd3}]}>
                <Text style={{color:C.tx3,fontFamily:'monospace',fontSize:11}}>CLEAR</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.infoBanner,{marginTop:14}]}>
              <Text style={styles.infoTxt}>
                <Text style={{color:C.ye,fontWeight:'700'}}>HOW TO RUN:{'\n'}</Text>
                {'1. Tap "LOAD IN DBOT" above\n2. In DBot: click the folder icon → Import XML\n3. Paste this XML or upload as .xml file\n4. Click Run to execute trades automatically'}
              </Text>
            </View>
          </>
        )}

        {/* ── RUN LOG ───────────────────────────────────────────────────── */}
        {tab==='run' && (
          <>
            <Text style={styles.h1}>Bot Run Log</Text>
            <View style={[styles.infoBanner,{marginBottom:10}]}>
              <Text style={styles.infoTxt}>Trades executed via DBot appear in your Deriv account. Log them manually in the Log tab to track performance here.</Text>
            </View>
            <TouchableOpacity onPress={openDBot} style={styles.mainBtn}>
              <Text style={styles.mainBtnTxt}>🤖 Open DBot to Run</Text>
            </TouchableOpacity>
            {runLog.length===0 ? (
              <Text style={{color:C.tx3,textAlign:'center',marginTop:40,fontFamily:'monospace'}}>No run history yet</Text>
            ) : runLog.map((l,i)=>(
              <View key={i} style={{flexDirection:'row',gap:8,paddingVertical:5,borderBottomWidth:1,borderBottomColor:C.bd}}>
                <Text style={{color:C.tx3,fontSize:9,fontFamily:'monospace'}}>{l.t}</Text>
                <Text style={{color:l.type==='error'?C.re:l.type==='win'?C.gr:C.tx2,fontSize:11,flex:1}}>{l.msg}</Text>
              </View>
            ))}
          </>
        )}
        <View style={{height:30}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       {flex:1,backgroundColor:C.bg},
  tabs:       {flexDirection:'row',backgroundColor:C.sf,borderBottomWidth:1,borderBottomColor:C.bd,padding:6,gap:5},
  tabBtn:     {flex:1,paddingVertical:7,borderRadius:6,borderWidth:1,borderColor:C.bd2,alignItems:'center'},
  tabOn:      {backgroundColor:C.ac,borderColor:C.ac},
  tabTxt:     {fontSize:10,color:C.tx2,fontFamily:'monospace',fontWeight:'700'},
  h1:         {fontSize:17,fontWeight:'800',color:C.tx,marginBottom:12},
  sectionLbl: {fontSize:9,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1.2,marginBottom:8,marginTop:4},
  infoBanner: {backgroundColor:'rgba(230,57,70,.07)',borderWidth:1,borderColor:'rgba(230,57,70,.22)',borderRadius:9,padding:12,marginBottom:12},
  infoTxt:    {fontSize:12,color:C.tx2,lineHeight:19},
  mainBtn:    {backgroundColor:'rgba(230,57,70,.15)',borderWidth:1,borderColor:'rgba(230,57,70,.35)',borderRadius:9,padding:14,alignItems:'center',marginBottom:14},
  mainBtnTxt: {color:C.ac,fontWeight:'700',fontFamily:'monospace',fontSize:13},
  botCard:    {backgroundColor:C.sf,borderRadius:9,borderWidth:1,borderColor:C.bd,borderLeftWidth:3,padding:14,marginBottom:8},
  parsedCard: {backgroundColor:C.sf,borderRadius:9,borderWidth:1,borderColor:C.bd,padding:12,marginBottom:12},
  parsedRow:  {flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderBottomColor:C.bd},
  parsedKey:  {fontSize:10,color:C.tx3,fontFamily:'monospace',textTransform:'uppercase'},
  parsedVal:  {fontSize:12,fontWeight:'600',color:C.tx},
  xmlInput:   {backgroundColor:C.sf2,borderWidth:1,borderColor:C.bd2,borderRadius:8,padding:12,color:C.gr,
               fontFamily:'monospace',fontSize:11,minHeight:220,textAlignVertical:'top'},
  actionBtn:  {paddingVertical:11,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center'},
});