"use client";
// Loads Portal Connect's GST filing statuses for the GST pages. Only Sandbox-linked GSTINs count; Demo data never marks anything filed.
import { useEffect, useState } from "react";
import { linkedViaSandbox, type PortalLink, type PortalStatus } from "./filings";

export function usePortalFilings(bizId: string) {
  const [state, setState] = useState<{ linked: boolean; statuses: PortalStatus[]; gstProvider: string }>({ linked: false, statuses: [], gstProvider: "" });
  useEffect(() => {
    if (!bizId) return;
    let live = true;
    fetch(`/api/finance/portals?business_id=${bizId}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!live || !d) return;
      const linked = linkedViaSandbox(d.links as PortalLink[]);
      setState({ linked, statuses: linked ? (d.statuses ?? []) : [], gstProvider: d.providers?.gst?.id ?? "" });
    }).catch(() => { /* filing marks are a bonus; the page works without them */ });
    return () => { live = false; };
  }, [bizId]);
  return state;
}
