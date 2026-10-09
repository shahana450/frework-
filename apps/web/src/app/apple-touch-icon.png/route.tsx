import { frebookIcon } from "@/lib/frebookIcon";

// Safari also asks for /apple-touch-icon.png directly when a page names no icon
export function GET() {
  return frebookIcon(180);
}
