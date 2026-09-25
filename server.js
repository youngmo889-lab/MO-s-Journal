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
    model: process.env.AI_MODEL || s.model || 'google/gemma-4-31b-it:free',
    key: process.env.AI_KEY || s.key || '',
  };
}
const keyHint = k => (k && k.length > 10) ? (k.slice(0, 6) + '\u2026' + k.slice(-4)) : (k ? '[short key!]' : '[none]');
/* One chat call with a single polite retry when the free tier bounces us (429/503). */
async function chatOnce(cfg, parts, maxTokens = 2000, timeoutMs = 60000) {
  const call = () => fetch(cfg.base + '/chat/completions', {
    method: 'POST',
    headers: aiHeaders(cfg),
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: parts }], temperature: 0, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let r = await call();
  if (r.status === 429 || r.status === 503) { await new Promise(s => setTimeout(s, 12000)); r = await call(); }
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { throw new Error('non-JSON reply (HTTP ' + r.status + ')'); }
  if (!r.ok) throw new Error((j && j.message) || 'HTTP ' + r.status);
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}
function aiHeaders(cfg) {
  const h = {
    'Authorization': 'Bearer ' + cfg.key,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://mos-journal.app',
    'X-Title': "Mo's Journal",
  };
  // Google's new-format keys (AQ…) talk to the OpenAI-compat endpoint via x-goog-api-key, not Bearer
  if (/googleapis\.com/.test(cfg.base)) h['x-goog-api-key'] = cfg.key;
  return h;
}
// v4.6.3: report the EFFECTIVE config (env wins over stored), and flag when the key comes
// from a server env var — that's the deploy-proof lane, so Mo can see at a glance that
// redeploying can't wipe it again.
const maskAI = () => {
  const c = aiCfg();
  return {
    base: c.base, model: c.model, key: '',
    keyHint: keyHint(c.key),
    configured: !!c.key,
    fromEnv: !!process.env.AI_KEY,
  };
};
/* v4.6.4 ACCURACY: small vision models (12B) misread digits when asked to read a chart AND
   reason about it in one step. So we split it: (1) pure OCR — transcribe the screenshot
   verbatim, digit for digit; (2) extract structured trades from that clean text. Reading
   then reasoning is dramatically more faithful than doing both at once. */
const AI_OCR_PROMPT = `You are a precise OCR engine for trading screenshots. Transcribe EVERY line of visible text exactly as it appears, digit for digit.
Rules:
- Preserve row order and column order. Output one line per row.
- Keep every decimal point exactly where it is. Do NOT round, convert, reformat or "clean" numbers.
- Do not summarise, skip rows, merge rows, or add commentary.
- Do not invent or guess any value. If a character is uncertain, write your best reading followed by ?.
- Include headers, times, symbols, prices, volumes, profit/loss figures and any on-chart labels.
- Separate columns with two spaces so prices stay distinguishable. Never merge two numbers into one.
Output plain text only — no markdown, no explanation.`;

const AI_EXTRACT_PROMPT = `You are the extraction engine of a trading journal. Read the broker screenshot(s)/history and return ONLY a JSON object (no markdown, no prose):
{"trades":[{"pair":"Volatility 75","dir":"long","lots":1,"entry":6350.2,"exit":6358.7,"sl":6345.2,"tp":6360.2,"openTime":"2026-09-19 09:14","closeTime":"2026-09-19 15:40","pnl":8.5,"setup":"Break & retest","broker":"Weltrade"}]}
Rules: dir must be "long" (buy) or "short" (sell). Use 24h times, numbers without currency symbols, null for anything not visible. If the image shows a history/statement, extract EVERY trade row. If the image is a chart with an open/closed position, extract what's shown (prices, symbol, size). "setup" = strategy name only if annotated on the chart, else null. Return {"trades":[]} if nothing trade-like is visible.
BACKTEST / CHART-ONLY SCREENSHOTS (very common): the trader screenshots a chart with horizontal lines or zones drawn for entry, stop-loss and take-profit, and possibly arrows or a shaded risk box. Read those drawn levels as entry/sl/tp. Also read any text labels on the chart (e.g. "sell", "entry 6350.2", "SL", "TP1", "BOS", "OB") and any profit/loss figure printed on screen.
NEVER GUESS OR INVENT A NUMBER. Accuracy matters more than completeness — a wrong P&L corrupts the trader's statistics. If a price/level is not clearly visible, use null; do not infer it from other numbers. If the chart shows a planned or still-open trade with no visible exit, leave exit and pnl null. If lot size is not shown, use null (never assume 1). If no date is visible anywhere, leave openTime/closeTime null rather than using today's date.`;



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
      .filter(s => s.size > 0 && s.size < 8e6); // v4.6.7: was 3MB — big PNGs were silently skipped and lost on redeploy
  } catch { return []; }
}
/* v4.6.10: GitHub TRUNCATES gist file content above ~1MB in the listing. The old code saw
   `truncated: true` and silently skipped those files — so every large screenshot sat safely
   in the vault yet never came back, forever. Now we pull the raw URL to get the full bytes. */
