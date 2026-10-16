import { redirect } from "next/navigation";

// FreWork AI was removed — questions about the books are answered in FreBook (Ask your books).
export default function VirtualCaPage() {
  redirect("/finance/chat-book");
}
