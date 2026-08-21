/**
 * FrePilot Tally Bridge
 * Run with: node tally-bridge.js
 * Requires: Node.js (https://nodejs.org)
 *
 * This script runs a local proxy that adds CORS headers between
 * FrePilot (frework.online) and Tally's HTTP server on port 9000.
 * Keep this window open while using the Tally sync in FrePilot.
 */

const http = require("http");

const TALLY_PORT = process.env.TALLY_PORT || 9000;
const BRIDGE_PORT = process.env.BRIDGE_PORT || 7001;

const server = http.createServer((req, res) => {
  // Allow FrePilot (and any origin) to call this bridge
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const opts = {
      hostname: "localhost",
      port: TALLY_PORT,
      method: req.method,
      path: req.url || "/",
      headers: {
        "Content-Type": "text/xml",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const proxy = http.request(opts, (tallyRes) => {
      let data = "";
      tallyRes.on("data", (d) => (data += d));
      tallyRes.on("end", () => {
        res.writeHead(tallyRes.statusCode ?? 200, {
          "Content-Type": "text/xml",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(data);
      });
    });

    proxy.on("error", (err) => {
      console.error("Tally error:", err.message);
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
  console.log("║       FrePilot Tally Bridge — Running          ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  Bridge URL : http://localhost:${BRIDGE_PORT}           ║`);
  console.log(`║  Tally port : ${TALLY_PORT}                              ║`);
  console.log("║                                                ║");
  console.log("║  Keep this window open while syncing.          ║");
  console.log("║  Press Ctrl+C to stop.                         ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("");
});
