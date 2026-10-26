"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  AlertTriangle, ArrowUpRight, TrendingUp,
  FileCheck2, CheckCircle2, ShieldAlert, ChevronRight,
  Landmark, HelpCircle, Sparkles
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import WalkthroughModal from "@/components/WalkthroughModal";

interface SummaryData {
  simulated_date: string;
  total_instruments: number;
  total_security_cover_amount: number;
  total_security_cover_cr: number;
  status_distribution: Record<string, number>;
  trust_tiers: {
    bank_confirmed: number;
    cross_validated: number;
    doc_extracted: number;
    self_declared: number;
  };
  risk_bands: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  expiring_windows: {
    days_30: number;
    days_60: number;
    days_90: number;
  };
  open_flags: number;
  pending_release_requests: number;
}

interface TimelinePoint {
  month: string;
  count: number;
  amount_cr: number;
  critical_count: number;
}

interface QueueItem {
  id: number;
  fdr_number: string;
  institution_name: string;
  state: string;
  bank_name: string;
  amount: number;
  amount_cr: number;
  maturity_date: string;
  days_to_maturity: number;
  status: string;
  trust_tier: string;
  risk_score: number;
  risk_band: string;
  primary_reason: string;
  open_flags_count: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [urgentQueue, setUrgentQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [s, t, q] = await Promise.all([
        fetchApi<SummaryData>("/dashboard/summary"),
        fetchApi<TimelinePoint[]>("/dashboard/timeline"),
        fetchApi<QueueItem[]>("/dashboard/queue?limit=6")
      ]);
      setSummary(s);
      setTimeline(t);
      setUrgentQueue(q);
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleClockUpdate = () => loadData();
    window.addEventListener("clockUpdated", handleClockUpdate);
    return () => window.removeEventListener("clockUpdated", handleClockUpdate);
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Connecting to AICTE Security Deposit Database...</span>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...timeline.map((t) => t.amount_cr), 1);
  const urgentCount = summary.risk_bands.critical + summary.expiring_windows.days_30;

