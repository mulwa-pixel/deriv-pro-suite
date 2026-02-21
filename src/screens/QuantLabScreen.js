/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  QUANT LAB  —  Full probability machine UI                          ║
 * ║  Tabs: Dashboard | Signal Console | Auto-Trade | Backtest           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Animated, Dimensions,
} from 'react-native';
import { C } from '../theme';
import {
  analyzeSymbol, ingestTick, calcStake, checkKillSwitch,
  backtestSymbol, WINDOWS,
} from '../quant/QuantEngine';
import TradeEngine from '../tradeEngine';

const { width: SW } = Dimensions.get('window');
const MARKETS = ['R_10','R_25','R_50','R_75','R_100'];
const MARKET_LABELS = { R_10:'V10', R_25:'V25', R_50:'V50', R_75:'V75', R_100:'V100' };
const TABS = ['Dashboard','Signals','Auto-Trade','Backtest'];

// ── Entropy ring ──────────────────────────────────────────────────────────────
function EntropyRing({ entropy, state: mState }) {
  const maxE    = 3.32;
  const pct     = Math.min(100, (entropy / maxE) * 100);
  const color   = mState?.color || '#ffd166';
  const size    = 90;
  return (
    <View style={[qs.ring, { width: size, height: size, borderRadius: size/2,
      borderColor: color, borderWidth: 4,
      backgroundColor: color + '15' }]}>
      <Text style={[qs.ringVal, { color }]}>{entropy.toFixed(3)}</Text>
      <Text style={[qs.ringLabel, { color }]}>{mState?.state || '—'}</Text>
    </View>
  );
}

