"use client";

import React, { useState, useEffect } from "react";
import { 
  Lock, CheckCircle2, XCircle, ShieldAlert, 
  RotateCcw, Sparkles, AlertTriangle, ChevronRight, Hash
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
      // Re-verify immediately to trigger the alarm!
      await handleVerifyChain();
      window.dispatchEvent(new Event("auditUpdated"));
    } catch (e) {
      console.error(e);
    } finally {
      setSabotaging(false);
    }
  };

  useEffect(() => {
    loadAudit();
    handleVerifyChain();
  }, []);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            Tamper-Evident SHA-256 Audit Ledger
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cryptographic hash-chained append-only log. Every regulatory decision is sealed by the previous block's SHA-256 hash.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-md text-xs font-medium transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Verify Integrity ({total} Blocks)</span>
          </button>

          {selectedEntry && (
            <button
              onClick={handleSimulateSabotage}
              disabled={sabotaging}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-md text-xs font-medium transition"
              title="Simulates a rogue DBA tampering with this block via direct SQL injection"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Simulate Backdoor DB Sabotage</span>
            </button>
          )}
        </div>
      </div>

      {/* Verification Status Banner */}
      {verifyResult && (
        <div className={`p-4 rounded-lg border text-xs ${
          verifyResult.valid 
            ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300" 
            : "bg-rose-950/40 border-rose-500/60 text-rose-300 shadow-2xl shadow-rose-950/60 animate-pulse"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              {verifyResult.valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>CRYPTOGRAPHIC CHAIN INTEGRITY: 100% UNTOUCHED</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-500" />
                  <span>CRITICAL ALARM: AUDIT CHAIN TAMPERING DETECTED!</span>
                </>
              )}
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              Validated {verifyResult.total_entries || total} Blocks
            </span>
          </div>

          <p className="mt-1 text-xs text-zinc-300 font-mono">
            {verifyResult.valid ? verifyResult.message : verifyResult.reason}
          </p>

          {!verifyResult.valid && verifyResult.broken_at_id && (
            <div className="mt-2 p-2 bg-rose-900/30 border border-rose-500/40 rounded text-[11px] font-mono text-rose-200">
              TAMPER LOCATED AT BLOCK ID: #{verifyResult.broken_at_id}. The SHA-256 seal failed to match the recomputed hash of its canonical payload.
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Ledger Explorer + Block Payload Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Block Chain List */}
        <div className="lg:col-span-7 bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-2">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
            Audit Ledger Blocks (Most Recent First)
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {entries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              const isBroken = verifyResult && !verifyResult.valid && verifyResult.broken_at_id === entry.id;

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    isBroken ? "bg-rose-950/60 border-rose-500 text-white animate-bounce" :
                    isSelected ? "bg-zinc-800 border-emerald-500 text-white" :
                    "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                    <span className="text-emerald-400 font-bold">BLOCK #{entry.id}</span>
                    <span className="text-zinc-500">{entry.ts}</span>
                  </div>

                  <div className="flex items-center gap-2 font-semibold text-zinc-100">
                    <span>{entry.action}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({entry.entity_type} #{entry.entity_id})</span>
                  </div>

                  {/* Hash Chain Snippet */}
                  <div className="mt-2 space-y-0.5 font-mono text-[10px] text-zinc-500">
                    <div className="truncate">Prev: <span className="text-zinc-400">{entry.prev_hash}</span></div>
                    <div className="truncate">Hash: <span className="text-amber-400/90">{entry.hash}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 Cols: Block Detailed Canonical Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {selectedEntry ? (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                  <span>BLOCK #{selectedEntry.id}</span>
                  <span>{selectedEntry.ts}</span>
                </div>
                <h2 className="text-base font-bold text-white mt-1">{selectedEntry.action}</h2>
                <div className="text-xs text-zinc-400 font-mono">
                  Actor: User #{selectedEntry.actor_id || "SYSTEM"} ({selectedEntry.actor_role || "system"})
                </div>
              </div>

              {/* Hashes Detail */}
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Previous Block SHA-256</div>
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 text-[10px] break-all">
                    {selectedEntry.prev_hash}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-amber-500 uppercase">Current Block SHA-256 Seal</div>
                  <div className="p-2 bg-zinc-950 border border-amber-900/40 rounded text-amber-300 text-[10px] break-all">
                    {selectedEntry.hash}
                  </div>
                </div>
              </div>

              {/* Canonical Payload Viewer */}
              <div>
                <div className="text-[10px] text-zinc-400 uppercase font-mono mb-1">
                  Canonical JSON Payload:
                </div>
                <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded text-[11px] font-mono text-zinc-200 overflow-x-auto max-h-64">
                  {JSON.stringify(selectedEntry.payload, null, 2)}
                </pre>
              </div>

              <div className="p-3 bg-zinc-950 rounded border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="font-semibold text-zinc-200 text-[11px]">Cryptographic Proof Formula:</div>
                <div className="font-mono text-[10px] text-amber-400">
                  Hash = SHA256(prev_hash + CanonicalJSON(payload))
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-zinc-500 font-mono bg-zinc-900/60 border border-zinc-800 rounded-lg">
              Select an audit block to inspect payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
