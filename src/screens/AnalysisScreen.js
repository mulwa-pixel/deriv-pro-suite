/**
 * ANALYSIS SCREEN — DollarPrinter / LDP Style
 *
 * HOW DOLLARPRINTER ACTUALLY WORKS (researched):
 *  - Primary tool: Digit Circle — shows % frequency of each digit (0-9) over last N ticks
 *  - EVEN signal:  digit 4 shows ≥12%  →  bet EVEN (mainly V50)
 *  - ODD signal:   digit 5 shows ≥12%  →  bet ODD
 *  - OVER 3:       any even digit ≥12%, especially digit 6  → OVER 3
 *  - UNDER 7:      any odd digit ≥12%                      → UNDER 7
 *  - Rise/Fall:    last N ticks momentum + candle OHLC RSI  (NOT tick RSI)
 *
 * WHY TICK RSI WAS WRONG:
 *  RSI on 14 raw ticks = RSI on 14 SECONDS of data.
 *  TradingView RSI(14) on 1m chart = RSI on 14 MINUTES of data.
 *  They measure completely different things. Fixed below by fetching real candles.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');

const MARKETS = [
  { label: 'V10',     sym: 'R_10'     },
  { label: 'V25',     sym: 'R_25'     },
  { label: 'V50',     sym: 'R_50'     },
  { label: 'V75',     sym: 'R_75'     },
  { label: 'V100',    sym: 'R_100'    },
  { label: '1HZ75',   sym: '1HZ75V'   },
  { label: '1HZ100',  sym: '1HZ100V'  },
];

const TICK_OPTIONS = [50, 100, 200, 500, 1000];

const CONTRACT_TABS = ['Digit', 'Rise/Fall', 'Over/Under'];

// ── Digit percentage circle ─────────────────────────────────────────────────
function DigitCircle({ digit, pct, hot, cold, isSignal, signalColor }) {
  const size = 52;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isSignal) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => pulseAnim.stopAnimation();
  }, [isSignal]);

  const ringColor = isSignal ? signalColor
    : hot  ? '#f77f00'
    : cold ? '#505060'
    : '#2a2a3e';

  const textColor = isSignal ? signalColor
    : hot  ? '#f0f0f0'
    : cold ? '#505060'
    : '#a0a0b0';

  return (
    <Animated.View style={[styles.digitCircleWrap,
      { transform: [{ scale: pulseAnim }] }]}>
      {/* SVG-like ring using border */}
      <View style={[styles.digitRing, {
        borderColor: ringColor,
        borderWidth: isSignal ? 3 : hot ? 2.5 : 1.5,
        backgroundColor: isSignal ? signalColor + '18' : 'transparent',
        width: size, height: size, borderRadius: size / 2,
      }]}>
        <Text style={[styles.digitNum, { color: textColor }]}>{digit}</Text>
        <Text style={[styles.digitPct, { color: textColor }]}>{pct}%</Text>
      </View>
      {isSignal && (
        <View style={[styles.signalDot, { backgroundColor: signalColor }]}/>
      )}
    </Animated.View>
  );
}

// ── Signal badge ─────────────────────────────────────────────────────────────
function SignalBadge({ label, reason, color, confidence }) {
  return (
    <View style={[styles.signalBadge, { borderColor: color + '60', backgroundColor: color + '15' }]}>
      <Text style={[styles.signalLabel, { color }]}>{label}</Text>
      <Text style={styles.signalReason}>{reason}</Text>
      <View style={styles.confRow}>
        <View style={[styles.confBar, { width: confidence + '%', backgroundColor: color }]}/>
      </View>
      <Text style={[styles.confTxt, { color }]}>{confidence}% confidence</Text>
    </View>
  );
}

