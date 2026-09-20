// Mo's Journal — zero-dependency Node server (v3)
// Serves the app + JSON API so your journal syncs across all your devices.
// v3: screenshot uploads + optional GitHub Gist cloud backup (set GIST_TOKEN).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(ROOT, 'uploads');
const DATA_FILE = path.join(ROOT, 'data.json');
const GIST_FILE = 'mos-journal-data.json';
const GIST_TOKEN = process.env.GIST_TOKEN || '';

try { fs.mkdirSync(UPLOADS, { recursive: true }); } catch (e) { /* exists */ }

/* ---------------- AI AUTO-FILL config ----------------
   Bring-your-own-key vision parsing. Any OpenAI-compatible endpoint works.
   Resolution order: env vars → in-app Settings (never echoed back to client). */
function aiCfg() {
  const s = (state.settings && state.settings.ai) || {};
  return {
    base: (process.env.AI_BASE_URL || s.base || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL || s.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    key: process.env.AI_KEY || s.key || '',
  };
}
const maskAI = ai => ({
  base: ai?.base || 'https://openrouter.ai/api/v1',
  model: ai?.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
  key: '',
  configured: !!(process.env.AI_KEY || ai?.key),
});
const AI_EXTRACT_PROMPT = `You are the extraction engine of a trading journal. Read the broker screenshot(s)/history and return ONLY a JSON object (no markdown, no prose):
{"trades":[{"pair":"Volatility 75","dir":"long","lots":1,"entry":6350.2,"exit":6358.7,"sl":6345.2,"tp":6360.2,"openTime":"2026-09-19 09:14","closeTime":"2026-09-19 15:40","pnl":8.5,"setup":"Break & retest","broker":"Weltrade"}]}
Rules: dir must be "long" (buy) or "short" (sell). Use 24h times, numbers without currency symbols, null for anything not visible. If the image shows a history/statement, extract EVERY trade row. If the image is a chart with an open/closed position, extract what's shown (prices, symbol, size). "setup" = strategy name only if annotated on the chart, else null. Return {"trades":[]} if nothing trade-like is visible.`;



/* ---------------- state + migration ---------------- */
function migrate(s) {
  if (!Array.isArray(s.trades)) s.trades = [];
  if (!s.settings || typeof s.settings !== 'object') s.settings = {};
  if (!Array.isArray(s.profiles)) {
    s.profiles = [{
      id: 'acc-main', name: 'Main Account', emoji: '💼', type: 'Live',
      broker: 'Weltrade', balance: s.settings.startingBalance ?? 1000, createdAt: Date.now(),
    }];
    s.trades.forEach(t => { if (!t.profileId) t.profileId = 'acc-main'; });
  }
  const ids = new Set(s.profiles.map(p => p.id));
  if (s.profiles.length) s.trades.forEach(t => { if (!ids.has(t.profileId)) t.profileId = s.profiles[0].id; });
  return s;
}

function loadState() {
  try { return migrate(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
  catch (e) { return migrate({ trades: [], settings: {} }); }
}

let state = loadState();

/* ---------------- persistence: local disk + optional Gist ---------------- */
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) { console.error('save failed', e); }
  }, 150);
  scheduleGistSave();
}

const gist = { enabled: false, id: null };
async function gh(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + GIST_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'mos-journal',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error('github ' + r.status);
  return r.json();
}
async function gistBoot() {
  if (!GIST_TOKEN) return;
  try {
    const list = await gh('https://api.github.com/gists?per_page=100');
    const found = list.find(g => g.files && g.files[GIST_FILE]);
    if (found) {
      gist.id = found.id;
      const full = await gh('https://api.github.com/gists/' + found.id);
      const content = full.files[GIST_FILE] && full.files[GIST_FILE].content;
      if (content && content.length > 10) state = migrate(JSON.parse(content));
      console.log('☁️  Gist sync: ON (existing backup found)');
    } else {
      console.log('☁️  Gist sync: ON (backup gist will be created on first save)');
    }
    gist.enabled = true;
  } catch (e) {
    console.log('⚠️  Gist sync unavailable:', e.message, '— running on local disk only.');
  }
}
let gistTimer = null;
function scheduleGistSave() {
  if (!GIST_TOKEN) return;
  clearTimeout(gistTimer);
  gistTimer = setTimeout(async () => {
    try {
      const content = JSON.stringify(state);
      if (gist.id) {
        await gh('https://api.github.com/gists/' + gist.id, {
          method: 'PATCH',
          body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
        });
      } else {
        const g = await gh('https://api.github.com/gists', {
          method: 'POST',
          body: JSON.stringify({
            description: "Mo's Journal — data backup (auto-managed, do not delete)",
            public: false,
            files: { [GIST_FILE]: { content } },
          }),
        });
        gist.id = g.id;
        console.log('☁️  Backup gist created:', g.html_url);
      }
    } catch (e) { console.log('gist save failed:', e.message); }
  }, 8000);
}

