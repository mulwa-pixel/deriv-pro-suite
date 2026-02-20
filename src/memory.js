import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple in-memory + AsyncStorage strategy performance database
// Tracks: trades by bot, win/loss patterns, conditions that worked,
// market regime at entry, streak context, and generates insights

const KEY_TRADES    = 'mem_trades';
const KEY_PATTERNS  = 'mem_patterns';
const KEY_INSIGHTS  = 'mem_insights';
const MAX_MEMORY    = 500;  // max trades in memory

class Memory {
  trades   = [];
  patterns = {};
  ready    = false;

  async init() {
    try {
      const t = await AsyncStorage.getItem(KEY_TRADES);
      const p = await AsyncStorage.getItem(KEY_PATTERNS);
      if (t) this.trades   = JSON.parse(t);
      if (p) this.patterns = JSON.parse(p);
      this.ready = true;
    } catch {}
  }

  async logTrade(trade) {
    // Enrich with memory context
    const enriched = {
      ...trade,
      id:        trade.id || Date.now(),
      timestamp: trade.time || new Date().toISOString(),
      botId:     trade.bot,
      result:    trade.res,     // 'WIN' | 'LOSS'
      pnl:       trade.pnl || 0,
      score:     parseFloat(trade.score) || 0,
      conditions:trade.conditions || [],
    };

    this.trades.unshift(enriched);
    if (this.trades.length > MAX_MEMORY) this.trades.pop();

    // Update pattern map
    this._updatePatterns(enriched);

    await AsyncStorage.setItem(KEY_TRADES, JSON.stringify(this.trades));
    await AsyncStorage.setItem(KEY_PATTERNS, JSON.stringify(this.patterns));
  }

  _updatePatterns(trade) {
    const bot = trade.botId || 'Unknown';
    if (!this.patterns[bot]) {
      this.patterns[bot] = { wins:0, losses:0, totalPnl:0, avgScore:0, scoreTotal:0, count:0,
                              winScores:[], lossScores:[], bestConditions:{}, worstConditions:{} };
    }
    const p = this.patterns[bot];
    p.count++;
    p.scoreTotal += trade.score;
    p.avgScore = p.scoreTotal / p.count;

    if (trade.result === 'WIN') {
      p.wins++; p.totalPnl += trade.pnl;
      p.winScores.push(trade.score);
      if (p.winScores.length > 50) p.winScores.shift();
    } else {
      p.losses++; p.totalPnl += trade.pnl;
      p.lossScores.push(trade.score);
      if (p.lossScores.length > 50) p.lossScores.shift();
    }
  }

  // Get stats for a specific bot
  getBotStats(botName) {
    const p = this.patterns[botName];
    if (!p || p.count === 0) return null;
    const wr = Math.round((p.wins / p.count) * 100);
    const avgWinScore  = p.winScores.length  ? Math.round(p.winScores.reduce((a,b)=>a+b,0)  / p.winScores.length)  : 0;
    const avgLossScore = p.lossScores.length ? Math.round(p.lossScores.reduce((a,b)=>a+b,0) / p.lossScores.length) : 0;
    return { ...p, winRate:wr, avgWinScore, avgLossScore };
  }

  // Get all bot performance summary
  getAllStats() {
    return Object.entries(this.patterns).map(([bot, p]) => {
      const wr = p.count > 0 ? Math.round((p.wins/p.count)*100) : 0;
      return { bot, ...p, winRate:wr };
    }).sort((a,b) => b.winRate - a.winRate);
  }

  // Get insights: which conditions correlated with wins
  getInsights(botName) {
    const relevant = this.trades.filter(t => t.botId === botName);
    if (relevant.length < 5) return ['Not enough data yet — keep logging trades'];

    const insights = [];
    const wins = relevant.filter(t => t.result === 'WIN');
    const losses = relevant.filter(t => t.result === 'LOSS');
    const wr = Math.round((wins.length / relevant.length) * 100);

    insights.push(`${wr}% win rate over ${relevant.length} logged trades`);

    // Score analysis
    const avgWinScore  = wins.length  ? Math.round(wins.reduce((a,t) =>a+t.score,0)  / wins.length)  : 0;
    const avgLossScore = losses.length? Math.round(losses.reduce((a,t)=>a+t.score,0) / losses.length): 0;

    if (avgWinScore > avgLossScore + 10) {
      insights.push(`Entry Score ≥${avgWinScore} strongly correlates with wins (avg loss score: ${avgLossScore})`);
    }

    // High-score accuracy
    const highScore = relevant.filter(t => t.score >= 70);
    if (highScore.length >= 3) {
      const hsWr = Math.round((highScore.filter(t=>t.result==='WIN').length / highScore.length)*100);
      insights.push(`Score ≥70 trades: ${hsWr}% win rate (${highScore.length} trades)`);
    }

    // Recent trend
    const recent10 = relevant.slice(0, 10);
    const recentWr  = Math.round((recent10.filter(t=>t.result==='WIN').length / recent10.length) * 100);
    if (recentWr < wr - 15) insights.push(`⚠️ Recent performance declining (${recentWr}% last 10 vs ${wr}% overall)`);
    if (recentWr > wr + 10) insights.push(`📈 Recent performance improving (${recentWr}% last 10 vs ${wr}% overall)`);

    return insights;
  }

  // Streak info: current win/loss streak
  getCurrentStreak() {
    if (!this.trades.length) return { type:'none', count:0 };
    const first = this.trades[0].result;
    let count = 0;
    for (const t of this.trades) {
      if (t.result === first) count++; else break;
    }
    return { type: first==='WIN'?'win':'loss', count };
  }

  // Martingale suggestion based on memory
  getMartingaleAdvice(stake) {
    const streak = this.getCurrentStreak();
    if (streak.type === 'loss' && streak.count >= 2) {
      const mult = Math.min(4, streak.count);
      return {
        suggested: (stake * mult).toFixed(2),
        reason: `${streak.count}-loss streak. Martingale ×${mult}. Max 4× to protect balance.`,
        risk: streak.count >= 3 ? 'HIGH' : 'MODERATE',
      };
    }
    if (streak.type === 'win' && streak.count >= 3) {
      return { suggested: stake.toFixed(2), reason: `${streak.count}-win streak. Keep stake flat. Protect gains.`, risk:'LOW' };
    }
    return { suggested: stake.toFixed(2), reason: 'Normal conditions. Use default stake.', risk:'LOW' };
  }

  async clearAll() {
    this.trades = []; this.patterns = {};
    await AsyncStorage.multiRemove([KEY_TRADES, KEY_PATTERNS, KEY_INSIGHTS]);
  }
}

export default new Memory();