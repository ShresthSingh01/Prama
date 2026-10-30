"use client";

import React, { useState, useEffect } from "react";
import { 
  Lock, CheckCircle2, XCircle, ShieldAlert, 
  Sparkles, Hash, HelpCircle, ShieldCheck
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface AuditEntry {
  id: number;
  ts: string;
  action: string;
  entity_type: string;
  entity_id: number;
  actor_id?: number;
  actor_role?: string;
  prev_hash: string;
  hash: string;
  payload: any;
}

interface AuditVerifyResult {
  valid: boolean;
  total_entries?: number;
  broken_at_id?: number;
  reason?: string;
  message?: string;
}

export default function AuditLedgerPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [sabotaging, setSabotaging] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<{ total: number; entries: AuditEntry[] }>("/audit?limit=40");
      setEntries(data.entries);
      setTotal(data.total);
      if (data.entries.length > 0 && !selectedEntry) {
        setSelectedEntry(data.entries[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetchApi<AuditVerifyResult>("/audit/verify");
      setVerifyResult(res);
    } catch (e: any) {
      setVerifyResult({ valid: false, reason: e.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulateSabotage = async () => {
    if (!selectedEntry) return;
    setSabotaging(true);
    try {
      await fetchApi<any>(`/audit/sabotage?entry_id=${selectedEntry.id}`, { method: "POST" });
      await loadAudit();
      await handleVerifyChain();
      window.dispatchEvent(new Event("auditUpdated"));
    } catch (e) {
      console.error(e);
    } finally {
      setSabotaging(false);
    }
  };

  const handleRestoreChain = async () => {
    setRestoring(true);
    try {
      await fetchApi<any>("/audit/restore", { method: "POST" });
      await loadAudit();
      await handleVerifyChain();
      window.dispatchEvent(new Event("auditUpdated"));
    } catch (e) {
      console.error(e);
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    loadAudit();
    handleVerifyChain();
  }, []);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-500" />
            Tamper-Proof Audit Trail (Cryptographic Log)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Every regulatory scrutiny action, clock change, and release order is cryptographically sealed in an append-only hash chain.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Verify Audit Integrity ({total} Blocks)</span>
          </button>

          {selectedEntry && (
            <button
              onClick={handleSimulateSabotage}
              disabled={sabotaging}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs font-semibold transition shadow-sm"
              title="Simulates an unauthorized backdoor change to prove the audit chain detects it"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Simulate DB Sabotage Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Verification Status Banner with Cryptographic Health Orb */}
      {verifyResult && (
        <div className={`p-4 rounded-xl border text-xs shadow-sm transition-all ${
          verifyResult.valid 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-500/40 dark:text-emerald-300 animate-pulse-glow" 
            : "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/60 dark:text-rose-300 shadow-xl animate-shake animate-pulse-glow-red"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-sm font-bold">
              <div className={`w-3.5 h-3.5 rounded-full ${verifyResult.valid ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"}`}></div>
              {verifyResult.valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>AUDIT INTEGRITY: 100% UNTOUCHED & AUTHENTIC</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>CRITICAL SECURITY ALARM: UNAUTHORIZED LEDGER MODIFICATION DETECTED!</span>
                </>
              )}
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
              Verified {verifyResult.total_entries || total} Chain Blocks from Genesis
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-700 dark:text-zinc-300 font-mono">
            {verifyResult.valid ? verifyResult.message : verifyResult.reason}
          </p>

          {!verifyResult.valid && verifyResult.broken_at_id && (
            <div className="mt-2.5 p-2.5 bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-500/40 rounded-lg text-[11px] font-mono text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                TAMPER LOCATED AT BLOCK ID: #{verifyResult.broken_at_id}. The stored SHA-256 seal failed to match the recomputed hash of its canonical data.
              </div>
              <button
                onClick={handleRestoreChain}
                disabled={restoring}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold transition shadow shrink-0 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{restoring ? "Reconciling..." : "Reconcile & Restore Chain"}</span>
              </button>
            </div>
          )}

          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 text-[11px] text-slate-500 dark:text-zinc-400">
            <strong>PS 26265 Statutory Compliance Guarantee:</strong> Standard SQL database tables can be silently altered by database admins. Prama locks each action to the previous block via sequential SHA-256 hashes (Hash[N] = SHA256(Hash[N-1] + Payload)), producing mathematical proof of non-repudiation.
          </div>
        </div>
      )}

      {/* Main Grid: Ledger Explorer + Block Payload Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Block Chain List */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-2">
            Audit Records (Most Recent Actions First)
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {entries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              const isBroken = verifyResult && !verifyResult.valid && verifyResult.broken_at_id === entry.id;

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isBroken ? "bg-rose-100 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:text-white animate-pulse-glow-red" :
                    isSelected ? "bg-amber-50 border-amber-400 dark:bg-zinc-800 dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm" :
                    "bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">BLOCK #{entry.id}</span>
                    <span className="text-slate-500 dark:text-zinc-400">{entry.ts}</span>
                  </div>

                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-zinc-100">
                    <span>{entry.action}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono font-normal">({entry.entity_type} #{entry.entity_id})</span>
                  </div>

                  {/* Hash Chain Snippet */}
                  <div className="mt-2 space-y-0.5 font-mono text-[10px] text-slate-500 dark:text-zinc-500">
                    <div className="truncate">Prev: <span className="text-slate-600 dark:text-zinc-400">{entry.prev_hash}</span></div>
                    <div className="truncate">Hash: <span className="text-amber-700 dark:text-amber-400/90 font-semibold">{entry.hash}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Block Detailed Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {selectedEntry ? (
            <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-zinc-400">
                  <span className="font-semibold">BLOCK #{selectedEntry.id}</span>
                  <span>{selectedEntry.ts}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">{selectedEntry.action}</h2>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                  Actor: User #{selectedEntry.actor_id || "SYSTEM"} ({selectedEntry.actor_role || "system"})
                </div>
              </div>

              {/* Hashes Detail */}
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Previous Block SHA-256</div>
                  <div className="p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-700 dark:text-zinc-300 text-[10px] break-all">
                    {selectedEntry.prev_hash}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-semibold">Current Block Cryptographic Seal</div>
                  <div className="p-2 bg-slate-50 dark:bg-zinc-950 border border-amber-300 dark:border-amber-900/40 rounded-lg text-amber-800 dark:text-amber-300 text-[10px] break-all font-bold">
                    {selectedEntry.hash}
                  </div>
                </div>
              </div>

              {/* Canonical Payload Viewer */}
              <div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-mono font-semibold mb-1">
                  Recorded Event Details:
                </div>
                <pre className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-mono text-slate-800 dark:text-zinc-200 overflow-x-auto max-h-64">
                  {JSON.stringify(selectedEntry.payload, null, 2)}
                </pre>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px]">How the Tamper-Evident Seal Works:</div>
                <div className="font-mono text-[10px] text-amber-700 dark:text-amber-400">
                  Hash = SHA256(prev_hash + CanonicalJSON(payload))
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                  If any record is altered in the database, the cryptographic hash breaks immediately, sounding an alert.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
              Select an audit block to inspect its details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
