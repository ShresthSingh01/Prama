"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, ShieldCheck, ArrowRight, Upload, 
  CheckCircle2, AlertTriangle, Building2, Landmark
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
  const [errorMsg, setErrorMsg] = useState<string>("");

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

    try {
      const res = await fetchApi<any>("/instruments", {
        method: "POST",
        body: JSON.stringify(form)
      });

      if (res.success && res.id) {
        router.push(`/inspector/${res.id}`);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-2 border-b border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Deposit & Pledging of FDR Instrument (Institution Portal)
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Submit official bank fixed deposit receipt credentials favoring AICTE Regulation Bureau.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/60 rounded text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Institution Selector */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Pledging Institution</label>
            <select
              value={form.institution_id}
              onChange={(e) => setForm({ ...form, institution_id: parseInt(e.target.value) })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="1">National Institute of Technology, Pune (AICTE ID: 1-100000001)</option>
              <option value="2">Apex College of Engineering, Bengaluru (AICTE ID: 1-100000002)</option>
              <option value="3">Bharati Polytechnic, Chennai (AICTE ID: 1-100000003)</option>
              <option value="4">St. Xavier&apos;s Institute of Tech, Mumbai (AICTE ID: 1-100000004)</option>
            </select>
          </div>

          {/* Bank Selector */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Issuing Commercial Bank</label>
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
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-amber-500"
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
            <label className="text-zinc-400 font-medium block mb-1">Fixed Deposit Receipt (FDR) Serial</label>
            <input
              type="text"
              required
              value={form.fdr_number}
              onChange={(e) => setForm({ ...form, fdr_number: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Pledged Deposit Amount (INR)</label>
            <input
              type="number"
              required
              min="100000"
              step="10000"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Issue Date */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Date of Issue (YYYY-MM-DD)</label>
            <input
              type="date"
              required
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Maturity Date */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Date of Maturity (YYYY-MM-DD)</label>
            <input
              type="date"
              required
              value={form.maturity_date}
              onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Tenure */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Tenure (Days)</label>
            <input
              type="number"
              required
              value={form.tenure_days}
              onChange={(e) => setForm({ ...form, tenure_days: parseInt(e.target.value) || 0 })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Interest Rate (% p.a.)</label>
            <input
              type="number"
              step="0.05"
              required
              value={form.interest_rate}
              onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || 0 })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="text-xs">
          <label className="text-zinc-400 font-medium block mb-1">Regulatory Purpose</label>
          <input
            type="text"
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-500 font-mono">
            On submit, R01-R09 rules and provenance ledger will execute automatically.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-semibold transition shadow-lg shadow-amber-950/40"
          >
            <span>{submitting ? "Submitting to Regulation Bureau..." : "Pledge Deposit Instrument"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
