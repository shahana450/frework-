"use client";
// The ONE active business for the finance app (Task 6). The finance layout resolves it, shows it in the header and
// provides it through React context; pages read it from here instead of localStorage, so a page can never read
// from or post to a business other than the one in the header. Switching business remounts the page (the layout
// keys <main> by business id), so no page keeps a stale id.
import { createContext, useContext, useEffect, useState } from "react";
import { getActiveBusiness, subscribeActiveBusiness, type ActiveBusiness } from "./activeBusinessStore";

export {
  type ActiveBusiness, activeBusinessKey, rememberedBusiness, tabBusiness, readActiveBusiness, setActiveBusiness, clearActiveBusiness, getActiveBusiness,
} from "./activeBusinessStore";

/** For the layout itself (it renders the provider, so it can't read the context). */
export function useActiveBusinessStore(): ActiveBusiness {
  const [value, setValue] = useState<ActiveBusiness>(getActiveBusiness());
  useEffect(() => { setValue(getActiveBusiness()); return subscribeActiveBusiness(setValue); }, []);
  return value;
}

const Ctx = createContext<ActiveBusiness>(getActiveBusiness());

/** Provided once, by the finance layout. */
export function ActiveBusinessProvider({ children }: { children: React.ReactNode }) {
  const value = useActiveBusinessStore();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The active business inside the finance app. */
export const useActiveBusiness = () => useContext(Ctx);
