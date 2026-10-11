// Picks the provider for each portal from server settings. Without provider keys, Demo mode is used (clearly labelled).
//   GST:  GSP_PROVIDER=<id> plus that provider's keys (e.g. GSP_CLIENT_ID, GSP_CLIENT_SECRET, GSP_USERNAME)
//   IT:   ERI_PROVIDER=deepvue plus DEEPVUE_CLIENT_ID, DEEPVUE_CLIENT_SECRET
// Real providers plug in here once their API documentation and sandbox keys are available.
import { createDemoProvider } from "./demo";
import { createSandboxGstProvider } from "./sandbox";
import { createDeepvueItProvider } from "./deepvue";
import { PortalError, type Portal, type PortalProvider } from "./types";

// A provider named for a portal it doesn't serve fails clearly rather than pretending.
function notBuilt(id: string, why = `The ${id} connector isn't installed yet. Share its API docs and sandbox keys to finish it.`): PortalProvider {
  return {
    id, label: id, demo: false,
    requestOtp: async () => { throw new PortalError("NOT_CONFIGURED", why); },
    verifyOtp: async () => { throw new PortalError("NOT_CONFIGURED", why); },
    fetchStatuses: async () => { throw new PortalError("NOT_CONFIGURED", why); },
  };
}

const ADAPTERS: Record<string, (portal: Portal) => PortalProvider> = {
  // Sandbox: GST only. Its docs have no ITR-status API, so ERI_PROVIDER=sandbox is refused rather than faked.
  sandbox: portal => portal === "gst" ? createSandboxGstProvider() : notBuilt("sandbox", "Sandbox has no Income-tax status API. Set ERI_PROVIDER=deepvue."),
  // Deepvue: Income tax only (ITR filed / e-verified / processed / refund).
  deepvue: portal => portal === "it" ? createDeepvueItProvider() : notBuilt("deepvue", "Deepvue is connected for Income tax only. Set GSP_PROVIDER=sandbox for GST."),
};

export function providerFor(portal: Portal): PortalProvider {
  const id = (portal === "gst" ? process.env.GSP_PROVIDER : process.env.ERI_PROVIDER)?.trim().toLowerCase();
  if (!id || id === "demo") return createDemoProvider(portal);
  const make = ADAPTERS[id];
  return make ? make(portal) : notBuilt(id);
}

export * from "./types";
