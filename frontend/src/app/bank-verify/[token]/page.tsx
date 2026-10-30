"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  Building2, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, 
  Landmark, Lock
} from "lucide-react";
import { API_BASE } from "@/lib/api";

interface BankVerifyData {
  institution_name: string;
  institution_aicte_id: string;
  institution_state: string;
  institution_district: string;
  fdr_number: string;
  bank_name: string;
  bank_ifsc: string;
  amount: number;
  amount_lakhs: number;
  issue_date: string;
  maturity_date: string;
  tenure_days: number;
  status: string;
  responded_at?: string | null;
  responder_email?: string | null;
  expires_at?: string | null;
}

export default function BankVerifyPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<BankVerifyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [officerEmail, setOfficerEmail] = useState<string>("nodal.officer@sbi.co.in");
  const [branchCode, setBranchCode] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/bank-verify/${token}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Verification link is invalid or has expired.");
      }
      const json = await res.json();
      setData(json);
      if (json.bank_ifsc) {
        setBranchCode(json.bank_ifsc);
      }
    } catch (err: any) {
      setError(err.message || "Unable to reach verification gateway.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleDecision = async (decision: "confirmed" | "denied") => {
    if (!officerEmail.trim()) {
      alert("Please enter official bank nodal officer email.");
      return;
    }
    if (!confirm(decision === "confirmed" 
      ? `Are you sure you want to CONFIRM that FDR #${data?.fdr_number} of ₹${data?.amount?.toLocaleString('en-IN')} is genuinely held in the bank with lien to AICTE?`
      : `Are you sure you want to DISOWN and REPORT FDR #${data?.fdr_number} as untraceable or fraudulent?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/bank-verify/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          officer_email: officerEmail.trim(),
          remarks: remarks.trim() ? `${remarks} (Branch: ${branchCode})` : `Branch: ${branchCode}`
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Submission failed");
      }
      await res.json();
      setActionSuccess(decision === "confirmed" 
        ? "Instrument successfully verified and confirmed! Provenance upgraded to BANK_CONFIRMED."
        : "Instrument disowned. Critical forgery notice dispatched to AICTE Vigilance Bureau."
      );
      await loadData();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans -m-4 md:-m-6">
      {/* Official Top Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                Authorized Bank Nodal Portal
              </span>
              <span className="text-xs text-slate-400">AICTE Financial Regulations (APH Clause 6.46)</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              External Commercial Bank Security Deposit Verification Gateway
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            256-Bit Encrypted Single-Use Gateway
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center">
        {loading ? (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Validating single-use cryptographic verification token...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-8 text-center max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-700/50 flex items-center justify-center text-red-400 mx-auto mb-3">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-red-200 mb-2">Token Invalid or Expired</h2>
            <p className="text-sm text-red-300/80 mb-6">{error}</p>
            <p className="text-xs text-slate-400">
              For security under AICTE financial rules, verification tokens expire within 7 days or after first use. 
              Please contact the AICTE Regulation Bureau to dispatch a fresh verification request.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Status Alert Banner */}
            {data.status === "confirmed" ? (
              <div className="bg-emerald-950/60 border border-emerald-700/70 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">Instrument Officially Bank-Confirmed</h3>
                  <p className="text-xs text-emerald-300/80">
                    Confirmed by {data.responder_email || "Authorized Nodal Officer"} at {data.responded_at || "Recorded Timestamp"}.
                    AICTE lien status has been acknowledged on institutional records.
                  </p>
                </div>
              </div>
            ) : data.status === "denied" ? (
              <div className="bg-red-950/60 border border-red-700/70 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-200">Instrument Disowned & Flagged</h3>
                  <p className="text-xs text-red-300/80">
                    Disowned by {data.responder_email || "Authorized Nodal Officer"} at {data.responded_at || "Recorded Timestamp"}.
                    The instrument has been placed under AICTE Regulation Bureau vigilance freeze.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-950/50 border border-blue-800/70 rounded-xl p-4 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="text-xs text-blue-200">
                  <span className="font-bold">Official Statutory Verification Request:</span> AICTE requires the issuing bank to confirm whether the following Fixed Deposit Receipt exists in your core banking system, is genuine, and carries an unencumbered lien in favor of the Regional Officer, AICTE.
                </div>
              </div>
            )}

            {actionSuccess && (
              <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-3 text-xs text-emerald-200">
                {actionSuccess}
              </div>
            )}

            {/* Instrument Details Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-slate-900/70 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pledged Technical College</div>
                  <h2 className="text-base font-bold text-white">{data.institution_name}</h2>
                  <div className="text-xs text-slate-400">
                    AICTE Permanent ID: <span className="text-slate-200 font-mono font-semibold">{data.institution_aicte_id}</span> • {data.institution_district}, {data.institution_state}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    FDR Instrument
                  </span>
                  <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                    {data.fdr_number}
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Issuing Bank & IFSC</div>
                  <div className="text-sm font-semibold text-white">{data.bank_name}</div>
                  <div className="text-xs font-mono text-emerald-400 mt-0.5">IFSC Prefix: {data.bank_ifsc}</div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Pledged Principal Corpus</div>
                  <div className="text-base font-bold text-white">₹{data.amount.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-slate-400 mt-0.5">₹{data.amount_lakhs} Lakhs (INR)</div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Deposit Tenure & Lock-In</div>
                  <div className="text-sm font-semibold text-white">{data.issue_date} to {data.maturity_date}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{data.tenure_days} Days (~10 Years)</div>
                </div>
              </div>

              {/* Action Section (only if pending) */}
              {data.status === "pending" && (
                <div className="border-t border-slate-800 bg-slate-900/30 p-6 space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Bank Nodal Officer Attestation
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Bank Nodal Officer Email Address <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={officerEmail}
                        onChange={(e) => setOfficerEmail(e.target.value)}
                        placeholder="officer@bank.co.in"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Branch Code / CBS Reference <span className="text-slate-500">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                        placeholder="e.g. SBIN0001029 / BR-PUNE-CENTRAL"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Bank Scrutiny Remarks
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Verified against Core Banking System; AICTE lien noted in system."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                    <button
                      onClick={() => handleDecision("confirmed")}
                      disabled={submitting}
                      className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Genuine Deposit (AICTE Lien Marked)</span>
                    </button>

                    <button
                      onClick={() => handleDecision("denied")}
                      disabled={submitting}
                      className="w-full sm:w-auto py-3 px-4 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/50 font-bold rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Disown / Report Fraudulent</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Official Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AICTE Regulation Bureau • Statutory Security Deposit Verification Gateway (Ministry of Education, Govt. of India)
      </footer>
    </div>
  );
}

