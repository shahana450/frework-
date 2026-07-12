import { NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour

export interface TaxNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "Income Tax" | "GST" | "Compliance" | "General";
}

const FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=GST+India+tax+CBIC&hl=en-IN&gl=IN&ceid=IN:en",
    category: "GST" as const,
  },
  {
    url: "https://news.google.com/rss/search?q=income+tax+India+CBDT+ITR&hl=en-IN&gl=IN&ceid=IN:en",
    category: "Income Tax" as const,
  },
  {
    url: "https://news.google.com/rss/search?q=MCA+ROC+compliance+India+company&hl=en-IN&gl=IN&ceid=IN:en",
    category: "Compliance" as const,
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function parseItems(xml: string, category: TaxNewsItem["category"]): TaxNewsItem[] {
  const items: TaxNewsItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const block = match[1];

    const title = stripHtml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const url = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? block.match(/<link\s+href="([^"]+)"/)?.[1] ?? "";
    const rawDesc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "";
    const summary = stripHtml(rawDesc).slice(0, 200);
    const source = stripHtml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "Google News");
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";

    if (!title || title.length < 10) continue;

    const id = Buffer.from(title.slice(0, 40)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
    items.push({ id, title, summary, url, source, publishedAt: pubDate, category });
  }

  return items.slice(0, 4);
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0 FreWork-Bot/1.0" },
          next: { revalidate: 3600 },
        });
        if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
        const xml = await res.text();
        return parseItems(xml, feed.category);
      })
    );

    const allItems: TaxNewsItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") allItems.push(...r.value);
    }

    // De-duplicate by title similarity, sort by date desc
    const seen = new Set<string>();
    const deduped = allItems.filter((item) => {
      const key = item.title.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    deduped.sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });

    return NextResponse.json({ items: deduped.slice(0, 9), fetchedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (err) {
    console.error("[tax-news]", err);
    return NextResponse.json({ items: [], fetchedAt: new Date().toISOString(), error: "fetch_failed" }, { status: 200 });
  }
}
