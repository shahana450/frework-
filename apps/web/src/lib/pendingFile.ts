// A file picked on one page and read on the next (Home → FreBook AI). Kept in memory only; it's gone on reload.
let pending: File[] = [];
export const setPendingFiles = (files: File[]) => { pending = files; };
export const takePendingFiles = (): File[] => { const f = pending; pending = []; return f; };