  return (
    <div className="space-y-6">
      {/* Friendly Welcome & Header */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Prama — Security Deposit Oversight Dashboard
              </h1>
              <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live System
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-3xl">
              Monitor institutional security deposits, verify genuineness with banks, track upcoming maturities, and authorize secure fund releases.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setWalkthroughOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition border border-slate-200 dark:border-zinc-700 shadow-sm"
            >
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <span>How It Works</span>
            </button>

            <Link
              href="/queue"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm"
            >
              <span>Review Action Queue ({urgentCount})</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Clean Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Security Cover */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Security Cover</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            ₹{summary.total_security_cover_cr.toFixed(1)} <span className="text-sm font-sans font-normal text-slate-500 dark:text-zinc-400">Crores</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">{summary.total_instruments}</span>
            <span>active technical college deposits</span>
          </div>
        </div>

        {/* Verified & Genuine Ratio */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Bank Verified</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {Math.round((summary.trust_tiers.bank_confirmed / summary.total_instruments) * 100)}%
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{summary.trust_tiers.bank_confirmed}</span> FDRs directly confirmed by banks
          </div>
        </div>

        {/* Needs Attention Today */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Needs Attention</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
            {urgentCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1">
            <span className="text-rose-600 dark:text-rose-400 font-semibold">{summary.risk_bands.critical} critical</span>
            <span>•</span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">{summary.expiring_windows.days_30} expiring &lt;30d</span>
          </div>
        </div>

        {/* Pending Deposit Releases */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Pending Releases</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono">
            {summary.pending_release_requests}
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
            Awaiting 2-officer approval before release
          </div>
        </div>
      </div>

      {/* Middle Section: Upcoming Expiries & Verification Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Renewals & Expiries Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  Upcoming Expiries & Renewal Schedule
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Monthly value of fixed deposits approaching maturity. Colleges must submit renewal proof 30 days prior.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Standard Renewal
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Discrepancy Flagged
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="h-52 mt-6 flex items-end gap-2 pt-6 pb-2 border-b border-slate-200 dark:border-zinc-800">
              {timeline.slice(0, 18).map((pt) => {
                const heightPct = Math.max(Math.round((pt.amount_cr / maxAmount) * 100), 8);
                const hasCritical = pt.critical_count > 0;
                return (
                  <div key={pt.month} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 dark:bg-zinc-950 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 font-mono">
                      <div className="font-bold">{pt.month}</div>
                      <div>₹{pt.amount_cr} Cr ({pt.count} deposits)</div>
                      {hasCritical && <div className="text-rose-400 font-bold">{pt.critical_count} Needs Review</div>}
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        hasCritical 
                          ? "bg-rose-500 hover:bg-rose-400" 
                          : "bg-indigo-600 hover:bg-indigo-500"
                      }`}
                    ></div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono -rotate-45 origin-top-left mt-2 block">
                      {pt.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-3">
            <span>Maturity Month (YYYY-MM)</span>
            <span>Peak Monthly Exposure: ₹{maxAmount.toFixed(1)} Cr</span>
          </div>
        </div>

        {/* Right 1 Col: Verification Status & Helpful Shortcuts */}
        <div className="space-y-4">
          {/* Verification Status */}
          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3">
              Deposit Verification Status
            </h3>
            <div className="space-y-3">
              {[
                { label: "Bank Confirmed (Highest Trust)", count: summary.trust_tiers.bank_confirmed, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                { label: "Document Matched (OCR Verified)", count: summary.trust_tiers.cross_validated, color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
                { label: "Under Scrutiny (Review Required)", count: summary.trust_tiers.doc_extracted, color: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
                { label: "Self-Declared (Unverified)", count: summary.trust_tiers.self_declared, color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
              ].map((tier) => {
                const pct = Math.round((tier.count / summary.total_instruments) * 100);
                return (
                  <div key={tier.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-zinc-300 font-medium">{tier.label}</span>
                      <span className={`font-mono font-bold ${tier.text}`}>{tier.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${tier.color}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Helpful Tools & Checks
            </div>
            <Link
              href="/release"
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-xs text-slate-700 dark:text-zinc-200 transition border border-slate-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-purple-500" />
                <span className="font-medium">Deposit Release Approvals</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            </Link>
            <Link
              href="/graph"
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-xs text-slate-700 dark:text-zinc-200 transition border border-slate-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span className="font-medium">Bank & College Risk Network</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            </Link>
            <Link
              href="/knowledge"
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-xs text-slate-700 dark:text-zinc-200 transition border border-slate-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span className="font-medium">AICTE Rules & Compliance Handbook</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Action Required Today Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Action Required Today (Priority Attention List)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Deposits needing urgent regulatory officer review due to critical compliance flags or near-term expiration.
            </p>
          </div>
          <Link href="/queue" className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1">
            View All Deposits ({summary.total_instruments}) &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                <th className="pb-3 font-semibold">College / Institute</th>
                <th className="pb-3 font-semibold">FDR & Bank</th>
                <th className="pb-3 font-semibold">Deposit Value</th>
                <th className="pb-3 font-semibold">Maturity / Expiry</th>
                <th className="pb-3 font-semibold">Verification Status</th>
                <th className="pb-3 font-semibold">Why Review is Needed</th>
                <th className="pb-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {urgentQueue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                  <td className="py-3.5 font-medium text-slate-900 dark:text-white max-w-[220px]">
                    <div className="truncate font-semibold">{item.institution_name}</div>
                    <span className="block text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{item.state}</span>
                  </td>
                  <td className="py-3.5 font-mono text-slate-700 dark:text-zinc-300">
                    <span className="font-semibold">{item.fdr_number}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-zinc-400 font-sans">{item.bank_name}</span>
                  </td>
                  <td className="py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                    ₹{(item.amount / 100000).toFixed(1)} Lakhs
                  </td>
                  <td className="py-3.5">
                    <span className="font-mono text-slate-700 dark:text-zinc-300">{item.maturity_date}</span>
                    <span className={`block text-[10px] font-semibold ${
                      item.days_to_maturity < 0 
                        ? "text-rose-600 dark:text-rose-400" 
                        : item.days_to_maturity <= 30 
                        ? "text-amber-600 dark:text-amber-400" 
                        : "text-slate-500 dark:text-zinc-400"
                    }`}>
                      {item.days_to_maturity < 0 ? `Lapsed ${Math.abs(item.days_to_maturity)} days ago` : `Expires in ${item.days_to_maturity} days`}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                      item.trust_tier === "BANK_CONFIRMED" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30" 
                        : item.trust_tier === "CROSS_VALIDATED" 
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30" 
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                    }`}>
                      {item.trust_tier === "BANK_CONFIRMED" ? "Bank Confirmed" : item.trust_tier === "CROSS_VALIDATED" ? "Document Matched" : "Needs Review"}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-600 dark:text-zinc-300 max-w-[220px]" title={item.primary_reason}>
                    <div className="line-clamp-2 text-xs">
                      {item.primary_reason}
                    </div>
                  </td>
                  <td className="py-3.5 text-right">
                    <Link
                      href={`/inspector/${item.id}`}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                    >
                      <span>Review</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Walkthrough Modal */}
      <WalkthroughModal
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />
    </div>
  );
}
