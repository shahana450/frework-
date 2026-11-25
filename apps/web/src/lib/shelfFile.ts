// A Shelf document fetched back as a File, so Smart Inbox / FreBook AI can read it and post its entries.
// Marked fromShelf so it isn't filed on the Shelf a second time.
export type ShelfFile = File & { fromShelf?: boolean };

export async function shelfFile(bizId: string, it: { id: string; title: string; file_name?: string | null; mime?: string | null }): Promise<ShelfFile> {
  const r = await fetch(`/api/finance/shelf?business_id=${bizId}&download=${it.id}`);
  const d = await r.json().catch(() => ({})) as { url?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.error ?? `Couldn't open “${it.title}”.`);
  const blob = await (await fetch(d.url)).blob();
  const f = new File([blob], it.file_name || it.title, { type: it.mime || blob.type }) as ShelfFile;
  f.fromShelf = true;
  return f;
}
