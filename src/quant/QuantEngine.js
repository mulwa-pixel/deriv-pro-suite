/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  DERIV DIGITS QUANT ENGINE                                          ║
 * ║  Probability machine — not a streak tool                            ║
 * ║                                                                      ║
 * ║  Pipeline per tick:                                                  ║
 * ║  tick → store → rolling stats → Markov → entropy → score → signal  ║
 * ║                                                                      ║
 * ║  All math runs < 2ms. Designed to run every tick without lag.       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const EXPECTED_PROB  = 0.10;          // each digit baseline 10%
const WINDOWS        = [50, 100, 300, 1000];
const MAX_TICKS      = 10000;         // per symbol
const MARKOV_BIAS    = 0.14;          // above baseline 0.10 → strong transition
const ENTROPY_MAX    = 3.321928;      // log2(10) — perfect random
const STREAK_TRADE_THRESHOLD = 1.8;   // streak_score = streak / 10

// ── Per-symbol state store ────────────────────────────────────────────────────
// Keyed by symbol: { ticks[], digitCounts[], markov[][], tickTimes[] }
const _state = {};

function getSymState(sym) {
  if (!_state[sym]) {
    _state[sym] = {
      ticks:      [],   // raw digit stream (0-9), max MAX_TICKS
      tickTimes:  [],   // epoch ms per tick
      markov:     Array.from({length:10}, () => Array(10).fill(0)),
      // markov[from][to] = count
    };
  }
  return _state[sym];
}

// ── Ingest a tick ─────────────────────────────────────────────────────────────
export function ingestTick(sym, digit, epochMs) {
  const st = getSymState(sym);

  // Update Markov before pushing new tick
  if (st.ticks.length > 0) {
    const prev = st.ticks[st.ticks.length - 1];
    st.markov[prev][digit]++;
  }

  st.ticks.push(digit);
  st.tickTimes.push(epochMs || Date.now());

  // Trim to MAX_TICKS
  if (st.ticks.length > MAX_TICKS) {
    st.ticks.shift();
    st.tickTimes.shift();
  }
}

// ── Z-score for a digit in a window ──────────────────────────────────────────
// z > +2  → overrepresented → avoid MATCH, use DIFF
// z < -2  → underrepresented → MATCH candidate
function calcZScore(count, n) {
  if (n < 10) return 0;
  const p_d    = count / n;
  const stdDev = Math.sqrt((EXPECTED_PROB * (1 - EXPECTED_PROB)) / n);
  return stdDev === 0 ? 0 : (p_d - EXPECTED_PROB) / stdDev;
}

// ── Rolling digit stats for one window ───────────────────────────────────────
function calcWindowStats(ticks, windowSize) {
  const slice  = ticks.slice(-windowSize);
  const n      = slice.length;
  if (n < 10) return null;

  const counts = Array(10).fill(0);
  slice.forEach(d => counts[d]++);
  const probs  = counts.map(c => c / n);
  const zScores = counts.map(c => calcZScore(c, n));

  return { n, counts, probs, zScores };
}

// ── Entropy of current distribution ──────────────────────────────────────────
// > 3.25 → RANDOM (no trade)
// 3.0–3.25 → TRENDING
// < 3.0   → MEAN REVERSION (best)
export function calcEntropy(ticks, windowSize = 300) {
  const slice = ticks.slice(-windowSize);
  const n     = slice.length;
  if (n < 20) return ENTROPY_MAX;

  const counts = Array(10).fill(0);
  slice.forEach(d => counts[d]++);

  let h = 0;
  for (let d = 0; d < 10; d++) {
    if (counts[d] === 0) continue;
    const p = counts[d] / n;
    h -= p * Math.log2(p);
  }
  return h;
}

// ── Market state from entropy ─────────────────────────────────────────────────
export function getMarketState(entropy) {
  if (entropy > 3.25) return { state: 'RANDOM',       color: '#e63946', tradeable: false };
  if (entropy > 3.00) return { state: 'TRENDING',     color: '#ffd166', tradeable: true  };
  return                     { state: 'MEAN_REVERT',  color: '#06d6a0', tradeable: true  };
}

