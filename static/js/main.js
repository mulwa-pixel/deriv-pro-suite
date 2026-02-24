// Global state
let appState = {
    connected: false,
    balance: 0,
    markets: {},
    scanner: {},
    trades: []
};

// WebSocket connection for real-time updates
let socket = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    fetchInitialData();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    setInterval(refreshData, 5000);
});

function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('WebSocket connected');
        appState.connected = true;
        updateConnectionStatus();
    };
    
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    socket.onclose = () => {
        console.log('WebSocket disconnected');
        appState.connected = false;
        updateConnectionStatus();
        // Attempt to reconnect after 5 seconds
        setTimeout(initializeWebSocket, 5000);
    };
}

function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'scanner_update':
            updateScannerTable(data.scanner);
            break;
        case 'market_update':
            updateMarketCards(data.markets);
            break;
        case 'signal_update':
            updateSignals(data.signals);
            break;
        case 'trade_result':
            handleTradeResult(data.trade);
            break;
    }
}

function fetchInitialData() {
    fetch('/api/initial-data')
        .then(response => response.json())
        .then(data => {
            appState.balance = data.balance;
            updateBalance();
            updateMarketCards(data.markets);
            updateScannerTable(data.scanner);
            updateSignals(data.signals);
        })
        .catch(error => console.error('Error fetching initial data:', error));
}

function refreshData() {
    if (!appState.connected) return;
    
    fetch('/api/refresh')
        .then(response => response.json())
        .then(data => {
            if (data.balance) {
                appState.balance = data.balance;
                updateBalance();
            }
        })
        .catch(error => console.error('Error refreshing data:', error));
}

function refreshScanner() {
    const refreshBtn = document.querySelector('.btn-refresh');
    refreshBtn.classList.add('loading');
    
    fetch('/api/scanner')
        .then(response => response.json())
        .then(data => {
            updateScannerTable(data);
            refreshBtn.classList.remove('loading');
        })
        .catch(error => {
            console.error('Error refreshing scanner:', error);
            refreshBtn.classList.remove('loading');
        });
}

function updateConnectionStatus() {
    const indicator = document.querySelector('.status-indicator');
    const statusText = indicator.nextElementSibling;
    
    if (appState.connected) {
        indicator.className = 'status-indicator live';
        statusText.textContent = 'Live';
    } else {
        indicator.className = 'status-indicator';
        statusText.textContent = 'Disconnected';
    }
}

function updateBalance() {
    const balanceElement = document.querySelector('.balance');
    if (balanceElement) {
        balanceElement.textContent = `$${appState.balance.toFixed(2)}`;
    }
}

function updateDateTime() {
    const timeElement = document.querySelector('.current-time');
    if (timeElement) {
        const now = new Date();
        const utcString = now.toUTCString();
        timeElement.textContent = utcString;
    }
}

function updateMarketCards(markets) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    
    let html = '';
    for (const [symbol, data] of Object.entries(markets)) {
        const changeClass = data.change >= 0 ? 'positive' : 'negative';
        const changeSymbol = data.change >= 0 ? '▲' : '▼';
        
        html += `
            <div class="market-card">
                <h3>${symbol}</h3>
                <div class="market-price">$${data.price.toFixed(4)}</div>
                <div class="market-change ${changeClass}">
                    ${changeSymbol} ${Math.abs(data.change).toFixed(2)}%
                </div>
                <div class="market-rsi">RSI(14): ${data.rsi_14.toFixed(1)}</div>
            </div>
        `;
    }
    
    grid.innerHTML = html;
}

function updateScannerTable(scannerData) {
    const tableBody = document.querySelector('#scanner-table tbody');
    if (!tableBody) return;
    
    let html = '';
    const bots = [
        { id: 1, name: 'Bot #1 - Even/Odd' },
        { id: 2, name: 'Bot #2 - Over/Under' },
        { id: 3, name: 'Bot #3 - Berlin X9' },
        { id: 4, name: 'Bot #4 - BeastO7' },
        { id: 5, name: 'Bot #5 - Gas Hunter' },
        { id: 6, name: 'Bot #6 - Hawk Under5' },
        { id: 7, name: 'Bot #7 - Even Streak' }
    ];
    
    for (const bot of bots) {
        const scores = scannerData[bot.id] || {};
        
        html += `<tr>
            <td><strong>${bot.name}</strong></td>
            <td>${getScoreBadge(scores.V75)}</td>
            <td>${getScoreBadge(scores.V100)}</td>
            <td>${getScoreBadge(scores.V50)}</td>
            <td>${getScoreBadge(scores.V25)}</td>
            <td>${getScoreBadge(scores.V10)}</td>
            <td>
                <button class="btn-trade-now" 
                        onclick="quickTrade(${bot.id})"
                        ${canTrade(scores) ? '' : 'disabled'}>
                    Trade Now
                </button>
            </td>
        </tr>`;
    }
    
    tableBody.innerHTML = html;
}

