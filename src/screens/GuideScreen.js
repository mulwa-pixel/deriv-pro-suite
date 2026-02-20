import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Dimensions
} from 'react-native';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');

// ─── Full knowledge base ────────────────────────────────────────────────────
const GUIDE = [
  // ══════════════════════════════════════════════════════
  {
    id: 'philosophy',
    icon: '🎭',
    title: 'The Only Rule That Matters',
    color: C.ac,
    sections: [
      {
        heading: 'You are not gambling. You are reading probability.',
        body: `Every signal in this app is asking one question: "Is the market giving me a high-probability moment right now, or not?"

A 70+ entry score doesn't guarantee a win. It means the conditions that have historically produced wins are currently aligned. Your edge is not in any single trade — it's in making 50 trades where 60–70% of them were entered correctly.

This is why every rule exists. Not to be restrictive, but because every rule removes a low-probability trade from your day.`
      },
      {
        heading: 'The 3 reasons traders lose money',
        items: [
          { label: 'Overtrading', text: 'Entering when conditions say WAIT because "something will happen." Nothing has to happen for you.' },
          { label: 'Ignoring the dead zone', text: 'RSI between 40–60 means the market has no direction. You\'re flipping a coin with no edge.' },
          { label: 'Revenge trading', text: 'After a loss, the urge to "win it back" immediately. The market doesn\'t know or care that you lost. It hasn\'t changed. You have.' },
        ]
      },
      {
        heading: 'The professional mindset',
        body: `A surgeon doesn't operate when they're tired, when the equipment is wrong, or when the diagnosis is unclear — even if the patient is waiting. You are that surgeon. The market will always be open tomorrow. Your capital won't always be there if you trade badly today.`
      }
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'reading_signals',
    icon: '📡',
    title: 'Reading Your Signals',
    color: C.gr,
    sections: [
      {
        heading: 'Entry Score: what it actually measures',
        body: `The Entry Score (0–100) is a weighted sum of 8 conditions. It doesn't predict the future — it measures how many conditions are currently in your favour.

Score 80–100: Multiple strong signals aligned. Rare. Act when it appears.
Score 65–79: Good setup. Most of your trades should be in this zone.
Score 50–64: Partial alignment. Only enter with Bot #1 or Bot #7 (digit-based, less direction-dependent).
Score below 50: Stay out. The math doesn't support a trade.`
      },
      {
        heading: 'RSI(14) — the market\'s pulse',
        items: [
          { label: 'Below 30 (Oversold)', text: 'Market has fallen sharply. Mean reversion likely. RISE trades have strong historical backing here. Bot #3 is your tool.' },
          { label: '30–40 (Recovery zone)', text: 'Recovering from oversold. Rise signals weakening but still valid. Reduce stake to 50%.' },
          { label: '40–60 (Dead zone ⛔)', text: 'No clear direction. Market is ranging. Any trade here is a coin flip. The app warns you clearly — listen to it.' },
          { label: '60–70 (Elevated)', text: 'Market has been rising. Watch for reversal signals. Fall setups begin appearing.' },
          { label: 'Above 70 (Overbought)', text: 'Market has risen sharply. FALL trades have strong backing. Bot #3 primary signal.' },
        ]
      },
      {
        heading: 'RSI(4) — the short-term trigger',
        body: `RSI(4) moves faster than RSI(14). It shows momentum on a 4-tick window.

When RSI(4) < 33: Short-term price drop is exhausted. Bounce likely → RISE signal (Bot #3 specific condition).
When RSI(4) > 67: Short-term rally is exhausted. Pullback likely → FALL signal (Bot #3 specific condition).

The power signal: RSI(14) and RSI(4) agree. If RSI(14) < 35 AND RSI(4) < 33, you have both long-term and short-term oversold confirmation. High-confidence RISE.`
      },
      {
        heading: 'EMA Separation — trend strength',
        body: `EMA 5, 10, and 20 are moving averages over different time windows.

Bullish Stack (EMA5 > EMA10 > EMA20): Short-term trend is above medium-term which is above long-term. Trend is consistently upward.
Bearish Stack: Opposite. Consistent downtrend.
Mixed/Tangled: No clear trend. EMAs fighting each other = ranging market = avoid directional trades.

Separation (the gap between EMA5 and EMA10):
>0.05: Very strong trend — Bot #4 (BeastO7) optimal
0.03–0.05: Strong trend — full stake
0.02–0.03: Moderate — enter but reduce stake
<0.02: Weak — don't trade Bot #4; switch to digit-based bots`
      },
      {
        heading: 'Digit Dominance — for Over/Under trades',
        body: `This applies specifically to Bots #1, #2, #5, #6, #7.

The last digit of each tick price is tracked. If more than 65% of recent digits are 5–9 (high), the market is in "high digit dominance" and OVER 5 trades have statistical backing.

If more than 65% are 0–4 (low), UNDER 5 trades are supported.

Below 60% dominance: No edge. Don't force an Over/Under trade.
At 75%+: Strong signal. Full stake.

The streak counter is separate — it watches for 4+ consecutive digits of the same parity (all even or all odd). When that streak hits, probability of opposite parity increases (Bot #1 and #7).`
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'market_setup',
    icon: '⚙️',
    title: 'Setting Up for Each Market',
    color: C.ye,
    sections: [
      {
        heading: 'V75 — Volatility 75 Index',
        body: `The most traded synthetic. High volatility, clear swings.

Best bots: #3 (Berlin X9), #4 (BeastO7)
Best times: 09:00–17:00 UTC (peak activity)
What to look for: Strong RSI readings (<30 or >70). EMA stack clearly aligned. Avoid during news hours.
Chart setup: 5m timeframe. Add RSI(14), EMA 5/10/20, Bollinger Bands.
Typical entry: RSI(14) > 70, RSI(4) > 67, EMA bearish stack → FALL with Bot #3.`
      },
      {
        heading: 'V10 — Volatility 10 Index',
        body: `Low volatility. Steadier, smaller price movements. Digit patterns are more predictable.

Best bots: #4 (BeastO7), #5 (Gas Hunter), #7 (Even Streak)
Best times: 08:00–20:00 UTC
What to look for: Digit dominance is your primary signal here. EMA separation is smaller in absolute terms — use 0.01+ as your threshold instead of 0.02.
Chart setup: 1m or 5m timeframe. Add RSI and digit analysis overlay.`
      },
      {
        heading: 'V25 — Volatility 25 Index',
        body: `Mid-range volatility. Good balance of movement and predictability.

Best bots: #6 (Hawk Under5), #4 (BeastO7)
Best times: 08:00–18:00 UTC
What to look for: Hawk Under5 needs RSI(14) < 42 AND low digit dominance ≥60%. V25 tends to produce these conditions during early European session.
Chart setup: 5m timeframe. Bollinger Bands are particularly useful here — watch for price touching the lower band with low digit dominance for Bot #6.`
      },
      {
        heading: 'V50 / V100 — Avoid unless you know them',
        body: `V50 is similar to V75 but with slightly lower volatility. Bot #2 (Over/Under) has specific performance data here — 89% win rate on bullish signals.

V100 is the most volatile. Entry conditions must be stricter. Never trade V100 with score below 75. Never use V100 if you're having a bad session — the stakes are effectively higher.`
      },
      {
        heading: '1HZ Indices (1HZ75V, 1HZ100V)',
        body: `These tick every second (1 Hz). Much faster data stream.

RSI(4) becomes very important here because conditions can change in seconds.
EMA separation will look smaller in absolute terms.
Best for: Very experienced users only. The speed of these markets means a slow decision is a wrong decision.
If you're newer: Master V10 and V25 first.`
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'bots_when',
    icon: '🤖',
    title: 'Which Bot, When & Why',
    color: C.pu2,
    sections: [
      {
        heading: 'Morning Session 08:00–12:00 UTC',
        body: `Markets are opening. Trends are establishing. Volatility is building.

Use: Bot #1 (Even/Odd), Bot #3 (Berlin X9), Bot #7 (Even Streak)
Why: RSI extremes are common at open as the market finds direction. Digit streaks are frequent in early sessions.
Avoid: Bot #4 (BeastO7) — EMA separation takes time to develop after open. Bot #2 requires established liquidity.`
      },
      {
        heading: 'Afternoon Session 12:00–18:00 UTC',
        body: `Most active period. Trends are clearer. EMA separations are strongest.

Use: Bot #2 (Over/Under), Bot #4 (BeastO7), Bot #7 (Even Streak)
Why: This is peak trading hours. EMA trends established. Volume drives clear Over/Under moves.
The setup: Check Entry Score first. If ≥65, check which condition is strongest. If EMA sep >0.03 → Bot #4. If digit dom >65% → Bot #2.`
      },
      {
        heading: 'Evening Session 16:00–18:00 UTC',
        body: `Markets slowing. Digit patterns become more prominent as directional moves fade.

Use: Bot #5 (Gas Hunter), Bot #6 (Hawk Under5)
Why: Lower volatility = digit dominance is more stable. Gas Hunter and Hawk are digit-based — perfect for this period.
Stop by 18:00 UTC. After that, the market becomes choppy and unpredictable.`
      },
      {
        heading: 'How to confirm which bot fits right now',
        items: [
          { label: 'Check the Scanner tab', text: 'All 7 bots are scored live. Find the one with the highest score ≥ 60%. That\'s your bot.' },
          { label: 'Check the session time', text: 'Even if a bot shows a good score, if it\'s outside its time window, the historical data doesn\'t support it.' },
          { label: 'Check RSI dead zone', text: 'If RSI(14) is 40–60, no bot has edge. The dead zone overrides all other signals.' },
          { label: 'Only one bot at a time', text: 'Don\'t run 3 bots simultaneously trying to catch every move. Pick the best one, execute it cleanly.' },
        ]
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'entry_process',
    icon: '🎯',
    title: 'The Entry Process (Step by Step)',
    color: C.or,
    sections: [
      {
        heading: 'Step 1 — Check the time',
        body: `Before looking at any signal: what session is it? Morning, Afternoon, Evening, or Off-Hours?

If Off-Hours (before 08:00 or after 20:00 UTC): Close the app. There is no edge trading synthetics outside these windows. The market structure is different.

The app shows your current session on the Dashboard. If it says "Off-Hours" — your job is done for today.`
      },
      {
        heading: 'Step 2 — Check the Scanner',
        body: `Go to the Scanner tab. Look at which bots show TRADE or WATCH (60%+ score).

If no bot shows TRADE: You don't trade. This is not a failure — this is discipline. The market is not set up for you right now.

If one bot shows TRADE: That's your candidate. Note which one.`
      },
      {
        heading: 'Step 3 — Check the Dashboard Entry Score',
        body: `Go to Dashboard. Look at Entry Score.

≥70: Proceed to Step 4.
50–69: Consider only digit-based bots (#1, #5, #6, #7) and with reduced stake.
<50: Do not enter. Wait.

Also check: Is RSI(14) between 40–60? If yes, stop here regardless of score. Dead zone = no trade.`
      },
      {
        heading: 'Step 4 — Open the Deriv chart',
        body: `Go to the Chart tab. Open Deriv chart for your chosen market.

Look at the 5-minute chart. You need to SEE what the score is telling you:
- If score says RISE: is the chart actually in a downtrend that looks ready to bounce?
- If score says FALL: is the chart in an uptrend that looks exhausted?

The chart and the signals must agree. If they disagree — don't trade. The app is reading ticks; you are reading context. You need both.`
      },
      {
        heading: 'Step 5 — Set your stake',
        body: `Default stake: 1–2% of your account balance per trade.

If Entry Score ≥ 80: Up to 2% stake.
If Entry Score 65–79: 1% stake.
If Entry Score 50–64: 0.5% stake only.

Never increase stake because you "feel" the trade is good. The score tells you how good it is. Follow the score, not the feeling.`
      },
      {
        heading: 'Step 6 — Execute and log',
        body: `Place the trade on app.deriv.com.

Immediately go to the Log tab in this app and record:
- Which bot
- Which market  
- Entry score at time of trade
- What the RSI(14) was
- What the RSI(4) was
- Result and P&L

This logging is not optional. Your Memory tab builds its insights from your logs. After 30 trades, it will tell you patterns you can't see manually — like "your win rate when score ≥75 is 78%, but when score 60–74 it's 51%." That data is your edge.`
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'money_management',
    icon: '💰',
    title: 'Money & Risk Management',
    color: C.re,
    sections: [
      {
        heading: 'The numbers that keep you in the game',
        items: [
          { label: 'Per trade: max 2% of balance', text: 'On a $500 account: $10 max. On a $200 account: $4 max. This isn\'t conservative — it\'s survival math.' },
          { label: 'Daily stop-loss: 10% of balance', text: 'If you lose 10% in one day, stop trading. No exceptions. The market will be there tomorrow. You need to be too.' },
          { label: 'Daily profit target: 5–8%', text: 'When you hit your target, stop. You are ahead. Giving profits back because you kept going is the most common mistake.' },
          { label: 'Win rate baseline: 55%+', text: 'At 55% win rate with 1:1 payout, you are profitable. At 60%, you are doing well. Don\'t chase 80% — it doesn\'t exist consistently.' },
        ]
      },
      {
        heading: 'Martingale — the truth',
        body: `The Martingale advisor in the Log tab shows you a suggested stake after losses. Here is what you must understand:

Martingale mathematically recovers losses IF you have unlimited capital and no table limits. You have neither.

The correct version: After 1 loss, normal stake. After 2 consecutive losses: 1.5× stake. After 3: 2× stake. Never beyond 2×.

If you lose 4 trades in a row: Stop for the session. Something in the market structure has changed, or your read is off. No stake multiplier fixes a broken entry condition.`
      },
      {
        heading: 'Streak management',
        body: `Winning streaks feel like skill. Losing streaks feel like bad luck. Both are partially true and partially random.

After 3+ wins: Don't increase stake. The streak ending is exactly as likely as it continuing.
After 2+ losses: Reduce to 50% stake. Check your entry conditions again — are you actually meeting the threshold?
After 4+ losses: Stop for the day. Log your trades, review what conditions were when you entered. Find the pattern.`
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'common_mistakes',
    icon: '⚠️',
    title: 'Mistakes to Avoid',
    color: C.re,
    sections: [
      {
        heading: 'The top mistakes and how to recognise them in yourself',
        items: [
          { label: 'Trading the dead zone', text: 'RSI(14) is 44. The app says ⛔ DEAD ZONE. You trade anyway because "it looks like it\'s about to move." It doesn\'t move. Or it moves against you. You had no edge.' },
          { label: 'Ignoring the session clock', text: 'It\'s 21:00 UTC. You open the app because you\'re bored. You find a "good-looking" signal. You trade. There is no historical backing for this trade. You\'re gambling.' },
          { label: 'Entry score below 50', text: '"The chart looks ready." The chart looks different to what the ticks are saying. The score is 43. You enter. You lose. The score was right.' },
          { label: 'Overtrading after wins', text: '3 wins in a row. You feel confident. You start entering at score 55, then 48, then "this one looks obvious." 4th trade loses. You give back half your gains.' },
          { label: 'Wrong bot for the session', text: 'It\'s 08:30 UTC. You try Bot #4 (BeastO7). EMA separation is only 0.01 — the market just opened and trends haven\'t formed. Bot #4 needs a developed trend. You should have used Bot #3.' },
          { label: 'Not logging trades', text: 'You win. You don\'t log it. You lose. You don\'t log it. After 2 weeks your Memory tab has 3 entries. You have no data on your own performance. You\'re flying blind.' },
        ]
      },
      {
        heading: 'The question to ask before every trade',
        body: `"If I took 100 trades in exactly these conditions, would I be profitable?"

If you can't answer yes with confidence, don't take the trade.

The Entry Score is your answer. ≥70 = yes. ≥65 = probably. <65 = you don't know.`
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'reading_chart',
    icon: '📊',
    title: 'Reading the Deriv Chart',
    color: C.ac,
    sections: [
      {
        heading: 'Indicator setup for each bot',
        items: [
          { label: 'Bot #1, #7 (Even/Odd, Even Streak)', text: 'Chart: any timeframe. The signal is in digits, not price. Use chart only to confirm you\'re not in a spike or news event.' },
          { label: 'Bot #2 (Over/Under)', text: '5m chart. Add: RSI(14), Volume (if available). Look for candle body ≥11% of the candle range for bullish, ≥4% for bearish.' },
          { label: 'Bot #3 (Berlin X9)', text: '5m or 15m chart. Add: RSI(14), RSI(4), EMA 5/10. Entry: the candle should be showing a clear reversal — a hammer for RISE, a shooting star or bearish engulfing for FALL.' },
          { label: 'Bot #4 (BeastO7)', text: '5m chart. Add: EMA 5, EMA 10, EMA 20. You need to SEE the EMAs stacked. If they\'re tangled, don\'t trade even if the score says 65.' },
          { label: 'Bot #5 (Gas Hunter)', text: '1m chart. This is fast. Add: Volume, no EMAs needed. You\'re watching digit dominance in the app — chart is just context.' },
          { label: 'Bot #6 (Hawk Under5)', text: '5m chart. Add: Bollinger Bands. Entry is at or near the lower band with low digit dominance + RSI < 42. All three must align.' },
        ]
      },
      {
        heading: 'What to look for on the chart',
        body: `The app gives you the mathematical signal. The chart gives you the visual story.

You're looking for AGREEMENT. If the app says RISE because RSI is oversold, look at the chart: is there actually a downward trend that has been going on? Or has the price been flat?

A real RISE setup looks like: price has been dropping for several candles, RSI is oversold, and the last 1-2 candles are starting to slow down (smaller bodies, wicks appearing on the bottom).

If the chart tells a different story than the signal, wait for them to align.`
      },
      {
        heading: 'Candlestick patterns that confirm signals',
        items: [
          { label: 'Hammer (RISE confirmation)', text: 'Small body at top, long wick below. The price tried to go lower, got pushed back up. Sellers are losing control. Best when appearing at RSI < 30.' },
          { label: 'Shooting Star (FALL confirmation)', text: 'Small body at bottom, long wick above. Buyers pushed price up but it fell back. Best at RSI > 70.' },
          { label: 'Engulfing candle', text: 'A candle that completely covers the body of the previous candle. Strong momentum signal. Use to confirm Bot #2 entries.' },
          { label: 'Doji', text: 'Open and close nearly equal — indecision. Do not trade at a doji. Wait for the next candle to show direction.' },
        ]
      },
    ]
  },

  // ══════════════════════════════════════════════════════
  {
    id: 'quick_ref',
    icon: '⚡',
    title: 'Quick Reference Card',
    color: C.gr,
    sections: [
      {
        heading: 'Pre-trade checklist (read top to bottom)',
        items: [
          { label: '1. Time check', text: '08:00–20:00 UTC? If no → stop.' },
          { label: '2. Dead zone check', text: 'RSI(14) outside 40–60? If no → stop.' },
          { label: '3. Entry Score', text: '≥65? If no → stop. ≥70 to trade full stake.' },
          { label: '4. Scanner', text: 'At least one bot shows WATCH or TRADE? If no → stop.' },
          { label: '5. Chart agrees', text: 'Visual chart confirms signal direction? If no → wait.' },
          { label: '6. Stake', text: 'Score ≥80 → 2%. Score 65–79 → 1%. Score 50–64 → 0.5%.' },
          { label: '7. Execute', text: 'Place trade on Deriv. Log it immediately after.' },
        ]
      },
      {
        heading: 'Signal colour meanings',
        items: [
          { label: 'Green values', text: 'Condition is met and supporting a trade. The more green the better.' },
          { label: 'Red values', text: 'Condition is working against you. Multiple red = avoid.' },
          { label: 'Yellow/Orange', text: 'Neutral or borderline. Not a block, not a green light.' },
          { label: '⛔ DEAD ZONE', text: 'RSI 40–60. Overrides everything. No trade regardless of other signals.' },
        ]
      },
      {
        heading: 'RSI quick read',
        items: [
          { label: 'RSI(14) < 30', text: 'Strong RISE candidate. Oversold.' },
          { label: 'RSI(14) > 70', text: 'Strong FALL candidate. Overbought.' },
          { label: 'RSI(14) 40–60', text: '⛔ Dead zone. No trade.' },
          { label: 'RSI(4) < 33', text: 'Short-term RISE trigger (Bot #3).' },
          { label: 'RSI(4) > 67', text: 'Short-term FALL trigger (Bot #3).' },
        ]
      },
    ]
  },
];

// ─── Components ──────────────────────────────────────────────────────────────
function ChapterCard({ chapter, onPress, active }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chapterCard, active && { borderColor: chapter.color, backgroundColor: chapter.color + '18' }]}
      activeOpacity={0.75}
    >
      <Text style={styles.chapterIcon}>{chapter.icon}</Text>
      <Text style={[styles.chapterTitle, active && { color: chapter.color }]}>{chapter.title}</Text>
      <Text style={[styles.chevron, { color: active ? chapter.color : C.tx3 }]}>{active ? '▾' : '›'}</Text>
    </TouchableOpacity>
  );
}

function ItemList({ items, accentColor }) {
  return (
    <View style={styles.itemList}>
      {items.map((item, i) => (
        <View key={i} style={[styles.itemRow, { borderLeftColor: accentColor + '66' }]}>
          <Text style={[styles.itemLabel, { color: accentColor }]}>{item.label}</Text>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ section, accentColor }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeading, { color: accentColor }]}>{section.heading}</Text>
      {section.body ? (
        <Text style={styles.sectionBody}>{section.body}</Text>
      ) : null}
      {section.items ? (
        <ItemList items={section.items} accentColor={accentColor} />
      ) : null}
    </View>
  );
}

function Chapter({ chapter }) {
  return (
    <View style={[styles.chapterContent, { borderLeftColor: chapter.color }]}>
      {chapter.sections.map((sec, i) => (
        <Section key={i} section={sec} accentColor={chapter.color} />
      ))}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function GuideScreen() {
  const [activeId, setActiveId] = useState(null);
  const [search,   setSearch]   = useState('');

  const filtered = search.trim().length > 1
    ? GUIDE.filter(ch =>
        ch.title.toLowerCase().includes(search.toLowerCase()) ||
        ch.sections.some(s =>
          s.heading.toLowerCase().includes(search.toLowerCase()) ||
          (s.body || '').toLowerCase().includes(search.toLowerCase()) ||
          (s.items || []).some(it =>
            it.label.toLowerCase().includes(search.toLowerCase()) ||
            it.text.toLowerCase().includes(search.toLowerCase())
          )
        )
      )
    : GUIDE;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 Trading Guide</Text>
        <Text style={styles.headerSub}>Tap any section to expand</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.map(chapter => (
          <View key={chapter.id}>
            <ChapterCard
              chapter={chapter}
              active={activeId === chapter.id}
              onPress={() => setActiveId(activeId === chapter.id ? null : chapter.id)}
            />
            {activeId === chapter.id && <Chapter chapter={chapter}/>}
          </View>
        ))}
        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },

  header:         { padding: 14, backgroundColor: C.sf, borderBottomWidth: 1, borderBottomColor: C.bd },
  headerTitle:    { fontSize: 17, fontWeight: '800', color: C.tx, marginBottom: 2 },
  headerSub:      { fontSize: 10, color: C.tx3, fontFamily: 'monospace' },

  scroll:         { flex: 1 },
  content:        { padding: 10 },

  chapterCard:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.sf, borderRadius: 10,
    borderWidth: 1, borderColor: C.bd,
    padding: 14, marginBottom: 6,
  },
  chapterIcon:    { fontSize: 20, marginRight: 12, width: 28 },
  chapterTitle:   { flex: 1, fontSize: 13, fontWeight: '700', color: C.tx },
  chevron:        { fontSize: 18, fontWeight: '700' },

  chapterContent: {
    borderLeftWidth: 2, marginLeft: 16, marginBottom: 8,
    paddingLeft: 14, paddingBottom: 4,
  },

  section:        { marginBottom: 20 },
  sectionHeading: { fontSize: 13, fontWeight: '800', marginBottom: 8, lineHeight: 19 },
  sectionBody:    {
    fontSize: 12, color: C.tx2, lineHeight: 20,
    backgroundColor: C.sf2, borderRadius: 8,
    padding: 12, borderWidth: 1, borderColor: C.bd,
  },

  itemList:       { gap: 0 },
  itemRow:        {
    borderLeftWidth: 2, paddingLeft: 12,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.bd,
  },
  itemLabel:      { fontSize: 11, fontWeight: '800', fontFamily: 'monospace', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemText:       { fontSize: 12, color: C.tx2, lineHeight: 18 },
});