// ── Streak calculation ────────────────────────────────────────────────────────
// Returns: for each digit, how many ticks since it last appeared
export function calcAbsenceStreaks(ticks) {
  const lastSeen = Array(10).fill(-1);
  const n        = ticks.length;
  for (let i = 0; i < n; i++) lastSeen[ticks[i]] = i;

  const streaks = Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    streaks[d] = lastSeen[d] === -1 ? n : n - 1 - lastSeen[d];
  }
  return streaks;
  // streaks[d] = ticks since digit d last appeared
  // streak_score = streak / 10 → trade when > 1.8 (18+ ticks absent)
}

// ── Tick speed filter ─────────────────────────────────────────────────────────
export function calcTickSpeed(tickTimes, windowSize = 50) {
  const slice = tickTimes.slice(-windowSize);
  if (slice.length < 5) return { avgMs: null, speedScore: 1, verdict: 'UNKNOWN' };

  const intervals = [];
  for (let i = 1; i < slice.length; i++) {
    intervals.push(slice[i] - slice[i - 1]);
  }
  const avg     = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const current = intervals[intervals.length - 1] || avg;
  const score   = avg > 0 ? current / avg : 1;

  return {
    avgMs:      Math.round(avg),
    currentMs:  Math.round(current),
    speedScore: Math.round(score * 100) / 100,
    verdict:    score < 0.7 ? 'FAST_BLOCK' : score > 1.5 ? 'SLOW_HIGH_CONF' : 'NORMAL',
    tradeable:  score >= 0.7,
  };
}

// ── Markov transition probability ─────────────────────────────────────────────
export function calcMarkovTransitions(sym) {
  const st = getSymState(sym);
  const result = Array.from({length:10}, () => Array(10).fill(0));
  for (let from = 0; from < 10; from++) {
    const rowTotal = st.markov[from].reduce((a, b) => a + b, 0);
    if (rowTotal === 0) continue;
    for (let to = 0; to < 10; to++) {
      result[from][to] = Math.round((st.markov[from][to] / rowTotal) * 10000) / 10000;
    }
  }
  return result;
}

// ── Best next digit from Markov ────────────────────────────────────────────────
export function getBestMarkovPrediction(sym, currentDigit) {
  const matrix = calcMarkovTransitions(sym);
  const row    = matrix[currentDigit];
  let best = 0, bestProb = 0;
  for (let d = 0; d < 10; d++) {
    if (row[d] > bestProb) { bestProb = row[d]; best = d; }
  }
  return {
    nextDigit: best,
    prob:      bestProb,
    biased:    bestProb > MARKOV_BIAS,
    baseline:  MARKOV_BIAS,
  };
}

// ── Signal scoring (max 100) ───────────────────────────────────────────────────
/*  Factor            Condition             Score
    Digit Z extreme   |z| > 2               +25
    Streak exhaustion streak_score > 1.8    +20
    Tick speed slow   speed_score > 1.2     +15
    Markov alignment  prob > 0.14           +20
    Market state      MEAN_REVERT           +20   */
export function scoreSignal({ zScore, streakScore, tickSpeed, markovProb, marketState }) {
  let score = 0;
  const breakdown = [];

  if (Math.abs(zScore) > 2) {
    score += 25;
    breakdown.push({ label: 'Z-score extreme', detail: `z=${zScore.toFixed(2)}`, pts: 25 });
  } else if (Math.abs(zScore) > 1.5) {
    score += 12;
    breakdown.push({ label: 'Z-score moderate', detail: `z=${zScore.toFixed(2)}`, pts: 12 });
  }

  if (streakScore > 1.8) {
    score += 20;
    breakdown.push({ label: 'Streak exhaustion', detail: `score=${streakScore.toFixed(1)}`, pts: 20 });
  } else if (streakScore > 1.3) {
    score += 10;
    breakdown.push({ label: 'Streak elevated', detail: `score=${streakScore.toFixed(1)}`, pts: 10 });
  }

  if (tickSpeed?.verdict === 'SLOW_HIGH_CONF') {
    score += 15;
    breakdown.push({ label: 'Tick speed slow', detail: `${tickSpeed.currentMs}ms`, pts: 15 });
  } else if (tickSpeed?.verdict === 'NORMAL') {
    score += 8;
    breakdown.push({ label: 'Tick speed normal', detail: `${tickSpeed.currentMs}ms`, pts: 8 });
  } else if (tickSpeed?.verdict === 'FAST_BLOCK') {
    breakdown.push({ label: '⚡ Speed blocked', detail: 'Too fast', pts: 0 });
  }

  if (markovProb > MARKOV_BIAS) {
    score += 20;
    breakdown.push({ label: 'Markov bias', detail: `${(markovProb*100).toFixed(1)}%>${(MARKOV_BIAS*100)}%`, pts: 20 });
  } else if (markovProb > 0.12) {
    score += 10;
    breakdown.push({ label: 'Markov weak bias', detail: `${(markovProb*100).toFixed(1)}%`, pts: 10 });
  }

  if (marketState?.state === 'MEAN_REVERT') {
    score += 20;
    breakdown.push({ label: 'Mean reversion', detail: 'Best state', pts: 20 });
  } else if (marketState?.state === 'TRENDING') {
    score += 8;
    breakdown.push({ label: 'Trending state', detail: 'OK', pts: 8 });
  } else {
    breakdown.push({ label: '⚠ Random state', detail: 'No trade', pts: 0 });
  }

  return {
    score:     Math.min(100, score),
    breakdown,
    tier:      score >= 80 ? 'AUTO_FULL'
             : score >= 65 ? 'AUTO_SMALL'
             : score >= 50 ? 'MANUAL'
             : 'NO_TRADE',
  };
}