// ── Z-score heatmap row ───────────────────────────────────────────────────────
function ZHeatmap({ stats, streaks, lastDigit }) {
  if (!stats) return <Text style={{ color: C.tx3, fontFamily: 'monospace', fontSize: 10 }}>Building stats...</Text>;
  return (
    <View style={qs.heatRow}>
      {[...Array(10)].map((_, d) => {
        const z    = stats.zScores[d];
        const pct  = Math.round(stats.probs[d] * 100);
        const str  = streaks ? streaks[d] : 0;
        const abs  = Math.abs(z);
        const bg   = z < -2  ? 'rgba(6,214,160,0.25)'
                   : z > 2   ? 'rgba(230,57,70,0.25)'
                   : abs > 1 ? 'rgba(255,215,64,0.12)'
                   : 'rgba(255,255,255,0.03)';
        const bc   = z < -2  ? C.gr
                   : z > 2   ? C.re
                   : abs > 1 ? C.ye
                   : C.bd;
        const tc   = z < -2  ? C.gr : z > 2 ? C.re : abs > 1 ? C.ye : C.tx3;
        const isLast = d === lastDigit;
        return (
          <View key={d} style={[qs.heatCell, { backgroundColor: bg, borderColor: isLast ? C.ac : bc,
            borderWidth: isLast ? 2 : 1 }]}>
            <Text style={[qs.heatDigit, { color: isLast ? C.ac : C.tx }]}>{d}</Text>
            <Text style={[qs.heatPct, { color: tc }]}>{pct}%</Text>
            <Text style={[qs.heatZ, { color: tc }]}>{z >= 0 ? '+' : ''}{z.toFixed(1)}</Text>
            {str > 12 && (
              <Text style={[qs.heatStr, { color: C.or }]}>{str}t</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Markov matrix mini ────────────────────────────────────────────────────────
function MarkovMini({ matrix, lastDigit }) {
  if (!matrix) return null;
  const row = matrix[lastDigit];
  if (!row) return null;
  const sorted = [...row.map((p,i) => ({d:i,p}))].sort((a,b)=>b.p-a.p).slice(0,5);
  return (
    <View style={qs.markovRow}>
      {sorted.map(({d, p}) => (
        <View key={d} style={[qs.markovCell, { backgroundColor: p > 0.14 ? 'rgba(6,214,160,.15)' : 'rgba(255,255,255,.03)',
          borderColor: p > 0.14 ? C.gr : C.bd }]}>
          <Text style={[qs.markovDigit, { color: p > 0.14 ? C.gr : C.tx2 }]}>{d}</Text>
          <Text style={[qs.markovProb, { color: p > 0.14 ? C.gr : C.tx3 }]}>{(p*100).toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────
function SignalCard({ sig, balance, onTrade, autoEnabled, tradeResult }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isHot = sig.tier === 'AUTO_FULL';
  useEffect(() => {
    if (isHot) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim,{toValue:1.03,duration:600,useNativeDriver:true}),
        Animated.timing(pulseAnim,{toValue:1.0,duration:600,useNativeDriver:true}),
      ])).start();
    }
    return () => pulseAnim.stopAnimation();
  }, [isHot]);

  const tierColor = sig.tier==='AUTO_FULL'?C.gr:sig.tier==='AUTO_SMALL'?C.ye:C.or;
  const contract  = sig.contracts[0];
  const stake     = balance ? calcStake(balance, sig.score) : null;

  return (
    <Animated.View style={[qs.sigCard,{ borderColor: tierColor+'55',
      transform: [{ scale: pulseAnim }] }]}>
      {/* Header */}
      <View style={qs.sigHead}>
        <View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <View style={[qs.tierBadge, { backgroundColor: tierColor+'22', borderColor: tierColor }]}>
              <Text style={[qs.tierTxt, { color: tierColor }]}>{sig.tier.replace('_',' ')}</Text>
            </View>
            <Text style={qs.sigDigit}>Digit <Text style={{ color: C.ac }}>{sig.digit}</Text></Text>
          </View>
          <Text style={qs.sigZ}>z = {sig.z >= 0 ? '+' : ''}{sig.z.toFixed(2)}  |  streak {Math.round(sig.streakScore*10)}t</Text>
        </View>
        <View style={{ alignItems:'flex-end' }}>
          <Text style={[qs.sigScore, { color: tierColor }]}>{sig.score}</Text>
          <Text style={[qs.sigScoreLabel, { color: tierColor }]}>/ 100</Text>
        </View>
      </View>

      {/* Score breakdown */}
      <View style={qs.breakdownRow}>
        {sig.breakdown.map((b,i) => (
          <View key={i} style={[qs.bdChip, { borderColor: b.pts > 0 ? 'rgba(6,214,160,.25)' : 'rgba(230,57,70,.2)',
            backgroundColor: b.pts > 0 ? 'rgba(6,214,160,.06)' : 'rgba(230,57,70,.04)' }]}>
            <Text style={{ color: b.pts > 0 ? C.gr : C.re, fontSize: 8, fontWeight:'800' }}>{b.pts > 0 ? `+${b.pts}` : '0'}</Text>
            <Text style={{ color: C.tx3, fontSize: 7, fontFamily:'monospace', marginLeft:3 }}>{b.label}</Text>
          </View>
        ))}
      </View>

      {/* Recommended contracts */}
      {sig.contracts.slice(0,2).map((c,i) => (
        <View key={i} style={[qs.contractRow, { borderColor: c.color+'40' }]}>
          <View style={[qs.ctypeBadge, { backgroundColor: c.color+'20' }]}>
            <Text style={[qs.ctypeTxt, { color: c.color }]}>{c.type}</Text>
          </View>
          <Text style={qs.contractReason}>{c.reason}</Text>
          {c.digit !== null && <Text style={[qs.contractDigit, { color: c.color }]}>D{c.digit}</Text>}
        </View>
      ))}

      {/* Stake + trade button */}
      {contract && stake !== null && balance && (
        <View style={qs.tradeRow}>
          <View>
            <Text style={qs.stakeLabel}>ADAPTIVE STAKE</Text>
            <Text style={qs.stakeVal}>${stake.toFixed(2)}</Text>
            <Text style={qs.stakeNote}>{(sig.score/100*0.7).toFixed(2)}% of balance</Text>
          </View>
          <TouchableOpacity
            onPress={() => onTrade && onTrade({ sig, contract, stake })}
            disabled={!autoEnabled && sig.tier !== 'MANUAL'}
            style={[qs.tradeBtn, { backgroundColor: tierColor + '20', borderColor: tierColor + '60',
              opacity: autoEnabled || sig.tier === 'MANUAL' ? 1 : 0.4 }]}>
            <Text style={[qs.tradeBtnTxt, { color: tierColor }]}>
              {autoEnabled ? '▶ AUTO' : 'TRADE'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tradeResult && (
        <View style={[qs.resultBanner, { backgroundColor: tradeResult.won ? 'rgba(6,214,160,.12)' : 'rgba(230,57,70,.12)',
          borderColor: tradeResult.won ? C.gr+'55' : C.re+'55' }]}>
          <Text style={{ color: tradeResult.won ? C.gr : C.re, fontWeight:'800', fontFamily:'monospace', fontSize:11 }}>
            {tradeResult.won ? `✅ WIN  +$${tradeResult.profit?.toFixed(2)}` : `❌ LOSS  -$${stake?.toFixed(2)}`}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Backtest result card ──────────────────────────────────────────────────────
function BacktestCard({ sym, result }) {
  if (!result) return (
    <View style={qs.btCard}>
      <Text style={{ color: C.tx3, fontFamily:'monospace', textAlign:'center', padding:10 }}>
        Need 200+ ticks for backtest
      </Text>
    </View>
  );
  const { total, wins, winRate, avgScore } = result;
  const color = winRate >= 65 ? C.gr : winRate >= 55 ? C.ye : C.re;
  return (
    <View style={[qs.btCard, { borderColor: color + '40' }]}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <Text style={qs.btMarket}>{MARKET_LABELS[sym] || sym}</Text>
        <Text style={[qs.btWr, { color }]}>{winRate}% WR</Text>
      </View>
      <View style={{ flexDirection:'row', gap:12 }}>
        <View style={qs.btStat}>
          <Text style={qs.btStatVal}>{total}</Text>
          <Text style={qs.btStatLabel}>Signals</Text>
        </View>
        <View style={qs.btStat}>
          <Text style={[qs.btStatVal, { color: C.gr }]}>{wins}</Text>
          <Text style={qs.btStatLabel}>Wins</Text>
        </View>
        <View style={qs.btStat}>
          <Text style={[qs.btStatVal, { color: C.re }]}>{total - wins}</Text>
          <Text style={qs.btStatLabel}>Losses</Text>
        </View>
        <View style={qs.btStat}>
          <Text style={qs.btStatVal}>{avgScore}</Text>
          <Text style={qs.btStatLabel}>Avg Score</Text>
        </View>
      </View>
      {/* Mini win/loss strip */}
      <View style={{ flexDirection:'row', gap:2, marginTop:8, flexWrap:'wrap' }}>
        {result.results.slice(-30).map((r, i) => (
          <View key={i} style={[qs.btDot, { backgroundColor: r.won ? C.gr : C.re }]}/>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function QuantLabScreen({ state }) {
  const [tab,          setTab]          = useState('Dashboard');
  const [market,       setMarket]       = useState('R_75');
  const [analysis,     setAnalysis]     = useState(null);
  const [allAnalysis,  setAllAnalysis]  = useState({});
  const [autoEnabled,  setAutoEnabled]  = useState(false);
  const [autoWindow,   setAutoWindow]   = useState(100);
  const [consLosses,   setConsLosses]   = useState(0);
  const [dailyPnl,     setDailyPnl]     = useState(0);
  const [killSwitch,   setKillSwitch]   = useState(null);
  const [tradeResults, setTradeResults] = useState({});
  const [backtests,    setBacktests]    = useState({});
  const refreshRef = useRef(null);

  const balance = state?.balance?.amount ? parseFloat(state.balance.amount) : null;

  // Tracks how many digits per symbol have already been ingested into QuantEngine
  const ingestedLenRef = useRef({});

  // ── Feed quant engine from live ticks ────────────────────────────────────
  useEffect(() => {
    const digRef = state?._digBySymRef;
    if (!digRef?.current) return;

    const run = () => {
      const now = Date.now();
      // Ingest only NEW digits per symbol (delta ingestion)
      for (const sym of MARKETS) {
        const digits = digRef.current[sym] || [];
        const already = ingestedLenRef.current[sym] || 0;
        if (digits.length > already) {
          const newDigits = digits.slice(already);
          newDigits.forEach((d, i) => {
            // Estimate timestamp: newest tick is ~now, older ticks spaced ~1s apart
            const ageMs = (newDigits.length - 1 - i) * 1000;
            ingestTick(sym, d, now - ageMs);
          });
          ingestedLenRef.current[sym] = digits.length;
        }
      }

      // Compute analysis for active market
      setAnalysis(analyzeSymbol(market));

      // Lightweight pass for all-market summary
      const all = {};
      for (const sym of MARKETS) all[sym] = analyzeSymbol(sym);
      setAllAnalysis(all);
    };

    run();
    refreshRef.current = setInterval(run, 500);
    return () => clearInterval(refreshRef.current);
  }, [state?._digBySymRef, market]);

  // ── Kill switch monitor ───────────────────────────────────────────────────
  useEffect(() => {
    const ks = checkKillSwitch({
      consecutiveLosses: consLosses,
      dailyPnlPct: balance ? dailyPnl / balance : 0,
    });
    setKillSwitch(ks);
    if (ks.killed) setAutoEnabled(false);
  }, [consLosses, dailyPnl, balance]);

  // ── Run backtest ──────────────────────────────────────────────────────────
  const runBacktest = useCallback(() => {
    const results = {};
    for (const sym of MARKETS) {
      results[sym] = backtestSymbol(sym, autoWindow, 65);
    }
    setBacktests(results);
  }, [autoWindow]);

  // ── Handle trade ─────────────────────────────────────────────────────────
  const handleTrade = useCallback(async ({ sig, contract, stake }) => {
    if (!state?.connected) return;
    if (killSwitch?.killed) return;

    // Map QuantEngine contract types → TradeEngine contract type strings
    const ctMap = {
      'DIGIT MATCH': 'DIGITMATCH',
      'DIGIT DIFF':  'DIGITDIFF',
      'OVER 5':      'DIGITOVER',
      'UNDER 5':     'DIGITUNDER',
      'EVEN':        'DIGITEVEN',
      'ODD':         'DIGITODD',
    };

    const key = `${sig.digit}_${Date.now()}`;

    // Set up result listener BEFORE buying
    const prevOnUpdate = TradeEngine.onUpdate;
    TradeEngine.onUpdate = (type, data) => {
      if (prevOnUpdate) prevOnUpdate(type, data); // chain existing listener
      if (type === 'settled') {
        const won = data.status === 'won' || data.finalProfit > 0;
        setTradeResults(r => ({ ...r, [key]: { won, profit: data.finalProfit } }));
        if (!won) setConsLosses(c => c + 1);
        else      setConsLosses(0);
        setDailyPnl(p => p + (data.finalProfit || 0));
        // Restore previous listener after settlement
        TradeEngine.onUpdate = prevOnUpdate;
      }
      if (type === 'error') {
        setTradeResults(r => ({ ...r, [key]: { won: false, profit: 0, error: data.msg } }));
        TradeEngine.onUpdate = prevOnUpdate;
      }
    };

    try {
      const contractType = ctMap[contract.type] || 'DIGITDIFF';
      await TradeEngine.buy({
        contractType,
        symbol:       market,
        stake:        stake,
        duration:     5,
        durationUnit: 't',
        barrier:      contract.digit !== null ? contract.digit : undefined,
      });
    } catch (e) {
      // Restore listener on error
      TradeEngine.onUpdate = prevOnUpdate;
      setTradeResults(r => ({ ...r, [key]: { won: false, profit: 0, error: e.message } }));
    }
  }, [state, market, killSwitch]);

  // ── Current analysis shorthand ────────────────────────────────────────────
  const a          = analysis;
  const readyCount = Object.values(allAnalysis).filter(x => x?.ready).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Market selector ─────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={qs.marketBar} contentContainerStyle={{ paddingHorizontal:10, gap:6, alignItems:'center', paddingVertical:6 }}>
        {MARKETS.map(sym => (
          <TouchableOpacity key={sym} onPress={() => setMarket(sym)}
            style={[qs.mktBtn, market===sym && qs.mktBtnOn]}>
            <Text style={[qs.mktTxt, market===sym && { color: C.bg }]}>
              {MARKET_LABELS[sym]}
            </Text>
            {allAnalysis[sym]?.ready && (
              <View style={[qs.mktDot, {
                backgroundColor: allAnalysis[sym]?.marketState?.color || C.tx3
              }]}/>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <View style={qs.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[qs.tabBtn, tab===t && qs.tabOn]}>
            <Text style={[qs.tabTxt, tab===t && { color: C.bg }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 12 }}>

        {/* Not connected warning */}
        {!state?.connected && (
          <View style={qs.noConn}>
            <Text style={{ color: C.re, fontFamily:'monospace', fontSize:11 }}>
              ⚡ Connect API in Settings to start quant analysis
            </Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* DASHBOARD TAB                                                  */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'Dashboard' && (
          <>
            {/* Data coverage */}
            <View style={qs.coverageBar}>
              <Text style={qs.coverageTxt}>
                {a?.ready
                  ? `${a.tickCount.toLocaleString()} ticks · ${readyCount}/5 markets ready`
                  : `Building data... ${a?.tickCount || 0} / 50 ticks min`}
              </Text>
              {a?.ready && (
                <Text style={[qs.coverageTxt, { color: a.marketState.color }]}>
                  {a.marketState.state}
                </Text>
              )}
            </View>

            {/* Entropy + state */}
            {a?.ready ? (
              <View style={qs.stateCard}>
                <EntropyRing entropy={a.entropy} state={a.marketState}/>
                <View style={{ flex:1, marginLeft:14 }}>
                  <Text style={qs.fieldLabel}>MARKET STATE</Text>
                  <Text style={[qs.stateLabel, { color: a.marketState.color }]}>
                    {a.marketState.state}
                  </Text>
                  <Text style={{ color: C.tx3, fontSize:10, marginTop:3, lineHeight:15 }}>
                    {a.marketState.state === 'RANDOM'
                      ? 'Entropy high — distribution near uniform. No trade.'
                      : a.marketState.state === 'TRENDING'
                      ? 'Digit clustering detected. Moderate edge.'
                      : 'Mean reversion phase. Best for digit contracts.'}
                  </Text>
                  <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
                    <View>
                      <Text style={qs.fieldLabel}>TICK SPEED</Text>
                      <Text style={[{fontSize:11,fontWeight:'700',fontFamily:'monospace'},
                        { color: a.tickSpeed.verdict==='FAST_BLOCK'?C.re
                               : a.tickSpeed.verdict==='SLOW_HIGH_CONF'?C.gr:C.ye }]}>
                        {a.tickSpeed.verdict?.replace('_',' ')}
                      </Text>
                      <Text style={{ color:C.tx3, fontSize:9 }}>{a.tickSpeed.avgMs}ms avg</Text>
                    </View>
                    <View>
                      <Text style={qs.fieldLabel}>LAST DIGIT</Text>
                      <Text style={{ fontSize:22, fontWeight:'800', color:C.ac }}>{a.lastDigit}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[qs.stateCard, { justifyContent:'center', alignItems:'center', gap:8 }]}>
                <Text style={{ color:C.tx3, fontFamily:'monospace', textAlign:'center' }}>
                  Collecting tick data...{'\n'}{a?.tickCount || 0} ticks / 50 minimum
                </Text>
              </View>
            )}

            {/* Z-score heatmap */}
            {a?.ready && (
              <>
                <Text style={[qs.fieldLabel, { marginTop:12 }]}>
                  DIGIT FREQUENCY HEATMAP (last {autoWindow} ticks)
                </Text>
                <Text style={{ color:C.tx3, fontSize:9, fontFamily:'monospace', marginBottom:6 }}>
                  Green = underrepresented (MATCH candidate) · Red = overrepresented (DIFF candidate)
                </Text>
                <ZHeatmap
                  stats={a.windowStats[autoWindow] || a.primary}
                  streaks={a.streaks}
                  lastDigit={a.lastDigit}/>

                {/* Markov prediction */}
                <Text style={[qs.fieldLabel, { marginTop:12 }]}>
                  MARKOV NEXT-DIGIT PREDICTION (from {a.lastDigit})
                </Text>
                <Text style={{ color:C.tx3, fontSize:9, fontFamily:'monospace', marginBottom:6 }}>
                  Based on transition probabilities. Green = bias {'>'} 14% baseline
                </Text>
                <MarkovMini matrix={a.matrix} lastDigit={a.lastDigit}/>

                {/* Window comparison */}
                <Text style={[qs.fieldLabel, { marginTop:14 }]}>WINDOW COMPARISON</Text>
                {WINDOWS.filter(w => a.windowStats[w]).map(w => {
                  const ws = a.windowStats[w];
                  const maxZ = Math.max(...ws.zScores.map(Math.abs));
                  const hotDigit = ws.zScores.indexOf(ws.zScores.reduce((a,b,i,arr) => Math.abs(b)>Math.abs(arr[a])?i:a, 0));
                  return (
                    <View key={w} style={qs.windowRow}>
                      <Text style={qs.windowLabel}>{w}T</Text>
                      <View style={qs.windowBar}>
                        <View style={[qs.windowFill,{
                          width: Math.min(100, (maxZ/3)*100)+'%',
                          backgroundColor: ws.zScores[hotDigit]>0?C.re:C.gr,
                        }]}/>
                      </View>
                      <Text style={[qs.windowZ, {
                        color: Math.abs(ws.zScores[hotDigit])>2?C.re:C.tx3
                      }]}>
                        D{hotDigit} z={ws.zScores[hotDigit]>=0?'+':''}{ws.zScores[hotDigit].toFixed(1)}
                      </Text>
                    </View>
                  );
                })}

                {/* Parity skew */}
                {a.parityContract && (
                  <View style={[qs.parityCard, { borderColor: a.parityContract.color+'50' }]}>
                    <Text style={[qs.parityType, { color: a.parityContract.color }]}>
                      {a.parityContract.type} SIGNAL
                    </Text>
                    <Text style={qs.parityReason}>{a.parityContract.reason}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* SIGNALS TAB                                                    */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'Signals' && (
          <>
            <View style={qs.windowSelector}>
              <Text style={qs.fieldLabel}>ANALYSIS WINDOW</Text>
              <View style={{ flexDirection:'row', gap:5 }}>
                {WINDOWS.map(w => (
                  <TouchableOpacity key={w} onPress={() => setAutoWindow(w)}
                    style={[qs.wBtn, autoWindow===w && qs.wBtnOn]}>
                    <Text style={[qs.wTxt, autoWindow===w && { color:C.bg }]}>{w}T</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!a?.ready ? (
              <View style={qs.noSig}>
                <Text style={qs.noSigTxt}>Collecting tick data...{'\n'}{a?.tickCount||0} ticks</Text>
              </View>
            ) : !a.marketState.tradeable ? (
              <View style={qs.noSig}>
                <Text style={{ color:C.re, fontSize:14, fontWeight:'800', textAlign:'center', marginBottom:6 }}>
                  ⛔ RANDOM STATE — NO TRADE
                </Text>
                <Text style={qs.noSigTxt}>
                  Entropy = {a.entropy.toFixed(3)} {'>'} 3.25{'\n'}
                  Digit distribution near uniform.{'\n'}
                  Wait for mean reversion phase.
                </Text>
              </View>
            ) : !a.tickSpeed.tradeable ? (
              <View style={qs.noSig}>
                <Text style={{ color:C.re, fontSize:14, fontWeight:'800', textAlign:'center', marginBottom:6 }}>
                  ⚡ TICKS TOO FAST — BLOCKED
                </Text>
                <Text style={qs.noSigTxt}>
                  Speed score {a.tickSpeed.speedScore} {'<'} 0.7 threshold.{'\n'}
                  Fast ticks = random noise.{'\n'}
                  Wait for structured flow.
                </Text>
              </View>
            ) : a.digitSignals.length === 0 ? (
              <View style={qs.noSig}>
                <Text style={qs.noSigTxt}>
                  No signals above threshold.{'\n'}
                  Waiting for z-score extremes or streak exhaustion.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color:C.tx3, fontSize:9, fontFamily:'monospace', marginBottom:10 }}>
                  {a.digitSignals.length} signal{a.digitSignals.length!==1?'s':''} · {MARKET_LABELS[market]} · {a.marketState.state}
                </Text>
                {a.digitSignals.slice(0, 5).map((sig, i) => (
                  <SignalCard
                    key={`${sig.digit}_${i}`}
                    sig={sig}
                    balance={balance}
                    onTrade={handleTrade}
                    autoEnabled={autoEnabled && !killSwitch?.killed}
                    tradeResult={tradeResults[`${sig.digit}_${i}`]}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* AUTO-TRADE TAB                                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'Auto-Trade' && (
          <>
            {/* Kill switch status */}
            {killSwitch?.killed && (
              <View style={qs.killBanner}>
                <Text style={qs.killTxt}>🛑 KILL SWITCH ACTIVE</Text>
                <Text style={qs.killReason}>{killSwitch.reason}</Text>
              </View>
            )}

            {/* Auto switch */}
            <View style={qs.autoCard}>
              <View style={{ flex:1 }}>
                <Text style={qs.autoLabel}>AUTO-TRADE</Text>
                <Text style={{ color:C.tx3, fontSize:10, lineHeight:15 }}>
                  Executes signals ≥65 score automatically.{'\n'}
                  Kill switch pauses on 4 losses or -5% day.
                </Text>
              </View>
              <Switch
                value={autoEnabled && !killSwitch?.killed}
                onValueChange={v => {
                  if (killSwitch?.killed) return;
                  setAutoEnabled(v);
                }}
                trackColor={{ false: C.bd2, true: C.gr + '88' }}
                thumbColor={autoEnabled ? C.gr : C.tx3}
              />
            </View>

            {/* Session stats */}
            <View style={qs.sessionGrid}>
              {[
                ['Consec. Losses', consLosses, consLosses>=4?C.re:consLosses>=2?C.ye:C.gr],
                ['Daily P&L', (dailyPnl>=0?'+$':'-$')+Math.abs(dailyPnl).toFixed(2), dailyPnl>=0?C.gr:C.re],
                ['Balance', balance?'$'+balance.toFixed(2):'—', C.ac],
              ].map(([l,v,c])=>(
                <View key={l} style={qs.sessionCell}>
                  <Text style={qs.fieldLabel}>{l}</Text>
                  <Text style={[qs.sessionVal,{color:c}]}>{v}</Text>
                </View>
              ))}
            </View>

            {/* Stake tiers */}
            <View style={qs.stakeTable}>
              <Text style={[qs.fieldLabel, { marginBottom:8 }]}>ADAPTIVE STAKE TIERS</Text>
              {[
                ['< 50',   'No trade',       C.tx3,  'NO_TRADE'],
                ['50–65',  'Manual only',     C.or,   'MANUAL'],
                ['65–80',  '0.35–0.56% bal', C.ye,   'AUTO_SMALL'],
                ['80–100', '0.56–0.70% bal', C.gr,   'AUTO_FULL'],
              ].map(([score, action, color, tier])=>(
                <View key={score} style={[qs.stakeTierRow,
                  { backgroundColor: tier==='AUTO_FULL'?'rgba(6,214,160,.06)':'transparent' }]}>
                  <Text style={[qs.stakeTierScore, { color }]}>{score}</Text>
                  <Text style={[qs.stakeTierAction, { color }]}>{action}</Text>
                  {balance && tier !== 'NO_TRADE' && tier !== 'MANUAL' && (
                    <Text style={[qs.stakeTierCalc, { color:C.tx3 }]}>
                      ${calcStake(balance, tier==='AUTO_FULL'?85:70).toFixed(2)}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Kill switch rules */}
            <View style={qs.killRulesCard}>
              <Text style={[qs.fieldLabel, { marginBottom:8 }]}>KILL SWITCH RULES</Text>
              {[
                [`4 consecutive losses → PAUSE`, consLosses >= 4],
                [`Daily loss > 5% of balance → STOP`, balance && dailyPnl/balance <= -0.05],
                [`Manual override → Reset counters`, false],
              ].map(([rule, triggered], i)=>(
                <View key={i} style={qs.killRule}>
                  <Text style={{ color: triggered?C.re:C.tx3, fontSize:9, marginRight:6 }}>
                    {triggered ? '🛑' : '○'}
                  </Text>
                  <Text style={{ color: triggered?C.re:C.tx3, fontSize:10 }}>{rule}</Text>
                </View>
              ))}
              {(consLosses >= 4 || (balance && dailyPnl/balance <= -0.05)) && (
                <TouchableOpacity
                  onPress={() => { setConsLosses(0); setDailyPnl(0); setKillSwitch({killed:false}); }}
                  style={qs.resetBtn}>
                  <Text style={{ color: C.ye, fontWeight:'800', fontSize:11, fontFamily:'monospace' }}>
                    RESET KILL SWITCH
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* BACKTEST TAB                                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === 'Backtest' && (
          <>
            <View style={qs.btHeader}>
              <Text style={{ color:C.tx2, fontSize:10, lineHeight:16 }}>
                Simulates signals on stored tick history.{'\n'}
                Uses z-score + streak + entropy filtering at score ≥65.{'\n'}
                Checks if signal digit appeared in next 10 ticks.
              </Text>
              <TouchableOpacity onPress={runBacktest} style={qs.btRunBtn}>
                <Text style={{ color:C.bg, fontWeight:'800', fontSize:11, fontFamily:'monospace' }}>
                  ▶  RUN BACKTEST
                </Text>
              </TouchableOpacity>
            </View>

            {Object.keys(backtests).length === 0 ? (
              <View style={qs.noSig}>
                <Text style={qs.noSigTxt}>
                  Press RUN BACKTEST to analyse stored tick history.{'\n'}
                  Needs 200+ ticks per market.
                </Text>
              </View>
            ) : (
              <>
                {MARKETS.map(sym => (
                  <BacktestCard key={sym} sym={sym} result={backtests[sym]}/>
                ))}
                <View style={qs.btNote}>
                  <Text style={{ color:C.tx3, fontSize:10, lineHeight:16 }}>
                    ⚠ Backtest simulates DIGIT MATCH/DIFF only.{'\n'}
                    Win = target digit appeared/didn't appear in next 10 ticks.{'\n'}
                    Past results do not guarantee future performance.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  );
}

const qs = StyleSheet.create({
  marketBar:     { flexGrow:0, backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd },
  mktBtn:        { paddingHorizontal:12, paddingVertical:5, borderRadius:14, borderWidth:1,
                   borderColor:C.bd2, flexDirection:'row', alignItems:'center', gap:4 },
  mktBtnOn:      { backgroundColor:C.ac, borderColor:C.ac },
  mktTxt:        { color:C.tx3, fontWeight:'700', fontFamily:'monospace', fontSize:11 },
  mktDot:        { width:6, height:6, borderRadius:3 },
  tabBar:        { flexDirection:'row', backgroundColor:C.sf, borderBottomWidth:1, borderBottomColor:C.bd },
  tabBtn:        { flex:1, paddingVertical:9, alignItems:'center' },
  tabOn:         { backgroundColor:C.ac },
  tabTxt:        { fontSize:9, fontWeight:'700', fontFamily:'monospace', color:C.tx2 },
  noConn:        { backgroundColor:'rgba(230,57,70,.08)', borderWidth:1, borderColor:'rgba(230,57,70,.3)',
                   borderRadius:8, padding:12, marginBottom:12, alignItems:'center' },
  coverageBar:   { flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  coverageTxt:   { color:C.tx3, fontSize:10, fontFamily:'monospace' },
  fieldLabel:    { fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
                   letterSpacing:1, marginBottom:4 },
  stateCard:     { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:14, flexDirection:'row', alignItems:'center', marginBottom:12 },
  ring:          { alignItems:'center', justifyContent:'center' },
  ringVal:       { fontSize:16, fontWeight:'800', fontFamily:'monospace' },
  ringLabel:     { fontSize:8, fontFamily:'monospace', fontWeight:'700', marginTop:2 },
  stateLabel:    { fontSize:20, fontWeight:'800', marginBottom:2 },
  heatRow:       { flexDirection:'row', gap:4, marginBottom:8 },
  heatCell:      { flex:1, borderRadius:6, padding:4, alignItems:'center', borderWidth:1, minWidth:28 },
  heatDigit:     { fontSize:13, fontWeight:'800', lineHeight:15 },
  heatPct:       { fontSize:8, fontFamily:'monospace', lineHeight:10 },
  heatZ:         { fontSize:7, fontFamily:'monospace', lineHeight:9 },
  heatStr:       { fontSize:7, fontFamily:'monospace', lineHeight:9 },
  markovRow:     { flexDirection:'row', gap:6, marginBottom:8 },
  markovCell:    { flex:1, borderRadius:7, borderWidth:1, padding:8, alignItems:'center' },
  markovDigit:   { fontSize:16, fontWeight:'800' },
  markovProb:    { fontSize:9, fontFamily:'monospace', fontWeight:'700', marginTop:2 },
  windowRow:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:5 },
  windowLabel:   { color:C.tx3, fontSize:9, fontFamily:'monospace', width:32 },
  windowBar:     { flex:1, height:6, backgroundColor:C.sf2, borderRadius:3, overflow:'hidden' },
  windowFill:    { height:'100%', borderRadius:3 },
  windowZ:       { fontSize:9, fontFamily:'monospace', width:70, textAlign:'right' },
  parityCard:    { backgroundColor:C.sf, borderRadius:8, borderWidth:1, padding:12, marginTop:10 },
  parityType:    { fontSize:16, fontWeight:'800', marginBottom:3 },
  parityReason:  { color:C.tx2, fontSize:11 },
  windowSelector:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  wBtn:          { paddingHorizontal:10, paddingVertical:6, borderRadius:6, borderWidth:1, borderColor:C.bd2 },
  wBtnOn:        { backgroundColor:C.ac, borderColor:C.ac },
  wTxt:          { color:C.tx2, fontFamily:'monospace', fontSize:10, fontWeight:'700' },
  noSig:         { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:24, alignItems:'center' },
  noSigTxt:      { color:C.tx3, textAlign:'center', lineHeight:20, fontSize:12 },
  sigCard:       { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderLeftWidth:3,
                   padding:14, marginBottom:10 },
  sigHead:       { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  tierBadge:     { borderRadius:5, paddingHorizontal:6, paddingVertical:2, borderWidth:1 },
  tierTxt:       { fontSize:8, fontWeight:'800', fontFamily:'monospace' },
  sigDigit:      { fontSize:14, fontWeight:'700', color:C.tx, marginTop:2 },
  sigZ:          { fontSize:9, color:C.tx3, fontFamily:'monospace', marginTop:2 },
  sigScore:      { fontSize:26, fontWeight:'800' },
  sigScoreLabel: { fontSize:9, fontFamily:'monospace' },
  breakdownRow:  { flexDirection:'row', flexWrap:'wrap', gap:4, marginBottom:8 },
  bdChip:        { flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:4,
                   paddingHorizontal:5, paddingVertical:3 },
  contractRow:   { flexDirection:'row', alignItems:'center', gap:8, borderWidth:1,
                   borderRadius:7, padding:8, marginBottom:5 },
  ctypeBadge:    { paddingHorizontal:8, paddingVertical:4, borderRadius:5 },
  ctypeTxt:      { fontSize:11, fontWeight:'800', fontFamily:'monospace' },
  contractReason:{ flex:1, fontSize:9, color:C.tx2, fontFamily:'monospace' },
  contractDigit: { fontSize:14, fontWeight:'800' },
  tradeRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                   marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:C.bd },
  stakeLabel:    { fontSize:7, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase',
                   letterSpacing:1, marginBottom:2 },
  stakeVal:      { fontSize:18, fontWeight:'800', color:C.tx },
  stakeNote:     { fontSize:9, color:C.tx3 },
  tradeBtn:      { borderWidth:1, borderRadius:8, paddingHorizontal:16, paddingVertical:10 },
  tradeBtnTxt:   { fontWeight:'800', fontFamily:'monospace', fontSize:12 },
  resultBanner:  { borderWidth:1, borderRadius:7, padding:9, marginTop:8, alignItems:'center' },
  killBanner:    { backgroundColor:'rgba(230,57,70,.12)', borderWidth:1, borderColor:'rgba(230,57,70,.4)',
                   borderRadius:10, padding:14, marginBottom:12, alignItems:'center' },
  killTxt:       { color:C.re, fontSize:14, fontWeight:'800', fontFamily:'monospace' },
  killReason:    { color:C.re, fontSize:10, fontFamily:'monospace', marginTop:4 },
  autoCard:      { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:14, flexDirection:'row', alignItems:'center', gap:14, marginBottom:12 },
  autoLabel:     { fontSize:14, fontWeight:'800', color:C.tx, marginBottom:4 },
  sessionGrid:   { flexDirection:'row', backgroundColor:C.sf, borderRadius:10, borderWidth:1,
                   borderColor:C.bd, marginBottom:12, overflow:'hidden' },
  sessionCell:   { flex:1, padding:12, alignItems:'center',
                   borderRightWidth:1, borderRightColor:C.bd },
  sessionVal:    { fontSize:16, fontWeight:'800' },
  stakeTable:    { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:14, marginBottom:12 },
  stakeTierRow:  { flexDirection:'row', alignItems:'center', paddingVertical:8,
                   borderBottomWidth:1, borderBottomColor:C.bd, gap:12 },
  stakeTierScore:{ fontSize:11, fontFamily:'monospace', fontWeight:'700', width:60 },
  stakeTierAction:{ flex:1, fontSize:10, fontFamily:'monospace' },
  stakeTierCalc: { fontSize:10, fontFamily:'monospace' },
  killRulesCard: { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd, padding:14 },
  killRule:      { flexDirection:'row', alignItems:'flex-start', paddingVertical:5,
                   borderBottomWidth:1, borderBottomColor:C.bd },
  resetBtn:      { marginTop:12, borderWidth:1, borderColor:'rgba(255,215,64,.4)', borderRadius:7,
                   padding:10, alignItems:'center' },
  btHeader:      { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:14, marginBottom:12, gap:10 },
  btRunBtn:      { backgroundColor:C.ac, borderRadius:8, padding:12, alignItems:'center' },
  btCard:        { backgroundColor:C.sf, borderRadius:10, borderWidth:1, borderColor:C.bd,
                   padding:14, marginBottom:8 },
  btMarket:      { fontSize:16, fontWeight:'800', color:C.tx },
  btWr:          { fontSize:22, fontWeight:'800' },
  btStat:        { alignItems:'center' },
  btStatVal:     { fontSize:18, fontWeight:'800', color:C.tx },
  btStatLabel:   { fontSize:8, color:C.tx3, fontFamily:'monospace', textTransform:'uppercase' },
  btDot:         { width:10, height:10, borderRadius:5 },
  btNote:        { backgroundColor:'rgba(255,215,64,.06)', borderRadius:8, borderWidth:1,
                   borderColor:'rgba(255,215,64,.2)', padding:12, marginTop:8 },
});
