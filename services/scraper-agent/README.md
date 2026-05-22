# Scraper Agent

Self-hosted Node.js sidecar that runs a real Chromium browser driven by a
Gemini 2.5 vision + function-calling loop. Used by the **Social Scraper**
admin tool to log into Instagram / LinkedIn and fetch recent posts.

## Architecture

```
Admin modal (browser)
  ├─ WS /ws/live/{sessionId}    ← ~15fps JPEG screencast frames
  └─ WS /ws/events/{sessionId}  ← thought / action / done / error events

Laravel (PHP, port 80/443)
  └─ POST /admin/social-scrape/agent  →  POST http://127.0.0.1:7501/sessions

Scraper Agent (Node, port 7501 — localhost only)
  ├─ Playwright + Chromium
  └─ Gemini 2.5 API  (vision + function-calling loop, max 30 iterations)
```

---

## Running locally on macOS (development)

### 1. Prerequisites

You need Node 20+ and the project dependencies installed. Check first:

```bash
node -v   # should be v20 or higher
```

If not installed, grab it from https://nodejs.org or via Homebrew:

```bash
brew install node
```

### 2. Install dependencies + Chromium

```bash
cd /path/to/the-pod/services/scraper-agent
npm install
npm run build
npx playwright install chromium
```

You do **not** need Xvfb on macOS — Playwright opens a real visible
Chromium window. You can watch the browser work on your screen.

### 3. Configure

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

```
GEMINI_API_KEY=<paste your key from the-pod/.env>
HEADLESS=false        # show the browser window on Mac (optional but useful)
SCRAPER_INTERNAL_SECRET=   # leave blank for local dev
```

The `GEMINI_API_KEY` is the same one already in your main `the-pod/.env`
(`GEMINI_API_KEY=AIzaSy...`).

**Parallel speed-up:** When `SCRAPER_MAX_POSTS` exceeds `SCRAPER_PARALLEL_THRESHOLD`, the sidecar opens **multiple tabs in one browser** (shared login). The agent must pass `tabIndex` on each tool call. Live preview shows tab 0 only. Tune `SCRAPER_MAX_PARALLEL_TABS` / `MAX_CONCURRENT_SESSIONS` as the cap on tab count.

### 4. Start the sidecar

Open a **new terminal tab** (keep your existing `composer run dev` and
`php artisan schedule:work` tabs running), then:

```bash
cd /path/to/the-pod/services/scraper-agent
node dist/server.js
```

You should see:

```
[scraper-agent] Listening on 127.0.0.1:7501
```

### 5. Verify Laravel can reach it

In another terminal:

```bash
cd /path/to/the-pod
php artisan tinker
>>> app(\App\Services\ScraperAgentClient::class)->sessionStatus('test')
# → should throw "Session not found: test" (means the sidecar responded)
```

Or just open the Social Scraper modal in the admin, pick Agent mode, and
paste a URL — if it returns "Browser launching…" the sidecar is connected.

### Local dev tips

- With `HEADLESS=false` in the sidecar `.env` you can literally watch
  Chromium on your screen as Gemini controls it.
- The sidecar auto-restarts when you `Ctrl+C` and re-run `node dist/server.js`.
- If you change `src/agent.ts` or any other source file, re-run
  `npm run build` before restarting the sidecar.
- Cookie state files land in `services/scraper-agent/data/` after a
  successful login — delete them to force a fresh login next time.

---

## Running on a Linux server (production)

### 1. Prerequisites (Ubuntu 22.04 / 24.04)

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Xvfb gives Chromium a virtual display to render into
sudo apt-get install -y xvfb fonts-noto-color-emoji fonts-liberation

# Build tools (sometimes needed by Playwright native deps)
sudo apt-get install -y build-essential
```

### 2. Install dependencies + Chromium

```bash
cd /var/www/the-pod/services/scraper-agent
npm ci
npm run build
npx playwright install --with-deps chromium
```

### 3. Configure

```bash
cp .env.example .env
nano .env
```

Minimum required values:

```
GEMINI_API_KEY=<your key>
SCRAPER_INTERNAL_SECRET=<generate below>
HEADLESS=true
```

Generate the shared secret (do this once):

```bash
openssl rand -hex 32
```

Set the **same value** in both files:
- `services/scraper-agent/.env`  → `SCRAPER_INTERNAL_SECRET=<value>`
- `/var/www/the-pod/.env`        → `SCRAPER_AGENT_SECRET=<value>`

Then clear Laravel's config cache:

```bash
php artisan config:clear
```

### 4. Run under systemd

```bash
# Adjust paths inside the .service file if your app lives somewhere else
sudo cp scraper-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scraper-agent
sudo systemctl start scraper-agent