// ── Contract selection logic ───────────────────────────────────────────────────
export function selectContract({ digit, zScore, streakScore, markovPred, probs }) {
  const contracts = [];

  // DIGIT MATCH: z < -2 + streak high + Markov supports repetition
  if (zScore < -2 && streakScore > 1.8) {
    contracts.push({
      type: 'DIGIT MATCH',
      digit,
      reason: `Digit ${digit} underrepresented (z=${zScore.toFixed(2)}) + absent ${Math.round(streakScore*10)} ticks`,
      color: '#06d6a0',
      priority: 1,
    });
  }

  // DIGIT DIFF: z > +2 → overrepresented, bet it WON'T appear
  if (zScore > 2) {
    contracts.push({
      type: 'DIGIT DIFF',
      digit,
      reason: `Digit ${digit} overrepresented (z=+${zScore.toFixed(2)}) → avoid next`,
      color: '#e63946',
      priority: 2,
    });
  }

  // OVER/UNDER from parity distribution
  if (probs) {
    const low  = [0,1,2,3,4].reduce((a,d) => a + probs[d], 0);
    const high = [5,6,7,8,9].reduce((a,d) => a + probs[d], 0);
    if (low > 0.60) contracts.push({ type: 'UNDER 5', digit: null, reason: `Low digits = ${(low*100).toFixed(0)}%`, color: '#118ab2', priority: 3 });
    if (high > 0.60) contracts.push({ type: 'OVER 5', digit: null, reason: `High digits = ${(high*100).toFixed(0)}%`, color: '#f77f00', priority: 3 });
  }

  return contracts.sort((a, b) => a.priority - b.priority);
}

// ── Full analysis for one symbol ───────────────────────────────────────────────
export function analyzeSymbol(sym) {
  const st = getSymState(sym);
  if (st.ticks.length < 50) {
    return { ready: false, tickCount: st.ticks.length, sym };
  }

  const entropy     = calcEntropy(st.ticks, 300);
  const marketState = getMarketState(entropy);
  const tickSpeed   = calcTickSpeed(st.tickTimes, 50);
  const streaks     = calcAbsenceStreaks(st.ticks);
  const lastDigit   = st.ticks[st.ticks.length - 1];
  const markovPred  = getBestMarkovPrediction(sym, lastDigit);
  const matrix      = calcMarkovTransitions(sym);

  // Per-window stats
  const windowStats = {};
  for (const w of WINDOWS) {
    if (st.ticks.length >= w) {
      windowStats[w] = calcWindowStats(st.ticks, w);
    }
  }

  // Primary window for signals (100 ticks)
  const primary = windowStats[100] || windowStats[50];

  // Per-digit signals
  const digitSignals = [];
  if (primary) {
    for (let d = 0; d < 10; d++) {
      const z           = primary.zScores[d];
      const streakScore = streaks[d] / 10;
      const sig         = scoreSignal({
        zScore:      z,
        streakScore,
        tickSpeed,
        markovProb:  markovPred.prob,
        marketState,
      });
      if (sig.tier !== 'NO_TRADE') {
        const contracts = selectContract({
          digit: d, zScore: z, streakScore,
          markovPred, probs: primary.probs,
        });
        if (contracts.length > 0) {
          digitSignals.push({
            digit: d, z, streakScore,
            score: sig.score, tier: sig.tier,
            breakdown: sig.breakdown,
            contracts,
          });
        }
      }
    }
    // Sort by score descending
    digitSignals.sort((a, b) => b.score - a.score);
  }

  // Even/Odd parity skew
  let paritySkew = 0, parityContract = null;
  if (primary) {
    const evenPct = [0,2,4,6,8].reduce((a,d) => a + primary.probs[d], 0);
    const oddPct  = 1 - evenPct;
    paritySkew    = Math.abs(evenPct - oddPct);
    if (paritySkew > 0.25) {
      parityContract = {
        type:   evenPct > oddPct ? 'EVEN' : 'ODD',
        skew:   paritySkew,
        reason: `Parity skew ${(paritySkew*100).toFixed(1)}% > 25% threshold`,
        color:  evenPct > oddPct ? '#ffd166' : '#b56ed4',
      };
    }
  }

  return {
    ready:        true,
    sym,
    tickCount:    st.ticks.length,
    entropy:      Math.round(entropy * 1000) / 1000,
    marketState,
    tickSpeed,
    lastDigit,
    streaks,
    markovPred,
    matrix,
    windowStats,
    primary,
    digitSignals,
    parityContract,
    topSignal:    digitSignals[0] || null,
    updatedAt:    Date.now(),
  };
}

