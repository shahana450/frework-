// FreWork Tally Bridge — content script
// Injected into frework.online pages. Relays postMessage <-> chrome.runtime.

// Send READY immediately, then repeat a few times so the app catches it
// regardless of when Next.js finishes loading.
function announceReady() {
  window.postMessage({ type: "TALLY_BRIDGE_READY" }, "*");
}
announceReady();
setTimeout(announceReady, 500);
setTimeout(announceReady, 1500);
setTimeout(announceReady, 3000);

// Relay requests from the page to the background service worker
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.type !== "TALLY_BRIDGE_REQUEST") return;

  chrome.runtime.sendMessage(
    {
      type: "TALLY_REQUEST",
      url: msg.url,
      method: msg.method,
      body: msg.body,
      timeout: msg.timeout,
    },
    (response) => {
      window.postMessage(
        { type: "TALLY_BRIDGE_RESPONSE", id: msg.id, ...(response ?? { ok: false, error: "No response from bridge" }) },
        "*"
      );
    }
  );
});
