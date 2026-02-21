// ─────────────────────────────────────────────────────────────────────────────
// INDICATORS v2 — Candle-based RSI (matches TradingView exactly)
//
// ROOT CAUSE OF WRONG RSI:
//   OLD: RSI calculated on raw tick prices (14 ticks = ~14 seconds)
//   NEW: RSI calculated on OHLC candles (14 candles = 14 minutes on 1m chart)
//
// This is why the app showed "RSI oversold → RISE" but the chart showed
// a mid-range RSI going nowhere. They were measuring completely different things.
//
// Now we:
//   1. Build 1-minute OHLC candles from raw ticks
//   2. Calculate RSI on candle CLOSE prices (matches TradingView 1m RSI)
//   3. Calculate EMAs on candle closes (matches TradingView EMAs)
//   4. Keep digit analysis on raw ticks (correct — digits are tick-level)
// ─────────────────────────────────────────────────────────────────────────────

// ── Build OHLC candles from raw tick array ────────────────────────────────────
// Each tick has a price. We group them into N-second buckets.
export function buildCandles(ticks, tickTimes, candleSeconds = 60) {
  if (!ticks || ticks.length < 2) return [];
  
  const candles = [];
  const now = Date.now();
  // Estimate tick timestamps if not provided (ticks arrive ~1/sec on V75)
  const times = tickTimes || ticks.map((_, i) => now - (ticks.length - 1 - i) * 1000);
  
  const bucketMs = candleSeconds * 1000;
  let bucketStart = Math.floor(times[0] / bucketMs) * bucketMs;
  let open = ticks[0], high = ticks[0], low = ticks[0], close = ticks[0];
  let count = 0;

  for (let i = 0; i < ticks.length; i++) {
    const t = times[i];
    const p = ticks[i];

    if (t >= bucketStart + bucketMs) {
      // Close current candle
      if (count > 0) candles.push({ open, high, low, close, time: bucketStart, count });
      // Advance bucket
      bucketStart = Math.floor(t / bucketMs) * bucketMs;
      open = p; high = p; low = p; close = p; count = 1;
    } else {
      if (count === 0) { open = p; high = p; low = p; }
      high  = Math.max(high, p);
      low   = Math.min(low, p);
      close = p;
      count++;
    }
  }
  // Add last partial candle
  if (count > 0) candles.push({ open, high, low, close, time: bucketStart, count });
  return candles;
}

// ── Wilder's RSI (matches TradingView exactly) ────────────────────────────────
// Uses Wilder's smoothing (not simple average) — same as TradingView default
export function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  // First average gain/loss (simple)
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder smoothing for remaining periods
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain)  / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

// ── EMA (matches TradingView) ─────────────────────────────────────────────────
export function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100000) / 100000;
}

// ── EMA array (all values, not just last) ─────────────────────────────────────
export function calcEMAArray(closes, period) {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  const out = new Array(closes.length).fill(null);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
export function calcBB(closes, period = 20, mult = 2) {
  if (!closes || closes.length < period) return null;
  const s   = closes.slice(-period);
  const m   = s.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / period);
  return { upper: m + mult * std, lower: m - mult * std, mid: m, std, width: std * mult * 2 };
}

// ── MACD ──────────────────────────────────────────────────────────────────────
export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow + signal) return null;
  const emaFast   = calcEMAArray(closes, fast);
  const emaSlow   = calcEMAArray(closes, slow);
  const macdLine  = emaFast.map((v, i) => (v !== null && emaSlow[i] !== null) ? v - emaSlow[i] : null);
  const validMacd = macdLine.filter(v => v !== null);
  if (validMacd.length < signal) return null;
  const signalLine = calcEMA(validMacd, signal);
  const macdVal    = macdLine[macdLine.length - 1];
  return { macd: macdVal, signal: signalLine, hist: macdVal - signalLine,
           bullish: macdVal > signalLine, bearish: macdVal < signalLine };
}

// ── Stochastic ────────────────────────────────────────────────────────────────
export function calcStochastic(candles, period = 14, smoothK = 3) {
  if (!candles || candles.length < period) return null;
  const recent = candles.slice(-period);
  const highestHigh = Math.max(...recent.map(c => c.high));
  const lowestLow   = Math.min(...recent.map(c => c.low));
  const lastClose   = candles[candles.length - 1].close;
  if (highestHigh === lowestLow) return null;
  const rawK = ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  return { k: Math.round(rawK * 10) / 10, overbought: rawK > 80, oversold: rawK < 20 };
}

