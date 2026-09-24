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
  // v4.6.0: table rows without a DOM (regex fallback) — keeps parsing alive even where
  // DOMParser is missing, and lets the same code be unit-tested outside the browser.
  function htmlRows(text) {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return [...doc.querySelectorAll('tr')].map(tr =>
        [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
    }
    const rows = [];
    const trs = text.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trs) {
      const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(c =>
        c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
      if (cells.length) rows.push(cells);
    }
    return rows;
  }

  function parseHTML(text) {
    const rows = htmlRows(text);
    if (!rows.length) return [];
    const drafts = [];
    let map = null; // current header index map
    for (const cells of rows) {
      if (!cells.length) continue;
      const low = cells.map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());
      // v4.6.0 ALIAS HEADER MAP: brokers disagree on words. MT5 says "Symbol/Volume",
      // MT4 & Weltrade say "Item/Size", Deriv says "Contract". Accept them all — a missed
      // alias used to silently map lots←ticket and entry←"2026.09". Never trust exact words.
      const has = re => low.findIndex(h => re.test(h));
      const isHeader = has(/^(symbol|item|instrument|contract|asset)$/) >= 0
        && (has(/^(profit|pnl|pl)$/) >= 0 || has(/^(volume|size|lots|amount)$/) >= 0);
      if (isHeader) {
        map = {};
        const times = [], prices = [];
        low.forEach((h, i) => {
          if (/^(open time|close time|time|opened|closed|date)$/.test(h)) times.push(i);
          if (/^(price|open price|close price|entry|exit)$/.test(h)) prices.push(i);
        });
        // positional times/prices: open comes first, close second (MT5 prints two of each)
        map.pair = has(/^(symbol|item|instrument|contract|asset)$/);
        map.dir  = has(/^(type|direction|side|action)$/);
        map.lots = has(/^(volume|size|lots|amount|units)$/);
        map.sl   = has(/^s ?\/ ?l$|^(stop loss|sl)$/);
        map.tp   = has(/^t ?\/ ?p$|^(take profit|tp)$/);
        map.pnl  = has(/^(profit|pnl|pl|net profit)$/);
        map.date = times[0]; map.closedAt = times[1];
        map.entry = prices[0]; map.exit = prices[1];
        continue;
      }
      // MT5/MT4 data row (has mapped header)
      if (map && map.dir >= 0 && cells.length >= 6 && /buy|sell|long|short/i.test(cells[map.dir] || '')) {
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
      // v4.6.0: the old pattern swallowed "Volatility 75 buy 1" as the SYMBOL and then read
      // lots=75. Now: name + its own index number only ("Volatility 75"), and every number is
      // read AFTER the symbol so the symbol's digits can't poison the price list.
      const symMatch = l.match(/((?:Volatility|Boom|Crash|Step|Jump|Range|DEX|Multi|Drift|Hybrid)\s*\d{0,4}|[A-Z]{3}\/[A-Z]{3}|XAUUSD|XAGUSD|US30|NAS100|US500|GER40)/i);
      if (!symMatch) return;
      // numbers strictly after the symbol + direction words
      const tail = l.slice(Math.max(symMatch.index + symMatch[0].length, (l.search(/\b(buy|sell|long|short)\b/i) || 0)));
      // an explicit "profit/PnL 8.50" is the P&L — pull it out so it isn't mistaken for a price
      let pnl = null;
      const pnlM = tail.match(/(?:profit|pnl|p\/?l)\s*[:=]?\s*(-?\d[\d.,]*)/i);
      if (pnlM) pnl = parseFloat(pnlM[1].replace(/,/g, '.').replace(/\.(?=\d{3}\b)/g, ''));
      const nums = (tail.replace(pnlM ? pnlM[0] : '', ' ').match(/-?\d[\d.,]*/g) || [])
        .map(s => parseFloat(s.replace(/,/g, '.'))).filter(Number.isFinite);
      if (nums.length < 2) return;
      const prices = nums.filter(n => Math.abs(n) > 5); // lot sizes are small; prices aren't
      const lotsGuess = nums.find(n => n > 0 && n < 100 && !prices.includes(n));
      const d = normalize({
        pair: symMatch[1], dir,
        lots: lotsGuess ?? (nums.length >= 3 ? nums[0] : 1),
        entry: prices[0], exit: prices[1],
        pnl: pnl != null ? pnl : null,
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
    // v4.6.0: only trust the CSV lane if the text is genuinely delimited. Otherwise a pasted
    // line like "Volatility 75 buy 1.0 6350.20 -> 6358.70" got shredded into lots=75, entry=1.
    const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 50);
    const delimited = lines.filter(l => /[,;\t]/.test(l)).length >= Math.max(1, Math.ceil(lines.length * 0.6));
    if (delimited) {
      const csv = parseCSV(text);
      if (csv.length) return csv;
    }
    const loose = parseLoose(text);
    if (loose.length) return loose;
    return delimited ? [] : (parseCSV(text) || []);
  }

  const _root = typeof window !== 'undefined' ? window : {};
  _root.MJParse = { auto, parseCSV, parseHTML, parseLoose, normalize, isoFromLoose };
  if (typeof module !== 'undefined') module.exports = _root.MJParse; // node testing
})();
