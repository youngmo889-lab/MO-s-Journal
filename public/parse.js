/* =====================================================================
   MJParse — AUTO-FILL extraction engine (pure functions, no UI)
   Feeds: generic CSV · MT5 HTML report · MT4 statement HTML · loose text
   Returns normalized draft trades the app reviews & saves.
===================================================================== */
'use strict';

(function () {
  const numv = v => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/[,$\s]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  /* -------- loose datetime → ISO (treated as local time) -------- */
  function isoFromLoose(s) {
    if (s == null || s === '') return '';
    s = String(s).trim();
    if (/^\d{13}$/.test(s)) return new Date(+s).toISOString();
    s = s.replace(/\./g, '-').replace(/\//g, '-').replace('T', ' ');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).toISOString();
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 9, 0).toISOString();
    return '';
  }

  /* -------- normalize one raw extracted object → draft -------- */
  function normalize(d) {
    if (!d) return null;
    const pick = (...ks) => { for (const k of ks) if (d[k] != null && d[k] !== '') return d[k]; return null; };
    const dirRaw = String(pick('dir', 'type', 'side') || '').toLowerCase();
    const pair = String(pick('pair', 'symbol', 'instrument', 'item') || '').trim()
      .replace(/[^\w ()/.-]/g, '').replace(/\s{2,}/g, ' ');
    if (!pair) return null;
    const out = {
      pair,
      dir: /sell|short|^s$/.test(dirRaw) ? 'short' : 'long',
      lots: numv(pick('lots', 'volume', 'size', 'qty', 'stake')),
      entry: numv(pick('entry', 'openPrice', 'open', 'open_price')),
      exit: numv(pick('exit', 'closePrice', 'close', 'close_price')),
      sl: numv(pick('sl', 'stop', 's/l', 'stoploss')),
      tp: numv(pick('tp', 'target', 't/p', 'takeprofit')),
      pnl: numv(pick('pnl', 'profit', 'p/l', 'pl', 'net', 'result')),
      date: isoFromLoose(pick('date', 'openTime', 'time', 'opened', 'open_date')),
      closedAt: isoFromLoose(pick('closedAt', 'closeTime', 'closed', 'close_date')),
      setup: String(pick('setup', 'strategy') || '').trim(),
    };
    if (!out.date) out.date = new Date().toISOString();
    if (out.entry == null && out.exit == null && out.pnl == null) return null; // not a trade
    if (out.lots == null) out.lots = 1;
    return out;
  }

  const HEADER_ALIASES = {
    pair: ['symbol', 'pair', 'instrument', 'item', 'market', 'underlying'],
    dir: ['type', 'side', 'direction', 'dir', 'action'],
    lots: ['lots', 'lot', 'volume', 'size', 'qty', 'stake'],
    entry: ['open price', 'open', 'entry', 'entry price', 'openprice'],
    exit: ['close price', 'close', 'exit', 'exit price', 'closeprice'],
    sl: ['s/l', 's / l', 'sl', 'stop', 'stop loss', 'stoploss', 's.l'],
    tp: ['t/p', 't / p', 'tp', 'target', 'take profit', 'takeprofit', 't.p'],
    date: ['open time', 'time', 'date', 'opened', 'open date', 'entry time'],
    closedAt: ['close time', 'closed', 'close date', 'exit time', 'closed time'],
    pnl: ['profit', 'p/l', 'pl', 'pnl', 'p&l', 'net', 'result', 'amount', 'gain'],
  };

  function idxFor(headers, key, occurrence = 0) {
    let hits = 0;
    for (let i = 0; i < headers.length; i++) {
      if (HEADER_ALIASES[key].includes(headers[i])) {
        if (hits === occurrence) return i;
        hits++;
      }
    }
    return -1;
  }

  /* -------- generic CSV / TSV / semicolon -------- */
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const first = lines[0].toLowerCase();
    const delim = ['\t', ';', ','].reduce((a, d) => (first.split(d).length > first.split(a).length ? d : a), ',');
    const split = l => l.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const headers = split(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ' ').trim());
    const known = Object.keys(HEADER_ALIASES).filter(k => idxFor(headers, k) > -1);
    if (!known.includes('pair')) return [];
    // MT5-style duplicated Time/Price columns: 1st occurrence = open, 2nd = close
    const hasDupTime = headers.filter(h => h === 'time').length >= 2;
    const hasDupPrice = headers.filter(h => h === 'price').length >= 2;
    const col = {
      pair: idxFor(headers, 'pair'),
      dir: idxFor(headers, 'dir'),
      lots: idxFor(headers, 'lots'),
      entry: hasDupPrice ? idxFor(headers, 'entry', 0) === -1 ? idxFor(headers, 'pnl', 0) : idxFor(headers, 'entry') : idxFor(headers, 'entry'),
      date: hasDupTime ? idxFor(headers, 'date') : idxFor(headers, 'date'),
      closedAt: hasDupTime ? idxFor(headers, 'date', 1) : idxFor(headers, 'closedAt'),
      exit: hasDupPrice ? (() => { // 2nd 'price' header
        let hits = 0;
        for (let i = 0; i < headers.length; i++) if (headers[i] === 'price') { if (hits === 1) return i; hits++; }
        return idxFor(headers, 'exit');
      })() : idxFor(headers, 'exit'),
    };
    if (hasDupPrice && headers[col.entry] !== 'price' && idxFor(headers, 'entry') === -1) {
      col.entry = headers.indexOf('price'); // 1st price = open
    }
    const get = (cells, i) => i > -1 && cells[i] != null ? cells[i] : null;
    const drafts = [];
    for (let li = 1; li < lines.length; li++) {
      const cells = split(lines[li]);
      if (cells.length < 4) continue;
      const typeVal = String(get(cells, col.dir) || '').toLowerCase();
      if (col.dir > -1 && !/buy|sell|long|short/.test(typeVal)) continue; // balance/deposit rows etc.
      const d = normalize({
        pair: get(cells, col.pair), dir: typeVal || undefined,
        lots: get(cells, col.lots), entry: get(cells, col.entry), exit: get(cells, col.exit),
        sl: get(cells, idxFor(headers, 'sl')), tp: get(cells, idxFor(headers, 'tp')),
        date: get(cells, col.date), closedAt: get(cells, col.closedAt),
        pnl: get(cells, idxFor(headers, 'pnl')),
      });
      if (d) drafts.push(d);
    }
    return drafts;
  }

  /* -------- MT4 / MT5 HTML statements (browser only — needs DOMParser) -------- */
  function parseHTML(text) {
    if (typeof DOMParser === 'undefined') return [];
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const rows = [...doc.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
    const drafts = [];
    let map = null; // current header index map
    for (const cells of rows) {
      if (!cells.length) continue;
      const low = cells.map(c => c.toLowerCase());
      // header row? (MT5: Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price, ..., Profit)
      if (low.includes('symbol') && (low.includes('profit') || low.includes('volume'))) {
        map = {};
        const times = [], prices = [];
        low.forEach((h, i) => {
          if (h === 'time') times.push(i);
          if (h === 'price') prices.push(i);
          if (h === 'symbol') map.pair = i;
          if (h === 'type') map.dir = i;
          if (h === 'volume') map.lots = i;
          if (/^s ?\/ ?l/.test(h)) map.sl = i;
          if (/^t ?\/ ?p/.test(h)) map.tp = i;
          if (h === 'profit') map.pnl = i;
        });
        map.date = times[0]; map.closedAt = times[1];
        map.entry = prices[0]; map.exit = prices[1];
        continue;
      }
      // MT5 data row (has mapped header)
      if (map && cells.length >= 8 && /buy|sell/i.test(cells[map.dir] || '')) {
        const d = normalize({
          pair: cells[map.pair], dir: cells[map.dir], lots: cells[map.lots],
          entry: cells[map.entry], exit: cells[map.exit],
          sl: cells[map.sl], tp: cells[map.tp],
          date: cells[map.date], closedAt: cells[map.closedAt], pnl: cells[map.pnl],
        });
        if (d) drafts.push(d);
        continue;
      }
      // MT4 detailed statement row: [ticket, openTime, type, size, item, openPrice, sl, tp, closeTime, closePrice, comm..., profit]
      if (cells.length >= 13 && /buy|sell/i.test(cells[2] || '') && /\d{4}[./-]\d{2}[./-]\d{2}/.test(cells[1] || '')) {
        const d = normalize({
          pair: cells[4], dir: cells[2], lots: cells[3],
          entry: cells[5], sl: cells[6], tp: cells[7],
          date: cells[1], closedAt: cells[8], exit: cells[9],
          pnl: cells[cells.length - 1],
        });
        if (d) drafts.push(d);
      }
    }
    return drafts;
  }

  /* -------- loose pasted lines (fallback when no AI key) -------- */
  function parseLoose(text) {
    const drafts = [];
    text.split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (!l || l.length < 8) return;
      const dir = /(\bbuy\b|\blong\b)/i.test(l) ? 'long' : /(\bsell\b|\bshort\b)/i.test(l) ? 'short' : null;
      if (!dir) return;
      const symMatch = l.match(/((Volatility|Boom|Crash|Step|Jump|Range|DEX|Multi|Drift)[\w ()]*|[A-Z]{6}|[A-Z]{3}\/[A-Z]{3}|XAUUSD|US30|NAS100)/i);
      const nums = (l.replace(/[,]/g, '.').match(/\d+\.?\d*/g) || []).map(Number).filter(Number.isFinite);
      if (!symMatch || nums.length < 2) return;
      const d = normalize({
        pair: symMatch[1], dir, lots: nums.length >= 3 ? nums[0] : 1,
        entry: nums.length >= 3 ? nums[1] : nums[0], exit: nums[nums.length - 1],
      });
      if (d) drafts.push(d);
    });
    return drafts;
  }

  function auto(text, fileName = '') {
    if (!text || !text.trim()) return [];
    const looksHTML = /<\s*(table|tr|html|td)/i.test(text);
    if (looksHTML || /\.html?$/i.test(fileName)) {
      const r = parseHTML(text);
      if (r.length) return r;
    }
    const csv = parseCSV(text);
    if (csv.length) return csv;
    return parseLoose(text);
  }

  const _root = typeof window !== 'undefined' ? window : {};
  _root.MJParse = { auto, parseCSV, parseHTML, parseLoose, normalize, isoFromLoose };
  if (typeof module !== 'undefined') module.exports = _root.MJParse; // node testing
})();
