"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ListFilter, Search, ShieldAlert, AlertTriangle, 
  CheckCircle2, Clock, ChevronRight, ChevronLeft, ArrowUpDown
} from "lucide-react";
import { fetchApi } from "@/lib/api";

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
}

export default function QueuePage() {
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const loadInstruments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedTier !== "ALL") params.append("trust_tier", selectedTier);
      if (selectedRisk !== "ALL") params.append("risk_band", selectedRisk);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);

      const data = await fetchApi<InstrumentRow[]>(`/instruments?${params.toString()}`);
      setInstruments(data);
      setPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstruments();
  }, [selectedTier, selectedRisk, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInstruments();
  };

  const totalPages = Math.ceil(instruments.length / pageSize) || 1;
  const displayedInstruments = instruments.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-amber-400" />
            Regulatory Priority Triage Stream ("Act Today")
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time ranked queue of all 600+ instruments. Filtered by non-repudiation trust levels and risk factors.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          <span>Found {instruments.length} Instruments</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900/70 border border-zinc-800 p-3.5 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by Institution Name or FDR Serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition font-medium">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Trust Tier Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
            <span className="text-zinc-500">Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Tiers</option>
              <option value="BANK_CONFIRMED">Bank Confirmed</option>
              <option value="CROSS_VALIDATED">Cross-Validated</option>
              <option value="SELF_DECLARED">Self-Declared</option>
            </select>
          </div>

          {/* Risk Band Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
            <span className="text-zinc-500">Risk:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Bands</option>
              <option value="CRITICAL">Critical (75+)</option>
              <option value="HIGH">High (50-74)</option>
              <option value="MEDIUM">Medium (25-49)</option>
              <option value="LOW">Low (0-24)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
            <span className="text-zinc-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING">Expiring (&lt;90d)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="FLAGGED">Flagged</option>
              <option value="RELEASE_REQUESTED">Release Requested</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-mono flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            Loading regulatory instruments...
          </div>
        ) : instruments.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            No instruments match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4">Institution Name</th>
                  <th className="py-2.5 px-4">FDR Serial & Bank</th>
                  <th className="py-2.5 px-4">Amount (₹)</th>
                  <th className="py-2.5 px-4">Maturity Timeline</th>
                  <th className="py-2.5 px-4">Trust Tier</th>
                  <th className="py-2.5 px-4">Risk Priority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {displayedInstruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-zinc-800/40 transition">
                    <td className="py-3 px-4 font-medium text-white max-w-[280px]">
                      <div className="truncate">{inst.institution_name}</div>
                      <div className="text-[10px] text-zinc-500 font-normal">AICTE ID: Inst #{inst.institution_id}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-zinc-200">
                      <div>{inst.fdr_number}</div>
                      <div className="text-[10px] text-zinc-400 font-sans">{inst.bank_name}</div>
                    </td>

                    <td className="py-3 px-4 font-mono font-medium text-white">
                      ₹{(inst.amount / 100000).toFixed(2)} Lakhs
                      <div className="text-[10px] text-zinc-500">{inst.interest_rate}% p.a.</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-zinc-300">{inst.maturity_date}</div>
                      <div className={`text-[10px] font-mono ${
                        inst.days_to_maturity < 0 ? "text-rose-400 font-bold" :
                        inst.days_to_maturity <= 30 ? "text-amber-400 font-medium" : "text-zinc-500"
                      }`}>
                        {inst.days_to_maturity < 0 
                          ? `Lapsed ${Math.abs(inst.days_to_maturity)}d ago` 
                          : `${inst.days_to_maturity} days remaining`}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        inst.trust_tier === "BANK_CONFIRMED" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        inst.trust_tier === "CROSS_VALIDATED" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                        "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {inst.trust_tier}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        inst.risk_band === "CRITICAL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" :
                        inst.risk_band === "HIGH" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                        "bg-zinc-800 text-zinc-400"
                      }`}>
                        {inst.risk_score} • {inst.risk_band}
                      </span>
                      {inst.flags_count > 0 && (
                        <div className="text-[10px] text-rose-400 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{inst.flags_count} flag(s)</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] text-zinc-300">
                        {inst.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/inspector/${inst.id}`}
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
        )}

        {/* Snappy Pagination Controls */}
        {!loading && instruments.length > pageSize && (
          <div className="px-4 py-3 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono text-[11px]">
              Showing <span className="text-zinc-200">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="text-zinc-200">{Math.min(page * pageSize, instruments.length)}</span> of{" "}
              <span className="text-zinc-200 font-bold">{instruments.length}</span> instruments
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-2 py-0.5 font-mono text-[11px] text-zinc-300 bg-zinc-900 rounded border border-zinc-800">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
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
