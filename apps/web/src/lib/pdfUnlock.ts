// Password-protected PDFs (most bank statements): opened in the browser with pdf.js and turned into text page by
// page, so the AI reads the text and the password never leaves this computer.
export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) { super(wrong ? "That password didn't open the statement." : "This statement is password-protected."); }
}

/** True when the PDF is encrypted and needs a password to open. */
export async function pdfNeedsPassword(data: ArrayBuffer): Promise<boolean> {
  try { await pdfPagesText(data); return false; } catch (e) { return e instanceof PdfPasswordError; }
}

/** The text of every page, one string per page, rows kept on their own lines. */
export async function pdfPagesText(data: ArrayBuffer, password?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password, isEvalSupported: false }).promise;
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException") throw new PdfPasswordError((e as { code?: number }).code === 2);
    throw e;
  }
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    // Group text pieces into lines by their vertical position, left to right within a line
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str?: string; transform?: number[] }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      (rows.get(y) ?? rows.set(y, []).get(y)!).push({ x: it.transform[4], s: it.str });
    }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(p => p.s).join("  ")).join("\n"));
  }
  await doc.destroy();
  return pages;
}

/**
 * Every page as a JPEG picture, for statements whose words are drawn as shapes (no text layer) or scanned —
 * the AI reads a clear page picture reliably. ~1600 px wide keeps small print legible and each page well under
 * the upload limit.
 */
export async function pdfPageImages(data: ArrayBuffer, password?: string, onPage?: (n: number, total: number) => void): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password, isEvalSupported: false }).promise;
  const out: Blob[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, 1600 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    out.push(await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("Couldn't draw the page"))), "image/jpeg", 0.85)));
    page.cleanup();
    onPage?.(n, doc.numPages);
  }
  await doc.destroy();
  return out;
}

/** True when the PDF has (almost) no text layer — its words are pictures or drawn shapes. */
export async function pdfHasNoText(data: ArrayBuffer, password?: string): Promise<boolean> {
  try { const pages = await pdfPagesText(data, password); return pages.join("").replace(/\s+/g, "").length < pages.length * 40; } catch { return false; }
}

/**
 * The statement as a grid of cells, rebuilt from where each piece of text sits on the page: the heading row
 * (Date · Narration · Debit · Credit · Balance) fixes the columns and every value goes under the nearest heading —
 * so an empty Debit or Credit cell stays empty instead of shifting the numbers. Read exactly, with no AI.
 */
export async function pdfStatementGrid(data: ArrayBuffer, password?: string): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password, isEvalSupported: false }).promise; }
  catch (e) {
    if ((e as { name?: string }).name === "PasswordException") throw new PdfPasswordError((e as { code?: number }).code === 2);
    throw e;
  }
  const HEAD = /^(txn|tran(saction)?|value|post(ing)?)?\s*date$|^date$|narration|description|particulars|details|remarks|withdraw|debit|dr\.?$|deposit|credit|cr\.?$|balance|chq|cheque|ref/i;
  let cols: { name: string; mid: number }[] | null = null;
  const grid: string[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const lines = new Map<number, { x: number; w: number; s: string }[]>();
    for (const it of content.items as { str?: string; transform?: number[]; width?: number }[]) {
      if (!it.str?.trim() || !it.transform) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      (lines.get(y) ?? lines.set(y, []).get(y)!).push({ x: it.transform[4], w: it.width ?? 0, s: it.str.trim() });
    }
    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, p]) => p.sort((a, b) => a.x - b.x));
    const DATEISH = /\b\d{1,2}[-/.\s](\d{1,2}|[a-z]{3})[-/.\s]\d{2,4}\b/i, MONEY = /^-?[\d,]+\.\d{2}$/;
    for (let li = 0; li < ordered.length; li++) {
      const parts = ordered[li];
      // A heading row (it may wrap over a few lines, e.g. "Value" above "Date", "Withdrawal" above "Amt (INR)"):
      // several pieces that name statement columns — it (re)sets the columns for what follows
      if (parts.filter(p => HEAD.test(p.s)).length >= 3 && parts.some(p => /withdraw|debit|deposit|credit|amount|balance/i.test(p.s))) {
        const cand = parts.map(p => ({ name: p.s, mid: p.x + p.w / 2 }));
        let extra = 0;
        while (extra < 3 && li + extra + 1 < ordered.length) {
          const next = ordered[li + extra + 1];
          if (next.some(p => DATEISH.test(p.s) || MONEY.test(p.s))) break;   // a data row — the heading has ended
          for (const p of next) {
            const mid = p.x + p.w / 2;
            let b = 0; for (let k = 1; k < cand.length; k++) if (Math.abs(cand[k].mid - mid) < Math.abs(cand[b].mid - mid)) b = k;
            cand[b].name = `${cand[b].name} ${p.s}`;
          }
          extra++;
        }
        if (cand.some(c => /date/i.test(c.name))) {
          cols = cand; li += extra;
          grid.push(cols.map(c => c.name));
          continue;
        }
      }
      if (!cols) { grid.push([parts.map(p => p.s).join(" ")]); continue; }
      // Each piece goes to the column whose heading centre is nearest; pieces in the same column join (wrapped narration)
      const row: string[] = cols.map(() => "");
      for (const p of parts) {
        const mid = p.x + p.w / 2;
        let best = 0;
        for (let k = 1; k < cols.length; k++) if (Math.abs(cols[k].mid - mid) < Math.abs(cols[best].mid - mid)) best = k;
        row[best] = row[best] ? `${row[best]} ${p.s}` : p.s;
      }
      // A number too wide for its column wraps its last digits onto the next line ("546286.4" then "8"):
      // on a line with no date, digits under an amount/balance heading belong to the number above
      if (!parts.some(p => DATEISH.test(p.s))) {
        const prev = grid[grid.length - 1];
        cols.forEach((c, k) => {
          if (prev && row[k] && /withdraw|deposit|debit|credit|balance|amount/i.test(c.name) && /^[\d.,]{1,4}$/.test(row[k]) && /\d/.test(prev[k] ?? "")) { prev[k] = `${prev[k]}${row[k]}`; row[k] = ""; }
        });
        if (row.every(v => !v)) continue;
      }
      grid.push(row);
    }
  }
  await doc.destroy();
  return grid;
}
