"use client";

import React, { useState, useEffect } from "react";
import { 
  FileCheck2, X, CheckCircle2, AlertTriangle, Ban
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface ReleaseApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: {
    id: number;
    fdr_number: string;
    institution_name: string;
    amount: number;
    bank_name: string;
    maturity_date: string;
    trust_tier: string;
    status: string;
  } | null;
  onSuccess: () => void;
}

export default function ReleaseApplicationModal({
  isOpen,
  onClose,
  instrument,
  onSuccess
}: ReleaseApplicationModalProps) {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instrument && isOpen) {
      setReason(
        `Application for discharge and refund of security deposit FDR #${instrument.fdr_number} (₹${(instrument.amount / 100000).toFixed(2)} Lakhs) upon full completion of prescribed statutory lock-in tenure in accordance with AICTE Approval Process Handbook Clause 6.46.`
      );
      checkReadiness();
    }
  }, [instrument, isOpen]);

  const checkReadiness = async () => {
    if (!instrument) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<any>(`/instruments/${instrument.id}/release-readiness`);
      setReadiness(data);
    } catch (e: any) {
      setError(e.message || "Failed to evaluate release pre-conditions.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !instrument) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a statutory justification for deposit release.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/instruments/${instrument.id}/release-requests`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() })
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Release request submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = readiness?.is_ready;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  PS 26265 Capability 6
                </span>
                <span className="text-xs text-slate-400">AICTE APH Clause 6.46</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Apply for Security Deposit Release / Refund
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Instrument Context */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{instrument.institution_name}</span>
              <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                FDR #{instrument.fdr_number}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Issuing Bank: {instrument.bank_name} • Pledged Corpus: ₹{(instrument.amount / 100000).toFixed(2)} Lakhs • Maturity: {instrument.maturity_date}
            </div>
          </div>

          {/* Mandatory Statutory Pre-Check Checklist */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Mandatory Clause 6.46 Statutory Pre-Conditions</span>
              {loading && <span className="text-[10px] text-amber-500 animate-pulse">Evaluating...</span>}
            </div>

            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400">Checking eligibility...</div>
            ) : readiness ? (
              <div className="space-y-2">
                {readiness.checklist?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      item.passed
                        ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Ban className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold">{item.criterion}:</span>{" "}
                        <span className="opacity-90">{item.detail}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/60 dark:bg-zinc-900/60">
                      {item.passed ? "SATISFIED" : "DEFICIENT"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Submission Form */}
          {isReady ? (
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Statutory Justification & Application Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>{submitting ? "Submitting Application..." : "Submit Release Application to Bureau"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold">Release Gate Locked:</span> This instrument cannot be submitted for release until all statutory pre-conditions are satisfied. Please rectify deficiencies (e.g. upload missing receipt or request bank cryptographic confirmation).
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-center text-[10px] text-slate-500 font-mono">
          AICTE Release Workflow: Institution Application ➔ Scrutiny Officer Verification ➔ Senior Director Sign-Off
        </div>
      </div>
    </div>
  );
}

