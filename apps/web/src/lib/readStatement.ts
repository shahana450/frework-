// Reads a bank statement of any length. Big PDFs are split in the browser into small page batches, each read
// separately (an AI call can only read and write back so much, and an upload is capped at ~4.5 MB), then joined
// in page order. Batches that fail are retried; if some still fail, the rest are kept and the missing pages named.
// If the plan's monthly page allowance runs out, reading stops and the message says which plan gives more.
export type StatementTx = { date: string; description: string; debit: number; credit: number; balance?: number };
export type ReadProgress = { done: number; total: number; label: string };

const PAGES_PER_BATCH = 8;
const PARALLEL = 4;

async function post(file: Blob, name: string, bizId?: string, shelf = true): Promise<{ transactions: StatementTx[] }> {
  const fd = new FormData();
  fd.append("file", file, name);
  if (bizId) fd.append("business_id", bizId);
  if (!shelf) fd.append("shelf", "0");
  const res = await fetch("/api/finance/parse-bank-pdf", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.transactions)) throw Object.assign(new Error(data.error ?? "Couldn't read this statement."), { status: res.status });
  return data;
}

// A password-protected PDF: unlocked in the browser, its text sent in page batches (the password never leaves here)
async function readLockedPdf(file: File, opts: { bizId?: string; password?: string; onProgress?: (p: ReadProgress) => void }) {
  const { pdfPagesText } = await import("./pdfUnlock");
  const pages = await pdfPagesText(await file.arrayBuffer(), opts.password);   // throws PdfPasswordError until the password is right
  const base = file.name.replace(/\.pdf$/i, "");
  const out: StatementTx[] = [];
  const missing: string[] = [];
  const total = Math.ceil(pages.length / PAGES_PER_BATCH);
  for (let p = 0; p < pages.length; p += PAGES_PER_BATCH) {
    const to = Math.min(p + PAGES_PER_BATCH, pages.length);
    opts.onProgress?.({ done: p / PAGES_PER_BATCH, total: Math.max(total, 2), label: `Reading pages ${p + 1}–${to} of ${pages.length}` });
    // Pages are separated by a form feed, so the server counts them for the monthly allowance
    const text = new Blob([pages.slice(p, to).join("\f")], { type: "text/plain" });
    try { out.push(...(await post(text, `${base}-p${p + 1}-${to}.txt`, opts.bizId, false)).transactions); }
    catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (status === 402) { if (!out.length) throw e; return { transactions: out, missingPages: missing, stoppedReason: (e as Error).message }; }
      if (status !== 422) missing.push(`${p + 1}–${to}`);
    }
  }
  if (!out.length) throw new Error(pages.join("").trim() ? "No transactions found in this statement." : "This PDF has no readable text (it may be a scanned image). Download the statement as Excel from your bank instead.");
  return { transactions: out, missingPages: missing };
}

export async function readBankStatement(file: File, opts: { bizId?: string; shelf?: boolean; password?: string; onProgress?: (p: ReadProgress) => void } = {}): Promise<{ transactions: StatementTx[]; missingPages: string[]; stoppedReason?: string }> {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  let pageCount = 0, src: import("pdf-lib").PDFDocument | null = null, encrypted = false;
  if (isPdf) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      pageCount = src.getPageCount();
      encrypted = src.isEncrypted;
    } catch { src = null; }
  }
  if (encrypted) return readLockedPdf(file, opts);
  // Small files, spreadsheets, images, or PDFs we can't open: one request as before
  if (!src || pageCount <= PAGES_PER_BATCH) {
    opts.onProgress?.({ done: 0, total: 1, label: "Reading statement…" });
    const r = await post(file, file.name, opts.bizId, opts.shelf !== false);
    opts.onProgress?.({ done: 1, total: 1, label: "Done" });
    return { transactions: r.transactions, missingPages: [] };
  }

  const { PDFDocument } = await import("pdf-lib");
  const batches: { from: number; to: number }[] = [];
  for (let p = 0; p < pageCount; p += PAGES_PER_BATCH) batches.push({ from: p, to: Math.min(p + PAGES_PER_BATCH, pageCount) - 1 });
  const results: (StatementTx[] | null)[] = new Array(batches.length).fill(null);
  let done = 0, next = 0;
  let stopped: Error | null = null;   // the month's page allowance ran out: send no more batches
  const label = () => `Reading pages · ${done}/${batches.length} batches (${pageCount} pages)`;
  opts.onProgress?.({ done, total: batches.length, label: label() });

  const run = async (i: number) => {
    if (stopped) return;
    const b = batches[i];
    const part = await PDFDocument.create();
    const pages = await part.copyPages(src!, Array.from({ length: b.to - b.from + 1 }, (_, k) => b.from + k));
    pages.forEach(pg => part.addPage(pg));
    const blob = new Blob([(await part.save()) as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Every batch counts against the business's allowance; only the first files a copy on the Shelf
        results[i] = (await post(blob, `${file.name.replace(/\.pdf$/i, "")}-p${b.from + 1}-${b.to + 1}.pdf`, opts.bizId, i === 0 && opts.shelf !== false)).transactions;
        return;
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (status === 422) { results[i] = []; return; }        // pages with no transactions (summary/cover pages)
        if (status === 402) { stopped = e as Error; return; }   // allowance used up
        await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, async () => {
    while (next < batches.length && !stopped) {
      const i = next++;
      await run(i);
      done++;
      opts.onProgress?.({ done, total: batches.length, label: label() });
    }
  }));

  const transactions = results.flatMap(r => r ?? []);
  const stoppedReason = (stopped as Error | null)?.message;
  if (stoppedReason && !transactions.length) throw new Error(stoppedReason);
  const missingPages = batches.filter((_, i) => results[i] === null).map(b => `${b.from + 1}–${b.to + 1}`);
  if (!transactions.length) throw new Error(missingPages.length ? "Couldn't read this statement — the AI service may be busy. Try again in a few minutes." : "No transactions found in this statement.");
  return { transactions, missingPages, stoppedReason };
}
