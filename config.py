import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DERIV_APP_ID = os.getenv('DERIV_APP_ID', '1089')  # Your Deriv app ID
    DERIV_API_TOKEN = os.getenv('DERIV_API_TOKEN', '')
    
    # Trading Parameters
    MAX_STAKE_PERCENT = 0.02  # 2% max per trade
    DAILY_STOP_LOSS = 0.10  # 10% daily stop loss
    DAILY_PROFIT_TARGET = 0.08  # 8% daily target
    
    # Trading Hours UTC
    TRADING_START_HOUR = 8
    TRADING_END_HOUR = 20
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///trading.db')
    
    # Redis for real-time data (optional)
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
