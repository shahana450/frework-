"use client";

export type UserRole = "client" | "freelancer" | "space_owner";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  city?: string;
  plan?: "free" | "basic" | "pro";
}

const KEY = "frework_user";

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export function isLoggedIn(): boolean {
  return !!getUser();
}

export function hasPaidPlan(): boolean {
  const u = getUser();
  return !!u && (u.plan === "basic" || u.plan === "pro");
}