// ── ATR (Average True Range) — measures volatility ───────────────────────────
export function calcATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], prev = candles[i - 1];
    trs.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low  - prev.close)
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ── Digit helpers (tick-level, correct as-is) ─────────────────────────────────
export function getLastDigit(price) {
  return Math.abs(Math.round(price * 10)) % 10;
}

export function calcStreaks(digits) {
  let even = 0, odd = 0;
  for (let i = digits.length - 1; i >= 0; i--) { if (digits[i] % 2 === 0) even++; else break; }
  for (let i = digits.length - 1; i >= 0; i--) { if (digits[i] % 2 !== 0) odd++;  else break; }
  return { even, odd };
}

export function calcDigitDom(digits, n = 50) {
  const s = digits.slice(-n);
  if (!s.length) return { high: 50, low: 50, dom: 50, highLeads: true, counts: Array(10).fill(0) };
  const counts = Array(10).fill(0);
  s.forEach(d => counts[d]++);
  const hi = s.filter(d => d >= 5).length;
  const hp = Math.round((hi / s.length) * 100);
  return { high: hp, low: 100 - hp, dom: Math.max(hp, 100 - hp), highLeads: hp >= 100 - hp, counts };
}

// ── Candle-based confluence (THE FIXED VERSION) ───────────────────────────────
// All trend indicators now use candle closes, matching TradingView
export function calcConfluence(ticks, digits, utcHour, tickTimes) {
  if (!ticks || ticks.length < 30) return null;

  // Build candles from ticks
  const candles = buildCandles(ticks, tickTimes, 60); // 1-minute candles
  const closes  = candles.map(c => c.close);

  // Need enough candle data for indicators
  const hasCandles = closes.length >= 20;

  // Candle-based RSI (matches TradingView 1m RSI)
  const r14 = hasCandles ? calcRSI(closes, 14) : null;
  const r4  = hasCandles ? calcRSI(closes, 4)  : null;

  // Candle-based EMAs (matches TradingView 1m EMAs)
  const e5  = hasCandles ? calcEMA(closes, 5)  : null;
  const e10 = hasCandles ? calcEMA(closes, 10) : null;
  const e20 = hasCandles ? calcEMA(closes, 20) : null;

  // Candle-based Bollinger Bands
  const bb  = hasCandles ? calcBB(closes, 20)  : null;

  // MACD on candles
  const macd = closes.length >= 35 ? calcMACD(closes) : null;

  // Stochastic on candles
  const stoch = candles.length >= 14 ? calcStochastic(candles) : null;

  // ATR (volatility)
  const atr = candles.length >= 15 ? calcATR(candles) : null;

  // Last candle info
  const lastCandle  = candles[candles.length - 1] || null;
  const lastClose   = closes[closes.length - 1] || ticks[ticks.length - 1] || 0;

  // Price momentum (on candle closes, not ticks)
  const mom5c = closes.length >= 6 ? lastClose - closes[closes.length - 6] : 0;

  // Digit analysis (tick-level — correct)
  const { dom, highLeads, counts } = calcDigitDom(digits);
  const { even: esc, odd: osc }    = calcStreaks(digits);

  // DollarPrinter digit logic:
  // EVEN: digit 4 must be ≥12% (count/total >= 0.12)
  // ODD:  digit 5 must be ≥12%
  // OVER 3: any even digit ≥12%, especially digit 6
  // UNDER 7: any odd digit ≥12%
  const total      = digits.slice(-100).length || 1;
  const dCounts100 = Array(10).fill(0);
  digits.slice(-100).forEach(d => dCounts100[d]++);
  const dPct       = dCounts100.map(c => Math.round(c / total * 100));

  const digit4pct  = dPct[4];
  const digit5pct  = dPct[5];
  const digit6pct  = dPct[6];
  const evenAbove12 = [0,2,4,6,8].some(d => dPct[d] >= 12);
  const oddAbove12  = [1,3,5,7,9].some(d => dPct[d] >= 12);
  const evenAbove10count = [0,2,4,6,8].filter(d => dPct[d] >= 10).length;
  const oddAbove10count  = [1,3,5,7,9].filter(d => dPct[d] >= 10).length;

  // Session
  const inHours = utcHour >= 8 && utcHour < 20;

  // Dead zone — on candle RSI now
  const dead = r14 !== null && r14 >= 40 && r14 <= 60;

  // ── Score factors ──────────────────────────────────────────────────────────
  const factors = [
    { key: 'r14', label: 'RSI(14) Candle', value: r14?.toFixed(1) ?? '—',
      ok:  r14 !== null && !dead,
      weight: 15,
      desc: !r14 ? 'Building...' : dead ? '⛔ DEAD ZONE' : r14 > 70 ? 'Overbought →FALL' : r14 < 30 ? 'Oversold →RISE' : 'Mid-range' },

    { key: 'r4', label: 'RSI(4) Candle', value: r4?.toFixed(1) ?? '—',
      ok:  r4 !== null && (r4 < 33 || r4 > 67),
      weight: 12,
      desc: !r4 ? 'Building...' : r4 < 33 ? 'RISE trigger' : r4 > 67 ? 'FALL trigger' : 'Neutral' },

    { key: 'ema', label: 'EMA Stack', value: e5 && e10 ? Math.abs(e5 - e10).toFixed(4) : '—',
      ok:  !!e5 && !!e10 && Math.abs(e5 - e10) >= 0.01,
      weight: 12,
      desc: !e5 ? 'Building...' : e5>e10&&e10>e20 ? '▲ Bull stack' : e5<e10&&e10<e20 ? '▼ Bear stack' : '↔ Mixed' },

    { key: 'macd', label: 'MACD', value: macd ? (macd.hist >= 0 ? '+' : '') + macd.hist.toFixed(4) : '—',
      ok:  !!macd,
      weight: 10,
      desc: !macd ? 'Building...' : macd.bullish ? '▲ Bullish cross' : '▼ Bearish cross' },

    { key: 'stoch', label: 'Stochastic', value: stoch ? stoch.k.toFixed(1) : '—',
      ok:  stoch?.oversold || stoch?.overbought,
      weight: 8,
      desc: !stoch ? 'Building...' : stoch.oversold ? 'Oversold →RISE' : stoch.overbought ? 'Overbought →FALL' : 'Neutral' },

    { key: 'bb', label: 'Bollinger', value: bb ? (lastClose < bb.lower ? '↓ Below L' : lastClose > bb.upper ? '↑ Above U' : 'Inside') : '—',
      ok:  !!bb && (lastClose <= bb.lower || bb.width < 0.05),
      weight: 8,
      desc: !bb ? 'Building...' : bb.width < 0.05 ? 'Squeeze!' : lastClose < bb.lower ? 'Below band →RISE' : lastClose > bb.upper ? 'Above band →FALL' : 'Normal' },

    { key: 'dig', label: 'Digit Dom', value: dom + '%',
      ok:  dom >= 65,
      weight: 10,
      desc: dom >= 75 ? 'Extreme' : dom >= 65 ? 'Strong' : dom >= 60 ? 'Moderate' : 'Weak' },

    { key: 'dp', label: 'DP Method', value: digit4pct + '% d4',
      ok:  digit4pct >= 12 || digit5pct >= 12,
      weight: 10,
      desc: digit4pct >= 12 ? `Digit4=${digit4pct}% →EVEN` : digit5pct >= 12 ? `Digit5=${digit5pct}% →ODD` : `D4:${digit4pct}% D5:${digit5pct}%` },

    { key: 'str', label: 'Streak', value: esc >= 4 ? esc + '×EVEN' : osc >= 4 ? osc + '×ODD' : 'None',
      ok:  esc >= 4 || osc >= 4,
      weight: 8,
      desc: esc >= 4 ? `${esc} evens →BET ODD` : osc >= 4 ? `${osc} odds →BET EVEN` : 'No streak' },

    { key: 'time', label: 'Session', value: inHours ? 'Active' : 'Off-Hours',
      ok:  inHours,
      weight: 7,
      desc: inHours ? 'Prime hours' : '⛔ Off-hours' },
  ];

  const maxS  = factors.reduce((a, f) => a + f.weight, 0);
  const score = Math.round((factors.reduce((a, f) => a + (f.ok ? f.weight : 0), 0) / maxS) * 100);

  // ── Direction logic — STRICT, multi-indicator confirmation ─────────────────
  let direction = '', bot = '', contract = '';

  // RISE: RSI oversold + stoch oversold + (MACD bullish or EMA bullish)
  const riseRSI   = r14 !== null && r14 < 35;
  const fallRSI   = r14 !== null && r14 > 65;
  const riseStoch = stoch?.oversold;
  const fallStoch = stoch?.overbought;
  const riseMacd  = macd?.bullish;
  const fallMacd  = macd?.bearish;
  const bullEMA   = e5 && e10 && e5 > e10;
  const bearEMA   = e5 && e10 && e5 < e10;

  // Rise/Fall needs at least 2 of 3 confirming signals
  const riseScore = [riseRSI, riseStoch, riseMacd, bullEMA].filter(Boolean).length;
  const fallScore = [fallRSI, fallStoch, fallMacd, bearEMA].filter(Boolean).length;

  if (!dead && inHours) {
    if (riseScore >= 2 && riseScore > fallScore) {
      direction = 'RISE'; bot = 'Multi-Confirm RISE'; contract = 'Rise';
    } else if (fallScore >= 2 && fallScore > riseScore) {
      direction = 'FALL'; bot = 'Multi-Confirm FALL'; contract = 'Fall';
    }
    // DollarPrinter digit logic (highest priority for digit contracts)
    if (digit4pct >= 12 && evenAbove10count >= 3) {
      direction = 'BET EVEN'; bot = 'DP: Digit4≥12%'; contract = 'Even';
    } else if (digit5pct >= 12 && oddAbove10count >= 3) {
      direction = 'BET ODD'; bot = 'DP: Digit5≥12%'; contract = 'Odd';
    } else if (digit6pct >= 12 && evenAbove12) {
      direction = 'OVER 3'; bot = 'DP: Digit6≥12%'; contract = 'Over 3';
    } else if (oddAbove12 && oddAbove10count >= 4) {
      direction = 'UNDER 7'; bot = 'DP: Odd≥12%'; contract = 'Under 7';
    } else if (dom >= 65 && highLeads) {
      direction = 'OVER 5'; bot = 'Gas Hunter'; contract = 'Over 5';
    } else if (dom >= 65 && !highLeads) {
      direction = 'UNDER 5'; bot = 'Hawk U5'; contract = 'Under 5';
    }
    // Streak override for Even/Odd
    if (esc >= 5) { direction = 'BET ODD';  bot = 'Streak ' + esc + '×EVEN'; contract = 'Odd'; }
    if (osc >= 5) { direction = 'BET EVEN'; bot = 'Streak ' + osc + '×ODD';  contract = 'Even'; }
  }

  // Regime from candle EMAs
  let regime = 'RANGING', regimeColor = '#ffd740';
  if (e5 && e10 && e20) {
    const sep = Math.abs(e5 - e10);
    if (sep > 0.01) {
      if (e5 > e10 && e10 > e20) { regime = 'BULLISH';  regimeColor = '#06d6a0'; }
      else if (e5 < e10 && e10 < e20) { regime = 'BEARISH'; regimeColor = '#e63946'; }
    }
  }

  // Warning flags
  const warnings = [];
  if (dead) warnings.push('RSI dead zone — no directional edge');
  if (!inHours) warnings.push('Off-hours — historical edge drops significantly');
  if (candles.length < 14) warnings.push('Building candle data — wait for 14+ candles');
  if (atr && atr > 0.3) warnings.push('High volatility — reduce stake');
  if (riseScore === fallScore && riseScore > 0) warnings.push('Conflicting signals — no clear direction');

  return {
    factors, score, direction, bot, contract,
    // Candle-based values (what TradingView shows)
    r14, r4, e5, e10, e20, bb, macd, stoch, atr,
    // Extra info for display
    mom: mom5c,
    esc, osc,
    regime, regimeColor,
    dead, inHours, warnings,
    // Digit data
    dom, highLeads, dPct, digit4pct, digit5pct, digit6pct,
    // Candle info
    candleCount: candles.length,
    lastCandle,
    riseScore, fallScore,
  };
}
