"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, ArrowRight, AlertTriangle, Upload, CheckCircle2,
  Sparkles, Check, X
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface BankOption {
  id: number;
  name: string;
  ifsc: string;
  regex: string;
}

interface SampleCase {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badge_color: string;
  bank_id: number;
  amount: number;
  issue_date: string;
  maturity_date: string;
  tenure_days: number;
  interest_rate: number;
  purpose: string;
  institution_id?: number;
  rule_tested: string;
}

const DEFAULT_SAMPLE_CASES: SampleCase[] = [
  {
    id: "genuine_10yr",
    title: "Genuine SBI (10-Yr)",
    subtitle: "Standard compliant deposit",
    badge: "Genuine",
    badge_color: "emerald",
    bank_id: 1,
    amount: 1500000,
    issue_date: "2026-01-15",
    maturity_date: "2036-01-15",
    tenure_days: 3652,
    interest_rate: 7.25,
    purpose: "Mandatory Institutional Security Deposit pledged jointly to AICTE",
    institution_id: 1,
    rule_tested: "Passes all AICTE Rules R01–R09"
  },
  {
    id: "tampered_amount",
    title: "10x Amount Forgery",
    subtitle: "Receipt ₹5L vs Form ₹50L",
    badge: "Fraud Test",
    badge_color: "rose",
    bank_id: 1,
    amount: 5000000,
    issue_date: "2026-01-15",
    maturity_date: "2036-01-15",
    tenure_days: 3652,
    interest_rate: 7.25,
    purpose: "Mandatory Institutional Security Deposit pledged jointly to AICTE",
    institution_id: 2,
    rule_tested: "Triggers 10x Amount Discrepancy & Signature Mismatch"
  },
  {
    id: "tenure_anomaly",
    title: "3-Yr Tenure Error",
    subtitle: "Form 10y vs Receipt 3y",
    badge: "Tenure Error",
    badge_color: "amber",
    bank_id: 2,
    amount: 1500000,
    issue_date: "2026-01-15",
    maturity_date: "2029-01-15",
    tenure_days: 3652,
    interest_rate: 6.85,
    purpose: "Institutional Deposit pledged jointly to AICTE",
    institution_id: 3,
    rule_tested: "Triggers AICTE Rule R02 tenure mismatch"
  },
  {
    id: "sub_minimum",
    title: "Below ₹5L Floor",
    subtitle: "Shortfall below statutory minimum",
    badge: "Rule R03",
    badge_color: "amber",
    bank_id: 3,
    amount: 250000,
    issue_date: "2026-01-15",
    maturity_date: "2036-01-15",
    tenure_days: 3652,
    interest_rate: 7.10,
    purpose: "Mandatory Institutional Security Deposit pledged jointly to AICTE",
    institution_id: 4,
    rule_tested: "Triggers Rule R03 shortfall (< ₹5 Lakhs floor)"
  }
];

