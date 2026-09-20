// FreWork Tally Bridge — background service worker
// Makes HTTP requests to localhost on behalf of the HTTPS page,
// bypassing the browser's mixed-content block.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "TALLY_REQUEST") return false;

  const { url, method, body, timeout } = msg;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout ?? 15000);

  fetch(url, {
    method: method ?? "POST",
    headers: { "Content-Type": "text/xml" },
    body: body ?? undefined,
    signal: ctrl.signal,
  })
    .then(async (res) => {
      clearTimeout(timer);
      const text = await res.text();
      sendResponse({ ok: true, status: res.status, text });
    })
    .catch((err) => {
      clearTimeout(timer);
      sendResponse({ ok: false, error: err.message ?? "Network error" });
    });

  return true; // keep message channel open for async response
});
