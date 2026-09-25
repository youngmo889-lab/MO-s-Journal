/* =====================================================================
   Mo's Journal 📒 — v4 · SMART edition
   AI AUTO-FILL (vision parse · MT4/MT5/CSV import · paste text) ·
   Hold-time tracking · Setup Lab (win%, R:R, hold, failure fingerprints)
   Synthetic indices first (Deriv/Weltrade) · multi-account · gamified.
===================================================================== */

'use strict';

/* ---------------- Config ---------------- */
const LEVELS = [
  { xp: 0,    name: 'Demo Dreamer',  emoji: '🌱' },
  { xp: 150,  name: 'Pip Cadet',     emoji: '🎓' },
  { xp: 400,  name: 'Chart Surfer',  emoji: '🏄' },
  { xp: 800,  name: 'Trend Rider',   emoji: '🏇' },
  { xp: 1500, name: 'Risk Samurai',  emoji: '⚔️' },
  { xp: 2500, name: 'Market Wizard', emoji: '🧙' },
  { xp: 4000, name: 'FX Legend',     emoji: '👑' },
];

const DEFAULT_RULES = [
  'Planned the trade before entering',
  'Waited for my setup — no chasing',
  'Risk within my limit',
  'Stop-loss placed & respected',
  'No revenge / FOMO trading',
];

const TIME_BLOCKS = ['Morning', 'Midday', 'Evening', 'Late night'];
const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const EMOTIONS_BEFORE = [
  ['calm', '😌 Calm'], ['focused', '🎯 Focused'], ['confident', '😎 Confident'],
  ['anxious', '😰 Anxious'], ['fomo', '🤤 FOMO'], ['revenge', '😤 Revenge'],
  ['bored', '🥱 Bored'], ['tired', '😴 Tired'],
];
const EMOTIONS_AFTER = [
  ['satisfied', '😊 Satisfied'], ['neutral', '😐 Neutral'], ['euphoric', '🤩 Euphoric'],
  ['frustrated', '😖 Frustrated'], ['regretful', '😣 Regretful'], ['angry', '😡 Angry'],
];

const MISTAKES = [
  'Chased entry', 'Moved stop-loss', 'Closed too early', 'Held too long',
  'Oversized position', 'No stop-loss', 'Revenge trade', 'FOMO entry',
  'Spike gambling', 'Overtrading',
];

const SYMBOLS = [
  'Volatility 10', 'Volatility 25', 'Volatility 50', 'Volatility 75', 'Volatility 100',
  'Volatility 75 (1s)', 'Volatility 100 (1s)',
  'Boom 300', 'Boom 500', 'Boom 600', 'Boom 1000',
  'Crash 300', 'Crash 500', 'Crash 600', 'Crash 1000',
  'Step Index', 'Jump 10', 'Jump 25', 'Jump 50', 'Jump 75', 'Jump 100',
  'Range Break 100', 'Range Break 200',
  'DEX 600 UP', 'DEX 900 UP', 'DEX 1200 UP', 'DEX 600 DOWN', 'DEX 900 DOWN', 'DEX 1200 DOWN',
  'Multi Step 2', 'Multi Step 4', 'Drift Switch Up', 'Drift Switch Down',
  'FX Vol 10', 'FX Vol 20', 'FX Vol 30', 'FX Vol 40', 'FX Vol 50', 'FX Vol 60', 'FX Vol 70', 'FX Vol 80', 'FX Vol 90', 'FX Vol 100',
  'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY',
];

const SETUP_IDEAS = ['Quasimodo', 'Spike catch', 'Order block', 'Trend continuation', 'Trend pullback',
  'Break & retest', 'SR flip', 'Fib retrace', 'Range scalp', 'Momentum burst', 'Support/Resistance bounce'];

const SHOT_CATS = ['Analysis', 'Entry', 'Management', 'Outcome', 'Lesson'];
const SHOT_CAT_EMOJI = { Analysis: '🧭', Entry: '🎯', Management: '🎛️', Outcome: '🏁', Lesson: '📚' };

const PROFILE_EMOJIS = ['💼', '🏦', '🎯', '💎', '🦁', '🐺', '🚀', '🧪', '🌊', '🔥', '🦅', '⭐'];
const PROFILE_TYPES = ['Live', 'Demo', 'Prop Challenge', 'Funded'];
const PROFILE_BROKERS = ['Weltrade', 'Deriv', 'Other'];

const AI_PRESETS = [
  { name: '⭐ Mistral · free vision', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', hint: 'free key at console.mistral.ai → API Keys · phone verification needed · auto-waits the free-tier bouncer' },
  { name: 'OpenRouter · free vision', base: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-31b-it:free', hint: 'free key at openrouter.ai/keys · auto-hops 6 free lanes if one is busy' },
  { name: 'Groq · paste only',       base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', hint: 'free key at console.groq.com · paste/history text only (Groq dropped vision in 2026)' },
  { name: 'OpenAI',                 base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hint: 'paid · platform.openai.com' },
  { name: 'Custom',                 base: '', model: '', hint: 'any OpenAI-compatible endpoint' },
];

const XP_PER_TRADE = 50, XP_ALL_RULES = 25, XP_LESSON = 15, XP_SCREENSHOT = 10;

const BADGES = [
  { id: 'first',    emoji: '🎖️', name: 'First Entry',   desc: 'Log your first trade',                test: s => s.count >= 1 },
  { id: 'win1',     emoji: '💰', name: 'First Blood',   desc: 'Bank your first win',                 test: s => s.wins >= 1 },
  { id: 'hat3',     emoji: '🎯', name: 'Sniper',        desc: '3 wins in a row',                     test: s => s.bestWinStreak >= 3 },
  { id: 'shots10',  emoji: '📸', name: 'Archivist',     desc: 'Attach 10 chart screenshots',         test: s => s.shots >= 10 },
  { id: 'auto10',   emoji: '🪄', name: 'Autopilot',     desc: 'AUTO-FILL 10 trades',                 test: s => s.imported >= 10 },
  { id: 'lab5',     emoji: '🧪', name: 'Lab Rat',       desc: '5+ trades on one setup',              test: s => s.maxSetupN >= 5 },
  { id: 'tp10',     emoji: '🏹', name: 'Plan Keeper',   desc: 'Hit planned TP on 10 trades',         test: s => s.tpHits >= 10 },
  { id: 'streak3',  emoji: '🔥', name: 'Warming Up',    desc: '3-day journaling streak',             test: s => s.streak >= 3 },
  { id: 'streak7',  emoji: '🚀', name: 'Unstoppable',   desc: '7-day journaling streak',             test: s => s.streak >= 7 },
  { id: 'zen5',     emoji: '🧘', name: 'Zen Trader',    desc: '5 trades at 100% discipline',         test: s => s.perfectTrades >= 5 },
  { id: 'shield',   emoji: '🛡️', name: 'Risk Guardian',  desc: '10 trades risking ≤ 2%',             test: s => s.lowRiskTrades >= 10 },
  { id: 'scholar',  emoji: '📚', name: 'Scholar',       desc: 'Write 5 lessons',                     test: s => s.lessons >= 5 },
  { id: 'pf2',      emoji: '🏆', name: 'Edge Proven',   desc: 'Profit factor ≥ 2 (10+ trades)',      test: s => s.pf >= 2 && s.count >= 10 },
  { id: 'grinder',  emoji: '💼', name: 'Grinder',       desc: '50 trades logged',                    test: s => s.count >= 50 },
  { id: 'multi',    emoji: '🏦', name: 'Mogul',         desc: 'Run 2+ accounts in one journal',      test: s => s.profiles >= 2 },
];

/* ---------------- State ---------------- */
const S = {
  trades: [],
  profiles: [],
  settings: { rules: DEFAULT_RULES.slice(), ai: {} },
  view: localStorage.getItem('mj_view') || 'all',
  page: 'dashboard',
  calCursor: 0,
  calSelected: null,
  filters: { q: '', outcome: 'all' },
  galCat: 'All',
  galOutcome: 'all',
  lbIndex: 0,
  af: { method: null, images: [], text: '', hint: '', drafts: null, busy: false, status: '' },
};

const $  = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const round2 = n => Math.round(n * 100) / 100;
const money = (v, sign = true) => {
  if (v == null) return '—';
  const abs = '$' + Math.abs(v).toFixed(2);
  if (!sign) return abs;
  return (v > 0 ? '+' : v < 0 ? '-' : '') + abs;
};
const ptsFmt = v => v == null ? '—' : (v > 0 ? '+' : '') + round2(v);
const dayKey = d => d.toISOString().slice(0, 10);
const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : 'neu';
const outcomeOf = t => t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'be';
const dirSign = t => t.dir === 'short' ? -1 : 1;
const aiReady = () => !!(S.settings.ai && S.settings.ai.configured);

/* ---------------- hold duration ---------------- */
function holdMs(t) {
  if (!t.closedAt) return null;
  const ms = new Date(t.closedAt) - new Date(t.date);
  return ms > 0 ? ms : null;
}
function holdFmt(ms) {
  if (ms == null) return null;
  const m = Math.round(ms / 60000);
  if (m < 60) return m + 'm';
  if (m < 1440) { const h = Math.floor(m / 60); return h + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : ''); }
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d + 'd' + (h ? ' ' + h + 'h' : '');
}
function blockFromHour(h) { return h >= 5 && h < 11 ? 'Morning' : h >= 11 && h < 16 ? 'Midday' : h >= 16 && h < 23 ? 'Evening' : 'Late night'; }

/* ---------------- Profiles helpers ---------------- */
const profileById = id => S.profiles.find(p => p.id === id);
const viewTrades = () => S.view === 'all' ? S.trades : S.trades.filter(t => t.profileId === S.view);
const totalBalance = () => S.profiles.reduce((a, p) => a + (p.balance || 0), 0);
const viewBalance = () => S.view === 'all' ? totalBalance() : (profileById(S.view) || {}).balance || 0;
const activeProfile = () => profileById(S.view);
const viewLabel = () => S.view === 'all'
  ? '🌐 All accounts' + (S.profiles.length > 1 ? ` · ${S.profiles.length}` : '')
  : (p => p ? `${p.emoji} ${p.name}` : '🌐 All accounts')(activeProfile());
const acctName = id => { const p = profileById(id); return p ? `${p.emoji} ${p.name}` : '—'; };

window.setView = v => {
  S.view = v;
  localStorage.setItem('mj_view', v);
  S.calSelected = null;
  renderAll();
};

/* ---------------- API ---------------- */
async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.message || 'API ' + res.status); e.code = j.error; throw e; }
  return j;
}

/* ---------------- Instrument math ---------------- */
const isSynthetic = sym => /^(Volatility|Boom|Crash|Step|Jump|Range|DEX|Multi|Drift|Hybrid|Accumulator|FX\s?Vol(atility)?|FXVol)/i.test(String(sym || '').trim());
function pointSize(pair) {
  if (isSynthetic(pair)) return 1;
  pair = String(pair).toUpperCase().replace('/', '');
  if (pair.includes('JPY')) return 0.01;
  if (pair.startsWith('XAU')) return 0.1;
  if (pair.startsWith('XAG')) return 0.01;
  if (/^(US30|NAS100|SPX|GER|UK100)/.test(pair)) return 1;
  return 0.0001;
}
function pointValuePerLot(pair) {
  if (isSynthetic(pair)) return 1;
  pair = String(pair).toUpperCase().replace('/', '');
  if (pair.startsWith('XAU')) return 10;
  if (pair.startsWith('XAG')) return 50;
  if (/^(US30|NAS100|SPX|GER|UK100)/.test(pair)) return 1;
  const quote = pair.slice(-3);
  if (quote === 'USD') return 10;
  if (quote === 'JPY') return 6.7;
  return { GBP: 12.7, EUR: 10.8, AUD: 6.6, NZD: 6.0, CAD: 7.3, CHF: 11.3 }[quote] || 10;
}
const distToUsd = (pair, dist, lots) => round2(dist / pointSize(pair) * (lots || 0) * pointValuePerLot(pair));

function computeNumbers(f) {
  const pair = (f.pair || '').trim();
  const lots = num(f.lots), entry = num(f.entry), exit = num(f.exit);
  const out = { pips: null, pnlEstimated: null, riskAmount: null, rMultiple: null, rrPlanned: null };
  if (!pair || lots == null || entry == null) return out;
  // plan pricing works even with no exit yet — a running leg still shows its $-at-risk & planned R:R
  const sl = num(f.sl);
  if (sl != null) out.riskAmount = distToUsd(pair, Math.abs(entry - sl), lots);
  const tp = num(f.tp);
  if (sl != null && tp != null && Math.abs(entry - sl) > 0) {
    out.rrPlanned = round2(Math.abs(tp - entry) / Math.abs(entry - sl) * 100) / 100;
  }
  if (exit == null) return out; // 🏃 still running — outcome math waits for the close
  const dir = f.dir === 'short' ? -1 : 1;
  const diff = (exit - entry) * dir;
  out.pips = round2(diff / pointSize(pair) * 10) / 10;
  out.pnlEstimated = distToUsd(pair, diff, lots);
  const finalPnl = (f.pnlOverride !== '' && f.pnlOverride != null && f.pnlOverride !== undefined) ? num(f.pnlOverride) : (f.pnl != null ? num(f.pnl) : out.pnlEstimated);
  if (out.riskAmount && out.riskAmount > 0 && finalPnl != null) {
    out.rMultiple = round2(finalPnl / out.riskAmount * 100) / 100;
  }
  return out;
}

/* ---------------- Plan vs Actual ---------------- */
function planMetrics(t) {
  const m = {};
  const d = dirSign(t);
  const entry = t.entry, exit = t.exit;
  if (t.tp != null && entry != null && exit != null) {
    const plannedReward = Math.abs(t.tp - entry);
    if (plannedReward > 0) {
      m.pctCaptured = Math.round((exit - entry) * d / plannedReward * 100);
      m.reachedTP = t.pnl > 0 && m.pctCaptured >= 98;
      m.overTP = t.pnl > 0 && m.pctCaptured > 105;
      const missed = (t.tp - exit) * d;
      if (missed > 0 && t.pnl > 0) m.leftOnTable = distToUsd(t.pair, missed, t.lots || 0);
    }
  }
  if (t.sl != null && t.actualSL != null && t.actualSL !== t.sl) {
    m.slMoved = true;
    m.slWorse = t.dir === 'long' ? t.actualSL < t.sl : t.actualSL > t.sl;
  }
  if (t.sl != null && entry != null && exit != null && t.pnl < 0) {
    const plannedRisk = Math.abs(entry - t.sl);
    const lossDist = (entry - exit) * d;
    if (plannedRisk > 0) {
      m.bledPastStop = lossDist > plannedRisk * 1.05;
      m.cutBeforeStop = lossDist < plannedRisk * 0.8;
    }
  }
  if (t.plannedEntry != null && entry != null && Math.abs(entry) > 0) {
    const driftPts = (entry - t.plannedEntry) * d / pointSize(t.pair);
    m.entryDriftPts = round2(driftPts * 10) / 10;
    m.chasedEntry = (entry - t.plannedEntry) * d / Math.abs(entry) > 0.0005;
  }
  return m;
}
function planFlags(t) {
  const m = planMetrics(t);
  const flags = [];
  if (m.reachedTP) flags.push(['ok', '🎯 TP hit']);
  else if (m.overTP) flags.push(['ok', `🚀 +${m.pctCaptured}% of plan`]);
  else if (m.pctCaptured != null && t.pnl > 0) flags.push(['warn', `🎯 ${m.pctCaptured}% of plan`]);
  if (m.leftOnTable != null && m.leftOnTable > 0) flags.push(['warn', `💸 left ${money(m.leftOnTable, false)}`]);
  if (m.slMoved) flags.push([m.slWorse ? 'bad' : 'ok', m.slWorse ? '🚨 SL moved away' : '🧲 SL trailed']);
  if (m.bledPastStop) flags.push(['bad', '🩸 bled past stop']);
  if (m.chasedEntry) flags.push(['warn', `🏃 chased entry ${m.entryDriftPts > 0 ? '+' : ''}${m.entryDriftPts} pts`]);
  return flags;
}

