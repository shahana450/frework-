import { redirect } from "next/navigation";

// The old multi-tier checkout is retired: FreWork sells one FreBook plan, bought from /finance/pricing.
export default function SubscribePage() {
  redirect("/pricing");
}
