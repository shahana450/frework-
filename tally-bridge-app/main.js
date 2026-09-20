"use strict";
const { app, Menu, Tray, shell, nativeImage, dialog } = require("electron");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const zlib = require("zlib");

// ── Single instance ───────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ── Generate tray icon (green/red 16×16 PNG, no external deps) ───────────────
function makePng(r, g, b, size = 16) {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tbl[i] = c;
  }
  function crc32(buf) {
    let v = 0xFFFFFFFF;
    for (const b of buf) v = tbl[(v ^ b) & 0xFF] ^ (v >>> 8);
    return (v ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type), d = Buffer.from(data);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
    return Buffer.concat([len, t, d, crc]);
  }
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) { raw.push(r); raw.push(g); raw.push(b); }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.from(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const GREEN_ICON = nativeImage.createFromBuffer(makePng(34, 197, 94));
const RED_ICON   = nativeImage.createFromBuffer(makePng(239, 68, 68));
const GREY_ICON  = nativeImage.createFromBuffer(makePng(107, 114, 128));

// ── State ─────────────────────────────────────────────────────────────────────
let tray = null;
let server = null;
let tallyPort = 7001;
let bridgeOk = false;

const dataDir = app.getPath("userData");
const CERT_FILE = path.join(dataDir, "bridge-cert.pem");
const KEY_FILE  = path.join(dataDir, "bridge-key.pem");
const CERT_INSTALLED_FLAG = path.join(dataDir, "cert-installed");

// ── SSL cert ──────────────────────────────────────────────────────────────────
function ensureCert() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return { cert: fs.readFileSync(CERT_FILE, "utf8"), key: fs.readFileSync(KEY_FILE, "utf8") };
  }
  const selfsigned = require("selfsigned");
  const pems = selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      keySize: 2048,
      days: 3650,
      extensions: [
        { name: "subjectAltName", altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ]},
        { name: "extendedKeyUsage", serverAuth: true },
      ],
    }
  );
  fs.writeFileSync(CERT_FILE, pems.cert);
  fs.writeFileSync(KEY_FILE, pems.private);
  return { cert: pems.cert, key: pems.private };
}

function installCert(certPem) {
  if (fs.existsSync(CERT_INSTALLED_FLAG)) return; // already installed
  const tmp = path.join(dataDir, "frework-bridge.crt");
  fs.writeFileSync(tmp, certPem);
  try {
    // Add to current-user Trusted Root — no admin required
    execSync(`certutil -addstore -user Root "${tmp}"`, { stdio: "ignore", windowsHide: true });
    fs.writeFileSync(CERT_INSTALLED_FLAG, "1");
  } catch (e) {
    // If it fails (rare), show a dialog explaining
    dialog.showMessageBoxSync({
      type: "warning",
      title: "FreWork Tally Bridge",
      message: "Could not install the security certificate automatically.\n\nPlease run the app as Administrator once to complete setup.",
    });
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ── HTTPS bridge server ───────────────────────────────────────────────────────
function startServer(cert, key) {
  const ALLOWED_ORIGINS = [
    "https://frework.online",
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  server = https.createServer({ cert, key }, (req, res) => {
    const origin = req.headers.origin || "https://frework.online";
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tally-Port");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Allow caller to override Tally port via header
    const port = parseInt(req.headers["x-tally-port"] || String(tallyPort), 10) || 7001;

    let body = Buffer.alloc(0);
    req.on("data", chunk => { body = Buffer.concat([body, chunk]); });
    req.on("end", () => {
      const proxyReq = http.request(
        { hostname: "127.0.0.1", port, method: "POST", path: "/", headers: { "Content-Type": "text/xml", "Content-Length": body.length } },
        proxyRes => {
          let data = Buffer.alloc(0);
          proxyRes.on("data", c => { data = Buffer.concat([data, c]); });
          proxyRes.on("end", () => { res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "text/xml" }); res.end(data); });
        }
      );
      proxyReq.on("error", e => { res.writeHead(502); res.end(e.message); });
      proxyReq.write(body);
      proxyReq.end();
    });
  });

  server.listen(7002, "127.0.0.1", () => {
    bridgeOk = true;
    updateTray();
  });

  server.on("error", err => {
    bridgeOk = false;
    updateTray();
    // Port 7002 in use — try 7003
    if (err.code === "EADDRINUSE") {
      server.listen(7003, "127.0.0.1", () => { bridgeOk = true; updateTray(); });
    }
  });
}

// ── Tray menu ─────────────────────────────────────────────────────────────────
function updateTray() {
  if (!tray) return;
  tray.setImage(bridgeOk ? GREEN_ICON : RED_ICON);
  tray.setToolTip(bridgeOk ? "FreWork Tally Bridge — Running" : "FreWork Tally Bridge — Error");

  const menu = Menu.buildFromTemplate([
    { label: "FreWork Tally Bridge", enabled: false },
    { type: "separator" },
    { label: bridgeOk ? "● Bridge running (port 7002)" : "✗ Bridge not running", enabled: false },
    { label: `Tally port: ${tallyPort}`, enabled: false },
    { type: "separator" },
    { label: "Open FreWork Finance", click: () => shell.openExternal("https://frework.online/finance/tally") },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.dock?.hide(); // macOS: hide from dock
  app.setAppUserModelId("online.frework.tally-bridge");

  tray = new Tray(GREY_ICON);
  tray.setToolTip("FreWork Tally Bridge — Starting…");
  tray.on("click", () => tray.popUpContextMenu());
  updateTray();

  // Cert setup
  const { cert, key } = ensureCert();
  installCert(cert);
  startServer(cert, key);

  // Auto-start on first run
  if (!app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }
});

app.on("window-all-closed", (e) => e.preventDefault()); // stay alive
app.on("before-quit", () => { app.isQuitting = true; });
