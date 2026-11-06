import { redirect } from "next/navigation";

// The list of invoices lives at /finance/sales; single invoices at /finance/invoices/<id>
export default function InvoicesIndex() {
  redirect("/finance/sales");
}
