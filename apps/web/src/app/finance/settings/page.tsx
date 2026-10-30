import { redirect } from "next/navigation";

// The top bar's Settings icon: settings open on the business details tab
export default function SettingsIndex() {
  redirect("/finance/settings/business");
}
