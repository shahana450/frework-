import { frebookIcon } from "@/lib/frebookIcon";

// Older iOS versions request this name
export function GET() {
  return frebookIcon(180);
}
