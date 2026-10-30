"use client";

import React, { useState, useEffect } from "react";
import { 
  RotateCw, X, AlertTriangle
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentInstrument: {
    id: number;
    fdr_number: string;
    institution_name: string;
    amount: number;
    bank_name: string;
    maturity_date: string;
  } | null;
  onSuccess: () => void;
}

export default function RenewalModal({
  isOpen,
  onClose,
  parentInstrument,
  onSuccess
}: RenewalModalProps) {
  const [fdrNumber, setFdrNumber] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [issueDate, setIssueDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [tenureDays, setTenureDays] = useState(3652); // 10 years default under AICTE
  const [interestRate, setInterestRate] = useState(7.25);
  const [purpose, setPurpose] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (parentInstrument) {
      setAmount(parentInstrument.amount);
      const today = new Date().toISOString().slice(0, 10);
      setIssueDate(today);
      
      // Calculate +10 years
      const d = new Date();
      d.setFullYear(d.getFullYear() + 10);
      setMaturityDate(d.toISOString().slice(0, 10));
      
      setFdrNumber(`REN-${parentInstrument.fdr_number}`);
      setPurpose(`Renewal / Replacement of matured FDR #${parentInstrument.fdr_number} under AICTE APH regulations`);
    }
  }, [parentInstrument]);

  if (!isOpen || !parentInstrument) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fdrNumber.trim()) {
      setError("Please provide the new Renewal FDR Number.");
      return;
    }
    if (!maturityDate || !issueDate) {
      setError("Please provide both issue and maturity dates.");
      return;
    }

    setSubmitting(true);
    try {
      const renewPayload = {
        institution_id: (parentInstrument as any).institution_id,
        bank_id: (parentInstrument as any).bank_id,
        fdr_number: fdrNumber.trim(),
        amount: Number(amount),
        issue_date: issueDate,
        maturity_date: maturityDate,
        tenure_days: Number(tenureDays),
        interest_rate: Number(interestRate),
        purpose: purpose.trim()
      };

      const res = await fetchApi<{ success: boolean; renewed_instrument_id: number; message: string }>(
        `/instruments/${parentInstrument.id}/renew`,
        {
          method: "POST",
          body: JSON.stringify(renewPayload)
        }
      );

      // If document attached, upload to the newly created renewal instrument
      if (file && res.renewed_instrument_id) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", "FDR_RECEIPT");
        await fetchApi(`/instruments/${res.renewed_instrument_id}/documents`, {
          method: "POST",
          body: formData
        }).catch(() => {});
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit renewal instrument.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  PS 26265 Capability 5
                </span>
                <span className="text-xs text-slate-400">Parent-Child Lineage Tracking</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Submit Renewal / Replacement FDR
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Locked Parent Context Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Parent Instrument Being Replaced
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{parentInstrument.institution_name}</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                FDR #{parentInstrument.fdr_number}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Issuing Bank: {parentInstrument.bank_name} • Matured on {parentInstrument.maturity_date} • Existing Corpus: ₹{(parentInstrument.amount / 100000).toFixed(2)} Lakhs
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                New Renewal FDR Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fdrNumber}
                onChange={(e) => setFdrNumber(e.target.value)}
                placeholder="e.g. SBIN/2026/881921"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Pledged Principal Corpus (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={100000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                New Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                New Maturity Date (+10 Yrs Norm) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Tenure (Days)
              </label>
              <input
                type="number"
                value={tenureDays}
                onChange={(e) => setTenureDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Interest Rate (% p.a.)
              </label>
              <input
                type="number"
                step="0.05"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Upload renewal advice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Upload Renewal FDR Receipt / Deposit Advice <span className="text-slate-400 font-normal">(Optional PDF/JPG)</span>
            </label>
            <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-3 text-center">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-500 dark:text-zinc-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-700 dark:file:text-amber-300 hover:file:bg-amber-500/20"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
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
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{submitting ? "Linking & Renewing..." : "Confirm & Submit Renewal"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