/* ---------------- Stats ---------------- */
function calcStats(t, startBal) {
  t = [...t].sort((a, b) => a.date.localeCompare(b.date));
  const s = {
    count: t.length, wins: 0, losses: 0, bes: 0,
    pnlTotal: 0, pipsTotal: 0, grossWin: 0, grossLoss: 0,
    bestPnl: null, worstPnl: null, maxDD: 0, pf: 0, expectancy: 0,
    winRate: 0, avgWin: 0, avgLoss: 0, avgR: null, payoff: 0,
    bestWinStreak: 0, curWinStreak: 0, streak: 0,
    perfectTrades: 0, lowRiskTrades: 0, lessons: 0, xp: 0,
    shots: 0, tpHits: 0, imported: 0, maxSetupN: 0,
    rList: [], profiles: S.profiles.length,
    plan: { tpSet: 0, tpHit: 0, capturedSum: 0, capturedN: 0, leftTotal: 0, slMoved: 0, slWorse: 0, bled: 0, chased: 0 },
  };
  let equity = startBal || 0, peak = equity, ws = 0;
  const days = new Set();
  const setupCount = {};
  t.forEach(tr => {
    const p = tr.pnl || 0;
    s.pnlTotal += p; s.pipsTotal += tr.pips || 0;
    const o = outcomeOf(tr);
    if (o === 'win') { s.wins++; s.grossWin += p; ws++; s.bestWinStreak = Math.max(s.bestWinStreak, ws); }
    else if (o === 'loss') { s.losses++; s.grossLoss += Math.abs(p); ws = 0; }
    else s.bes++;
    s.curWinStreak = ws;
    if (s.bestPnl == null || p > s.bestPnl) s.bestPnl = p;
    if (s.worstPnl == null || p < s.worstPnl) s.worstPnl = p;
    equity += p; peak = Math.max(peak, equity);
    s.maxDD = Math.max(s.maxDD, peak - equity);
    if (tr.rMultiple != null) s.rList.push(tr.rMultiple);
    const rv = Object.values(tr.rules || {});
    if (rv.length && rv.every(Boolean)) s.perfectTrades++;
    if (tr.riskPct != null && tr.riskPct > 0 && tr.riskPct <= 2) s.lowRiskTrades++;
    if (tr.lesson && tr.lesson.trim()) s.lessons++;
    s.shots += (tr.screenshots || []).length;
    if (tr.imported) s.imported++;
    setupCount[(tr.setup || '').trim() || '(no setup)'] = (setupCount[(tr.setup || '').trim() || '(no setup)'] || 0) + 1;
    const m = planMetrics(tr);
    if (tr.tp != null) { s.plan.tpSet++; if (m.reachedTP) { s.plan.tpHit++; s.tpHits++; } }
    if (m.pctCaptured != null && tr.pnl > 0) { s.plan.capturedSum += Math.min(m.pctCaptured, 300); s.plan.capturedN++; }
    if (m.leftOnTable) s.plan.leftTotal = round2(s.plan.leftTotal + m.leftOnTable);
    if (m.slMoved) { s.plan.slMoved++; if (m.slWorse) s.plan.slWorse++; }
    if (m.bledPastStop) s.plan.bled++;
    if (m.chasedEntry) s.plan.chased++;
    days.add(tr.date.slice(0, 10));
  });
  s.maxSetupN = Math.max(0, ...Object.values(setupCount));
  s.pnlTotal = round2(s.pnlTotal); s.pipsTotal = round2(s.pipsTotal * 10) / 10;
  s.winRate = s.count ? round2(s.wins / s.count * 1000) / 10 : 0;
  s.pf = s.grossLoss > 0 ? round2(s.grossWin / s.grossLoss * 100) / 100 : (s.grossWin > 0 ? Infinity : 0);
  s.expectancy = s.count ? round2(s.pnlTotal / s.count) : 0;
  s.avgWin = s.wins ? round2(s.grossWin / s.wins) : 0;
  s.avgLoss = s.losses ? round2(s.grossLoss / s.losses) : 0;
  s.payoff = s.avgLoss > 0 ? round2(s.avgWin / s.avgLoss * 100) / 100 : 0;
  s.avgR = s.rList.length ? round2(s.rList.reduce((a, b) => a + b, 0) / s.rList.length * 100) / 100 : null;
  s.xp = t.reduce((a, tr) => a + tradeXP(tr), 0);
  const d = new Date(); const has = k => days.has(k);
  if (!has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (has(dayKey(d))) { s.streak++; d.setDate(d.getDate() - 1); }
  return s;
}

function tradeXP(tr) {
  let xp = XP_PER_TRADE;
  const rv = Object.values(tr.rules || {});
  if (rv.length && rv.every(Boolean)) xp += XP_ALL_RULES;
  if (tr.lesson && tr.lesson.trim()) xp += XP_LESSON;
  if ((tr.screenshots || []).length) xp += XP_SCREENSHOT;
  return xp;
}
function levelFor(xp) {
  let cur = LEVELS[0], next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) cur = LEVELS[i];
    else { next = LEVELS[i]; break; }
  }
  return { cur, next };
}
function byDim(trades, key) {
  const m = new Map();
  trades.forEach(t => {
    const k = (typeof key === 'function' ? key(t) : t[key]) || '—';
    if (!m.has(k)) m.set(k, { n: 0, pnl: 0, wins: 0 });
    const r = m.get(k); r.n++; r.pnl += t.pnl || 0; if (t.pnl > 0) r.wins++;
  });
  return [...m.entries()].map(([k, v]) => ({ k, ...v, pnl: round2(v.pnl), wr: v.n ? Math.round(v.wins / v.n * 100) : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

/* ---------------- Setup Lab ---------------- */
function setupRows(t) {
  const map = new Map();
  t.forEach(tr => {
    if (tr.running) return; // runners haven't told their story yet — the Lab grades closed books only
    const k = (tr.setup || '').trim() || '(no setup)';
    if (!map.has(k)) map.set(k, { name: k, n: 0, wins: 0, pnl: 0, rW: [], rL: [], rrP: [], holds: [], holdsW: [], holdsL: [], tf: {}, pairPnl: {}, losers: [], winners: [] });
    const r = map.get(k);
    r.n++; r.pnl = round2(r.pnl + (tr.pnl || 0));
    const w = tr.pnl > 0;
    if (w) r.wins++;
    if (tr.rMultiple != null) (w ? r.rW : r.rL).push(tr.rMultiple);
    if (tr.rrPlanned != null && isFinite(tr.rrPlanned) && tr.rrPlanned > 0) r.rrP.push(tr.rrPlanned);
    const h = holdMs(tr);
    if (h != null) { r.holds.push(h); (w ? r.holdsW : r.holdsL).push(h); }
    if (tr.analysisTF && tr.executionTF) {
      const tfk = tr.analysisTF + '→' + tr.executionTF;
      r.tf[tfk] = (r.tf[tfk] || 0) + 1;
    }
    r.pairPnl[tr.pair] = round2((r.pairPnl[tr.pair] || 0) + (tr.pnl || 0));
    (w ? r.winners : r.losers).push(tr);
  });
  return [...map.values()].map(r => {
    const tfKeys = Object.entries(r.tf).sort((a, b) => b[1] - a[1]);
    const bestPair = Object.entries(r.pairPnl).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])[0];
    const grossWinR = r.rW.reduce((a, b) => a + b, 0);
    const grossLossR = Math.abs(r.rL.reduce((a, b) => a + b, 0));
    return {
      ...r,
      wr: r.n ? Math.round(r.wins / r.n * 100) : 0,
      avgR: (r.rW.length + r.rL.length) ? round2((r.rW.concat(r.rL).reduce((a, b) => a + b, 0)) / (r.rW.length + r.rL.length) * 100) / 100 : null,
      achievedRR: r.rW.length && r.rL.length && Math.abs(r.rL.reduce((a, b) => a + b, 0)) > 0
        ? '1 : ' + Math.round((r.rW.reduce((a, b) => a + b, 0) / r.rW.length) / Math.abs(r.rL.reduce((a, b) => a + b, 0) / r.rL.length) * 10) / 10
        : null,
      avgPlannedRR: r.rrP.length ? '1 : ' + Math.round(r.rrP.reduce((a, b) => a + b, 0) / r.rrP.length * 10) / 10 : null,
      overallRR: (r.rW.length + r.rL.length)
        ? (grossLossR > 0 ? '1 : ' + Math.round(grossWinR / grossLossR * 10) / 10 : (grossWinR > 0 ? '1 : ∞' : null))
        : null,
      overallRRnum: grossLossR > 0 ? grossWinR / grossLossR : (grossWinR > 0 ? 99 : 0),
      totalR: (r.rW.length + r.rL.length) ? round2(grossWinR - grossLossR) : null,
      avgHold: r.holds.length ? r.holds.reduce((a, b) => a + b, 0) / r.holds.length : null,
      avgHoldW: r.holdsW.length ? r.holdsW.reduce((a, b) => a + b, 0) / r.holdsW.length : null,
      avgHoldL: r.holdsL.length ? r.holdsL.reduce((a, b) => a + b, 0) / r.holdsL.length : null,
      tfLabel: tfKeys.length ? tfKeys[0][0] : null,
      bestOn: bestPair && bestPair[1] > 0 ? bestPair[0] : null,
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

function failureFingerprints(rows) {
  const out = [];
  rows.forEach(r => {
    if (r.losers.length < 3) return;
    const bits = [];
    const mist = {};
    r.losers.forEach(t => (t.mistakes || []).forEach(m => mist[m] = (mist[m] || 0) + 1));
    const topMist = Object.entries(mist).sort((a, b) => b[1] - a[1])[0];
    if (topMist && topMist[1] >= 2) bits.push(`<b>${Math.round(topMist[1] / r.losers.length * 100)}%</b> tagged “${esc(topMist[0])}”`);
    const neg = r.losers.filter(t => /fomo|revenge|anxious|tired|bored/.test(t.emotionBefore || '')).length;
    if (neg / r.losers.length >= 0.5) bits.push(`<b>${Math.round(neg / r.losers.length * 100)}%</b> entered in a negative headspace (FOMO/revenge/tired/anxious)`);
    const chased = r.losers.filter(t => planMetrics(t).chasedEntry).length;
    if (chased >= 2) bits.push(`<b>${chased}×</b> chased entries`);
    const moved = r.losers.filter(t => planMetrics(t).slWorse).length;
    if (moved >= 2) bits.push(`<b>${moved}×</b> widened the stop`);
    const bled = r.losers.filter(t => planMetrics(t).bledPastStop).length;
    if (bled >= 2) bits.push(`<b>${bled}×</b> bled past the planned stop`);
    const blocks = {};
    r.losers.forEach(t => { if (t.session) blocks[t.session] = (blocks[t.session] || 0) + 1; });
    const tb = Object.entries(blocks).sort((a, b) => b[1] - a[1])[0];
    if (tb && tb[1] / r.losers.length >= 0.6) bits.push(`<b>${Math.round(tb[1] / r.losers.length * 100)}%</b> happened ${tb[0].toLowerCase()}`);
    if (r.avgHoldW != null && r.avgHoldL != null && Math.abs(r.avgHoldW - r.avgHoldL) > 1800000) {
      bits.push(`losers held <b>${holdFmt(r.avgHoldL)}</b> vs winners <b>${holdFmt(r.avgHoldW)}</b> — your exits are backwards here`);
    }
    if (bits.length) out.push({ name: r.name, tf: r.tfLabel, n: r.losers.length, bits });
  });
  return out;
}

function holdBuckets(t) {
  const defs = [[3600000, 'under 1h'], [4 * 3600000, '1–4h'], [12 * 3600000, '4–12h'], [24 * 3600000, '12–24h'], [72 * 3600000, '1–3 days'], [Infinity, '3 days+']];
  const rows = defs.map(([lim, k]) => ({ k, n: 0, wins: 0, pnl: 0, lim }));
  t.forEach(tr => {
    const h = holdMs(tr);
    if (h == null) return;
    const b = rows.find(r => h <= r.lim);
    b.n++; b.pnl = round2(b.pnl + (tr.pnl || 0)); if (tr.pnl > 0) b.wins++;
  });
  return rows.filter(r => r.n > 0).map(r => ({ ...r, wr: Math.round(r.wins / r.n * 100) }));
}

/* ---------------- Insights ---------------- */
function genInsights(s, t) {
  const out = [];
  if (t.length < 3) return out;
  const lab = setupRows(t);
  const flag = lab.filter(r => r.n >= 4 && r.avgR != null && r.avgR > 0.3).sort((a, b) => b.avgR - a.avgR)[0];
  if (flag) {
    out.push({ emoji: '🏹', text: `<b>${esc(flag.name)}${flag.tfLabel ? ' · ' + esc(flag.tfLabel) : ''}</b> is your flagship: ${flag.wr}% win, <b class="pos">+${flag.avgR}R</b> avg${flag.achievedRR ? `, achieved ${flag.achievedRR}` : ''}${flag.avgHold ? `, held ~<b>${holdFmt(flag.avgHold)}</b>` : ''} over ${flag.n} trades.` });
  }
  const weak = lab.filter(r => r.n >= 4 && ((r.avgR != null && r.avgR < -0.2) || r.wr < 35)).sort((a, b) => a.pnl - b.pnl)[0];
  if (weak) {
    out.push({ emoji: '🧯', text: `<b>${esc(weak.name)}</b> is your struggler: ${weak.wr}% win over ${weak.n} trades (${money(weak.pnl)}). Fix it, shrink it, or shelf it.` });
  }
  const blocks = byDim(t, 'session').filter(r => r.n >= 2);
  if (blocks.length >= 2) {
    const best = blocks[0], worst = blocks[blocks.length - 1];
    if (best.pnl > 0) out.push({ emoji: '🕐', text: `<b>${esc(best.k)}</b> is your golden window: ${money(best.pnl)} across ${best.n} trades (${best.wr}% win rate).` });
    if (worst.pnl < 0) out.push({ emoji: '⚠️', text: `<b>${esc(worst.k)}</b> trading is bleeding you: ${money(worst.pnl)} across ${worst.n} trades. The market is 24/7 — maybe <i>you</i> shouldn't be.` });
  }
  const hi = t.filter(x => { const r = Object.values(x.rules || {}); return r.length && r.filter(Boolean).length / r.length >= 0.8; });
  const lo = t.filter(x => { const r = Object.values(x.rules || {}); return r.length && r.filter(Boolean).length / r.length < 0.5; });
  if (hi.length >= 2 && lo.length >= 2) {
    const avg = a => a.reduce((x, y) => x + (y.pnl || 0), 0) / a.length;
    out.push({ emoji: '🧠', text: `Following ≥80% of your rules averages <b class="pos">${money(round2(avg(hi)))}</b>/trade vs <b class="neg">${money(round2(avg(lo)))}</b> below 50%. Discipline <i>is</i> the edge.` });
  }
  if (s.plan.capturedN >= 3) {
    const avgCap = Math.round(s.plan.capturedSum / s.plan.capturedN);
    if (avgCap < 80 && s.plan.leftTotal > 0) out.push({ emoji: '🎯', text: `You capture only <b>${avgCap}%</b> of planned targets — <b class="neg">${money(-s.plan.leftTotal, false)}</b> left on the table. Your exits cut winners short.` });
  }
  if (s.plan.slWorse >= 2) out.push({ emoji: '🚨', text: `Stop widened <b>${s.plan.slWorse}×</b> after entry. Hope is not a strategy — the stop was part of the plan.` });
  if (s.shots === 0 && s.count >= 3) out.push({ emoji: '📸', text: `No screenshots yet. Your future self can't review what it can't see — and AUTO-FILL can read your history shots for you 🪄.` });
  if (S.view === 'all' && S.profiles.length > 1) {
    const acc = byDim(t, x => acctName(x.profileId));
    if (acc.length >= 2) out.push({ emoji: '🏦', text: `Best account: <b>${esc(acc[0].k)}</b> (${money(acc[0].pnl)}). Weakest: <b>${esc(acc[acc.length - 1].k)}</b> (${money(acc[acc.length - 1].pnl)}). Same trader — ask why.` });
  }
  if (s.maxDD > 0 && s.count >= 5) out.push({ emoji: '🌊', text: `Max drawdown in this view: <b class="neg">${money(-s.maxDD, false)}</b>. Know your number, size for it.` });
  return out.slice(0, 5);
}

/* ---------------- Render: header + profile bar ---------------- */
function renderHeader(g) {
  const { cur, next } = levelFor(g.xp);
  $('#levelEmoji').textContent = cur.emoji;
  $('#levelName').textContent = cur.name;
  const base = cur.xp, span = next ? next.xp - base : 1;
  $('#xpFill').style.width = (next ? Math.min(100, (g.xp - base) / span * 100) : 100) + '%';
  $('#xpText').textContent = next ? `${g.xp} XP · ${next.xp - g.xp} to ${next.name}` : `${g.xp} XP · MAX LEVEL`;
  $('#streakVal').textContent = g.streak;
  $('#streakChip').classList.toggle('hot', g.streak >= 3);
}
function renderProfileBar() {
  $('#profileBar').innerHTML = `
    <button class="pchip ${S.view === 'all' ? 'active' : ''}" onclick="setView('all')">🌐 <span>All accounts</span></button>
    ${S.profiles.map(p => `
      <button class="pchip ${S.view === p.id ? 'active' : ''}" onclick="setView('${p.id}')">
        <span>${p.emoji || '💼'}</span><span>${esc(p.name)}</span>${p.broker ? `<span class="ptype">${esc(p.broker)}</span>` : ''}
      </button>`).join('')}
    <button class="pchip pchip-new" onclick="openProfileForm()">＋ New account</button>`;
}

/* ---------------- Render: dashboard ---------------- */
function renderDashboard(v, g, t) {
  const el = $('#page-dashboard');
  const bal = viewBalance();
  if (!S.trades.length) {
    el.innerHTML = `
      <div class="page-title">Welcome to Mo's Journal ✨</div>
      <div class="empty">
        <div class="big">📈</div>
        <b>No trades yet — your story starts here.</b><br><br>
        Log manually, or let the <b>🪄 AUTO-FILL</b> read your broker history & screenshots for you.<br><br>
        <button class="btn btn-primary btn-lg" onclick="openAddChooser()">＋ Add my first trade</button>
      </div>
      ${badgesCard(g)}
      <div class="footer-note">Synced across your devices ☁️ · Everything saves automatically</div>`;
    return;
  }
  if (!t.length) {
    el.innerHTML = `
      <div class="page-title">${viewLabel()} <small>nothing here yet</small></div>
      <div class="empty"><div class="big">🫧</div><b>No trades in this account yet.</b><br><br>
        <button class="btn btn-primary btn-lg" onclick="openAddChooser()">＋ Add a trade</button>
      </div>
      ${badgesCard(g)}`;
    return;
  }
  const eq = bal + v.pnlTotal;
  const insights = genInsights(v, t);
  const recent = [...t].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  el.innerHTML = `
    <div class="page-title">Dashboard <small>${viewLabel()} · ${eqLabel()}</small></div>
    <div class="grid cols-4">
      ${stat('Total P&L', money(v.pnlTotal), cls(v.pnlTotal), v.count + ' trades · ' + ptsFmt(v.pipsTotal) + ' pts')}
      ${stat('Win rate', v.winRate + '%', v.winRate >= 50 ? 'pos' : 'neu', v.wins + 'W / ' + v.losses + 'L / ' + v.bes + 'BE')}
      ${stat('Profit factor', v.pf === Infinity ? '∞' : v.pf, v.pf >= 1.5 ? 'pos' : v.pf < 1 ? 'neg' : 'neu', 'Expectancy ' + money(v.expectancy))}
      ${stat('Account equity', money(round2(eq), false), '', 'Started ' + money(bal, false))}
    </div>
    ${accountsCard()}
    ${planCard(v, true)}
    <div class="card mt">
      <div class="card-title">📈 Equity curve <span class="sub">${viewLabel()} · max DD <span class="neg">${money(-v.maxDD, false)}</span></span></div>
      <canvas id="equityChart" style="width:100%;height:220px"></canvas>
    </div>
    ${insights.length ? `<div class="card"><div class="card-title">🪞 Mo's Mirror <span class="sub">what your data is telling you</span></div>
      ${insights.slice(0, 2).map(i => `<div class="insight"><span class="i-emoji">${i.emoji}</span><span>${i.text}</span></div>`).join('')}
      <button class="btn btn-ghost btn-block" onclick="go('analytics')">See all insights →</button></div>` : ''}
    ${badgesCard(g)}
    <div class="card">
      <div class="card-title">🕒 Recent trades <button class="btn btn-ghost" style="margin-left:auto;padding:5px 12px;font-size:12px" onclick="go('journal')">View all →</button></div>
      ${recent.map(tradeCard).join('')}
    </div>
    <div class="footer-note">Synced across your devices ☁️ · Log on phone, study on PC</div>`;
  requestAnimationFrame(() => drawEquityChart(t, bal));
}

function planCard(v, compact) {
  if (v.plan.tpSet < 2 && v.plan.slMoved === 0 && v.plan.chased === 0) return '';
  const avgCap = v.plan.capturedN ? Math.round(v.plan.capturedSum / v.plan.capturedN) : null;
  const tpRate = v.plan.tpSet ? Math.round(v.plan.tpHit / v.plan.tpSet * 100) : null;
  const row = (k, val) => `<div class="bar-row"><div class="lbl" style="width:150px;min-width:150px">${k}</div>
    <div class="bar-val" style="width:auto;text-align:left">${val}</div></div>`;
  return `<div class="card"><div class="card-title">🎯 Plan vs Actual <span class="sub">${compact ? 'tap Stats for the full picture' : 'did you follow YOUR plan?'}</span></div>
    ${tpRate != null ? row('Reached planned TP', `<b>${v.plan.tpHit}/${v.plan.tpSet}</b> trades (${tpRate}%)`) : ''}
    ${avgCap != null ? row('Avg target captured', `<b class="${avgCap >= 80 ? 'pos' : avgCap < 55 ? 'neg' : ''}">${avgCap}%</b>`) : ''}
    ${v.plan.leftTotal > 0 ? row('Left on the table', `<b class="neg">${money(-v.plan.leftTotal, false)}</b> — early exits on winners`) : ''}
    ${v.plan.slMoved ? row('Stop-loss moved', `<b>${v.plan.slMoved}×</b> · ${v.plan.slWorse} widened 🚨`) : ''}
    ${v.plan.bled ? row('Bled past stop', `<b class="neg">${v.plan.bled}×</b> — lost more than planned`) : ''}
    ${v.plan.chased ? row('Chased entries', `<b>${v.plan.chased}×</b> entered worse than planned`) : ''}
  </div>`;
}

function accountsCard() {
  if (S.view !== 'all' || S.profiles.length < 2) return '';
  const rows = S.profiles.map(p => {
    const tt = S.trades.filter(x => x.profileId === p.id);
    return { p, st: calcStats(tt, p.balance || 0) };
  }).sort((a, b) => b.st.pnlTotal - a.st.pnlTotal);
  return `<div class="card"><div class="card-title">🏦 Head-to-head <span class="sub">tap an account to zoom in</span></div>
    ${rows.map(({ p, st }) => `
      <div class="rule-row acct-tap" onclick="setView('${p.id}')">
        <span class="tick">${p.emoji || '💼'}</span>
        <span style="flex:1"><b>${esc(p.name)}</b> <span class="ptype">${esc(p.broker || p.type || '')}</span><br>
          <span style="font-size:11px;color:var(--muted)">${st.count} trades · ${st.winRate}% win · equity ${money(round2((p.balance || 0) + st.pnlTotal), false)}</span></span>
        <span class="mono ${cls(st.pnlTotal)}" style="font-weight:800">${money(st.pnlTotal)}</span>
      </div>`).join('')}
  </div>`;
}

function eqLabel() { return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function stat(k, v, c, sub) {
  return `<div class="stat"><div class="k">${k}</div><div class="v mono ${c || ''}">${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
}
function badgesCard(g) {
  const earned = BADGES.filter(b => b.test(g)).length;
  return `<div class="card"><div class="card-title">🏅 Badges <span class="sub">${earned}/${BADGES.length} unlocked · trader-wide</span></div>
    <div class="badge-grid">
      ${BADGES.map(b => { const ok = b.test(g); return `
        <div class="badge ${ok ? 'earned' : 'locked'}">
          <div class="b-emoji">${b.emoji}</div><div class="b-name">${b.name}</div><div class="b-desc">${b.desc}</div>
        </div>`; }).join('')}
    </div></div>`;
}

function tradeCard(t) {
  const rv = Object.values(t.rules || {});
  const disc = rv.length ? Math.round(rv.filter(Boolean).length / rv.length * 100) : null;
  const emoB = (EMOTIONS_BEFORE.find(e => e[0] === t.emotionBefore) || [])[1] || '';
  const prof = S.view === 'all' ? profileById(t.profileId) : null;
  const flags = planFlags(t);
  const shots = t.screenshots || [];
  const hold = holdFmt(holdMs(t));
  const tfCombo = t.analysisTF ? `${t.analysisTF}${t.executionTF ? '→' + t.executionTF : ''}` : null;
  return `<div class="trade-card" onclick="openTradeForm('${t.id}')">
    <div class="tc-top">
      <span class="tc-pair">${esc(t.pair)}</span>
      <span class="tc-dir ${t.dir}">${t.dir === 'long' ? '▲ BUY' : '▼ SELL'}</span>
      ${prof ? `<span class="tc-tag" style="padding:3px 8px">${prof.emoji || '💼'} ${esc(prof.name)}</span>` : ''}
      ${disc != null ? `<span class="disc-ring" style="background:${disc === 100 ? 'var(--lime-dim)' : 'var(--card2)'};color:${disc === 100 ? 'var(--lime)' : 'var(--muted)'}">${disc}%</span>` : ''}
      <span class="tc-date">${fmtDate(t.date)}</span>
      ${t.running
        ? `<span class="tc-pnl mono" style="color:var(--gold)">🏃 running</span>`
        : `<span class="tc-pnl mono ${cls(t.pnl)}">${money(t.pnl)}</span>`}
    </div>
    <div class="tc-meta">
      <span class="tc-tag">${ptsFmt(t.pips)} pts</span>
      ${t.rMultiple != null ? `<span class="tc-tag">${t.rMultiple > 0 ? '+' : ''}${t.rMultiple}R</span>` : ''}
      ${hold ? `<span class="tc-tag">⏱ ${hold}</span>` : ''}
      ${t.session ? `<span class="tc-tag">🕐 ${esc(t.session)}</span>` : ''}
      ${t.setup ? `<span class="tc-tag hl">⚡ ${esc(t.setup)}${tfCombo ? ' · ' + tfCombo : ''}</span>` : ''}
      ${emoB ? `<span class="tc-tag">${emoB}</span>` : ''}
      ${(t.mistakes || []).length ? `<span class="tc-tag">⚠️ ${t.mistakes.length} mistake${t.mistakes.length > 1 ? 's' : ''}</span>` : ''}
      ${t.lesson ? `<span class="tc-tag">📚 lesson</span>` : ''}
      ${shots.length ? `<span class="tc-tag">📸 ${shots.length}</span>` : ''}
      ${t.wave ? `<span class="tc-tag" style="color:var(--gold)">🌊 ${esc(t.wave)}</span>` : ''}
      ${t.running && t.rrPlanned != null ? `<span class="tc-tag" style="color:var(--gold)">🎯 plan 1:${t.rrPlanned}</span>` : ''}
      ${t.imported ? `<span class="tc-tag">🪄 auto-filled</span>` : ''}
    </div>
    ${flags.length ? `<div class="tc-meta">${flags.map(([c, txt]) => `<span class="plan-flag ${c}">${txt}</span>`).join('')}</div>` : ''}
    ${t.lesson ? `<div class="tc-lesson">“${esc(t.lesson).slice(0, 120)}${t.lesson.length > 120 ? '…' : ''}”</div>` : ''}
    ${shots.length ? `<div class="tc-shots" onclick="event.stopPropagation()">${shots.slice(0, 3).map((sh, i) =>
      `<img src="${sh.url}" loading="lazy" onclick="openLightboxFor('${t.id}',${i})" alt="">`).join('')}${shots.length > 3 ? `<span class="more">+${shots.length - 3}</span>` : ''}</div>` : ''}
  </div>`;
}

/* ---------------- Waves (pyramid / scale-in positions) ---------------- */
function waveOrdered(list) {
  // folds trades sharing a wave name into ordered render-items (waves sorted by newest leg)
  const groups = new Map(), solo = [];
  list.forEach(tr => {
    if (tr.wave) {
      const k = (tr.profileId || 'x') + '|' + tr.wave;
      if (!groups.has(k)) groups.set(k, { name: tr.wave, legs: [] });
      groups.get(k).legs.push(tr);
    } else solo.push(tr);
  });
  const items = solo.map(tr => ({ type: 'solo', tr, key: String(tr.date) }));
  groups.forEach(g => {
    if (g.legs.length >= 2) items.push({ type: 'wave', name: g.name, legs: g.legs, key: g.legs.map(l => String(l.date)).sort().reverse()[0] });
    else g.legs.forEach(tr => items.push({ type: 'solo', tr, key: String(tr.date) })); // a 1-leg wave rides as a normal card
  });
  return items.sort((a, b) => b.key.localeCompare(a.key));
}

function waveCard(name, legs) {
  legs = [...legs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = legs[0];
  const closed = legs.filter(l => !l.running);
  const totPnl = round2(closed.reduce((a, x) => a + (x.pnl || 0), 0));
  const wR = closed.filter(l => (l.rMultiple || 0) > 0).reduce((a, x) => a + x.rMultiple, 0);
  const lR = Math.abs(closed.filter(l => (l.rMultiple || 0) < 0).reduce((a, x) => a + x.rMultiple, 0));
  const sumR = round2(wR - lR);
  const blended = lR > 0 ? '1 : ' + Math.round(wR / lR * 10) / 10 : (wR > 0 ? '1 : ∞' : null);
  const running = legs.filter(l => l.running);
  const samePair = legs.every(l => l.pair === first.pair);
  const shots = legs.reduce((a, x) => a + (x.screenshots || []).length, 0);
  const roleEmoji = r => r === 'add' ? '➕' : r === 'partial' ? '➗' : '🥇';
  const enc = encodeURIComponent(name);
  return `<div class="wave-card">
    <div class="wv-head">
      <span class="wv-name">🌊 ${esc(name)}</span>
      <span class="wv-meta">${samePair ? esc(first.pair) : 'Multi'}${first.setup ? ` · ⚡ ${esc(first.setup)}` : ''} · ${legs.length} leg${legs.length > 1 ? 's' : ''}${running.length ? ` · <span class="wv-run">🏃 ${running.length} running</span>` : ''}</span>
      <span class="mono wv-total ${closed.length ? cls(totPnl) : ''}">${closed.length ? money(totPnl) : 'open'}</span>
    </div>
    <div class="wv-legs">
      ${legs.map(l => `
      <div class="wv-leg" onclick="openTradeForm('${l.id}')">
        <span class="wv-role" title="${{ initial: 'initial entry', add: 'add-on', partial: 'partial close' }[l.waveRole] || 'initial entry'}">${roleEmoji(l.waveRole)}</span>
        <span class="mono" style="min-width:56px">${l.dir === 'long' ? '▲' : '▼'} ${l.lots ?? '?'} lot</span>
        <span class="mono" style="color:var(--muted)">${l.entry ?? '?'} → ${l.running ? '🏃 running' : (l.exit ?? '?')}</span>
        ${holdFmt(holdMs(l)) ? `<span class="tc-tag">⏱ ${holdFmt(holdMs(l))}</span>` : ''}
        ${l.rMultiple != null ? `<span class="tc-tag">${l.rMultiple > 0 ? '+' : ''}${l.rMultiple}R</span>` : ''}
        ${l.running && l.rrPlanned != null ? `<span class="tc-tag wv-plan" title="planned risk:reward">🎯 1:${l.rrPlanned}</span>` : ''}
        ${l.running && l.riskAmount != null ? `<span class="tc-tag wv-plan" title="dollars at risk if SL hits">risk $${round2(l.riskAmount)}</span>` : ''}
        <span class="mono wv-leg-pnl ${l.running ? 'wv-run' : cls(l.pnl)}">${l.running ? '🏃' : money(l.pnl)}</span>
      </div>`).join('')}
    </div>
    <div class="wv-foot">
      ${blended ? `<span class="tc-tag">blended ${blended}</span>` : ''}
      ${sumR ? `<span class="tc-tag">Σ ${sumR > 0 ? '+' : ''}${sumR}R</span>` : ''}
      ${shots ? `<span class="tc-tag">📸 ${shots}</span>` : ''}
      <span style="flex:1"></span>
      <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="wavePrefill('${enc}','add')">＋ Add leg</button>
      <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px" onclick="wavePrefill('${enc}','partial')">➗ Partial out</button>
    </div>
  </div>`;
}

window.wavePrefill = (encName, role) => {
  const name = decodeURIComponent(encName);
  const legs = S.trades.filter(t2 => t2.wave === name);
  const f = legs[0] || {};
  openTradeForm(null, {
    wave: name, waveRole: role, pair: f.pair, setup: f.setup, dir: f.dir, profileId: f.profileId,
    running: role === 'add', analysisTF: f.analysisTF, executionTF: f.executionTF,
  });
};
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ---------------- Equity chart ---------------- */
let lastEQ = { t: [], bal: 0 };
function drawEquityChart(t, bal) {
  if (t) lastEQ = { t: t || [], bal: bal || 0 };
  const cv = $('#equityChart'); if (!cv) return;
  t = lastEQ.t; bal = lastEQ.bal;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  t = [...t].sort((a, b) => a.date.localeCompare(b.date));
  let pts = [bal]; t.forEach(tr => pts.push(pts[pts.length - 1] + (tr.pnl || 0)));
  if (pts.length < 2) pts = [bal, bal];
  const min = Math.min(...pts), max = Math.max(...pts), pad = 26;
  const range = (max - min) || 1;
  const X = i => pad + i / (pts.length - 1) * (W - pad * 2);
  const Y = v => H - pad - (v - min) / range * (H - pad * 2);
  ctx.strokeStyle = 'rgba(139,147,167,.15)'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(pad, Y(bal)); ctx.lineTo(W - pad, Y(bal)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(139,147,167,.8)'; ctx.font = '10px sans-serif';
  ctx.fillText('start ' + money(bal, false), pad + 4, Y(bal) - 4);
  ctx.fillText(money(max, false), pad, 12);
  ctx.fillText(money(min, false), pad, H - 6);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const up = pts[pts.length - 1] >= bal;
  grad.addColorStop(0, up ? 'rgba(163,230,53,.30)' : 'rgba(248,113,113,.30)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
  pts.forEach((p, i) => ctx.lineTo(X(i), Y(p)));
  ctx.lineTo(X(pts.length - 1), H - 2); ctx.lineTo(X(0), H - 2); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
  pts.forEach((p, i) => ctx.lineTo(X(i), Y(p)));
  ctx.strokeStyle = up ? '#a3e635' : '#f87171'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(X(pts.length - 1), Y(pts[pts.length - 1]), 4, 0, 7);
  ctx.fillStyle = up ? '#a3e635' : '#f87171'; ctx.fill();
}

/* ---------------- Render: journal ---------------- */
function renderJournal(t) {
  const el = $('#page-journal');
  let list = [...t].sort((a, b) => b.date.localeCompare(a.date));
  const { q, outcome } = S.filters;
  if (q) list = list.filter(x => (x.pair + ' ' + (x.setup || '')).toLowerCase().includes(q.toLowerCase()));
  if (outcome !== 'all') list = list.filter(x => outcomeOf(x) === outcome);
  el.innerHTML = `
    <div class="row-between mb" style="flex-wrap:wrap">
      <div class="page-title" style="margin:0">Journal <small>${t.length} trades · ${viewLabel()}</small></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="openAutofill()">🪄 Auto-fill</button>
        <button class="btn btn-primary" onclick="openTradeForm()">＋ Log trade</button>
      </div>
    </div>
    <div class="filters">
      <input id="fltQ" placeholder="🔍 Search index or setup…" value="${esc(q)}">
      <select id="fltOutcome">
        <option value="all">All</option>
        <option value="win" ${outcome === 'win' ? 'selected' : ''}>Wins</option>
        <option value="loss" ${outcome === 'loss' ? 'selected' : ''}>Losses</option>
        <option value="be" ${outcome === 'be' ? 'selected' : ''}>Breakeven</option>
      </select>
    </div>
    ${list.length ? waveOrdered(list).map(it => it.type === 'wave' ? waveCard(it.name, it.legs) : tradeCard(it.tr)).join('') : '<div class="empty"><div class="big">🕳️</div>Nothing here. Time to make some trades?</div>'}
    <div style="height:8px"></div>`;
  $('#fltQ').addEventListener('input', e => { S.filters.q = e.target.value; softRefreshJournal(); });
  $('#fltOutcome').addEventListener('change', e => { S.filters.outcome = e.target.value; softRefreshJournal(); });
}
function softRefreshJournal() {
  const q = $('#fltQ'), pos = q && q.selectionStart;
  renderJournal(viewTrades());
  const q2 = $('#fltQ');
  if (q2 && document.activeElement !== $('#fltOutcome')) { q2.focus(); q2.setSelectionRange(pos, pos); }
}

/* ---------------- Render: gallery — Chart Book 2.0 (unique tiles · day groups · win/loss auras) ---------------- */
function uniqueShots(t) {
  const map = new Map(); // url → { sh, trades: [] }  (same shot on 2 trades of one setup = ONE tile)
  t.forEach(tr => (tr.screenshots || []).forEach(sh => {
    if (!sh.url) return;
    if (!map.has(sh.url)) map.set(sh.url, { sh, trades: [] });
    map.get(sh.url).trades.push(tr);
  }));
  return [...map.values()].map(u => {
    u.trades.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    u.day = String(u.trades[0].date || '').slice(0, 10) || 'unknown';
    const wins = u.trades.filter(tr => (tr.pnl || 0) > 0).length;
    const losses = u.trades.filter(tr => (tr.pnl || 0) < 0).length;
    u.oc = wins && !losses ? 'win' : losses && !wins ? 'loss' : (wins + losses) ? 'mixed' : 'flat';
    return u;
  });
}
function dayLabel(day) {
  const d = new Date(day + 'T12:00:00');
  if (isNaN(d)) return day;
  const lbl = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const k = t => t.toISOString().slice(0, 10);
  const today = new Date(), yd = new Date(); yd.setDate(yd.getDate() - 1);
  return (day === k(today) ? 'Today · ' : day === k(yd) ? 'Yesterday · ' : '') + lbl;
}
function cbCell(u) {
  const tr = u.trades[0];
  const idx = Math.max(0, (tr.screenshots || []).findIndex(s => s.url === u.sh.url));
  const totPnl = round2(u.trades.reduce((a, x) => a + (x.pnl || 0), 0));
  const samePair = u.trades.every(x => x.pair === u.trades[0].pair);
  return `<button class="gal-cell oc-${u.oc}" onclick="openLightbox('${tr.id}', ${idx})" title="${esc(u.trades.map(x => `${x.pair} (${money(x.pnl)})`).join(' · '))}">
    <img src="${u.sh.url}" loading="lazy" alt="">
    <span class="gal-outcome">${{ win: '🏆', loss: '🩸', mixed: '🤝', flat: '◻️' }[u.oc]}</span>
    <span class="gal-cat">${SHOT_CAT_EMOJI[u.sh.cat] || '📷'} ${esc(u.sh.cat || 'Chart')}</span>
    <div class="gal-ov">
      <span>${esc(samePair ? u.trades[0].pair : 'Multi')}${u.trades.length > 1 ? ` ×${u.trades.length}` : ''}</span>
      <span class="${cls(totPnl)}">${money(totPnl)}</span>
    </div>
  </button>`;
}
function renderGallery(t) {
  const el = $('#page-gallery');
  const uniq = uniqueShots(t);
  let list = S.galCat === 'All' ? uniq : uniq.filter(u => u.sh.cat === S.galCat);
  if (S.galOutcome !== 'all') list = list.filter(u => u.oc === S.galOutcome);
  const days = {};
  list.forEach(u => (days[u.day] = days[u.day] || []).push(u));
  const dayKeys = Object.keys(days).sort((a, b) => b.localeCompare(a));
  el.innerHTML = `
    <div class="page-title">Chart Book 🖼️ <small>${uniq.length} unique charts · ${Object.keys(days).length || '0'} days · ${viewLabel()} · your setups, in HD</small></div>
    ${uniq.length ? `
    <div class="filters">
      <select id="galCat">
        <option ${S.galCat === 'All' ? 'selected' : ''}>All</option>
        ${SHOT_CATS.map(c => `<option ${S.galCat === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select id="galOutcome">
        <option value="all" ${S.galOutcome === 'all' ? 'selected' : ''}>All outcomes</option>
        <option value="win" ${S.galOutcome === 'win' ? 'selected' : ''}>🏆 Wins only</option>
        <option value="loss" ${S.galOutcome === 'loss' ? 'selected' : ''}>🩸 Losses only</option>
        <option value="mixed" ${S.galOutcome === 'mixed' ? 'selected' : ''}>🤝 Mixed setups</option>
      </select>
    </div>
    <div id="cbDays"></div>` : `
    <div class="empty"><div class="big">📸</div><b>Your chart book is empty.</b><br><br>
      Screenshot your analysis before entry, the setup at entry, and the outcome.<br>
      Months from now this page is gold: spot your repeating patterns, your best setups, your classic mistakes.<br><br>
      <button class="btn btn-primary" onclick="openAddChooser()">Add a trade with charts</button>
    </div>`}
    <div style="height:8px"></div>`;
  if (!uniq.length) return;
  $('#galCat').onchange = e => { S.galCat = e.target.value; renderGallery(viewTrades()); };
  $('#galOutcome').onchange = e => { S.galOutcome = e.target.value; renderGallery(viewTrades()); };
  $('#cbDays').innerHTML = dayKeys.map(day => {
    const us = days[day];
    const ids = new Set(us.flatMap(u => u.trades.map(tr => tr.id)));
    const dayTrades = t.filter(x => ids.has(x.id));
    const dayPnl = round2(dayTrades.reduce((a, x) => a + (x.pnl || 0), 0));
    const setups = [...new Set(dayTrades.map(x => x.setup).filter(Boolean))];
    return `<div class="cb-day">
      <button class="cb-day-hdr" onclick="this.parentNode.classList.toggle('closed')">
        <span class="cb-toggle">▾</span>
        <span class="cb-day-name">${dayLabel(day)}</span>
        <span class="cb-day-meta">
          <span class="mono ${cls(dayPnl)}" style="font-weight:800">${money(dayPnl)}</span>
          <span>${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}</span>
          <span>${us.length} chart${us.length > 1 ? 's' : ''}</span>
          ${setups.length ? `<span>⚡ ${esc(setups.slice(0, 2).join(' + '))}${setups.length > 2 ? '…' : ''}</span>` : ''}
        </span>
      </button>
      <div class="gal-grid">${us.map(cbCell).join('')}</div>
    </div>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1">Nothing under these filters.</div>';
}
window.openLightboxFor = (tradeId, shotIdx) => openLightbox(tradeId, shotIdx);
window.openLightbox = (tradeId, shotIdx) => {
  const tr = S.trades.find(x => x.id === tradeId);
  if (!tr || !(tr.screenshots || []).length) return;
  S.lbIndex = Math.max(0, Math.min(shotIdx, tr.screenshots.length - 1));
  renderLightbox(tr);
};
function renderLightbox(tr) {
  const shots = tr.screenshots;
  const sh = shots[S.lbIndex];
  const flags = planFlags(tr);
  $('#modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="modal-title">${SHOT_CAT_EMOJI[sh.cat] || '📷'} ${esc(tr.pair)} · ${tr.dir === 'long' ? 'Buy' : 'Sell'} · <span class="${cls(tr.pnl)}">${money(tr.pnl)}</span></div>
        <div>
          <button class="btn" style="padding:6px 12px;margin-right:8px" onclick="closeModal();openTradeForm('${tr.id}')">✏️ Trade</button>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
      </div>
      <div class="lb-wrap">
        <img class="lb-img" src="${sh.url}" alt="">
        <div class="lb-cap">${sh.caption ? '“' + esc(sh.caption) + '”' : ''}</div>
        <div class="lb-meta">
          <span class="tc-tag">${esc(SHOT_CAT_EMOJI[sh.cat] || '📷')} ${esc(sh.cat || 'Chart')}</span>
          <span class="tc-tag">📅 ${fmtDate(tr.date)}</span>
          ${tr.setup ? `<span class="tc-tag hl">⚡ ${esc(tr.setup)}</span>` : ''}
          ${flags.map(([c, txt]) => `<span class="plan-flag ${c}">${txt}</span>`).join('')}
        </div>
        ${tr.lesson ? `<div class="tc-lesson" style="margin-top:10px">📚 ${esc(tr.lesson)}</div>` : ''}
        ${shots.length > 1 ? `<div class="lb-nav">
          <button class="btn" onclick="lbMove('${tr.id}', -1)">← Prev</button>
          <button class="btn" style="flex:0 1 auto">${S.lbIndex + 1} / ${shots.length}</button>
          <button class="btn" onclick="lbMove('${tr.id}', 1)">Next →</button>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}
window.lbMove = (tradeId, d) => {
  const tr = S.trades.find(x => x.id === tradeId);
  if (!tr) return;
  S.lbIndex = (S.lbIndex + d + tr.screenshots.length) % tr.screenshots.length;
  renderLightbox(tr);
};

/* ---------------- Render: analytics (incl. Setup Lab) ---------------- */
function renderAnalytics(v, t) {
  const el = $('#page-analytics');
  if (t.length < 2) {
    el.innerHTML = `<div class="page-title">Analytics <small>${viewLabel()}</small></div>
      <div class="empty"><div class="big">🔬</div>Log at least 2 trades in this view and I'll start finding your patterns.</div>`;
    return;
  }
  const insights = genInsights(v, t);
  const barBlock = (title, rows, sub) => {
    if (!rows.length) return '';
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.pnl)), 1);
    return `<div class="card"><div class="card-title">${title} <span class="sub">${sub || ''}</span></div>
      ${rows.map(r => `
        <div class="bar-row">
          <div class="lbl" title="${esc(r.k)}">${esc(r.k)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.abs(r.pnl) / maxAbs * 100}%;background:${r.pnl >= 0 ? 'var(--green)' : 'var(--red)'}"></div></div>
          <div class="bar-val mono ${cls(r.pnl)}">${money(r.pnl)}<br><span class="neu" style="font-weight:500">${r.n} tr · ${r.wr}%</span></div>
        </div>`).join('')}
    </div>`;
  };
  const mistakesCount = {};
  t.forEach(x => (x.mistakes || []).forEach(m => mistakesCount[m] = (mistakesCount[m] || 0) + 1));
  const mistakesRows = Object.entries(mistakesCount).sort((a, b) => b[1] - a[1]);
  const rulesRows = (S.settings.rules || []).map(rule => {
    const withRule = t.filter(x => x.rules && rule in x.rules);
    const ok = withRule.filter(x => x.rules[rule]);
    return { rule, pct: withRule.length ? Math.round(ok.length / withRule.length * 100) : null, n: withRule.length };
  }).filter(r => r.n > 0);
  const disc = rulesRows.length ? Math.round(rulesRows.reduce((a, r) => a + r.pct, 0) / rulesRows.length) : null;
  const lab = setupRows(t);
  const fps = failureFingerprints(lab);
  const hb = holdBuckets(t);

  el.innerHTML = `
    <div class="page-title">Analytics <small>${viewLabel()} · the honest mirror 📊</small></div>
    <div class="grid cols-4">
      ${stat('Expectancy', money(v.expectancy), cls(v.expectancy), 'per trade')}
      ${stat('Avg R', v.avgR == null ? '—' : (v.avgR > 0 ? '+' : '') + v.avgR + 'R', v.avgR > 0 ? 'pos' : 'neg', v.rList.length + ' trades with SL')}
      ${stat('Payoff', v.payoff || '—', v.payoff >= 1.5 ? 'pos' : 'neu', 'avg win ' + money(v.avgWin, false) + ' / avg loss ' + money(v.avgLoss, false))}
      ${stat('Best / Worst', '', '', `<span class="pos">${money(v.bestPnl)}</span> · <span class="neg">${money(v.worstPnl)}</span>`)}
    </div>
    ${labCard(lab, fps)}
    ${holdCard(hb)}
    ${planCard(v, false)}
    ${disc != null ? `<div class="card"><div class="card-title">🧘 Discipline score <span class="sub">${v.perfectTrades} perfect trades in this view</span></div>
      <div class="xp-bar" style="height:14px"><div class="xp-fill" style="width:${disc}%"></div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">${disc}% of your rules followed</div>
      <div class="mt">${rulesRows.map(r => `<div class="bar-row"><div class="lbl" title="${esc(r.rule)}" style="width:160px;min-width:160px">${esc(r.rule)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${r.pct}%;background:${r.pct >= 80 ? 'var(--lime)' : r.pct >= 50 ? 'var(--gold)' : 'var(--red)'}"></div></div>
        <div class="bar-val">${r.pct}%</div></div>`).join('')}</div></div>` : ''}
    ${insights.length ? `<div class="card"><div class="card-title">🪞 Mo's Mirror</div>
      ${insights.map(i => `<div class="insight"><span class="i-emoji">${i.emoji}</span><span>${i.text}</span></div>`).join('')}</div>` : ''}
    ${S.view === 'all' && S.profiles.length > 1 ? barBlock('🏦 By account', byDim(t, x => acctName(x.profileId))) : ''}
    ${barBlock('📈 By index', byDim(t, 'pair'))}
    ${barBlock('🕐 By time block', byDim(t, 'session'))}
    ${barBlock('📅 By weekday', byDim(t, x => new Date(x.date).toLocaleDateString('en-US', { weekday: 'long' })))}
    ${barBlock('🧠 By emotion at entry', byDim(t, x => (EMOTIONS_BEFORE.find(e => e[0] === x.emotionBefore) || [null, null])[1]))}
    ${mistakesRows.length ? `<div class="card"><div class="card-title">⚠️ Repeat offenders</div>
      <div class="chips">${mistakesRows.map(([m, c]) => `<span class="chip-toggle on-neg">${esc(m)} ×${c}</span>`).join('')}</div></div>` : ''}
    <div style="height:8px"></div>`;
}

function labCard(lab, fps) {
  const named = lab.filter(r => r.name !== '(no setup)');
  if (!named.length) return '';
  return `<div class="card"><div class="card-title">🧪 Setup Lab <span class="sub">planned → actual → overall R:R per setup · your backtest edge, live</span></div>
    <div class="lab-scroll"><table class="lab-table">
      <tr><th>Setup</th><th>N</th><th>Win%</th><th>Avg R</th><th>RR plan</th><th>RR actual</th><th>RR overall</th><th>Σ R</th><th>Avg hold</th><th>Best on</th><th style="text-align:right">P&L</th></tr>
      ${named.map(r => `<tr>
        <td><span class="lab-setup">${esc(r.name)}</span>${r.tfLabel ? `<span class="lab-tf">${esc(r.tfLabel)}</span>` : ''}</td>
        <td>${r.n}</td>
        <td><b class="${r.wr >= 50 ? 'pos' : r.wr < 40 ? 'neg' : ''}">${r.wr}%</b></td>
        <td class="mono ${r.avgR == null ? '' : (r.avgR > 0 ? 'pos' : 'neg')}">${r.avgR == null ? '—' : (r.avgR > 0 ? '+' : '') + r.avgR + 'R'}</td>
        <td class="mono" style="color:var(--muted)">${r.avgPlannedRR || '—'}</td>
        <td class="mono">${r.achievedRR || '—'}</td>
        <td class="mono ${r.overallRR ? (r.overallRRnum >= 1 ? 'pos' : 'neg') : ''}" style="font-weight:800">${r.overallRR || '—'}</td>
        <td class="mono ${r.totalR == null ? '' : (r.totalR > 0 ? 'pos' : 'neg')}">${r.totalR == null ? '—' : (r.totalR > 0 ? '+' : '') + r.totalR + 'R'}</td>
        <td>${r.avgHold ? holdFmt(r.avgHold) : '—'}</td>
        <td style="color:var(--muted)">${r.bestOn ? esc(r.bestOn) : '—'}</td>
        <td class="mono ${cls(r.pnl)}" style="text-align:right;font-weight:800">${money(r.pnl)}</td>
      </tr>`).join('')}
    </table></div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">🧮 <b>RR overall</b> = every 1 unit of risk the setup lost → units of risk it won back (backtester's profit factor). RR plan = what you aimed (planned TP vs SL) · RR actual = what you achieved.</div>
    ${fps.length ? `<div class="mt">${fps.map(f => `
      <div class="insight" style="border-left-color:var(--red)"><span class="i-emoji">❌</span>
        <span><b>Why “${esc(f.name)}${f.tf ? ' · ' + esc(f.tf) : ''}” fails</b> (${f.n} losses): ${f.bits.join(' · ')}</span></div>`).join('')}</div>` : ''}
    ${lab.some(r => r.n < 4) ? `<div style="font-size:11px;color:var(--muted);margin-top:10px">💡 Verdicts get trustworthy at ~10+ trades per setup — keep feeding the Lab.</div>` : ''}
  </div>`;
}

function holdCard(hb) {
  if (hb.reduce((a, r) => a + r.n, 0) < 3) return '';
  return `<div class="card"><div class="card-title">⏱ Hold time <span class="sub">how long you usually hold · and how it pays</span></div>
    ${hb.map(r => `<div class="bar-row">
      <div class="lbl">${r.k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${r.wr}%;background:${r.pnl >= 0 ? 'var(--lime)' : 'var(--red)'}"></div></div>
      <div class="bar-val mono ${cls(r.pnl)}">${money(r.pnl)}<br><span class="neu" style="font-weight:500">${r.n} tr · ${r.wr}% win</span></div>
    </div>`).join('')}
  </div>`;
}

/* ---------------- Render: calendar ---------------- */
function renderCalendar(t) {
  const el = $('#page-calendar');
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + S.calCursor);
  const y = base.getFullYear(), m = base.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const byDay = {};
  t.forEach(x => {
    const k = x.date.slice(0, 10);
    byDay[k] = byDay[k] || { pnl: 0, n: 0 };
    byDay[k].pnl += x.pnl || 0; byDay[k].n++;
  });
  let cells = '';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = 0; i < firstDow; i++) cells += `<div></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = byDay[k];
    let clsStr = 'cal-cell';
    if (e) clsStr += ' has ' + (e.pnl >= 0 ? 'win' : 'loss');
    if (S.calSelected === k) clsStr += ' sel';
    cells += `<div class="${clsStr}" ${e ? `onclick="calSelect('${k}')"` : ''}>${d}
      ${e ? `<div class="cell-pnl">${money(round2(e.pnl))}</div>` : ''}</div>`;
  }
  const monthPnl = Object.entries(byDay).filter(([k]) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`))
    .reduce((a, [, vv]) => a + vv.pnl, 0);
  const selTrades = S.calSelected ? t.filter(x => x.date.startsWith(S.calSelected)).sort((a, b) => b.date.localeCompare(a.date)) : [];
  el.innerHTML = `
    <div class="page-title">Calendar <small>${viewLabel()} · month P&L: <b class="${cls(monthPnl)}">${money(round2(monthPnl))}</b></small></div>
    <div class="card">
      <div class="cal-head">
        <button class="btn btn-ghost" onclick="calMove(-1)">←</button>
        <div class="cal-title">${base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button class="btn btn-ghost" onclick="calMove(1)">→</button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="legend"><span><span class="dot" style="background:rgba(52,211,153,.5)"></span>green day</span><span><span class="dot" style="background:rgba(248,113,113,.5)"></span>red day</span><span>tap a day to review</span></div>
    </div>
    ${selTrades.length ? `<div class="card"><div class="card-title">📅 ${new Date(S.calSelected + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      ${selTrades.map(tradeCard).join('')}</div>` : ''}
    <div style="height:8px"></div>`;
}
window.calMove = d => { S.calCursor += d; S.calSelected = null; renderCalendar(viewTrades()); };
window.calSelect = k => { S.calSelected = S.calSelected === k ? null : k; renderCalendar(viewTrades()); };

/* ---------------- Render: settings ---------------- */
function renderSettings() {
  const el = $('#page-settings');
  const st = S.settings;
  const ai = st.ai || {};
  el.innerHTML = `
    <div class="page-title">Settings <small>tune your cockpit ⚙️</small></div>
    <div class="card">
      <div class="card-title">🪄 AI AUTO-FILL <span class="sub" id="aiStatus">${ai.configured ? '<span class="pos">● connected key saved</span>' : 'not configured — screenshots parsing sleeps 💤'}</span></div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px">
        Powers the magic: feed AUTO-FILL screenshots of your broker history, setups or P&L and AI extracts the trades for you.
        <b>Bring your own key</b> — free tiers work great. Your key stays on the server, never in your browser. 🔒
      </div>
      <div class="form-grid">
        <div class="field full"><label>Provider</label>
          <div class="chips" id="aiPresetChips">${AI_PRESETS.map((p, i) => `<button type="button" class="chip-toggle" data-i="${i}">${p.name}</button>`).join('')}</div>
          <span class="hint" id="aiPresetHint">Pick one — free tiers at ${AI_PRESETS[0].hint} or ${AI_PRESETS[1].hint}</span></div>
        <div class="field"><label>API base URL</label><input id="ai-base" value="${esc(ai.base || AI_PRESETS[0].base)}"></div>
        <div class="field"><label>Model (needs vision 👁️)</label><input id="ai-model" value="${esc(ai.model || AI_PRESETS[0].model)}"></div>
        <div class="field full"><label>API key ${ai.configured
          ? `<span class="pos">✓ saved <b class="mono">${esc(ai.keyHint || '')}</b>${ai.fromEnv ? ' · 🔒 <b>server env — deploy-proof</b>' : ' — paste a new one to replace'}</span>`
          : ''}</label>
          <input id="ai-key" type="password" placeholder="sk-or-… / gsk_…" autocomplete="off"></div>
      </div>
      <div class="chips mt">
        <button class="btn btn-primary" onclick="saveAI()">💾 Save AI settings</button>
        <button class="btn" onclick="testAI()">🔌 Test connection</button>
        <button class="btn btn-gold" onclick="diagnoseAI()">🔬 Diagnose vision</button>
      </div>
      <div class="af-status" id="aiTestOut"></div>
    </div>
    <div class="card">
      <div class="card-title">🏦 My accounts <span class="sub">${S.profiles.length} account${S.profiles.length === 1 ? '' : 's'}</span></div>
      ${S.profiles.map(p => {
        const tt = S.trades.filter(x => x.profileId === p.id);
        const pnl = round2(tt.reduce((a, x) => a + (x.pnl || 0), 0));
        return `<div class="rule-row">
          <span class="tick">${p.emoji || '💼'}</span>
          <span style="flex:1"><b>${esc(p.name)}</b> <span class="ptype">${esc(p.broker || '')}${p.type ? ' · ' + esc(p.type) : ''}</span><br>
            <span style="font-size:11px;color:var(--muted)">${tt.length} trades · start ${money(p.balance || 0, false)} · <span class="${cls(pnl)}" style="font-weight:700">${money(pnl)}</span></span></span>
          <button class="btn btn-ghost" style="padding:4px 10px" onclick="openProfileForm('${p.id}')">✏️</button>
          ${S.profiles.length > 1 ? `<button class="btn btn-ghost btn-danger" style="padding:4px 10px" onclick="deleteProfile('${p.id}')">🗑</button>` : ''}
        </div>`;
      }).join('')}
      <button class="btn btn-primary btn-block mt" onclick="openProfileForm()">＋ Add account</button>
    </div>
    <div class="card">
      <div class="card-title">📜 My trading rules <span class="sub">your pre-trade checklist · +${XP_ALL_RULES} XP when all ticked</span></div>
      <div id="rulesList">${(st.rules || []).map((r, i) => `
        <div class="rule-row"><span style="flex:1">${esc(r)}</span>
          <button class="btn btn-ghost btn-danger" style="padding:4px 10px" onclick="removeRule(${i})">✕</button></div>`).join('')}</div>
      <div class="filters"><input id="newRule" placeholder="Add a new rule… e.g. Max 3 trades per day">
        <button class="btn btn-primary" onclick="addRule()">Add</button></div>
    </div>
    <div class="card">
      <div class="card-title">☁️ Sync & backup <span class="sub" id="gistFlag">checking cloud…</span></div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:12px">
        Your journal (all accounts) lives on this server — same link on PC and phone. <b>Tip:</b> "Add to Home Screen" on your phone for an app icon. 📲
      </div>
      <div id="backupStatus" class="af-status" style="margin:0 0 10px">Checking backup status…</div>
      <div class="chips">
        <button class="btn btn-gold" onclick="backupNow()">☁️ Backup now</button>
        <button class="btn" onclick="checkShots()">🔎 Check screenshots</button>
        <button class="btn btn-gold" onclick="recoverShots()">🩹 Recover missing</button>
        <button class="btn" onclick="exportJSON()">⬇️ Export JSON</button>
        <button class="btn" onclick="exportCSV()">⬇️ Export CSV</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">⬆️ Import JSON</button>
        <input type="file" id="importFile" accept=".json" class="hidden" onchange="importJSON(event)">
      </div>
    </div>
    <div class="card">
      <div class="card-title">⏳ Time Machine — restore a previous version</div>
      <div class="hint" style="margin-bottom:10px;color:var(--muted);font-size:12px">Every save to your vault is kept forever. If trades ever go missing, pull them back from any point in time.</div>
      <div class="chips"><button class="btn btn-gold" onclick="openTimeMachine()">⏳ Browse saved versions</button></div>
      <div class="af-status" id="tmOut"></div>
    </div>
    <div class="card">
      <div class="card-title">🧪 Playground</div>
      <div class="chips">
        <button class="btn btn-gold" onclick="loadDemo()">🎲 Load demo trades</button>
        <button class="btn btn-danger" onclick="wipeAll()">🗑️ Wipe all trades</button>
      </div>
      <div class="hint" style="margin-top:10px;color:var(--muted);font-size:12px">Demo drops 11 synthetic trades (incl. a Quasimodo series) into your current account. Wipe removes trades only — accounts stay.</div>
    </div>
    <div class="footer-note">Mo's Journal v4 · SMART edition 🧠 · Built for consistency, not perfection 💛</div>`;
  api('/api/meta').then(m => {
    const f = $('#gistFlag');
    if (f) f.textContent = m.gistSync ? '☁️ cloud backup: ON (GitHub Gist)' : '💾 local disk backup (export regularly!)';
    renderBackupStatus(m);
  }).catch(() => {});
  $$('#aiPresetChips .chip-toggle').forEach(b => b.onclick = () => {
    $$('#aiPresetChips .chip-toggle').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const p = AI_PRESETS[+b.dataset.i];
    $('#ai-base').value = p.base; $('#ai-model').value = p.model;
    $('#aiPresetHint').textContent = p.hint;
  });
}
window.saveAI = async () => {
  const payload = {
    ...S.settings,
    ai: { base: $('#ai-base').value.trim(), model: $('#ai-model').value.trim(), key: $('#ai-key').value.trim() },
  };
  const res = await api('/api/settings', 'POST', payload);
  S.settings = res.settings;
  toast('✅ AI settings saved'); renderAll();
};
window.testAI = async () => {
  const out = $('#aiTestOut');
  out.innerHTML = 'Testing… ⏳';
  try { const r = await api('/api/ai-test'); out.innerHTML = `<b>🔌 ${esc(r.message)}</b>`; }
  catch (e) { out.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; }
};
/* v4.6.2: one-tap truth about the screenshot lane. Sends a real image from the SERVER
   (key never leaves it), tells you which models actually accept vision on your key, and
   lets you apply the working one without typing. */
window.diagnoseAI = async (probeAll) => {
  const out = $('#aiTestOut');
  out.innerHTML = probeAll
    ? '🔬 Testing every model for the most accurate reading… (up to ~90s) ⏳'
    : '🔬 Probing your key with a real image… (up to ~30s) ⏳';
  try {
    const r = await api('/api/ai-probe' + (probeAll ? '?all=1' : ''));
    const rows = r.results.map(x => `
      <div class="probe-row ${x.ok ? 'ok' : 'bad'}">
        <div class="pr-top"><b class="mono">${esc(x.model)}</b>
          <span>${x.ok ? `✅ vision works (${x.ms}ms)${x.reply ? ' · replied: ' + esc(x.reply.trim()) : ''}`
                       : `❌ ${x.status || 'ERR'} ${esc(x.error || '')}`}</span></div>
        ${x.rlRequestsLeft || x.rlReset ? `<div class="pr-sub">quota left: ${esc(x.rlRequestsLeft || '—')} requests · resets: ${esc(x.rlReset || '—')}</div>` : ''}
        ${x.ok ? `<button class="btn btn-gold" style="padding:5px 10px;margin-top:6px" onclick="applyModel('${esc(x.model)}')">Use this model ✓</button>` : ''}
      </div>`).join('');
    out.innerHTML = `<b>🔬 Vision diagnostic</b><br><span style="color:var(--muted);font-size:12px">${esc(r.provider)}</span>
      ${rows}
      ${!probeAll ? `<button class="btn" style="margin-top:10px" onclick="diagnoseAI(true)">🔬 Test every model — find the most accurate</button>
        <div class="pr-sub" style="margin-top:4px">Bigger models read small price digits far better. Worth 90 seconds if numbers come out wrong.</div>` : ''}
      ${r.winner ? '' : `<div class="pr-sub" style="margin-top:8px">No vision model answered. If every row says <b>429</b>, your free quota is drained — wait a bit, or use 📄 statement import (no AI needed) to keep logging trades now.</div>`}`;
  } catch (e) { out.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; }
};
window.applyModel = async m => {
  const s = S.settings.ai || {};
  await api('/api/settings', 'POST', { ai: { base: s.base, model: m } });
  await loadState(); renderAll();
  toast(`✅ Model set to ${m}`, 'gold');
  const out = $('#aiTestOut'); if (out) out.innerHTML = `<b>✅ Now using <span class="mono">${esc(m)}</span></b><br>Go log those trades — 🪄 AUTO-FILL → 📸`;
  go('settings');
};

function ago(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}
function renderBackupStatus(m) {
  const el = $('#backupStatus'); if (!el) return;
  if (!m.gistSync) { el.innerHTML = '<span class="neg">⚠️ Cloud backup OFF — add GIST_TOKEN on Render. Until then, export a JSON after every session.</span>'; return; }
  const lb = m.lastBackup;
  el.innerHTML = `<b>☁️ Cloud backup: ON</b> · ${m.trades} trade${m.trades === 1 ? '' : 's'} · ${m.shotsVaulted} screenshot${m.shotsVaulted === 1 ? '' : 's'} vaulted · ${m.snapshots} snapshot${m.snapshots === 1 ? '' : 's'}<br>
    <span style="color:var(--muted)">Last snapshot: <b>${lb ? ago(lb.at) : 'none yet'}</b>${lb ? ` (${lb.trades} trades)` : ''} · auto-syncs ~8s after every change
    ${m.gistUrl ? ` · <a href="${esc(m.gistUrl)}" target="_blank" style="color:var(--gold)">open vault ↗</a>` : ''}</span>`;
}
window.openTimeMachine = async () => {
  const out = $('#tmOut'); if (out) out.innerHTML = '⏳ Reading vault history…';
  let r;
  try { r = await api('/api/timemachine'); }
  catch (e) { if (out) out.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; return; }
  if (!r.revisions || !r.revisions.length) { if (out) out.innerHTML = 'No history found yet — hit ☁️ Backup now to create your first restore point.'; return; }
  if (out) out.innerHTML = `<div class="pr-sub" style="margin-bottom:6px">Currently loaded: <b>${r.current.trades} trades · ${r.current.profiles} accounts</b></div>`
    + r.revisions.map(v => `
      <div class="probe-row ${v.trades > r.current.trades ? 'ok' : ''}">
        <div class="pr-top"><b>${v.trades} trades · ${v.profiles} accounts · ${v.shots} shots</b>
          <span style="color:var(--muted)">${new Date(v.at).toLocaleString()}</span></div>
        <button class="btn ${v.trades > r.current.trades ? 'btn-gold' : ''}" style="padding:5px 10px;margin-top:6px"
          onclick="restoreVersion('${v.version}', ${v.trades}, ${v.profiles})">Restore this version ↩️</button>
      </div>`).join('');
};
window.restoreVersion = async (version, trades, profiles) => {
  if (!confirm(`Restore this version? It has ${trades} trades and ${profiles} accounts. Your current journal will be replaced.`)) return;
  const out = $('#tmOut'); if (out) out.innerHTML = '↩️ Restoring…';
  try {
    const r = await api('/api/timemachine/restore', 'POST', { version });
    await loadState(); renderAll();
    if (out) out.innerHTML = `<b>✅ Restored — ${r.trades} trades, ${r.profiles} accounts are back.</b>`;
    toast(`⏳ Restored ${r.trades} trades`, 'gold');
  } catch (e) { if (out) out.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; }
};
window.recoverShots = async () => {
  const el = $('#backupStatus'); if (el) el.innerHTML = '🩹 Pulling your screenshots back from the vault… ⏳';
  try {
    const r = await api('/api/shots/recover', 'POST');
    const st = await api('/api/shots/status');
    if (el) el.innerHTML = `<b>🩹 Recovered ${r.recovered} of ${r.attempted} missing screenshots.</b><br>
      ${r.stillGone ? `<span style="color:var(--muted)">${r.stillGone} were never backed up (uploaded before the size fix) — open those trades and re-add them from your gallery. Everything new is safe.</span>` : `<span style="color:var(--muted)">All screenshots restored. Refresh the journal to see them.</span>`}
      <br><span style="color:var(--muted)">Still missing on disk: ${st.missingCount}</span>`;
    toast(`🩹 Recovered ${r.recovered} screenshots`, 'gold');
  } catch (e) { if (el) el.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; }
};
window.checkShots = async () => {
  const el = $('#backupStatus'); if (el) el.innerHTML = '🔎 Checking screenshots…';
  try {
    const r = await api('/api/shots/status');
    if (!r.missingCount) {
      if (el) el.innerHTML = `<b>✅ All ${r.total} screenshots are present on the server.</b><br><span style="color:var(--muted)">If one still won't display, pull to refresh — your browser cached the old broken link.</span>`;
      toast('✅ All screenshots present');
    } else {
      if (el) el.innerHTML = `<span class="neg">⚠️ ${r.missingCount} of ${r.total} screenshots are missing from the server.</span><br>
        <span style="color:var(--muted)">These were uploaded before the fix, so they were too big to back up. Open each trade below and re-add them — new uploads are safe.</span>
        <div style="margin-top:8px">${r.missing.slice(0, 12).map(m => `<div class="pr-sub">· ${esc(m.pair || 'trade')} — ${fmtDate(m.date) || ''} <button class="btn btn-ghost" style="padding:3px 8px;margin-left:6px" onclick="closeModal();openTradeForm('${m.trade}')">fix ↗</button></div>`).join('')}</div>`;
    }
  } catch (e) { if (el) el.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`; }
};
window.backupNow = async () => {
  const el = $('#backupStatus'); if (el) el.innerHTML = '☁️ Backing up… ⏳';
  try {
    const r = await api('/api/backup', 'POST');
    const m = await api('/api/meta');
    renderBackupStatus(m);
    toast(`☁️ Backed up — ${r.trades} trades, ${r.shots} screenshots`, 'gold');
  } catch (e) {
    if (el) el.innerHTML = `<span class="neg">✗ Backup failed: ${esc(e.message)}</span>`;
  }
};
window.removeRule = async i => { S.settings.rules.splice(i, 1); await api('/api/settings', 'POST', S.settings); renderAll(); };
window.addRule = async () => {
  const v = $('#newRule').value.trim(); if (!v) return;
  S.settings.rules.push(v); await api('/api/settings', 'POST', S.settings); renderAll();
};

/* ---------------- Profile form ---------------- */
let pfEmoji = '💼', pfType = 'Live', pfBroker = 'Weltrade';
window.openProfileForm = (id) => {
  const p = id ? profileById(id) : null;
  pfEmoji = p?.emoji || PROFILE_EMOJIS[0];
  pfType = p?.type || 'Live';
  pfBroker = p?.broker || 'Weltrade';
  $('#modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="modal-title">${p ? '✏️ Edit account' : '🏦 New account'}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="form-grid">
        <div class="field full"><label>Account name</label>
          <input id="pf-name" placeholder="e.g. Weltrade Synthetic 500, Deriv Demo…" value="${esc(p?.name || '')}"></div>
        <div class="field"><label>Starting balance (USD)</label>
          <input type="number" step="any" id="pf-balance" value="${p ? p.balance : 100}"></div>
        <div class="field"><label>Broker</label>
          <div class="chips" id="pfBrokerChips">${PROFILE_BROKERS.map(b => `<button type="button" class="chip-toggle ${pfBroker === b ? 'on' : ''}" data-val="${b}">${b}</button>`).join('')}</div></div>
        <div class="field full"><label>Type</label>
          <div class="chips" id="pfTypeChips">${PROFILE_TYPES.map(t => `<button type="button" class="chip-toggle ${pfType === t ? 'on' : ''}" data-val="${t}">${t}</button>`).join('')}</div></div>
        <div class="field full"><label>Icon</label>
          <div class="emoji-grid" id="pfEmojiGrid">${PROFILE_EMOJIS.map(e => `<button type="button" class="${pfEmoji === e ? 'on' : ''}" data-val="${e}">${e}</button>`).join('')}</div></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block mt" onclick="saveProfile('${p ? p.id : ''}')">💾 ${p ? 'Save changes' : 'Create account'}</button>
    </div>
  </div>`;
  $$('#pfEmojiGrid button').forEach(b => b.onclick = () => { pfEmoji = b.dataset.val; $$('#pfEmojiGrid button').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#pfTypeChips .chip-toggle').forEach(b => b.onclick = () => { pfType = b.dataset.val; $$('#pfTypeChips .chip-toggle').forEach(x => x.classList.toggle('on', x === b)); });
  $$('#pfBrokerChips .chip-toggle').forEach(b => b.onclick = () => { pfBroker = b.dataset.val; $$('#pfBrokerChips .chip-toggle').forEach(x => x.classList.toggle('on', x === b)); });
};
window.saveProfile = async (id) => {
  const name = $('#pf-name').value.trim();
  if (!name) return toast('⚠️ Give the account a name');
  const payload = { name, emoji: pfEmoji, type: pfType, broker: pfBroker, balance: num($('#pf-balance').value) ?? 0 };
  try {
    if (id) {
      const res = await api('/api/profile/' + id, 'POST', payload);
      S.profiles[S.profiles.findIndex(p => p.id === id)] = res.profile;
      toast('✅ Account updated');
    } else {
      const res = await api('/api/profile', 'POST', payload);
      S.profiles.push(res.profile);
      S.view = res.profile.id; localStorage.setItem('mj_view', S.view);
      toast(`${pfEmoji} "${esc(name)}" created — you're viewing it now`, 'gold');
      confettiBurst();
    }
    closeModal(); renderAll();
  } catch (e) { toast('⚠️ Couldn\'t save — connection issue?'); }
};
window.deleteProfile = async (id) => {
  const p = profileById(id);
  const target = S.profiles.find(x => x.id !== id);
  const n = S.trades.filter(t => t.profileId === id).length;
  if (!confirm(`Delete "${p.name}"?${n ? `\n\nIts ${n} trades will be moved to "${target.name}".` : ''}`)) return;
  try {
    await api('/api/profile/' + id, 'DELETE', { moveTo: target.id });
    S.trades.forEach(t => { if (t.profileId === id) t.profileId = target.id; });
    S.profiles = S.profiles.filter(x => x.id !== id);
    if (S.view === id) { S.view = 'all'; localStorage.setItem('mj_view', 'all'); }
    toast(`🗑️ Account deleted${n ? `, trades moved to ${target.emoji} ${target.name}` : ''}`);
    renderAll();
  } catch (e) { toast('⚠️ Couldn\'t delete'); }
};

/* ---------------- Import / export / demo / wipe ---------------- */
window.exportJSON = () => {
  const blob = new Blob([JSON.stringify({ trades: S.trades, profiles: S.profiles, settings: { ...S.settings, ai: undefined } }, null, 2)], { type: 'application/json' });
  dl(blob, `mos-journal-${dayKey(new Date())}.json`);
};
window.exportCSV = () => {
  const cols = ['date', 'closedAt', 'hold', 'account', 'pair', 'dir', 'lots', 'plannedEntry', 'entry', 'exit', 'sl', 'actualSL', 'tp', 'pips', 'pnl', 'rMultiple', 'session', 'setup', 'analysisTF', 'executionTF', 'riskPct', 'emotionBefore', 'emotionAfter', 'rating', 'mistakes', 'lesson', 'notes'];
  const rows = S.trades.map(t => cols.map(c => {
    let v = c === 'account' ? (profileById(t.profileId) || {}).name || '' : c === 'hold' ? (holdFmt(holdMs(t)) || '') : t[c];
    if (Array.isArray(v)) v = v.join('; '); if (v == null) v = '';
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob([cols.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
  dl(blob, `mos-journal-${dayKey(new Date())}.csv`);
};
function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
window.importJSON = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.trades)) throw new Error('bad file');
    let r = await api('/api/import', 'POST', data);
    if (r && r.error === 'IMPORT_SHRINK') {
      if (!confirm(r.message + '\n\nImport anyway and overwrite?')) { e.target.value = ''; return; }
      data.force = true;
      r = await api('/api/import', 'POST', data);
      if (r && r.error) throw new Error(r.message);
    }
    await loadState(); toast('✅ Imported ' + data.trades.length + ' trades'); renderAll();
  } catch (err) { toast('⚠️ Import failed — is that a Mo backup file?'); }
  e.target.value = '';
};
window.loadDemo = async () => {
  if (!S.profiles.length) return toast('Create an account first!');
  const target = S.view !== 'all' ? activeProfile() : S.profiles[0];
  if (S.trades.length && !confirm(`Add demo trades to "${target.name}"?`)) { if (S.trades.length) return; }
  const demo = makeDemoTrades(target.id);
  for (const t of demo) await api('/api/trade', 'POST', t);
  await loadState(); renderAll();
  toast(`🎲 Demo trades loaded into ${target.emoji} ${target.name} — check the Setup Lab!`, 'gold'); confettiBurst();
};
window.wipeAll = async () => {
  if (!confirm('Wipe ALL trades across ALL accounts? Accounts stay.')) return;
  if (!confirm('Really really? No undo. (Export first?)')) return;
  await api('/api/import', 'POST', { trades: [], profiles: S.profiles, settings: S.settings, force: true }); // wipe was double-confirmed — carry the flag past the shrink-guard
  S.trades = []; toast('🗑️ Fresh slate. Let\'s go.'); renderAll();
};

function makeDemoTrades(profileId) {
  const now = Date.now(), H = 36e5, D = 24 * H;
  const mk = o => {
    const rules = {}; S.settings.rules.forEach((r, i) => rules[r] = (o.rulesHit || []).includes(i));
    const nums = computeNumbers({ pair: o.pair, dir: o.dir, lots: o.lots, entry: o.e, exit: o.x, sl: o.sl, tp: o.tp });
    const date = new Date(now - o.dAgo * D + o.h * H);
    return {
      date: date.toISOString(), closedAt: o.holdH ? new Date(date.getTime() + o.holdH * H).toISOString() : null,
      profileId, pair: o.pair, dir: o.dir, lots: o.lots,
      plannedEntry: o.pe ?? null, entry: num(o.e), exit: num(o.x), sl: num(o.sl), actualSL: num(o.asl), tp: num(o.tp),
      pips: nums.pips, pnl: nums.pnlEstimated, pnlEstimated: nums.pnlEstimated, pnlOverridden: false,
      riskAmount: nums.riskAmount, rMultiple: nums.rMultiple, rrPlanned: nums.rrPlanned,
      session: o.block, setup: o.setup, analysisTF: o.atf || null, executionTF: o.etf || null,
      rules, mistakes: o.mistakes || [], emotionBefore: o.eb, emotionAfter: o.ea,
      lesson: o.lesson || '', rating: o.rating, riskPct: o.riskPct, notes: '', screenshots: [],
      id: 'demo' + Math.random().toString(36).slice(2), createdAt: now - o.dAgo * D,
    };
  };
  const A = [0, 1, 2, 3, 4];
  return [
    // Quasimodo series — the flagship: H1 analysis, M15 OB execution, long holds
    mk({ dAgo: 9, h: 9, pair: 'Volatility 75', dir: 'long', lots: 1, pe: 6350.20, e: 6350.20, x: 6358.70, sl: 6345.20, asl: 6345.20, tp: 6360.20, holdH: 17, block: 'Morning', setup: 'Quasimodo', atf: 'H1', etf: 'M15', rulesHit: A, eb: 'calm', ea: 'satisfied', lesson: 'Textbook QM: left shoulder, head, right shoulder into the M15 OB. Waited 3h for price to come to ME.', rating: 5, riskPct: 1 }),
    mk({ dAgo: 6, h: 15, pair: 'Volatility 75', dir: 'long', lots: 1, pe: 6401.50, e: 6401.50, x: 6410.90, sl: 6396.50, asl: 6396.50, tp: 6412.00, holdH: 19, block: 'Evening', setup: 'Quasimodo', atf: 'H1', etf: 'M15', rulesHit: A, eb: 'focused', ea: 'satisfied', lesson: '', rating: 5, riskPct: 1 }),
    mk({ dAgo: 3, h: 22, pair: 'Volatility 75', dir: 'long', lots: 1, pe: 6372.00, e: 6373.40, x: 6368.90, sl: 6368.00, asl: 6366.50, tp: 6382.00, holdH: 2, block: 'Late night', setup: 'Quasimodo', atf: 'H1', etf: 'M15', rulesHit: [1, 3], eb: 'tired', ea: 'frustrated', mistakes: ['Chased entry', 'Moved stop-loss'], lesson: 'Late-night QM fail #3. Chased the retest, widened stop, still got clipped. QM belongs to my morning block.', rating: 2, riskPct: 2 }),
    mk({ dAgo: 0, h: 9, pair: 'Volatility 75', dir: 'short', lots: 1, pe: 6390.30, e: 6390.30, x: 6382.10, sl: 6394.30, asl: 6394.30, tp: 6381.30, holdH: 16, block: 'Morning', setup: 'Quasimodo', atf: 'H1', etf: 'M15', rulesHit: A, eb: 'calm', ea: 'satisfied', lesson: 'Patient entry at the right shoulder. These holds feel long because they ARE long — and they pay.', rating: 5, riskPct: 1 }),
    // Spike catches — quick scalps
    mk({ dAgo: 1, h: 15, pair: 'Boom 1000', dir: 'long', lots: 0.5, pe: 2845.60, e: 2845.60, x: 2852.10, sl: 2843.60, asl: 2843.60, tp: 2855.00, holdH: 0.8, block: 'Evening', setup: 'Spike catch', atf: 'M15', etf: 'M5', rulesHit: A, eb: 'focused', ea: 'euphoric', lesson: '', rating: 5, riskPct: 1 }),
    mk({ dAgo: 4, h: 8, pair: 'Boom 500', dir: 'long', lots: 0.8, pe: 1432.10, e: 1432.10, x: 1429.80, sl: 1430.60, asl: 1430.60, tp: 1436.10, holdH: 0.4, block: 'Morning', setup: 'Spike catch', atf: 'M15', etf: 'M5', rulesHit: A, eb: 'calm', ea: 'neutral', lesson: 'Valid spike catch, stopped clean. Cost of business.', rating: 4, riskPct: 1 }),
    mk({ dAgo: 8, h: 14, pair: 'Crash 300', dir: 'short', lots: 1, pe: 2134.70, e: 2135.40, x: 2130.10, sl: 2138.00, asl: 2138.00, tp: 2128.70, holdH: 0.6, block: 'Evening', setup: 'Spike catch', atf: 'M15', etf: 'M5', rulesHit: [0, 2, 3], eb: 'bored', ea: 'neutral', mistakes: ['Chased entry'], lesson: 'Chased the crash candle. Small win, bad process — spike catches wait for the pullback to the mean.', rating: 2, riskPct: 2 }),
    // Range scalps — meh results
    mk({ dAgo: 1, h: 22, pair: 'Volatility 100', dir: 'long', lots: 1.5, pe: 2150.10, e: 2150.10, x: 2147.30, sl: 2148.60, asl: 2147.00, tp: 2156.00, holdH: 1.2, block: 'Late night', setup: 'Range scalp', atf: 'M15', etf: 'M5', rulesHit: [1, 3], eb: 'bored', ea: 'frustrated', mistakes: ['Moved stop-loss', 'Bored trading'], lesson: 'Widened the stop "for room" — it bled past anyway. Late-night range scalps = donations.', rating: 1, riskPct: 2 }),
    mk({ dAgo: 2, h: 10, pair: 'Step Index', dir: 'long', lots: 0.6, e: 8945.5, x: 8952.3, sl: 8942.0, asl: 8945.5, tp: 8954.5, holdH: 5, block: 'Morning', setup: 'Range scalp', atf: 'M15', etf: 'M5', rulesHit: A, eb: 'calm', ea: 'satisfied', lesson: '', rating: 4, riskPct: 1 }),
    mk({ dAgo: 7, h: 20, pair: 'Jump 50', dir: 'long', lots: 0.5, e: 1265.80, x: 1263.20, sl: 1264.30, asl: 1264.30, tp: 1269.80, holdH: 0.9, block: 'Late night', setup: 'Range scalp', atf: 'M15', etf: 'M5', rulesHit: [0, 2, 3], eb: 'tired', ea: 'neutral', mistakes: ['Bored trading'], lesson: '', rating: 3, riskPct: 1 }),
    mk({ dAgo: 5, h: 14, pair: 'Volatility 100 (1s)', dir: 'long', lots: 2, e: 1890.30, x: 1894.10, sl: 1888.30, asl: 1888.30, tp: 1894.30, holdH: 1.5, block: 'Midday', setup: 'Range scalp', atf: 'M15', etf: 'M5', rulesHit: A, eb: 'focused', ea: 'satisfied', lesson: '', rating: 4, riskPct: 1 }),
  ];
}

/* =====================================================================
   AUTO-FILL 🪄 — the plug & play brain
===================================================================== */
window.openAddChooser = () => {
  $('#modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal-sheet" style="max-width:520px">
      <div class="modal-head"><div class="modal-title">Add trades ⚡</div>
        <button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="method-grid" style="grid-template-columns:1fr">
        <button class="choice-tile gold" onclick="closeModal();openAutofill()">
          <span class="ct-emoji">🪄</span>
          <span class="ct-title">AUTO-FILL <span style="font-size:11px;color:var(--gold);font-weight:700">· plug &amp; play</span></span>
          <span class="ct-desc">Feed me broker screenshots, MT4/MT5/CSV statements or pasted history — I'll extract the trades, you just approve. ${aiReady() ? '<b class="pos">AI connected ✓</b>' : 'Works offline with files; add a free AI key for screenshots.'}</span>
        </button>
        <button class="choice-tile" onclick="closeModal();openTradeForm()">
          <span class="ct-emoji">✍️</span>
          <span class="ct-title">Manual log</span>
          <span class="ct-desc">The classic. Full control, plan-vs-actual, psychology, screenshots — 60 seconds of honesty.</span>
        </button>
      </div>
    </div>
  </div>`;
};

const AF_MAX_SHOTS = 12;   // AUTO-FILL batch ceiling — parsed in rounds of 4 (free-tier vision safe)
const AF_BATCH = 2;   // v4.6.5: fewer images per request = more model attention per shot = fewer misread digits

window.openAutofill = () => {
  S.af = { method: null, images: [], text: '', hint: '', drafts: null, busy: false, status: '', via: '' };
  renderAutofill();
};

function renderAutofill() {
  const af = S.af;
  const defProfile = S.view !== 'all' ? S.view : S.profiles[0]?.id;
  const prof = profileById(defProfile);
  let body = '';
  if (!af.method) {
    body = `<div class="method-grid">
      <button class="choice-tile gold" onclick="afMethod('file')">
        <span class="ct-emoji">📄</span><span class="ct-title">⚡ Statement file — most reliable</span>
        <span class="ct-desc">MT4/MT5 report (.htm) or any CSV export — Weltrade MT5: <i>Toolbox → History → right-click → Report</i>. <b>No AI, no key, no rate limit, works offline.</b> Pick several at once.</span>
      </button>
      <button class="choice-tile ${aiReady() ? '' : ''}" onclick="afMethod('shots')">
        <span class="ct-emoji">📸</span><span class="ct-title">Screenshots${aiReady() ? '' : ' · needs key'}</span>
        <span class="ct-desc">Broker history, open/closed positions, P&amp;L cards, annotated charts. ${aiReady() ? 'AI reads it all (auto-waits rate limits).' : '<b class="neg">Needs an AI key</b> — set one up in Settings → AI AUTO-FILL.'}</span>
      </button>
      <button class="choice-tile" onclick="afMethod('paste')">
        <span class="ct-emoji">📋</span><span class="ct-title">Paste history</span>
        <span class="ct-desc">Copy your trade history text from the broker app and paste it. ${aiReady() ? 'AI untangles the mess.' : 'Basic auto-read; AI key makes it brilliant.'}</span>
      </button>
    </div>`;
  } else if (af.drafts === null) {
    body = afInputBody();
  } else {
    body = afDraftsBody();
  }
  $('#modalRoot').innerHTML = `
  <div class="modal-overlay">
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="modal-title">🪄 AUTO-FILL ${af.method ? '· ' + { shots: '📸 Screenshots', file: '📄 File import', paste: '📋 Paste' }[af.method] : ''}</div>
        <div>
          ${af.method ? '<button class="btn btn-ghost" style="padding:6px 12px;margin-right:8px" onclick="afBack()">← Back</button>' : ''}
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
      </div>
      ${afTargetBar(defProfile)}
      ${body}
    </div>
  </div>`;
  wireAutofill();
}
window.afMethod = m => { S.af.method = m; S.af.drafts = null; S.af.status = ''; S.af.transcript = ''; renderAutofill(); };
window.afBack = () => {
  if (S.af.drafts !== null) { S.af.drafts = null; renderAutofill(); }
  else if (S.af.method) { S.af.method = null; renderAutofill(); }
  else closeModal();
};

/* v4.6.1 BACKTEST TARGET: pick the destination account right here instead of
   silently inheriting the top-bar view. Backtesting from Main Account used to
   dump paper trades into live stats with no warning. */
function afTargetId() {
  const af = S.af;
  return (af.target && profileById(af.target)?.id) || (S.view !== 'all' ? S.view : S.profiles[0]?.id);
}
function afTargetBar() {
  const id = afTargetId();
  const p = profileById(id);
  const isPaper = p && (p.type === 'Demo' || /backtest|back test/i.test(p.name || ''));
  if (!S.profiles.length) return '';
  return `<div class="af-target">
    <span>Landing in</span>
    <select id="afTargetSel" onchange="afSetTarget(this.value)">
      ${S.profiles.map(x => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${x.emoji || '💼'} ${esc(x.name)} · ${esc(x.type || '')}</option>`).join('')}
    </select>
    ${isPaper ? '<span class="af-paper-tag">🧪 paper — won\'t touch live stats</span>' : ''}
  </div>`;
}
window.afSetTarget = id => { S.af.target = id; renderAutofill(); };

function afInputBody() {
  const af = S.af;
  if (af.method === 'shots') {
    return aiReady() ? `
      <div class="upload-drop" id="afDrop"><span class="big">🖼️</span>
        <span>Tap to add screenshots — history, positions, P&amp;L cards, charts (up to 12 — the more the AI sees, the richer the draft)</span>
        <input type="file" id="afInput" accept="image/*" multiple class="hidden"></div>
      <div class="af-preview" id="afPreview"></div>
      <div class="field mt"><label>Context for the AI (optional)</label>
        <input id="afHint" placeholder="e.g. These are my Weltrade MT5 closed positions from this week"></div>
      <div class="field mt"><label>🧪 Backtest date (optional)</label>
        <input id="afDate" type="date" value="${esc(S.af.defaultDate || '')}" onchange="S.af.defaultDate=this.value">
        <span class="hint">Backtesting an old chart? Set the day you're testing — trades the AI can't date itself land here instead of "today", so your history stays honest.</span></div>
      <button class="btn btn-primary btn-lg btn-block mt" id="afGo" disabled>🧠 Analyze with AI</button>
      <div class="af-status" id="afStatus"></div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px">💡 History/statements import fastest with everything visible. Charts: make sure symbol, direction &amp; prices are readable.</div>`
      : `<div class="no-key-note">🗝️ <b>Screenshot parsing needs an AI key</b> (free tiers work — takes 2 minutes).<br><br>
        <button class="btn btn-gold" onclick="closeModal();go('settings')">Set up free AI key →</button></div>
      <div style="margin-top:14px;font-size:13px;color:var(--muted)">Or skip AI entirely — a statement <b>file</b> imports with zero setup:</div>
      <button class="btn btn-block mt" onclick="afMethod('file')">📄 Use file import instead</button>`;
  }
  if (af.method === 'file') {
    return `
      <div class="upload-drop" id="afDrop"><span class="big">📄</span>
        <span>Tap to add files — MT4/MT5 report (.htm), CSV export, .txt, or a journal backup. <b>Pick several at once.</b></span>
        <input type="file" id="afInput" accept=".csv,.htm,.html,.txt,.json" multiple class="hidden"></div>
      <div class="af-preview" id="afPreview"></div>
      <div class="af-status" id="afStatus"></div>
      <div style="font-size:12px;color:var(--muted);margin-top:12px">
        <b>Weltrade / Deriv MT5:</b> open MT5 → Toolbox → <b>History</b> tab → right-click → <b>Report → HTML</b> (or CSV) → feed it here.<br><br>
        <b>No AI needed, no key, no rate limit.</b> The parser reads times, prices, SL/TP &amp; profit straight off the file — offline &amp; instant. ⚡
      </div>`;
  }
  return `
    <div class="field full"><label>Paste your history</label>
      <textarea id="afText" rows="8" placeholder="Paste trade history text here… e.g. lines like:\nVolatility 75 buy 1.0 6350.20 → 6358.70 profit 8.50\n\nOr dump whatever your broker shows — ${aiReady() ? 'AI will structure it.' : 'AI (with a key) can structure real mess.'}"></textarea></div>
    <div class="field full"><label>🧪 Backtest date (optional)</label>
      <input id="afDate" type="date" value="${esc(S.af.defaultDate || '')}" onchange="S.af.defaultDate=this.value">
      <span class="hint">Undated rows land on this day instead of today.</span></div>
    <div class="chips mt"><button class="btn btn-primary" id="afGo">${aiReady() ? '🧠 Parse with AI' : '⚡ Quick-parse'}</button>
      ${aiReady() ? '<button class="btn" id="afGoOffline">⚡ Offline (no AI)</button>' : ''}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px">⚡ Offline never rate-limits. One trade per line, e.g. <span class="mono">Volatility 75 buy 1.0 6350.20 → 6358.70 profit 8.50</span></div>
    <div class="af-status" id="afStatus"></div>`;
}

function afDraftsBody() {
  const af = S.af;
  if (!af.drafts.length) {
    return `<div class="empty"><div class="big">🌵</div><b>No trades found in that.</b><br><br>
      ${af.status ? esc(af.status) + '<br><br>' : ''}Try a clearer screenshot, a different file, or paste the raw text.</div>
      <button class="btn btn-block" onclick="afBack()">← Try again</button>`;
  }
  return `
    <div class="af-status" style="margin:0 0 12px"><b>${af.drafts.filter(d => !d.dup).length} new trades</b> found${af.drafts.some(d => d.dup) ? ` · ${af.drafts.filter(d => d.dup).length} already logged (skipped)` : ''}${af.via ? ` <span style="color:var(--muted)">· 🧠 answered by ${esc(af.via.split('/').pop())}</span>` : ''}.
      Review each one, or bulk-import:${af.images.length ? ` <span style="color:var(--muted)">📎 your ${af.images.length} shot${af.images.length > 1 ? 's' : ''} attach to each trade — shared setup, shared evidence (✕ any wrong ones in review)</span>` : ''}</div>
    ${af.drafts.map((d, i) => `
      <div class="draft-row ${d.dup ? 'dup' : ''}">
        <span style="font-size:20px">${d.dir === 'long' ? '🟢' : '🔴'}</span>
        <div class="dr-main">
          <div class="dr-title">${esc(d.pair)} · ${d.dir === 'long' ? 'Buy' : 'Sell'} ${d.lots ?? '—'} lot</div>
          <div class="dr-sub">${d.entry ?? '?'} → ${d.exit ?? '?'} ${d.date ? '· ' + fmtDate(d.date) : ''}${d.closedAt ? ' · held ' + (holdFmt(new Date(d.closedAt) - new Date(d.date)) || '?') : ''}${d.setup ? ' · ⚡ ' + esc(d.setup) : ''}</div>
          ${d.dup ? '<div class="dr-sub" style="color:var(--gold)">already in your journal — skip</div>' : ''}
        </div>
        <span class="mono ${cls(d.pnl)}" style="font-weight:800">${d.pnl != null ? money(d.pnl) : '~' + money(d.pnlEstimated)}</span>
        ${d.dup ? '' : `<button class="btn btn-ghost" style="padding:6px 12px" onclick="afReview(${i})">✏️</button>`}
      </div>`).join('')}
    ${af.transcript ? `<details class="af-ocr" style="margin-top:14px"><summary>🔍 What the AI actually read — check it before importing</summary>
      <pre class="af-ocr-pre">${esc(af.transcript)}</pre>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">If these numbers differ from your screenshot, ✏️ edit the trade below — or crop the shot tighter and re-run.</div></details>` : ''}
    <button class="btn btn-primary btn-lg btn-block mt" onclick="afImportAll()">⚡ Import all ${af.drafts.filter(d => !d.dup).length} new trades</button>
  `;
}

function wireAutofill() {
  const af = S.af;
  const drop = $('#afDrop'), input = $('#afInput');
  if (drop && input) {
    drop.onclick = () => input.click();
    if (af.method === 'shots') {
      input.onchange = async e => {
        const files = [...e.target.files];
        const room = Math.max(0, AF_MAX_SHOTS - af.images.length);
        if (files.length > room) toast(`📸 Max ${AF_MAX_SHOTS} screenshots per batch — extra ${files.length - room} skipped`);
        for (const f of files.slice(0, room)) {
          try {
            const enc = await encodeForAI(f);
            af.images.push({ data: enc.data, ext: enc.ext, preview: enc.preview });
          } catch (err) { toast('⚠️ Couldn\'t read an image'); }
        }
        e.target.value = '';
        renderAfPreview();
      };
    } else if (af.method === 'file') {
      // v4.6.0: multi-file intake — CSV + HTML + txt all at once, merged into one draft set.
      input.onchange = async e => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        const status = $('#afStatus');
        let all = [], names = [], empties = [];
        for (const f of files) {
          status.innerHTML = `Reading <b>${esc(f.name)}</b>… ⚙️`;
          let text = '';
          try { text = await f.text(); } catch { empties.push(f.name); continue; }
          let found = [];
          try { found = (window.MJParse ? MJParse.auto(text, f.name) : []) || []; }
          catch (pe) { console.warn('parse failed', f.name, pe); }
          const norm = found.map(normalizeDraftForApp).filter(Boolean);
          if (norm.length) { all = all.concat(norm); names.push(`${f.name} (${norm.length})`); }
          else empties.push(f.name);
        }
        af.drafts = markDups(all);
        af.status = all.length
          ? `📄 ${names.join(' · ')} — merged.`
          : `I read ${files.length} file${files.length > 1 ? 's' : ''} but found no trade rows. For MT5, use Toolbox → History → right-click → Report (HTML or CSV), and make sure the Positions table is in it.`;
        renderAutofill();
      };
    }
  }
  const off = $('#afGoOffline');
  if (off) off.onclick = () => {
    const text = $('#afText').value.trim();
    if (!text) return toast('⚠️ Paste something first');
    const drafts = (window.MJParse ? MJParse.parseLoose(text) : []).map(normalizeDraftForApp).filter(Boolean);
    af.drafts = markDups(drafts);
    af.status = drafts.length ? '' : 'No trades recognised. Try one per line: Symbol buy/sell lots entry → exit profit';
    renderAutofill();
  };
  const go = $('#afGo');
  if (go) {
    go.onclick = async () => {
      if (af.method === 'paste') {
        const text = $('#afText').value.trim();
        if (!text) return toast('⚠️ Paste something first');
        if (aiReady()) return runAIParse({ text });
        const drafts = (window.MJParse ? MJParse.parseLoose(text) : []).map(normalizeDraftForApp).filter(Boolean);
        af.drafts = markDups(drafts);
        af.status = drafts.length ? '' : 'Quick-parse found nothing it trusted. Add a free AI key (Settings → AI AUTO-FILL) and I can read almost anything.';
        renderAutofill();
      } else if (af.method === 'shots') {
        if (!af.images.length) return toast('⚠️ Add a screenshot first');
        const originals = af.images.map(i => ({ data: i.data, ext: i.ext, preview: i.preview }));
        const status = $('#afStatus');
        if (status) status.innerHTML = 'Preparing screenshots for the most accurate read… 🔍';
        // v4.6.8: split big/dense shots into bands so the OCR reads each at full detail.
        // Only tile when every shot still fits in the send budget (8) — coverage of ALL
        // screenshots always beats sharper reading of some.
        const MAX_SENT = 12; // matches AF_MAX_SHOTS — every screenshot is always sent
        let analysis = [];
        const canTileAll = originals.length * 2 <= MAX_SENT;
        if (canTileAll) {
          for (const im of originals) analysis.push(...await tilesForAnalysis(im, MAX_SENT - analysis.length));
        } else {
          analysis = originals.slice(0, MAX_SENT);
        }
        analysis = analysis.slice(0, MAX_SENT);
        if (analysis.length > originals.length && status) status.innerHTML = `🔍 Split ${originals.length} large screenshot${originals.length > 1 ? 's' : ''} into ${analysis.length} bands for a sharper read… ⏳`;
        runAIParse({ images: analysis, attach: originals });
      }
    };
  }
}

function renderAfPreview() {
  const af = S.af;
  const el = $('#afPreview'); if (!el) return;
  el.innerHTML = af.images.map((im, i) => `
    <div class="af-img"><img src="${im.preview}" alt=""><button onclick="S.af.images.splice(${i},1);renderAfPreview()">✕</button></div>`).join('')
    + (af.images.length
      ? `<div style="font-size:12px;color:var(--muted);margin-top:8px">${af.images.length}/${AF_MAX_SHOTS} loaded${af.images.length > AF_BATCH ? ` · AI will read them in ${Math.ceil(af.images.length / AF_BATCH)} rounds` : ''} · ✕ removes one</div>`
      : '');
  const go = $('#afGo'); if (go) go.disabled = !af.images.length;
}

// fuzzy-match two raw AI trade extractions (same row visible across overlapping screenshots)
function rawTradeSame(a, b) {
  const pa = String(a.pair || a.symbol || a.instrument || '').toLowerCase();
  const pb = String(b.pair || b.symbol || b.instrument || '').toLowerCase();
  if (pa && pb && pa !== pb) return false;
  const da = /sell|short/i.test(a.dir || a.type || '') ? 'short' : 'long';
  const db = /sell|short/i.test(b.dir || b.type || '') ? 'short' : 'long';
  if (da !== db) return false;
  const ea = num(a.entry ?? a.openPrice ?? a.open), eb = num(b.entry ?? b.openPrice ?? b.open);
  if (ea != null && eb != null && Math.abs(ea - eb) > Math.max(1e-9, Math.abs(ea) * 0.002)) return false;
  const ta = String(a.openTime || a.date || a.time || '');
  const tb = String(b.openTime || b.date || b.time || '');
  return ta === tb || !ta || !tb;
}

async function runAIParse({ images = [], text = '', attach = null }) {
  const af = S.af;
  const status = $('#afStatus'), go = $('#afGo');
  af.busy = true;
  if (go) { go.disabled = true; go.textContent = '🧠 AI is reading…'; }
  // v4.6.0: the server now auto-waits the free-tier bouncer, so a slow reply is normal.
  if (status) status.innerHTML = 'Extracting trades… ⏳ <span style="color:var(--muted)">(if the provider rate-limits us, I wait and retry automatically — up to ~90s. Don\'t press twice.)</span>';
  try {
    const hint = $('#afHint') ? $('#afHint').value.trim() : '';
    // v4.6.1: remember the backtest date so undated chart trades land on the tested day.
    const dt = $('#afDate') ? $('#afDate').value : '';
    if (dt) S.af.defaultDate = dt;
    // multi-shot mode: free-tier vision caps ~5 images/request, so feed in rounds of 4 and merge
    let tradesRaw = [];
    if (images.length) {
      const rounds = [];
      for (let i = 0; i < images.length; i += AF_BATCH) rounds.push(images.slice(i, i + AF_BATCH));
      for (let r = 0; r < rounds.length; r++) {
        if (status) status.innerHTML = rounds.length > 1
          ? `🧠 AI reading round ${r + 1}/${rounds.length} of your screenshots… ⏳`
          : 'Extracting trades… this takes a few seconds ⏳';
        const res = await api('/api/ai-parse', 'POST', { images: rounds[r], hint });
        if (res.via) af.via = res.via;
        if (res.transcript) af.transcript = (af.transcript ? af.transcript + '\n\n' : '') + res.transcript;
        for (const d of (res.trades || [])) {
          if (!tradesRaw.some(x => rawTradeSame(x, d))) tradesRaw.push(d); // same trade on 2 screenshots = one draft
        }
      }
    } else {
      const res = await api('/api/ai-parse', 'POST', { images: [], text, hint });
      if (res.via) af.via = res.via;
      if (res.transcript) af.transcript = res.transcript;
      tradesRaw = res.trades || [];
    }
    const raw = tradesRaw.map(d => {
      // AI field names → our schema
      const d2 = {
        pair: d.pair || d.symbol || d.instrument,
        dir: /sell|short/i.test(d.dir || d.type || '') ? 'short' : 'long',
        lots: d.lots ?? d.volume ?? d.size,
        entry: d.entry ?? d.openPrice ?? d.open,
        exit: d.exit ?? d.closePrice ?? d.close,
        sl: d.sl, tp: d.tp,
        date: (window.MJParse ? MJParse.isoFromLoose(d.openTime || d.date || d.time) : '') || d.date,
        closedAt: window.MJParse ? MJParse.isoFromLoose(d.closeTime || d.closedAt) : (d.closedAt || ''),
        pnl: d.pnl ?? d.profit,
        setup: d.setup || '',
      };
      return normalizeDraftForApp(d2);
    }).filter(Boolean);
    af.drafts = markDups(raw);
    if ((attach || images).length) af.drafts.forEach(d => { d._shots = attach || images; }); // always save the ORIGINALS, never the tiles
    af.status = raw.length ? '' : 'The AI looked but found no trades it trusted. Add a hint or a clearer crop.';
    renderAutofill();
  } catch (e) {
    af.busy = false;
    if (status) status.innerHTML = `<span class="neg">✗ ${esc(e.message)}</span>`;
    if (e.code === 'NO_KEY' && status) status.innerHTML += `<br><button class="btn btn-gold mt" onclick="closeModal();go('settings')">Set up AI key →</button>`;
    // v4.6.0: never dead-end on AI trouble — the offline file lane always works.
    if (e.code !== 'NO_KEY' && status) {
      status.innerHTML += `<br><br><span style="color:var(--muted)">Don't want to fight the AI at all?</span><br>
        <button class="btn btn-gold mt" onclick="afMethod('file')">📄 Import a statement file instead — no AI, no limits ⚡</button>`;
    }
    if (go) { go.disabled = false; go.textContent = '🧠 Analyze with AI'; }
  }
}

function normalizeDraftForApp(d) {
  if (!d || !d.pair) return null;
  const canon = SYMBOLS.find(s => s.toLowerCase() === String(d.pair).toLowerCase()) || String(d.pair).trim();
  const n = computeNumbers({
    pair: canon, dir: d.dir || 'long', lots: d.lots ?? 1, entry: d.entry, exit: d.exit, sl: d.sl, tp: d.tp,
    pnlOverride: d.pnl != null ? String(d.pnl) : '',
  });
  const finalPnl = d.pnl != null ? num(d.pnl) : n.pnlEstimated;
  if (d.entry == null && finalPnl == null) return null;
  // v4.6.1: backtest charts often show no date — use the tested day instead of "now",
  // so a backtested setup lands on the day you were actually testing.
  let date = d.date || new Date().toISOString();
  if (!d.date && S.af && S.af.defaultDate) {
    const noon = new Date(S.af.defaultDate + 'T12:00:00');
    if (!isNaN(noon.getTime())) date = noon.toISOString();
  }
  return {
    ...d, pair: canon, dir: d.dir === 'short' ? 'short' : 'long',
    lots: d.lots ?? 1, entry: num(d.entry), exit: num(d.exit), sl: num(d.sl), tp: num(d.tp),
    date, closedAt: d.closedAt || null,
    pnl: finalPnl, pnlEstimated: n.pnlEstimated, pips: n.pips,
    riskAmount: n.riskAmount, rMultiple: n.rMultiple, rrPlanned: n.rrPlanned,
    setup: d.setup || suggestSetup(canon),
  };
}
function suggestSetup(pair) {
  const same = S.trades.filter(t => t.pair === pair && t.setup);
  if (!same.length) return '';
  const counts = {};
  same.forEach(t => counts[t.setup] = (counts[t.setup] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
function markDups(drafts) {
  return drafts.map(d => {
    const dup = S.trades.some(t =>
      t.pair.toLowerCase() === String(d.pair).toLowerCase() &&
      d.entry != null && t.entry != null && Math.abs(t.entry - d.entry) < pointSize(d.pair) * 0.5 &&
      d.exit != null && t.exit != null && Math.abs(t.exit - d.exit) < pointSize(d.pair) * 0.5 &&
      Math.abs(new Date(t.date) - new Date(d.date)) < 120000
    );
    return { ...d, dup };
  });
}
window.afReview = (i) => {
  const d = S.af.drafts[i];
  if (!d || d.dup) return;
  openTradeForm(null, d);
};
/* v4.6.7: the AI gets a lossless PNG (accuracy), but the copy we SAVE is a compact JPEG.
   Reason: the cloud vault only carries files under 3MB, so a 5MB PNG never got backed up —
   and Render wipes /uploads on every deploy. Small JPEGs always vault, always survive. */
async function toStorageImage(sh) {
  if (sh.ext !== '.png') return { data: sh.data, ext: sh.ext || '.jpg' };
  try {
    const src = (sh.preview && sh.preview.startsWith('data:')) ? sh.preview : 'data:image/png;base64,' + sh.data;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height)); // v4.6.8: store a sharper copy — still ~500KB, always vaults
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL('image/jpeg', 0.9).split(',')[1], ext: '.jpg' };
  } catch (e) { return { data: sh.data, ext: sh.ext || '.jpg' }; }
}

async function uploadStagedShots(shots) {
  const out = [];
  for (const sh of shots) {
    try {
      const store = await toStorageImage(sh);
      const res = await api('/api/upload', 'POST', { data: store.data, ext: store.ext });
      out.push({ url: res.url, cat: 'Analysis', caption: '' });
    } catch (e) { /* screenshot attach is best-effort */ }
  }
  return out;
}

window.afImportAll = async () => {
  const fresh = S.af.drafts.filter(d => !d.dup);
  if (!fresh.length) return;
  // same-pair, same-day drafts from one batch = one wave (pyramid family) — auto-stitch
  const byPk = {};
  fresh.forEach(d => { const k = d.pair + '|' + String(d.date).slice(0, 10); (byPk[k] = byPk[k] || []).push(d); });
  Object.values(byPk).forEach(g => {
    if (g.length < 2) return;
    g.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const wn = `${g[0].pair} · ${new Date(g[0].date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
    g.forEach((d, i) => { d.wave = wn; d.waveRole = i === 0 ? 'initial' : 'add'; });
  });
  const defProfile = afTargetId(); // v4.6.1: the account picked in AUTO-FILL, not the top bar
  let done = 0, shotsAttached = 0;
  for (const d of fresh) {
    const date = new Date(d.date);
    const trade = {
      profileId: defProfile, date: d.date, closedAt: d.closedAt || null,
      pair: d.pair, dir: d.dir, lots: d.lots, entry: d.entry, exit: d.exit,
      sl: d.sl, tp: d.tp, pips: d.pips, pnlEstimated: d.pnlEstimated,
      pnl: d.pnl, pnlOverridden: d.pnl != null && d.pnl !== d.pnlEstimated,
      riskAmount: d.riskAmount, rMultiple: d.rMultiple, rrPlanned: d.rrPlanned,
      session: blockFromHour(date.getHours()), setup: d.setup || '',
      rules: {}, mistakes: [], lesson: '', notes: '', screenshots: [],
      wave: d.wave || null, waveRole: d.waveRole || null,
      imported: true,
    };
    if (d._shots && d._shots.length) {
      trade.screenshots = await uploadStagedShots(d._shots);
      shotsAttached += trade.screenshots.length;
    }
    await api('/api/trade', 'POST', trade);
    done++;
  }
  await loadState(); closeModal(); renderAll();
  toast(`🪄 ${done} trades AUTO-FILLED!${shotsAttached ? ` 📎 ${shotsAttached} screenshots attached` : ''}`, 'gold'); confettiBurst();
  go('journal');
};

/* ---------------- Trade form ---------------- */
function waveDatalist() {
  const names = [...new Set(S.trades.map(x => x.wave).filter(Boolean))];
  return `<datalist id="wavesList">${names.map(w => `<option>${esc(w)}</option>`).join('')}</datalist>`;
}

let formDir = 'long';
let shotsTmp = [];
let shotsBusy = 0;

window.openTradeForm = (id, prefill) => {
  const t = id ? S.trades.find(x => x.id === id) : (prefill || null);
  if (!S.profiles.length) return toast('Create an account first — tap "＋ New account" up top 🏦');
  formDir = t ? t.dir : 'long';
  shotsTmp = (t?.screenshots || []).map(s => ({ ...s }));
  shotsBusy = 0;
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const v = k => t ? (t[k] ?? '') : '';
  const selEmo = (list, cur) => list.map(([val, lbl]) =>
    `<button type="button" class="chip-toggle ${cur === val ? 'on' : ''}" data-group="${list === EMOTIONS_BEFORE ? 'emoB' : 'emoA'}" data-val="${val}">${lbl}</button>`).join('');
  const rules = S.settings.rules || [];
  const setups = [...new Set([...SETUP_IDEAS, ...S.trades.map(x => x.setup).filter(Boolean)])];
  const defProfile = t?.profileId || (S.view !== 'all' ? S.view : S.profiles[0].id);
  const tfSel = (idSel, cur) => `<select id="${idSel}"><option value="">—</option>${TFS.map(tf => `<option ${cur === tf ? 'selected' : ''}>${tf}</option>`).join('')}</select>`;

  $('#modalRoot').innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="modal-title">${id ? '✏️ Edit trade' : prefill ? '🪄 Review AUTO-FILL draft' : '⚡ Log a trade'}</div>
        <div>
          ${id ? '<button class="btn btn-danger" style="padding:6px 12px;margin-right:8px" onclick="deleteTrade(\'' + id + '\')">🗑</button>' : ''}
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
      </div>
      <form id="tradeForm" onsubmit="saveTrade(event,'${id || ''}')">
        <div class="sec-label">📋 The basics</div>
        <div class="form-grid">
          <div class="field"><label>🏦 Account</label>
            <select id="f-profile">${S.profiles.map(p => `<option value="${p.id}" ${defProfile === p.id ? 'selected' : ''}>${p.emoji || '💼'} ${esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Index / symbol</label>
            <input id="f-pair" list="pairsList" placeholder="Volatility 75" required value="${esc(v('pair'))}">
            <datalist id="pairsList">${SYMBOLS.map(p => `<option>${p}</option>`).join('')}</datalist></div>
          <div class="field"><label>Entry time</label>
            <input type="datetime-local" id="f-date" required value="${t && t.date ? String(t.date).slice(0, 16) : now.toISOString().slice(0, 16)}"></div>
          <div class="field"><label>Exit time <span style="opacity:.6">(for hold stats ⏱)</span></label>
            <input type="datetime-local" id="f-closedAt" value="${v('closedAt') ? String(v('closedAt')).slice(0, 16) : ''}"></div>
          <div class="field"><label>Direction</label>
            <div class="seg" style="display:flex">
              <button type="button" id="dirLong" onclick="setDir('long')">▲ Buy</button>
              <button type="button" id="dirShort" onclick="setDir('short')">▼ Sell</button>
            </div></div>
          <div class="field"><label>Lot size</label><input type="number" step="any" id="f-lots" placeholder="1" required value="${v('lots') || 1}"></div>
          <div class="field"><label>Entry price (actual)</label><input type="number" step="any" id="f-entry" required value="${v('entry')}"></div>
          <div class="field"><label>Exit price (actual)</label><input type="number" step="any" id="f-exit" required value="${v('exit')}"></div>
          <div class="field full" style="margin-top:2px"><label class="runchk"><input type="checkbox" id="f-running" ${t && t.running ? 'checked' : ''}> 🏃 <b>Still running</b> — no exit yet · journal shows planned R:R + $-at-risk until you close it</label></div>
        </div>

        <div class="sec-label">🎯 The plan <span style="color:var(--muted);text-transform:none;font-weight:500">— so the journal can check if you followed it</span></div>
        <div class="form-grid">
          <div class="field"><label>Planned entry <span style="opacity:.6">(optional)</span></label><input type="number" step="any" id="f-plannedEntry" placeholder="Where you SAID you'd enter" value="${v('plannedEntry')}"></div>
          <div class="field"><label>Risk % <span style="opacity:.6">(optional)</span></label><input type="number" step="any" id="f-riskPct" placeholder="1" value="${v('riskPct')}"></div>
          <div class="field"><label>Planned SL</label><input type="number" step="any" id="f-sl" value="${v('sl') ?? ''}"></div>
          <div class="field"><label>Final SL <span style="opacity:.6">(if moved)</span></label><input type="number" step="any" id="f-actualSL" placeholder="Same as planned = good" value="${v('actualSL') ?? ''}"></div>
          <div class="field"><label>Planned TP</label><input type="number" step="any" id="f-tp" value="${v('tp') ?? ''}"></div>
        </div>
        <div class="calc-strip" id="calcStrip"></div>
        <div class="form-grid">
          <div class="field full"><label>💵 P&L override ($) — leave blank for auto (points × lots)</label>
            <input type="number" step="any" id="f-pnlOverride" placeholder="Auto" value="${t && (t.pnlOverridden || (prefill && t.pnl != null)) ? t.pnl : ''}">
            <span class="hint">Auto: synthetics = price diff × lots. Override with the broker's exact number for precision.</span></div>
        </div>

        <div class="sec-label">⚡ Setup & context <span style="color:var(--muted);text-transform:none;font-weight:500">— this feeds the Setup Lab 🧪</span></div>
        <div class="form-grid">
          <div class="field"><label>Setup / strategy</label>
            <input id="f-setup" list="setupsList" placeholder="Quasimodo…" value="${esc(v('setup'))}">
            <datalist id="setupsList">${setups.map(s => `<option>${esc(s)}</option>`).join('')}</datalist></div>
          <div class="field"><label>Time block <span style="opacity:.6">(24/7!)</span></label>
            <select id="f-session">${TIME_BLOCKS.map(s => `<option ${v('session') === s ? 'selected' : ''}>${s}</option>`).join('')}
            ${v('session') && !TIME_BLOCKS.includes(v('session')) ? `<option selected>${esc(v('session'))}</option>` : ''}</select></div>
          <div class="field"><label>Timeframe — analysis</label>${tfSel('f-atf', v('analysisTF'))}</div>
          <div class="field"><label>Timeframe — execution</label>${tfSel('f-etf', v('executionTF'))}</div>
          <div class="field"><label>🌊 Wave / position <span style="opacity:.6">(pyramid family, optional)</span></label>
            <input id="f-wave" list="wavesList" placeholder="e.g. FX Vol 60 short · 22 Sep" value="${esc(v('wave') || '')}">${waveDatalist()}</div>
          <div class="field"><label>Leg role</label>
            <select id="f-waveRole">${[['initial', '🥇 Initial entry'], ['add', '➕ Add-on / scale-in'], ['partial', '➗ Partial close']].map(([r, lbl]) => `<option value="${r}" ${(v('waveRole') || 'initial') === r ? 'selected' : ''}>${lbl}</option>`).join('')}</select>
            <span class="hint">Same wave name stitches legs into one position card.</span></div>
          <div class="field full"><label>Setup quality</label>
            <div class="stars" id="f-stars">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-star="${i}" class="${(v('rating') || 0) >= i ? 'lit' : ''}">⭐</button>`).join('')}</div>
            <input type="hidden" id="f-rating" value="${v('rating') || 0}"></div>
        </div>

        <div class="sec-label">📸 Charts <span style="color:var(--muted);text-transform:none;font-weight:500">— analysis, entry, outcome (+${XP_SCREENSHOT} XP)</span></div>
        <div id="shotsList"></div>
        <div class="upload-drop" id="uploadDrop">
          <span class="big">🖼️</span>
          <span id="uploadLabel">Tap to add chart screenshots</span>
          <input type="file" id="shotInput" accept="image/*" multiple class="hidden">
        </div>

        <div class="sec-label">🧠 Psychology</div>
        <div class="field full mb"><label>Feeling before entry</label><div class="chips" id="emoBChips">${selEmo(EMOTIONS_BEFORE, v('emotionBefore'))}</div></div>
        <div class="field full mb"><label>Feeling after exit</label><div class="chips" id="emoAChips">${selEmo(EMOTIONS_AFTER, v('emotionAfter'))}</div></div>

        <div class="sec-label">📜 My rules — tick what you actually followed</div>
        <div id="rulesChecklist">
          ${rules.map((r, i) => { const on = t && t.rules ? !!t.rules[r] : true; return `
          <div class="rule-row ${on ? 'ok' : ''}" data-rule-row="${i}">
            <span class="tick">${on ? '✅' : '⬜'}</span><span style="flex:1">${esc(r)}</span>
          </div>`; }).join('')}
        </div>
        <div class="sec-label">⚠️ Mistakes made</div>
        <div class="chips" id="mistakeChips">${MISTAKES.map(m => `<button type="button" class="chip-toggle ${(t?.mistakes || []).includes(m) ? 'on-neg' : ''}" data-mistake="${esc(m)}">${esc(m)}</button>`).join('')}</div>

        <div class="sec-label">📚 Reflection (+${XP_LESSON} XP)</div>
        <div class="form-grid">
          <div class="field full"><label>Lesson — what did this trade teach you?</label>
            <textarea id="f-lesson" placeholder="e.g. Quasimodo only respects my morning block…">${esc(v('lesson'))}</textarea></div>
          <div class="field full"><label>Notes</label>
            <textarea id="f-notes" placeholder="HTF bias, confluences, news, anything…">${esc(v('notes'))}</textarea></div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block mt">💾 ${id ? 'Save changes' : 'Log it & earn ' + XP_PER_TRADE + ' XP'}</button>
      </form>
    </div>
  </div>`;

  setDir(formDir);
  const updCalc = () => updateCalcStrip();
  ['f-pair', 'f-lots', 'f-entry', 'f-exit', 'f-sl', 'f-tp', 'f-actualSL', 'f-plannedEntry', 'f-pnlOverride'].forEach(id2 => $('#' + id2).addEventListener('input', updCalc));
  updCalc();
  renderShotRows();
  $('#uploadDrop').onclick = () => $('#shotInput').click();
  $('#shotInput').onchange = async e => {
    for (const f of [...e.target.files]) await uploadShot(f);
    e.target.value = '';
  };
  // AUTO-FILL: attach the screenshots that produced this draft
  if (prefill && prefill._shots && prefill._shots.length) {
    prefill._shots.forEach(async sh => {
      try {
        const res = await api('/api/upload', 'POST', { data: sh.data, ext: sh.ext || '.jpg' });
        shotsTmp.push({ url: res.url, cat: 'Analysis', caption: '' });
        renderShotRows();
      } catch (err) { /* image attach best-effort */ }
    });
  }
  $$('#emoBChips .chip-toggle, #emoAChips .chip-toggle').forEach(ch => ch.onclick = () => {
    const g = ch.dataset.group;
    $$(`#emo${g === 'emoB' ? 'B' : 'A'}Chips .chip-toggle`).forEach(x => x.classList.remove('on'));
    ch.classList.add('on');
  });
  $$('#mistakeChips .chip-toggle').forEach(ch => ch.onclick = () => ch.classList.toggle('on-neg'));
  $$('#rulesChecklist .rule-row').forEach(row => row.onclick = () => {
    const on = !row.classList.contains('ok');
    row.classList.toggle('ok', on);
    row.querySelector('.tick').textContent = on ? '✅' : '⬜';
  });
  $$('#f-stars button').forEach(b => b.onclick = () => {
    $('#f-rating').value = b.dataset.star;
    $$('#f-stars button').forEach(x => x.classList.toggle('lit', x.dataset.star <= b.dataset.star));
  });
};

function renderShotRows() {
  const el = $('#shotsList'); if (!el) return;
  el.innerHTML = shotsTmp.map((sh, i) => `
    <div class="shot-row">
      <img src="${sh.url}" alt="">
      <div class="col">
        <select onchange="shotsTmp[${i}].cat=this.value">${SHOT_CATS.map(c => `<option ${sh.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input placeholder="Caption… e.g. H1 QM, right shoulder into M15 OB" value="${esc(sh.caption || '')}" oninput="shotsTmp[${i}].caption=this.value">
      </div>
      <button type="button" class="btn btn-ghost btn-danger" style="padding:4px 10px" onclick="shotsTmp.splice(${i},1);renderShotRows()">✕</button>
    </div>`).join('');
}
window.shotsTmp = shotsTmp;

/* v4.6.8 — accuracy without losing the vault.
   • PC screenshots stay near-native (up to 2400px) so dense history tables stay legible
   • Lossless PNG whenever the payload fits; high-quality JPEG only as a size safety valve
   • Tiny phone crops get gently upscaled — 12B vision models read small text better when
     it is actually large
   Storage is a separate, compact copy (see toStorageImage) so nothing here risks the vault. */
const AI_MAX_PNG_BYTES = 3.5e6;
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function encodeCanvas(cv, mime, q) { return { b64: cv.toDataURL(mime, q).split(',')[1], mime }; }
async function encodeForAI(file) {
  try {
    const raw = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
    const img = await loadImg(raw);
    const long = Math.max(img.width, img.height);
    // keep native resolution unless it is genuinely huge; upscale very small crops
    let scale = long > 2400 ? 2400 / long : (long < 1000 ? Math.min(2, 1400 / long) : 1);
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    let out = encodeCanvas(cv, 'image/png');
    if (out.b64.length * 0.75 > AI_MAX_PNG_BYTES) out = encodeCanvas(cv, 'image/jpeg', 0.92); // size safety valve
    const ext = out.mime === 'image/png' ? '.png' : '.jpg';
    return { data: out.b64, ext, preview: 'data:' + out.mime + ';base64,' + out.b64 };
  } catch (e) {
    const data = await compressImage(file, 1800, 0.95, 'image/png');
    return { data, ext: '.png', preview: 'data:image/png;base64,' + data };
  }
}

/* v4.6.8 TILING: a tall phone screenshot of a trade history, or a wide PC statement, packs
   far more text than one pass can read cleanly. Splitting along the long axis (with a small
   overlap so no row is cut in half) lets the OCR read each band at full detail. */
async function tilesForAnalysis(im, budget) {
  try {
    const src = (im.preview && im.preview.startsWith('data:')) ? im.preview : 'data:image/png;base64,' + im.data;
    const img = await loadImg(src);
    const area = img.width * img.height;
    const long = Math.max(img.width, img.height);
    if (budget <= 0 || area < 1.2e6 || long < 1400) return [im];   // small/clean → send whole
    const vertical = img.height >= img.width;
    const overlap = Math.round(long * 0.08);
    const half = Math.ceil((long + overlap) / 2);
    const tiles = [];
    for (let i = 0; i < 2; i++) {
      const start = Math.max(0, i * (half - overlap));
      const sw = vertical ? img.width : Math.min(half, img.width - start);
      const sh = vertical ? Math.min(half, img.height - start) : img.height;
      if (sw <= 0 || sh <= 0) continue;
      const cv = document.createElement('canvas');
      cv.width = sw; cv.height = sh;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, vertical ? 0 : start, vertical ? start : 0, sw, sh, 0, 0, sw, sh);
      let out = encodeCanvas(cv, 'image/png');
      if (out.b64.length * 0.75 > AI_MAX_PNG_BYTES) out = encodeCanvas(cv, 'image/jpeg', 0.92);
      tiles.push({ data: out.b64, ext: out.mime === 'image/png' ? '.png' : '.jpg' });
    }
    return tiles.length === 2 ? tiles : [im];
  } catch (e) { return [im]; }
}

function compressImage(file, maxDim = 1600, quality = 0.82, mime = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        // PNG ignores `quality` — it's always lossless, which is the point for screenshots
        resolve(cv.toDataURL(mime, quality).split(',')[1]);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function uploadShot(file) {
  if (!file.type.startsWith('image/')) return toast('⚠️ That is not an image');
  try {
    shotsBusy++;
    if ($('#uploadLabel')) $('#uploadLabel').textContent = `Uploading… (${shotsBusy})`;
    const b64 = await compressImage(file);
    const res = await api('/api/upload', 'POST', { data: b64, ext: '.jpg' });
    shotsTmp.push({ url: res.url, cat: 'Analysis', caption: '' });
    renderShotRows();
  } catch (e) { toast('⚠️ Upload failed'); }
  finally {
    shotsBusy--;
    if ($('#uploadLabel')) $('#uploadLabel').textContent = 'Tap to add chart screenshots';
  }
}
window.setDir = d => {
  formDir = d;
  const L = $('#dirLong'), Sh = $('#dirShort');
  if (!L) return;
  L.className = d === 'long' ? 'on-long' : '';
  Sh.className = d === 'short' ? 'on-short' : '';
  updateCalcStrip();
};
function formVals() {
  const g = id => ($('#' + id) || {}).value;
  return {
    date: g('f-date'), pair: g('f-pair'), dir: formDir, lots: g('f-lots'),
    entry: g('f-entry'), exit: g('f-exit'), sl: g('f-sl'), tp: g('f-tp'),
    actualSL: g('f-actualSL'), plannedEntry: g('f-plannedEntry'),
    pnlOverride: g('f-pnlOverride'),
  };
}
function updateCalcStrip() {
  const strip = $('#calcStrip'); if (!strip) return;
  const f = formVals();
  const n = computeNumbers(f);
  const item = (k, v, c) => `<div class="ci"><div class="k">${k}</div><div class="v mono ${c || ''}">${v}</div></div>`;
  const pnlShow = f.pnlOverride !== '' && num(f.pnlOverride) != null
    ? item('P&L (manual)', money(num(f.pnlOverride)), cls(num(f.pnlOverride)))
    : item('Est. P&L', n.pnlEstimated == null ? '—' : '~' + money(n.pnlEstimated), cls(n.pnlEstimated));
  const sim = {
    pair: f.pair, dir: formDir, lots: num(f.lots), entry: num(f.entry), exit: num(f.exit),
    sl: num(f.sl), actualSL: num(f.actualSL), tp: num(f.tp), plannedEntry: num(f.plannedEntry),
    pnl: f.pnlOverride !== '' && num(f.pnlOverride) != null ? num(f.pnlOverride) : n.pnlEstimated,
  };
  const m = planMetrics(sim);
  const planBits =
    (m.pctCaptured != null && sim.pnl > 0 ? item('% of plan', m.pctCaptured + '%' + (m.reachedTP ? ' 🎯' : ''), m.reachedTP ? 'pos' : m.pctCaptured >= 60 ? '' : 'neg') : '') +
    (m.slMoved ? item('SL moved', m.slWorse ? 'YES 🚨' : 'trailed 🧲', m.slWorse ? 'neg' : 'pos') : '') +
    (m.chasedEntry ? item('Entry drift', '+' + m.entryDriftPts + ' pts 🏃', 'neg') : '');
  strip.innerHTML =
    item('Points', ptsFmt(n.pips), cls(n.pips)) +
    pnlShow +
    (n.riskAmount ? item('Risk', money(-n.riskAmount), 'neg') : '') +
    (n.rrPlanned ? item('Planned R:R', '1 : ' + n.rrPlanned) : '') +
    (n.rMultiple != null ? item('R multiple', (n.rMultiple > 0 ? '+' : '') + n.rMultiple + 'R', cls(n.rMultiple)) : '') +
    planBits;
}
window.saveTrade = async (e, id) => {
  e.preventDefault();
  if (shotsBusy) return toast('⏳ Wait for uploads to finish…');
  const f = formVals();
  const pair = (f.pair || '').trim();
  if (!pair) return toast('⚠️ Which index was it?');
  const n = computeNumbers(f);
  const rules = {};
  $$('#rulesChecklist .rule-row').forEach(row => {
    rules[S.settings.rules[+row.dataset.ruleRow]] = row.classList.contains('ok');
  });
  const emoB = $('#emoBChips .chip-toggle.on'), emoA = $('#emoAChips .chip-toggle.on');
  const finalPnl = f.pnlOverride !== '' && num(f.pnlOverride) != null ? num(f.pnlOverride) : n.pnlEstimated;
  const beforeXP = calcStats(S.trades, totalBalance()).xp;
  const profileId = $('#f-profile').value;
  const trade = {
    ...(id ? S.trades.find(t => t.id === id) : {}),
    profileId,
    date: new Date(f.date).toISOString(),
    closedAt: $('#f-closedAt').value ? new Date($('#f-closedAt').value).toISOString() : null,
    pair, dir: formDir,
    lots: num(f.lots), riskPct: num($('#f-riskPct').value),
    plannedEntry: num(f.plannedEntry),
    entry: num(f.entry), exit: num(f.exit),
    sl: num(f.sl), actualSL: num(f.actualSL), tp: num(f.tp),
    pips: n.pips, pnlEstimated: n.pnlEstimated,
    pnl: finalPnl, pnlOverridden: f.pnlOverride !== '' && num(f.pnlOverride) != null,
    riskAmount: n.riskAmount, rMultiple: n.rMultiple, rrPlanned: n.rrPlanned,
    session: $('#f-session').value, setup: $('#f-setup').value.trim(),
    analysisTF: $('#f-atf').value || null, executionTF: $('#f-etf').value || null,
    rating: +($('#f-rating').value || 0) || null,
    emotionBefore: emoB ? emoB.dataset.val : null,
    emotionAfter: emoA ? emoA.dataset.val : null,
    rules, mistakes: $$('#mistakeChips .chip-toggle.on-neg').map(x => x.dataset.mistake),
    lesson: $('#f-lesson').value.trim(), notes: $('#f-notes').value.trim(),
    screenshots: shotsTmp.filter(s => s.url),
    wave: $('#f-wave') ? ($('#f-wave').value.trim() || null) : null,
    waveRole: $('#f-waveRole') ? $('#f-waveRole').value : null,
    running: !!($('#f-running') && $('#f-running').checked),
  };
  if (trade.running) { trade.exit = null; trade.pnl = null; } // a runner has no outcome yet — the plan is the story
  if (!trade.running && trade.pnl == null) return toast('⚠️ Need entry & exit (or a manual P&L) — or tick 🏃 Still running');
  try {
    if (id) {
      await api('/api/trade/' + id, 'POST', trade);
      S.trades[S.trades.findIndex(t => t.id === id)] = { ...S.trades.find(t => t.id === id), ...trade, id };
      toast('✅ Trade updated');
    } else {
      const res = await api('/api/trade', 'POST', trade);
      S.trades.push(res.trade);
      const xpGained = calcStats(S.trades, totalBalance()).xp - beforeXP;
      const prof = profileById(profileId);
      toast(`⚡ Logged to ${prof ? prof.emoji + ' ' + esc(prof.name) : 'account'}! +${xpGained} XP`, 'gold');
      confettiBurst();
    }
    closeModal(); renderAll(); go('journal');
  } catch (err) { toast('⚠️ Couldn\'t save — connection issue?'); }
};
window.deleteTrade = async (id) => {
  if (!confirm('Delete this trade (and its screenshots)?')) return;
  await api('/api/trade/' + id, 'DELETE');
  S.trades = S.trades.filter(t => t.id !== id);
  closeModal(); toast('🗑️ Trade deleted'); renderAll();
};
window.closeModal = () => { $('#modalRoot').innerHTML = ''; };

/* ---------------- Toast + confetti ---------------- */
function toast(msg, style = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + style; t.innerHTML = msg;
  $('#toastRoot').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2600);
  setTimeout(() => t.remove(), 3100);
}
function confettiBurst() {
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#a3e635', '#fbbf24', '#60a5fa', '#c084fc', '#f87171', '#ffffff'];
  const parts = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 80,
    y: innerHeight * .35,
    vx: (Math.random() - .5) * 12, vy: -6 - Math.random() * 9,
    s: 4 + Math.random() * 6, c: colors[Math.random() * colors.length | 0],
    rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3, life: 90 + Math.random() * 40,
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    parts.forEach(p => {
      if (frame > p.life) return; alive = true;
      p.x += p.vx; p.y += p.vy; p.vy += .35; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
      ctx.restore();
    });
    frame++;
    if (alive) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ---------------- Navigation + boot ---------------- */
window.go = page => {
  S.page = page;
  $$('.page').forEach(p => p.classList.add('hidden'));
  $('#page-' + page).classList.remove('hidden');
  $$('.nav-btn[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  window.scrollTo({ top: 0 });
};
function renderAll() {
  if (S.view !== 'all' && !profileById(S.view)) { S.view = 'all'; localStorage.setItem('mj_view', 'all'); }
  const g = calcStats(S.trades, totalBalance());
  const t = viewTrades();
  const v = calcStats(t, viewBalance());
  renderProfileBar();
  renderHeader(g);
  renderDashboard(v, g, t);
  renderJournal(t);
  renderGallery(t);
  renderAnalytics(v, t);
  renderCalendar(t);
  renderSettings();
  go(S.page);
}
async function loadState() {
  const data = await api('/api/state');
  S.trades = Array.isArray(data.trades) ? data.trades : [];
  S.profiles = Array.isArray(data.profiles) ? data.profiles : [];
  S.settings = { rules: DEFAULT_RULES.slice(), ai: {}, ...(data.settings || {}) };
}
async function boot() {
  try {
    await loadState();
    if (!S.profiles.length) {
      const res = await api('/api/profile', 'POST', { name: 'Weltrade Synthetic', emoji: '🐺', type: 'Live', broker: 'Weltrade', balance: 100 });
      S.profiles.push(res.profile);
    }
  } catch (e) {
    $('#main').innerHTML = '<div class="empty"><div class="big">🔌</div>Can\'t reach the journal server.<br>Restart Mo\'s Journal and refresh.</div>';
    return;
  }
  $$('.nav-btn[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  $('#navAdd').onclick = () => openAddChooser();
  window.addEventListener('resize', () => drawEquityChart());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  renderAll();
  go('dashboard');
}
boot();
