/**
 * FreWork Tally Bridge
 * Run with: run-tally-bridge.bat
 * Requires: Node.js (https://nodejs.org)
 *
 * Runs a local proxy that adds CORS headers between
 * frework.online and Tally's HTTP server on port 7001.
 * Keep this window open while using Tally Sync in FreWork.
 */

const http = require("http");

const TALLY_PORT  = process.env.TALLY_PORT  || 7001;
const BRIDGE_PORT = process.env.BRIDGE_PORT || 7002;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tally-Port");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Allow caller to override Tally port via header
  const tallyPort = parseInt(req.headers["x-tally-port"] || String(TALLY_PORT), 10) || TALLY_PORT;

  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    const proxy = http.request(
      { hostname: "127.0.0.1", port: tallyPort, method: req.method, path: req.url || "/",
        headers: { "Content-Type": "text/xml", "Content-Length": Buffer.byteLength(body) } },
      tallyRes => {
        let data = "";
        tallyRes.on("data", d => (data += d));
        tallyRes.on("end", () => {
          res.writeHead(tallyRes.statusCode ?? 200, { "Content-Type": "text/xml", "Access-Control-Allow-Origin": "*" });
          res.end(data);
        });
      }
    );
    proxy.on("error", err => {
      res.writeHead(502, { "Content-Type": "text/xml", "Access-Control-Allow-Origin": "*" });
      res.end(`<error>${err.message}</error>`);
    });
    proxy.write(body);
    proxy.end();
  });
});

server.listen(BRIDGE_PORT, "127.0.0.1", () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║        FreWork Tally Bridge — Running          ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  Bridge : http://localhost:${BRIDGE_PORT}              ║`);
  console.log(`║  Tally  : http://localhost:${TALLY_PORT}               ║`);
  console.log("║                                                ║");
  console.log("║  Keep this window open while syncing.          ║");
  console.log("║  Press Ctrl+C to stop.                         ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");
});
