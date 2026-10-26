"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ShieldCheck, Clock, RotateCcw, 
  BarChart3, ListFilter, Network, FileCheck2, FileText, Activity,
  Lock, CheckCircle2, XCircle, BookOpen, Sparkles, Sun, Moon,
  HelpCircle
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useTheme } from "./ThemeProvider";
import CopilotPanel from "./CopilotPanel";
import WalkthroughModal from "./WalkthroughModal";
import PramaLogo from "./PramaLogo";

export default function Navigation() {
  const pathname = usePathname();
  const { toggleTheme, isDark } = useTheme();

  const [clockData, setClockData] = useState<{ offset_days: number; simulated_date: string }>({
    offset_days: 0,
    simulated_date: "2026-10-26"
  });
  const [auditValid, setAuditValid] = useState<boolean>(true);
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>("maker");
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string>("");
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);

  const refreshClock = async () => {
    try {
      const data = await fetchApi<{ offset_days: number; simulated_date: string }>("/demo/status");
      setClockData(data);
    } catch {
      // Backend starting or silent
    }
  };

  const refreshAudit = async () => {
    try {
      const audit = await fetchApi<{ valid: boolean }>("/audit/verify");
      setAuditValid(audit.valid);
    } catch {}
  };

  useEffect(() => {
    refreshClock();
    refreshAudit();
    const interval = setInterval(refreshClock, 10000);
    const handleUpdate = () => {
      refreshClock();
      refreshAudit();
    };
    const handleOpenCopilot = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.question) {
        setCopilotQuestion(detail.question);
      }
      setCopilotOpen(true);
    };
    window.addEventListener("clockUpdated", handleUpdate);
    window.addEventListener("auditUpdated", handleUpdate);
    window.addEventListener("openCopilot", handleOpenCopilot);
    return () => {
      clearInterval(interval);
      window.removeEventListener("clockUpdated", handleUpdate);
      window.removeEventListener("auditUpdated", handleUpdate);
      window.removeEventListener("openCopilot", handleOpenCopilot);
    };
  }, []);

  const handleAdvance = async (days: number) => {
    setAdvancing(true);
    try {
      await fetchApi("/demo/advance-clock", {
        method: "POST",
        body: JSON.stringify({ days })
      });
      await refreshClock();
      window.dispatchEvent(new Event("clockUpdated"));
    } catch (e) {
      console.error(e);
    } finally {
      setAdvancing(false);
    }
  };

  const handleReset = async () => {
    setAdvancing(true);
    try {
      await fetchApi("/demo/reset-clock", { method: "POST" });
      await refreshClock();
      window.dispatchEvent(new Event("clockUpdated"));
    } catch (e) {
      console.error(e);
    } finally {
      setAdvancing(false);
    }
  };

  // Plain-Language Navigation Items
  const navItems = [
    { label: "Dashboard", href: "/", icon: BarChart3, desc: "Overview & key metrics" },
    { label: "Action Queue", href: "/queue", icon: ListFilter, desc: "FDRs needing review" },
    { label: "Deposit Inspector", href: "/inspector/1", icon: ShieldCheck, desc: "Certificate & AI analysis" },
    { label: "Release Approvals", href: "/release", icon: FileCheck2, desc: "Dual-officer approval" },
    { label: "Risk Network", href: "/graph", icon: Network, desc: "Visual fraud detection map" },
    { label: "Rules & Policies", href: "/knowledge", icon: BookOpen, desc: "AICTE regulations" },
    { label: "Audit Trail", href: "/audit", icon: Lock, desc: "Tamper-proof logs" },
    { label: "System Quality", href: "/evaluation", icon: Activity, desc: "Accuracy benchmarks" },
    { label: "New Deposit", href: "/submit", icon: FileText, desc: "Register certificate" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Regulatory Intelligence Bar */}
      <div className="px-4 py-1.5 bg-slate-100/90 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold tracking-wide text-slate-800 dark:text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AICTE SECURITY DEPOSIT BUREAU
            <span className="text-slate-400 dark:text-zinc-500 font-normal">| Prama</span>
          </div>
          
          {/* Simulated Time Machine Controls */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="text-slate-500 dark:text-zinc-400">Date:</span>
            <span className="font-mono font-medium text-amber-600 dark:text-amber-300">{clockData.simulated_date}</span>
            {clockData.offset_days > 0 && (
              <span className="text-[10px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 rounded font-semibold">
                +{clockData.offset_days}d
              </span>
            )}
            
            <div className="h-3 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5"></div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleAdvance(30)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded text-[11px] font-mono transition"
                title="Advance clock 30 days to test near-maturity alerts"
              >
                +30d
              </button>
              <button 
                onClick={() => handleAdvance(60)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded text-[11px] font-mono transition"
                title="Advance clock 60 days"
              >
                +60d
              </button>
              <button 
                onClick={() => handleAdvance(90)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-amber-500/10 dark:bg-amber-600/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-[11px] font-mono transition font-medium"
                title="Advance clock 90 days to test overdue policies"
              >
                +90d
              </button>
              {clockData.offset_days > 0 && (
                <button 
                  onClick={handleReset}
                  disabled={advancing}
                  className="px-1.5 py-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                  title="Reset clock to today"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Status Items & Controls */}
        <div className="flex items-center gap-3">
          {/* Security Status Badge */}
          <Link 
            href="/audit" 
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 shadow-sm transition hover:border-slate-300 dark:hover:border-zinc-600"
            title="Click to view tamper-evident audit history"
          >
            {auditValid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">Audit Integrity: Verified</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono text-[11px]">Audit Break Detected!</span>
              </>
            )}
          </Link>

          {/* User Role */}
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
            <span className="text-[11px]">Role:</span>
            <select 
              value={activeRole} 
              onChange={(e) => setActiveRole(e.target.value)}
              className="bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded px-2 py-0.5 text-xs focus:outline-none shadow-sm"
            >
              <option value="maker">Scrutiny Officer (Reviewer)</option>
              <option value="checker">Senior Director (Approver)</option>
              <option value="institute">Institution Registrar</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-amber-500 dark:hover:text-amber-400 transition shadow-sm"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Primary Navigation Row */}
      <nav className="px-4 md:px-6 py-2 flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-zinc-800/60">
        {/* Left: Brand Logo */}
        <div className="flex items-center shrink-0">
          <Link href="/" className="flex items-center shrink-0">
            <PramaLogo size="sm" variant="full" />
          </Link>
        </div>

        {/* Center: Scrollable Navigation Links (Isolated Flex Area) */}
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                  isActive 
                    ? "bg-amber-500/15 text-amber-800 dark:bg-zinc-800 dark:text-white border border-amber-500/30 dark:border-zinc-700 shadow-sm" 
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
                title={item.desc}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {/* Quick Walkthrough Button */}
          <button
            onClick={() => setWalkthroughOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition shadow-sm whitespace-nowrap"
            title="How Prama Works"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="hidden sm:inline">How It Works</span>
          </button>

          {/* Compliance Copilot Button */}
          <button
            onClick={() => setCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-amber-500/10 transition whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>AI Copilot</span>
          </button>
        </div>
      </nav>

      {/* Global Copilot Sidecar Drawer */}
      <CopilotPanel
        isOpen={copilotOpen}
        initialQuestion={copilotQuestion}
        onClose={() => {
          setCopilotOpen(false);
          setCopilotQuestion("");
        }}
      />

      {/* Interactive Walkthrough Modal */}
      <WalkthroughModal
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />
    </header>
  );
}
