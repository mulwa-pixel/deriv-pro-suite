import numpy as np
from datetime import datetime

class ScoreCalculator:
    def __init__(self):
        self.weights = {
            'rsi_14': 15,
            'rsi_4': 15,
            'ema_alignment': 15,
            'digit_dominance': 15,
            'momentum_5t': 10,
            'bollinger': 10,
            'session_time': 10,
            'digit_streak': 10
        }
        
    def calculate_all_scores(self, symbol, tick_data):
        """Calculate scores for all bots"""
        if len(tick_data) < 20:
            return {}
            
        # Get indicator values
        indicators = self.calculate_indicators(tick_data)
        
        # Calculate individual bot scores
        scores = {
            1: self.calculate_bot1_score(indicators),
            2: self.calculate_bot2_score(indicators),
            3: self.calculate_bot3_score(indicators),
            4: self.calculate_bot4_score(indicators),
            5: self.calculate_bot5_score(indicators),
            6: self.calculate_bot6_score(indicators),
            7: self.calculate_bot7_score(indicators),
            # Add all indicators for reference
            'rsi_14': indicators['rsi_14'],
            'rsi_4': indicators['rsi_4'],
            'ema_5': indicators['ema_5'],
            'ema_10': indicators['ema_10'],
            'ema_20': indicators['ema_20'],
            'digit_dominance': indicators['digit_dominance'],
            'digit_streak': indicators['digit_streak']
        }
        
        return scores
        
    def calculate_indicators(self, tick_data):
        """Calculate all technical indicators"""
        prices = [t['price'] for t in tick_data]
        
        return {
            'rsi_14': self.calculate_rsi(prices, 14),
            'rsi_4': self.calculate_rsi(prices, 4),
            'ema_5': self.calculate_ema(prices, 5),
            'ema_10': self.calculate_ema(prices, 10),
            'ema_20': self.calculate_ema(prices, 20),
            'digit_dominance': self.calculate_digit_dominance(prices),
            'digit_streak': self.calculate_digit_streak(prices),
            'momentum': self.calculate_momentum(prices),
            'bollinger': self.calculate_bollinger(prices)
        }
        
    def calculate_bot3_score(self, indicators):
        """Calculate score for Bot #3 - Berlin X9"""
        score = 0
        rsi_14 = indicators['rsi_14']
        rsi_4 = indicators['rsi_4']
        
        # RSI(14) conditions
        if rsi_14 < 30 or rsi_14 > 70:
            score += 15
        elif rsi_14 < 35 or rsi_14 > 65:
            score += 10
            
        # RSI(4) conditions
        if rsi_4 < 33 or rsi_4 > 67:
            score += 15
        elif rsi_4 < 35 or rsi_4 > 65:
            score += 10
            
        # EMA alignment check
        if indicators['ema_5'] < indicators['ema_10'] and rsi_4 < 33:
            score += 15
        elif indicators['ema_5'] > indicators['ema_10'] and rsi_4 > 67:
            score += 15
            
        return min(100, score)
        
    def calculate_bot4_score(self, indicators):
        """Calculate score for Bot #4 - BeastO7"""
        score = 0
        ema_separation = abs(indicators['ema_5'] - indicators['ema_10'])
        
        # EMA separation strength
        if ema_separation > 0.05:
            score += 30
        elif ema_separation > 0.03:
            score += 25
        elif ema_separation > 0.02:
            score += 20
        elif ema_separation > 0.01:
            score += 15
            
        # EMA stack check
        if (indicators['ema_5'] > indicators['ema_10'] > indicators['ema_20']):
            score += 15  # Bullish stack
        elif (indicators['ema_5'] < indicators['ema_10'] < indicators['ema_20']):
            score += 15  # Bearish stack
            
        # RSI filter
        rsi_14 = indicators['rsi_14']
        if rsi_14 < 38 or rsi_14 > 62:
            score += 15
            
        return min(100, score)
        
    def calculate_bot5_score(self, indicators):
        """Calculate score for Bot #5 - Gas Hunter"""
        score = 0
        digit_dom = indicators['digit_dominance']
        
        # Digit dominance
        if digit_dom > 75:
            score += 30
        elif digit_dom > 65:
            score += 25
        elif digit_dom > 60:
            score += 15
            
        # RSI confirmation
        rsi_14 = indicators['rsi_14']
        if digit_dom > 60 and rsi_14 > 55:  # Over signal
            score += 20
        elif digit_dom < 40 and rsi_14 < 45:  # Under signal
            score += 20
            
        return min(100, score)
        
    def calculate_bot6_score(self, indicators):
        """Calculate score for Bot #6 - Hawk Under5"""
        score = 0
        digit_dom = indicators['digit_dominance']
        rsi_14 = indicators['rsi_14']
        
        # Low digit dominance
        if digit_dom < 40:  # Low digits dominating (Under 5)
            score += 25
        elif digit_dom < 35:
            score += 30
            
        # RSI below 42
        if rsi_14 < 42:
            score += 25
        elif rsi_14 < 45:
            score += 15
            
        # Price near lower Bollinger
        bollinger = indicators['bollinger']
        if bollinger['position'] < 0.2:  # Near lower band
            score += 20
            
        return min(100, score)
        
    def calculate_rsi(self, prices, period):
        """Calculate RSI"""
        if len(prices) < period + 1:
            return 50
            
        deltas = np.diff(prices[-period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        
        if avg_loss == 0:
            return 100 if avg_gain > 0 else 50
            
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
        
    def calculate_ema(self, prices, period):
        """Calculate EMA"""
        if len(prices) < period:
            return prices[-1] if prices else 0
            
        multiplier = 2 / (period + 1)
        ema = prices[0]
        
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
            
        return ema
        
    def calculate_digit_dominance(self, prices):
        """Calculate high digit (5-9) percentage"""
        last_50 = prices[-50:] if len(prices) >= 50 else prices
        digits = [int(str(p)[-1]) for p in last_50]
        high_digits = sum(1 for d in digits if d >= 5)
        return (high_digits / len(last_50)) * 100
        
    def calculate_digit_streak(self, prices):
        """Calculate consecutive same parity digits"""
        if len(prices) < 2:
            return 0
            
        digits = [int(str(p)[-1]) for p in prices[-10:]]
        streak = 1
        last_parity = digits[-1] % 2
        
        for digit in reversed(digits[:-1]):
            if digit % 2 == last_parity:
                streak += 1
            else:
                break
                
        return streak
        
    def calculate_momentum(self, prices):
        """Calculate 5-tick momentum"""
        if len(prices) < 5:
            return 0
        return prices[-1] - prices[-5]
        
    def calculate_bollinger(self, prices):
        """Calculate Bollinger Bands position"""
        if len(prices) < 20:
            return {'position': 0.5, 'upper': 0, 'lower': 0}
            
        period = 20
        sma = np.mean(prices[-period:])
        std = np.std(prices[-period:])
        upper = sma + 2 * std
        lower = sma - 2 * std
        current = prices[-1]
        
        # Position relative to bands (0 at lower, 1 at upper)
        if upper - lower > 0:
            position = (current - lower) / (upper - lower)
        else:
            position = 0.5
            
        return {
            'position': position,
            'upper': upper,
            'lower': lower,
            'current': current
        }
