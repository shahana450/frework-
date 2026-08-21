"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FreWorkLogo } from "@/components/ui/frework-logo";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Phone, Mail, Building2, IndianRupee, Search } from "lucide-react";

interface Order {
  id: string;
  created_at: string;
  paid_at: string | null;
  service_key: string;
  service_name: string;
  amount_paise: number;
  status: string;
  phonepe_txn_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  business_name: string | null;
  notes: string | null;
}

const ADMIN_EMAILS = ["admin.frework@gmail.com", "admin.frework@gmail.com"];

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  paid:    { color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
  pending: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)" },
  failed:  { color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
};

export default function OrdersAdminPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      if (!ADMIN_EMAILS.includes(data.user.email ?? "")) { router.push("/dashboard"); return; }
      setIsAdmin(true);
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fw_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_email?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q) ||
      o.service_name?.toLowerCase().includes(q) ||
      o.business_name?.toLowerCase().includes(q) ||
      o.phonepe_txn_id?.toLowerCase().includes(q)
    );
  });

  const totalRevenue = orders.filter(o => o.status === "paid").reduce((sum, o) => sum + (o.amount_paise / 100), 0);
  const paidCount = orders.filter(o => o.status === "paid").length;

  if (!isAdmin && !loading) return null;

  return (
    <div className="min-h-screen" style={{ background: "#070C1A", color: "#EDE8DC" }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-30" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(7,12,26,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <FreWorkLogo size={28} />
            </Link>
            <span style={{ color: "#4A5A72" }}>/</span>
            <Link href="/dashboard" className="text-xs font-semibold" style={{ color: "#8A9BB8" }}>
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />Admin
            </Link>
            <span style={{ color: "#4A5A72" }}>/</span>
            <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>Service Orders</span>
          </div>
          <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: "#8A9BB8" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-black mb-1" style={{ color: "#EDE8DC" }}>Service Orders</h1>
        <p className="text-sm mb-8" style={{ color: "#8A9BB8" }}>All paid service orders from customers via PhonePe.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Orders", value: orders.length, color: "#C9A84C", icon: "📋" },
            { label: "Paid Orders", value: paidCount, color: "#10B981", icon: "✅" },
            { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, color: "#60A5FA", icon: "💰" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-5" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: "#4A5A72" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-6"
          style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.12)" }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#4A5A72" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, service or transaction ID..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#EDE8DC" }} />
        </div>

        {/* Orders */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: "rgba(201,168,76,0.2)", borderTopColor: "#C9A84C" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border" style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
            <p className="text-3xl mb-3">📭</p>
            <p className="font-bold text-sm" style={{ color: "#8A9BB8" }}>{search ? "No orders match your search" : "No orders yet"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
              const amount = order.amount_paise / 100;
              const date = new Date(order.paid_at || order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              const time = new Date(order.paid_at || order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={order.id} className="rounded-2xl border overflow-hidden"
                  style={{ background: "#0C1428", borderColor: "rgba(201,168,76,0.1)" }}>
                  <div className="h-[2px]" style={{ background: `linear-gradient(90deg,${st.color},transparent)` }} />
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      {/* Left: customer + service */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-black text-sm" style={{ color: "#EDE8DC" }}>
                            {order.customer_name || "Unknown"}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-semibold mb-2" style={{ color: "#C9A84C" }}>
                          {order.service_name || order.service_key}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#4A5A72" }}>
                          {order.customer_phone && (
                            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
                              <Phone className="w-3 h-3" />{order.customer_phone}
                            </a>
                          )}
                          {order.customer_email && (
                            <a href={`mailto:${order.customer_email}`} className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                              <Mail className="w-3 h-3" />{order.customer_email}
                            </a>
                          )}
                          {order.business_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />{order.business_name}
                            </span>
                          )}
                        </div>
                        {order.notes && (
                          <p className="text-xs mt-2 italic" style={{ color: "#4A5A72" }}>"{order.notes}"</p>
                        )}
                      </div>

                      {/* Right: amount + date */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black" style={{ color: "#10B981" }}>
                          ₹{amount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[11px]" style={{ color: "#4A5A72" }}>{date}</p>
                        <p className="text-[10px]" style={{ color: "#4A5A72" }}>{time}</p>
                      </div>
                    </div>

                    {/* Transaction ID + WhatsApp */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t flex-wrap gap-2"
                      style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <p className="text-[10px] font-mono" style={{ color: "#4A5A72" }}>
                        TXN: {order.phonepe_txn_id || "—"}
                      </p>
                      {order.customer_phone && (
                        <a href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(order.customer_name || "")}%2C%20your%20FreWork%20order%20for%20${encodeURIComponent(order.service_name || "")}%20has%20been%20received.%20Our%20team%20will%20contact%20you%20shortly.`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                          style={{ background: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.25)" }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp Customer
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

