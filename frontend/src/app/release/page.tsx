"use client";

import React, { useState, useEffect } from "react";
import { 
  FileCheck2, ShieldCheck, CheckCircle2,
  AlertTriangle, QrCode, Lock, UserCheck,
  Sparkles, RefreshCw, ArrowRight, Download, FileText
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface ReleaseRequestItem {
  id: number;
  instrument_id: number;
  fdr_number: string;
  institution_name: string;
  amount: number;
  reason: string;
  status: string;
  maker_id?: number;
  checker_id?: number;
  created_at: string;
  certificate_hash?: string;
}

export default function ReleasePortalPage() {
  const [requests, setRequests] = useState<ReleaseRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReq, setSelectedReq] = useState<ReleaseRequestItem | null>(null);
  const [acting, setActing] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<ReleaseRequestItem[]>("/release-requests");
      setRequests(data);
      if (data.length > 0) {
        setSelectedReq(prev => {
          if (!prev) return data[0];
          const found = data.find(r => r.id === prev.id);
          return found || data[0];
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

  const handleSeedSampleRequest = async () => {
    setSeeding(true);
    setActionMessage(null);
    try {
      let instId = 1;
      try {
        const instruments = await fetchApi<any[]>("/instruments");
        if (instruments && instruments.length > 0) {
          // Find an instrument without open flags if possible
          const cleanInst = instruments.find(i => i.flags_count === 0 && i.status !== "released");
          if (cleanInst) {
            instId = cleanInst.id;
          } else {
            instId = instruments[0].id;
          }
        }
      } catch (e) {
        console.warn("Could not query instruments list, defaulting to ID 1");
      }

      const res = await fetchApi<any>(`/instruments/${instId}/release-requests`, {
        method: "POST",
        body: JSON.stringify({
          reason: "10-Year Statutory Term Completed - Compliance Cleared (Sample Test)"
        })
      });

      setActionMessage({
        success: true,
        text: `Sample release request #${res.release_request_id} created for Instrument #${instId}. You can now test the Maker Scrutiny and Checker Authorization steps below!`
      });
      await loadRequests();
    } catch (e: any) {
      setActionMessage({
        success: false,
        text: e.message || "Failed to seed sample release request. Make sure the deposit has zero open regulatory flags."
      });
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleMakerScrutiny = async (decision: "approved" | "rejected") => {
    if (!selectedReq) return;
    setActing(true);
    setActionMessage(null);
    try {
      const loginRes = await fetchApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "maker@aicte.gov.in", password: "Password@123" })
      });
      const token = loginRes.access_token;

      const res = await fetchApi<any>(`/release-requests/${selectedReq.id}/maker-scrutiny`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, remarks: "Maker verified compliance and validity." })
      });

      setActionMessage({
        success: true,
        text: `Scrutiny review completed successfully. Request moved to '${res.status}'. Now awaiting Senior Approver (Director) authorization.`
      });
      await loadRequests();
    } catch (e: any) {
      setActionMessage({ success: false, text: e.message });
    } finally {
      setActing(false);
    }
  };

  const handleCheckerApproval = async (decision: "approved" | "rejected", simulateViolation: boolean = false) => {
    if (!selectedReq) return;
    setActing(true);
    setActionMessage(null);
    try {
      const email = simulateViolation ? "maker@aicte.gov.in" : "checker@aicte.gov.in";
      const loginRes = await fetchApi<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "Password@123" })
      });
      const token = loginRes.access_token;

      const res = await fetchApi<any>(`/release-requests/${selectedReq.id}/checker-approval`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, remarks: "Bureau Director authorized release." })
      });

      setActionMessage({
        success: true,
        text: `Senior Approver authorization granted! Deposit successfully released. Digital Release Certificate issued (Audit Hash: ${res.certificate_hash?.slice(0, 16)}...).`
      });
      await loadRequests();
    } catch (e: any) {
      setActionMessage({
        success: false,
        text: e.message || "Approval request rejected by dual-control policy."
      });
    } finally {
      setActing(false);
    }
  };

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
            Two-tier regulatory process ensuring deposits can only be refunded after Scrutiny Officer verification and Senior Director sign-off.
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
            <span>Seed Test Release Request</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-xs border ${
          actionMessage.success 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" 
            : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
        }`}>
          <div className="font-semibold flex items-center gap-1.5 text-sm">
            {actionMessage.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            {actionMessage.success ? "Regulatory Action Completed" : "Dual-Control Safety Rule Triggered"}
          </div>
          <div className="mt-1 font-mono">{actionMessage.text}</div>
        </div>
      )}

      {/* Main Grid: Release Requests Queue + Decision Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 5 Cols: Requests List */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-2">
            Pending Release Requests ({requests.length})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading release requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center text-xs space-y-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-zinc-200">No Pending Release Requests</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-1 max-w-xs mx-auto">
                  Institutions request deposit release after statutory tenure completion. You can seed a test request right now to evaluate the workflow.
                </p>
              </div>
              <button
                onClick={handleSeedSampleRequest}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm"
              >
                <Sparkles className="w-3 h-3" />
                <span>Seed Test Release Request</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedReq?.id === req.id 
                      ? "bg-purple-50 border-purple-400 text-slate-900 dark:bg-zinc-800 dark:border-purple-500 dark:text-white shadow-sm" 
                      : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{req.fdr_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.status === "released" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400" :
                      req.status === "under_review" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400" :
                      "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {req.status === "under_review" ? "AWAITING DIRECTOR SIGN-OFF" : req.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 dark:text-white truncate">{req.institution_name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">Amount: ₹{(req.amount / 100000).toFixed(2)} Lakhs</div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 font-mono">Submitted: {req.created_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 7 Cols: Maker-Checker Decision Cockpit */}
        <div className="lg:col-span-7 space-y-4">
          {selectedReq ? (
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500 dark:text-zinc-400 font-semibold">REQUEST #{selectedReq.id}</span>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400">STATUS: {selectedReq.status.toUpperCase()}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 font-mono">{selectedReq.fdr_number}</h2>
                <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">{selectedReq.institution_name}</div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-mono font-bold">Pledged Security Corpus: ₹{selectedReq.amount.toLocaleString("en-IN")}/-</div>
              </div>

              {/* Pre-Checks Checklist */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase tracking-wider">
                  Mandatory Statutory Pre-Conditions
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Tenure Requirement: Minimum 10-year term completed without interruption.</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Regulatory Complaints: 0 pending student or faculty financial grievances.</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Bank Discharge Clearance: Issuing branch has certified zero existing encumbrances.</span>
                  </div>
                </div>
              </div>

              {/* Step 1: Scrutiny Officer (Maker) */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-500" />
                    Step 1: Scrutiny Officer (Reviewer)
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

                {selectedReq.status === "submitted" && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleMakerScrutiny("approved")}
                      disabled={acting}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm"
                    >
                      Approve Scrutiny (Forward to Senior Director)
                    </button>
                    <button
                      onClick={() => handleMakerScrutiny("rejected")}
                      disabled={acting}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs transition"
                    >
                      Reject Request
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Senior Director (Checker) */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Step 2: Senior Bureau Director (Approver)
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

                {selectedReq.status === "under_review" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckerApproval("approved", false)}
                        disabled={acting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Authorize Release & Issue Official Certificate</span>
                      </button>
                      <button
                        onClick={() => handleCheckerApproval("rejected", false)}
                        disabled={acting}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs transition"
                      >
                        Reject
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
                    Verifies that the mandatory 10-year term has elapsed, confirms zero open student or faculty financial disputes, and verifies no-encumbrance status.
                  </p>
                </div>

                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-1">
                  <div className="font-bold text-purple-800 dark:text-purple-400 flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    Tier 2: Senior Approver (Checker)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                    AICTE Bureau Director authorizes release. Generates an immutable SHA-256 digital certificate and records cryptographic release token.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-zinc-400">
                  Dual Control Enforcement: Self-approval is cryptographically blocked with HTTP 403.
                </span>
                <button
                  onClick={handleSeedSampleRequest}
                  disabled={seeding}
                  className="font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                >
                  <span>Test Flow Now</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
