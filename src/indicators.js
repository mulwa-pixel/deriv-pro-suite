export function calcRSI(prices, period=14) {
  if (!prices || prices.length < period+1) return null;
  const s = prices.slice(-(period+1));
  let g=0, l=0;
  for (let i=1;i<s.length;i++) { const d=s[i]-s[i-1]; if(d>=0) g+=d; else l-=d; }
  const ag=g/period, al=l/period;
  if (al===0) return 100;
  return 100-(100/(1+ag/al));
}

export function calcEMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const k=2/(period+1);
  let e=prices.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for (let i=period;i<prices.length;i++) e=prices[i]*k+e*(1-k);
  return e;
}

export function calcBB(prices, period=20, mult=2) {
  if (!prices || prices.length < period) return null;
  const s=prices.slice(-period);
  const m=s.reduce((a,b)=>a+b,0)/period;
  const std=Math.sqrt(s.reduce((a,b)=>a+(b-m)**2,0)/period);
  return { upper:m+mult*std, lower:m-mult*std, mid:m, std, width:std*mult*2 };
}

export function getLastDigit(price) {
  return Math.abs(Math.round(price*10))%10;
}

export function calcStreaks(digits) {
  let even=0, odd=0;
  for (let i=digits.length-1;i>=0;i--) { if(digits[i]%2===0) even++; else break; }
  for (let i=digits.length-1;i>=0;i--) { if(digits[i]%2!==0) odd++; else break; }
  return {even, odd};
}

export function calcDigitDom(digits, n=50) {
  const s=digits.slice(-n);
  if (!s.length) return {high:50,low:50,dom:50,highLeads:true};
  const hi=s.filter(d=>d>=5).length;
  const hp=Math.round((hi/s.length)*100);
  return {high:hp, low:100-hp, dom:Math.max(hp,100-hp), highLeads:hp>=(100-hp)};
}

export function calcConfluence(prices, digits, utcHour) {
  if (!prices || prices.length < 20) return null;
  const r14=calcRSI(prices,14), r4=calcRSI(prices,4);
  const e5=calcEMA(prices,5), e10=calcEMA(prices,10), e20=calcEMA(prices,20);
  const bb=calcBB(prices,Math.min(20,prices.length));
  const last=prices[prices.length-1]||0;
  const mom=prices.length>=6 ? last-prices[prices.length-6] : 0;
  const {dom,highLeads}=calcDigitDom(digits);
  const {even:esc,odd:osc}=calcStreaks(digits);
  const inHours=utcHour>=8&&utcHour<20;
  const dead=r14!==null&&r14>=40&&r14<=60;

  const factors=[
    {key:'r14', label:'RSI(14)', value:r14?.toFixed(1)??'--', ok:r14!==null&&!dead, weight:15,
     desc:!r14?'No data':dead?'DEAD ZONE':r14>70?'Overbought':r14<30?'Oversold':'Clear'},
    {key:'r4',  label:'RSI(4)',  value:r4?.toFixed(1)??'--',  ok:r4!==null&&(r4<33||r4>67), weight:15,
     desc:!r4?'No data':r4<33?'RISE signal':r4>67?'FALL signal':'Neutral'},
    {key:'ema', label:'EMA',     value:e5&&e10?Math.abs(e5-e10).toFixed(4):'--',
     ok:!!e5&&!!e10&&Math.abs(e5-e10)>=0.02, weight:15,
     desc:!e5?'No data':e5>e10&&e10>e20?'Bull stack':e5<e10&&e10<e20?'Bear stack':'Mixed'},
    {key:'dig', label:'Digits',  value:dom+'%', ok:dom>=65, weight:15,
     desc:dom>=75?'Extreme':dom>=65?'Strong':dom>=60?'Moderate':'Weak'},
    {key:'mom', label:'Mom 5T',  value:(mom>=0?'+':'')+mom.toFixed(4), ok:Math.abs(mom)>=0.04, weight:10,
     desc:Math.abs(mom)>=0.04?'Strong':'Weak'},
    {key:'bb',  label:'BB',      value:bb?(last<bb.lower?'Below L':last>bb.upper?'Above U':'Inside'):'--',
     ok:!!bb&&(last<=bb.lower||bb.width<0.05), weight:10,
     desc:!bb?'No data':bb.width<0.05?'Squeeze':'Normal'},
    {key:'time',label:'Session', value:inHours?'Active':'Off', ok:inHours, weight:10,
     desc:inHours?'Prime hours':'Off-hours'},
    {key:'str', label:'Streak',  value:esc>=4?esc+'E':osc>=4?osc+'O':'None', ok:esc>=4||osc>=4, weight:10,
     desc:esc>=4?`${esc} even streak`:osc>=4?`${osc} odd streak`:'No streak'},
  ];

  const maxS=factors.reduce((a,f)=>a+f.weight,0);
  const score=Math.round((factors.reduce((a,f)=>a+(f.ok?f.weight:0),0)/maxS)*100);

  let direction='', bot='', contract='';
  if (r14!==null&&r14<35&&r4!==null&&r4<33) { direction='RISE'; bot='Bot#3 Berlin X9'; contract='Rise'; }
  else if (r14!==null&&r14>65&&r4!==null&&r4>67) { direction='FALL'; bot='Bot#3 Berlin X9'; contract='Fall'; }
  else if (esc>=4) { direction='BET ODD'; bot='Bot#1 Even/Odd'; contract='Odd'; }
  else if (osc>=4) { direction='BET EVEN'; bot='Bot#1 Even/Odd'; contract='Even'; }
  else if (dom>=65&&highLeads) { direction='OVER 5'; bot='Bot#5 Gas Hunter'; contract='Over 5'; }
  else if (dom>=65&&!highLeads) { direction='UNDER 5'; bot='Bot#6 Hawk U5'; contract='Under 5'; }
  else if (e5&&e10&&e5>e10&&e10>e20&&Math.abs(e5-e10)>=0.02) { direction='RISE'; bot='Bot#4 BeastO7'; contract='Rise'; }
  else if (e5&&e10&&e5<e10&&e10<e20&&Math.abs(e5-e10)>=0.02) { direction='FALL'; bot='Bot#4 BeastO7'; contract='Fall'; }

  // Regime
  let regime='RANGING', regimeColor='#ffd740';
  if (e5&&e10&&e20&&Math.abs(e5-e10)>0.03) {
    if (e5>e10&&e10>e20) { regime='BULLISH'; regimeColor='#00e676'; }
    else if (e5<e10&&e10<e20) { regime='BEARISH'; regimeColor='#ff1744'; }
  }

  return { factors, score, direction, bot, contract, r14, r4, e5, e10, e20, bb, mom, esc, osc, regime, regimeColor };
}