export default function SubmitFdrPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCaseNotice, setActiveCaseNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusStep, setStatusStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  const [_submittedId, setSubmittedId] = useState<number | null>(null);
  
  const [fdrFile, setFdrFile] = useState<File | null>(null);
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

  const [form, setForm] = useState({
    institution_id: 1,
    bank_id: 1,
    fdr_number: "SBIN/2026/842911",
    amount: 1500000,
    issue_date: "2026-01-15",
    maturity_date: "2036-01-15",
    tenure_days: 3652,
    interest_rate: 7.25,
    purpose: "Mandatory Institutional Security Deposit pledged jointly to AICTE",
    lien_marked: true,
    joint_holding_confirmed: true
  });

  const loadCase = async (caseId: string) => {
    setLoadingSample(true);
    setErrorMsg("");
    try {
      const sample = await fetchApi<any>(`/mock-bank/sample-case/${caseId}`);
      setForm((prev) => ({
        ...prev,
        institution_id: sample.institution_id || prev.institution_id,
        bank_id: sample.bank_id || prev.bank_id,
        fdr_number: sample.fdr_number || `SBIN/2026/${Math.floor(100000 + Math.random() * 900000)}`,
        amount: sample.amount ?? 1500000,
        issue_date: sample.issue_date || "2026-01-15",
        maturity_date: sample.maturity_date || "2036-01-15",
        tenure_days: sample.tenure_days ?? 3652,
        interest_rate: sample.interest_rate ?? 7.25,
        purpose: sample.purpose || "Mandatory Institutional Security Deposit pledged jointly to AICTE"
      }));

      setActiveCaseId(caseId);
      const matched = DEFAULT_SAMPLE_CASES.find((c) => c.id === caseId);
      if (matched) {
        setActiveCaseNotice(`${matched.title} — ${matched.rule_tested}`);
      } else if (sample.note) {
        setActiveCaseNotice(sample.note);
      }

      await attachSampleDocument("receipt", sample.fdr_number, sample.amount, caseId);
    } catch {
      const matched = DEFAULT_SAMPLE_CASES.find((c) => c.id === caseId);
      if (matched) {
        setForm((prev) => ({
          ...prev,
          institution_id: matched.institution_id || prev.institution_id,
          bank_id: matched.bank_id,
          fdr_number: `${matched.bank_id === 1 ? "SBIN" : matched.bank_id === 2 ? "PUNB" : "CNRB"}/2026/${Math.floor(100000 + Math.random() * 900000)}`,
          amount: matched.amount,
          issue_date: matched.issue_date,
          maturity_date: matched.maturity_date,
          tenure_days: matched.tenure_days,
          interest_rate: matched.interest_rate,
          purpose: matched.purpose
        }));
        setActiveCaseId(caseId);
        setActiveCaseNotice(`${matched.title} — ${matched.rule_tested}`);
        await attachSampleDocument("receipt", undefined, matched.amount, caseId);
      }
    } finally {
      setLoadingSample(false);
    }
  };

  const attachSampleDocument = async (kind: "receipt" | "affidavit", fdrNum?: string, amt?: number, caseId?: string) => {
    try {
      const targetFdr = fdrNum || form.fdr_number || "SBIN/2026/842911";
      const targetAmt = amt !== undefined ? amt : form.amount;
      const targetCase = caseId || activeCaseId || "";
      const url = `${API_BASE}/mock-bank/generate-sample-pdf?fdr_number=${encodeURIComponent(targetFdr)}&amount=${targetAmt}&kind=${kind}&case=${encodeURIComponent(targetCase)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const safeFdr = targetFdr.replace(/\//g, "_");
      const filename = kind === "receipt" ? `fdr_receipt_${safeFdr}.pdf` : `affidavit_${safeFdr}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      if (kind === "receipt") {
        setFdrFile(file);
      } else {
        setSupportingDoc(file);
      }
    } catch (e) {
      console.warn("Could not attach sample PDF:", e);
    }
  };

  useEffect(() => {
    fetchApi<BankOption[]>("/mock-bank/banks")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBanks(data);
          setForm((prev) => ({ ...prev, bank_id: data[0].id }));
        }
      })
      .catch((e) => console.error("Error loading banks:", e));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setStatusStep("Registering deposit record in central repository...");

    try {
      const res = await fetchApi<any>("/instruments", {
        method: "POST",
        body: JSON.stringify(form)
      });

      const newId = res.id;
      if (!newId) throw new Error(res.message || "Failed to register FDR");

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

      if (supportingDoc) {
        setStatusStep("Attaching statutory compliance record...");
        const suppFormData = new FormData();
        suppFormData.append("file", supportingDoc);
        suppFormData.append("kind", "AFFIDAVIT_6");
        await fetchApi<any>(`/instruments/${newId}/documents`, {
          method: "POST",
          body: suppFormData
        });
      }

      setStatusStep("Deposit registered. Redirecting to Inspector...");
      setSubmittedId(newId);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push(`/inspector/${newId}`);
    } catch (e: any) {
      setErrorMsg(e.message || "Registration failed");
      setStatusStep("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            Submit Security Deposit (FDR)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Register new institutional Fixed Deposit Receipt or renewal certificate under AICTE Clause 6.46
          </p>
        </div>
      </div>

      {/* ATM-Style Quick Preset Pills */}
      <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider px-1">
          Quick Demo Presets:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {DEFAULT_SAMPLE_CASES.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => loadCase(sc.id)}
              disabled={loadingSample}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border ${
                activeCaseId === sc.id
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                  : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-amber-500"
              }`}
            >
              {sc.title}
            </button>
          ))}
          {activeCaseId && (
            <button
              type="button"
              onClick={() => {
                setActiveCaseId(null);
                setActiveCaseNotice(null);
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
              title="Clear preset"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Preset Notice Banner if selected */}
      {activeCaseNotice && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span><strong>Preset Active:</strong> {activeCaseNotice}</span>
        </div>
      )}

      {/* Main Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Deposit Particulars */}
          <div className="space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-zinc-800">
              1. Deposit Particulars
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                FDR Reference / Certificate Serial No. *
              </label>
              <input
                type="text"
                value={form.fdr_number}
                onChange={(e) => setForm({ ...form, fdr_number: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="e.g. SBIN/2026/842911"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Issuing Commercial Bank *
              </label>
              <select
                value={form.bank_id}
                onChange={(e) => setForm({ ...form, bank_id: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.ifsc})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Deposit Principal Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  required
                  min={1000}
                  step={1000}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                = ₹{(form.amount / 100000).toFixed(2)} Lakhs (Statutory floor is ₹5.00L)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Maturity Date *
                </label>
                <input
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Tenure (Days)
                </label>
                <input
                  type="number"
                  value={form.tenure_days}
                  onChange={(e) => setForm({ ...form, tenure_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Interest Rate (% p.a.)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Column 2: Document Uploads & Joint Lien */}
          <div className="space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-zinc-800">
              2. Certificate Documents & Endorsements
            </h2>

            {/* FDR Receipt Upload Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Official FDR Bank Receipt (PDF / Image) *
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl p-4 text-center hover:border-amber-500 transition-colors bg-slate-50/50 dark:bg-zinc-950/50 relative">
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => e.target.files?.[0] && setFdrFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                  {fdrFile ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {fdrFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(fdrFile.size / 1024).toFixed(0)} KB • Ready for OCR extraction
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="font-bold text-xs text-slate-700 dark:text-zinc-300">
                        Click or drag FDR receipt file here
                      </span>
                      <span className="text-[10px] text-slate-400">PDF, PNG, JPG up to 10MB</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Affidavit / Support Doc Upload Box */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Joint Lien Attestation / Supporting Letter
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl p-3 text-center hover:border-amber-500 transition-colors bg-slate-50/50 dark:bg-zinc-950/50 relative">
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={(e) => e.target.files?.[0] && setSupportingDoc(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  {supportingDoc ? (
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-4 h-4" /> {supportingDoc.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Optional: Attach Affidavit 6 or Speed Post confirmation
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Joint Lien Checkboxes */}
            <div className="pt-2 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={form.lien_marked}
                  onChange={(e) => setForm({ ...form, lien_marked: e.target.checked })}
                  className="mt-0.5 rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-slate-700 dark:text-zinc-300 font-medium">
                  <strong>Mandatory Lien Marked:</strong> FDR endorsed in joint name with AICTE
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={form.joint_holding_confirmed}
                  onChange={(e) => setForm({ ...form, joint_holding_confirmed: e.target.checked })}
                  className="mt-0.5 rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-slate-700 dark:text-zinc-300 font-medium">
                  <strong>Joint Holding Confirmed:</strong> Branch confirmed no unilateral encashment
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusStep && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span>{statusStep}</span>
          </div>
        )}

        {/* Big ATM Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-base tracking-wide uppercase transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <span>PROCESSING DEPOSIT REGISTRATION...</span>
          ) : (
            <>
              <span>SUBMIT FDR FOR STATUTORY VERIFICATION</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
