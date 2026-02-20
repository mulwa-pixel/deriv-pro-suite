// ─────────────────────────────────────────────────────────────────────────────
// DIGIT INTELLIGENCE ENGINE
// Enhanced analysis for Even/Odd and High/Low beyond simple streak counting
// Uses: Markov chains, entropy, mean reversion probability, hot/cold detection
// ─────────────────────────────────────────────────────────────────────────────

// ── Markov transition probability ────────────────────────────────────────────
// Builds a 2x2 matrix: P(Even→Even), P(Even→Odd), P(Odd→Even), P(Odd→Odd)
// from the last N digits, then predicts next parity
export function calcMarkov(digits, window = 60) {
  const d = digits.slice(-window);
  if (d.length < 10) return { prob: 50, next: null, confidence: 0 };

  const parity = d.map(x => x % 2 === 0 ? 0 : 1); // 0=even, 1=odd
  const trans = [[0,0],[0,0]]; // trans[from][to]
  for (let i = 1; i < parity.length; i++) {
    trans[parity[i-1]][parity[i]]++;
  }

  const last = parity[parity.length - 1];
  const row  = trans[last];
  const total = row[0] + row[1];
  if (total === 0) return { prob: 50, next: null, confidence: 0 };

  const probEven = row[0] / total;
  const probOdd  = row[1] / total;
  const next     = probEven > probOdd ? 'EVEN' : 'ODD';
  const prob     = Math.round(Math.max(probEven, probOdd) * 100);
  const confidence = Math.round(Math.abs(probEven - probOdd) * 100);

  return { prob, next, confidence, probEven: Math.round(probEven*100), probOdd: Math.round(probOdd*100) };
}

// ── Entropy (randomness measure) ─────────────────────────────────────────────
// Low entropy = predictable (good for betting)
// High entropy = random (bad — stay out)
export function calcEntropy(digits, window = 30) {
  const d = digits.slice(-window);
  if (d.length < 5) return 1.0;

  const counts = {};
  for (const x of d) counts[x] = (counts[x]||0) + 1;
  let h = 0;
  for (const k of Object.keys(counts)) {
    const p = counts[k] / d.length;
    if (p > 0) h -= p * Math.log2(p);
  }
  // Normalise to 0-1 (max entropy for 10 digits = log2(10) ≈ 3.32)
  return Math.round((h / 3.32) * 100) / 100;
}

// ── Hot/Cold digit detection ──────────────────────────────────────────────────
export function calcHotCold(digits, window = 50) {
  const d = digits.slice(-window);
  const counts = Array(10).fill(0);
  for (const x of d) counts[x]++;
  const avg = d.length / 10;
  const hot  = counts.map((c,i) => ({digit:i, count:c, pct:Math.round(c/d.length*100)}))
                     .filter(x => x.count > avg * 1.3)
                     .sort((a,b) => b.count - a.count);
  const cold = counts.map((c,i) => ({digit:i, count:c, pct:Math.round(c/d.length*100)}))
                     .filter(x => x.count < avg * 0.7)
                     .sort((a,b) => a.count - b.count);
  return { hot, cold, counts, avg: Math.round(avg) };
}

// ── Mean reversion probability ───────────────────────────────────────────────
// After N consecutive same-parity, what's the historical reversion rate?
const REVERSION_TABLE = {
  1: 50, 2: 52, 3: 56, 4: 63, 5: 69,
  6: 74, 7: 78, 8: 81, 9: 84, 10: 86,
};
export function getReversionProb(streakLen) {
  return REVERSION_TABLE[Math.min(streakLen, 10)] || 86;
}

// ── Combined Even/Odd signal ──────────────────────────────────────────────────
export function calcEvenOddSignal(digits) {
  if (digits.length < 10) return null;

  // Current streak
  const parity = x => x % 2 === 0 ? 'EVEN' : 'ODD';
  const last = parity(digits[digits.length - 1]);
  let streak = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    if (parity(digits[i]) === last) streak++;
    else break;
  }

  const markov    = calcMarkov(digits);
  const entropy   = calcEntropy(digits);
  const reversion = getReversionProb(streak);
  const opposite  = last === 'EVEN' ? 'ODD' : 'EVEN';

  // Scoring
  let score = 0;
  let factors = [];

  if (streak >= 4) {
    score += 30 + (streak - 4) * 5;
    factors.push({ label: `${streak}× ${last} streak`, ok: true, detail: `Reversion ${reversion}%` });
  }

  if (markov.next === opposite && markov.confidence >= 15) {
    score += 25;
    factors.push({ label: `Markov → ${opposite}`, ok: true, detail: `${markov.prob}% prob` });
  }

  if (entropy < 0.85) {
    score += 15;
    factors.push({ label: 'Low entropy', ok: true, detail: `${Math.round(entropy*100)}% (predictable)` });
  } else {
    factors.push({ label: 'High entropy', ok: false, detail: `${Math.round(entropy*100)}% (random)` });
  }

  const hotCold = calcHotCold(digits);
  const evenDigits = [0,2,4,6,8];
  const oddDigits  = [1,3,5,7,9];
  const evenHot = hotCold.hot.filter(x => evenDigits.includes(x.digit)).length;
  const oddHot  = hotCold.hot.filter(x => oddDigits.includes(x.digit)).length;
  if (oddHot > evenHot && opposite === 'ODD') {
    score += 15;
    factors.push({ label: 'Odd digits hot', ok: true, detail: `${oddHot} hot odd digits` });
  } else if (evenHot > oddHot && opposite === 'EVEN') {
    score += 15;
    factors.push({ label: 'Even digits hot', ok: true, detail: `${evenHot} hot even digits` });
  }

  score = Math.min(100, score);

  return {
    bet:        score >= 50 ? opposite : null,
    score,
    streak,
    streakDir:  last,
    reversion,
    markov,
    entropy:    Math.round(entropy * 100),
    hotCold,
    factors,
    confidence: score >= 75 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW',
  };
}

