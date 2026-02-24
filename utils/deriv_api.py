import websocket
import json
import threading
import time
from datetime import datetime
import pandas as pd
import numpy as np

class DerivAPI:
    def __init__(self, app_id, api_token=None):
        self.app_id = app_id
        self.api_token = api_token
        self.ws = None
        self.connected = False
        self.tick_data = {}
        self.candle_data = {}
        self.subscribers = []
        
    def connect(self):
        """Connect to Deriv WebSocket API"""
        websocket.enableTrace(False)
        self.ws = websocket.WebSocketApp(
            f"wss://ws.derivws.com/websockets/v3?app_id={self.app_id}",
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
        
    def on_open(self, ws):
        print("Connected to Deriv")
        self.connected = True
        
        # Authorize if token provided
        if self.api_token:
            self.authorize(self.api_token)
            
        # Subscribe to all needed markets
        self.subscribe_all()
        
    def on_message(self, ws, message):
        """Handle incoming messages"""
        data = json.loads(message)
        
        # Handle ticks
        if 'tick' in data:
            self.process_tick(data['tick'])
            
        # Handle candles
        elif 'candle' in data:
            self.process_candle(data['candle'])
            
        # Notify subscribers
        for subscriber in self.subscribers:
            subscriber(data)
            
    def process_tick(self, tick):
        """Process tick data and calculate indicators"""
        symbol = tick['symbol']
        price = float(tick['quote'])
        epoch = tick['epoch']
        
        # Store tick
        if symbol not in self.tick_data:
            self.tick_data[symbol] = []
            
        self.tick_data[symbol].append({
            'price': price,
            'epoch': epoch,
            'time': datetime.fromtimestamp(epoch)
        })
        
        # Keep last 1000 ticks
        self.tick_data[symbol] = self.tick_data[symbol][-1000:]
        
        # Calculate real-time indicators
        self.calculate_indicators(symbol)
        
    def calculate_indicators(self, symbol):
        """Calculate RSI, EMA, and other indicators"""
        ticks = self.tick_data[symbol]
        if len(ticks) < 20:
            return
            
        prices = [t['price'] for t in ticks]
        
        # Calculate RSI(14)
        rsi_14 = self.calculate_rsi(prices, 14)
        
        # Calculate RSI(4)
        rsi_4 = self.calculate_rsi(prices, 4)
        
        # Calculate EMAs
        ema_5 = self.calculate_ema(prices, 5)
        ema_10 = self.calculate_ema(prices, 10)
        ema_20 = self.calculate_ema(prices, 20)
        
        # Calculate digit dominance
        last_50_prices = prices[-50:]
        last_50_digits = [int(str(p)[-1]) for p in last_50_prices]
        high_digits = sum(1 for d in last_50_digits if d >= 5)
        low_digits = 50 - high_digits
        digit_dominance = (high_digits / 50) * 100
        
        # Calculate streak
        streak = self.calculate_streak(last_50_digits)
        
        return {
            'rsi_14': rsi_14,
            'rsi_4': rsi_4,
            'ema_5': ema_5,
            'ema_10': ema_10,
            'ema_20': ema_20,
            'digit_dominance': digit_dominance,
            'streak': streak
        }
        
    def calculate_rsi(self, prices, period):
        """Calculate RSI"""
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            return 100
            
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
        
    def calculate_ema(self, prices, period):
        """Calculate EMA"""
        if len(prices) < period:
            return prices[-1] if prices else 0
            
        multiplier = 2 / (period + 1)
        ema = prices[0]
        
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
            
        return ema
        
    def calculate_streak(self, digits):
        """Calculate consecutive same parity digits"""
        if not digits:
            return 0
            
        streak = 1
        last_parity = digits[-1] % 2
        
        for digit in reversed(digits[:-1]):
            if digit % 2 == last_parity:
                streak += 1
            else:
                break
                
        return streak
        
    def subscribe_ticks(self, symbols):
        """Subscribe to tick streams"""
        for symbol in symbols:
            subscribe_msg = {
                "ticks": symbol,
                "subscribe": 1
            }
            self.ws.send(json.dumps(subscribe_msg))
            
    def buy_contract(self, symbol, amount, contract_type, duration, duration_unit='t'):
        """Place a buy contract"""
        proposal = {
            "proposal": 1,
            "amount": amount,
            "basis": "stake",
            "contract_type": contract_type,
            "currency": "USD",
            "duration": duration,
            "duration_unit": duration_unit,
            "symbol": symbol
        }
        
        self.ws.send(json.dumps(proposal))
        
    def on_error(self, ws, error):
        print(f"Error: {error}")
        
    def on_close(self, ws, close_status_code, close_msg):
        print("Disconnected from Deriv")
        self.connected = False
