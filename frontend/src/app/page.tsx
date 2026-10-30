"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  AlertTriangle, ArrowUpRight, TrendingUp,
  FileCheck2, CheckCircle2, ShieldAlert, ChevronRight,
  Landmark, HelpCircle, Network, Building2,
  FileText, Clock, Download, FileSpreadsheet, RotateCw
} from "lucide-react";
import { fetchApi, getCurrentUser, API_BASE } from "@/lib/api";
import WalkthroughModal from "@/components/WalkthroughModal";
import StatutoryReportsModal from "@/components/StatutoryReportsModal";
import RenewalModal from "@/components/RenewalModal";
import ReleaseApplicationModal from "@/components/ReleaseApplicationModal";

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

interface CollusionRing {
  type: string;
  fdr_number?: string;
  sha256?: string;
  involved_institutions: string[];
  severity: string;
  explanation: string;
}

interface GraphSummary {
  total_nodes: number;
  total_links: number;
  collusion_rings: CollusionRing[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [urgentQueue, setUrgentQueue] = useState<QueueItem[]>([]);
  const [graphData, setGraphData] = useState<GraphSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [instInstruments, setInstInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);
  const [reportsOpen, setReportsOpen] = useState<boolean>(false);
  const [renewalTarget, setRenewalTarget] = useState<any | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"instruments" | "institutions">("instruments");
  const [institutions, setInstitutions] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const user = getCurrentUser();
      setCurrentUser(user);

      if (user?.role === "institution_admin") {
        const [instList, s] = await Promise.all([
          fetchApi<any[]>("/instruments"),
          fetchApi<SummaryData>("/dashboard/summary")
        ]);
        setInstInstruments(instList);
        setSummary(s);
      } else {
        const [s, t, q, g, insts] = await Promise.all([
          fetchApi<SummaryData>("/dashboard/summary"),
          fetchApi<TimelinePoint[]>("/dashboard/timeline"),
          fetchApi<QueueItem[]>("/dashboard/queue?limit=6"),
          fetchApi<GraphSummary>("/graph"),
          fetchApi<any[]>("/dashboard/institutions").catch(() => [])
        ]);
        setSummary(s);
        setTimeline(t);
        setUrgentQueue(q);
        setGraphData(g);
        setInstitutions(insts || []);
      }
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleClockUpdate = () => loadData();
    const handleAuthUpdate = () => loadData();
    window.addEventListener("clockUpdated", handleClockUpdate);
    window.addEventListener("authChanged", handleAuthUpdate);
    return () => {
      window.removeEventListener("clockUpdated", handleClockUpdate);
      window.removeEventListener("authChanged", handleAuthUpdate);
    };
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

  if (currentUser?.role === "institution_admin") {
    const totalInstCorpus = instInstruments.reduce((acc, i) => acc + (i.amount || 0), 0);
    const expiring90 = instInstruments.filter(i => i.days_to_maturity >= 0 && i.days_to_maturity <= 90).length;
    const pendingAction = instInstruments.filter(i => (i.flags_count && i.flags_count > 0) || i.days_to_maturity < 0 || i.status === "FLAGGED").length;
    const lienConfirmedCount = instInstruments.filter(i => i.lien_marked).length;

    return (
      <div className="space-y-6">
        {/* Institution Welcome Header */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {currentUser?.name || "Institution Security Deposit Portal"}
                </h1>
                <span className="text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Technical Institution
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-2xl">
                AICTE Regulation Bureau statutory repository for Fixed Deposit Receipts (FDR) and security deposit obligations pursuant to AICTE Approval Process Handbook (Clause 6.46).
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Submit New / Renewed FDR</span>
              </Link>
              <Link
                href="/release"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition border border-slate-200 dark:border-zinc-700 shadow-sm"
              >
                <FileCheck2 className="w-4 h-4 text-emerald-500" />
                <span>Request Release</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Active Deposits</span>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
              {instInstruments.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Registered FDR instruments</div>
          </div>

          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Deposit Corpus</span>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
              ₹{(totalInstCorpus / 100000).toFixed(1)} <span className="text-sm font-sans font-normal text-slate-500 dark:text-zinc-400">Lakhs</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Pledged to AICTE Regulation Bureau</div>
          </div>

          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Maturing within 90d</span>
            <div className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2 font-mono">
              {expiring90}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {expiring90 > 0 ? "Renewal submission required" : "All maturities beyond 90 days"}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Lien Endorsement</span>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
              {lienConfirmedCount} / {instInstruments.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Mandatory AICTE lien marked</div>
          </div>
        </div>

        {/* Important Regulatory Notice Banner */}
        {pendingAction > 0 ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold block">Statutory Action Required for {pendingAction} Instrument(s)</span>
              <p>
                One or more FDRs have approaching maturities or open scrutiny observations. In accordance with AICTE Approval Process Regulations, please submit the renewed FDR with bank verification or download the official Statutory Notice below to review requirements.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold">Compliant Regulatory Status</span> — All security deposit records are active and within prescribed validity horizons.
            </div>
          </div>
        )}

        {/* Institution Instruments Table */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                Registered Security Deposits & Fixed Deposit Receipts
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Official records of your college&apos;s security deposits lodged with AICTE Regulation Bureau.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">FDR Reference</th>
                  <th className="pb-3 font-semibold">Issuing Bank</th>
                  <th className="pb-3 font-semibold">Deposit Corpus</th>
                  <th className="pb-3 font-semibold">Maturity Date</th>
                  <th className="pb-3 font-semibold">Days Remaining</th>
                  <th className="pb-3 font-semibold">Verification Level</th>
                  <th className="pb-3 font-semibold">Lien Status</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {instInstruments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 font-mono text-slate-900 dark:text-white font-semibold">
                      {item.fdr_number}
                    </td>
                    <td className="py-3.5 text-slate-700 dark:text-zinc-300">
                      {item.bank_name}
                    </td>
                    <td className="py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{(item.amount / 100000).toFixed(1)} Lakhs
                    </td>
                    <td className="py-3.5 font-mono text-slate-700 dark:text-zinc-300">
                      {item.maturity_date}
                    </td>
                    <td className="py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.days_to_maturity < 0 
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" 
                          : item.days_to_maturity <= 30 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" 
                          : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {item.days_to_maturity < 0 ? `Lapsed (${Math.abs(item.days_to_maturity)}d ago)` : `${item.days_to_maturity} days`}
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
                        {item.trust_tier === "BANK_CONFIRMED" ? "Bank Verified" : item.trust_tier === "CROSS_VALIDATED" ? "Doc Extracted" : "Self Declared"}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {item.lien_marked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Lien Endorsed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" /> Pending Endorsement
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/inspector/${item.id}`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-semibold transition"
                          title="View Scrutiny Details"
                        >
                          View Details
                        </Link>
                        {item.days_to_maturity <= 90 && item.status !== "RENEWED" && (
                          <button
                            onClick={() => setRenewalTarget({
                              id: item.id,
                              fdr_number: item.fdr_number,
                              institution_name: item.institution?.name || "My Institute",
                              amount: item.amount,
                              bank_name: item.bank?.name || "Scheduled Bank",
                              maturity_date: item.maturity_date
                            })}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px] transition flex items-center gap-1"
                            title="Submit Renewal Instrument with Parent Lineage"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Renew</span>
                          </button>
                        )}
                        {(item.status === "MATURED" || item.days_to_maturity <= 0) && item.status !== "RELEASE_REQUESTED" && item.status !== "RELEASED" && (
                          <button
                            onClick={() => setReleaseTarget({
                              id: item.id,
                              fdr_number: item.fdr_number,
                              institution_name: item.institution?.name || "My Institute",
                              amount: item.amount,
                              bank_name: item.bank?.name || "Scheduled Bank",
                              maturity_date: item.maturity_date,
                              trust_tier: item.trust_tier,
                              status: item.status
                            })}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-[11px] transition flex items-center gap-1"
                            title="Apply for Security Deposit Release / Refund under APH Clause 6.46"
                          >
                            <FileCheck2 className="w-3 h-3" />
                            <span>Apply for Release</span>
                          </button>
                        )}
                        <a
                          href={`${API_BASE}/instruments/${item.id}/deficiency-notice`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded text-[11px] font-semibold transition inline-flex items-center gap-1"
                          title="Download Official Notice"
                        >
                          <Download className="w-3 h-3" />
                          <span>Notice</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <RenewalModal
          isOpen={!!renewalTarget}
          onClose={() => setRenewalTarget(null)}
          parentInstrument={renewalTarget}
          onSuccess={loadData}
        />

        <ReleaseApplicationModal
          isOpen={!!releaseTarget}
          onClose={() => setReleaseTarget(null)}
          instrument={releaseTarget}
          onSuccess={loadData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Friendly Welcome & Header */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                AICTE Security Deposit & FDR Management Portal
              </h1>
              <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Regulation Bureau
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-3xl">
              Central regulatory administrative system for technical college Fixed Deposit Receipts (FDR), independent bank verification, automated maturity tracking, and Clause 6.46 release authorizations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setReportsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition shadow-sm"
              title="Export Statutory Management Reports (PS 26265 Item 8)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Statutory Reports</span>
            </button>

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
              <span>Pending Regulatory Actions ({urgentCount})</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Lifecycle Status Ribbon */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px] px-2">
          Deposit Lifecycle Status:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(summary.status_distribution || {}).map(([statusKey, count]) => (
            <Link
              key={statusKey}
              href={`/queue?status=${statusKey}`}
              className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-medium transition flex items-center gap-1.5"
            >
              <span className="text-[11px]">{statusKey.replace("_", " ")}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-zinc-700 text-[10px] font-mono font-bold text-slate-900 dark:text-zinc-100">
                {count}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 4 Clean Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Security Cover */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Deposit Value</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
            ₹{summary.total_security_cover_cr.toFixed(1)} <span className="text-sm font-sans font-normal text-slate-500 dark:text-zinc-400">Crores</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">{summary.total_instruments}</span>
            <span>registered technical college deposits</span>
          </div>
        </div>

        {/* Verified & Genuine Ratio */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Bank Authenticated</span>
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
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Action Required Today</span>
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
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Pending Releases</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2 font-mono">
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
            <div className="h-56 mt-4 flex flex-col justify-end">
              <div className="h-44 flex items-end gap-1.5 sm:gap-2 pb-1 border-b border-slate-200 dark:border-zinc-800">
                {timeline.slice(0, 18).map((pt) => {
                  const heightPct = Math.max(Math.round((pt.amount_cr / maxAmount) * 100), 8);
                  const hasCritical = pt.critical_count > 0;
                  return (
                    <Link
                      key={pt.month}
                      href={`/queue?search=${encodeURIComponent(pt.month)}`}
                      className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
                      title={`Click to view all ${pt.count} deposits maturing in ${pt.month}`}
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 dark:bg-zinc-950 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 font-mono">
                        <div className="font-bold flex items-center gap-1">
                          <span>{pt.month}</span>
                          <span className="text-[9px] text-amber-400">&rarr; Filter</span>
                        </div>
                        <div>₹{pt.amount_cr} Cr ({pt.count} deposits)</div>
                        {hasCritical && <div className="text-rose-400 font-bold">{pt.critical_count} Needs Review</div>}
                      </div>

                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t transition-all min-h-[6px] group-hover:opacity-80 group-active:scale-95 ${
                          hasCritical 
                            ? "bg-rose-500 hover:bg-rose-400 shadow-sm shadow-rose-500/20" 
                            : "bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20"
                        }`}
                      ></div>
                    </Link>
                  );
                })}
              </div>
              {/* X Axis Month Labels */}
              <div className="flex items-center gap-1.5 sm:gap-2 pt-2">
                {timeline.slice(0, 18).map((pt) => (
                  <Link
                    key={pt.month}
                    href={`/queue?search=${encodeURIComponent(pt.month)}`}
                    className="flex-1 text-center hover:text-amber-500 transition"
                    title={`Filter by ${pt.month}`}
                  >
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 font-mono block truncate">
                      {pt.month.slice(5)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-3">
            <span>Maturity Month (YYYY-MM)</span>
            <span>Peak Monthly Exposure: ₹{maxAmount.toFixed(1)} Cr</span>
          </div>
        </div>

        {/* Right 1 Col: Verification Status Breakdown */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-3">
              Deposit Verification Status
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Breakdown across the 4-Tier Provenance Matrix from self-declared uploads to bank cryptographic confirmation.
            </p>
            <div className="space-y-4">
              {[
                { label: "Bank Confirmed (Highest Trust)", count: summary.trust_tiers.bank_confirmed, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
                { label: "Document Matched (OCR Verified)", count: summary.trust_tiers.cross_validated, color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
                { label: "Under Scrutiny (Review Required)", count: summary.trust_tiers.doc_extracted, color: "bg-amber-400 dark:bg-amber-500/70", text: "text-amber-600 dark:text-amber-400" },
                { label: "Self-Declared (Unverified)", count: summary.trust_tiers.self_declared, color: "bg-slate-400 dark:bg-zinc-600", text: "text-slate-600 dark:text-zinc-400" },
              ].map((tier) => {
                const pct = Math.round((tier.count / summary.total_instruments) * 100);
                return (
                  <div key={tier.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-700 dark:text-zinc-300 font-medium">{tier.label}</span>
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

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
            <span>Total Inspected:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{summary.total_instruments} FDRs</span>
          </div>
        </div>
      </div>

      {/* Syndicate Collusion & Risk Network Radar Card */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <Network className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Duplicate FDR & Syndicate Collusion Radar
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono animate-pulse">
                {graphData?.collusion_rings?.length || 5} Rings Exposed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Multi-institution collusion engine detecting shared FDR serials and duplicated receipt document hashes across states.
            </p>
          </div>

          <Link
            href="/graph"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-lg text-xs font-semibold transition shrink-0 shadow-sm group"
          >
            <span>View Duplicate FDR Detection Map</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* Collusion Rings Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {graphData?.collusion_rings?.slice(0, 3).map((ring, idx) => (
            <div 
              key={idx}
              className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 flex flex-col justify-between space-y-2 hover:border-red-400 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {ring.type === "DUPLICATE_FDR_SERIAL" ? "DUPLICATE SERIAL CLASH" : "DOCUMENT HASH COLLISION"}
                  </span>
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 font-mono">
                    {ring.severity}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-2 truncate">
                  {ring.fdr_number ? `Serial: ${ring.fdr_number}` : `SHA-256: ${ring.sha256?.slice(0, 16)}...`}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2">
                  {ring.explanation}
                </p>
              </div>

              <div className="pt-2 border-t border-red-100 dark:border-red-900/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">
                  {ring.involved_institutions?.length} Colleges Linked
                </span>
                <Link
                  href="/graph"
                  className="text-red-700 dark:text-red-400 font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Inspect in Graph</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Required Today Table / Institutions Directory */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("instruments")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "instruments"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Priority Action Queue (FDRs)</span>
            </button>

            <button
              onClick={() => setActiveTab("institutions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "institutions"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Institution Directory ({institutions.length} Colleges)</span>
            </button>
          </div>

          <Link href="/queue" className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1">
            View All Deposits ({summary.total_instruments}) &rarr;
          </Link>
        </div>

        {activeTab === "institutions" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold">Technical Institution</th>
                  <th className="pb-3 font-semibold">AICTE ID</th>
                  <th className="pb-3 font-semibold">Location</th>
                  <th className="pb-3 font-semibold">Pledged Security Corpus</th>
                  <th className="pb-3 font-semibold">Instruments Breakdown</th>
                  <th className="pb-3 font-semibold">Compliance Rating</th>
                  <th className="pb-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {institutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 font-medium text-slate-900 dark:text-white max-w-[240px]">
                      <div className="font-semibold text-xs truncate">{inst.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{inst.email} • {inst.phone}</div>
                    </td>
                    <td className="py-3.5 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                      {inst.aicte_id}
                    </td>
                    <td className="py-3.5 text-slate-700 dark:text-zinc-300">
                      {inst.district}, {inst.state}
                    </td>
                    <td className="py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{inst.total_corpus_lakhs} Lakhs
                      <span className="block text-[10px] text-slate-500 font-normal">
                        ({inst.total_corpus_cr} Cr)
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                          {inst.active_count} Active
                        </span>
                        {inst.expiring_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                            {inst.expiring_count} Expiring
                          </span>
                        )}
                        {inst.matured_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                            {inst.matured_count} Matured
                          </span>
                        )}
                        {inst.flagged_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/50">
                            {inst.flagged_count} Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {inst.compliance_score}%
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/queue?search=${encodeURIComponent(inst.name)}`}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                      >
                        <span>Inspect FDRs</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
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
        )}
      </div>

      {/* Interactive Walkthrough Modal */}
      <WalkthroughModal
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />

      {/* Statutory Reports Export Modal (PS 26265 Item 8) */}
      <StatutoryReportsModal
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />

      {/* Renewal Lineage Modal (PS 26265 Item 5) */}
      <RenewalModal
        isOpen={!!renewalTarget}
        onClose={() => setRenewalTarget(null)}
        parentInstrument={renewalTarget}
        onSuccess={loadData}
      />

      {/* Release Application Modal (PS 26265 Item 6) */}
      <ReleaseApplicationModal
        isOpen={!!releaseTarget}
        onClose={() => setReleaseTarget(null)}
        instrument={releaseTarget}
        onSuccess={loadData}
      />
    </div>
  );
}
