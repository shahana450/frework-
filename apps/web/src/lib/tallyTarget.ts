// B5 — a business may push only into the Tally company it is linked to. Pure.
//   linked === undefined → the tally_company column doesn't exist yet (migration not run): allow, as before
//   linked === null      → not linked: refuse, ask to connect on the Tally page (which links it)
//   names differ         → refuse: this is another business's books
export type TargetCheck = { ok: true; company: string } | { ok: false; status: 409 | 412; error: string };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function checkTallyTarget(linked: string | null | undefined, requested: string | null | undefined, businessName: string): TargetCheck {
  const req = (requested ?? "").trim();
  if (linked === undefined) return { ok: true, company: req || businessName };
  if (!linked) return { ok: false, status: 412, error: `"${businessName}" isn't linked to a Tally company yet. Open the Tally page and connect — FreWork links the company you choose to this business.` };
  if (req && !same(req, linked)) return { ok: false, status: 409, error: `Blocked: this push targets Tally company "${req}", but "${businessName}" is linked to "${linked}". Switch to the right business, or re-link it on the Tally page.` };
  return { ok: true, company: linked };
}
