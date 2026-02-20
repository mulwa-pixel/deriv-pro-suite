import { useState, useEffect, useRef, useCallback } from 'react';
import { getLastDigit } from './indicators';

const MAX_BUF = 500;
const SYMS = ['R_75','R_100','R_25','R_50','R_10','1HZ100V'];

export function useDerivWS(appId, token) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [prices, setPrices] = useState({});  // sym -> Float32Array-ish array
  const [digits, setDigits] = useState([]);
  const [lastTick, setLastTick] = useState({});
  const [balance, setBalance] = useState(null);
  const bufs = useRef({});
  const digBuf = useRef([]);

  const connect = useCallback(() => {
    if (!appId) return;
    const url = `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (token) ws.send(JSON.stringify({authorize: token}));
      SYMS.forEach(s => {
        ws.send(JSON.stringify({ticks: s, subscribe: 1}));
        ws.send(JSON.stringify({ticks_history: s, adjust_start_time:1, count:300, end:'latest', start:1, style:'ticks'}));
      });
      ws.send(JSON.stringify({balance:1, subscribe:1}));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.msg_type === 'authorize') {}
        if (d.msg_type === 'balance') {
          setBalance({amount: d.balance?.balance, currency: d.balance?.currency});
        }
        if (d.msg_type === 'history') {
          const sym = d.echo_req?.ticks_history;
          if (sym && d.history?.prices) {
            bufs.current[sym] = d.history.prices.map(parseFloat);
            setPrices(p => ({...p, [sym]: [...bufs.current[sym]]}));
          }
        }
        if (d.msg_type === 'tick') {
          const {symbol: sym, quote} = d.tick;
          const price = parseFloat(quote);
          if (!bufs.current[sym]) bufs.current[sym] = [];
          bufs.current[sym].push(price);
          if (bufs.current[sym].length > MAX_BUF) bufs.current[sym].shift();
          setPrices(p => ({...p, [sym]: [...bufs.current[sym]]}));
          setLastTick(t => ({...t, [sym]: price}));
          if (sym === 'R_75') {
            const dig = getLastDigit(price);
            digBuf.current.push(dig);
            if (digBuf.current.length > 100) digBuf.current.shift();
            setDigits([...digBuf.current]);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => connect(), 5000);
    };
    ws.onerror = () => { setConnected(false); };
  }, [appId, token]);

  const disconnect = useCallback(() => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (appId) connect();
    return () => { if (wsRef.current) try { wsRef.current.close(); } catch {} };
  }, [appId, token]);

  return { connected, prices, digits, lastTick, balance, connect, disconnect };
}