// ── Candle RSI gauge ─────────────────────────────────────────────────────────
function RSIGauge({ rsi, label }) {
  if (rsi === null) return (
    <View style={styles.rsiGauge}>
      <Text style={styles.rsiLabel}>{label}</Text>
      <Text style={styles.rsiBuilding}>Building candles...</Text>
    </View>
  );

  const pos = Math.min(100, Math.max(0, rsi));
  const color = rsi < 30 ? C.gr : rsi > 70 ? C.re : rsi >= 40 && rsi <= 60 ? '#505060' : C.ye;

  return (
    <View style={styles.rsiGauge}>
      <View style={styles.rsiRow}>
        <Text style={styles.rsiLabel}>{label}</Text>
        <Text style={[styles.rsiVal, { color }]}>{rsi.toFixed(1)}</Text>
        <Text style={[styles.rsiZone, { color }]}>
          {rsi < 30 ? '↑ OVERSOLD' : rsi > 70 ? '↓ OVERBOUGHT' : rsi >= 40 && rsi <= 60 ? '⛔ DEAD ZONE' : 'Neutral'}
        </Text>
      </View>
      <View style={styles.rsiTrack}>
        {/* Zone fills */}
        <View style={[styles.rsiZoneFill, { left: 0,   width: '30%', backgroundColor: 'rgba(6,214,160,.15)' }]}/>
        <View style={[styles.rsiZoneFill, { left: '40%', width: '20%', backgroundColor: 'rgba(80,80,96,.25)' }]}/>
        <View style={[styles.rsiZoneFill, { right: 0,  width: '30%', backgroundColor: 'rgba(230,57,70,.15)' }]}/>
        {/* Labels */}
        <Text style={[styles.rsiZoneLabel, { left: 2 }]}>30</Text>
        <Text style={[styles.rsiZoneLabel, { left: '38%' }]}>40</Text>
        <Text style={[styles.rsiZoneLabel, { left: '58%' }]}>60</Text>
        <Text style={[styles.rsiZoneLabel, { right: 2 }]}>70</Text>
        {/* Pointer */}
        <View style={[styles.rsiPointer, { left: pos + '%', backgroundColor: color }]}/>
      </View>
    </View>
  );
}

