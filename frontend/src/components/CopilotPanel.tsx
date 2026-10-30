"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X, Send, BookOpen, AlertCircle,
  FileText, ShieldCheck, ChevronRight,
  MessageSquare, ArrowUpRight
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import PramaLogo from "./PramaLogo";

interface CitationItem {
  doc_title: string;
  section: string;
  pages: string;
  quote: string;
}

interface CopilotResponse {
  answer: string;
  citations: CitationItem[];
  knowledge_refs: string[];
  confidence_note: string;
  advisory: boolean;
}

interface CopilotPanelProps {
  initialQuestion?: string;
  instrumentId?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function CopilotPanel({
  initialQuestion = "",
  instrumentId,
  isOpen,
  onClose
}: CopilotPanelProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>(initialQuestion);
  const [submittedQuery, setSubmittedQuery] = useState<string>(initialQuestion);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When initialQuestion changes and panel is open, trigger search
  useEffect(() => {
    if (isOpen && initialQuestion) {
      setQuestion(initialQuestion);
      setSubmittedQuery(initialQuestion);
      handleAsk(initialQuestion);
    }
  }, [isOpen, initialQuestion]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleAsk = async (qText?: string) => {
    const q = (qText || question).trim();
    if (!q) return;

    setSubmittedQuery(q);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<CopilotResponse>("/copilot/ask", {
        method: "POST",
        body: JSON.stringify({
          question: q,
          instrument_id: instrumentId || null
        })
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed to query Copilot. Please check your network or try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const quickChips = [
    "What are deposit release preconditions?",
    "Minimum deposit for Engineering college?",
    "Penal action for duplicate FDR serials?",
    "What is the renewal reminder schedule?"
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
      {/* Full-screen Dimmed Backdrop (Click to close) */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full max-h-screen text-xs text-slate-800 dark:text-zinc-100 z-50 animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <PramaLogo size="sm" variant="icon" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>Prama Copilot</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  AICTE Handbook
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">Clause & Section Level Statutory Grounding</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            title="Close Copilot (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Advisory Notice Banner */}
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Statutory Grounding: Answers directly cite official AICTE Approval Process regulations.</span>
        </div>

        {/* Scrollable Chat / Answers Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
          
          {/* User's Submitted Query Bubble */}
          {submittedQuery && (
            <div className="flex items-start gap-2 justify-end">
              <div className="max-w-[85%] bg-amber-500/15 text-slate-900 dark:text-amber-200 border border-amber-500/30 p-3 rounded-2xl rounded-tr-sm text-xs font-medium shadow-sm">
                <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>Your Regulatory Query</span>
                </div>
                {submittedQuery}
              </div>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-8 space-y-3 text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <span className="font-semibold text-xs text-slate-700 dark:text-zinc-200 block">Synthesizing Answer from AICTE Regulations</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">Retrieving exact chapters, clauses, and page citations...</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-800 rounded-xl text-rose-800 dark:text-red-300 space-y-2">
              <div className="font-semibold text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Copilot Inquiry Error</span>
              </div>
              <p className="text-xs">{error}</p>
              <button
                onClick={() => handleAsk(submittedQuery)}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition"
              >
                Retry Query
              </button>
            </div>
          )}

          {/* Response Presentation */}
          {result && !loading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Answer Box */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-700/80 rounded-xl space-y-2.5 shadow-sm">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Regulatory Answer</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Verified Grounding
                  </span>
                </div>
                <p className="text-slate-800 dark:text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap">
                  {result.answer}
                </p>
                {result.confidence_note && (
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 italic pt-1 border-t border-slate-200/60 dark:border-zinc-800">
                    {result.confidence_note}
                  </div>
                )}
              </div>

              {/* Exact Document Citations */}
              {result.citations && result.citations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>Statutory Citations ({result.citations.length})</span>
                  </div>
                  <div className="space-y-2">
                    {result.citations.map((c, i) => (
                      <div
                        key={i}
                        className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-blue-900 dark:text-blue-200">
                            {c.section}
                          </span>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                            Page {c.pages}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {c.doc_title}
                        </div>
                        {c.quote && (
                          <blockquote className="p-2.5 bg-slate-50 dark:bg-zinc-900/90 rounded-md border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-700 dark:text-zinc-300 italic">
                            &quot;{c.quote}&quot;
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge Policies Cross-References */}
              {result.knowledge_refs && result.knowledge_refs.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Related Platform Rules:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.knowledge_refs.map((ref, i) => (
                      <Link
                        key={i}
                        href="/knowledge"
                        onClick={onClose}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-amber-300 font-mono text-[11px] flex items-center gap-1 border border-slate-200 dark:border-zinc-700 transition"
                      >
                        <span>{ref}</span>
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Cryptographic Audit Trail Log Confirmation */}
              <div className="p-2.5 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Query & citations recorded to immutable SHA-256 audit ledger.</span>
              </div>
            </div>
          )}

          {/* Quick Suggestions (Shown if no result or as options) */}
          <div className="pt-2">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 mb-2 tracking-wider">Common Regulatory Questions</div>
            <div className="flex flex-col gap-1.5">
              {quickChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuestion(chip);
                    handleAsk(chip);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs transition text-left flex items-center justify-between group"
                >
                  <span>{chip}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Fixed Query Input Box */}
        <div className="p-3 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask any AICTE regulation or deposit rule question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500 shadow-sm"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg transition shadow-sm shrink-0"
              title="Submit Query"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
