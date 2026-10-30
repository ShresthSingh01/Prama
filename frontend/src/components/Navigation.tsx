"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Clock, RotateCcw, 
  BarChart3, ListFilter, Network, FileCheck2, FileText, Activity,
  Lock, CheckCircle2, XCircle, BookOpen, Sparkles, Sun, Moon,
  HelpCircle, ChevronDown, Bell, X
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
  const [auditValid, setAuditValid] = useState<boolean>(true);
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>("maker");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string>("");
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersOpen, setRemindersOpen] = useState<boolean>(false);
  const [expandedHindiId, setExpandedHindiId] = useState<number | null>(null);

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

  // Primary PS 26265 Navigation Items (Role-Aware)
  const isInstitutionRole = currentUser?.role === "institution_admin" || activeRole === "institute";

  interface NavItem {
    label: string;
    href: string;
    icon: any;
    desc: string;
    badge?: string;
  }

  const officerNavItems: NavItem[] = [
    { label: "Dashboard", href: "/", icon: BarChart3, desc: "Overview & regulatory metrics" },
    { label: "Pending Actions", href: "/queue", icon: ListFilter, desc: "FDRs needing regulatory review" },
    { label: "Duplicate & Fraud Detection", href: "/graph", icon: Network, desc: "Visual fraud detection map (Collusion Rings)", badge: "5 Rings" },
    { label: "Submit FDR / Security Deposit", href: "/submit", icon: FileText, desc: "Register certificate" },
    { label: "Deposit Release & Refund", href: "/release", icon: FileCheck2, desc: "Dual-officer approval" },
    { label: "Activity & Audit Log", href: "/audit", icon: Lock, desc: "Tamper-proof logs" },
  ];

  const institutionNavItems: NavItem[] = [
    { label: "My Deposits", href: "/", icon: BarChart3, desc: "College security deposits overview" },
    { label: "Submit FDR / Security Deposit", href: "/submit", icon: FileText, desc: "Submit new or renewed FDR" },
    { label: "Deposit Release & Refund", href: "/release", icon: FileCheck2, desc: "Request deposit release" },
    { label: "AICTE Regulations", href: "/knowledge", icon: BookOpen, desc: "Approval Process Guidelines" },
  ];

  const primaryNavItems = isInstitutionRole ? institutionNavItems : officerNavItems;

  const toolsNavItems = [
    { label: "AICTE Regulations & Handbooks", href: "/knowledge", icon: BookOpen, desc: "AICTE regulations" },
    { label: "System Benchmarks", href: "/evaluation", icon: Activity, desc: "Accuracy benchmarks" },
  ];

  const [toolsOpen, setToolsOpen] = useState(false);

  if (pathname?.startsWith("/bank-verify")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Regulatory Intelligence Bar */}
      <div className="px-4 py-1.5 bg-slate-100/90 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-semibold tracking-wide text-slate-800 dark:text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AICTE REGULATION BUREAU <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">PS 26265</span>
            <span className="text-slate-400 dark:text-zinc-500 font-normal">| Prama</span>
          </div>
          
          {/* Simulated Time Machine Controls */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 shadow-sm" title="Maturity Time Machine — Simulate future dates to trigger expiry alerts">
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px] uppercase tracking-wide hidden md:inline">Time Machine</span>
            <span className="text-slate-500 dark:text-zinc-400 hidden md:inline">·</span>
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

            {/* Automated Alerts Bell (PS 26265 Item 4 & 7) */}
            <div className="h-3 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5"></div>
            <button
              onClick={() => setRemindersOpen(true)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-[11px] font-semibold transition"
              title="Statutory Alerts & Escalation Ladder"
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Alerts</span>
              {reminders.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white font-mono text-[10px] font-bold">
                  {reminders.length}
                </span>
              )}
            </button>
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
                <XCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono text-[11px]">Audit Break Detected!</span>
              </>
            )}
          </Link>

          {/* User Persona Switcher */}
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
            <span className="text-[11px] hidden sm:inline">Active Persona:</span>
            <select 
              value={activeRole} 
              onChange={(e) => loginAsRole(e.target.value)}
              className="bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded px-2 py-0.5 text-xs focus:outline-none shadow-sm font-medium"
            >
              <option value="maker">Scrutiny Officer (Maker)</option>
              <option value="checker">Senior Director (Checker)</option>
              <option value="institute">Institution Admin (NIT Pune)</option>
              <option value="admin">System Administrator</option>
            </select>
            {currentUser?.name && (
              <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                {currentUser.name}
              </span>
            )}
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

        {/* Center: Clean Primary Navigation Links + Tools Dropdown */}
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 px-2">
          {primaryNavItems.map((item) => {
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
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Tools & Analytics Dropdown (Officers only) */}
          {!isInstitutionRole && (
            <div className="relative shrink-0">
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                onBlur={() => setTimeout(() => setToolsOpen(false), 200)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  toolsNavItems.some(t => pathname.startsWith(t.href))
                    ? "bg-amber-500/15 text-amber-800 dark:bg-zinc-800 dark:text-white border border-amber-500/30 dark:border-zinc-700 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
                }`}
              >
                <span>More Tools</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
              </button>
              {toolsOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                  {toolsNavItems.map((tool) => {
                    const ToolIcon = tool.icon;
                    const isToolActive = pathname.startsWith(tool.href);
                    if (pathname?.startsWith("/bank-verify")) {
    return null;
  }

  return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setToolsOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition ${
                          isToolActive
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                            : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <ToolIcon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                        <div>
                          <div>{tool.label}</div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500">{tool.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

      {/* Statutory Alerts & Escalation Ladder Drawer (PS 26265 Item 4 & 7) */}
      {remindersOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end">
          <div className="bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 w-full max-w-lg h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Statutory Alerts & Escalation Center
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    AICTE PS 26265 Item 4 & 7 • Automated Reminders Ladder
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemindersOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reminders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reminders.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-500" />
                  <p className="font-semibold text-slate-700 dark:text-zinc-300">No Active Escalation Notices</p>
                  <p className="mt-1 text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
                    Use the simulated Time Machine (+30d, +60d, +90d) in the top bar to trigger upcoming maturity notices and overdue escalations.
                  </p>
                </div>
              ) : (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        {r.rule_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {r.channel} • {r.sent_at}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {r.institution_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                        FDR #{r.fdr_number} • ₹{r.amount_lakhs} Lakhs • Matures {r.maturity_date}
                      </div>
                    </div>

                    {/* Bilingual Notice Toggle */}
                    <div className="pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                      <button
                        onClick={() => setExpandedHindiId(expandedHindiId === r.id ? null : r.id)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {expandedHindiId === r.id ? "Hide Bilingual Notice" : "View Hindi / English Notice Draft"}
                      </button>
                      {expandedHindiId === r.id && (
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-[11px] space-y-1.5 font-sans">
                          <div className="text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                            {r.hindi_draft}
                          </div>
                          <div className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-zinc-800 pt-1">
                            Dispatched via {r.channel} to Institution Principal & Regional Officer.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-center text-[10px] text-slate-500 font-mono">
              AICTE Escalation Ladder: T-90 (Email) ➔ T-60 (Email) ➔ T-30 (SMS+Email) ➔ Overdue +1 (Scrutiny Alert)
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
