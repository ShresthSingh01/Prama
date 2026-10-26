"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ShieldCheck, Clock, FastForward, RotateCcw, AlertTriangle, 
  BarChart3, ListFilter, Network, FileCheck2, FileText, Activity,
  Lock, CheckCircle2, XCircle
} from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function Navigation() {
  const pathname = usePathname();
  const [clockData, setClockData] = useState<{ offset_days: number; simulated_date: string }>({
    offset_days: 0,
    simulated_date: "2026-10-26"
  });
  const [auditValid, setAuditValid] = useState<boolean>(true);
  const [advancing, setAdvancing] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>("maker");

  const refreshClock = async () => {
    try {
      const data = await fetchApi<{ offset_days: number; simulated_date: string }>("/demo/status");
      setClockData(data);
      const audit = await fetchApi<{ valid: boolean }>("/audit/verify");
      setAuditValid(audit.valid);
    } catch (e) {
      // Backend may be starting
    }
  };

  useEffect(() => {
    refreshClock();
    const interval = setInterval(refreshClock, 8000);
    return () => clearInterval(interval);
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

  const navItems = [
    { label: "Cockpit", href: "/", icon: BarChart3 },
    { label: "Act Today Queue", href: "/queue", icon: ListFilter },
    { label: "Forensic Inspector", href: "/inspector/1", icon: ShieldCheck },
    { label: "Syndicate Graph", href: "/graph", icon: Network },
    { label: "Maker-Checker", href: "/release", icon: FileCheck2 },
    { label: "Audit Ledger", href: "/audit", icon: Lock },
    { label: "Forensic Benchmark", href: "/evaluation", icon: Activity },
    { label: "Deposit FDR", href: "/submit", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 text-zinc-100">
      {/* Top Regulatory Intelligence Bar */}
      <div className="px-4 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-semibold tracking-wide text-zinc-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AICTE REGULATION BUREAU
            <span className="text-zinc-500 font-normal">| FinSec Sentinel Terminal</span>
          </div>
          
          {/* Simulated Time Machine Controls */}
          <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-700">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-400">Simulated Date:</span>
            <span className="font-mono font-medium text-amber-300">{clockData.simulated_date}</span>
            {clockData.offset_days > 0 && (
              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">
                +{clockData.offset_days}d
              </span>
            )}
            
            <div className="h-3 w-px bg-zinc-700 mx-1"></div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => handleAdvance(30)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-mono transition"
                title="Advance regulatory clock by 30 days"
              >
                +30d
              </button>
              <button 
                onClick={() => handleAdvance(60)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-mono transition"
                title="Advance regulatory clock by 60 days"
              >
                +60d
              </button>
              <button 
                onClick={() => handleAdvance(90)}
                disabled={advancing}
                className="px-1.5 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded text-[11px] font-mono transition"
                title="Fast forward 90 days to test expiry alerts"
              >
                +90d
              </button>
              {clockData.offset_days > 0 && (
                <button 
                  onClick={handleReset}
                  disabled={advancing}
                  className="px-1.5 py-0.5 text-zinc-400 hover:text-rose-400 rounded transition"
                  title="Reset clock to today"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audit Chain Status & Role Switcher */}
        <div className="flex items-center gap-4">
          <Link href="/audit" className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700">
            {auditValid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono text-[11px]">Audit Chain: INTACT</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                <span className="text-rose-400 font-bold font-mono text-[11px]">AUDIT CHAIN COMPROMISED!</span>
              </>
            )}
          </Link>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Role:</span>
            <select 
              value={activeRole} 
              onChange={(e) => setActiveRole(e.target.value)}
              className="bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-2 py-0.5 text-xs focus:outline-none"
            >
              <option value="maker">Scrutiny Officer (Maker)</option>
              <option value="checker">Senior Director (Checker)</option>
              <option value="institute">Institute Registrar</option>
              <option value="admin">Bureau System Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Navigation Row */}
      <nav className="px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight text-white">
            <div className="w-7 h-7 rounded bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span>FDR-Sentinel</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive 
                      ? "bg-zinc-800 text-white shadow-inner shadow-black/40" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-zinc-500 font-mono hidden md:block">
          SIH PS 26265 • Zero-Fake DB Architecture
        </div>
      </nav>
    </header>
  );
}
