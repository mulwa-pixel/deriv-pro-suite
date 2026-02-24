class Bot3BerlinX9:
    def __init__(self, api, config):
        self.bot_id = 3
        self.name = "Berlin X9 RSI Momentum"
        self.api = api
        self.config = config
        
    def check_conditions(self, symbol, scores):
        """Check if bot conditions are met"""
        rsi_4 = scores.get('rsi_4', 50)
        ema_5 = scores.get('ema_5', 0)
        ema_10 = scores.get('ema_10', 0)
        rsi_14 = scores.get('rsi_14', 50)
        
        # Check RSI conditions
        if rsi_4 < 33:  # RISE signal
            direction = 'RISE'
            # Confirm with EMA
            if ema_5 < ema_10:
                return True, direction
                
        elif rsi_4 > 67:  # FALL signal
            direction = 'FALL'
            # Confirm with EMA
            if ema_5 > ema_10:
                return True, direction
                
        return False, None
        
    def execute(self, symbol, stake, scores):
        """Execute the trade"""
        condition_met, direction = self.check_conditions(symbol, scores)
        
        if not condition_met:
            return {'success': False, 'reason': 'Conditions not met'}
            
        # Place trade through API
        contract = self.api.buy_contract(
            symbol=symbol,
            amount=stake,
            contract_type=direction,
            duration=5,
            duration_unit='t'
        )
        
        return {
            'success': True,
            'contract': contract,
            'direction': direction,
            'stake': stake
        }
