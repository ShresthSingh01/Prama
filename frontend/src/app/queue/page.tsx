"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ListFilter, Search, AlertTriangle, 
  ChevronRight, ChevronLeft,
  Sparkles, X, Download, FileSpreadsheet, ChevronDown
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface InstrumentRow {
  id: number;
  institution_id: number;
  institution_name: string;
  bank_id: number;
  bank_name: string;
  fdr_number: string;
  amount: number;
  issue_date: string;
  maturity_date: string;
  tenure_days: number;
  interest_rate: number;
  status: string;
  trust_tier: string;
  risk_score: number;
  risk_band: string;
  days_to_maturity: number;
  flags_count: number;
  lien_marked?: boolean;
  joint_holding_confirmed?: boolean;
}

export default function QueuePage() {
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [nlQuery, setNlQuery] = useState<string>("");
  const [activeFilterChips, setActiveFilterChips] = useState<Record<string, any> | null>(null);
  const [isNlSearching, setIsNlSearching] = useState<boolean>(false);
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const loadInstruments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedTier !== "ALL") params.append("trust_tier", selectedTier);
      if (selectedRisk !== "ALL") params.append("risk_band", selectedRisk);
      if (selectedStatus !== "ALL" && selectedStatus !== "LIEN_PENDING") params.append("status", selectedStatus);

      let data = await fetchApi<InstrumentRow[]>(`/instruments?${params.toString()}`);
      if (selectedStatus === "LIEN_PENDING") {
        data = data.filter(i => !i.lien_marked);
      }
      setInstruments(data);
      setPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNlSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;

    setIsNlSearching(true);
    setLoading(true);
    try {
      const res = await fetchApi<any>("/search/nl", {
        method: "POST",
        body: JSON.stringify({ query: nlQuery })
      });
      setActiveFilterChips(res.filter || {});
      setInstruments(res.results || []);
      setPage(1);
    } catch (e) {
      console.error("NL Search failed:", e);
    } finally {
      setIsNlSearching(false);
      setLoading(false);
    }
  };

  const clearNlFilter = () => {
    setActiveFilterChips(null);
    setNlQuery("");
    loadInstruments();
  };

  useEffect(() => {
    if (!activeFilterChips) {
      loadInstruments();
    }
  }, [selectedTier, selectedRisk, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInstruments();
  };

  const totalPages = Math.ceil(instruments.length / pageSize) || 1;
  const displayedInstruments = instruments.slice((page - 1) * pageSize, page * pageSize);

  const criticalCount = instruments.filter(i => i.risk_band === "CRITICAL").length;
  const highCount = instruments.filter(i => i.risk_band === "HIGH").length;
  const mediumCount = instruments.filter(i => i.risk_band === "MEDIUM").length;
  const lowCount = instruments.filter(i => i.risk_band === "LOW").length;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-amber-500" />
            Institutional Fixed Deposits & Action Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            View, filter, and review technical college security deposit certificates across India.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">
          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            {instruments.length} Deposits Found
          </span>

          <div className="relative">
            <button
              onClick={() => setReportsDropdownOpen(!reportsDropdownOpen)}
              className="px-3 py-1 rounded-md bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Statutory Reports</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {reportsDropdownOpen && (
              <div 
                className="absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in"
                onMouseLeave={() => setReportsDropdownOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  AICTE PS 26265 Mandated Reports
                </div>

                <a
                  href={`${API_BASE}/reports/pending-verifications?format=csv`}
                  download="Pending_Verifications_Report.csv"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition group"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pending Bank Verifications</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">CSV</span>
                </a>

                <a
                  href={`${API_BASE}/reports/upcoming-maturities?format=csv`}
                  download="Upcoming_Maturities_Report.csv"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition group"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-blue-500" />
                    <span>Upcoming Maturities (&lt;90d)</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">CSV</span>
                </a>

                <a
                  href={`${API_BASE}/reports/missing-documents?format=csv`}
                  download="Missing_Documents_Report.csv"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition group"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-rose-500" />
                    <span>Missing Receipt Documents</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">CSV</span>
                </a>

                <a
                  href={`${API_BASE}/reports/intervention-cases?format=csv`}
                  download="Intervention_Cases_Report.csv"
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition group"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    <span>Regulatory Intervention Cases</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">CSV</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Natural Language Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-amber-500/30 p-3.5 rounded-xl text-xs space-y-2 shadow-sm">
        <form onSubmit={handleNlSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-xs shrink-0 border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Smart Search</span>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask in plain language, e.g. 'Show Canara Bank FDRs above 10 lakhs expiring next month in Maharashtra'..."
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isNlSearching || !nlQuery.trim()}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition shadow-sm"
          >
            {isNlSearching ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Parsed Filter Chips */}
        {activeFilterChips && (
          <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Applied Filters:</span>
              {Object.entries(activeFilterChips).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-zinc-800 text-amber-700 dark:text-amber-300 font-mono text-[11px] border border-amber-200 dark:border-zinc-700 flex items-center gap-1">
                  <span>{k}: {Array.isArray(v) ? v.join(", ") : String(v)}</span>
                </span>
              ))}
            </div>
            <button
              onClick={clearNlFilter}
              className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 transition"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder="Search college name or FDR serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
          <button type="submit" className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-lg transition font-medium">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Verification Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <span className="text-slate-500 dark:text-zinc-400">Verification:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Deposits</option>
              <option value="BANK_CONFIRMED">Bank Confirmed</option>
              <option value="CROSS_VALIDATED">Document Matched</option>
              <option value="SELF_DECLARED">Unverified</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <span className="text-slate-500 dark:text-zinc-400">Risk Level:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical (High Attention)</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low (Safe)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <span className="text-slate-500 dark:text-zinc-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Safe)</option>
              <option value="EXPIRING">Expiring (&lt;90 days)</option>
              <option value="OVERDUE">Overdue (Expired)</option>
              <option value="FLAGGED">Discrepancy Flagged</option>
              <option value="LIEN_PENDING">AICTE Lien Pending</option>
              <option value="RELEASE_REQUESTED">Release Requested</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>
        </div>
      </div>

      {/* Risk Band Summary Quick Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <button
          onClick={() => setSelectedRisk(selectedRisk === "CRITICAL" ? "ALL" : "CRITICAL")}
          className={`p-2.5 rounded-xl border transition text-left flex items-center justify-between ${
            selectedRisk === "CRITICAL"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900"
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block tracking-wider">Critical Priority</span>
            <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Immediate intervention</span>
          </div>
          <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10">
            {criticalCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedRisk(selectedRisk === "HIGH" ? "ALL" : "HIGH")}
          className={`p-2.5 rounded-xl border transition text-left flex items-center justify-between ${
            selectedRisk === "HIGH"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900"
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block tracking-wider">High Risk</span>
            <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Expiring or flagged</span>
          </div>
          <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10">
            {highCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedRisk(selectedRisk === "MEDIUM" ? "ALL" : "MEDIUM")}
          className={`p-2.5 rounded-xl border transition text-left flex items-center justify-between ${
            selectedRisk === "MEDIUM"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-900"
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block tracking-wider">Medium Risk</span>
            <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Routine verification</span>
          </div>
          <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg bg-blue-500/10">
            {mediumCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedRisk(selectedRisk === "LOW" ? "ALL" : "LOW")}
          className={`p-2.5 rounded-xl border transition text-left flex items-center justify-between ${
            selectedRisk === "LOW"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-900"
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider">Low / Compliant</span>
            <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Bank verified & active</span>
          </div>
          <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10">
            {lowCount}
          </span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 font-medium flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            Loading deposits...
          </div>
        ) : instruments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 font-medium">
            No institutional deposits match your query or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-semibold">College / Institution</th>
                  <th className="py-3 px-4 font-semibold">FDR Reference & Bank</th>
                  <th className="py-3 px-4 font-semibold">Amount (₹)</th>
                  <th className="py-3 px-4 font-semibold">Maturity / Expiry</th>
                  <th className="py-3 px-4 font-semibold">Verification Level</th>
                  <th className="py-3 px-4 font-semibold">Priority Level</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {displayedInstruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-[280px]">
                      <div className="truncate font-semibold">{inst.institution_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">AICTE ID: Inst #{inst.institution_id}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-zinc-200">
                      <div className="font-semibold">{inst.fdr_number}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-sans">{inst.bank_name}</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{(inst.amount / 100000).toFixed(2)} Lakhs
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-sans font-normal">{inst.interest_rate}% p.a.</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-700 dark:text-zinc-300">{inst.maturity_date}</div>
                      <div className={`text-[10px] font-semibold ${
                        inst.days_to_maturity < 0 
                          ? "text-rose-600 dark:text-rose-400" 
                          : inst.days_to_maturity <= 30 
                          ? "text-amber-600 dark:text-amber-400" 
                          : "text-slate-500 dark:text-zinc-400"
                      }`}>
                        {inst.days_to_maturity < 0 
                          ? `Lapsed ${Math.abs(inst.days_to_maturity)}d ago` 
                          : `${inst.days_to_maturity} days remaining`}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                        inst.trust_tier === "BANK_CONFIRMED" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30" 
                          : inst.trust_tier === "CROSS_VALIDATED" 
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30" 
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
                      }`}>
                        {inst.trust_tier === "BANK_CONFIRMED" ? "Bank Confirmed" : inst.trust_tier === "CROSS_VALIDATED" ? "Document Matched" : "Unverified"}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                        inst.risk_band === "CRITICAL" 
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30" 
                          : inst.risk_band === "HIGH" 
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30" 
                          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      }`}>
                        {inst.risk_score} • {inst.risk_band}
                      </span>
                      {inst.flags_count > 0 && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{inst.flags_count} issue(s)</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-medium text-[11px] text-slate-600 dark:text-zinc-300">
                        {inst.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/inspector/${inst.id}`}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                          title="Open Scrutiny Desk"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        <a
                          href={`${API_BASE}/instruments/${inst.id}/deficiency-notice`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-sm"
                          title="Download Official AICTE Statutory Deficiency Notice (PDF)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden xl:inline">Notice</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Snappy Pagination Controls */}
        {!loading && instruments.length > pageSize && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-zinc-950/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>
              Showing <span className="font-semibold text-slate-800 dark:text-zinc-200">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{Math.min(page * pageSize, instruments.length)}</span> of{" "}
              <span className="font-bold text-slate-900 dark:text-white">{instruments.length}</span> deposits
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-sm font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-2.5 py-1 font-semibold text-xs text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-sm font-medium"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
