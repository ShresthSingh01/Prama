"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  FileSpreadsheet, Download, X, Clock, AlertTriangle, 
  FileText
} from "lucide-react";
import { API_BASE } from "@/lib/api";

interface StatutoryReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReportItem {
  id: string;
  title: string;
  regulationRef: string;
  description: string;
  endpoint: string;
  icon: any;
  color: string;
}

const STATUTORY_REPORTS: ReportItem[] = [
  {
    id: "pending-verifications",
    title: "Pending Bank Verifications Register",
    regulationRef: "AICTE PS 26265 Item 3 & 8 • Trust Provenance Audit",
    description: "Export all deposits in Self-Declared or Doc-Extracted tiers awaiting official bank cryptographic QR confirmation or nodal officer link verification.",
    endpoint: "pending-verifications",
    icon: Clock,
    color: "blue"
  },
  {
    id: "upcoming-maturities",
    title: "Upcoming Maturities & Expiry Schedule",
    regulationRef: "AICTE APH Chapter 5 • 30/60/90-Day Renewal Monitoring",
    description: "Export comprehensive expiry schedules of all institutional FDRs maturing within 90 days to prevent lapses in mandatory security cover.",
    endpoint: "upcoming-maturities",
    icon: FileSpreadsheet,
    color: "amber"
  },
  {
    id: "missing-documents",
    title: "Missing Documents & Deficiency Register",
    regulationRef: "AICTE APH Clause 6.46 • Statutory Record Completeness",
    description: "Export technical institutions lacking mandatory FDR physical receipt copies, bank confirmation letters, or joint lien mark certifications.",
    endpoint: "missing-documents",
    icon: FileText,
    color: "rose"
  },
  {
    id: "unresolved-flags",
    title: "Unresolved Scrutiny Flags & Collusion Register",
    regulationRef: "AICTE PS 26265 Item 8 • Risk & Forgery Intervention",
    description: "Export all open High and Critical severity scrutiny flags, including cross-institution duplicate FDR numbers, tenure errors, and signature failures.",
    endpoint: "intervention-cases",
    icon: AlertTriangle,
    color: "red"
  }
];

export default function StatutoryReportsModal({ isOpen, onClose }: StatutoryReportsModalProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const handleDownload = async (report: ReportItem) => {
    setDownloadingId(report.id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/reports/${report.endpoint}?format=csv`, { headers });
      if (!res.ok) throw new Error("Failed to download statutory report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aicte_${report.endpoint}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  PS 26265 Capability 8
                </span>
                <span className="text-xs text-slate-400">Regulation Bureau CSV Export</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Statutory Management Reports & Registers
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
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Export official regulatory audit registers generated live from verified institutional database records. 
            All reports conform to AICTE Approval Process Handbook (APH) compliance requirements.
          </p>

          <div className="space-y-3">
            {STATUTORY_REPORTS.map((report) => {
              const Icon = report.icon;
              return (
                <div
                  key={report.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-300 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {report.regulationRef}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {report.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(report)}
                    disabled={downloadingId === report.id}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingId === report.id ? "Exporting..." : "Download CSV"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between text-xs text-slate-500">
          <span>Format: RFC 4180 Standard CSV (UTF-8)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