/* ---------------- helpers ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && body !== null && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 14e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function deleteTradeFiles(trade) {
  (trade.screenshots || []).forEach(s => {
    const name = path.basename(s.url || '');
    if (name) fs.unlink(path.join(UPLOADS, name), () => {});
  });
}

/* ---------------- server ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/api/state' && req.method === 'GET') {
      // never hand the client the AI key, just whether one exists
      const pub = { ...state, settings: { ...state.settings, ai: maskAI(state.settings.ai) } };
      return send(res, 200, pub);
    }
    if (p === '/api/meta' && req.method === 'GET') {
      return send(res, 200, { version: 4, gistSync: gist.enabled, aiConfigured: !!aiCfg().key });
    }

    if (p === '/api/trade' && req.method === 'POST') {
      const t = await readBody(req);
      t.id = crypto.randomUUID();
      t.createdAt = Date.now();
      if (!state.profiles.some(pr => pr.id === t.profileId)) t.profileId = state.profiles[0]?.id;
      state.trades.push(t);
      scheduleSave();
      return send(res, 200, { ok: true, trade: t });
    }

    const mTrade = p.match(/^\/api\/trade\/([\w-]+)$/);
    if (mTrade) {
      const id = mTrade[1];
      const i = state.trades.findIndex(t => t.id === id);
      if (i === -1) return send(res, 404, { ok: false, error: 'trade not found' });
      if (req.method === 'POST' || req.method === 'PUT') {
        const upd = await readBody(req);
        state.trades[i] = { ...state.trades[i], ...upd, id };
        scheduleSave();
        return send(res, 200, { ok: true, trade: state.trades[i] });
      }
      if (req.method === 'DELETE') {
        deleteTradeFiles(state.trades[i]);
        state.trades.splice(i, 1);
        scheduleSave();
        return send(res, 200, { ok: true });
      }
    }

    if (p === '/api/profile' && req.method === 'POST') {
      const prof = await readBody(req);
      prof.id = crypto.randomUUID();
      prof.createdAt = Date.now();
      state.profiles.push(prof);
      scheduleSave();
      return send(res, 200, { ok: true, profile: prof });
    }

    const mProf = p.match(/^\/api\/profile\/([\w-]+)$/);
    if (mProf) {
      const id = mProf[1];
      const i = state.profiles.findIndex(pr => pr.id === id);
      if (i === -1) return send(res, 404, { ok: false, error: 'profile not found' });
      if (req.method === 'POST' || req.method === 'PUT') {
        const upd = await readBody(req);
        state.profiles[i] = { ...state.profiles[i], ...upd, id };
        scheduleSave();
        return send(res, 200, { ok: true, profile: state.profiles[i] });
      }
      if (req.method === 'DELETE') {
        if (state.profiles.length <= 1) return send(res, 400, { ok: false, error: 'cannot delete last account' });
        let moveTo = null;
        try { moveTo = (await readBody(req)).moveTo; } catch (e) { /* no body */ }
        if (!state.profiles.some(pr => pr.id === moveTo)) moveTo = state.profiles.find(pr => pr.id !== id).id;
        state.trades.forEach(t => { if (t.profileId === id) t.profileId = moveTo; });
        state.profiles.splice(i, 1);
        scheduleSave();
        return send(res, 200, { ok: true, movedTo: moveTo });
      }
    }

    if (p === '/api/settings' && req.method === 'POST') {
      const s = await readBody(req);
      // AI key: empty/unchanged keeps the old one — never overwrite with blank or a mask
      if (s.ai) {
        const keep = state.settings.ai || {};
        s.ai = { ...keep, ...s.ai };
        if (!s.ai.key || s.ai.key.includes('•')) s.ai.key = keep.key || '';
      }
      state.settings = { ...state.settings, ...s };
      scheduleSave();
      return send(res, 200, { ok: true, settings: { ...state.settings, ai: maskAI(state.settings.ai) } });
    }

    // ---- AI AUTO-FILL ----
    if (p === '/api/ai-test' && req.method === 'GET') {
      const cfg = aiCfg();
      if (!cfg.key) return send(res, 400, { ok: false, error: 'NO_KEY', message: 'No AI key configured yet.' });
      try {
        const r = await fetch(cfg.base + '/models', {
          headers: { 'Authorization': 'Bearer ' + cfg.key },
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) return send(res, 400, { ok: false, error: 'AI_FAIL', message: `Provider rejected the key (${r.status}).` });
        return send(res, 200, { ok: true, message: `Connected ✓ using ${cfg.model}` });
      } catch (e) { return send(res, 400, { ok: false, error: 'AI_FAIL', message: 'Could not reach provider: ' + e.message }); }
    }

    if (p === '/api/ai-parse' && req.method === 'POST') {
      const cfg = aiCfg();
      if (!cfg.key) return send(res, 400, { ok: false, error: 'NO_KEY', message: 'Add a free AI key first — Settings → 🪄 AI AUTO-FILL.' });
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: 'BAD_BODY' }); }
      const content = [{ type: 'text', text: AI_EXTRACT_PROMPT + (body.hint ? '\nContext from the trader: ' + String(body.hint).slice(0, 500) : '') }];
      (body.images || []).slice(0, 8).forEach(im => {
        const b64 = String(im.data || '').replace(/^data:image\/\w+;base64,/, '');
        if (b64.length > 100) content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } });
      });
      if (body.text) content[0].text += '\n\nPasted history/text to extract from:\n' + String(body.text).slice(0, 12000);
      try {
        const r = await fetch(cfg.base + '/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json',
            'HTTP-Referer': 'https://mos-journal.app', 'X-Title': "Mo's Journal",
          },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content }], temperature: 0.1, max_tokens: 3000 }),
          signal: AbortSignal.timeout(90000),
        });
        if (!r.ok) {
          const t = await r.text();
          return send(res, 400, { ok: false, error: 'AI_FAIL', message: `AI error ${r.status}: ${t.slice(0, 250)}` });
        }
        const j = await r.json();
        const raw = j.choices?.[0]?.message?.content || '';
        const m = raw.match(/\{[\s\S]*\}/);
        let parsed;
        try { parsed = m ? JSON.parse(m[0]) : { trades: [] }; }
        catch (e) { return send(res, 400, { ok: false, error: 'AI_FAIL', message: 'AI returned unreadable JSON — try again or a cleaner screenshot.' }); }
        return send(res, 200, { ok: true, trades: Array.isArray(parsed.trades) ? parsed.trades : [] });
      } catch (e) {
        return send(res, 400, { ok: false, error: 'AI_FAIL', message: e.name === 'TimeoutError' ? 'AI took too long — try fewer/smaller images.' : e.message });
      }
    }

    if (p === '/api/upload' && req.method === 'POST') {
      const body = await readBody(req);
      const b64 = String(body.data || '').replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      if (!buf.length) return send(res, 400, { ok: false, error: 'empty image' });
      if (buf.length > 9e6) return send(res, 413, { ok: false, error: 'image too large' });
      const ext = (body.ext || '.jpg').replace(/[^\w.]/g, '').slice(0, 6) || '.jpg';
      const name = crypto.randomUUID() + ext;
      fs.writeFileSync(path.join(UPLOADS, name), buf);
      return send(res, 200, { ok: true, url: '/uploads/' + name });
    }

    if (p === '/api/import' && req.method === 'POST') {
      const body = await readBody(req);
      if (Array.isArray(body.trades)) state.trades = body.trades;
      if (Array.isArray(body.profiles)) state.profiles = body.profiles;
      if (body.settings && typeof body.settings === 'object') state.settings = body.settings;
      migrate(state);
      scheduleSave();
      return send(res, 200, { ok: true, trades: state.trades.length });
    }

    // uploaded screenshots
    if (p.startsWith('/uploads/')) {
      const name = path.basename(decodeURIComponent(p));
      const abs = path.join(UPLOADS, name);
      return fs.readFile(abs, (err, data) => {
        if (err) return send(res, 404, 'not found');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(name).toLowerCase()] || 'image/jpeg', 'Cache-Control': 'max-age=86400' });
        res.end(data);
      });
    }

    // static app — ETag + explicit no-cache so browsers/proxies revalidate every load,
    // and index.html is no-store so the app shell is never served stale
    let fp = p === '/' ? '/index.html' : decodeURIComponent(p);
    fp = path.normalize(fp).replace(/^(\.\.[/\\])+/, '');
    const abs = path.join(PUBLIC, fp);
    if (!abs.startsWith(PUBLIC)) return send(res, 403, 'nope');
    fs.stat(abs, (err, st) => {
      if (err) return send(res, 404, 'not found');
      const etag = 'W/"' + st.mtimeMs.toString(36) + '-' + st.size.toString(36) + '"';
      if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
      fs.readFile(abs, (err2, data) => {
        if (err2) return send(res, 404, 'not found');
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': abs.endsWith('index.html') ? 'no-store' : 'no-cache, must-revalidate',
          'ETag': etag,
        });
        res.end(data);
      });
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, error: 'server error' });
  }
});

(async () => {
  await gistBoot();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`📒 Mo's Journal v4 · SMART edition running on http://0.0.0.0:${PORT}${GIST_TOKEN ? ' · gist sync enabled' : ''}`);
  });
})();
