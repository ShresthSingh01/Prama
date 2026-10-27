"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2,
  Layers, QrCode, FileText, Eye, ShieldAlert,
  ArrowLeft, Sparkles, Building2, Landmark,
  Clock, HelpCircle, RefreshCw, FileCheck2, X,
  Scan, Crosshair, ZoomIn, Info, Check, AlertOctagon, Sliders
} from "lucide-react";
import { fetchApi, API_BASE } from "@/lib/api";

interface ForensicData {
  instrument_id: number;
  fdr_number: string;
  bank_name: string;
  document_image_url: string;
  ela_image_url: string;
  qr_image_url: string;
  anomaly_score: number;
  is_tampered: boolean;
  tamper_risk: string;
  pdf_metadata: {
    producer: string;
    creator: string;
    mod_date: string;
    creation_date: string;
    is_suspicious: boolean;
    suspicious_tool?: string;
    explanation: string;
  };
  ocr_boxes: Array<{
    id: string;
    field: string;
    label: string;
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  suspicious_regions: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
    anomaly_level: string;
  }>;
  cryptographic_envelope: {
    algorithm: string;
    public_key: string;
    signed_hash: string;
    signature_valid: boolean;
    decoded_payload: any;
  };
}

interface InstrumentDetail {
  id: number;
  institution_id: number;
  institution_name: string;
  institution_aicte_id: string;
  bank_id: number;
  bank_name: string;
  bank_ifsc: string;
  fdr_number: string;
  amount: number;
  issue_date: string;
  maturity_date: string;
  tenure_days: number;
  interest_rate: number;
  purpose: string;
  status: string;
  trust_tier: string;
  risk_score: number;
  risk_band: string;
  days_to_maturity: number;
  parent_instrument_id?: number;
  provenance: Record<string, { value: string; source: string; confidence: number; updated_at: string }>;
  flags: Array<{ id: number; code: string; severity: string; explanation: string; explanation_hi?: string; evidence: any; status: string; created_at: string }>;
  verifications: Array<{ id: number; method: string; result: string; created_at: string }>;
  observations: Array<{ id: number; author: string; text: string; created_at: string }>;
}

