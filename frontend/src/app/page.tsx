"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  AlertTriangle, ArrowUpRight,
  FileCheck2, ChevronRight,
  Network, Building2,
  FileText, FileSpreadsheet, ListFilter
} from "lucide-react";
import { fetchApi, getCurrentUser, API_BASE } from "@/lib/api";
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

interface GraphSummary {
  total_nodes: number;
  total_links: number;
  collusion_rings: any[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [urgentQueue, setUrgentQueue] = useState<QueueItem[]>([]);
  const [graphData, setGraphData] = useState<GraphSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [instInstruments, setInstInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reportsOpen, setReportsOpen] = useState<boolean>(false);
  const [renewalTarget, setRenewalTarget] = useState<any | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<any | null>(null);

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
        const [s, q, g] = await Promise.all([
          fetchApi<SummaryData>("/dashboard/summary"),
          fetchApi<QueueItem[]>("/dashboard/queue?limit=10"),
          fetchApi<GraphSummary>("/graph")
        ]);
        setSummary(s);
        setUrgentQueue(q);
        setGraphData(g);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
            Loading Prama Security Deposit System...
          </span>
        </div>
      </div>
    );
  }

  const urgentCount = summary.risk_bands.critical + summary.expiring_windows.days_30;

  // -------------------------------------------------------------
  // INSTITUTION ADMIN (COLLEGE) ATM VIEW
  // -------------------------------------------------------------
  if (currentUser?.role === "institution_admin") {
    const totalInstCorpus = instInstruments.reduce((acc, i) => acc + (i.amount || 0), 0);
    const expiring90 = instInstruments.filter(i => i.days_to_maturity >= 0 && i.days_to_maturity <= 90).length;
    const pendingAction = instInstruments.filter(i => (i.flags_count && i.flags_count > 0) || i.days_to_maturity < 0 || i.status === "FLAGGED").length;

    const handleOpenReleaseModal = (item: any) => {
      setReleaseTarget({
        id: item.id,
        fdr_number: item.fdr_number,
        institution_name: item.institution?.name || currentUser?.name || "College Security Deposit Holder",
        amount: item.amount,
        bank_name: item.bank?.name || item.bank_name || "Bank",
        maturity_date: item.maturity_date,
        trust_tier: item.trust_tier || "SELF_DECLARED",
        status: item.status || "ACTIVE"
      });
    };

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {currentUser?.name || "College Security Deposit Portal"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Manage mandatory AICTE Fixed Deposit Receipts (Clause 6.46)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/submit"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>+ Submit New FDR</span>
            </Link>
            <button
              onClick={() => {
                if (instInstruments.length > 0) {
                  const eligible = instInstruments.find(i => i.status === "ACTIVE" || i.status === "MATURED") || instInstruments[0];
                  handleOpenReleaseModal(eligible);
                }
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold rounded-xl text-xs transition border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-500" />
              <span>Apply for Release</span>
            </button>
          </div>
        </div>

        {/* 3 Big ATM Metric Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Active Deposits</span>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono mt-2">
              {instInstruments.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Registered FDR certificates</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Deposit Value</span>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-2">
              ₹{(totalInstCorpus / 100000).toFixed(1)} <span className="text-sm font-sans font-normal text-slate-500 dark:text-zinc-400">Lakhs</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Pledged to AICTE Regulation Bureau</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Maturing in &lt;90 Days</span>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-2">
              {expiring90}
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {expiring90 > 0 ? "Renewal submission recommended" : "All deposits compliant"}
            </div>
          </div>
        </div>

        {/* Status Callout if attention required */}
        {pendingAction > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-amber-950 dark:text-amber-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <span>
                <strong>Action Needed:</strong> {pendingAction} deposit(s) have upcoming maturities or open scrutiny observations.
              </span>
            </div>
            <Link href="/submit" className="font-bold underline shrink-0">
              Submit Renewal &rarr;
            </Link>
          </div>
        )}

        {/* College Deposits Table */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
              My College Security Deposits
            </h2>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
              {instInstruments.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 font-bold">FDR Reference</th>
                  <th className="py-3 px-4 font-bold">Issuing Bank</th>
                  <th className="py-3 px-4 font-bold">Corpus</th>
                  <th className="py-3 px-4 font-bold">Maturity Date</th>
                  <th className="py-3 px-4 font-bold">Days Left</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                {instInstruments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {item.fdr_number}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                      {item.bank_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{(item.amount / 100000).toFixed(1)}L
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                      {item.maturity_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.days_to_maturity <= 0
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : item.days_to_maturity <= 90
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {item.days_to_maturity <= 0 ? "OVERDUE" : `${item.days_to_maturity}d left`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[11px] text-slate-700 dark:text-zinc-300">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setRenewalTarget({
                            id: item.id,
                            fdr_number: item.fdr_number,
                            institution_name: item.institution?.name || "NIT Pune",
                            amount: item.amount,
                            bank_name: item.bank_name || "Bank",
                            maturity_date: item.maturity_date,
                            institution_id: item.institution_id,
                            bank_id: item.bank_id
                          })}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                          title="Submit renewal"
                        >
                          Renew
                        </button>
                        <button
                          onClick={() => handleOpenReleaseModal(item)}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-xs transition"
                          title="Apply for statutory release of this deposit"
                        >
                          Release
                        </button>
                        <a
                          href={`${API_BASE}/instruments/${item.id}/deficiency-notice`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-lg text-xs transition"
                          title="Download Notice PDF"
                        >
                          Notice
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modals */}
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

  // -------------------------------------------------------------
  // REGULATORY BUREAU OFFICER (ATM-GRADE MAIN DASHBOARD)
  // -------------------------------------------------------------
  const verifiedRate = Math.round((summary.trust_tiers.bank_confirmed / Math.max(1, summary.total_instruments)) * 100);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Welcome & Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              AICTE Security Deposit Control
            </h1>
            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Live Bureau System
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Statutory Fixed Deposit Receipt (FDR) verification, bank cross-checks, and maturity management.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setReportsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold rounded-xl text-xs transition border border-slate-200 dark:border-zinc-700 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Export Reports</span>
          </button>
        </div>
      </div>

      {/* 3 Giant ATM Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Total Deposit Value */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Total Deposit Value
            </span>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono mt-2">
              ₹{summary.total_security_cover_cr.toFixed(1)} <span className="text-lg font-sans font-normal text-slate-500">Crores</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span>Registered Deposits:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{summary.total_instruments} FDRs</span>
          </div>
        </div>

        {/* Metric 2: Urgent Attention Required */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Requires Urgent Action
            </span>
            <div className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 font-mono mt-2">
              {urgentCount}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-rose-600 dark:text-rose-400 font-bold">{summary.risk_bands.critical} Critical Flags</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{summary.expiring_windows.days_30} Maturing &lt;30d</span>
          </div>
        </div>

        {/* Metric 3: Genuine Bank Confirmed */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Bank-Confirmed Genuine
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-2">
              {verifiedRate}%
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span>Direct Confirmation:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{summary.trust_tiers.bank_confirmed} Valid</span>
          </div>
        </div>
      </div>

      {/* 4 Large ATM-Touch Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Submit FDR */}
        <Link
          href="/submit"
          className="group bg-white dark:bg-zinc-900 hover:bg-amber-500 border border-slate-200 dark:border-zinc-800 hover:border-amber-500 rounded-2xl p-5 shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 group-hover:bg-slate-950 text-amber-600 group-hover:text-amber-400 flex items-center justify-center transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-950 transition-colors" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-slate-950 transition-colors">
              Submit FDR
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 group-hover:text-slate-900/80 transition-colors mt-0.5">
              Register or renew deposit certificate
            </p>
          </div>
        </Link>

        {/* Tile 2: Action Queue */}
        <Link
          href="/queue"
          className="group bg-white dark:bg-zinc-900 hover:bg-slate-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 hover:border-slate-900 rounded-2xl p-5 shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 group-hover:bg-white text-blue-600 group-hover:text-slate-950 flex items-center justify-center transition-colors">
              <ListFilter className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
              {urgentCount} Urgent
            </span>
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-white transition-colors">
              Action Queue
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 group-hover:text-slate-300 transition-colors mt-0.5">
              Triage flags, discrepancies, maturities
            </p>
          </div>
        </Link>

        {/* Tile 3: Release Portal */}
        <Link
          href="/release"
          className="group bg-white dark:bg-zinc-900 hover:bg-emerald-600 border border-slate-200 dark:border-zinc-800 hover:border-emerald-600 rounded-2xl p-5 shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 group-hover:bg-slate-950 text-emerald-600 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-950 transition-colors" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-white transition-colors">
              Release Portal
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 group-hover:text-emerald-100 transition-colors mt-0.5">
              Maker-checker refund approval
            </p>
          </div>
        </Link>

        {/* Tile 4: Fraud Detection Map */}
        <Link
          href="/graph"
          className="group bg-white dark:bg-zinc-900 hover:bg-rose-600 border border-slate-200 dark:border-zinc-800 hover:border-rose-600 rounded-2xl p-5 shadow-sm transition-all duration-150 flex flex-col justify-between min-h-[140px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 group-hover:bg-slate-950 text-rose-600 group-hover:text-rose-400 flex items-center justify-center transition-colors">
              <Network className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:bg-white group-hover:text-rose-600">
              {graphData?.collusion_rings?.length || 5} Rings
            </span>
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-white transition-colors">
              Fraud Detection
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 group-hover:text-rose-100 transition-colors mt-0.5">
              Duplicate receipts & collusion rings
            </p>
          </div>
        </Link>
      </div>

      {/* Immediate Attention Register Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Deposits Requiring Action Today
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Priority queue of deposits with open discrepancies or upcoming maturity
            </p>
          </div>
          <Link
            href="/queue"
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
          >
            <span>View All ({summary.total_instruments})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4 font-bold">FDR Reference</th>
                <th className="py-3 px-4 font-bold">Institution</th>
                <th className="py-3 px-4 font-bold">Bank</th>
                <th className="py-3 px-4 font-bold">Amount</th>
                <th className="py-3 px-4 font-bold">Maturity</th>
                <th className="py-3 px-4 font-bold">Finding / Status</th>
                <th className="py-3 px-4 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
              {urgentQueue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    {item.fdr_number}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 max-w-[200px] truncate" title={item.institution_name}>
                    {item.institution_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                    {item.bank_name}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    ₹{(item.amount / 100000).toFixed(1)}L
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-zinc-400">
                    {item.maturity_date}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.risk_band === "CRITICAL"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : item.days_to_maturity <= 30
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                    }`}>
                      {item.primary_reason || item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/inspector/${item.id}`}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition inline-flex items-center gap-1"
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

      {/* Statutory Reports Export Modal */}
      <StatutoryReportsModal
        isOpen={reportsOpen}
        onClose={() => setReportsOpen(false)}
      />
    </div>
  );
}