async function vaultRaw(fname) {
  const owner = (gist.url || '').split('/')[3] || '';
  if (!owner || !gist.id) return null;
  try {
    const r = await fetch(`https://gist.githubusercontent.com/${owner}/${gist.id}/raw/${fname}`, {
      headers: { Authorization: 'Bearer ' + GIST_TOKEN, 'User-Agent': "Mo's Journal" },
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
}

async function decodeVaultShots(files) {
  const vaulted = new Set(ensureVaultMeta());
  let n = 0;
  const entries = Object.entries(files || {}).filter(([fn]) => fn.startsWith('img_'));
  for (const [fname, f] of entries) {
    const name = fname.slice(4);
    if (!SHOT_EXT.test(name)) continue;
    const onDisk = path.join(UPLOADS, name);
    if (fs.existsSync(onDisk)) { vaulted.add(name); continue; } // already have it
    let content = f && f.content;
    if ((!content || f.truncated) && GIST_TOKEN) content = await vaultRaw(fname); // <— the fix
    if (!content) continue;
    try {
      fs.mkdirSync(UPLOADS, { recursive: true });
      fs.writeFileSync(onDisk, Buffer.from(String(content).replace(/\s+/g, ''), 'base64'));
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
      gist.url = found.html_url || '';
      const full = await gh('https://api.github.com/gists/' + found.id);
      const content = full.files[GIST_FILE] && full.files[GIST_FILE].content;
      if (content && content.length > 10) {
        const incoming = migrate(JSON.parse(content));
        // remember what the vault holds, so we can refuse to overwrite it with emptiness
        gist.remoteTrades = (incoming.trades || []).length;
        // v4.6.0 VAULT TIME-LOCK: refuse a roll-back. If the local seal is NEWER than the
        // incoming vault copy (stale gist after a Render nap), keep the newer AI key.
        const inSeal = incoming?.meta?.aiSealedAt || 0;
        const mySeal = state?.meta?.aiSealedAt || 0;
        const inKey = incoming?.settings?.ai?.key || '';
        const myKey = state?.settings?.ai?.key || '';
        if (mySeal > inSeal && myKey && inKey && myKey !== inKey) {
          console.log(`🛡️  vault roll-back REFUSED — keeping newer AI key (${keyHint(myKey)}, sealed ${new Date(mySeal).toISOString()})`);
          incoming.settings.ai.key = myKey;
          incoming.meta.aiSealedAt = mySeal;
        }
        state = incoming;
      }
      await decodeVaultShots(full.files);
      gist.restored = true;
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
// v4.6.0: extracted so /api/settings can flush the vault INSTANTLY on key save —
// no 8s window where a Render nap can orphan a freshly minted key.

/* v4.6.6 TIME MACHINE: write a DATED snapshot into the same private gist. The live file is
   overwritten constantly, but snapshots are immutable — so a bad import or a wiped deploy
   can always be rolled back. Keeps the newest 10; the AI key is stripped out of snapshots. */
/* Read ONLY the data file from the vault (raw URL — avoids pulling every screenshot). */
async function peekRemote() {
  try {
    const owner = (gist.url || '').split('/')[3] || '';
    if (!gist.id || !owner) return null;
    const url = `https://gist.githubusercontent.com/${owner}/${gist.id}/raw/${GIST_FILE}`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + GIST_TOKEN, 'User-Agent': "Mo's Journal" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return null;
    const j = JSON.parse(await r.text());
    return { trades: (j.trades || []).length, profiles: (j.profiles || []).length };
  } catch (e) { return null; }
}
/* v4.6.9 TIME MACHINE: every gist save is a git commit, so the whole history is still there. */
async function gistRevisions(limit = 12) {
  const c = await gh(`https://api.github.com/gists/${gist.id}/commits`);
  return (c || []).slice(0, limit).map(x => ({ version: x.version, at: x.committed_at }));
}
async function gistRevisionData(version) {
  const owner = (gist.url || '').split('/')[3] || '';
  const url = `https://gist.githubusercontent.com/${owner}/${gist.id}/raw/${version}/${GIST_FILE}`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + GIST_TOKEN, 'User-Agent': "Mo's Journal" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('could not read that revision (' + r.status + ')');
  return JSON.parse(await r.text());
}

async function backupSnapshot() {
  if (!GIST_TOKEN) throw new Error('GIST_TOKEN is not set on this server');
  if (!gist.enabled) await gistBoot();
  if (!gist.enabled) throw new Error('cloud vault unreachable right now');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); // second-precision: two backups in one minute won't overwrite each other
  const name = `mos-journal-snapshot-${stamp}.json`;
  state.meta = state.meta || {};
  const prev = Array.isArray(state.meta.snapshots) ? state.meta.snapshots : [];
  const keep = [...prev, name].slice(-10);
  const drop = prev.filter(n => !keep.includes(n));
  const safe = JSON.parse(JSON.stringify(state));
  if (safe.settings && safe.settings.ai) safe.settings.ai.key = ''; // never snapshot secrets
  const files = { [name]: { content: JSON.stringify(safe) } };
  drop.forEach(n => { files[n] = null; }); // null content = delete from the gist
  await gh('https://api.github.com/gists/' + gist.id, { method: 'PATCH', body: JSON.stringify({ files }) });
  state.meta.snapshots = keep;
  state.meta.lastBackup = { at: Date.now(), trades: (state.trades || []).length, shots: ensureVaultMeta().length, snapshot: name };
  scheduleSave();
  return { at: state.meta.lastBackup.at, trades: state.meta.lastBackup.trades, shots: state.meta.lastBackup.shots, snapshot: name, kept: keep.length, url: gist.url || '' };
}

async function pushGistNow() {
  try {
      if (!gist.enabled) {
        // NEVER CLOBBER THE VAULT: if the boot handshake blinked (Render cold-start),
        // re-arm the link first — and only push once the vault is proven reachable.
        if (Date.now() - (gist.lastRetry || 0) > 60000) {
          gist.lastRetry = Date.now();
          console.log('☁️  vault link down — re-arming before any save…');
          await gistBoot();
        }
        if (!gist.enabled) { console.log('☁️  vault still unreachable — holding data locally, will retry.'); return; }
        scheduleSave(); // state may have been restored — persist it locally too
      }
      // v4.6.9 WIPE GUARD (hardened): v4.6.3 only knew the vault's contents if the boot
      // restore had ALREADY succeeded. When the boot handshake blinked, remoteTrades was
      // unknown, the check sailed through, and an empty journal overwrote everything.
      // Now we LOOK before every write, and compare profiles too — not just trades.
      if (gist.remoteTrades == null) {
        const rem = await peekRemote();
        if (rem) { gist.remoteTrades = rem.trades; gist.remoteProfiles = rem.profiles; }
      }
      const localTrades = (state.trades || []).length;
      const localProfiles = (state.profiles || []).length;
      const richerRemote = (gist.remoteTrades > 0 && localTrades === 0)
        || (gist.remoteProfiles > localProfiles && localTrades === 0);
      if (richerRemote && !state.__allowWipe) {
        console.log(`🛡️  WIPE GUARD: refusing to overwrite vault (${gist.remoteTrades} trades, ${gist.remoteProfiles} accounts) with an empty journal — holding local.`);
        return;
      }
      if (state.__allowWipe) delete state.__allowWipe;
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
        gist.remoteTrades = (state.trades || []).length; // vault now matches local
        // persist the manifest immediately so a crash can't double-upload
        try { fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(state, null, 2)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); } catch {}
      }
  } catch (e) { console.log('gist save failed:', e.message); }
}
function scheduleGistSave() {
  if (!GIST_TOKEN) return;
  clearTimeout(gistTimer);
  gistTimer = setTimeout(pushGistNow, 8000);
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
      const pub = { ...state, settings: { ...state.settings, ai: maskAI() } };
      return send(res, 200, pub);
    }
    if (p === '/api/meta' && req.method === 'GET') {
      const lb = (state.meta && state.meta.lastBackup) || null;
      return send(res, 200, { version: 4, gistSync: gist.enabled, gistFound: !!gist.id, restored: !!gist.restored,
        aiConfigured: !!aiCfg().key, pixelVault: cloudReady() || gist.enabled, shotsVaulted: ensureVaultMeta().length,
        gistUrl: gist.url || '', trades: (state.trades || []).length,
        snapshots: ((state.meta && state.meta.snapshots) || []).length, lastBackup: lb });
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
      // v4.6.0 VAULT TIME-LOCK: every seal is stamped. Anything that later tries to restore an
      // OLDER seal is a roll-back (Render nap + stale vault = Mo's night of the sk-or-…8213
      // corpse) and is REFUSED. Keys only ever move forward in time.
      if (s.ai && s.ai.key && state.meta) state.meta.aiSealedAt = Date.now();
      scheduleSave();
      // flush the vault NOW: a freshly minted key must survive a Render sleep, not wait 8s.
      if (s.ai && s.ai.key && GIST_TOKEN) pushGistNow().catch(() => {});
      return send(res, 200, { ok: true, settings: { ...state.settings, ai: maskAI() } });
    }

    // ---- AI AUTO-FILL ----
    /* v4.6.2 AI DIAGNOSTIC: runs where the key lives (server-side) so the key is never
       exposed. Sends a real image and asks the model to look at it, then reports which
       models on THIS key actually accept vision — plus the provider's own rate-limit
       headers, which tell us whether a 429 is "wait 3s" or "you're capped for an hour". */
    if (p === '/api/ai-probe' && req.method === 'GET') {
      const cfg = aiCfg();
      if (!cfg.key) return send(res, 400, { ok: false, error: 'NO_KEY', message: 'No key saved yet.' });
      // 64x64 test image (black/white halves) — valid PNG, tiny, enough to prove vision works
      const TEST_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATklEQVR4nO3PMQEAAAgDoMWxfyhzGMFrHzQgWzZlERAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD4HCxrUXjajQE6AAAAAElFTkSuQmCC';
      const isMistral = /mistral\.ai/.test(cfg.base);
      // candidate vision models for this provider, configured one first
      const candidates = [cfg.model];
      if (isMistral) ['pixtral-12b-2409', 'mistral-small-3.1-24b-instruct', 'pixtral-large-latest', 'mistral-large-latest', 'open-mistral-nemo', 'ministral-8b-latest']
        .forEach(m => { if (!candidates.includes(m)) candidates.push(m); });
      const results = [];
      const t0 = Date.now();
      // ?all=1 tests every candidate instead of stopping at the first success — bigger
      // models read small price digits far more accurately, so let the trader choose.
      const probeAll = /[?&]all=1/.test(req.url || '');
      for (const model of candidates.slice(0, 6)) {
        if (Date.now() - t0 > 75000) break; // never hang the phone
        const started = Date.now();
        try {
          const r = await fetch(cfg.base + '/chat/completions', {
            method: 'POST',
            headers: aiHeaders(cfg),
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: [
                { type: 'text', text: 'Reply with exactly: OK' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,' + TEST_PNG } },
              ] }],
              max_tokens: 8, temperature: 0,
            }),
            signal: AbortSignal.timeout(25000),
          });
          const txt = await r.text();
          let j = null; try { j = JSON.parse(txt); } catch {}
          const h = n => r.headers.get(n) || '';
          results.push({
            model, status: r.status, ok: r.ok,
            ms: Date.now() - started,
            reply: j ? String(j.choices?.[0]?.message?.content || '').slice(0, 40) : '',
            error: j?.message || (r.ok ? '' : txt.slice(0, 120)),
            code: j?.code || '',
            // provider's own budget — the difference between "wait 3s" and "capped for an hour"
            rlRequestsLeft: h('ratelimit-remaining-requests') || h('x-ratelimit-remaining-requests') || '',
            rlTokensLeft: h('ratelimit-remaining-tokens') || h('x-ratelimit-remaining-tokens') || '',
            rlReset: h('ratelimit-reset-requests') || h('x-ratelimit-reset-requests') || h('retry-after') || '',
          });
          if (r.ok && !probeAll) break; // found a working vision model — stop burning quota
        } catch (e) {
          results.push({ model, status: 0, ok: false, ms: Date.now() - started, error: e.name === 'TimeoutError' ? 'timed out' : e.message });
        }
      }
      const winner = results.find(r => r.ok);
      return send(res, 200, { ok: !!winner, provider: cfg.base, winner: winner?.model || '', results });
    }

