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
