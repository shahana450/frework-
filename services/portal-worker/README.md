# FreBook portal worker

Live fetch from the Income-tax e-filing portal for FreBook: notices (e-Proceedings, Worklist,
Outstanding Demand), Form 26AS, AIS, TIS and the filed-returns list. The taxpayer types the
PAN, password and OTP in FreBook each time. **Nothing is stored**: the password is used for
the login step and dropped; the browser session closes after the fetch (or 15 minutes).

## Run it (office PC, next to Notice Sentinel)

```
cd services/portal-worker
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
set WORKER_KEY=<a long random secret>
.venv\Scripts\uvicorn worker:app --host 127.0.0.1 --port 8765
```

It uses the installed Google Chrome (`channel="chrome"`), like Sentinel, so Playwright's own
Chromium isn't needed.

Expose it over HTTPS with a Cloudflare tunnel (for example `portal.cswaportal.online` →
`http://127.0.0.1:8765`). Never expose it on plain HTTP.

## Connect FreBook (Vercel → Environment Variables)

- `PORTAL_WORKER_URL` = the tunnel address, e.g. `https://portal.cswaportal.online`
- `PORTAL_WORKER_KEY` = the same secret as `WORKER_KEY`

## What is verified

Login (PAN step, password step, secure-access checkbox, dual-login takeover, the security
popup, logout) is adapted from Notice Sentinel, where it was checked on the live portal.
**OTP entry and the 26AS (TRACES) / AIS / TIS steps are new and not yet tested on the live
portal.** Each step reports what it reached and returns a screenshot on failure; send those
screenshots to adjust the selectors.

## Run it in the cloud (recommended — always on)

The worker needs a machine that is always on. A small server in India is enough
(1 GB memory). Two easy options:

**Fly.io (Mumbai)** — about US$5–7 a month for one always-on 1 GB machine.
1. Create an account at fly.io and install `flyctl`.
2. In this folder: `fly launch --copy-config --no-deploy` (choose a unique app name).
3. `fly secrets set WORKER_KEY=<long random secret>`
4. `fly deploy` — the address will be `https://<app-name>.fly.dev`.

**Any VPS with Docker (DigitalOcean Bangalore, AWS Lightsail Mumbai, etc.)**
```
docker build -t portal-worker .
docker run -d --restart always -p 8765:8765 -e WORKER_KEY=<secret> portal-worker
```
Put it behind HTTPS (Caddy or a Cloudflare tunnel) — never plain HTTP.

Use an India region: the e-filing portal is more likely to block logins from abroad.