# Check it started cleanly
sudo systemctl status scraper-agent
sudo journalctl -u scraper-agent -f   # follow live logs
```

The systemd unit uses `xvfb-run` automatically, so you do not need to
manage the virtual display manually.

### 5. Verify

```bash
# From the same server — should return JSON
curl -s http://127.0.0.1:7501/sessions/test \
  -H "X-Scraper-Secret: <your secret>"
# → {"error":"Not found"}  ← means the sidecar is alive
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** Same key as in the main Laravel `.env`. |
| `GEMINI_AGENT_MODEL` | `gemini-2.5-flash` | Model for the agent loop. Flash is fastest; swap to `gemini-2.5-pro` for harder pages. |
| `SCRAPER_PORT` | `7501` | Port to listen on. Must match `SCRAPER_AGENT_URL` in Laravel. |
| `SCRAPER_BIND` | `127.0.0.1` | Bind address — keep as-is so only Laravel can reach it. |
| `SCRAPER_INTERNAL_SECRET` | *(empty = disabled)* | Shared secret checked in `X-Scraper-Secret` header. Leave blank for local dev. |
| `STORAGE_DIR` | `./data` | Where Playwright storageState (cookie cache) files are written. |
| `HEADLESS` | `true` on Linux | Set `false` on macOS to see the browser window. |
| `MAX_CONCURRENT_SESSIONS` | `3` | Hard cap on simultaneous Chromium sessions. |

---

## Security notes

- The sidecar binds to `127.0.0.1` only — port 7501 is never publicly reachable.
- Credentials are stored **encrypted** in the Laravel DB and fetched by the
  sidecar via a signed, 5-minute-expiry URL. Plaintext passwords never appear
  in logs or WS frames — they are replaced with `[username]` / `[password]`.
- `SCRAPER_INTERNAL_SECRET` guards against other local processes calling the
  sidecar. Set it on the server; leaving it blank is fine for local dev.

---

## Resource usage (per active session)

- 0.5–1 vCPU
- 0.8–1.2 GB RAM
- ~500 KB/s outbound (screencast frames)

A $20/mo VPS (2 vCPU / 4 GB RAM) handles the default cap of 3 concurrent
sessions comfortably.

---

## Troubleshooting

**"Scraper agent unavailable" in the admin modal**
→ Sidecar is not running. Check: `systemctl status scraper-agent` (Linux)
  or confirm `node dist/server.js` is running in your local terminal.
→ Confirm `SCRAPER_AGENT_URL=http://127.0.0.1:7501` is in `the-pod/.env`.

**Chromium won't launch — "no sandbox" or permission error (Linux)**
→ `--no-sandbox` is already set in `browser.ts`. If it still fails, make
  sure the service user (`www-data`) can run `xvfb-run` and Xvfb is installed.

**"Events WS connection failed" in the modal**
→ The WS URL uses `ws://` for localhost and `wss://` otherwise. If your
  local Laravel runs on HTTPS, either add a self-signed cert or temporarily
  set `SCRAPER_BIND=0.0.0.0` and connect directly.

**Instagram shows "We noticed unusual activity"**
→ Use a warmed-up burner account (some prior manual browsing history). The
  server IP being a datacenter address also triggers this — consider a
  residential proxy (Phase 6 in the plan) for production use.

**Agent hits 30 iterations without result**
→ Instagram/LinkedIn updated their DOM. Open the modal, watch the live view
  and action log to see where it gets stuck, then adjust the system prompt
  in `src/agent.ts`.

**Cookies expired — agent has to log in every time**
→ StorageState is cached in `data/state-<credentialId>.json`. Delete that
  file to force a fresh login. If IG is expiring sessions very fast, the
  account may be soft-banned — try a fresh burner account.
