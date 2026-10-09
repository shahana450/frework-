import { frebookIcon } from "@/lib/frebookIcon";

// iPhone "Add to Home Screen" icon for every page (Next adds <link rel="apple-touch-icon"> automatically)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return frebookIcon(180);
}
