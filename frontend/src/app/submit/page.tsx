"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, ArrowRight, AlertTriangle, Upload, CheckCircle2, FileCheck, ShieldCheck
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface BankOption {
  id: number;
  name: string;
  ifsc: string;
  regex: string;
}

export default function SubmitFdrPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusStep, setStatusStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  const [fdrFile, setFdrFile] = useState<File | null>(null);
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

  const [form, setForm] = useState({
    institution_id: 1,
    bank_id: 1,
    fdr_number: "SBIN/2026/883921",
    amount: 1500000,
    issue_date: "2026-01-15",
    maturity_date: "2028-01-15",
    tenure_days: 730,
    interest_rate: 7.1,
    purpose: "AICTE Mandatory Security Deposit for Engineering Approval"
  });

  useEffect(() => {
    fetchApi<BankOption[]>("/mock-bank/banks")
      .then((data) => {
        setBanks(data);
        if (data.length > 0) {
          setForm((prev) => ({ ...prev, bank_id: data[0].id }));
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setStatusStep("Registering deposit record in central repository...");

    try {
      // 1. Register Instrument Record
      const res = await fetchApi<any>("/instruments", {
        method: "POST",
        body: JSON.stringify(form)
      });

      const newId = res.id;
      if (!newId) {
        throw new Error(res.message || "Failed to register FDR instrument");
      }

      // 2. Upload Original FDR Document if provided
      if (fdrFile) {
        setStatusStep("Uploading original FDR receipt & running automatic field extraction...");
        const formData = new FormData();
        formData.append("file", fdrFile);
        formData.append("kind", "FDR_RECEIPT");
        await fetchApi<any>(`/instruments/${newId}/documents`, {
          method: "POST",
          body: formData
        });
      }

      // 3. Upload Supporting Document if provided
      if (supportingDoc) {
        setStatusStep("Attaching statutory Affidavit 6 compliance record...");
        const suppFormData = new FormData();
        suppFormData.append("file", supportingDoc);
        suppFormData.append("kind", "AFFIDAVIT_6");
        await fetchApi<any>(`/instruments/${newId}/documents`, {
          method: "POST",
          body: suppFormData
        });
      }

      setStatusStep("Compliance rules evaluated. Redirecting to Deposit Inspector...");
      router.push(`/inspector/${newId}`);
    } catch (e: any) {
      setErrorMsg(e.message || "Deposit registration failed");
      setStatusStep("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" />
          Register New Institutional Fixed Deposit (FDR)
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Submit official bank fixed deposit receipt credentials & original documents pledged in favor of AICTE.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 space-y-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Institution Selector */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Pledging Institution</label>
            <select
              value={form.institution_id}
              onChange={(e) => setForm({ ...form, institution_id: parseInt(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            >
              <option value="1">National Institute of Technology, Pune (AICTE ID: 1-100000001)</option>
              <option value="2">Apex College of Engineering, Bengaluru (AICTE ID: 1-100000002)</option>
              <option value="3">Bharati Polytechnic, Chennai (AICTE ID: 1-100000003)</option>
              <option value="4">St. Xavier&apos;s Institute of Tech, Mumbai (AICTE ID: 1-100000004)</option>
            </select>
          </div>

          {/* Bank Selector */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Issuing Commercial Bank</label>
            <select
              value={form.bank_id}
              onChange={(e) => {
                const bId = parseInt(e.target.value);
                const b = banks.find((item) => item.id === bId);
                const pfx = b ? b.ifsc : "SBIN";
                setForm({ 
                  ...form, 
                  bank_id: bId,
                  fdr_number: `${pfx}/2026/${Math.floor(100000 + Math.random() * 900000)}`
                });
              }}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (IFSC Prefix: {b.ifsc})
                </option>
              ))}
            </select>
          </div>

          {/* FDR Serial Number */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Fixed Deposit Receipt (FDR) Serial</label>
            <input
              type="text"
              required
              value={form.fdr_number}
              onChange={(e) => setForm({ ...form, fdr_number: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Pledged Deposit Amount (INR)</label>
            <input
              type="number"
              required
              min="100000"
              step="10000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm font-bold"
            />
          </div>

          {/* Issue Date */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Date of Issue</label>
            <input
              type="date"
              required
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          {/* Maturity Date */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Date of Maturity</label>
            <input
              type="date"
              required
              value={form.maturity_date}
              onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          {/* Tenure */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Tenure (Days)</label>
            <input
              type="number"
              required
              value={form.tenure_days}
              onChange={(e) => setForm({ ...form, tenure_days: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Interest Rate (% per annum)</label>
            <input
              type="number"
              step="0.05"
              required
              value={form.interest_rate}
              onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="text-xs">
          <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">Regulatory Approval Purpose</label>
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
          />
        </div>

        {/* Real Document Upload Section (Mandated by PS 26265) */}
        <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Digital Document Submission & OCR Ingestion
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* FDR Receipt Upload Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-amber-500 dark:hover:border-amber-400 transition bg-slate-50/50 dark:bg-zinc-950/50">
              <Upload className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <label className="font-semibold text-slate-800 dark:text-zinc-200 block mb-1 cursor-pointer">
                <span>Upload Original FDR Receipt (PDF / Image)</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFdrFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {fdrFile ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {fdrFile.name} ({(fdrFile.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  "Accepts official digital e-FDR or scanned certificate"
                )}
              </p>
            </div>

            {/* Supporting Document Upload Dropzone */}
            <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-4 text-center hover:border-amber-500 dark:hover:border-amber-400 transition bg-slate-50/50 dark:bg-zinc-950/50">
              <FileCheck className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <label className="font-semibold text-slate-800 dark:text-zinc-200 block mb-1 cursor-pointer">
                <span>Upload Supporting Affidavit 6 / EoA Letter</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSupportingDoc(e.target.files[0]);
                    }
                  }}
                />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {supportingDoc ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {supportingDoc.name} ({(supportingDoc.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  "Trust undertaking or AICTE approval letter (PDF/Image)"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button & Progress Indicator */}
        <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {statusStep ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium animate-pulse">{statusStep}</span>
            ) : (
              "On submission, AICTE automated compliance checks (Rules R01-R09) and the tamper-proof audit log will execute immediately."
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold transition shadow-sm shrink-0"
          >
            <span>{submitting ? "Processing & Extracting..." : "Register Deposit Certificate"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