// ── Combined High/Low signal ──────────────────────────────────────────────────
export function calcHighLowSignal(digits) {
  if (digits.length < 10) return null;

  const isHigh = x => x >= 5;
  const d50 = digits.slice(-50);

  // Dominance windows
  const dom10 = (() => { const s=digits.slice(-10); const h=s.filter(isHigh).length; return {high:h*10,low:(10-h)*10}; })();
  const dom20 = (() => { const s=digits.slice(-20); const h=s.filter(isHigh).length; return {high:Math.round(h/20*100),low:Math.round((20-h)/20*100)}; })();
  const dom50 = (() => { const s=d50; const h=s.filter(isHigh).length; return {high:Math.round(h/50*100),low:Math.round((50-h)/50*100)}; })();

  // Streak of highs or lows
  const lastIsHigh = isHigh(digits[digits.length-1]);
  let streak = 0;
  for (let i = digits.length-1; i >= 0; i--) {
    if (isHigh(digits[i]) === lastIsHigh) streak++;
    else break;
  }

  // Hot/cold for High digits (5-9) vs Low digits (0-4)
  const hotCold  = calcHotCold(digits);
  const entropy  = calcEntropy(digits);

  // Trend: is last 10 becoming more high-biased or low-biased vs last 50?
  const trend = dom10.high - dom50.high; // positive = shifting higher

  // Build signal
  let score = 0;
  let bet   = null;
  let factors = [];

  // Multi-window confluence: all three windows agree
  const allHighBiased = dom10.high > 55 && dom20.high > 55 && dom50.high > 55;
  const allLowBiased  = dom10.low  > 55 && dom20.low  > 55 && dom50.low  > 55;

  if (allHighBiased) {
    score += 35;
    bet = 'OVER 5';
    factors.push({ label: 'All windows: HIGH', ok: true, detail: `10T:${dom10.high}% 20T:${dom20.high}% 50T:${dom50.high}%` });
  } else if (allLowBiased) {
    score += 35;
    bet = 'UNDER 5';
    factors.push({ label: 'All windows: LOW', ok: true, detail: `10T:${dom10.low}% 20T:${dom20.low}% 50T:${dom50.low}%` });
  }

  // Hot digit alignment
  const highHot = hotCold.hot.filter(x => x.digit >= 5).length;
  const lowHot  = hotCold.hot.filter(x => x.digit < 5).length;
  if (highHot >= 2 && (bet === 'OVER 5' || !bet)) {
    score += 20;
    bet = bet || 'OVER 5';
    factors.push({ label: 'High digits HOT', ok: true, detail: `${highHot} hot high digits` });
  } else if (lowHot >= 2 && (bet === 'UNDER 5' || !bet)) {
    score += 20;
    bet = bet || 'UNDER 5';
    factors.push({ label: 'Low digits HOT', ok: true, detail: `${lowHot} hot low digits` });
  }

  // Streak reversion
  if (streak >= 4) {
    const reversion = getReversionProb(streak);
    const revBet = lastIsHigh ? 'UNDER 5' : 'OVER 5';
    if (bet && bet !== revBet && streak >= 6) {
      // Strong streak opposing current bet — reduce score
      score -= 10;
      factors.push({ label: `${streak}× streak warning`, ok: false, detail: `Reversion to ${revBet} likely` });
    } else if (!bet || bet === revBet) {
      score += 15;
      bet = bet || revBet;
      factors.push({ label: `${streak}× streak reversal`, ok: true, detail: `Reversion ${reversion}%` });
    }
  }

  // Entropy
  if (entropy < 0.80) {
    score += 15;
    factors.push({ label: 'Low entropy', ok: true, detail: `Market predictable` });
  } else if (entropy > 0.92) {
    score -= 10;
    factors.push({ label: 'High entropy', ok: false, detail: `Market too random` });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    bet,
    score,
    streak,
    streakDir: lastIsHigh ? 'HIGH' : 'LOW',
    dom10, dom20, dom50,
    trend,
    hotCold,
    entropy: Math.round(entropy * 100),
    factors,
    confidence: score >= 75 ? 'HIGH' : score >= 55 ? 'MEDIUM' : 'LOW',
  };
}
