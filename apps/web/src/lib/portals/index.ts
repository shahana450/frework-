// Picks the provider for each portal from server settings. Without provider keys, Demo mode is used (clearly labelled).
//   GST:  GSP_PROVIDER=<id> plus that provider's keys (e.g. GSP_CLIENT_ID, GSP_CLIENT_SECRET, GSP_USERNAME)
//   IT:   ERI_PROVIDER=<id> plus that provider's keys
// Real providers plug in here once their API documentation and sandbox keys are available.
import { createDemoProvider } from "./demo";
import { createSandboxGstProvider } from "./sandbox";
import { PortalError, type Portal, type PortalProvider } from "./types";

const ADAPTERS: Record<string, (portal: Portal) => PortalProvider> = {
  sandbox: portal => portal === "gst" ? createSandboxGstProvider() : createDemoProvider(portal),   // Sandbox: GST status now; income tax stays demo until its APIs are wired
  // "mastersindia": portal => createMastersIndiaProvider(...),   ← added when sandbox keys + API docs are in hand
};

export function providerFor(portal: Portal): PortalProvider {
  const id = (portal === "gst" ? process.env.GSP_PROVIDER : process.env.ERI_PROVIDER)?.trim().toLowerCase();
  if (!id || id === "demo") return createDemoProvider(portal);
  const make = ADAPTERS[id];
  if (!make) {
    // A provider was named but its connector isn't built yet — fail clearly rather than pretend
    return {
      id, label: id, demo: false,
      requestOtp: async () => { throw new PortalError("NOT_CONFIGURED", `The ${id} connector isn't installed yet. Share its API docs and sandbox keys to finish it.`); },
      verifyOtp: async () => { throw new PortalError("NOT_CONFIGURED", `The ${id} connector isn't installed yet.`); },
      fetchStatuses: async () => { throw new PortalError("NOT_CONFIGURED", `The ${id} connector isn't installed yet.`); },
    };
  }
  return make(portal);
}

export * from "./types";
