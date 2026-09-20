// FreWork Tally Bridge — content script
// Injected into frework.online pages. Relays postMessage <-> chrome.runtime,
// letting the HTTPS page talk to localhost through the extension.

// Tell the page the bridge is ready
window.postMessage({ type: "TALLY_BRIDGE_READY" }, "*");

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
