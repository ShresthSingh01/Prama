"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, ChevronRight, ChevronLeft, ShieldCheck, 
  FileText, CheckCircle2, UserCheck, AlertTriangle, 
  Sparkles, Landmark, Clock, ArrowRight
} from "lucide-react";
import PramaLogo from "./PramaLogo";

interface WalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalkthroughModal({ isOpen, onClose }: WalkthroughModalProps) {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const steps = [
    {
      title: "1. Upload & Instant Verification",
      subtitle: "Simple, automated ingestion of college FDR certificates",
      icon: FileText,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
      accent: "from-blue-600 to-indigo-600",
      content: (
        <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-300">
          <p>
            When a technical college or university submits a security deposit, they upload their Fixed Deposit Receipt (FDR) certificate PDF.
          </p>
          <div className="p-3 bg-slate-100 dark:bg-zinc-800/60 rounded-lg border border-slate-200 dark:border-zinc-700/60 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-100 font-medium text-xs">
              <Landmark className="w-4 h-4 text-blue-500" />
              <span>What Prama does automatically:</span>
            </div>
            <ul className="text-xs space-y-1 list-disc list-inside text-slate-600 dark:text-zinc-400">
              <li>Reads certificate details (Bank, FDR Number, Amount, Maturity Date).</li>
              <li>Decodes bank-signed QR codes to confirm genuine bank issuance.</li>
              <li>Checks image authenticity to ensure text or amounts were not digitally altered.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "2. AI Compliance & Policy Rules",
      subtitle: "Enforcing statutory AICTE Approval Process rules",
      icon: ShieldCheck,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
      accent: "from-emerald-600 to-teal-600",
      content: (
        <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-300">
          <p>
            Every deposit is evaluated against official AICTE Handbook regulations:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60">
              <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> 10-Year Lock-In
              </div>
              <p className="text-slate-500 dark:text-zinc-400">
                FDR must have at least 10 years tenure (or auto-renewal clause) without premature liquidation.
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60">
              <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Minimum Amount
              </div>
              <p className="text-slate-500 dark:text-zinc-400">
                Guarantees the required corpus (e.g. ₹15 Lakhs to ₹35 Lakhs depending on program category).
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60">
              <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <Landmark className="w-3.5 h-3.5 text-blue-500" /> Joint AICTE Account
              </div>
              <p className="text-slate-500 dark:text-zinc-400">
                Account must be pledged in the joint name of the Institute & the Regional Officer, AICTE.
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60">
              <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Whitelisted Bank
              </div>
              <p className="text-slate-500 dark:text-zinc-400">
                Only Scheduled Commercial Banks approved by the Reserve Bank of India are accepted.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "3. Plain-Language Discrepancy Alerts",
      subtitle: "Clear explanations in English & Hindi without technical jargon",
      icon: Sparkles,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      accent: "from-amber-600 to-orange-600",
      content: (
        <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-300">
          <p>
            When a deposit has a shortfall or issue, regulatory officers do not need to decipher cryptic error codes.
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Example Discrepancy Explanation</span>
            <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium">
              &quot;FDR amount submitted is ₹5,00,000, which is ₹10,00,000 below the mandatory ₹15,00,000 required for AICTE new institute approval. Action: Request the college to submit an additional deposit receipt.&quot;
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
              उपलब्ध विवरण: हिंदी और अंग्रेजी दोनों भाषाओं में स्पष्ट मार्गदर्शन ताकि कोई भी अधिकारी तुरंत समझ सके।
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "4. Dual-Officer Release Approval",
      subtitle: "Preventing accidental or fraudulent return of deposits",
      icon: UserCheck,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
      accent: "from-purple-600 to-indigo-600",
      content: (
        <div className="space-y-3 text-sm text-slate-600 dark:text-zinc-300">
          <p>
            When an institution completes its 10-year term and requests the return of its deposit, a strict 2-officer sign-off is enforced:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Scrutiny Officer (Reviewer):</span>
                <p className="text-slate-500 dark:text-zinc-400 mt-0.5">Verifies bank no-dues certificate, completion of tenure, and ensures no student complaints are pending.</p>
              </div>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800/60 rounded border border-slate-200 dark:border-zinc-700/60 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
              <div>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Senior Director (Approver):</span>
                <p className="text-slate-500 dark:text-zinc-400 mt-0.5">Performs final sign-off. The system cryptographically seals the release order in the immutable audit trail.</p>
              </div>
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
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
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
              <span className="text-[10px] font-bold tracking-tight text-slate-700 dark:text-zinc-300">Prama Tour</span>
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
        <div className="p-6 flex-1 min-h-[220px]">
          {step.content}
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
