"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { 
  X, ChevronRight, ChevronLeft, ShieldCheck, 
  FileText, Clock, ArrowRight, Network, Lock,
  BarChart3, ExternalLink
} from "lucide-react";
import PramaLogo from "./PramaLogo";

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalkthroughModal({ isOpen, onClose }: WalkthroughModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  const steps = [
    {
      title: "1. Executive Cockpit & Maturity Radar",
      subtitle: "Consolidated regulatory oversight across 600+ technical institutions",
      icon: BarChart3,
      page: "/",
      pageName: "Executive Dashboard",
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Replaces fragmented clerical spreadsheets with a unified financial security cockpit calculating <strong>₹84.5+ Cr</strong> in active security cover across India.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">Four-Tier Provenance</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Separates applicant claims (Self-Declared) from verified evidence (Doc-Extracted, Cross-Validated, Bank-Confirmed).
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">24-Month Horizon Radar</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Identifies seasonal renewal cliffs and overdue risks months before instruments expire.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "2. Bank Gateway Simulation & Digital Intake",
      subtitle: "Standardized prefill with verified bank signatures and fraud test scenarios",
      icon: FileText,
      page: "/submit",
      pageName: "New Deposit Page",
      color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Institutions register digital e-FDR credentials and attach original receipts and statutory Affidavit 6 compliance records.
          </p>
          <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60 space-y-1.5">
            <span className="font-semibold text-slate-900 dark:text-white block">Preconfigured Prototype Evaluation Scenarios:</span>
            <ul className="space-y-1 list-disc list-inside text-[11px] text-slate-600 dark:text-zinc-400">
              <li><strong>Case 1 (Genuine):</strong> State Bank of India 10-Yr compliant deposit with valid Ed25519 signature.</li>
              <li><strong>Case 2 (Tampered Fraud):</strong> Claimed ₹50L, but bank signed ₹5L — triggers cryptographic alarm.</li>
              <li><strong>Case 3 (Tenure Anomaly):</strong> 3-year maturity violating statutory 8–10 year lock-in (Rule R02).</li>
              <li><strong>Case 4 (Below Minimum):</strong> ₹2.5L deposit failing AICTE statutory floor (Rule R01).</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "3. Document Scrutiny Desk & QR Authenticator",
      subtitle: "Rapid offline bank verification and digital image alteration detection",
      icon: ShieldCheck,
      page: "/inspector/1",
      pageName: "Scrutiny Desk",
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Synchronized workspace for Scrutiny Officers inspecting documents side-by-side with automated regulatory checks.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">Document Alteration Detection (ELA)</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Heatmaps reveal digital recompression discrepancies where amounts or dates were edited in PDF editors.
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">12ms Offline Ed25519 QR</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Mathematical proof of authenticity without requiring commercial bank network access.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "4. Duplicate FDR & Syndicate Collusion Detection",
      subtitle: "Interactive mapping of cross-institution duplicate FDR pledges",
      icon: Network,
      page: "/graph",
      pageName: "Duplicate & Fraud Map",
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            While traditional audits inspect applications in isolation, Prama builds an interactive network linking institutions, FDR numbers, banks, and binary document hashes.
          </p>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/40 rounded-lg space-y-1">
            <span className="font-semibold text-rose-800 dark:text-rose-300 block">Live Collusion Alert in Seed Data:</span>
            <p className="text-[11px] text-rose-700 dark:text-rose-400">
              Exposes 4 colleges across Maharashtra and Gujarat all pledging the duplicate FDR serial <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">SBIN/2026/APEX-SYNDICATE-99214</code> to cheat AICTE approval norms.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "5. Regulation Time Machine & Cliff Radar",
      subtitle: "Simulate future calendar dates to test automated escalations and renewals",
      icon: Clock,
      page: "/",
      pageName: "Time Machine Engine",
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Located right in the top navigation bar, the Time Machine lets evaluators fast-forward system time by <strong>+30d, +60d, or +90d</strong> with zero database corruption.
          </p>
          <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60 space-y-1.5">
            <span className="font-semibold text-slate-900 dark:text-white block">Automated Regulatory Escalation:</span>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              As instruments enter T-90, T-60, and T-30 maturity windows, bilingual (Hindi/English) reminder notifications fire and overdue records are automatically routed to Bureau Directors.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "6. Maker-Checker Release & Tamper-Proof Audit",
      subtitle: "Strict separation of duties, printable PDF certificates, and SHA-256 ledger",
      icon: Lock,
      page: "/release",
      pageName: "Release Portal & Audit Trail",
      color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
          <p>
            Ensures that no single official can unilaterally release funds or falsify records.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">AICTE Clause 6.46 Gate</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                5-point automated checklist blocks release until all clearances and dual-officer approvals are satisfied.
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60">
              <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">Live Sabotage Alarm</span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Simulate rogue SQL database edits in <code className="font-mono text-[10px]">/audit</code> — watch the SHA-256 hash chain instantly sound a red alarm.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${step.color}`}>
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                {step.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {step.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
              <PramaLogo size="xs" variant="icon" />
              <span className="text-[10px] font-bold tracking-tight text-slate-700 dark:text-zinc-300">
                {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-lg transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 min-h-[200px]">
          {step.content}

          {/* Quick Jump Link */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Live feature in prototype:</span>
            <button
              onClick={() => navigateTo(step.page)}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <span>Open {step.pageName}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Footer / Navigation Controls */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  currentStep === idx 
                    ? "w-6 bg-amber-500" 
                    : "w-2 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400 dark:hover:bg-zinc-600"
                }`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-1.5 border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg text-xs transition flex items-center gap-1 shadow-sm"
              >
                Next Step
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <span>Ready to Explore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
