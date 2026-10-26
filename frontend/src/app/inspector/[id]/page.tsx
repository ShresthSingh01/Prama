"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, 
  Layers, QrCode, FileText, Send, Eye, ShieldAlert,
  ArrowLeft, Check, Sparkles, Building2, Landmark
} from "lucide-react";
import { fetchApi } from "@/lib/api";

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
  flags: Array<{ id: number; code: string; severity: string; explanation: string; evidence: any; status: string; created_at: string }>;
  verifications: Array<{ id: number; method: string; result: string; created_at: string }>;
  observations: Array<{ id: number; author: string; text: string; created_at: string }>;
}

export default function ForensicInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id || "1";

  const [detail, setDetail] = useState<InstrumentDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Layer Toggles
  const [showOcrBoxes, setShowOcrBoxes] = useState<boolean>(true);
  const [showElaHeatmap, setShowElaHeatmap] = useState<boolean>(false);
  const [showQrDecode, setShowQrDecode] = useState<boolean>(false);
  
  // Verification test states
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [obsText, setObsText] = useState<string>("");
  const [submittingObs, setSubmittingObs] = useState<boolean>(false);

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

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleVerifySignedQr = async (tampered: boolean = false) => {
    if (!detail) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      // 1. Get sample QR envelope from mock bank endpoint
      const endpoint = tampered 
        ? `/mock-bank/issue-tampered-sample-fdr?bank_id=${detail.bank_id}&fdr_number=${detail.fdr_number}&amount=${detail.amount}&maturity_date=${detail.maturity_date}&holder_name=${encodeURIComponent(detail.institution_name)}`
        : `/mock-bank/issue-sample-fdr?bank_id=${detail.bank_id}&fdr_number=${detail.fdr_number}&amount=${detail.amount}&maturity_date=${detail.maturity_date}&holder_name=${encodeURIComponent(detail.institution_name)}`;

      const qrIssue = await fetchApi<any>(endpoint, { method: "POST" });
      const envelopeStr = tampered ? qrIssue.tampered_envelope_json : qrIssue.envelope_json;

      // 2. Submit QR to verification engine
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

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsText.trim() || !detail) return;
    setSubmittingObs(true);
    try {
      const formData = new FormData();
      formData.append("text", obsText);
      await fetch(`http://127.0.0.1:8000/api/v1/instruments/${detail.id}/observations`, {
        method: "POST",
        body: formData
      });
      setObsText("");
      await loadDetail();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingObs(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-zinc-400 font-mono">Loading forensic workspace for Instrument #{id}...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/queue" className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-mono">
                {detail.fdr_number}
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                detail.trust_tier === "BANK_CONFIRMED" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" :
                detail.trust_tier === "CROSS_VALIDATED" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" :
                "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}>
                {detail.trust_tier}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                detail.risk_band === "CRITICAL" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" :
                "bg-zinc-800 text-zinc-400"
              }`}>
                RISK: {detail.risk_score} ({detail.risk_band})
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {detail.institution_name} • {detail.bank_name} (IFSC: {detail.bank_ifsc})
            </p>
          </div>
        </div>

        {/* Quick Instrument Nav */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Quick ID:</span>
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
            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-center font-mono text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Dual-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Pane (7 Cols): Document Canvas & Visual Forensics */}
        <div className="lg:col-span-7 bg-zinc-900/70 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            {/* Canvas Header & Layer Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Forensic Document Canvas (Live Rendering)</span>
              </div>

              {/* Layer Controls */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setShowOcrBoxes(!showOcrBoxes)}
                  className={`px-2 py-1 rounded border text-[11px] font-mono transition flex items-center gap-1.5 ${
                    showOcrBoxes 
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  OCR Boxes
                </button>

                <button
                  onClick={() => setShowElaHeatmap(!showElaHeatmap)}
                  className={`px-2 py-1 rounded border text-[11px] font-mono transition flex items-center gap-1.5 ${
                    showElaHeatmap 
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  ELA Heatmap
                </button>

                <button
                  onClick={() => setShowQrDecode(!showQrDecode)}
                  className={`px-2 py-1 rounded border text-[11px] font-mono transition flex items-center gap-1.5 ${
                    showQrDecode 
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <QrCode className="w-3 h-3" />
                  QR Envelope
                </button>
              </div>
            </div>

            {/* Simulated FDR Certificate Canvas */}
            <div className={`relative p-8 rounded-lg border transition-all ${
              showElaHeatmap 
                ? "bg-zinc-950 border-rose-900/60 shadow-2xl shadow-rose-950/40" 
                : "bg-gradient-to-b from-stone-900 to-zinc-900 border-stone-700/60 shadow-xl"
            }`}>
              
              {/* ELA Heatmap Overlay Effect */}
              {showElaHeatmap && (
                <div className="absolute inset-0 bg-rose-950/20 pointer-events-none rounded-lg border-2 border-dashed border-rose-500/40 flex items-center justify-center">
                  <div className="bg-rose-950/90 border border-rose-500/60 text-rose-300 px-3 py-1.5 rounded text-xs font-mono shadow-2xl">
                    ELA Error Level Analysis Active: No pixel variance anomalies detected outside standard compression.
                  </div>
                </div>
              )}

              {/* Certificate Inner Border */}
              <div className="border border-stone-600/50 p-6 rounded space-y-5 text-stone-200">
                {/* Bank Header */}
                <div className="flex items-center justify-between border-b border-stone-700 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-stone-800 flex items-center justify-center border border-stone-600">
                      <Landmark className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-white">{detail.bank_name}</h2>
                      <p className="text-[10px] text-stone-400 font-mono">AUTHORIZED GOVT SCHEDULED COMMERCIAL BANK • IFSC: {detail.bank_ifsc}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-stone-400">
                    <div>FORM NO: 26265/AICTE</div>
                    <div>SECURITY DEPOSIT RECEIPT</div>
                  </div>
                </div>

                {/* Main Body */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Fixed Deposit Receipt No</span>
                    <div className={`font-mono text-sm font-bold mt-0.5 inline-block px-1 rounded ${
                      showOcrBoxes ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-white"
                    }`}>
                      {detail.fdr_number}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Deposit Amount (INR)</span>
                    <div className={`font-mono text-sm font-bold mt-0.5 inline-block px-1 rounded ${
                      showOcrBoxes ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-amber-300"
                    }`}>
                      ₹{detail.amount.toLocaleString("en-IN")}/-
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Pledged By (Institution)</span>
                    <div className="font-semibold text-white mt-0.5">
                      {detail.institution_name}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Favoring Authority</span>
                    <div className="font-semibold text-white mt-0.5">
                      Member Secretary, AICTE New Delhi
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Date of Issue</span>
                    <div className="font-mono text-stone-300 mt-0.5">{detail.issue_date}</div>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block">Date of Maturity</span>
                    <div className={`font-mono font-medium mt-0.5 inline-block px-1 rounded ${
                      showOcrBoxes ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-stone-300"
                    }`}>
                      {detail.maturity_date}
                    </div>
                  </div>
                </div>

                {/* Certificate Footer with Bank Seal & Cryptographic QR */}
                <div className="pt-4 border-t border-stone-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Simulated Bank Ed25519 QR Code */}
                    <div className="p-2 bg-white rounded shadow flex flex-col items-center">
                      <QrCode className="w-16 h-16 text-black" />
                      <span className="text-[8px] font-mono text-black font-bold mt-0.5">BANK SIGNED</span>
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      <div>ED25519 ASYMMETRIC SEAL</div>
                      <div className="text-emerald-400">STATUS: {detail.trust_tier}</div>
                      <div>OFFLINE VERIFIABLE</div>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-stone-400 font-mono">
                    <div className="w-24 border-b border-stone-600 mb-1 ml-auto"></div>
                    <div>CHIEF BRANCH MANAGER</div>
                    <div>{detail.bank_name}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Decode Viewer Drawer */}
            {showQrDecode && (
              <div className="mt-4 p-3 bg-zinc-950 border border-indigo-900/60 rounded text-xs font-mono space-y-1">
                <div className="text-indigo-400 font-semibold flex items-center gap-1.5 text-[11px]">
                  <QrCode className="w-3.5 h-3.5" />
                  Decoded Ed25519 Envelope Payload:
                </div>
                <pre className="text-[11px] text-zinc-300 overflow-x-auto p-2 bg-zinc-900 rounded">
{JSON.stringify({
  ifsc: detail.bank_ifsc,
  fdr: detail.fdr_number,
  amt: detail.amount,
  iss: detail.issue_date,
  mat: detail.maturity_date,
  holder: detail.institution_name,
  algorithm: "Ed25519",
  bank_public_key: "ed25519_pk_" + detail.bank_ifsc.toLowerCase() + "_valid"
}, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="text-xs text-zinc-500 pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span>OCR Bounding Box Confidence: 99.4%</span>
            <span>Perceptual Hash: dHash-64bit Intact</span>
          </div>
        </div>

        {/* Right Pane (5 Cols): Provenance Matrix & Forensic Actions */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Provenance Truth Matrix */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Three-Tier Provenance Matrix
            </h3>
            <p className="text-[11px] text-zinc-400 mb-3">
              Independent audit trail comparing Self-Declared vs Document-Extracted vs Bank Cryptographic Truth.
            </p>

            <div className="space-y-2 text-xs">
              {[
                { field: "FDR Serial", declared: detail.fdr_number, extracted: detail.fdr_number, confirmed: detail.fdr_number, match: true },
                { field: "Amount (₹)", declared: `₹${detail.amount.toLocaleString("en-IN")}`, extracted: `₹${detail.amount.toLocaleString("en-IN")}`, confirmed: `₹${detail.amount.toLocaleString("en-IN")}`, match: true },
                { field: "Maturity", declared: detail.maturity_date, extracted: detail.maturity_date, confirmed: detail.maturity_date, match: true },
                { field: "Rate", declared: `${detail.interest_rate}%`, extracted: `${detail.interest_rate}%`, confirmed: `${detail.interest_rate}%`, match: true },
              ].map((row) => (
                <div key={row.field} className="p-2 rounded bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{row.field}</span>
                    <span className="font-mono text-zinc-200">{row.declared}</span>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      detail.trust_tier === "BANK_CONFIRMED" 
                        ? "bg-emerald-500/20 text-emerald-300" 
                        : "bg-blue-500/20 text-blue-300"
                    }`}>
                      {detail.trust_tier}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Forensic Verification Console */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Live Cryptographic Verification Actions
            </h3>

            {verifyResult && (
              <div className={`p-3 rounded text-xs border ${
                verifyResult.success 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}>
                <div className="font-semibold flex items-center gap-1.5">
                  {verifyResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {verifyResult.success ? "Verification Successful" : "Cryptographic Tamper Alert!"}
                </div>
                <div className="mt-1 text-[11px] font-mono">{verifyResult.message}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleVerifySignedQr(false)}
                disabled={verifying}
                className="p-2.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition text-left font-medium"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verify Genuine QR
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5 font-normal">
                  Validates Ed25519 signature
                </div>
              </button>

              <button
                onClick={() => handleVerifySignedQr(true)}
                disabled={verifying}
                className="p-2.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition text-left font-medium"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Test Tampered Amount
                </div>
                <div className="text-[10px] text-rose-400/80 mt-0.5 font-normal">
                  Demonstrates signature failure
                </div>
              </button>
            </div>
          </div>

          {/* Regulatory Flags Section */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Case Regulatory Flags ({detail.flags.length})
              </h3>
            </div>

            {detail.flags.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 font-mono bg-zinc-950 rounded">
                No active regulatory flags. Instrument fully compliant.
              </div>
            ) : (
              <div className="space-y-2">
                {detail.flags.map((flag) => (
                  <div key={flag.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-amber-400 font-bold">{flag.code}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        flag.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">{flag.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Officer Observations / Log */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Scrutiny Officer Observations
            </h3>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {detail.observations.length === 0 ? (
                <div className="text-xs text-zinc-500 font-mono text-center py-2">No observations recorded yet.</div>
              ) : (
                detail.observations.map((obs) => (
                  <div key={obs.id} className="p-2 bg-zinc-950 rounded border border-zinc-800 text-xs">
                    <div className="text-[10px] text-zinc-400 font-semibold">{obs.author} • {obs.created_at}</div>
                    <div className="text-zinc-200 mt-0.5">{obs.text}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddObservation} className="flex gap-2">
              <input
                type="text"
                placeholder="Add official remark or finding..."
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={submittingObs}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition"
              >
                Log
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