function getScoreBadge(score) {
    if (!score) return '<span class="score-badge score-poor">-</span>';
    
    let scoreClass = 'score-poor';
    if (score >= 80) scoreClass = 'score-excellent';
    else if (score >= 65) scoreClass = 'score-good';
    else if (score >= 50) scoreClass = 'score-fair';
    
    return `<span class="score-badge ${scoreClass}">${score}</span>`;
}

function canTrade(scores) {
    if (!scores) return false;
    return Object.values(scores).some(score => score >= 65);
}

function updateSignals(signals) {
    const signalsGrid = document.getElementById('signals-grid');
    if (!signalsGrid) return;
    
    let html = '';
    
    for (const signal of signals) {
        const signalClass = signal.direction === 'RISE' ? 'rise' : 'fall';
        
        html += `
            <div class="signal-card ${signalClass}">
                <div class="signal-header">
                    <h4>${signal.bot}</h4>
                    <span class="signal-score">Score: ${signal.score}</span>
                </div>
                <div class="signal-body">
                    <div class="signal-direction">${signal.direction}</div>
                    <div class="signal-market">${signal.market}</div>
                    <div class="signal-reason">${signal.reason}</div>
                </div>
                <button class="btn-trade-now" onclick="executeSignal('${signal.id}')">
                    Execute
                </button>
            </div>
        `;
    }
    
    if (signals.length === 0) {
        html = '<div class="no-signals">No active signals at this time</div>';
    }
    
    signalsGrid.innerHTML = html;
}

function quickTrade(botId) {
    document.getElementById('trade-bot').value = botId;
    document.getElementById('quick-trade').scrollIntoView({ behavior: 'smooth' });
}

function executeTrade() {
    const botId = document.getElementById('trade-bot').value;
    const market = document.getElementById('trade-market').value;
    const stake = parseFloat(document.getElementById('trade-stake').value);
    
    if (!stake || stake <= 0) {
        showTradeInfo('Please enter a valid stake amount', 'error');
        return;
    }
    
    if (stake > appState.balance * 0.02) {
        showTradeInfo(`Stake exceeds maximum 2% of balance ($${(appState.balance * 0.02).toFixed(2)})`, 'warning');
        return;
    }
    
    const tradeBtn = document.querySelector('.btn-trade');
    tradeBtn.disabled = true;
    tradeBtn.textContent = 'Executing...';
    
    fetch('/api/execute-trade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            bot_id: parseInt(botId),
            market: market,
            stake: stake
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showTradeInfo(`Trade executed successfully! Contract ID: ${data.contract_id}`, 'success');
            appState.balance = data.new_balance;
            updateBalance();
        } else {
            showTradeInfo(`Trade failed: ${data.reason}`, 'error');
        }
    })
    .catch(error => {
        showTradeInfo(`Error executing trade: ${error.message}`, 'error');
    })
    .finally(() => {
        tradeBtn.disabled = false;
        tradeBtn.textContent = 'Execute Trade';
    });
}

function executeSignal(signalId) {
    fetch('/api/execute-signal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ signal_id: signalId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showTradeInfo(`Signal trade executed!`, 'success');
            appState.balance = data.new_balance;
            updateBalance();
        }
    });
}

function showTradeInfo(message, type) {
    const infoElement = document.getElementById('trade-info');
    infoElement.textContent = message;
    infoElement.className = `trade-info show ${type}`;
    
    setTimeout(() => {
        infoElement.classList.remove('show');
    }, 5000);
}

function handleTradeResult(trade) {
    if (trade.result === 'win') {
        showTradeInfo(`Trade won! Profit: $${trade.profit.toFixed(2)}`, 'success');
    } else {
        showTradeInfo(`Trade lost. Loss: $${trade.loss.toFixed(2)}`, 'error');
    }
    
    appState.balance = trade.new_balance;
    updateBalance();
                              }
