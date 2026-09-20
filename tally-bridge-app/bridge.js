"use strict";
// FreWork Tally Bridge — lightweight HTTP CORS proxy
// Chrome exempts http://localhost from mixed-content blocking,
// so no SSL cert is needed. Just run and connect.

const http = require("http");
const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const VERSION     = "1.0.0";
const BRIDGE_PORT = 7002;
const ALLOWED_ORIGINS = ["https://frework.online", "http://localhost:3000", "http://localhost:3001"];

const dataDir = path.join(os.homedir(), "AppData", "Roaming", "FreWork-Tally-Bridge");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const SHORTCUT_FLAG = path.join(dataDir, "shortcut-created.flag");

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

function log(icon, msg) { console.log(`  ${icon}  ${msg}`); }

// ── Desktop shortcut ──────────────────────────────────────────────────────────
function createDesktopShortcut() {
  if (fs.existsSync(SHORTCUT_FLAG)) return;
  try {
    const desktop = path.join(os.homedir(), "Desktop");
    const lnk  = path.join(desktop, "FreWork Tally Bridge.lnk").replace(/'/g, "''");
    const exe  = process.execPath.replace(/'/g, "''");
    const dir  = path.dirname(process.execPath).replace(/'/g, "''");
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$sc = $ws.CreateShortcut('${lnk}')`,
      `$sc.TargetPath = '${exe}'`,
      `$sc.WorkingDirectory = '${dir}'`,
      `$sc.Description = 'FreWork Tally Bridge'`,
      `$sc.IconLocation = '${exe},0'`,
      `$sc.Save()`,
    ].join("; ");
    execSync(`powershell -NoProfile -WindowStyle Hidden -Command "${ps}"`, { stdio: "ignore", windowsHide: true });
    fs.writeFileSync(SHORTCUT_FLAG, "1");
    log("🖥️", "Desktop shortcut created");
  } catch { /* non-fatal */ }
}

// ── HTTP CORS proxy ───────────────────────────────────────────────────────────
function startServer() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin || ALLOWED_ORIGINS[0];
    const allow  = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tally-Port");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const tallyPort = parseInt(req.headers["x-tally-port"] || "7001", 10) || 7001;

    let body = Buffer.alloc(0);
    req.on("data", c => { body = Buffer.concat([body, c]); });
    req.on("end", () => {
      const pr = http.request(
        { hostname: "127.0.0.1", port: tallyPort, method: "POST", path: "/",
          headers: { "Content-Type": "text/xml", "Content-Length": body.length } },
        proxyRes => {
          let data = Buffer.alloc(0);
          proxyRes.on("data", c => { data = Buffer.concat([data, c]); });
          proxyRes.on("end", () => {
            res.writeHead(proxyRes.statusCode || 200, { "Content-Type": "text/xml" });
            res.end(data);
          });
        }
      );
      pr.on("error", e => { res.writeHead(502); res.end(e.message); });
      pr.write(body); pr.end();
    });
  });

  server.listen(BRIDGE_PORT, "127.0.0.1", () => {
    log("✅", `Bridge running on http://localhost:${BRIDGE_PORT}`);
    log("🔗", "Proxying → Tally Prime on port 7001");
    console.log("");
    console.log("  ─────────────────────────────────────────");
    console.log("  Keep this window open while using FreWork");
    console.log("  Go to frework.online → Finance → Tally");
    console.log("  ─────────────────────────────────────────");
    console.log("");
    console.log("  Press Ctrl+C to stop");
  });

  server.on("error", err => {
    if (err.code === "EADDRINUSE") {
      log("✅", `Bridge already running on port ${BRIDGE_PORT} — you're good to go!`);
    } else {
      log("✗", `Error: ${err.message}`);
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
banner();
createDesktopShortcut();
startServer();

process.on("SIGINT",  () => { console.log("\n  Stopped."); process.exit(0); });
process.on("SIGTERM", () => process.exit(0));
