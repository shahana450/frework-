"use strict";
// FreWork Tally Bridge — standalone Node.js console app
// Packaged with pkg into a single .exe, no Electron needed.

const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const { execSync } = require("child_process");
const os = require("os");

const VERSION = "1.0.0";
const BRIDGE_PORT = 7002;
const ALLOWED_ORIGINS = ["https://frework.online", "http://localhost:3000", "http://localhost:3001"];

// ── Data directory ────────────────────────────────────────────────────────────
const dataDir = path.join(os.homedir(), "AppData", "Roaming", "FreWork-Tally-Bridge");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const CERT_FILE     = path.join(dataDir, "cert.pem");
const KEY_FILE      = path.join(dataDir, "key.pem");
const INSTALLED_FLAG = path.join(dataDir, "cert-installed.flag");

// ── Console UI ────────────────────────────────────────────────────────────────
function banner() {
  console.clear();
  console.log("╔══════════════════════════════════════════╗");
  console.log("║      FreWork Tally Bridge  v" + VERSION + "       ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log("║  Connects frework.online ↔ Tally Prime   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
}

function status(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

// ── SSL cert ──────────────────────────────────────────────────────────────────
function ensureCert() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return { cert: fs.readFileSync(CERT_FILE, "utf8"), key: fs.readFileSync(KEY_FILE, "utf8") };
  }
  status("⏳", "Generating SSL certificate…");
  const selfsigned = require("selfsigned");
  const pems = selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      keySize: 2048,
      days: 3650,
      extensions: [
        { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] },
        { name: "extendedKeyUsage", serverAuth: true },
      ],
    }
  );
  fs.writeFileSync(CERT_FILE, pems.cert);
  fs.writeFileSync(KEY_FILE, pems.private);
  status("✓", "Certificate generated");
  return { cert: pems.cert, key: pems.private };
}

function installCert(certPem) {
  if (fs.existsSync(INSTALLED_FLAG)) return; // already installed
  const tmp = path.join(os.tmpdir(), "frework-bridge.crt");
  fs.writeFileSync(tmp, certPem);
  try {
    status("⏳", "Installing certificate to Windows trusted store (one-time)…");
    execSync(`certutil -addstore -user Root "${tmp}"`, { stdio: "ignore", windowsHide: true });
    fs.writeFileSync(INSTALLED_FLAG, "1");
    status("✓", "Certificate installed — browser will trust this bridge");
  } catch {
    status("⚠", "Could not auto-install certificate.");
    status("  ", "Run as Administrator once, or manually trust: " + tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ── HTTPS proxy server ────────────────────────────────────────────────────────
function startServer(cert, key) {
  const server = https.createServer({ cert, key }, (req, res) => {
    const origin = req.headers.origin || ALLOWED_ORIGINS[0];
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tally-Port");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const tallyPort = parseInt(req.headers["x-tally-port"] || "7001", 10) || 7001;

    let body = Buffer.alloc(0);
    req.on("data", chunk => { body = Buffer.concat([body, chunk]); });
    req.on("end", () => {
      const pr = http.request(
        { hostname: "127.0.0.1", port: tallyPort, method: "POST", path: "/", headers: { "Content-Type": "text/xml", "Content-Length": body.length } },
        proxyRes => {
          let data = Buffer.alloc(0);
          proxyRes.on("data", c => { data = Buffer.concat([data, c]); });
          proxyRes.on("end", () => { res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "text/xml" }); res.end(data); });
        }
      );
      pr.on("error", e => { res.writeHead(502); res.end(e.message); });
      pr.write(body); pr.end();
    });
  });

  server.listen(BRIDGE_PORT, "127.0.0.1", () => {
    console.log("");
    status("✅", `Bridge running on https://localhost:${BRIDGE_PORT}`);
    status("🔗", "Proxying → Tally Prime on port 7001");
    console.log("");
    console.log("  ─────────────────────────────────────────");
    console.log("  Keep this window open while using FreWork");
    console.log("  ─────────────────────────────────────────");
    console.log("");
    console.log("  To stop: close this window or press Ctrl+C");
    console.log("");
  });

  server.on("error", err => {
    if (err.code === "EADDRINUSE") {
      status("⚠", `Port ${BRIDGE_PORT} already in use — bridge may already be running.`);
    } else {
      status("✗", `Server error: ${err.message}`);
    }
  });
}

// ── Desktop shortcut ──────────────────────────────────────────────────────────
function createDesktopShortcut() {
  try {
    const desktop = path.join(os.homedir(), "Desktop");
    const lnk = path.join(desktop, "FreWork Tally Bridge.lnk");
    if (fs.existsSync(lnk)) return;
    const exe = process.execPath.replace(/'/g, "''");
    const dir = path.dirname(process.execPath).replace(/'/g, "''");
    const dest = lnk.replace(/'/g, "''");
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$sc = $ws.CreateShortcut('${dest}')`,
      `$sc.TargetPath = '${exe}'`,
      `$sc.WorkingDirectory = '${dir}'`,
      `$sc.Description = 'FreWork Tally Bridge'`,
      `$sc.IconLocation = '${exe},0'`,
      `$sc.Save()`,
    ].join("; ");
    execSync(`powershell -NoProfile -WindowStyle Hidden -Command "${ps}"`, { stdio: "ignore", windowsHide: true });
    status("🖥️", "Shortcut created on Desktop");
  } catch { /* non-fatal */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────
banner();
createDesktopShortcut();
const { cert, key } = ensureCert();
installCert(cert);
startServer(cert, key);

process.on("SIGINT", () => { console.log("\n  Stopped. Goodbye."); process.exit(0); });
process.on("SIGTERM", () => process.exit(0));
