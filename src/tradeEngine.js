// ─────────────────────────────────────────────────────────────────────────────
// DERIV TRADE ENGINE
// Executes real trades via WebSocket API — buy, sell, cancel, monitor P&L
// Mirrors what dollarprinter.com / binarytool.com do internally
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

// Contract type mappings → Deriv API contract_type strings
export const CONTRACT_TYPES = {
  'Rise':    'CALL',
  'Fall':    'PUT',
  'Even':    'DIGITEVEN',
  'Odd':     'DIGITODD',
  'Over 5':  'DIGITOVER',
  'Under 5': 'DIGITUNDER',
  'Match 0': 'DIGITMATCH',
  'Diff 0':  'DIGITDIFF',
};

export const SYMBOL_MAP = {
  'V75':     'R_75',
  'V100':    'R_100',
  'V25':     'R_25',
  'V50':     'R_50',
  'V10':     'R_10',
  '1HZ100V': '1HZ100V',
  '1HZ75V':  '1HZ75V',
  '1HZ10V':  '1HZ10V',
};

export const DURATION_MAP = {
  't5':  { duration: 5,  duration_unit: 't' },
  't10': { duration: 10, duration_unit: 't' },
  't15': { duration: 15, duration_unit: 't' },
  't20': { duration: 20, duration_unit: 't' },
  't30': { duration: 30, duration_unit: 't' },
  's60': { duration: 60, duration_unit: 's' },
};

class TradeEngine {
  ws       = null;
  token    = '';
  appId    = '';
  reqId    = 1;
  pending  = {};   // reqId → {resolve, reject}
  openContracts = {};  // contract_id → contract info
  onUpdate = null; // callback for UI updates
  balance  = null;
  connected = false;

  // ── Connect ───────────────────────────────────────────────────────────────
  connect(ws, token) {
    this.ws    = ws;
    this.token = token;
  }

  // ── Send a request, return promise ───────────────────────────────────────
  send(payload) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const id = this.reqId++;
      payload.req_id = id;
      this.pending[id] = { resolve, reject };
      this.ws.send(JSON.stringify(payload));
      // Timeout after 15s
      setTimeout(() => {
        if (this.pending[id]) {
          delete this.pending[id];
          reject(new Error('Request timed out'));
        }
      }, 15000);
    });
  }

  // ── Handle incoming WS message (called from App.js onmessage) ────────────
  handleMessage(data) {
    const { req_id, msg_type } = data;

    // Resolve pending promise
    if (req_id && this.pending[req_id]) {
      if (data.error) {
        this.pending[req_id].reject(new Error(data.error.message));
      } else {
        this.pending[req_id].resolve(data);
      }
      delete this.pending[req_id];
    }

    // Contract bought
    if (msg_type === 'buy') {
      if (data.buy) {
        const c = {
          id:          data.buy.contract_id,
          shortcode:   data.buy.shortcode,
          buyPrice:    data.buy.buy_price,
          payout:      data.buy.payout,
          status:      'open',
          openTime:    Date.now(),
          description: data.buy.longcode,
        };
        this.openContracts[c.id] = c;
        if (this.onUpdate) this.onUpdate('buy', c);
        // Subscribe to contract updates
        this.send({ proposal_open_contract: 1, contract_id: c.id, subscribe: 1 }).catch(() => {});
      }
      if (data.error) {
        if (this.onUpdate) this.onUpdate('error', { msg: data.error.message });
      }
    }

    // Contract status update
    if (msg_type === 'proposal_open_contract') {
      const poc = data.proposal_open_contract;
      if (poc && this.openContracts[poc.contract_id]) {
        const c = this.openContracts[poc.contract_id];
        c.currentSpot = poc.current_spot;
        c.profit      = poc.profit;
        c.status      = poc.status;
        c.exitTick    = poc.exit_tick;
        if (poc.status === 'sold' || poc.is_expired || poc.is_settleable) {
          c.status = poc.profit >= 0 ? 'won' : 'lost';
          c.finalProfit = poc.profit;
          if (this.onUpdate) this.onUpdate('settled', c);
        } else {
          if (this.onUpdate) this.onUpdate('update', c);
        }
      }
    }

    // Price proposal
    if (msg_type === 'proposal') {
      if (req_id && this.pending[req_id]) {
        // already handled above
      }
    }
  }

  // ── Get price proposal before buying ─────────────────────────────────────
  async getProposal({ contractType, symbol, stake, duration, durationUnit, barrier }) {
    const payload = {
      proposal:       1,
      amount:         stake,
      basis:          'stake',
      contract_type:  CONTRACT_TYPES[contractType] || contractType,
      currency:       'USD',
      duration:       duration,
      duration_unit:  durationUnit,
      symbol:         SYMBOL_MAP[symbol] || symbol,
    };
    if (barrier !== undefined) payload.barrier = barrier;
    return this.send(payload);
  }

  // ── Buy a contract ────────────────────────────────────────────────────────
  async buy({ contractType, symbol, stake, duration, durationUnit, barrier }) {
    // Get proposal first to get price
    const proposal = await this.getProposal({ contractType, symbol, stake, duration, durationUnit, barrier });
    if (!proposal.proposal?.id) throw new Error('Could not get proposal');

    const res = await this.send({
      buy:   proposal.proposal.id,
      price: proposal.proposal.ask_price,
    });
    return res;
  }

  // ── Sell / close a contract early ─────────────────────────────────────────
  async sell(contractId, price = 0) {
    return this.send({ sell: contractId, price });
  }

  // ── Cancel a contract ────────────────────────────────────────────────────
  async cancel(contractId) {
    return this.send({ cancel: contractId });
  }

  // ── Get account statement ─────────────────────────────────────────────────
  async getStatement(limit = 50) {
    return this.send({ statement: 1, description: 1, limit });
  }

  // ── Get open contracts ────────────────────────────────────────────────────
  async getOpenContracts() {
    return this.send({ portfolio: 1 });
  }

  getOpenContractsList() {
    return Object.values(this.openContracts).filter(c => c.status === 'open');
  }
}

export default new TradeEngine();
