"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  AlertTriangle, Clock, ArrowUpRight, TrendingUp,
  FileCheck2, CheckCircle2, ShieldAlert, ChevronRight
} from "lucide-react";
import { fetchApi } from "@/lib/api";

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

export default function CockpitPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [urgentQueue, setUrgentQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      console.error(e);
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
          <span className="text-xs text-zinc-400 font-mono">Connecting to AICTE Regulatory Bureau Database...</span>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...timeline.map((t) => t.amount_cr), 1);

  return (
    <div className="space-y-6">
      {/* Cockpit Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            AICTE Regulatory Oversight Cockpit
            <span className="text-xs font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
              LIVE DB SYNC
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time security deposit coverage, automated risk triage, and cryptographic verification posture.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/queue"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-xs font-medium transition"
          >
            <span>Review Act Today Queue ({summary.risk_bands.critical} Critical)</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Stream Grid (High Density) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Security Cover */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Total Security Cover</div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            ₹{summary.total_security_cover_cr.toFixed(1)} <span className="text-xs text-zinc-400 font-sans font-normal">Cr</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
            <span>{summary.total_instruments} instruments active</span>
          </div>
        </div>

        {/* Bank Confirmed Ratio */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Cryptographic Trust</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            {Math.round((summary.trust_tiers.bank_confirmed / summary.total_instruments) * 100)}%
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {summary.trust_tiers.bank_confirmed} bank-signed verified
          </div>
        </div>

        {/* Expiry Cliff (Next 30 Days) */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Imminent Expiry (&lt;30d)</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">
            {summary.expiring_windows.days_30}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {summary.expiring_windows.days_90} expiring within 90 days
          </div>
        </div>

        {/* Critical Flags Raised */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center justify-between">
            <span>Open Regulatory Flags</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1 font-mono">
            {summary.open_flags}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {summary.risk_bands.critical} critical risk instruments
          </div>
        </div>

        {/* Maker-Checker Pending */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-lg col-span-2 md:col-span-1">
          <div className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Release</span>
            <FileCheck2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 mt-1 font-mono">
            {summary.pending_release_requests}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            Awaiting 2-tier approval
          </div>
        </div>
      </div>

      {/* Main Grid: Maturity Cliff Heatmap & Priority Triage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Maturity Cliff Radar (Timeline Chart) */}
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Maturity Cliff Radar (24-Month Exposure Horizon)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Monthly aggregate security deposit liability approaching renewal/maturity across India.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Standard
                </span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Critical Flagged
                </span>
              </div>
            </div>

            {/* CSS Bar Chart */}
            <div className="h-56 mt-6 flex items-end gap-2 pt-6 pb-2 border-b border-zinc-800">
              {timeline.slice(0, 18).map((pt) => {
                const heightPct = Math.max(Math.round((pt.amount_cr / maxAmount) * 100), 8);
                const hasCritical = pt.critical_count > 0;
                return (
                  <div key={pt.month} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    {/* Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-zinc-950 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-xl whitespace-nowrap z-10 font-mono">
                      <div>{pt.month}</div>
                      <div>₹{pt.amount_cr} Cr ({pt.count} FDRs)</div>
                      {hasCritical && <div className="text-rose-400">{pt.critical_count} Critical</div>}
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        hasCritical 
                          ? "bg-rose-500/80 group-hover:bg-rose-400" 
                          : "bg-indigo-600/70 group-hover:bg-indigo-500"
                      }`}
                    ></div>
                    <span className="text-[10px] text-zinc-500 font-mono -rotate-45 origin-top-left mt-2 block">
                      {pt.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-3">
            <span>X-Axis: Maturity Months (YYYY-MM)</span>
            <span>Y-Axis: Peak Exposure: ₹{maxAmount.toFixed(1)} Cr</span>
          </div>
        </div>

        {/* Right 1 Col: Trust Tier & Status Distribution */}
        <div className="space-y-4">
          {/* Trust Tier Distribution */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Provenance Trust Tiers
            </h3>
            <div className="space-y-2.5">
              {[
                { label: "Bank Confirmed (Ed25519/Nodal)", count: summary.trust_tiers.bank_confirmed, color: "bg-emerald-500", text: "text-emerald-400" },
                { label: "Cross-Validated (OCR + Form)", count: summary.trust_tiers.cross_validated, color: "bg-blue-500", text: "text-blue-400" },
                { label: "Document Extracted Only", count: summary.trust_tiers.doc_extracted, color: "bg-purple-500", text: "text-purple-400" },
                { label: "Self-Declared (Unverified)", count: summary.trust_tiers.self_declared, color: "bg-amber-500", text: "text-amber-400" },
              ].map((tier) => {
                const pct = Math.round((tier.count / summary.total_instruments) * 100);
                return (
                  <div key={tier.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{tier.label}</span>
                      <span className={`font-mono font-medium ${tier.text}`}>{tier.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${tier.color}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Regulatory Modules
            </div>
            <Link
              href="/graph"
              className="flex items-center justify-between p-2 rounded bg-zinc-950 hover:bg-zinc-800 text-xs text-zinc-300 transition border border-zinc-800"
            >
              <span>Fraud Syndicate Topology Graph</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </Link>
            <Link
              href="/audit"
              className="flex items-center justify-between p-2 rounded bg-zinc-950 hover:bg-zinc-800 text-xs text-zinc-300 transition border border-zinc-800"
            >
              <span>Audit Ledger & Sabotage Verification</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </Link>
            <Link
              href="/evaluation"
              className="flex items-center justify-between p-2 rounded bg-zinc-950 hover:bg-zinc-800 text-xs text-zinc-300 transition border border-zinc-800"
            >
              <span>Forensics Benchmark (N=200 Precision/Recall)</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Act Today Urgent Triage Stream */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Highest-Priority Regulatory Interventions (&quot;Act Today&quot;)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ranked dynamically by Urgency × Security Amount × Delinquency History × Open Flags.
            </p>
          </div>
          <Link href="/queue" className="text-xs text-amber-400 hover:text-amber-300 font-medium">
            View All ({summary.total_instruments}) &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                <th className="pb-2.5">Institution</th>
                <th className="pb-2.5">FDR Serial</th>
                <th className="pb-2.5">Amount</th>
                <th className="pb-2.5">Maturity</th>
                <th className="pb-2.5">Trust Tier</th>
                <th className="pb-2.5">Risk Score</th>
                <th className="pb-2.5">Primary Reason</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {urgentQueue.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                  <td className="py-3 font-medium text-white max-w-[220px] truncate">
                    {item.institution_name}
                    <span className="block text-[11px] text-zinc-500 font-normal">{item.state}</span>
                  </td>
                  <td className="py-3 font-mono text-zinc-300">
                    {item.fdr_number}
                    <span className="block text-[10px] text-zinc-500">{item.bank_name}</span>
                  </td>
                  <td className="py-3 font-mono font-medium text-white">
                    ₹{(item.amount / 100000).toFixed(1)}L
                  </td>
                  <td className="py-3">
                    <span className="font-mono text-zinc-300">{item.maturity_date}</span>
                    <span className={`block text-[10px] ${item.days_to_maturity < 0 ? "text-rose-400 font-bold" : item.days_to_maturity <= 30 ? "text-amber-400" : "text-zinc-500"}`}>
                      {item.days_to_maturity < 0 ? `Lapsed ${Math.abs(item.days_to_maturity)}d ago` : `in ${item.days_to_maturity} days`}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      item.trust_tier === "BANK_CONFIRMED" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      item.trust_tier === "CROSS_VALIDATED" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                      "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {item.trust_tier}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      item.risk_band === "CRITICAL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" :
                      item.risk_band === "HIGH" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>
                      {item.risk_score} • {item.risk_band}
                    </span>
                  </td>
                  <td className="py-3 text-zinc-400 max-w-[200px] truncate" title={item.primary_reason}>
                    {item.primary_reason}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/inspector/${item.id}`}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded text-xs font-medium transition inline-flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