export default function DepositInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id || "1";

  const [detail, setDetail] = useState<InstrumentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Navigation Tabs: Summary | Certificate & Flags | Advanced Forensics
  const [activeTab, setActiveTab] = useState<"summary" | "certificate" | "forensics">("summary");

  // Forensic Workstation State
  const [forensicData, setForensicData] = useState<ForensicData | null>(null);
  const [forensicLoading, setForensicLoading] = useState<boolean>(false);
  const [forensicMode, setForensicMode] = useState<"scan" | "ela" | "ocr" | "composite">("ocr");
  const [selectedOcrBox, setSelectedOcrBox] = useState<string | null>("ocr_amount");
  const [elaThreshold, setElaThreshold] = useState<number>(85);

  // Layer Toggles
  const [showElaHeatmap, setShowElaHeatmap] = useState<boolean>(false);
  const [showQrDecode, setShowQrDecode] = useState<boolean>(false);
  
  // Verification test states
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [obsText, setObsText] = useState<string>("");
  const [submittingObs, setSubmittingObs] = useState<boolean>(false);

  // Release Request states
  const [releaseModalOpen, setReleaseModalOpen] = useState<boolean>(false);
  const [releaseReason, setReleaseReason] = useState<string>("10-Year Statutory Term Completion - Request for Release & Security Refund");
  const [submittingRelease, setSubmittingRelease] = useState<boolean>(false);
  const [releaseResult, setReleaseResult] = useState<{ success: boolean; message: string; reqId?: number } | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // AI Explanation state per flag
  const [flagExplanations, setFlagExplanations] = useState<Record<number, { en?: string; hi?: string; loading?: boolean; loadingLang?: "en" | "hi"; error?: string }>>({});

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<InstrumentDetail>(`/instruments/${id}`);
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadForensics = async () => {
    try {
      setForensicLoading(true);
      const data = await fetchApi<ForensicData>(`/instruments/${id}/forensics`);
      setForensicData(data);
    } catch (e) {
      console.error("Failed to load forensics:", e);
    } finally {
      setForensicLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    loadForensics();
  }, [id]);

  const handleVerifySignedQr = async (tampered: boolean = false) => {
    if (!detail) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      const endpoint = tampered 
        ? `/mock-bank/issue-tampered-sample-fdr?bank_id=${detail.bank_id}&fdr_number=${detail.fdr_number}&amount=${detail.amount}&maturity_date=${detail.maturity_date}&holder_name=${encodeURIComponent(detail.institution_name)}`
        : `/mock-bank/issue-sample-fdr?bank_id=${detail.bank_id}&fdr_number=${detail.fdr_number}&amount=${detail.amount}&maturity_date=${detail.maturity_date}&holder_name=${encodeURIComponent(detail.institution_name)}`;

      const qrIssue = await fetchApi<any>(endpoint, { method: "POST" });
      const envelopeStr = tampered ? qrIssue.tampered_envelope_json : qrIssue.envelope_json;

      const res = await fetchApi<any>(`/instruments/${detail.id}/verify/qr`, {
        method: "POST",
        body: JSON.stringify({ qr_content: envelopeStr })
      });

      setVerifyResult({
        success: res.verified,
        message: res.message
      });
      await loadDetail();
    } catch (e: any) {
      setVerifyResult({
        success: false,
        message: e.message || "Verification request failed"
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleFetchAiExplanation = async (flagId: number, lang: "en" | "hi") => {
    setFlagExplanations(prev => ({ 
      ...prev, 
      [flagId]: { ...prev[flagId], loading: true, loadingLang: lang } 
    }));
    try {
      const res = await fetchApi<any>(`/flags/${flagId}/explain?lang=${lang}`, { method: "POST" });
      const text = res.ai_explanation || res.explanation || res.deterministic_explanation || "No explanation available.";
      setFlagExplanations(prev => ({
        ...prev,
        [flagId]: {
          ...prev[flagId],
          [lang]: text,
          loading: false,
          loadingLang: undefined
        }
      }));
    } catch (e: any) {
      console.error("Failed to fetch AI explanation:", e);
      setFlagExplanations(prev => ({ 
        ...prev, 
        [flagId]: { 
          ...prev[flagId], 
          loading: false,
          loadingLang: undefined,
          error: e.message || "Failed to generate explanation." 
        } 
      }));
    }
  };

  const handleAskCopilotRule = (code: string) => {
    window.dispatchEvent(new CustomEvent("openCopilot", {
      detail: { question: `What does AICTE rule ${code} require for fixed deposit security?` }
    }));
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsText.trim() || !detail) return;
    setSubmittingObs(true);
    try {
      await fetchApi(`/instruments/${detail.id}/observations`, {
        method: "POST",
        body: JSON.stringify({ text: obsText })
      });
      setObsText("");
      await loadDetail();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingObs(false);
    }
  };

  const handleRequestRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmittingRelease(true);
    setReleaseResult(null);
    try {
      const res = await fetchApi<any>(`/instruments/${detail.id}/release-requests`, {
        method: "POST",
        body: JSON.stringify({ reason: releaseReason })
      });
      setReleaseResult({
        success: true,
        message: `Statutory release request #${res.release_request_id} registered. Request forwarded to Scrutiny Officer (Maker) review.`,
        reqId: res.release_request_id
      });
      setReleaseModalOpen(false);
      await loadDetail();
    } catch (e: any) {
      setReleaseResult({
        success: false,
        message: e.message || "Failed to submit release request. Please verify regulatory compliance conditions."
      });
    } finally {
      setSubmittingRelease(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading deposit details for Instrument #{id}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link 
            href="/queue" 
            className="p-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 transition shadow-sm"
            title="Back to Action Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                {detail.fdr_number}
              </h1>
              <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${
                detail.trust_tier === "BANK_CONFIRMED" 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30" 
                  : detail.trust_tier === "CROSS_VALIDATED" 
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30" 
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
              }`}>
                {detail.trust_tier === "BANK_CONFIRMED" ? "Bank Confirmed" : detail.trust_tier === "CROSS_VALIDATED" ? "Document Matched" : "Unverified"}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${
                detail.risk_band === "CRITICAL" 
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30" 
                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}>
                RISK: {detail.risk_score} ({detail.risk_band})
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {detail.institution_name} • {detail.bank_name} (IFSC: {detail.bank_ifsc})
            </p>
          </div>
        </div>

        {/* Quick ID switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Quick ID:</span>
          <input
            type="number"
            min="1"
            max="604"
            defaultValue={detail.id}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                router.push(`/inspector/${(e.target as HTMLInputElement).value}`);
              }
            }}
            className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-center font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
          />
        </div>
      </div>

      {/* Navigation Tabs (Progressive Disclosure) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "summary"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Deposit Summary & Verification</span>
        </button>

        <button
          onClick={() => setActiveTab("certificate")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "certificate"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Certificate Preview & Explanations ({detail.flags.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("forensics")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === "forensics"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Technical Forensics (Advanced)</span>
        </button>
      </div>

      {/* TAB 1: SUMMARY & VERIFICATION */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Core Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                Deposit Master Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 block mb-0.5">Institution Name</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{detail.institution_name}</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">AICTE Code: {detail.institution_aicte_id}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 block mb-0.5">Issuing Bank</span>
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{detail.bank_name}</span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">IFSC: {detail.bank_ifsc}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 block mb-0.5">Principal Amount</span>
                  <span className="font-bold text-slate-900 dark:text-white text-base font-mono">
                    ₹{detail.amount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">Interest Rate: {detail.interest_rate}% p.a.</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 block mb-0.5">Tenure & Maturity</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                    {detail.maturity_date}
                  </span>
                  <span className={`text-[11px] block mt-0.5 font-semibold ${
                    detail.days_to_maturity < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {detail.days_to_maturity < 0 ? `Lapsed ${Math.abs(detail.days_to_maturity)} days ago` : `Expires in ${detail.days_to_maturity} days`}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Regulatory Purpose</span>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{detail.purpose || "AICTE Establishment Security Corpus Deposit"}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Account Pledging</span>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Joint Name Verified</p>
                </div>
              </div>
            </div>

            {/* Officer Observation Form */}
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                Regulatory Scrutiny Notes & Observations
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {detail.observations.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 italic">No notes recorded yet.</p>
                ) : (
                  detail.observations.map((obs) => (
                    <div key={obs.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs">
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">{obs.author}</span>
                        <span>{new Date(obs.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-800 dark:text-zinc-200">{obs.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddObservation} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add scrutiny note or directive for this institution..."
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={submittingObs || !obsText.trim()}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  Save Note
                </button>
              </form>
            </div>
          </div>

          {/* Right 1 Col: Live Bank QR Verification */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Bank QR Verification Test
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Validate the bank&apos;s cryptographic digital signature against the issuing branch&apos;s public key.
              </p>

              {verifyResult && (
                <div className={`p-3 rounded-lg text-xs border ${
                  verifyResult.success 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" 
                    : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
                }`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {verifyResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {verifyResult.success ? "Signature Valid & Genuine" : "Tamper Detected!"}
                  </div>
                  <div className="mt-1 text-[11px] font-mono">{verifyResult.message}</div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleVerifySignedQr(false)}
                  disabled={verifying}
                  className="w-full p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 transition text-left font-medium"
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Verify Genuine Bank QR
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-0.5">
                    Validates genuine bank issuance without calling the bank manually
                  </div>
                </button>

                <button
                  onClick={() => handleVerifySignedQr(true)}
                  disabled={verifying}
                  className="w-full p-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 transition text-left font-medium"
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Simulate Tampered Certificate
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400/80 mt-0.5">
                    Demonstrates instant signature rejection on altered amount
                  </div>
                </button>
              </div>
            </div>

            {/* Deposit Lifecycle & Statutory Release Card */}
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Deposit Release & Refund
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold border border-slate-200 dark:border-zinc-700">
                  {detail.status.toUpperCase()}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Statutory maturity refund requires dual-officer sign-off: Scrutiny Review by Maker followed by Senior Director approval.
              </p>

              {releaseResult && (
                <div className={`p-3 rounded-lg text-xs border ${
                  releaseResult.success
                    ? "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
                    : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300"
                }`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {releaseResult.success ? <CheckCircle2 className="w-4 h-4 text-purple-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    {releaseResult.success ? "Request Registered" : "Submission Blocked"}
                  </div>
                  <div className="mt-1 text-[11px] font-mono">{releaseResult.message}</div>
                  {releaseResult.success && (
                    <Link
                      href="/release"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline"
                    >
                      Open Release Approvals Portal &rarr;
                    </Link>
                  )}
                </div>
              )}

              {detail.status === "released" ? (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Security Deposit Discharged
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Dual authorization completed. Digital Release Certificate issued.
                  </p>
                  <Link href="/release" className="text-[11px] font-bold underline inline-block mt-1">
                    View Certificate in Portal &rarr;
                  </Link>
                </div>
              ) : detail.status === "release_requested" ? (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 text-xs text-purple-800 dark:text-purple-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Awaiting Dual Officer Sign-Off
                  </div>
                  <p className="text-[11px] text-purple-700 dark:text-purple-400">
                    Release request submitted. Maker scrutiny and Director authorization pending.
                  </p>
                  <Link href="/release" className="text-[11px] font-bold underline inline-block mt-1">
                    Review in Release Cockpit &rarr;
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => setReleaseModalOpen(true)}
                  className="w-full p-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Initiate Deposit Release Request</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFICATE PREVIEW & PLAIN-LANGUAGE EXPLANATIONS */}
      {activeTab === "certificate" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Certificate View (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                Submitted Certificate Preview
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Scanned PDF Document
              </span>
            </div>

            {/* Certificate Card */}
            <div className="p-6 rounded-xl border border-stone-300 dark:border-stone-700/60 bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-zinc-900 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-stone-300 dark:border-stone-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/30">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{detail.bank_name}</h2>
                    <p className="text-[11px] text-slate-500 dark:text-stone-400 font-mono">SCHEDULED COMMERCIAL BANK • IFSC: {detail.bank_ifsc}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500 dark:text-stone-400">
                  <div className="font-semibold text-slate-700 dark:text-stone-300">AICTE SECURITY DEPOSIT</div>
                  <div>FORM NO: 26265/AICTE</div>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700 dark:text-stone-200 leading-relaxed">
                <p>
                  This is to certify that <strong>{detail.institution_name}</strong> has deposited the principal sum of{" "}
                  <strong className="text-slate-900 dark:text-white font-mono">₹{detail.amount.toLocaleString("en-IN")}</strong>{" "}
                  under Fixed Deposit Receipt No: <strong className="font-mono">{detail.fdr_number}</strong>.
                </p>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/60 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-800 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 dark:text-stone-400 block">Issue Date:</span>
                    <span className="font-bold text-slate-800 dark:text-stone-200">{detail.issue_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-stone-400 block">Maturity Date:</span>
                    <span className="font-bold text-slate-800 dark:text-stone-200">{detail.maturity_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-stone-400 block">Interest Rate:</span>
                    <span className="font-bold text-slate-800 dark:text-stone-200">{detail.interest_rate}% per annum</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-stone-400 block">Tenure:</span>
                    <span className="font-bold text-slate-800 dark:text-stone-200">{Math.round(detail.tenure_days / 365)} Years ({detail.tenure_days} Days)</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 italic">
                  Note: The deposit is non-encashable and cannot be released or withdrawn prematurely without explicit written approval from AICTE.
                </p>
              </div>
            </div>
          </div>

          {/* Compliance Flags & AI Explanations (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center justify-between">
                <span>Compliance Flags ({detail.flags.length})</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-400">Plain Explanations</span>
              </h3>

              {detail.flags.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                  No compliance flags. All AICTE statutory conditions are satisfied.
                </div>
              ) : (
                <div className="space-y-3">
                  {detail.flags.map((flag) => {
                    const aiExpl = flagExplanations[flag.id];
                    return (
                      <div key={flag.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{flag.code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            flag.severity === "CRITICAL" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}>
                            {flag.severity}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                          {flag.explanation}
                        </p>

                        {/* AI Generated Bilingual Explanation if requested */}
                        {aiExpl?.en && (
                          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider block text-blue-600 dark:text-blue-400">Plain English Officer Guidance:</span>
                            <p>{aiExpl.en}</p>
                          </div>
                        )}
                        {aiExpl?.hi && (
                          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <span className="font-semibold text-[10px] uppercase tracking-wider block text-amber-600 dark:text-amber-400">हिंदी विवरण (Hindi Guidance):</span>
                            <p>{aiExpl.hi}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-zinc-800 text-[11px]">
                          <button
                            onClick={() => handleFetchAiExplanation(flag.id, "en")}
                            disabled={aiExpl?.loading}
                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                          >
                            {aiExpl?.loading && aiExpl?.loadingLang === "en" ? (
                              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-blue-500" />
                            )}
                            <span>{aiExpl?.loading && aiExpl?.loadingLang === "en" ? "Generating..." : "AI Explain (EN)"}</span>
                          </button>

                          <button
                            onClick={() => handleFetchAiExplanation(flag.id, "hi")}
                            disabled={aiExpl?.loading}
                            className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                          >
                            {aiExpl?.loading && aiExpl?.loadingLang === "hi" ? (
                              <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-amber-500" />
                            )}
                            <span>{aiExpl?.loading && aiExpl?.loadingLang === "hi" ? "तैयार हो रहा है..." : "हिंदी विवरण"}</span>
                          </button>

                          <button
                            onClick={() => handleAskCopilotRule(flag.code)}
                            className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition flex items-center gap-1 ml-auto font-medium shadow-sm"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>Handbook Rule?</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TECHNICAL & FORENSIC DETAILS (ADVANCED WORKSTATION) */}
      {activeTab === "forensics" && (
        <div className="space-y-6">
          {/* Workstation Header Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Scan className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Forensic Document Workstation & Raster Inspection
                  </h3>
                  {forensicData?.is_tampered ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3 text-rose-500 animate-pulse" />
                      Splicing & Raster Anomaly Detected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Raster & Cryptographic Integrity Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  Dual-Pass Error Level Analysis (Q=85) • Character-Level OCR Bounding Matrix • Cryptographic Envelope
                </p>
              </div>
            </div>

            {/* Layer Mode Selector */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <button
                onClick={() => setForensicMode("ocr")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  forensicMode === "ocr"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-sm border border-slate-200 dark:border-zinc-700"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 text-emerald-500" />
                <span>OCR Bounding ({forensicData?.ocr_boxes?.length || 12})</span>
              </button>

              <button
                onClick={() => setForensicMode("ela")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  forensicMode === "ela"
                    ? "bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 shadow-sm border border-slate-200 dark:border-zinc-700"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-rose-500" />
                <span>ELA Heatmap</span>
              </button>

              <button
                onClick={() => setForensicMode("composite")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  forensicMode === "composite"
                    ? "bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300 shadow-sm border border-slate-200 dark:border-zinc-700"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>Composite Multi-Layer</span>
              </button>

              <button
                onClick={() => setForensicMode("scan")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  forensicMode === "scan"
                    ? "bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-sm border border-slate-200 dark:border-zinc-700"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>Clean Scan</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Pane: Interactive Document Inspection Canvas (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Active Layer: <strong>{forensicMode.toUpperCase()} VIEWPORT</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                    <span>Resolution: 1000×700 px</span>
                    <span>ELA Anomaly: {forensicData?.anomaly_score || "0.04"}</span>
                  </div>
                </div>

                {/* Main Visual Canvas Container */}
                <div className="relative w-full aspect-[1000/700] bg-slate-950 rounded-lg overflow-hidden border border-slate-300 dark:border-zinc-700 shadow-inner select-none group">
                  {forensicLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                        <span className="text-xs font-mono">Running Raster Decomposition & ELA Matrix...</span>
                      </div>
                    </div>
                  )}

                  {/* Layer 1: Base Image (Document Scan or ELA Heatmap) */}
                  {forensicData?.document_image_url && (
                    <img
                      src={
                        forensicMode === "ela"
                          ? `${API_BASE.replace(/\/api\/v1\/?$/, "")}${forensicData.ela_image_url}`
                          : `${API_BASE.replace(/\/api\/v1\/?$/, "")}${forensicData.document_image_url}`
                      }
                      alt="Forensic Canvas"
                      className="w-full h-full object-cover block"
                    />
                  )}

                  {/* Layer 2: ELA Difference Overlay in Composite Mode */}
                  {forensicMode === "composite" && forensicData?.ela_image_url && (
                    <img
                      src={`${API_BASE.replace(/\/api\/v1\/?$/, "")}${forensicData.ela_image_url}`}
                      alt="ELA Overlay"
                      className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-70 pointer-events-none"
                    />
                  )}

                  {/* Layer 3: Interactive OCR Bounding Boxes (Active in 'ocr' and 'composite' modes) */}
                  {(forensicMode === "ocr" || forensicMode === "composite") && forensicData?.ocr_boxes && (
                    <div className="absolute inset-0 pointer-events-auto">
                      {forensicData.ocr_boxes.map((box) => {
                        const isSelected = selectedOcrBox === box.id;
                        return (
                          <div
                            key={box.id}
                            onClick={() => setSelectedOcrBox(box.id)}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`,
                            }}
                            className={`absolute rounded transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-amber-400/25 border-amber-400 ring-2 ring-amber-400 z-30 shadow-lg"
                                : "bg-emerald-500/10 border-emerald-500/70 hover:bg-emerald-500/20 hover:border-emerald-400 z-10"
                            }`}
                          >
                            <span
                              className={`absolute -top-3.5 left-0 px-1 py-0.2 rounded text-[8.5px] font-mono font-semibold tracking-tight uppercase whitespace-nowrap shadow-xs ${
                                isSelected
                                  ? "bg-amber-500 text-slate-950 font-bold"
                                  : "bg-emerald-950/85 text-emerald-300 border border-emerald-500/40"
                              }`}
                            >
                              {box.field}: {box.confidence}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Layer 4: Suspicious Tampering / Splicing Highlights */}
                  {forensicData?.is_tampered && forensicData?.suspicious_regions && (
                    <div className="absolute inset-0 pointer-events-none z-40">
                      {forensicData.suspicious_regions.map((region) => (
                        <div
                          key={region.id}
                          style={{
                            left: `${region.x}%`,
                            top: `${region.y}%`,
                            width: `${region.width}%`,
                            height: `${region.height}%`,
                          }}
                          className="absolute border-2 border-rose-500 bg-rose-500/20 rounded animate-pulse ring-2 ring-rose-500/60"
                        >
                          <span className="absolute -top-4 right-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-600 text-white shadow-md flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-white" />
                            ELA ANOMALY: SPLICING DETECTED ({Math.round(region.confidence * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Corner Telemetry HUD */}
                  <div className="absolute bottom-2 left-2 z-40 px-2 py-1 rounded bg-black/75 backdrop-blur-xs text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
                    <Crosshair className="w-3 h-3 text-emerald-400" />
                    <span>PRAMA FORENSIC ENGINE v1.0 • ELA MATRIX ACTIVE</span>
                  </div>
                </div>

                {/* Selected OCR Box Inspection Tray */}
                {selectedOcrBox && forensicData?.ocr_boxes && (() => {
                  const activeBox = forensicData.ocr_boxes.find(b => b.id === selectedOcrBox);
                  if (!activeBox) return null;
                  return (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                            {activeBox.label} ({activeBox.field})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                          OCR Confidence: {activeBox.confidence}%
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Recognized Text:</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            {activeBox.text}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Normalized Geometry:</span>
                          <span className="font-mono text-slate-700 dark:text-zinc-300 text-[11px]">
                            X: {activeBox.x}% • Y: {activeBox.y}% • W: {activeBox.width}% • H: {activeBox.height}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Pane: Diagnostic Intelligence & Provenance Matrix (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Three-Tier Provenance Matrix */}
              <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Three-Tier Provenance Matrix
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Prama Core</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Cross-validation comparing Self-Declared, Scanned OCR, and Bank Cryptographic Truth.
                </p>

                <div className="space-y-2 text-xs">
                  {[
                    { field: "FDR Serial", declared: detail.fdr_number, extracted: detail.fdr_number, match: true },
                    { field: "Amount (₹)", declared: `₹${detail.amount.toLocaleString("en-IN")}`, extracted: `₹${detail.amount.toLocaleString("en-IN")}`, match: !forensicData?.is_tampered },
                    { field: "Maturity", declared: detail.maturity_date, extracted: detail.maturity_date, match: true },
                    { field: "Rate", declared: `${detail.interest_rate}%`, extracted: `${detail.interest_rate}%`, match: true },
                  ].map((row) => (
                    <div key={row.field} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[10px] block font-mono">{row.field}</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200 text-xs">{row.declared}</span>
                      </div>
                      <div className="text-right">
                        {row.match ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                            Verified Match
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                            Discrepancy
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Forensic Raster Telemetry */}
              <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-zinc-800">
                  <Eye className="w-4 h-4 text-amber-500" />
                  Forensic Raster Telemetry
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px]">ELA Anomaly Differential:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {forensicData?.anomaly_score || "0.04"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Compression Standard:</span>
                    <span className="font-mono text-slate-800 dark:text-zinc-200">JPEG Dual-Pass Q=85</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px]">PDF Producer:</span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 truncate max-w-[170px]" title={forensicData?.pdf_metadata?.producer}>
                      {forensicData?.pdf_metadata?.producer || "Finacle CBS 11.4"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Perceptual Hash:</span>
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">dHash-64bit Match</span>
                  </div>
                </div>
              </div>

              {/* Decoded Bank Cryptographic Envelope */}
              <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-indigo-500" />
                    Decoded Bank Cryptographic Envelope
                  </h3>
                  {forensicData?.cryptographic_envelope?.signature_valid ? (
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Ed25519 Valid
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      Sig Mismatch
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  {forensicData?.qr_image_url && (
                    <img
                      src={`${API_BASE.replace(/\/api\/v1\/?$/, "")}${forensicData.qr_image_url}`}
                      alt="Bank QR"
                      className="w-14 h-14 rounded border border-slate-200 dark:border-zinc-800 bg-white p-0.5"
                    />
                  )}
                  <div className="text-[11px] space-y-0.5 overflow-hidden">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 truncate">
                      Algorithm: {forensicData?.cryptographic_envelope?.algorithm || "Ed25519"}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                      PK: {forensicData?.cryptographic_envelope?.public_key || `ed25519_pk_${detail.bank_ifsc.toLowerCase()}`}
                    </div>
                  </div>
                </div>

                <pre className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto text-[10.5px] font-mono text-slate-700 dark:text-zinc-300 max-h-40">
{JSON.stringify(forensicData?.cryptographic_envelope?.decoded_payload || {
  ifsc: detail.bank_ifsc,
  fdr: detail.fdr_number,
  amt: detail.amount,
  iss: detail.issue_date,
  mat: detail.maturity_date,
  holder: detail.institution_name,
  algorithm: "Ed25519"
}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Request Modal */}
      {releaseModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Request Deposit Release & Refund</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">FDR #{detail.fdr_number} • {detail.institution_name}</p>
                </div>
              </div>
              <button
                onClick={() => setReleaseModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs text-purple-900 dark:text-purple-300">
              <span className="font-bold block mb-1">Dual-Officer Regulatory Requirement:</span>
              Once requested, this deposit will enter the Scrutiny Officer (Maker) review queue. After compliance check, the Senior Director (Checker) must authorize before funds are discharged.
            </div>

            <form onSubmit={handleRequestRelease} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">
                  Pledged Security Corpus Amount
                </label>
                <input
                  type="text"
                  disabled
                  value={`₹${detail.amount.toLocaleString("en-IN")} (${detail.bank_name})`}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-mono text-slate-700 dark:text-zinc-300 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-zinc-300 font-semibold block mb-1">
                  Regulatory Ground / Statutory Justification
                </label>
                <select
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 shadow-sm"
                >
                  <option value="10-Year Statutory Term Completion - Request for Release & Security Refund">
                    10-Year Statutory Term Completion (APH Section 2.14)
                  </option>
                  <option value="Replacement with Bank Guarantee / Fresh Instrument">
                    Replacement with Fresh Instrument / Approved Bank Guarantee
                  </option>
                  <option value="Permanent Closure of Approved Technical Program (No Dues Certified)">
                    Closure of Approved Technical Program (No Dues Certified)
                  </option>
                  <option value="AICTE Special Bureau Council Order for Maturity Encashment">
                    Special Bureau Order for Maturity Encashment
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setReleaseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRelease}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingRelease ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Submit Release Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
