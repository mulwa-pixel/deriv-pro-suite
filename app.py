from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import json
import threading
import time
from datetime import datetime
import os

from config import Config
from utils.deriv_api import DerivAPI
from bots.bot_manager import BotManager
from utils.logger import TradeLogger

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize components
deriv_api = DerivAPI(app.config['DERIV_APP_ID'], app.config['DERIV_API_TOKEN'])
bot_manager = BotManager(deriv_api, app.config)
logger = TradeLogger()

# Connect to Deriv
deriv_api.connect()

# Start bot manager
bot_manager.start()

# Mock data for demonstration (replace with real API data)
MOCK_MARKETS = {
    'V75': {'price': 12567.89, 'change': 2.3, 'rsi_14': 68.5},
    'V100': {'price': 25678.90, 'change': -1.2, 'rsi_14': 42.3},
    'V50': {'price': 9876.54, 'change': 0.8, 'rsi_14': 55.6},
    'V25': {'price': 5432.10, 'change': 1.5, 'rsi_14': 35.7},
    'V10': {'price': 1234.56, 'change': 0.2, 'rsi_14': 45.8}
}

MOCK_SCANNER = {
    1: {'V75': 72, 'V100': 45, 'V50': 68, 'V25': 55, 'V10': 82},
    2: {'V75': 35, 'V100': 52, 'V50': 71, 'V25': 63, 'V10': 48},
    3: {'V75': 85, 'V100': 62, 'V50': 58, 'V25': 41, 'V10': 73},
    4: {'V75': 67, 'V100': 78, 'V50': 82, 'V25': 69, 'V10': 58},
    5: {'V75': 42, 'V100': 55, 'V50': 63, 'V25': 77, 'V10': 91},
    6: {'V75': 38, 'V100': 43, 'V50': 55, 'V25': 88, 'V10': 62},
    7: {'V75': 71, 'V100': 59, 'V50': 64, 'V25': 52, 'V10': 79}
}

@app.route('/')
def index():
    """Render main dashboard"""
    return render_template('index.html')

@app.route('/scanner')
def scanner():
    """Render scanner page"""
    return render_template('scanner.html')

@app.route('/dashboard')
def dashboard():
    """Render detailed dashboard"""
    return render_template('dashboard.html')

@app.route('/api/initial-data')
def get_initial_data():
    """Get initial data for dashboard"""
    return jsonify({
        'balance': 1234.56,  # Get from Deriv API
        'markets': MOCK_MARKETS,
        'scanner': MOCK_SCANNER,
        'signals': get_active_signals()
    })

@app.route('/api/refresh')
def refresh_data():
    """Refresh basic data"""
    # Get updated balance from Deriv
    balance = deriv_api.get_balance() if hasattr(deriv_api, 'get_balance') else 1234.56
    
    return jsonify({
        'balance': balance,
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/scanner')
def get_scanner_data():
    """Get latest scanner data"""
    return jsonify(MOCK_SCANNER)

@app.route('/api/execute-trade', methods=['POST'])
def execute_trade():
    """Execute a trade"""
    data = request.json
    
    bot_id = data.get('bot_id')
    market = data.get('market')
    stake = data.get('stake')
    
    # Validate
    if not all([bot_id, market, stake]):
        return jsonify({'success': False, 'reason': 'Missing parameters'})
    
    # Check trading hours
    current_hour = datetime.utcnow().hour
    if current_hour < 8 or current_hour >= 20:
        return jsonify({'success': False, 'reason': 'Outside trading hours'})
    
    # Check stake limits
    balance = 1234.56  # Get from Deriv
    max_stake = balance * 0.02
    if stake > max_stake:
        return jsonify({'success': False, 'reason': f'Stake exceeds 2% (${max_stake:.2f})'})
    
    # Get bot from manager
    bot = bot_manager.bots.get(bot_id)
    if not bot:
        return jsonify({'success': False, 'reason': 'Invalid bot ID'})
    
    # Execute trade
    try:
        # Get current market data
        market_data = deriv_api.get_market_data(market) if hasattr(deriv_api, 'get_market_data') else {}
        
        # Execute through bot
        result = bot.execute(market, stake, market_data)
        
        if result.get('success'):
            # Log the trade
            logger.log_trade({
                'bot_id': bot_id,
                'market': market,
                'stake': stake,
                'result': result,
                'time': datetime.utcnow().isoformat()
            })
            
            # Update balance
            new_balance = balance - stake + result.get('payout', 0)
            
            # Emit via WebSocket
            socketio.emit('trade_result', {
                'result': 'win' if result.get('payout', 0) > stake else 'loss',
                'profit': result.get('payout', 0) - stake,
                'new_balance': new_balance
            })
            
            return jsonify({
                'success': True,
                'contract_id': result.get('contract_id'),
                'new_balance': new_balance
            })
        else:
            return jsonify({'success': False, 'reason': result.get('reason', 'Trade failed')})
            
    except Exception as e:
        return jsonify({'success': False, 'reason': str(e)})

@app.route('/api/execute-signal', methods=['POST'])
def execute_signal():
    """Execute a signal trade"""
    data = request.json
    signal_id = data.get('signal_id')
    
    # Find and execute the signal
    # This would come from your signal database
    
    return jsonify({'success': True, 'new_balance': 1250.00})

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    emit('connected', {'message': 'Connected to Deriv Pro Suite'})

def get_active_signals():
    """Get active trading signals"""
    # This would come from your signal detection logic
    return [
        {
            'id': '1',
            'bot': 'Bot #3 - Berlin X9',
            'market': 'V75',
            'direction': 'RISE',
            'score': 85,
            'reason': 'RSI(4) below 33 with EMA confirmation'
        },
        {
            'id': '2',
            'bot': 'Bot #4 - BeastO7',
            'market': 'V100',
            'direction': 'FALL',
            'score': 78,
            'reason': 'Strong EMA separation with RSI above 62'
        }
    ]

def background_scanner():
    """Background thread for scanner updates"""
    while True:
        # Get latest scanner data
        scanner_data = MOCK_SCANNER  # Replace with real data
        
        # Emit to all connected clients
        socketio.emit('scanner_update', {'scanner': scanner_data})
        
        # Check for new signals
        signals = get_active_signals()
        if signals:
            socketio.emit('signal_update', {'signals': signals})
        
        time.sleep(5)  # Update every 5 seconds

# Start background thread
threading.Thread(target=background_scanner, daemon=True).start()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
