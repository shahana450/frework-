"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, Smartphone, Globe, Download, Search, RefreshCw, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface FwUser {
  id: string;
  name?: string;
  email: string;
  mobile?: string;
  method: "google" | "email";
  createdAt: string;
}

const ADMIN_PASS = "frework@admin2024";

export default function AdminPage() {
  const [users, setUsers] = useState<FwUser[]>([]);
  const [search, setSearch] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passErr, setPassErr] = useState(false);
  const [filter, setFilter] = useState<"all" | "google" | "email">("all");

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem("fw_users") || "[]");
      setUsers(data.sort((a: FwUser, b: FwUser) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { setUsers([]); }
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === ADMIN_PASS) { setAuthed(true); setPassErr(false); }
    else { setPassErr(true); }
  };

  const deleteUser = (id: string) => {
    const updated = users.filter(u => u.id !== id);
    localStorage.setItem("fw_users", JSON.stringify(updated));
    setUsers(updated);
  };

  const exportCSV = () => {
    const header = "ID,Name,Email,Mobile,Method,Joined";
    const rows = users.map(u => `${u.id},${u.name || ""},${u.email},${u.mobile || ""},${u.method},${u.createdAt}`).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "frework_users.csv"; a.click();
  };

  const filtered = users.filter(u => {
    const matchFilter = filter === "all" || u.method === filter;
    const matchSearch = !search || [u.name, u.email, u.mobile].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const googleCount = users.filter(u => u.method === "google").length;
  const emailCount = users.filter(u => u.method === "email").length;
  const mobileCount = users.filter(u => u.mobile).length;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1">FreWork User Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Admin Password</label>
              <input type="password" value={pass} onChange={e => { setPass(e.target.value); setPassErr(false); }} placeholder="Enter admin password" className={`w-full border-2 rounded-2xl px-4 py-3 bg-white dark:bg-gray-900 outline-none text-sm dark:text-white transition-all ${passErr ? "border-red-400 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-violet-500"}`} />
              {passErr && <p className="text-red-500 text-xs mt-1">Incorrect password</p>}
            </div>
            <Button type="submit" className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold">
              Access Dashboard
            </Button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-6">
            <Link href="/" className="text-violet-600 hover:underline">← Back to site</Link>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="9" fill="#7C3AED"/><circle cx="18" cy="11" r="2.5" fill="white"/><circle cx="11" cy="23" r="2.5" fill="white"/><circle cx="25" cy="23" r="2.5" fill="white"/><line x1="18" y1="13.5" x2="11" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="18" y1="13.5" x2="25" y2="20.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/><line x1="11" y1="23" x2="25" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-lg leading-none">FreWork Admin</h1>
              <p className="text-xs text-gray-400">User Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={load} variant="outline" size="sm" className="gap-2 rounded-xl border-gray-200 dark:border-gray-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button onClick={exportCSV} size="sm" className="gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ml-2">← Site</Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: users.length, icon: Users, color: "violet", bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600" },
            { label: "Google Sign-ups", value: googleCount, icon: Globe, color: "blue", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600" },
            { label: "Email Sign-ups", value: emailCount, icon: UserCheck, color: "green", bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600" },
            { label: "Mobile Verified", value: mobileCount, icon: Smartphone, color: "orange", bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600" },
          ].map(({ label, value, icon: Icon, bg, text }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${text}`} />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, mobile…" className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm dark:text-white outline-none focus:border-violet-400 transition-all" />
            </div>
            <div className="flex gap-2">
              {(["all", "google", "email"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${filter === f ? "bg-violet-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  {f === "all" ? `All (${users.length})` : f === "google" ? `Google (${googleCount})` : `Email (${emailCount})`}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{users.length === 0 ? "No users yet. Sign-ups will appear here." : "No users match your search."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    {["User", "Email", "Mobile", "Method", "Joined", ""].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-5 py-3 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((user, i) => (
                    <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(user.name || user.email || "?")[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{user.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {user.mobile ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                            +91 {user.mobile}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.method === "google" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400"}`}>
                          {user.method === "google" ? "🔵 Google" : "✉️ Email"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
