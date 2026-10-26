"use client";

import React from "react";

export interface PramaLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "stacked";
  showSubtitle?: boolean;
  className?: string;
}

export default function PramaLogo({
  size = "sm",
  variant = "full",
  showSubtitle = true,
  className = "",
}: PramaLogoProps) {
  // Dimensions map
  const sizeMap = {
    xs: { iconSize: 20, wordmarkClass: "text-sm", subClass: "text-[8px]", gap: "gap-1.5" },
    sm: { iconSize: 28, wordmarkClass: "text-base", subClass: "text-[9px]", gap: "gap-2.5" },
    md: { iconSize: 36, wordmarkClass: "text-xl", subClass: "text-[10px]", gap: "gap-3" },
    lg: { iconSize: 48, wordmarkClass: "text-2xl", subClass: "text-xs", gap: "gap-3.5" },
    xl: { iconSize: 64, wordmarkClass: "text-3xl", subClass: "text-sm", gap: "gap-4" },
  };

  const { iconSize, wordmarkClass, subClass, gap } = sizeMap[size];

  // SVG Geometric Monogram
  const IconGlyph = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-200 group-hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        {/* Background Container Gradient */}
        <linearGradient id="pramaBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="50%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#090D16" />
        </linearGradient>

        {/* Stem Gradient */}
        <linearGradient id="pramaStemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>

        {/* Vault Loop Gradient */}
        <linearGradient id="pramaLoopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="60%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Truth Beacon (Pramā Star) Gradient */}
        <linearGradient id="pramaStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Border Stroke Gradient */}
        <linearGradient id="pramaBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#312E81" stopOpacity="0.2" />
        </linearGradient>

        {/* Subtle Glow Filter */}
        <filter id="pramaStarGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Rounded SaaS Squircle Base */}
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        fill="url(#pramaBgGrad)"
        stroke="url(#pramaBorderGrad)"
        strokeWidth="1.5"
      />

      {/* Vertical 'P' Pillar (Anchor of Trust) */}
      <rect
        x="9.5"
        y="8.5"
        width="5"
        height="23"
        rx="2.5"
        fill="url(#pramaStemGrad)"
      />

      {/* Vault Arc Loop of the 'P' */}
      <path
        d="M 13.5 8.5 H 23.5 C 27.64 8.5 31 11.86 31 16 C 31 20.14 27.64 23.5 23.5 23.5 H 13.5 V 18.5 H 23 C 24.38 18.5 25.5 17.38 25.5 16 C 25.5 14.62 24.38 13.5 23 13.5 H 13.5 Z"
        fill="url(#pramaLoopGrad)"
      />

      {/* Pramā Truth Beacon (Radiant 4-point Diamond inside Vault Loop) */}
      <path
        d="M 21.5 13.2 Q 21.5 16 24.2 16 Q 21.5 16 21.5 18.8 Q 21.5 16 18.8 16 Q 21.5 16 21.5 13.2 Z"
        fill="url(#pramaStarGrad)"
        filter="url(#pramaStarGlow)"
      />

      {/* Micro-spark in lower corner indicating live verification status */}
      <circle cx="28.5" cy="28.5" r="1.5" fill="#10B981" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {IconGlyph}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center text-center ${gap} ${className}`}>
        {IconGlyph}
        <div className="flex flex-col items-center">
          <span className={`font-black tracking-tight text-slate-900 dark:text-white ${wordmarkClass} leading-none`}>
            PRAMA
          </span>
          {showSubtitle && (
            <span className={`font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400 ${subClass} mt-1`}>
              Security Deposit Bureau
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default "full" variant (Horizontal)
  return (
    <div className={`inline-flex items-center ${gap} ${className} group`}>
      {IconGlyph}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight text-slate-900 dark:text-white ${wordmarkClass} leading-tight`}>
            Prama
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/20 uppercase tracking-wider">
            AICTE
          </span>
        </div>
        {showSubtitle && (
          <span className={`font-medium tracking-wide text-slate-500 dark:text-zinc-400 ${subClass} mt-0.5`}>
            Security Deposit Bureau
          </span>
        )}
      </div>
    </div>
  );
}
