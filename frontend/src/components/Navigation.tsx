"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Clock, RotateCcw, 
  BarChart3, ListFilter, Network, FileCheck2, FileText, Activity,
  Lock, CheckCircle2, BookOpen, Sparkles, Sun, Moon,
  ChevronDown, Bell, X
} from "lucide-react";
import { fetchApi, setAuthSession, getCurrentUser, getAuthToken } from "@/lib/api";
import { useTheme } from "./ThemeProvider";
import CopilotPanel from "./CopilotPanel";
import WalkthroughModal from "./WalkthroughModal";
import PramaLogo from "./PramaLogo";

const ROLE_CREDENTIALS: Record<string, { email: string; name: string }> = {
  maker: { email: "maker@aicte.gov.in", name: "Scrutiny Officer" },
  checker: { email: "checker@aicte.gov.in", name: "Senior Director" },
  institute: { email: "institute1@iit.ac.in", name: "NIT Pune (Inst)" },
  admin: { email: "admin@aicte.gov.in", name: "Bureau Admin" },
};

export default function Navigation() {
  const pathname = usePathname();
  const { toggleTheme, isDark } = useTheme();

  const [clockData, setClockData] = useState<{ offset_days: number; simulated_date: string }>({
    offset_days: 0,
    simulated_date: "2026-10-26"
  });
  const [_auditValid, setAuditValid] = useState<boolean>(true);
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>("maker");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string>("");
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersOpen, setRemindersOpen] = useState<boolean>(false);
  const [expandedHindiId, setExpandedHindiId] = useState<number | null>(null);
  const [moreToolsOpen, setMoreToolsOpen] = useState<boolean>(false);

  const refreshReminders = async () => {
    try {
      const data = await fetchApi<any[]>("/dashboard/reminders");
      setReminders(data || []);
    } catch {}
  };

  const loginAsRole = async (roleKey: string) => {
    const creds = ROLE_CREDENTIALS[roleKey];
    if (!creds) return;
    try {
      const res = await fetchApi<{ access_token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: creds.email, password: "Password@123" })
      });
      setAuthSession(res.access_token, res.user);
      setCurrentUser(res.user);
      setActiveRole(roleKey);
      window.dispatchEvent(new Event("clockUpdated"));
      window.dispatchEvent(new Event("authChanged"));
    } catch (e) {
      console.error("Auto-login failed:", e);
    }
  };

  const refreshClock = async () => {
    try {
      const data = await fetchApi<{ offset_days: number; simulated_date: string }>("/demo/status");
      setClockData(data);
    } catch {}
  };

  const refreshAudit = async () => {
    try {
      const audit = await fetchApi<{ valid: boolean }>("/audit/verify");
      setAuditValid(audit.valid);
    } catch {}
  };

  useEffect(() => {
    setMounted(true);
    const user = getCurrentUser();
    if (!user || !getAuthToken()) {
      loginAsRole("maker");
    } else {
      setCurrentUser(user);
      if (user.role === "institution_admin") setActiveRole("institute");
      else if (user.role === "senior_officer") setActiveRole("checker");
      else if (user.role === "admin") setActiveRole("admin");
      else setActiveRole("maker");
    }
    refreshClock();
    refreshAudit();
    refreshReminders();

    const interval = setInterval(() => {
      refreshClock();
      refreshReminders();
    }, 10000);

    const handleUpdate = () => {
      refreshClock();
      refreshAudit();
      refreshReminders();
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

  const isInstitutionRole = currentUser?.role === "institution_admin" || activeRole === "institute";

  // Hide entire navbar on standalone external bank verification page
  if (pathname?.startsWith("/bank-verify")) {
    return null;
  }

  // 4 Primary ATM Nav Items
  const primaryNavItems = [
    { label: isInstitutionRole ? "My Deposits" : "Dashboard", href: "/", icon: BarChart3 },
    { label: "Actions Queue", href: "/queue", icon: ListFilter, hidden: isInstitutionRole },
    { label: "Submit FDR", href: "/submit", icon: FileText },
    { label: "Release & Refund", href: "/release", icon: FileCheck2 },
  ].filter(item => !item.hidden);

  const moreTools = [
    { label: "Duplicate & Fraud Map", href: "/graph", icon: Network, desc: "Syndicate collusion analysis" },
    { label: "Cryptographic Audit Ledger", href: "/audit", icon: Lock, desc: "SHA-256 Merkle chain logs" },
    { label: "AICTE Regulations", href: "/knowledge", icon: BookOpen, desc: "Approval Process Guidelines" },
    { label: "System Benchmarks", href: "/evaluation", icon: Activity, desc: "Forensic accuracy metrics" }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <PramaLogo size="sm" variant="icon" />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none group-hover:text-amber-500 transition-colors">
                PRAMA
              </span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                AICTE FDR Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Center: ATM Primary Navigation Touchpoints */}
        <nav className="hidden md:flex items-center gap-1.5">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20"
                    : "text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* More Tools Dropdown */}
          {!isInstitutionRole && (
            <div className="relative">
              <button
                onClick={() => setMoreToolsOpen(!moreToolsOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  moreTools.some(t => pathname.startsWith(t.href))
                    ? "bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
              >
                <span>Tools</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreToolsOpen ? "rotate-180" : ""}`} />
              </button>

              {moreToolsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreToolsOpen(false)}></div>
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    {moreTools.map((tool) => {
                      const ToolIcon = tool.icon;
                      const isToolActive = pathname.startsWith(tool.href);
                      return (
                        <Link
                          key={tool.href}
                          href={tool.href}
                          onClick={() => setMoreToolsOpen(false)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs transition ${
                            isToolActive
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold"
                              : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <ToolIcon className="w-4 h-4 mt-0.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                          <div>
                            <div className="font-semibold">{tool.label}</div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500">{tool.desc}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </nav>

        {/* Right: Essential ATM Controls */}
        <div className="flex items-center gap-2">
          {/* Compact Simulated Date Pill */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-[11px]">
              {clockData.simulated_date}
            </span>
            {clockData.offset_days > 0 && (
              <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 rounded font-bold">
                +{clockData.offset_days}d
              </span>
            )}
            <button
              onClick={() => handleAdvance(30)}
              disabled={advancing}
              className="ml-1 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-200 text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300 transition"
              title="Fast-forward clock 30 days to test near-maturity alerts"
            >
              +30d
            </button>
            {clockData.offset_days > 0 && (
              <button
                onClick={handleReset}
                disabled={advancing}
                className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                title="Reset date to today"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Alerts Bell */}
          <button
            onClick={() => setRemindersOpen(true)}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition"
            title="Statutory Alerts & Notices"
            aria-label="Statutory Alerts"
          >
            <Bell className="w-4 h-4" />
            {reminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                {reminders.length}
              </span>
            )}
          </button>

          {/* Active Persona Dropdown */}
          <div className="relative">
            <select
              value={activeRole}
              onChange={(e) => loginAsRole(e.target.value)}
              className="bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm"
              title="Select Active User Persona"
            >
              <option value="maker">Scrutiny Officer (Maker)</option>
              <option value="checker">Senior Director (Checker)</option>
              <option value="institute">NIT Pune (College)</option>
              <option value="admin">Bureau Administrator</option>
            </select>
          </div>

          {/* AI Copilot Button */}
          <button
            onClick={() => setCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-sm"
            title="Open AI Compliance Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Global AI Copilot Drawer */}
      <CopilotPanel
        isOpen={copilotOpen}
        initialQuestion={copilotQuestion}
        onClose={() => {
          setCopilotOpen(false);
          setCopilotQuestion("");
        }}
      />

      {/* Walkthrough Tour Modal */}
      <WalkthroughModal
        isOpen={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
      />

      {/* Automated Statutory Alerts Modal (Portaled to document.body for flawless viewport centering) */}
      {mounted && remindersOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setRemindersOpen(false)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:px-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                    Statutory Expiry & Renewal Alerts
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {reminders.length} active automated compliance notice{reminders.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemindersOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                aria-label="Close alerts modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal List Items */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {reminders.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 dark:text-zinc-400 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">No Pending Statutory Alerts</p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    All institutional fixed deposit instruments comply with AICTE maturity rules.
                  </p>
                </div>
              ) : (
                reminders.map((rem: any, idx: number) => {
                  let daysLeft = rem.days_to_maturity;
                  if ((daysLeft === undefined || daysLeft === null) && rem.maturity_date && clockData?.simulated_date) {
                    try {
                      const mat = new Date(rem.maturity_date).getTime();
                      const now = new Date(clockData.simulated_date).getTime();
                      daysLeft = Math.ceil((mat - now) / (1000 * 60 * 60 * 24));
                    } catch {}
                  }

                  const isOverdue = typeof daysLeft === "number" && daysLeft <= 0;
                  const badgeText = typeof daysLeft === "number"
                    ? (isOverdue ? "OVERDUE" : `${daysLeft}d left`)
                    : "NOTICE";

                  const noticeText = rem.reminder_text || `Statutory Notice: Fixed Deposit ${rem.fdr_number} of ₹${rem.amount_lakhs || (rem.amount ? (rem.amount / 100000).toFixed(2) : 0)} Lakhs matures on ${rem.maturity_date}.`;
                  const hindiText = rem.hindi_reminder_text || rem.hindi_draft;

                  return (
                    <div
                      key={rem.id || idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-zinc-700 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              FDR: {rem.fdr_number}
                            </span>
                            {rem.channel && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                                {rem.channel}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                            {rem.institution_name} • Matures <span className="font-mono font-semibold">{rem.maturity_date}</span>
                          </div>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide shrink-0 ${
                          isOverdue
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                        }`}>
                          {badgeText}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                        {noticeText}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-zinc-800/80 text-[11px]">
                        {hindiText ? (
                          <button
                            onClick={() => setExpandedHindiId(expandedHindiId === idx ? null : idx)}
                            className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <span>{expandedHindiId === idx ? "Hide Hindi Notice" : "सांविधिक हिंदी सूचना (Hindi Notice)"}</span>
                          </button>
                        ) : <span />}

                        {rem.instrument_id && (
                          <Link
                            href={`/inspector/${rem.instrument_id}`}
                            onClick={() => setRemindersOpen(false)}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Inspect Instrument</span>
                            <span>&rarr;</span>
                          </Link>
                        )}
                      </div>

                      {expandedHindiId === idx && hindiText && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-950 dark:text-amber-200 text-xs font-serif leading-relaxed border border-amber-500/20">
                          {hindiText}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:px-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                AICTE APH Clause 6.46
              </span>
              <button
                onClick={() => setRemindersOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold rounded-xl text-xs transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