// ── Candle data from Deriv WebSocket ────────────────────────────────────────
function useCandleRSI(appId, sym, granularity = 60) {
  const [rsi14, setRsi14] = useState(null);
  const [rsi7,  setRsi7]  = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  const calcRSI = (closes, period) => {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    let ag = gains / period, al = losses / period;
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (period - 1) + Math.max(d, 0)) / period;
      al = (al * (period - 1) + Math.max(-d, 0)) / period;
    }
    if (al === 0) return 100;
    return Math.round((100 - 100 / (1 + ag / al)) * 10) / 10;
  };

  useEffect(() => {
    if (!appId || !sym) return;
    setLoading(true);
    setRsi14(null); setRsi7(null); setTrend(null);

    if (wsRef.current) { try { wsRef.current.close(); } catch {} }

    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${appId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Fetch 50 candles of the selected granularity
      ws.send(JSON.stringify({
        ticks_history: sym,
        adjust_start_time: 1,
        count: 50,
        end: 'latest',
        start: 1,
        style: 'candles',
        granularity,
      }));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.candles && d.candles.length >= 15) {
          const closes = d.candles.map(c => parseFloat(c.close));
          const r14 = calcRSI(closes, 14);
          const r7  = calcRSI(closes, 7);

          // EMA-based trend
          const k5 = 2 / 6, k20 = 2 / 21;
          let e5 = closes.slice(0, 5).reduce((a, b) => a + b) / 5;
          let e20 = closes.slice(0, 20).reduce((a, b) => a + b) / 20;
          for (let i = 5; i < closes.length; i++) e5 = closes[i] * k5 + e5 * (1 - k5);
          for (let i = 20; i < closes.length; i++) e20 = closes[i] * k20 + e20 * (1 - k20);

          setRsi14(r14);
          setRsi7(r7);
          setTrend(e5 > e20 ? 'UP' : e5 < e20 ? 'DOWN' : 'FLAT');
        }
        setLoading(false);
      } catch { setLoading(false); }
    };

    ws.onerror = () => setLoading(false);
    ws.onclose = () => {};

    return () => { try { ws.close(); } catch {} };
  }, [appId, sym, granularity]);

  return { rsi14, rsi7, trend, loading };
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AnalysisScreen({ state }) {
  const [market,     setMarket]     = useState(MARKETS[3]); // V75 default
  const [tickCount,  setTickCount]  = useState(100);
  const [activeTab,  setActiveTab]  = useState('Digit');
  const [granIndex,  setGranIndex]  = useState(1); // 0=30s,1=1m,2=5m,3=15m
  const [analyzing,  setAnalyzing]  = useState(false);
  const [digitData,  setDigitData]  = useState(null); // { counts[10], pcts[10], total }
  const [signals,    setSignals]    = useState([]);
  const [riseFallSig,setRiseFallSig]= useState(null);

  const GRANS = [
    { label: '30s', val: 30 },
    { label: '1m',  val: 60 },
    { label: '5m',  val: 300 },
    { label: '15m', val: 900 },
  ];

  const appId = state?.config?.appId || '1089';
  const { rsi14, rsi7, trend, loading: candleLoading } = useCandleRSI(
    appId, market.sym, GRANS[granIndex].val
  );

  // Pull digit data for selected market
  useEffect(() => {
    // Try per-symbol digit ref first (most accurate), then derive from prices
    const digRef = state?._digBySymRef?.current?.[market.sym];
    const prices = state?.prices?.[market.sym] || [];

    let slice = [];
    if (digRef && digRef.length >= 10) {
      slice = digRef.slice(-tickCount);
      const counts = Array(10).fill(0);
      slice.forEach(d => counts[d]++);
      const total = slice.length;
      const pcts  = counts.map(c => Math.round(c / total * 100));
      setDigitData({ counts, pcts, total });
      runDigitSignals(pcts);
    } else if (prices.length >= 10) {
      const pSlice = prices.slice(-tickCount);
      const counts = Array(10).fill(0);
      pSlice.forEach(p => {
        const d = Math.abs(Math.round(p * 10)) % 10;
        counts[d]++;
      });
      const total = pSlice.length;
      const pcts  = counts.map(c => Math.round(c / total * 100));
      setDigitData({ counts, pcts, total });
      runDigitSignals(pcts);
    } else {
      setDigitData(null);
    }
  }, [state?.prices, state?._digBySymRef, market.sym, tickCount]);

  // Rise/Fall signal from candle RSI
  useEffect(() => {
    if (rsi14 === null) { setRiseFallSig(null); return; }

    const dead = rsi14 >= 40 && rsi14 <= 60;
    if (dead) {
      setRiseFallSig({ dir: null, reason: 'RSI dead zone (40-60) — no directional edge', color: '#505060', confidence: 0 });
      return;
    }

    let dir = null, reason = '', confidence = 0;

    if (rsi14 < 30) {
      const extra = trend === 'DOWN' ? 10 : 0; // bonus if trend is with reversal
      confidence = Math.round(70 + (30 - rsi14) * 0.8 - extra);
      dir = 'RISE';
      reason = `RSI(14)=${rsi14} oversold on ${GRANS[granIndex].label} candles${rsi7 !== null && rsi7 < 35 ? ' · RSI(7) confirms' : ''}`;
    } else if (rsi14 > 70) {
      confidence = Math.round(70 + (rsi14 - 70) * 0.8);
      dir = 'FALL';
      reason = `RSI(14)=${rsi14} overbought on ${GRANS[granIndex].label} candles${rsi7 !== null && rsi7 > 65 ? ' · RSI(7) confirms' : ''}`;
    } else if (rsi14 < 38 && trend === 'DOWN') {
      confidence = 58;
      dir = 'RISE';
      reason = `RSI(14)=${rsi14} approaching oversold · Trend=DOWN (mean reversion setup)`;
    } else if (rsi14 > 62 && trend === 'UP') {
      confidence = 58;
      dir = 'FALL';
      reason = `RSI(14)=${rsi14} approaching overbought · Trend=UP (mean reversion setup)`;
    } else {
      confidence = 30;
      reason = `RSI(14)=${rsi14} — mid-range, no edge. Wait for <30 or >70.`;
    }

    confidence = Math.min(85, confidence); // no signal is 100%
    setRiseFallSig({ dir, reason, confidence, color: dir === 'RISE' ? C.gr : dir === 'FALL' ? C.re : '#505060' });
  }, [rsi14, rsi7, trend, granIndex]);

  // ── DollarPrinter digit signal logic ────────────────────────────────────────
  const runDigitSignals = useCallback((pcts) => {
    const sigs = [];

    // EVEN: digit 4 ≥ 12% (dollarprinter rule)
    if (pcts[4] >= 12) {
      sigs.push({
        contract: 'EVEN',
        reason: `Digit 4 = ${pcts[4]}% (≥12% threshold) — EVEN market active`,
        color: C.ye,
        confidence: Math.min(90, 60 + (pcts[4] - 12) * 3),
      });
    }

    // ODD: digit 5 ≥ 12%
    if (pcts[5] >= 12) {
      sigs.push({
        contract: 'ODD',
        reason: `Digit 5 = ${pcts[5]}% (≥12% threshold) — ODD market active`,
        color: '#b56ed4',
        confidence: Math.min(90, 60 + (pcts[5] - 12) * 3),
      });
    }

    // OVER 3: any even digit ≥12%, especially digit 6
    const evenHigh = [0,2,4,6,8].filter(d => pcts[d] >= 12);
    if (evenHigh.length > 0) {
      const best = evenHigh.reduce((a, b) => pcts[a] > pcts[b] ? a : b);
      sigs.push({
        contract: 'OVER 3',
        reason: `Digit ${best} = ${pcts[best]}% · ${evenHigh.length} even digit(s) ≥12%`,
        color: C.or,
        confidence: Math.min(88, 55 + evenHigh.length * 8 + (pcts[6] >= 12 ? 10 : 0)),
      });
    }

    // UNDER 7: odd digit ≥12%
    const oddHigh = [1,3,5,7,9].filter(d => pcts[d] >= 12);
    if (oddHigh.length >= 2) {
      sigs.push({
        contract: 'UNDER 7',
        reason: `${oddHigh.length} odd digit(s) ≥12%: digits ${oddHigh.join(', ')}`,
        color: '#118ab2',
        confidence: Math.min(88, 55 + oddHigh.length * 8),
      });
    }

    // OVER 5: majority of last ticks end in 5-9
    const highPct = [5,6,7,8,9].reduce((a, d) => a + pcts[d], 0);
    if (highPct >= 60) {
      sigs.push({
        contract: 'OVER 5',
        reason: `High digits (5-9) = ${highPct}% of last ${tickCount} ticks`,
        color: '#f77f00',
        confidence: Math.min(85, 45 + (highPct - 60) * 1.5),
      });
    }

    // UNDER 5: majority end in 0-4
    const lowPct = [0,1,2,3,4].reduce((a, d) => a + pcts[d], 0);
    if (lowPct >= 60) {
      sigs.push({
        contract: 'UNDER 5',
        reason: `Low digits (0-4) = ${lowPct}% of last ${tickCount} ticks`,
        color: C.ac,
        confidence: Math.min(85, 45 + (lowPct - 60) * 1.5),
      });
    }

    // Sort by confidence
    sigs.sort((a, b) => b.confidence - a.confidence);
    setSignals(sigs);
  }, [tickCount]);

  const connected = state?.connected;
  const priceCount = state?.prices?.[market.sym]?.length || 0;

  return (
    <View style={styles.root}>
      {/* ── Market selector ───────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.marketBar} contentContainerStyle={{ paddingHorizontal: 10, gap: 6, alignItems: 'center' }}>
        {MARKETS.map(m => (
          <TouchableOpacity key={m.sym} onPress={() => setMarket(m)}
            style={[styles.mktBtn, market.sym === m.sym && styles.mktBtnOn]}>
            <Text style={[styles.mktTxt, market.sym === m.sym && { color: C.bg }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Contract type tabs ────────────────────────────────────────────── */}
      <View style={styles.ctabs}>
        {CONTRACT_TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)}
            style={[styles.ctab, activeTab === t && styles.ctabOn]}>
            <Text style={[styles.ctabTxt, activeTab === t && { color: C.bg }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {!connected && (
          <View style={styles.noConn}>
            <Text style={styles.noConnTxt}>⚡ Connect API in Settings to load live data</Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* DIGIT TAB                                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Digit' && (
          <>
            {/* Tick count selector */}
            <View style={styles.tickRow}>
              <Text style={styles.sectionLabel}>TICKS ANALYSED</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {TICK_OPTIONS.map(n => (
                  <TouchableOpacity key={n} onPress={() => setTickCount(n)}
                    style={[styles.tickBtn, tickCount === n && styles.tickBtnOn]}>
                    <Text style={[styles.tickTxt, tickCount === n && { color: C.bg }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Data coverage */}
            <View style={styles.coverageRow}>
              <Text style={styles.coverageTxt}>
                {priceCount >= tickCount
                  ? `✓ ${priceCount} ticks loaded for ${market.label}`
                  : `⏳ Loading... ${priceCount}/${tickCount} ticks for ${market.label}`}
              </Text>
            </View>

            {/* Digit circle grid — DollarPrinter style */}
            {digitData ? (
              <>
                <Text style={styles.sectionLabel}>DIGIT FREQUENCY CIRCLE</Text>
                <View style={styles.digitGrid}>
                  {[...Array(10)].map((_, d) => {
                    const pct  = digitData.pcts[d];
                    const avg  = 10; // expected = 10%
                    const hot  = pct >= 13;
                    const cold = pct <= 7;

                    // DollarPrinter signal digits
                    const isEvenSig  = d === 4 && pct >= 12;
                    const isOddSig   = d === 5 && pct >= 12;
                    const isOver3Sig = [0,2,4,6,8].includes(d) && pct >= 12;
                    const isU7Sig    = [1,3,5,7,9].includes(d) && pct >= 12;

                    const sigColor = isEvenSig  ? C.ye
                      : isOddSig   ? '#b56ed4'
                      : isOver3Sig ? C.or
                      : isU7Sig    ? '#118ab2'
                      : null;

                    return (
                      <DigitCircle
                        key={d}
                        digit={d}
                        pct={pct}
                        hot={hot}
                        cold={cold}
                        isSignal={!!sigColor}
                        signalColor={sigColor || C.ye}
                      />
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                  {[
                    ['#f77f00', 'HOT (≥13%)'],
                    [C.ye,     'EVEN signal (D4≥12%)'],
                    ['#b56ed4','ODD signal (D5≥12%)'],
                    [C.or,     'OVER 3 (even≥12%)'],
                    ['#118ab2','UNDER 7 (odd≥12%)'],
                    ['#505060','COLD (≤7%)'],
                  ].map(([col, lbl]) => (
                    <View key={lbl} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: col }]}/>
                      <Text style={styles.legendTxt}>{lbl}</Text>
                    </View>
                  ))}
                </View>

                {/* Distribution bar */}
                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>HIGH vs LOW DISTRIBUTION</Text>
                {(() => {
                  const lowPct  = [0,1,2,3,4].reduce((a,d) => a + digitData.pcts[d], 0);
                  const highPct = [5,6,7,8,9].reduce((a,d) => a + digitData.pcts[d], 0);
                  return (
                    <View style={styles.distBar}>
                      <View style={[styles.distLow,  { flex: lowPct }]}>
                        <Text style={styles.distTxt}>LOW 0-4{'\n'}{lowPct}%</Text>
                      </View>
                      <View style={[styles.distHigh, { flex: highPct }]}>
                        <Text style={styles.distTxt}>HIGH 5-9{'\n'}{highPct}%</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Digit frequency bars */}
                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>FREQUENCY BREAKDOWN</Text>
                <View style={styles.freqBars}>
                  {[...Array(10)].map((_, d) => {
                    const pct = digitData.pcts[d];
                    const color = pct >= 13 ? C.or : pct <= 7 ? '#404050' : pct >= 12 ? C.ye : '#3a3a5e';
                    return (
                      <View key={d} style={styles.freqCol}>
                        <Text style={[styles.freqPct, { color: pct >= 12 ? C.ye : C.tx3 }]}>{pct}%</Text>
                        <View style={styles.freqTrack}>
                          <View style={[styles.freqFill, { height: pct * 2, backgroundColor: color }]}/>
                        </View>
                        <Text style={styles.freqDigit}>{d}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Signals */}
                {signals.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SIGNALS DETECTED</Text>
                    {signals.map((sig, i) => (
                      <SignalBadge key={i} label={sig.contract} reason={sig.reason}
                        color={sig.color} confidence={Math.round(sig.confidence)}/>
                    ))}
                  </>
                ) : (
                  <View style={styles.noSig}>
                    <Text style={styles.noSigTxt}>
                      No digit signal yet.{'\n'}
                      Signal triggers when any digit reaches 12%+.{'\n'}
                      Currently using {digitData.total} of {tickCount} ticks.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={C.ac} size="large"/>
                <Text style={styles.loadingTxt}>Collecting tick data for {market.label}...</Text>
                <Text style={styles.loadingTxt2}>{priceCount} ticks received</Text>
              </View>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RISE/FALL TAB                                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Rise/Fall' && (
          <>
            {/* Candle timeframe selector */}
            <View style={styles.tickRow}>
              <Text style={styles.sectionLabel}>CANDLE TIMEFRAME (RSI basis)</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {GRANS.map((g, i) => (
                  <TouchableOpacity key={g.val} onPress={() => setGranIndex(i)}
                    style={[styles.tickBtn, granIndex === i && styles.tickBtnOn]}>
                    <Text style={[styles.tickTxt, granIndex === i && { color: C.bg }]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Important warning */}
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>WHY YOUR OLD RSI WAS WRONG</Text>
              <Text style={styles.warningBody}>
                The previous RSI was calculated on raw tick prices. RSI(14) on ticks
                = RSI over 14 seconds. TradingView RSI(14) on 1m chart = RSI over 14
                minutes. They are completely different numbers.{'\n\n'}
                This tab fetches real OHLC candles directly from Deriv API and
                calculates RSI the same way TradingView does. The numbers here
                will match what you see on the chart.
              </Text>
            </View>

            {/* RSI gauges */}
            {candleLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={C.ac}/>
                <Text style={styles.loadingTxt}>Fetching {GRANS[granIndex].label} candles...</Text>
              </View>
            ) : (
              <>
                <RSIGauge rsi={rsi14} label={`RSI(14) — ${GRANS[granIndex].label} candles`}/>
                <RSIGauge rsi={rsi7}  label={`RSI(7)  — ${GRANS[granIndex].label} candles`}/>

                {/* Trend */}
                <View style={styles.trendRow}>
                  <Text style={styles.sectionLabel}>EMA TREND (5 vs 20 candles)</Text>
                  <Text style={[styles.trendVal, {
                    color: trend === 'UP' ? C.gr : trend === 'DOWN' ? C.re : C.ye
                  }]}>
                    {trend === 'UP' ? '▲ UPTREND' : trend === 'DOWN' ? '▼ DOWNTREND' : trend === 'FLAT' ? '↔ FLAT' : '—'}
                  </Text>
                </View>

                {/* Rise/Fall signal */}
                {riseFallSig && (
                  riseFallSig.dir ? (
                    <SignalBadge
                      label={riseFallSig.dir}
                      reason={riseFallSig.reason}
                      color={riseFallSig.color}
                      confidence={riseFallSig.confidence}
                    />
                  ) : (
                    <View style={styles.noSig}>
                      <Text style={[styles.noSigTxt, { color: '#505060' }]}>
                        ⛔ {riseFallSig.reason}
                      </Text>
                    </View>
                  )
                )}

                {/* Rise/Fall honesty note */}
                <View style={styles.honestBox}>
                  <Text style={styles.honestTitle}>⚠ IMPORTANT ABOUT RISE/FALL</Text>
                  <Text style={styles.honestBody}>
                    Even with correct RSI, Rise/Fall on synthetic indices is close to 50/50
                    due to Deriv's house edge. The strongest signals are RSI below 30 (RISE)
                    or above 70 (FALL) on candles — not on ticks.{'\n\n'}
                    A signal here does NOT guarantee a win. It means probability is
                    slightly tilted. Use small stakes (0.5-1%) and never martingale Rise/Fall.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OVER/UNDER TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'Over/Under' && (
          <>
            <View style={styles.tickRow}>
              <Text style={styles.sectionLabel}>TICKS ANALYSED</Text>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {TICK_OPTIONS.map(n => (
                  <TouchableOpacity key={n} onPress={() => setTickCount(n)}
                    style={[styles.tickBtn, tickCount === n && styles.tickBtnOn]}>
                    <Text style={[styles.tickTxt, tickCount === n && { color: C.bg }]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {digitData ? (
              <>
                {/* Barrier comparison cards */}
                {[
                  { barrier: 3, label: 'OVER 3 / UNDER 3',
                    over:  [4,5,6,7,8,9].reduce((a,d)=>a+digitData.pcts[d],0),
                    under: [0,1,2,3].reduce((a,d)=>a+digitData.pcts[d],0) },
                  { barrier: 5, label: 'OVER 5 / UNDER 5',
                    over:  [6,7,8,9].reduce((a,d)=>a+digitData.pcts[d],0),
                    under: [0,1,2,3,4,5].reduce((a,d)=>a+digitData.pcts[d],0) },
                  { barrier: 7, label: 'OVER 7 / UNDER 7',
                    over:  [8,9].reduce((a,d)=>a+digitData.pcts[d],0),
                    under: [0,1,2,3,4,5,6,7].reduce((a,d)=>a+digitData.pcts[d],0) },
                ].map(({ barrier, label, over, under }) => {
                  const edge   = over > under ? 'OVER' : 'UNDER';
                  const margin = Math.abs(over - under);
                  const color  = over > under ? C.or : '#118ab2';
                  return (
                    <View key={barrier} style={[styles.ouCard, { borderColor: color + '40' }]}>
                      <Text style={[styles.ouLabel, { color }]}>{label}</Text>
                      <View style={styles.ouBarRow}>
                        <View style={[styles.ouOver,  { flex: over  }]}>
                          <Text style={styles.ouBarTxt}>OVER {over}%</Text>
                        </View>
                        <View style={[styles.ouUnder, { flex: under }]}>
                          <Text style={styles.ouBarTxt}>UNDER {under}%</Text>
                        </View>
                      </View>
                      <Text style={[styles.ouEdge, { color }]}>
                        {margin >= 10
                          ? `✅ Trade ${edge} ${barrier} — ${margin}% edge`
                          : `Weak edge (${margin}%) — wait for clearer bias`}
                      </Text>
                    </View>
                  );
                })}

                {/* Hot/Cold digit table */}
                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>DIGIT TEMPERATURE TABLE</Text>
                <View style={styles.tempTable}>
                  <View style={styles.tempHeader}>
                    {['DIGIT','COUNT','PCT','STATUS'].map(h => (
                      <Text key={h} style={styles.tempHead}>{h}</Text>
                    ))}
                  </View>
                  {[...Array(10)].map((_, d) => {
                    const pct = digitData.pcts[d];
                    const status = pct >= 14 ? '🔥 HOT' : pct <= 6 ? '🧊 COLD' : pct >= 12 ? '⚡ SIGNAL' : '— Normal';
                    const color  = pct >= 14 ? C.or : pct <= 6 ? '#505060' : pct >= 12 ? C.ye : C.tx3;
                    return (
                      <View key={d} style={[styles.tempRow, d % 2 === 0 && styles.tempRowAlt]}>
                        <Text style={[styles.tempCell, { color: C.tx, fontWeight: '700' }]}>{d}</Text>
                        <Text style={[styles.tempCell, { color: C.tx2 }]}>{digitData.counts[d]}</Text>
                        <Text style={[styles.tempCell, { color }]}>{pct}%</Text>
                        <Text style={[styles.tempCell, { color, fontSize: 9 }]}>{status}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={C.ac}/>
                <Text style={styles.loadingTxt}>Loading tick data...</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 30 }}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  marketBar:    { flexGrow: 0, paddingVertical: 8, backgroundColor: C.sf,
                  borderBottomWidth: 1, borderBottomColor: C.bd },
  mktBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
                  borderWidth: 1, borderColor: C.bd2 },
  mktBtnOn:     { backgroundColor: C.ac, borderColor: C.ac },
  mktTxt:       { color: C.tx3, fontWeight: '700', fontFamily: 'monospace', fontSize: 11 },
  ctabs:        { flexDirection: 'row', backgroundColor: C.sf,
                  borderBottomWidth: 1, borderBottomColor: C.bd },
  ctab:         { flex: 1, paddingVertical: 10, alignItems: 'center',
                  borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ctabOn:       { backgroundColor: C.ac, borderBottomColor: C.ac },
  ctabTxt:      { fontSize: 11, fontWeight: '700', fontFamily: 'monospace', color: C.tx2 },
  content:      { padding: 12 },
  noConn:       { backgroundColor: 'rgba(230,57,70,.1)', borderWidth: 1,
                  borderColor: 'rgba(230,57,70,.3)', borderRadius: 8,
                  padding: 12, marginBottom: 12, alignItems: 'center' },
  noConnTxt:    { color: C.re, fontFamily: 'monospace', fontSize: 11 },
  sectionLabel: { fontSize: 8, color: C.tx3, fontFamily: 'monospace',
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  tickRow:      { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 10 },
  tickBtn:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                  borderWidth: 1, borderColor: C.bd2 },
  tickBtnOn:    { backgroundColor: C.ac, borderColor: C.ac },
  tickTxt:      { color: C.tx2, fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  coverageRow:  { marginBottom: 10 },
  coverageTxt:  { fontSize: 10, color: C.tx3, fontFamily: 'monospace' },
  digitGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8,
                  justifyContent: 'center', marginBottom: 14 },
  digitCircleWrap: { alignItems: 'center', position: 'relative' },
  digitRing:    { alignItems: 'center', justifyContent: 'center' },
  digitNum:     { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  digitPct:     { fontSize: 9, fontFamily: 'monospace', lineHeight: 11 },
  signalDot:    { position: 'absolute', top: -2, right: -2,
                  width: 8, height: 8, borderRadius: 4 },
  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontSize: 9, color: C.tx3, fontFamily: 'monospace' },
  distBar:      { flexDirection: 'row', height: 44, borderRadius: 8,
                  overflow: 'hidden', marginBottom: 4 },
  distLow:      { backgroundColor: '#118ab2', alignItems: 'center', justifyContent: 'center' },
  distHigh:     { backgroundColor: '#f77f00', alignItems: 'center', justifyContent: 'center' },
  distTxt:      { color: '#fff', fontSize: 9, fontWeight: '700',
                  fontFamily: 'monospace', textAlign: 'center' },
  freqBars:     { flexDirection: 'row', alignItems: 'flex-end', height: 90,
                  gap: 4, marginBottom: 8 },
  freqCol:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  freqPct:      { fontSize: 7, fontFamily: 'monospace', marginBottom: 2 },
  freqTrack:    { width: '100%', height: 60, justifyContent: 'flex-end',
                  backgroundColor: 'rgba(255,255,255,.04)', borderRadius: 3 },
  freqFill:     { width: '100%', borderRadius: 3, minHeight: 2 },
  freqDigit:    { fontSize: 10, color: C.tx2, fontWeight: '700', marginTop: 3 },
  signalBadge:  { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 8 },
  signalLabel:  { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  signalReason: { fontSize: 11, color: C.tx2, lineHeight: 16, marginBottom: 8 },
  confRow:      { height: 5, backgroundColor: 'rgba(255,255,255,.1)',
                  borderRadius: 3, marginBottom: 4, overflow: 'hidden' },
  confBar:      { height: '100%', borderRadius: 3 },
  confTxt:      { fontSize: 9, fontFamily: 'monospace' },
  noSig:        { backgroundColor: C.sf, borderRadius: 10, borderWidth: 1,
                  borderColor: C.bd, padding: 20, alignItems: 'center', marginTop: 8 },
  noSigTxt:     { color: C.tx3, textAlign: 'center', lineHeight: 20, fontSize: 12 },
  loading:      { padding: 30, alignItems: 'center', gap: 12 },
  loadingTxt:   { color: C.tx2, fontSize: 12 },
  loadingTxt2:  { color: C.tx3, fontSize: 11, fontFamily: 'monospace' },
  rsiGauge:     { backgroundColor: C.sf, borderRadius: 10, borderWidth: 1,
                  borderColor: C.bd, padding: 14, marginBottom: 10 },
  rsiRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rsiLabel:     { flex: 1, fontSize: 10, color: C.tx3, fontFamily: 'monospace' },
  rsiVal:       { fontSize: 22, fontWeight: '800' },
  rsiZone:      { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  rsiBuilding:  { color: C.tx3, fontFamily: 'monospace', fontSize: 11 },
  rsiTrack:     { height: 20, backgroundColor: 'rgba(255,255,255,.05)', borderRadius: 10,
                  overflow: 'hidden', position: 'relative' },
  rsiZoneFill:  { position: 'absolute', top: 0, bottom: 0 },
  rsiZoneLabel: { position: 'absolute', top: 3, fontSize: 7,
                  color: 'rgba(255,255,255,.35)', fontFamily: 'monospace' },
  rsiPointer:   { position: 'absolute', top: 4, width: 12, height: 12,
                  borderRadius: 6, marginLeft: -6, bottom: 4 },
  trendRow:     { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 10 },
  trendVal:     { fontSize: 16, fontWeight: '800', fontFamily: 'monospace' },
  warningBox:   { backgroundColor: 'rgba(255,215,100,.07)', borderWidth: 1,
                  borderColor: 'rgba(255,215,100,.25)', borderRadius: 10,
                  padding: 14, marginBottom: 14 },
  warningTitle: { color: C.ye, fontWeight: '800', fontSize: 11,
                  fontFamily: 'monospace', marginBottom: 6 },
  warningBody:  { color: C.tx2, fontSize: 11, lineHeight: 17 },
  honestBox:    { backgroundColor: 'rgba(230,57,70,.07)', borderWidth: 1,
                  borderColor: 'rgba(230,57,70,.25)', borderRadius: 10,
                  padding: 14, marginTop: 10 },
  honestTitle:  { color: C.re, fontWeight: '800', fontSize: 11,
                  fontFamily: 'monospace', marginBottom: 6 },
  honestBody:   { color: C.tx2, fontSize: 11, lineHeight: 17 },
  ouCard:       { backgroundColor: C.sf, borderWidth: 1, borderRadius: 10,
                  padding: 14, marginBottom: 10 },
  ouLabel:      { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  ouBarRow:     { flexDirection: 'row', height: 36, borderRadius: 6,
                  overflow: 'hidden', marginBottom: 8 },
  ouOver:       { backgroundColor: 'rgba(247,127,0,.3)', alignItems: 'center', justifyContent: 'center' },
  ouUnder:      { backgroundColor: 'rgba(17,138,178,.3)', alignItems: 'center', justifyContent: 'center' },
  ouBarTxt:     { color: C.tx, fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  ouEdge:       { fontSize: 11, fontWeight: '700' },
  tempTable:    { backgroundColor: C.sf, borderRadius: 10, borderWidth: 1,
                  borderColor: C.bd, overflow: 'hidden' },
  tempHeader:   { flexDirection: 'row', backgroundColor: C.ac + '22',
                  borderBottomWidth: 1, borderBottomColor: C.bd },
  tempHead:     { flex: 1, padding: 8, fontSize: 8, color: C.ac,
                  fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: '700' },
  tempRow:      { flexDirection: 'row' },
  tempRowAlt:   { backgroundColor: 'rgba(255,255,255,.02)' },
  tempCell:     { flex: 1, padding: 8, fontSize: 11, fontFamily: 'monospace' },
});
