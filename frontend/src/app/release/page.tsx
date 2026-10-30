"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileCheck2, ShieldCheck, CheckCircle2,
  AlertTriangle, QrCode, Lock, UserCheck,
  Sparkles, RefreshCw, Download, FileText, Search, ExternalLink,
  Filter
} from "lucide-react";
import { fetchApi, API_BASE, getCurrentUser, switchUserPersona } from "@/lib/api";

interface ChecklistItem {
  code: string;
  title: string;
  status: "SATISFIED" | "BLOCKED";
  detail: string;
}

interface ReleaseRequestItem {
  id: number;
  instrument_id: number;
  fdr_number: string;
  institution_name: string;
  bank_name?: string;
  amount: number;
  reason: string;
  status: string;
  remarks?: string;
  maker_id?: number;
  checker_id?: number;
  created_at: string;
  certificate_hash?: string;
  certificate_url?: string;
  is_ready?: boolean;
  blockers?: string[];
  checklist?: ChecklistItem[];
}

export default function ReleasePortalPage() {
  const [requests, setRequests] = useState<ReleaseRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReq, setSelectedReq] = useState<ReleaseRequestItem | null>(null);
  const [acting, setActing] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [makerRemarks, setMakerRemarks] = useState<string>("Maker verified physical FDR documents, bank status, and Clause 6.46 preconditions.");
  const [filterTab, setFilterTab] = useState<"all" | "pending_scrutiny" | "awaiting_approval" | "released" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadRequests = async (preferId?: number) => {
    try {
      setLoading(true);
      const data = await fetchApi<ReleaseRequestItem[]>("/release-requests");
      setRequests(data);
      if (data.length > 0) {
        setSelectedReq(prev => {
          if (preferId) {
            const found = data.find(r => r.id === preferId);
            if (found) return found;
          }
          if (prev) {
            const found = data.find(r => r.id === prev.id);
            if (found) return found;
          }
          // Prioritize actionable pending / under_review requests
          const pending = data.find(r => r.status === "submitted" || r.status === "precheck_failed" || r.status === "under_review");
          return pending || data[0];
        });
      } else {
        setSelectedReq(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const syncUser = () => {
    const user = getCurrentUser();
    setCurrentUser(user);
  };

  useEffect(() => {
    syncUser();

    // Check URL query parameters for target request ID (e.g. /release?reqId=12)
    let preferId: number | undefined;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetParam = params.get("reqId") || params.get("id");
      if (targetParam) {
        preferId = parseInt(targetParam, 10);
      }
    }

    loadRequests(preferId);

    const handleAuth = () => syncUser();
    window.addEventListener("authChanged", handleAuth);
    return () => {
      window.removeEventListener("authChanged", handleAuth);
    };
  }, []);

  const handleSwitchPersona = async (role: "maker" | "checker") => {
    try {
      const user = await switchUserPersona(role);
      setCurrentUser(user);
      setActionMessage({
        success: true,
        text: `Switched active persona to ${role === "maker" ? "Scrutiny Officer (Maker)" : "Senior Director (Checker)"}. You can now test role-specific actions.`
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSeedSampleRequest = async () => {
    setSeeding(true);
    setActionMessage(null);
    try {
      const res = await fetchApi<any>("/release-requests/seed-sample", {
        method: "POST"
      });

      setActionMessage({
        success: true,
        text: `Sample release request #${res.release_request_id} created for compliant FDR #${res.fdr_number}. Ready for Step 1 (Maker Scrutiny) and Step 2 (Senior Director Approval) below!`
      });
      await loadRequests(res.release_request_id);
    } catch (e: any) {
      setActionMessage({
        success: false,
        text: e.message || "Failed to seed sample release request."
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleMakerScrutiny = async (decision: "approved" | "rejected") => {
    if (!selectedReq) return;
    setActing(true);
    setActionMessage(null);
    try {
      // Authenticate with Scrutiny Officer (Maker) credentials
      const loginRes = await fetchApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "maker@aicte.gov.in", password: "Password@123" })
      });
      const customHeaders = { Authorization: `Bearer ${loginRes.access_token}` };

      const res = await fetchApi<any>(`/release-requests/${selectedReq.id}/maker-scrutiny`, {
        method: "PATCH",
        headers: customHeaders,
        body: JSON.stringify({
          decision,
          remarks: makerRemarks || (decision === "approved" ? "Maker verified statutory compliance under APH Clause 6.46." : "Maker rejected request due to compliance observations.")
        })
      });

      if (decision === "approved") {
        setActionMessage({
          success: true,
          text: `Scrutiny review verified by Scrutiny Officer (Maker #2). Request moved to 'under_review'. Now unlocked for Senior Director (Checker #3) sign-off.`
        });
      } else {
        setActionMessage({
          success: true,
          text: `Release request #${selectedReq.id} rejected by Scrutiny Officer. Deposit reverted to active status on register.`
        });
      }
      await loadRequests(selectedReq.id);
    } catch (e: any) {
      setActionMessage({ success: false, text: e.message || "Maker scrutiny review failed." });
    } finally {
      setActing(false);
    }
  };

  const handleCheckerApproval = async (decision: "approved" | "rejected", simulateViolation: boolean = false) => {
    if (!selectedReq) return;
    setActing(true);
    setActionMessage(null);
    try {
      let customHeaders: Record<string, string> = {};
      if (simulateViolation) {
        // Specifically authenticate as Maker to demonstrate 403 dual-control separation enforcement
        const loginRes = await fetchApi<any>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "maker@aicte.gov.in", password: "Password@123" })
        });
        customHeaders = { Authorization: `Bearer ${loginRes.access_token}` };
      } else {
        // Authenticate as Senior Bureau Director (Checker #3) to legitimately authorize release
        const loginRes = await fetchApi<any>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "checker@aicte.gov.in", password: "Password@123" })
        });
        customHeaders = { Authorization: `Bearer ${loginRes.access_token}` };
      }

      const res = await fetchApi<any>(`/release-requests/${selectedReq.id}/checker-approval`, {
        method: "PATCH",
        headers: customHeaders,
        body: JSON.stringify({
          decision,
          remarks: decision === "approved" ? "Bureau Director authorized release and lien discharge." : "Bureau Director rejected release request."
        })
      });

      if (decision === "approved") {
        setActionMessage({
          success: true,
          text: `Senior Approver authorization granted by Director! Deposit successfully released under Dual Control. Digital Release Certificate issued (Audit Hash: ${res.certificate_hash?.slice(0, 16)}...).`
        });
      } else {
        setActionMessage({
          success: true,
          text: `Release request #${selectedReq.id} rejected by Senior Director. Deposit restored to active status.`
        });
      }
      await loadRequests(selectedReq.id);
    } catch (e: any) {
      setActionMessage({
        success: false,
        text: e.message || "Approval request rejected by dual-control policy."
      });
    } finally {
      setActing(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    if (filterTab === "pending_scrutiny" && r.status !== "submitted" && r.status !== "precheck_failed") return false;
    if (filterTab === "awaiting_approval" && r.status !== "under_review") return false;
    if (filterTab === "released" && r.status !== "released") return false;
    if (filterTab === "rejected" && r.status !== "rejected") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.fdr_number.toLowerCase().includes(q) || r.institution_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Deposit Release & Refund Approvals (Dual-Officer Sign-Off)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Two-tier regulatory governance ensuring deposits can only be refunded after Scrutiny Officer verification and Senior Director sign-off (AICTE APH Section 2.14).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedSampleRequest}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-semibold transition shadow-sm"
          >
            {seeding ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            )}
            <span>Create Sample Release Request (Demo)</span>
          </button>
        </div>
      </div>

      {actionMessage && (() => {
        const isClause646 = actionMessage.text.includes("Clause 6.46") || actionMessage.text.includes("Pre-check Failed");
        const isMakerChecker = actionMessage.text.includes("Maker-Checker") || actionMessage.text.includes("403") || actionMessage.text.includes("Separation") || actionMessage.text.includes("cannot authorize");

        return (
          <div className={`p-4 rounded-xl text-xs border ${
            actionMessage.success 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" 
              : "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/50 dark:text-rose-300 shadow-md animate-in fade-in"
          }`}>
            <div className="font-semibold flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-1.5">
                {actionMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>
                  {actionMessage.success 
                    ? "Regulatory Action Completed" 
                    : isClause646
                    ? "Clause 6.46 Statutory Pre-Check Gate Triggered"
                    : isMakerChecker
                    ? "Dual-Control Safety Gate Triggered (Separation of Duties Enforced)"
                    : "Regulatory Gate Blocked"}
                </span>
              </div>
              {!actionMessage.success && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-mono">
                  {isClause646 ? "APH CLAUSE 6.46 ENFORCED" : isMakerChecker ? "RBAC ENFORCED: 403 FORBIDDEN" : "STATUTORY GATE ENFORCED"}
                </span>
              )}
            </div>
            <div className="mt-1.5 font-mono text-xs">{actionMessage.text}</div>
            {!actionMessage.success && (
              <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isClause646 ? (
                    <><strong>APH Clause 6.46 Statutory Rule:</strong> Security deposits can only be released after maturity tenure is met, bank cryptographic verification is complete, and original FDR receipts are verified on record.</>
                  ) : (
                    <><strong>Separation of Duties Guarantee:</strong> Under AICTE financial regulations, an officer who performed initial scrutiny cannot authorize final refund or release. The senior approval step must be executed by Senior Bureau Director (Checker).</>
                  )}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Main Grid: Release Requests Queue + Decision Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 5 Cols: Requests List */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-purple-600" />
              <span>Release Register ({requests.length})</span>
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
              AICTE Bureau Ledger
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by FDR # or college name..."
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1 pb-1 border-b border-slate-100 dark:border-zinc-800 text-[11px]">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-2 py-1 rounded-md font-medium transition ${
                filterTab === "all"
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              All ({requests.length})
            </button>
            <button
              onClick={() => setFilterTab("pending_scrutiny")}
              className={`px-2 py-1 rounded-md font-medium transition ${
                filterTab === "pending_scrutiny"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Step 1 Scrutiny ({requests.filter(r => r.status === "submitted" || r.status === "precheck_failed").length})
            </button>
            <button
              onClick={() => setFilterTab("awaiting_approval")}
              className={`px-2 py-1 rounded-md font-medium transition ${
                filterTab === "awaiting_approval"
                  ? "bg-purple-600 text-white font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Step 2 Sign-Off ({requests.filter(r => r.status === "under_review").length})
            </button>
            <button
              onClick={() => setFilterTab("released")}
              className={`px-2 py-1 rounded-md font-medium transition ${
                filterTab === "released"
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              Released ({requests.filter(r => r.status === "released").length})
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading release requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-center text-xs space-y-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center mx-auto">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-zinc-200">No Matching Release Requests</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-1 max-w-xs mx-auto">
                  {requests.length === 0 
                    ? "Institutions request deposit release after statutory tenure completion. Create a sample request below to demonstrate." 
                    : "No requests match the selected filter or search term."}
                </p>
              </div>
              {requests.length === 0 && (
                <button
                  onClick={handleSeedSampleRequest}
                  disabled={seeding}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Sample Release Request (Demo)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedReq?.id === req.id 
                      ? "bg-amber-500/10 border-amber-500/40 text-slate-900 dark:bg-zinc-800 dark:border-amber-500/60 dark:text-white shadow-sm" 
                      : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{req.fdr_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.status === "released" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400" :
                      req.status === "under_review" ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400" :
                      req.status === "submitted" ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400" :
                      req.status === "precheck_failed" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300" :
                      req.status === "rejected" ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400" :
                      "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {req.status === "submitted" ? "STEP 1: AWAITING SCRUTINY" :
                       req.status === "precheck_failed" ? "STEP 1: PRE-CHECK FLAGGED" :
                       req.status === "under_review" ? "STEP 2: AWAITING SIGN-OFF" :
                       req.status === "released" ? "RELEASED & CERTIFIED" :
                       req.status === "rejected" ? "REJECTED" :
                       req.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 dark:text-white truncate">{req.institution_name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center justify-between">
                    <span>Corpus: ₹{(req.amount / 100000).toFixed(2)} Lakhs</span>
                    <span className="font-mono text-[10px] text-slate-400">{req.bank_name || "SBI"}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 font-mono flex items-center justify-between">
                    <span>Submitted: {req.created_at}</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Req #{req.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 7 Cols: Maker-Checker Decision Cockpit */}
        <div className="lg:col-span-7 space-y-4">
          {selectedReq ? (
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
              
              {/* Persona Context Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-zinc-400 font-semibold">Active Session:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono bg-slate-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {currentUser?.name || "Scrutiny Officer"}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {currentUser?.role || "scrutiny_officer"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSwitchPersona("maker")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                      currentUser?.role === "scrutiny_officer" || !currentUser
                        ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100"
                    }`}
                  >
                    Act as Maker
                  </button>
                  <button
                    onClick={() => handleSwitchPersona("checker")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                      currentUser?.role === "senior_officer"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100"
                    }`}
                  >
                    Act as Checker
                  </button>
                </div>
              </div>

              {/* Request Header */}
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-semibold">RELEASE REQUEST #{selectedReq.id}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      selectedReq.status === "released" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400" :
                      selectedReq.status === "under_review" ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400" :
                      selectedReq.status === "submitted" ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400" :
                      selectedReq.status === "precheck_failed" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400" :
                      "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400"
                    }`}>
                      {selectedReq.status.toUpperCase()}
                    </span>
                    <Link
                      href={`/inspector/${selectedReq.instrument_id}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      title="Inspect FDR Details"
                    >
                      <span>Inspector</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">{selectedReq.fdr_number}</h2>
                <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">{selectedReq.institution_name}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-mono font-bold">
                  Pledged Security Corpus: ₹{selectedReq.amount.toLocaleString("en-IN")}/- ({selectedReq.bank_name || "State Bank of India"})
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">Justification: </span>
                  {selectedReq.reason}
                </div>
              </div>

              {/* 3-Step Visual Workflow Stepper */}
              <div className="bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
                  AICTE Dual Maker-Checker Release Lifecycle
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                    selectedReq.status !== "rejected"
                      ? selectedReq.status === "precheck_failed"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                      : "bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500"
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      selectedReq.status === "precheck_failed" ? "bg-amber-500 text-slate-950" : "bg-emerald-500 text-white"
                    }`}>1</span>
                    <span className="truncate">{selectedReq.status === "precheck_failed" ? "Pre-Check Flagged" : "Pre-Check Cleared"}</span>
                  </div>

                  <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                    selectedReq.maker_id || selectedReq.status === "under_review" || selectedReq.status === "released"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                      : selectedReq.status === "submitted" || selectedReq.status === "precheck_failed"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold animate-pulse"
                      : selectedReq.status === "rejected"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 font-semibold"
                      : "bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500"
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      selectedReq.maker_id || selectedReq.status === "under_review" || selectedReq.status === "released" 
                        ? "bg-emerald-500 text-white" 
                        : selectedReq.status === "rejected"
                        ? "bg-rose-500 text-white"
                        : "bg-amber-500 text-slate-950"
                    }`}>2</span>
                    <span className="truncate">Maker Scrutiny</span>
                  </div>

                  <div className={`p-2 rounded-lg border flex items-center gap-2 ${
                    selectedReq.status === "released"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                      : selectedReq.status === "under_review"
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400 font-semibold animate-pulse"
                      : "bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500"
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      selectedReq.status === "released" ? "bg-emerald-500 text-white" : "bg-purple-500 text-white"
                    }`}>3</span>
                    <span className="truncate">Director Sign-Off</span>
                  </div>
                </div>
              </div>

              {/* Pre-Checks Dynamic Checklist */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase tracking-wider">
                    AICTE Clause 6.46 Statutory Pre-Conditions
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    selectedReq.is_ready !== false
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
                  }`}>
                    {selectedReq.is_ready !== false ? "ALL CHECKS SATISFIED" : `${selectedReq.blockers?.length || 1} BLOCKER(S)`}
                  </span>
                </div>

                <div className="space-y-2 text-xs pt-1">
                  {selectedReq.checklist && selectedReq.checklist.length > 0 ? (
                    selectedReq.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        {item.status === "SATISFIED" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className={`font-semibold ${item.status === "SATISFIED" ? "text-slate-900 dark:text-white" : "text-amber-800 dark:text-amber-300"}`}>
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Tenure Requirement: Minimum statutory term completed without interruption.</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Regulatory Complaints: 0 pending student or faculty financial grievances.</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Bank Discharge Clearance: Issuing branch has certified zero existing encumbrances.</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Step 1: Scrutiny Officer (Maker) */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-500" />
                    Step 1: Scrutiny Officer (Maker Verification)
                  </span>
                  {selectedReq.maker_id && (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                      VERIFIED BY OFFICER #{selectedReq.maker_id}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Reviews physical deposit papers, validates bank clearance letter, and certifies that no program approval conditions are violated.
                </p>

                {/* Case 1: Pending Scrutiny (submitted OR precheck_failed) */}
                {(selectedReq.status === "submitted" || selectedReq.status === "precheck_failed") && (
                  <div className="space-y-3 pt-2">
                    {selectedReq.status === "precheck_failed" && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>APH Clause 6.46 Pre-Check Flagged Blockers</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300">
                          This deposit has unfulfilled statutory prerequisites. The Scrutiny Officer can review offline justifications, examine nodal bank confirmation, or reject the submission.
                        </p>
                        {selectedReq.blockers && selectedReq.blockers.length > 0 && (
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-700 dark:text-rose-400 font-mono">
                            {selectedReq.blockers.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                        Scrutiny Officer Findings &amp; Regulatory Notes:
                      </label>
                      <input
                        type="text"
                        value={makerRemarks}
                        onChange={(e) => setMakerRemarks(e.target.value)}
                        placeholder="Enter Maker verification remarks..."
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm font-mono"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleMakerScrutiny("approved")}
                        disabled={acting}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        {acting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                        <span>Approve Scrutiny (Forward to Senior Director)</span>
                      </button>
                      <button
                        onClick={() => handleMakerScrutiny("rejected")}
                        disabled={acting}
                        className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition"
                      >
                        Reject Request
                      </button>
                    </div>
                  </div>
                )}

                {/* Case 2: Rejected during Scrutiny */}
                {selectedReq.status === "rejected" && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1 text-xs text-rose-900 dark:text-rose-200">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Release Request Rejected</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                      This release request was evaluated and rejected. The security deposit has been preserved as active on the bureau register.
                    </p>
                    {selectedReq.remarks && (
                      <div className="text-[11px] font-mono text-rose-800 dark:text-rose-300 bg-white dark:bg-zinc-900 p-2 rounded border border-rose-200 dark:border-zinc-800">
                        Officer Remarks: {selectedReq.remarks}
                      </div>
                    )}
                  </div>
                )}

                {/* Case 3: Scrutiny Passed and Locked */}
                {(selectedReq.status === "under_review" || selectedReq.status === "released") && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Scrutiny check verified and locked. Ready for Senior Director sign-off.</span>
                    </div>
                    {selectedReq.remarks && (
                      <div className="text-[11px] font-mono text-emerald-900 dark:text-emerald-300">
                        Maker Remarks: &ldquo;{selectedReq.remarks}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Senior Director (Checker) */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Step 2: Senior Bureau Director (Checker Authorization)
                  </span>
                  {selectedReq.checker_id && (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">
                      AUTHORIZED BY DIRECTOR #{selectedReq.checker_id}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Final statutory authorization. Enforces dual-control separation so no single officer can release government-pledged funds alone.
                </p>

                {/* Locked state if Step 1 not complete */}
                {(selectedReq.status === "submitted" || selectedReq.status === "precheck_failed") && (
                  <div className="p-3 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Locked: Senior Director authorization unlocks after Scrutiny Officer (Maker) verifies Step 1.</span>
                  </div>
                )}

                {/* Active review state (under_review) */}
                {selectedReq.status === "under_review" && (
                  <div className="space-y-3 pt-2">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-300">
                      <span className="font-bold">Ready for Senior Director Sign-Off:</span> Maker scrutiny has been verified. Authorization under Dual Control will discharge the lien and generate the tamper-evident PDF release certificate.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCheckerApproval("approved", false)}
                        disabled={acting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        {acting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Authorize Release &amp; Issue Official Certificate</span>
                      </button>
                      <button
                        onClick={() => handleCheckerApproval("rejected", false)}
                        disabled={acting}
                        className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-semibold transition"
                      >
                        Reject Request
                      </button>
                    </div>

                    <button
                      onClick={() => handleCheckerApproval("approved", true)}
                      disabled={acting}
                      className="text-[11px] text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition underline block"
                    >
                      [Security Demo: Attempt self-approval using Maker credentials &rarr; 403 Forbidden]
                    </button>
                  </div>
                )}

                {/* Finalized released state */}
                {selectedReq.status === "released" && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/40 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>OFFICIAL AICTE RELEASE CERTIFICATE ISSUED</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 break-all bg-white dark:bg-zinc-950 p-2 rounded border border-emerald-200 dark:border-zinc-800">
                      Audit Hash: {selectedReq.certificate_hash}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-200">
                        <QrCode className="w-10 h-10 text-slate-900" />
                      </div>
                      <div className="text-xs text-slate-600 dark:text-zinc-400">
                        Cryptographically signed release token generated. Bank security deposit successfully discharged under dual-officer sign-off.
                      </div>
                    </div>
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Statutory A4 Document Available
                      </span>
                      <a
                        href={`${API_BASE}/release-requests/${selectedReq.id}/certificate`}
                        target="_blank"
                        rel="noreferrer"
                        download={`AICTE_Release_Certificate_${selectedReq.fdr_number}.pdf`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Official AICTE Release Certificate (PDF)</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-xs text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-zinc-800">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AICTE Dual-Officer Sign-Off Workflow Guide
                </h3>
              </div>

              <p className="leading-relaxed">
                Under the AICTE Approval Process Handbook (APH Section 2.14), no security deposit or institutional fixed deposit can be refunded or discharged under a single authority. All releases must follow the strict two-tier Maker-Checker governance protocol:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1">
                  <div className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    Tier 1: Scrutiny Officer (Maker)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                    Verifies that the mandatory statutory term has elapsed, confirms zero open student or faculty financial disputes, and verifies no-encumbrance status.
                  </p>
                </div>

                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-1">
                  <div className="font-bold text-purple-800 dark:text-purple-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Tier 2: Senior Director (Checker)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                    Validates maker scrutiny findings, performs dual-officer authorization, signs the SHA-256 release audit block, and issues the official lien discharge certificate.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
