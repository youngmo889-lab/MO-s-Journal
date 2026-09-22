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
// Free vision lanes (OpenRouter, live-verified 2026-09-20) — ordered by extraction quality.
// If the configured model 429s/404s, the parser rotates down this chain automatically.
const FREE_VISION_FALLBACK = [
  'google/gemma-4-31b-it:free', 'qwen/qwen3.8-27b:free', 'nex-agi/nex-n2.5-pro:free',
  'inclusionai/ling-3.0-flash-vl:free', 'google/gemma-4-26b-a4b-it:free', 'nex-agi/nex-n2.5-mini:free',
];
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
/* ---- Pixel Vault (via the Gist you already own) ----
   Screenshots ride the same gist as img_<name> base64 files. Local disk is the
   fast cache; the gist is the immortal copy. No extra accounts, no extra tokens. */
const SHOT_EXT = /\.(jpe?g|png|webp|gif)$/i;
function ensureVaultMeta() {
  state.meta = state.meta || {};
  if (!Array.isArray(state.meta.vaultedShots)) state.meta.vaultedShots = [];
  return state.meta.vaultedShots;
}
function pendingShots() {
  const vaulted = new Set(ensureVaultMeta());
  try {
    return fs.readdirSync(UPLOADS)
      .filter(n => SHOT_EXT.test(n) && !vaulted.has(n))
      .map(n => ({ name: n, size: fs.statSync(path.join(UPLOADS, n)).size }))
      .filter(s => s.size > 0 && s.size < 3e6); // skip monsters
  } catch { return []; }
}
function decodeVaultShots(files) {
  const vaulted = new Set(ensureVaultMeta());
  let n = 0;
  for (const [fname, f] of Object.entries(files || {})) {
    if (!fname.startsWith('img_') || !f || !f.content || f.truncated) continue;
    const name = fname.slice(4);
    if (!SHOT_EXT.test(name)) continue;
    try {
      fs.mkdirSync(UPLOADS, { recursive: true });
      fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(String(f.content).replace(/\s+/g, ''), 'base64'));
      vaulted.add(name); n++;
    } catch (e) { console.error('vault shot decode failed:', fname, e.message); }
  }
  state.meta.vaultedShots = [...vaulted];
  if (n) console.log(`🖼️  Pixel Vault: ${n} screenshot(s) resurrected from gist`);
}
/* ---- Pixel Vault alt-route (Cloudinary) — optional; env-configured only, zero deps ---- */
const CLOUD = {
  name: process.env.CLOUDINARY_CLOUD_NAME || '',
  key: process.env.CLOUDINARY_API_KEY || '',
  secret: process.env.CLOUDINARY_API_SECRET || '',
};
const cloudReady = () => !!(CLOUD.name && CLOUD.key && CLOUD.secret);
function cloudUpload(buf, filename, mime) {
  return new Promise((resolve, reject) => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHash('sha1').update(`timestamp=${ts}${CLOUD.secret}`).digest('hex');
    const boundary = '----mojournal' + Date.now().toString(16) + crypto.randomBytes(6).toString('hex');
    const parts = [];
    for (const [k, v] of Object.entries({ api_key: CLOUD.key, timestamp: String(ts), signature: sig })) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${String(filename).replace(/"/g, '')}"\r\nContent-Type: ${mime || 'image/jpeg'}\r\n\r\n`));
    parts.push(buf);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(parts);
    const r2 = https.request({
      hostname: 'api.cloudinary.com', port: 443, path: `/v1_1/${CLOUD.name}/image/upload`, method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }, timeout: 30000,
    }, (res2) => {
      const chunks = []; res2.on('data', (c) => chunks.push(c));
      res2.on('end', () => {
        try {
          const j = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          j.secure_url ? resolve(j.secure_url) : reject(new Error((j.error && j.error.message) || 'cloudinary rejected'));
        } catch (e) { reject(e); }
      });
    });
    r2.on('error', reject);
    r2.on('timeout', () => r2.destroy(new Error('cloudinary timeout')));
    r2.end(body);
  });
}


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
      decodeVaultShots(full.files);
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
      const files = { [GIST_FILE]: { content: JSON.stringify(state) } };
      // sweep new screenshots into the vault ride-along (max ~25MB per sweep)
      const swept = [];
      let bytes = 0;
      for (const s of pendingShots()) {
        if (bytes + s.size > 25e6) break;
        try {
          files['img_' + s.name] = { content: fs.readFileSync(path.join(UPLOADS, s.name)).toString('base64') };
          swept.push(s.name); bytes += s.size;
        } catch {}
      }
      if (gist.id) {
        await gh('https://api.github.com/gists/' + gist.id, {
          method: 'PATCH',
          body: JSON.stringify({ files }),
        });
      } else {
        const g = await gh('https://api.github.com/gists', {
          method: 'POST',
          body: JSON.stringify({
            description: "Mo's Journal — data + screenshot backup (auto-managed, do not delete)",
            public: false,
            files,
          }),
        });
        gist.id = g.id;
        console.log('☁️  Backup gist created:', g.html_url);
      }
      if (swept.length) {
        const vaulted = new Set(ensureVaultMeta());
        swept.forEach(n => vaulted.add(n));
        state.meta.vaultedShots = [...vaulted];
        console.log(`🖼️  Pixel Vault: ${swept.length} screenshot(s) backed up to gist (${Math.round(bytes / 1024)}KB)`);
        // persist the manifest immediately so a crash can't double-upload
        try { fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); } catch {}
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
      return send(res, 200, { version: 4, gistSync: gist.enabled, aiConfigured: !!aiCfg().key, pixelVault: cloudReady() || gist.enabled, shotsVaulted: ensureVaultMeta().length });
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
        if (typeof s.ai.key === 'string' && s.ai.key) s.ai.key = s.ai.key.trim();
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
        // OpenRouter's /models is PUBLIC — a dead key would still "connect".
        // /auth/key is the truth: 401 here = the key/account itself is rejected.
        const isOR = /openrouter\.ai/.test(cfg.base);
        const r = await fetch(cfg.base + (isOR ? '/auth/key' : '/models'), {
          headers: { 'Authorization': 'Bearer ' + cfg.key },
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          const notFound = /user not found/i.test(txt);
          return send(res, 400, {
            ok: false, error: 'AI_AUTH',
            message: notFound
              ? '"User not found" — this key belongs to a deleted/changed OpenRouter account. Open openrouter.ai/keys while SIGNED IN (check the email top-right), mint a FRESH key, paste & Save here.'
              : `Provider rejected the key (${r.status}) — mint a fresh key from your provider, paste & Save.`,
          });
        }
        return send(res, 200, { ok: true, message: `Connected ✓ key verified using ${cfg.model}` });
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
      // lane-hopping: free-model pools congest (429) and retire (404) — rotate until one answers.
      const laneHop = /openrouter\.ai|localhost|127\.0\.0\.1/.test(cfg.base);
      const chain = [cfg.model, ...(laneHop ? FREE_VISION_FALLBACK : [])].filter((m, i, a) => m && a.indexOf(m) === i);
      let lastErr = '', tried = 0, authFail = false;
      for (const model of chain) {
        tried++;
        try {
          const r = await fetch(cfg.base + '/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + cfg.key, 'Content-Type': 'application/json',
              'HTTP-Referer': 'https://mos-journal.app', 'X-Title': "Mo's Journal",
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.1, max_tokens: 3000 }),
            signal: AbortSignal.timeout(90000),
          });
          if (r.ok) {
            const j = await r.json();
            const raw = j.choices?.[0]?.message?.content || '';
            const m = raw.match(/\{[\s\S]*\}/);
            let parsed;
            try { parsed = m ? JSON.parse(m[0]) : { trades: [] }; }
            catch (e) { return send(res, 400, { ok: false, error: 'AI_FAIL', message: 'AI returned unreadable JSON — try again or a cleaner screenshot.' }); }
            return send(res, 200, { ok: true, via: model, trades: Array.isArray(parsed.trades) ? parsed.trades : [] });
          }
          const t = await r.text();
          lastErr = `AI error ${r.status}: ${t.slice(0, 250)}`;
          if (r.status === 401 || r.status === 402 || r.status === 403) { authFail = true; break; } // auth/billing — no lane helps
          // 404 (model retired) / 429 (lane busy) / 5xx (flake) → next lane
        } catch (e) {
          lastErr = e.name === 'TimeoutError' ? 'AI took too long — try fewer/smaller images.' : e.message;
        }
      }
      return send(res, 400, {
        ok: false, error: authFail ? 'AI_AUTH' : 'AI_FAIL', lanesTried: tried,
        message: authFail
          ? lastErr + ' — 🔑 KEY REJECTED by the provider ("User not found" = the key/account itself). This is NOT congestion — waiting won\'t fix it. Open your provider while SIGNED IN (check the email top-right), mint a FRESH key, paste it in ⚙️ → AI AUTO-FILL, press 🔌 Test, then Analyze again.'
          : lastErr + (tried > 1 ? ` — tried ${tried} free lanes, all busy. Wait ~60 seconds and press Analyze again; don't change any settings.` : ''),
      });
    }
    if (p === '/api/upload' && req.method === 'POST') {
      const body = await readBody(req);
      const b64 = String(body.data || '').replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      if (!buf.length) return send(res, 400, { ok: false, error: 'empty image' });
      if (buf.length > 9e6) return send(res, 413, { ok: false, error: 'image too large' });
      const ext = (body.ext || '.jpg').replace(/[^\w.]/g, '').slice(0, 6) || '.jpg';
      // content-fingerprint filename: the same image always lands on the same file —
      // duplicate uploads across trades fold into ONE canonical copy (kills Chart Book overcrowding)
      const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24) + ext;
      if (!fs.existsSync(path.join(UPLOADS, name))) fs.writeFileSync(path.join(UPLOADS, name), buf);
      let url = '/uploads/' + name;
      if (cloudReady()) {
        try {
          url = await cloudUpload(buf, body.name || name, (body.type || '').startsWith('image/') ? body.type : 'image/jpeg');
          try { fs.unlinkSync(path.join(UPLOADS, name)); } catch (_) {} // tent copy goes — the cloud carries it now
          console.log('☁️ screenshot vaulted to cloud');
        } catch (e) {
          console.error('☁️ cloud upload failed, keeping tent copy:', e.message);
        }
      }
      return send(res, 200, { ok: true, url, cloud: url.startsWith('http') });
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