// ── Stake calculator ───────────────────────────────────────────────────────────
export function calcStake(balance, confidenceScore) {
  if (confidenceScore < 50) return 0;
  const pct   = (confidenceScore / 100) * 0.007;  // max 0.7% of balance
  const stake = Math.max(0.35, Math.round(balance * pct * 100) / 100);
  return stake;
}

// ── Kill switch check ──────────────────────────────────────────────────────────
export function checkKillSwitch({ consecutiveLosses, dailyPnlPct }) {
  if (consecutiveLosses >= 4)  return { killed: true, reason: '4 consecutive losses — pause' };
  if (dailyPnlPct <= -0.05)    return { killed: true, reason: 'Daily loss > 5% — stop today' };
  return { killed: false, reason: null };
}

// ── Backtest on stored ticks ───────────────────────────────────────────────────
// Simulate signals on the last N ticks and return win rate
export function backtestSymbol(sym, windowSize = 100, minScore = 65) {
  const st = getSymState(sym);
  if (st.ticks.length < windowSize * 2) return null;

  const results = [];
  // Walk through history with step of 10
  for (let i = windowSize; i < st.ticks.length - 10; i += 5) {
    const slice    = st.ticks.slice(i - windowSize, i);
    const stats    = calcWindowStats(slice, windowSize);
    if (!stats) continue;

    // Find best signal digit
    let bestZ = 0, bestDigit = -1;
    for (let d = 0; d < 10; d++) {
      if (Math.abs(stats.zScores[d]) > Math.abs(bestZ)) {
        bestZ = stats.zScores[d]; bestDigit = d;
      }
    }
    if (Math.abs(bestZ) < 1.5 || bestDigit === -1) continue;

    const streaks  = calcAbsenceStreaks(slice);
    const streakSc = streaks[bestDigit] / 10;
    const sig      = scoreSignal({ zScore: bestZ, streakScore: streakSc,
      tickSpeed: { verdict: 'NORMAL' }, markovProb: 0.10, marketState: { state: 'MEAN_REVERT' } });
    if (sig.score < minScore) continue;

    // Check next 10 ticks
    const next10   = st.ticks.slice(i, i + 10);
    const appeared = next10.includes(bestDigit);
    const contract = bestZ < 0 ? 'MATCH' : 'DIFF';
    const won      = contract === 'MATCH' ? appeared : !appeared;

    results.push({ digit: bestDigit, z: bestZ, score: sig.score, contract, won });
  }

  if (results.length === 0) return null;
  const wins = results.filter(r => r.won).length;
  return {
    total:    results.length,
    wins,
    winRate:  Math.round((wins / results.length) * 100),
    avgScore: Math.round(results.reduce((a, r) => a + r.score, 0) / results.length),
    results:  results.slice(-50),
  };
}

// ── Exported helpers ───────────────────────────────────────────────────────────
export { WINDOWS, EXPECTED_PROB, STREAK_TRADE_THRESHOLD, ENTROPY_MAX, MARKOV_BIAS };
export { calcWindowStats, calcZScore };
