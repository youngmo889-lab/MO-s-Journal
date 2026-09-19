# 📒 Mo's Journal — Deploy Guide (free, always-on, 24/7)

Your trading journal, running 24/7 so you can log from your **phone and PC** on one synced link.
This guide takes ~10 minutes and costs **$0**.

---

## What you're deploying

- **Zero-dependency Node server** (`server.js`) — no `npm install` needed anywhere
- **Web app** (`public/`) — dashboard, analytics, chart book, gamification
- **Data**: saved to `data.json` on the server, plus **optional automatic cloud backup to a private GitHub Gist** (recommended — free hosts wipe local files on redeploy)
- **Screenshots**: stored in `uploads/` on the server disk

---

## Step 1 — Put the code on GitHub (2 min)

1. Go to [github.com/new](https://github.com/new) → name it `mos-journal` → **Private** → Create (don't add a README).
2. Then from this project folder (`mos-journal/`), run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/mos-journal.git
git branch -M main
git push -u origin main
```

*(The repo is already `git init`'d and committed for you — just add the remote and push.)*

---

## Step 2 — Deploy on Render (free) (3 min)

1. Go to [render.com](https://render.com) → **Sign up with GitHub** (one click).
2. **New → Web Service** → pick your `mos-journal` repo.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** *(leave empty)*
   - **Start Command:** `node server.js`
   - **Instance Type:** **Free**
4. **Create Web Service** → wait ~1 min → you get your URL:
   `https://mos-journal-xxxx.onrender.com`
5. Open it on your **PC and phone** — same journal everywhere. On your phone: browser menu → **Add to Home Screen** 📲

> ⚠️ **Free tier note:** Render free instances sleep after 15 min idle — first visit after a nap takes ~30–60s to wake (then it's instant). If that bugs you later, a paid instance is $7/mo, or ping the URL every 10 min with a free pinger like UptimeRobot.

---

## Step 3 — Bulletproof your data with Gist backup (2 min, highly recommended)

Free hosts **wipe the server's local files** (including `data.json` and `uploads/`) whenever you redeploy. The journal has built-in cloud backup — your text data auto-syncs to a private GitHub Gist so it survives everything.

1. GitHub → your avatar → **Settings** → **Developer settings** → **Personal access tokens → Tokens (classic)** → **Generate new token (classic)**
2. Name: `mos-journal` · Expiration: *No expiration* · Tick **only** the `gist` scope → **Generate** → **copy the token**
3. Render dashboard → your service → **Environment** → **Add Environment Variable**:
   - Key: `GIST_TOKEN` · Value: *(paste token)* → **Save** (it redeploys automatically)
4. Check your service **Logs** — you'll see `☁️ Gist sync: ON`. Done.

**How it works:** on boot the server finds/creates a private gist called `mos-journal-data.json`, loads your data from it, then re-saves every change ~8s later. Redeploys, sleep cycles, even moving hosts — your data follows.

> 📸 **Screenshot honesty note:** Gist backs up your *text data* (trades, accounts, settings). Uploaded **chart images live on the host disk**, which free Render wipes on redeploy. Options: (a) accept it and re-upload key charts, (b) Render paid "persistent disk" ($1/mo add-on, smallest instance), or (c) keep the journal running in this workspace. Text data is safe either way with Gist on.

---

## Alternatives (same steps, different host)

| Host | Free tier | Notes |
|---|---|---|
| **Render** ✅ | Yes (sleeps when idle) | Easiest — used above |
| **Railway** | Trial credit | Very smooth; Gist backup recommended |
| **Fly.io** | Small free allowance | Persistent volumes available (screenshots survive!) |
| **Your own PC/VPS** | Free | `node server.js` + a tunnel (cloudflared) — always on if PC is |

Whichever host: just deploy the repo, set `GIST_TOKEN`, and you're synced.

---

## Local dev / backup commands

```bash
node server.js          # run locally on :3000
curl localhost:3000/api/state   # peek at your data
```

In-app: **Settings → Export JSON / CSV** for manual backups anytime.

---

*Mo's Journal v3 · Synthetic edition 🎛️ · Built for consistency, not perfection 💛*
