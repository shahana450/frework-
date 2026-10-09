// Who may do what. Checked on the server for every finance action.
export type Role = "owner" | "admin" | "accountant" | "ca_reviewer" | "viewer";
export type Action =
  | "view"          // read books and reports
  | "post"          // create or approve accounting entries
  | "reverse"       // correct/reverse posted entries
  | "upload"        // upload documents for review
  | "integrate"     // push to / sync with Tally and other systems
  | "view_audit"    // read the audit log
  | "lock"          // lock or unlock financial years
  | "manage_team"   // invite, change roles, remove members
  | "export_data"   // download all of the business's data (members only)
  | "delete_business"; // delete the business (owner only)

const MATRIX: Record<Role, Action[]> = {
  owner: ["view", "post", "reverse", "upload", "integrate", "view_audit", "lock", "manage_team", "export_data", "delete_business"],
  // FreWork admin: support access, not a member — can't export a business's data or delete it
  admin: ["view", "post", "reverse", "upload", "integrate", "view_audit", "lock", "manage_team"],
  accountant: ["view", "post", "reverse", "upload", "integrate", "view_audit", "export_data"],
  ca_reviewer: ["view", "view_audit", "export_data"],
  viewer: ["view", "export_data"],
};

export const can = (role: Role, action: Action) => MATRIX[role]?.includes(action) ?? false;

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner", admin: "Admin", accountant: "Accountant", ca_reviewer: "CA reviewer", viewer: "Viewer",
};

export const ACTION_LABEL: Record<Action, string> = {
  view: "view the books", post: "post entries", reverse: "reverse entries", upload: "upload documents",
  integrate: "sync with Tally", view_audit: "see the audit log", lock: "lock financial years", manage_team: "manage the team",
  export_data: "export the business's data", delete_business: "delete the business",
};
