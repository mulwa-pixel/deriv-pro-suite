from datetime import datetime
import threading
import time
from .bot1_even_odd import Bot1EvenOdd
from .bot3_berlin_x9 import Bot3BerlinX9
from .bot4_beast_o7 import Bot4BeastO7
from .bot5_gas_hunter import Bot5GasHunter
from .bot6_hawk_under5 import Bot6HawkUnder5
from .bot7_even_streak import Bot7EvenStreak
from strategies.score_calculator import ScoreCalculator
from utils.logger import TradeLogger

class BotManager:
    def __init__(self, deriv_api, config):
        self.api = deriv_api
        self.config = config
        self.logger = TradeLogger()
        self.score_calculator = ScoreCalculator()
        
        # Initialize bots
        self.bots = {
            1: Bot1EvenOdd(self.api, self.config),
            3: Bot3BerlinX9(self.api, self.config),
            4: Bot4BeastO7(self.api, self.config),
            5: Bot5GasHunter(self.api, self.config),
            6: Bot6HawkUnder5(self.api, self.config),
            7: Bot7EvenStreak(self.api, self.config)
        }
        
        self.active_trades = []
        self.is_running = False
        
    def start(self):
        """Start the bot manager"""
        self.is_running = True
        self.scanner_thread = threading.Thread(target=self.scanner_loop)
        self.scanner_thread.daemon = True
        self.scanner_thread.start()
        
    def scanner_loop(self):
        """Main scanner loop - checks for signals every second"""
        while self.is_running:
            try:
                # Check if within trading hours
                if not self.is_trading_hours():
                    time.sleep(60)  # Check every minute
                    continue
                    
                # Check daily limits
                if self.daily_limits_reached():
                    time.sleep(300)  # Check every 5 minutes
                    continue
                    
                # Scan all markets
                for symbol in ['V75', 'V100', 'V50', 'V25', 'V10']:
                    if symbol in self.api.tick_data:
                        scores = self.score_calculator.calculate_all_scores(
                            symbol, 
                            self.api.tick_data[symbol]
                        )
                        
                        # Update scanner data
                        self.update_scanner(symbol, scores)
                        
                        # Check if we should trade
                        self.evaluate_trades(symbol, scores)
                        
                time.sleep(1)  # Check every second
                
            except Exception as e:
                print(f"Scanner error: {e}")
                time.sleep(5)
                
    def evaluate_trades(self, symbol, scores):
        """Evaluate if we should trade based on scores"""
        # Find best bot
        best_bot = max(scores.items(), key=lambda x: x[1])
        bot_id, bot_score = best_bot
        
        # Check minimum score
        if bot_score < 65:
            return
            
        # Check dead zone
        rsi_14 = scores.get('rsi_14', 50)
        if 40 <= rsi_14 <= 60:
            return
            
        # Get bot instance
        bot = self.bots.get(bot_id)
        if not bot:
            return
            
        # Check bot-specific conditions
        if bot.check_conditions(symbol, scores):
            # Calculate stake
            stake = self.calculate_stake(bot_score)
            
            # Execute trade
            self.execute_trade(bot, symbol, stake, scores)
            
    def calculate_stake(self, score):
        """Calculate stake based on entry score"""
        balance = self.get_current_balance()
        
        if score >= 80:
            return balance * 0.02  # 2%
        elif score >= 65:
            return balance * 0.01  # 1%
        elif score >= 50:
            return balance * 0.005  # 0.5%
        else:
            return 0
            
    def execute_trade(self, bot, symbol, stake, scores):
        """Execute a trade"""
        if stake <= 0:
            return
            
        trade = {
            'bot_id': bot.bot_id,
            'symbol': symbol,
            'stake': stake,
            'scores': scores,
            'time': datetime.now(),
            'status': 'pending'
        }
        
        # Execute through bot
        result = bot.execute(symbol, stake, scores)
        
        trade['result'] = result
        trade['status'] = 'completed'
        
        # Log the trade
        self.logger.log_trade(trade)
        self.active_trades.append(trade)
        
    def is_trading_hours(self):
        """Check if current time is within trading hours"""
        current_hour = datetime.utcnow().hour
        return (self.config.TRADING_START_HOUR <= current_hour < 
                self.config.TRADING_END_HOUR)
        
    def daily_limits_reached(self):
        """Check if daily limits are reached"""
        today_trades = self.logger.get_today_trades()
        
        total_pnl = sum(t.get('pnl', 0) for t in today_trades)
        balance = self.get_current_balance()
        
        # Check stop loss
        if total_pnl <= -balance * self.config.DAILY_STOP_LOSS:
            return True
            
        # Check profit target
        if total_pnl >= balance * self.config.DAILY_PROFIT_TARGET:
            return True
            
        return False
        
    def update_scanner(self, symbol, scores):
        """Update scanner data for frontend"""
        # This would be sent via WebSocket to connected clients
        scanner_data = {
            'symbol': symbol,
            'scores': scores,
            'timestamp': datetime.now().isoformat()
        }
        # Emit via WebSocket
        pass
        
    def get_current_balance(self):
        """Get current account balance"""
        # This would fetch from Deriv API
        return 1000  # Placeholder
