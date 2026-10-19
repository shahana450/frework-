// Reads a bank statement of any length. Big PDFs are split in the browser into small page batches, each read
// separately (an AI call can only read and write back so much, and an upload is capped at ~4.5 MB), then joined
// in page order. Batches that fail are retried; if some still fail, the rest are kept and the missing pages named.
export type StatementTx = { date: string; description: string; debit: number; credit: number; balance?: number };
export type ReadProgress = { done: number; total: number; label: string };

const PAGES_PER_BATCH = 8;
const PARALLEL = 4;

async function post(file: Blob, name: string, bizId?: string): Promise<{ transactions: StatementTx[] }> {
  const fd = new FormData();
  fd.append("file", file, name);
  if (bizId) fd.append("business_id", bizId);
  const res = await fetch("/api/finance/parse-bank-pdf", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.transactions)) throw Object.assign(new Error(data.error ?? "Couldn't read this statement."), { status: res.status });
  return data;
}

export async function readBankStatement(file: File, opts: { bizId?: string; onProgress?: (p: ReadProgress) => void } = {}): Promise<{ transactions: StatementTx[]; missingPages: string[] }> {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  let pageCount = 0, src: import("pdf-lib").PDFDocument | null = null;
  if (isPdf) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      pageCount = src.getPageCount();
    } catch { src = null; }
  }
  // Small files, spreadsheets, images, or PDFs we can't open: one request as before
  if (!src || pageCount <= PAGES_PER_BATCH) {
    opts.onProgress?.({ done: 0, total: 1, label: "Reading statement…" });
    const r = await post(file, file.name, opts.bizId);
    opts.onProgress?.({ done: 1, total: 1, label: "Done" });
    return { transactions: r.transactions, missingPages: [] };
  }

  const { PDFDocument } = await import("pdf-lib");
  const batches: { from: number; to: number }[] = [];
  for (let p = 0; p < pageCount; p += PAGES_PER_BATCH) batches.push({ from: p, to: Math.min(p + PAGES_PER_BATCH, pageCount) - 1 });
  const results: (StatementTx[] | null)[] = new Array(batches.length).fill(null);
  let done = 0, next = 0;
  const label = () => `Reading pages · ${done}/${batches.length} batches (${pageCount} pages)`;
  opts.onProgress?.({ done, total: batches.length, label: label() });

  const run = async (i: number) => {
    const b = batches[i];
    const part = await PDFDocument.create();
    const pages = await part.copyPages(src!, Array.from({ length: b.to - b.from + 1 }, (_, k) => b.from + k));
    pages.forEach(pg => part.addPage(pg));
    const blob = new Blob([(await part.save()) as Uint8Array<ArrayBuffer>],{ type: "application/pdf" });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Only the first batch files a copy on the Shelf (as a sample); the whole PDF is often too big to send
        results[i] = (await post(blob, `${file.name.replace(/\.pdf$/i, "")}-p${b.from + 1}-${b.to + 1}.pdf`, i === 0 ? opts.bizId : undefined)).transactions;
        return;
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (status === 422) { results[i] = []; return; }        // pages with no transactions (summary/cover pages)
        await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, async () => {
    while (next < batches.length) {
      const i = next++;
      await run(i);
      done++;
      opts.onProgress?.({ done, total: batches.length, label: label() });
    }
  }));

  const missingPages = batches.filter((_, i) => results[i] === null).map(b => `${b.from + 1}–${b.to + 1}`);
  const transactions = results.flatMap(r => r ?? []);
  if (!transactions.length) throw new Error(missingPages.length ? "Couldn't read this statement — the AI service may be busy. Try again in a few minutes." : "No transactions found in this statement.");
  return { transactions, missingPages };
}
