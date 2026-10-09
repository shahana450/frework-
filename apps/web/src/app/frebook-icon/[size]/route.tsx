import { frebookIcon } from "@/lib/frebookIcon";

// FreBook app icon as PNG (home-screen / install icon). /frebook-icon/192, /512, /180, /512m (maskable)
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  return frebookIcon(Math.min(1024, Math.max(48, parseInt(raw, 10) || 192)), raw.endsWith("m"));
}
