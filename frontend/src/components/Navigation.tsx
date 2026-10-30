"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Clock, RotateCcw, FastForward, Trash2, Calendar, AlertTriangle,
  BarChart3, ListFilter, Network, FileCheck2, FileText, Activity,
  Lock, CheckCircle2, BookOpen, Sparkles, Sun, Moon,
  ChevronDown, Bell, X, ShieldCheck
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
    simulated_date: "2026-10-31"
  });
  const [_auditValid, setAuditValid] = useState<boolean>(true);
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>("maker");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string>("");
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);
  
  // Time Machine Modal State
  const [timeMachineOpen, setTimeMachineOpen] = useState<boolean>(false);
  const [customDays, setCustomDays] = useState<number>(30);
  const [timeMachineFeedback, setTimeMachineFeedback] = useState<string | null>(null);

  // Reminders & Notifications State
  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersOpen, setRemindersOpen] = useState<boolean>(false);
  const [expandedHindiId, setExpandedHindiId] = useState<number | null>(null);
  const [moreToolsOpen, setMoreToolsOpen] = useState<boolean>(false);
  const [alertFilter, setAlertFilter] = useState<"all" | "overdue" | "expiring" | "escalation">("all");
  const [clearingAlerts, setClearingAlerts] = useState<boolean>(false);

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

    const handleAuth = () => {
      const u = getCurrentUser();
      setCurrentUser(u);
      if (u?.role === "institution_admin") setActiveRole("institute");
      else if (u?.role === "senior_officer") setActiveRole("checker");
      else if (u?.role === "admin") setActiveRole("admin");
      else setActiveRole("maker");
    };

    window.addEventListener("clockUpdated", handleUpdate);
    window.addEventListener("auditUpdated", handleUpdate);
    window.addEventListener("openCopilot", handleOpenCopilot);
    window.addEventListener("authChanged", handleAuth);

    return () => {
      clearInterval(interval);
      window.removeEventListener("clockUpdated", handleUpdate);
      window.removeEventListener("auditUpdated", handleUpdate);
      window.removeEventListener("openCopilot", handleOpenCopilot);
      window.removeEventListener("authChanged", handleAuth);
    };
  }, []);

  const handleAdvance = async (days: number) => {
    setAdvancing(true);
    setTimeMachineFeedback(null);
    try {
      const res = await fetchApi<any>("/demo/advance-clock", {
        method: "POST",
        body: JSON.stringify({ days })
      });
      await refreshClock();
      await refreshReminders();
      window.dispatchEvent(new Event("clockUpdated"));
      setTimeMachineFeedback(`Advanced clock by ${days} days to ${res.simulated_date}. Triggered ${res.status_changes || 0} instrument lifecycle transition(s) and generated ${res.reminders_created || 0} statutory notice(s).`);
    } catch (e: any) {
      console.error(e);
      setTimeMachineFeedback(e.message || "Failed to advance clock.");
    } finally {
      setAdvancing(false);
    }
  };

  const handleReset = async () => {
    setAdvancing(true);
    setTimeMachineFeedback(null);
    try {
      const res = await fetchApi<any>("/demo/reset-clock", { method: "POST" });
      await refreshClock();
      await refreshReminders();
      window.dispatchEvent(new Event("clockUpdated"));
      setTimeMachineFeedback(`Clock successfully reset to today (${res.simulated_date}). Recalibrated ${res.recalibrated_instruments || 0} instruments back to current calendar.`);
    } catch (e: any) {
      console.error(e);
      setTimeMachineFeedback(e.message || "Failed to reset clock.");
    } finally {
      setAdvancing(false);
    }
  };

  const handleClearAllReminders = async () => {
    setClearingAlerts(true);
    try {
      await fetchApi("/dashboard/reminders/clear", { method: "POST" });
      setReminders([]);
    } catch (e) {
      console.error("Failed to clear reminders:", e);
    } finally {
      setClearingAlerts(false);
    }
  };

  const handleDismissReminder = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetchApi(`/dashboard/reminders/${id}`, { method: "DELETE" });
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error("Failed to dismiss reminder:", e);
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

  // Compute alert metrics
  const getDaysLeft = (rem: any) => {
    let daysLeft = rem.days_to_maturity;
    if ((daysLeft === undefined || daysLeft === null) && rem.maturity_date && clockData?.simulated_date) {
      try {
        const mat = new Date(rem.maturity_date).getTime();
        const now = new Date(clockData.simulated_date).getTime();
        daysLeft = Math.ceil((mat - now) / (1000 * 60 * 60 * 24));
      } catch {}
    }
    return daysLeft;
  };

  const overdueCount = reminders.filter(rem => {
    const d = getDaysLeft(rem);
    return typeof d === "number" && d <= 0;
  }).length;

  const expiringCount = reminders.filter(rem => {
    const d = getDaysLeft(rem);
    return typeof d === "number" && d > 0 && d <= 30;
  }).length;

  const escalationCount = reminders.filter(rem => (rem.level && rem.level >= 2) || (rem.rule_name && rem.rule_name.toLowerCase().includes("escalat"))).length;

  const filteredReminders = reminders.filter(rem => {
    const d = getDaysLeft(rem);
    if (alertFilter === "overdue") return typeof d === "number" && d <= 0;
    if (alertFilter === "expiring") return typeof d === "number" && d > 0 && d <= 30;
    if (alertFilter === "escalation") return (rem.level && rem.level >= 2) || (rem.rule_name && rem.rule_name.toLowerCase().includes("escalat"));
    return true;
  });

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
          {/* Responsive Time Machine Trigger Pill */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs shadow-sm">
            <button
              onClick={() => {
                setTimeMachineOpen(true);
                setTimeMachineFeedback(null);
              }}
              className="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200 hover:text-amber-600 dark:hover:text-amber-400 transition"
              title="Open AICTE Regulatory Time Machine (Simulation Engine)"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-mono font-bold text-[11px]">
                {clockData.simulated_date}
              </span>
              {clockData.offset_days > 0 && (
                <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 rounded font-bold">
                  +{clockData.offset_days}d
                </span>
              )}
            </button>

            <button
              onClick={() => handleAdvance(30)}
              disabled={advancing}
              className="ml-1 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-zinc-700 text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 transition"
              title="Quick fast-forward 30 days"
            >
              +30d
            </button>

            {clockData.offset_days > 0 && (
              <button
                onClick={handleReset}
                disabled={advancing}
                className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                title="Reset clock to today"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Statutory Alerts Bell */}
          <button
            onClick={() => setRemindersOpen(true)}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition"
            title="Statutory Alerts & Notices"
            aria-label="Statutory Alerts"
          >
            <Bell className="w-4 h-4" />
            {reminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                {reminders.length > 99 ? "99+" : reminders.length}
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

      {/* Interactive Time Machine Modal (Portaled) */}
      {mounted && timeMachineOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden"
          onClick={() => setTimeMachineOpen(false)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[86vh] overflow-hidden animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:px-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                    Regulatory Time Machine (Simulation Engine)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Fast-forward time across the 10-year statutory lifecycle of security deposits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTimeMachineOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Active Date Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Current Simulated Date
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {clockData.simulated_date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Simulated Offset
                  </div>
                  <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                    +{clockData.offset_days} Days
                  </div>
                </div>
              </div>

              {/* Feedback Alert */}
              {timeMachineFeedback && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-mono flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{timeMachineFeedback}</span>
                </div>
              )}

              {/* Preset Jump Buttons */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase tracking-wider">
                  Preset Regulatory Fast-Forwards
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "+15 Days", days: 15, desc: "Notice Threshold" },
                    { label: "+30 Days", days: 30, desc: "1-Month Window" },
                    { label: "+60 Days", days: 60, desc: "2-Month Window" },
                    { label: "+90 Days", days: 90, desc: "Clause 6.46 Window" },
                    { label: "+180 Days", days: 180, desc: "6 Months Ahead" },
                    { label: "+365 Days", days: 365, desc: "1 Full Year" },
                  ].map((p) => (
                    <button
                      key={p.days}
                      onClick={() => handleAdvance(p.days)}
                      disabled={advancing}
                      className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 hover:border-amber-500 dark:hover:border-amber-500 transition text-left group shadow-sm disabled:opacity-50"
                    >
                      <div className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center justify-between">
                        <span>{p.label}</span>
                        <FastForward className="w-3 h-3 text-slate-400 group-hover:text-amber-500" />
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Fast-Forward */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">
                  Custom Day Fast-Forward
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    className="w-28 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm"
                  />
                  <button
                    onClick={() => handleAdvance(customDays)}
                    disabled={advancing || customDays <= 0}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {advancing ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
                    <span>Advance Clock</span>
                  </button>
                </div>
              </div>

              {/* Reset Clock Option */}
              <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">Reversibility Assurance</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Restores real calendar and recalibrates all instruments back to today.
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={advancing}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Today</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:px-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                AICTE APH Section 2.14 Simulation
              </span>
              <button
                onClick={() => setTimeMachineOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold rounded-xl text-xs transition shadow-sm"
              >
                Close Time Machine
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Automated Statutory Alerts Modal (Portaled) */}
      {mounted && remindersOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden"
          onClick={() => setRemindersOpen(false)}
        >
          <div 
            className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:px-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                    <span>Statutory Expiry &amp; Renewal Alerts</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {reminders.length} Active
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Automated regulatory dispatch engine under AICTE APH Clause 6.46
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {reminders.length > 0 && (
                  <button
                    onClick={handleClearAllReminders}
                    disabled={clearingAlerts}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-[11px] font-semibold transition"
                    title="Acknowledge and clear all statutory alerts"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
                <button
                  onClick={() => setRemindersOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                  aria-label="Close alerts modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 py-2.5 bg-slate-100/60 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-1.5 text-xs overflow-x-auto shrink-0">
              <button
                onClick={() => setAlertFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  alertFilter === "all"
                    ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900 font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                All ({reminders.length})
              </button>
              <button
                onClick={() => setAlertFilter("overdue")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  alertFilter === "overdue"
                    ? "bg-rose-600 text-white font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                Overdue ({overdueCount})
              </button>
              <button
                onClick={() => setAlertFilter("expiring")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  alertFilter === "expiring"
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                Expiring &le;30d ({expiringCount})
              </button>
              <button
                onClick={() => setAlertFilter("escalation")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  alertFilter === "escalation"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                Escalations ({escalationCount})
              </button>
            </div>

            {/* Modal List Items */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {filteredReminders.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 dark:text-zinc-400 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-zinc-200">No Matching Statutory Alerts</p>
                  <p className="text-[11px] max-w-xs mx-auto">
                    {reminders.length === 0 
                      ? "All institutional fixed deposit instruments comply with AICTE maturity rules." 
                      : "No alerts match the active filter criteria."}
                  </p>
                </div>
              ) : (
                filteredReminders.map((rem: any, idx: number) => {
                  const daysLeft = getDaysLeft(rem);
                  const isOverdue = typeof daysLeft === "number" && daysLeft <= 0;
                  const badgeText = typeof daysLeft === "number"
                    ? (isOverdue ? "OVERDUE" : `${daysLeft}d left`)
                    : "NOTICE";

                  const noticeText = rem.reminder_text || `Statutory Notice: Fixed Deposit ${rem.fdr_number} of ₹${rem.amount_lakhs || (rem.amount ? (rem.amount / 100000).toFixed(2) : 0)} Lakhs matures on ${rem.maturity_date}.`;
                  const hindiText = rem.hindi_reminder_text || rem.hindi_draft;

                  return (
                    <div
                      key={rem.id || idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 hover:border-slate-300 dark:hover:border-zinc-700 transition space-y-2 relative group"
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
                            {rem.level && rem.level >= 2 && (
                              <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                LEVEL {rem.level} ESCALATION
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                            {rem.institution_name} • Matures <span className="font-mono font-semibold">{rem.maturity_date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide shrink-0 ${
                            isOverdue
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          }`}>
                            {badgeText}
                          </span>
                          {rem.id && (
                            <button
                              onClick={(e) => handleDismissReminder(rem.id, e)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition opacity-0 group-hover:opacity-100"
                              title="Dismiss notice"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
                        {noticeText}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-zinc-800/80 text-[11px]">
                        {hindiText ? (
                          <button
                            onClick={() => setExpandedHindiId(expandedHindiId === (rem.id || idx) ? null : (rem.id || idx))}
                            className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <span>{expandedHindiId === (rem.id || idx) ? "Hide Hindi Notice" : "सांविधिक हिंदी सूचना (Hindi Notice)"}</span>
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

                      {expandedHindiId === (rem.id || idx) && hindiText && (
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
                AICTE APH Clause 6.46 Compliance Alerts
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