function missingShots() {
  const out = [];
  const seen = new Set();
  for (const t of (state.trades || [])) {
    for (const sh of (t.screenshots || [])) {
      const url = typeof sh === 'string' ? sh : ((sh && sh.url) || '');
      if (!url || !url.startsWith('/uploads/') || seen.has(url)) continue;
      seen.add(url);
      const name = path.basename(url);
      if (!fs.existsSync(path.join(UPLOADS, name))) out.push({ trade: t.id, pair: t.pair, date: t.date, url, name });
    }
  }
  return out;
}

    /* v4.6.7: which screenshots referenced by trades are actually missing from disk?
       (Render wipes /uploads on deploy; anything too big to vault comes back 404.) */
    if (p === '/api/shots/status' && req.method === 'GET') {
      const missing = [];
      const seen = new Set();
      let total = 0;
      for (const t of (state.trades || [])) {
        for (const sh of (t.screenshots || [])) {
          const url = typeof sh === 'string' ? sh : ((sh && sh.url) || '');
          if (!url || seen.has(url)) continue;
          seen.add(url); total++;
          if (!url.startsWith('/uploads/')) continue;
          const name = path.basename(url);
          if (!fs.existsSync(path.join(UPLOADS, name))) missing.push({ trade: t.id, pair: t.pair, date: t.date, url });
        }
      }
      return send(res, 200, { ok: true, total, missing, missingCount: missing.length });
    }

    /* v4.6.9 TIME MACHINE — list every version ever saved to the vault, with trade counts. */
    if (p === '/api/timemachine' && req.method === 'GET') {
      if (!GIST_TOKEN) return send(res, 400, { ok: false, message: 'No GIST_TOKEN on this server — no history to read.' });
      try {
        if (!gist.enabled) { await gistBoot(); }
        if (!gist.enabled || !gist.id) return send(res, 400, { ok: false, message: 'Cloud vault unreachable right now.' });
        const revs = await gistRevisions(12);
        const out = [];
        const t0 = Date.now();
        for (const rv of revs) {
          if (Date.now() - t0 > 25000) break; // don't hang the phone
          try {
            const d = await gistRevisionData(rv.version);
            out.push({ version: rv.version, at: rv.at, trades: (d.trades || []).length, profiles: (d.profiles || []).length, shots: ((d.meta && d.meta.vaultedShots) || []).length });
          } catch (e) { /* skip unreadable revision */ }
        }
        return send(res, 200, { ok: true, current: { trades: (state.trades || []).length, profiles: (state.profiles || []).length }, revisions: out });
      } catch (e) { return send(res, 400, { ok: false, message: e.message }); }
    }

    /* v4.6.9: roll the journal back to any saved version. */
    if (p === '/api/timemachine/restore' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const version = String(body.version || '');
      if (!version) return send(res, 400, { ok: false, message: 'No version given.' });
      try {
        try { await backupSnapshot(); } catch (e) { console.log('pre-restore snapshot skipped:', e.message); }
        const d = await gistRevisionData(version);
        state.trades = Array.isArray(d.trades) ? d.trades : [];
        state.profiles = Array.isArray(d.profiles) ? d.profiles : state.profiles;
        state.meta = { ...(state.meta || {}), ...(d.meta || {}) };
        if (d.settings && typeof d.settings === 'object') {
          const keepKey = (state.settings && state.settings.ai && state.settings.ai.key) || '';
          state.settings = d.settings;
          if (state.settings.ai && keepKey) state.settings.ai.key = keepKey; // never lose the key
        }
        migrate(state);
        state.__allowWipe = true; // this IS the deliberate restore
        gist.remoteTrades = state.trades.length;
        gist.remoteProfiles = state.profiles.length;
        scheduleSave();
        return send(res, 200, { ok: true, trades: state.trades.length, profiles: state.profiles.length });
      } catch (e) { return send(res, 400, { ok: false, message: e.message }); }
    }

    /* v4.6.10: one tap to pull missing screenshots back out of the vault (raw fetch, so
       even >1MB files that GitHub truncates in listings are recovered in full). */
    if (p === '/api/shots/recover' && req.method === 'POST') {
      if (!GIST_TOKEN) return send(res, 400, { ok: false, message: 'No GIST_TOKEN on this server.' });
      try {
        if (!gist.enabled) await gistBoot();
        const missing = missingShots();
        let recovered = 0; const stillGone = [];
        for (const m of missing) {
          const raw = await vaultRaw('img_' + m.name);
          if (!raw) { stillGone.push(m); continue; }
          try {
            fs.mkdirSync(UPLOADS, { recursive: true });
            fs.writeFileSync(path.join(UPLOADS, m.name), Buffer.from(String(raw).replace(/\s+/g, ''), 'base64'));
            recovered++;
          } catch (e) { stillGone.push(m); }
        }
        const vaulted = new Set(ensureVaultMeta());
        missing.forEach(m => { if (!stillGone.includes(m)) vaulted.add(m.name); });
        state.meta.vaultedShots = [...vaulted];
        scheduleSave();
        return send(res, 200, { ok: true, attempted: missing.length, recovered, stillGone: stillGone.length });
      } catch (e) { return send(res, 400, { ok: false, message: e.message }); }
    }

    if (p === '/api/backup' && req.method === 'POST') {
      try {
        await pushGistNow();          // sync the live copy first
        const r = await backupSnapshot(); // then stamp an immutable dated snapshot
        return send(res, 200, { ok: true, ...r });
      } catch (e) { return send(res, 400, { ok: false, message: e.message }); }
    }

    if (p === '/api/ai-test' && req.method === 'GET') {
      const cfg = aiCfg();
      if (!cfg.key) return send(res, 400, { ok: false, error: 'NO_KEY', message: 'No AI key configured yet.' });
      try {
        const isOR = /openrouter\.ai/.test(cfg.base);
        const isGoog = /googleapis\.com/.test(cfg.base);
        let r;
        if (isGoog) {
          // Google's /models doesn't verify keys (same lie as OpenRouter's public endpoint once told).
          // The only truth is a real authenticated call — 1 token, real probe.
          r = await fetch(cfg.base + '/chat/completions', {
            method: 'POST', headers: aiHeaders(cfg),
            body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }], max_tokens: 1 }),
            signal: AbortSignal.timeout(30000),
          });
        } else {
          // v4.6.0 TRUTHFUL TEST: /models can lie — a key that lists models may still be dead
          // at chat (Google proved it: green Test, 401 Analyze, same key). Fire a tiny REAL
          // completion; if the model answers, the pipe genuinely works end-to-end.
          r = await fetch(cfg.base + '/chat/completions', {
            method: 'POST',
            headers: aiHeaders(cfg),
            body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 8, temperature: 0 }),
            signal: AbortSignal.timeout(45000),
          });
        }
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          const notFound = /user not found/i.test(txt);
          return send(res, 400, {
            ok: false, error: 'AI_AUTH',
            message: notFound
              ? '"User not found" — this key belongs to a deleted/changed account. Open the provider while SIGNED IN (check the email top-right), mint a FRESH key, paste & Save here.'
              : `Key rejected by provider (${r.status}): ${txt.slice(0, 160)} — re-check the key or mint a fresh one, then Save & Test again.`,
          });
        }
        return send(res, 200, { ok: true, message: `Connected ✓ key verified (${keyHint(cfg.key)}) using ${cfg.model}` });
      } catch (e) { return send(res, 400, { ok: false, error: 'AI_FAIL', message: 'Could not reach provider: ' + e.message }); }
    }

    if (p === '/api/ai-parse' && req.method === 'POST') {
      const cfg = aiCfg();
      if (!cfg.key) return send(res, 400, { ok: false, error: 'NO_KEY', message: 'Add a free AI key first — Settings → 🪄 AI AUTO-FILL.' });
      let body;
      try { body = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: 'BAD_BODY' }); }
      const shotParts = [];
      (body.images || []).slice(0, 8).forEach(im => {
        const b64 = String(im.data || '').replace(/^data:image\/\w+;base64,/, '');
        const mime = /\.png$/i.test(String(im.ext || '')) ? 'image/png' : 'image/jpeg';
        if (b64.length > 100) shotParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,` + b64 } });
      });

      // ---- v4.6.4 PASS 1: transcribe the screenshots verbatim (OCR) ----
      let transcript = '';
      if (shotParts.length) {
        try {
          const ocr = await chatOnce(cfg, [{ type: 'text', text: AI_OCR_PROMPT }, ...shotParts], 4000, 75000);
          if (ocr && ocr.trim().length >= 8) {
            transcript = ocr.trim();
            console.log(`🔍 OCR pass: ${transcript.length} chars transcribed from ${shotParts.length} image(s)`);
          }
        } catch (e) { console.log('🔍 OCR pass failed, falling back to single-pass:', e.message); }
      }

      const content = [{ type: 'text', text: AI_EXTRACT_PROMPT + (body.hint ? '\nContext from the trader: ' + String(body.hint).slice(0, 500) : '') }];
      if (transcript) {
        // reason over clean text instead of re-reading pixels — far fewer digit errors
        content[0].text += `\n\n===== EXACT TEXT TRANSCRIBED FROM THE SCREENSHOT(S) =====\n${transcript.slice(0, 20000)}\n===== END TRANSCRIPTION =====\n`
          + 'Extract strictly from the transcription above. Copy every number EXACTLY as written (digit for digit, same decimal places). '
          + 'Do NOT round, convert, recalculate or "correct" any value. Use null for anything absent. '
          + 'If the transcription contains no trade data, return {"trades":[]}. Do not invent trades.'
          + ' COMPLETENESS: extract EVERY trade row visible in the transcription — do not stop after a few, do not summarise, do not merge separate rows.'
          + 'SELF-CHECK before answering: every number you return MUST appear verbatim in the transcription above. '
          + 'If you cannot find a value written there, return null for it — never estimate, average or fill it in.'
      } else if (shotParts.length) {
        content.push(...shotParts); // OCR unusable — let the model look at the images directly
      }
      if (body.text) content[0].text += '\n\nPasted history/text to extract from:\n' + String(body.text).slice(0, 12000);
      // lane-hopping: free-model pools congest (429) and retire (404) — rotate until one answers.
      const laneHop = /openrouter\.ai|localhost|127\.0\.0\.1/.test(cfg.base);
      const chain = [cfg.model, ...(laneHop ? FREE_VISION_FALLBACK : [])].filter((m, i, a) => m && a.indexOf(m) === i);
      let lastErr = '', tried = 0, authFail = false;
      // v4.6.0: free tiers pace at ~1 req/sec. Instead of failing instantly on 429 and
      // making Mo hand-time a cooldown, the SERVER waits and retries the same lane politely.
      const RATE_PATIENCE = laneHop ? 1 : 3;          // retries per lane on 429/503
      const RATE_SLEEP = [12000, 20000, 30000];       // escalating backoff: bouncer gets bored
      // Bounded patience: Render's proxy can cut a request around 60s. If we wait longer than
      // that, Mo gets a network error while the server is still politely waiting — useless.
      // So the whole retry budget is capped and we hand back an honest "try again" message.
      const T0 = Date.now(), WAIT_BUDGET = 58000;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (const model of chain) {
        tried++;
        for (let attempt = 0; attempt <= RATE_PATIENCE; attempt++) {
        try {
          const r = await fetch(cfg.base + '/chat/completions', {
            method: 'POST',
            headers: aiHeaders(cfg),
            body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0, max_tokens: 4000 }), // v4.6.8: room for every row in a dense statement
            signal: AbortSignal.timeout(90000),
          });
          if (r.ok) {
            // v4.6.0: never trust the body to be JSON. A retired/dead service can answer
            // HTTP 200 with plain text (GitHub Models' tombstone answered "OK") — that used
            // to surface as the inscrutable "Unexpected token 'O' … is not valid JSON".
            const text = await r.text();
            let j;
            try { j = JSON.parse(text); }
            catch (e) {
              const stub = text.trim().slice(0, 60).replace(/\s+/g, ' ');
              return send(res, 400, { ok: false, error: 'AI_DEAD_ENDPOINT',
                message: `⚰️ ${cfg.base} answered HTTP 200 but not JSON (got: "${stub}"). That endpoint is retired or misconfigured — no key can fix it. Switch provider in ⚙️ Settings → AI AUTO-FILL (Mistral preset is recommended).` });
            }
            const raw = j.choices?.[0]?.message?.content || '';
            const m = raw.match(/\{[\s\S]*\}/);
            let parsed;
            try { parsed = m ? JSON.parse(m[0]) : { trades: [] }; }
            catch (e) { return send(res, 400, { ok: false, error: 'AI_FAIL', message: 'AI returned unreadable JSON — try again or a cleaner screenshot.' }); }
            return send(res, 200, { ok: true, via: model, transcript: transcript || '', trades: Array.isArray(parsed.trades) ? parsed.trades : [] });
          }
          const t = await r.text();
          lastErr = `AI error ${r.status}: ${t.slice(0, 250)}`;
          if (r.status === 401 || r.status === 402 || r.status === 403) { authFail = true; break; } // auth/billing — no lane helps
          // v4.6.0: 429/503 = the bouncer, not a broken key. Wait it out and retry same lane.
          if ((r.status === 429 || r.status === 503) && attempt < RATE_PATIENCE) {
            const wait = RATE_SLEEP[attempt];
            if (Date.now() - T0 + wait > WAIT_BUDGET) {
              lastErr = `AI error ${r.status}: rate-limited. I waited as long as the server safely can — press 🧠 Analyze once more and it should land.`;
              break;
            }
            console.log(`⏳ rate-limited by ${model} — backing off ${wait / 1000}s (attempt ${attempt + 1}/${RATE_PATIENCE})`);
            await sleep(wait);
            continue;
          }
          // 404 (model retired) / exhausted 429 / 5xx (flake) → next lane
          break;
        } catch (e) {
          lastErr = e.name === 'TimeoutError' ? 'AI took too long — try fewer/smaller images.' : e.message;
          break;
        }
        }
        if (authFail) break;
      }
      return send(res, 400, {
        ok: false, error: authFail ? 'AI_AUTH' : 'AI_FAIL', lanesTried: tried,
        message: authFail
          ? lastErr + ` (key sent: ${keyHint(cfg.key)})` + ' — 🔑 KEY REJECTED by the provider ("User not found" = the key/account itself). This is NOT congestion — waiting won\'t fix it. Open your provider while SIGNED IN (check the email top-right), mint a FRESH key, paste it in ⚙️ → AI AUTO-FILL, press 🔌 Test, then Analyze again.'
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
      // shrink-guard: a stale backup must never silently erase history
      const tN = Array.isArray(body.trades) ? body.trades.length : null;
      const pN = Array.isArray(body.profiles) ? body.profiles.length : null;
      if (body.force !== true && ((tN != null && tN < state.trades.length) || (pN != null && pN < state.profiles.length))) {
        return send(res, 409, {
          ok: false, error: 'IMPORT_SHRINK',
          message: `⚠️ This file would SHRINK your journal: ${state.trades.length} trades → ${tN}, ${state.profiles.length} accounts → ${pN}. Only import it if you're deliberately restoring an older backup.`,
        });
      }
      if (Array.isArray(body.trades)) state.trades = body.trades;
      if (Array.isArray(body.profiles)) state.profiles = body.profiles;
      if (body.settings && typeof body.settings === 'object') state.settings = body.settings;
      // force = a deliberate, double-confirmed wipe — let it past the vault wipe-guard,
      // otherwise the trades would resurrect from the vault on the next deploy.
      if (body.force === true) state.__allowWipe = true;
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
  // cold-start blink insurance: if GitHub hiccuped at boot, quietly retry the vault link
  if (GIST_TOKEN && !gist.enabled) {
    [15000, 45000, 90000].forEach((ms, i) => setTimeout(async () => {
      if (!gist.enabled) { console.log(`☁️  vault retry #${i + 1} (cold-start blink)`); await gistBoot(); }
    }, ms));
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`📒 Mo's Journal v4.6 · ONE-TIME-FIX edition running on http://0.0.0.0:${PORT}${GIST_TOKEN ? ' · gist sync enabled' : ''}`);
    // v4.6.0 KEEP-AWAKE: Render's free tier sleeps after ~15 min idle — and waking up
    // used to roll the vault back to a stale key. We ping ourselves every 10 min so the
    // server is never the reason a flow dies. (Only when KEEP_AWAKE_URL is set, e.g. on Render.)
    const wakeUrl = process.env.KEEP_AWAKE_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL + '/api/state' : '');
    if (wakeUrl) {
      setInterval(() => {
        fetch(wakeUrl, { signal: AbortSignal.timeout(20000) })
          .then(() => console.log('🔔 keep-awake ping ok'))
          .catch(e => console.log('🔔 keep-awake ping missed:', e.message));
      }, 10 * 60 * 1000);
      console.log(`🔔 keep-awake armed → ${wakeUrl} every 10 min`);
    }
  });
})();
