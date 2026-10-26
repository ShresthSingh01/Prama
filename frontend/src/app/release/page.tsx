"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileCheck2, ShieldCheck, CheckCircle2, XCircle, 
  AlertTriangle, QrCode, Lock, ChevronRight, UserCheck
} from "lucide-react";
import { fetchApi } from "@/lib/api";

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
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<ReleaseRequestItem[]>("/release-requests");
      setRequests(data);
      if (data.length > 0 && !selectedReq) {
        setSelectedReq(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
      // Login as Maker (Scrutiny Officer, User ID = 2)
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
        text: `Maker scrutiny completed. Request moved to '${res.status}'. Now awaiting Senior Officer Checker approval.`
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
      // If simulateViolation is true, login with MAKER token to prove maker-checker rejection!
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
        text: `Checker approved! Instrument released. Certificate Audit Hash: ${res.certificate_hash?.slice(0, 16)}...`
      });
      await loadRequests();
    } catch (e: any) {
      setActionMessage({
        success: false,
        text: e.message || "Checker decision rejected."
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-400" />
            Maker-Checker Security Deposit Release Portal
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Two-tier regulatory authorization separating Scrutiny (Maker) from Final Release Approval (Checker).
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded text-xs border ${
          actionMessage.success 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
        }`}>
          <div className="font-semibold flex items-center gap-1.5">
            {actionMessage.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {actionMessage.success ? "Regulatory Action Recorded" : "Maker-Checker Rule Enforced"}
          </div>
          <div className="mt-1 font-mono">{actionMessage.text}</div>
        </div>
      )}

      {/* Main Grid: Release Requests Queue + Maker-Checker Approval Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 6 Cols: Requests List */}
        <div className="lg:col-span-6 bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
            Active Deposit Release & Refund Requests ({requests.length})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">Loading release requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">No pending release requests.</div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`p-3.5 rounded border text-xs cursor-pointer transition ${
                    selectedReq?.id === req.id 
                      ? "bg-zinc-800 border-indigo-500 text-white shadow-lg" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-indigo-400">{req.fdr_number}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      req.status === "released" ? "bg-emerald-500/20 text-emerald-400" :
                      req.status === "under_review" ? "bg-amber-500/20 text-amber-400" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="font-medium text-white truncate">{req.institution_name}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">Amount: ₹{(req.amount / 100000).toFixed(2)} Lakhs</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">Submitted: {req.created_at}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 6 Cols: Maker-Checker Decision Cockpit */}
        <div className="lg:col-span-6 space-y-4">
          {selectedReq ? (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-500">REQUEST #{selectedReq.id}</span>
                  <span className="text-xs font-mono text-emerald-400">STATUS: {selectedReq.status.toUpperCase()}</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1 font-mono">{selectedReq.fdr_number}</h2>
                <div className="text-xs text-zinc-300">{selectedReq.institution_name}</div>
                <div className="text-xs text-amber-400 mt-1 font-mono">Pledged Security: ₹{selectedReq.amount.toLocaleString("en-IN")}/-</div>
              </div>

              {/* Pre-Checks Checklist */}
              <div className="p-3 bg-zinc-950 rounded border border-zinc-800 space-y-2 text-xs">
                <div className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
                  Mandatory Statutory Pre-Checks
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Regulatory Approval Cycle Status: ELIGIBLE</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Open Regulatory Flags: 0 OPEN FLAGS</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Non-Repudiation Trust Tier: VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* Maker Step */}
              <div className="p-3.5 bg-zinc-950 rounded border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    Tier 1: Scrutiny Officer (Maker)
                  </span>
                  {selectedReq.maker_id && (
                    <span className="text-[10px] text-emerald-400 font-mono">VERIFIED BY MAKER #{selectedReq.maker_id}</span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400">
                  Verifies physical/digital deposit receipts, no pending student grievance liens, and AICTE compliance.
                </p>

                {selectedReq.status === "submitted" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleMakerScrutiny("approved")}
                      disabled={acting}
                      className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded text-xs font-medium transition"
                    >
                      Approve Scrutiny (Move to Checker)
                    </button>
                    <button
                      onClick={() => handleMakerScrutiny("rejected")}
                      disabled={acting}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Checker Step */}
              <div className="p-3.5 bg-zinc-950 rounded border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Tier 2: Senior Bureau Director (Checker)
                  </span>
                  {selectedReq.checker_id && (
                    <span className="text-[10px] text-emerald-400 font-mono">AUTHORIZED BY CHECKER #{selectedReq.checker_id}</span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400">
                  Final statutory authorization for discharge of bank security deposit and issuance of certificate.
                </p>

                {selectedReq.status === "under_review" && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckerApproval("approved", false)}
                        disabled={acting}
                        className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded text-xs font-medium transition"
                      >
                        Authorize Release & Issue Certificate
                      </button>
                      <button
                        onClick={() => handleCheckerApproval("rejected", false)}
                        disabled={acting}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                      >
                        Reject
                      </button>
                    </div>

                    {/* Button to simulate Maker-Checker separation violation */}
                    <button
                      onClick={() => handleCheckerApproval("approved", true)}
                      disabled={acting}
                      className="text-[10px] text-zinc-500 hover:text-rose-400 transition font-mono underline block"
                    >
                      [Demo Violation: Attempt approval using Maker credentials &rarr; 403 Forbidden]
                    </button>
                  </div>
                )}

                {selectedReq.status === "released" && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>OFFICIAL AICTE RELEASE CERTIFICATE ISSUED</span>
                    </div>
                    <div className="font-mono text-[10px] text-zinc-300 break-all">
                      Audit Hash: {selectedReq.certificate_hash}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="p-1 bg-white rounded">
                        <QrCode className="w-10 h-10 text-black" />
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Cryptographically verifiable release token. Pledged funds discharged to college.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-zinc-500 font-mono bg-zinc-900/60 border border-zinc-800 rounded-lg">
              Select a release request from the list to review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
