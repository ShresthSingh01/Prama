---
name: Prama
description: AICTE Regulation Bureau Cryptographic Trust Terminal
colors:
  primary: "#f59e0b"
  primary-hover: "#d97706"
  primary-fg: "#020617"
  secondary: "#10b981"
  secondary-fg: "#ffffff"
  critical: "#f43f5e"
  critical-fg: "#ffffff"
  info: "#3b82f6"
  info-fg: "#ffffff"
  neutral-bg: "#09090b"
  neutral-surface: "#18181b"
  neutral-border: "#27272a"
  neutral-fg: "#f4f4f5"
  neutral-muted: "#a1a1aa"
  light-bg: "#f8fafc"
  light-surface: "#ffffff"
  light-border: "#e2e8f0"
  light-fg: "#0f172a"
  light-muted: "#64748b"
typography:
  display:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "var(--font-geist-mono), monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.025em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-fg}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card-container:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  badge-bank-confirmed:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-fg}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-critical:
    backgroundColor: "{colors.critical}"
    textColor: "{colors.critical-fg}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Prama

## Overview

**Creative North Star: "The Sovereign Regulatory Vault"**

Prama's visual architecture embodies the solemn authority of the All India Council for Technical Education (AICTE) Regulation Bureau combined with the forensic rigor of modern financial cryptography. The interface provides scrutiny officers and senior directors with an uncompromising, high-density terminal designed for multi-hour verification shifts during statutory approval seasons.

The aesthetic is rigorous, disciplined, and forensic: surfaces are dark, crisp, and high-density by default in Obsidian Zinc (`#09090b`), paired with an equally balanced and accessible high-contrast Slate Light mode (`#f8fafc`). Decorative fluff, whimsical illustrations, and unnecessary whitespace are deliberately rejected in favor of high-throughput telemetry, clear 1px contour borders, synchronized dual-pane inspection canvases, and monospaced cryptographic proofs.

**Key Characteristics:**
- **Sovereign Regulatory Authority**: Authoritative government presence balanced with high-efficiency modern RegTech ergonomics.
- **Cryptographic Provenance Semantics**: Four strictly codified status colors denoting levels of truth (`Bank-Confirmed`, `Cross-Validated`, `Self-Declared`, `Critical-Tamper`).
- **Data-Dense Telemetry**: Optimized information density with compact line heights, legible badges, and synchronized inspection panes.
- **Audit Ledger Transparency**: Tamper-evident SHA-256 block chains, instant verification alarms, and non-repudiation feedback.

## Colors

The Prama palette is governed by statutory clarity and cryptographic precision: high-salience Amber anchors operational action, while deterministic semantic indicators convey exact levels of evidentiary truth.

### Primary
- **Sovereign Amber** (`#f59e0b` / `rgb(245, 158, 11)`): The primary operational action and focus accent. Used for high-priority review buttons, time-machine controls, active queue indicators, and primary interactive highlights. Paired with dark slate text (`#020617`) for maximum legibility.
- **Sovereign Amber Deep** (`#d97706`): Interactive hover and active state for primary action elements.

### Secondary
- **Cryptographic Emerald** (`#10b981`): Denotes mathematically verified certainty—bank-signed Ed25519 QR codes, validated SHA-256 ledger integrity, and satisfied release preconditions under AICTE APH Clause 6.46.

### Tertiary
- **Cross-Validation Blue** (`#3b82f6`): Denotes deterministic automated system checks—OCR document extraction, IFSC regex validation, and tenure calculation passes.
- **Tamper Rose** (`#f43f5e`): High-urgency alert color strictly reserved for critical discrepancies, manipulated deposit amounts, expired maturities, and compromised audit blocks.

### Neutral
- **Obsidian Zinc (Dark Background)** (`#09090b`): The canonical dark canvas providing deep contrast for forensic document inspection and vector topology graphs.
- **Vault Zinc Surface** (`#18181b`): Card background, modal container, and elevated panel surface in dark mode.
- **Contour Zinc Border** (`#27272a`): Crisp 1px structural separator dividing cards, table rows, and telemetry panels.
- **Slate Canvas (Light Background)** (`#f8fafc`): Crisp, glare-free light mode background for daylight regulatory workstations.
- **Pure White Surface** (`#ffffff`): Light mode card container and elevated inspector panels.
- **Slate Contour Border** (`#e2e8f0`): 1px light mode divider and container stroke.
- **Muted Slate / Zinc Text** (`#a1a1aa` / `#64748b`): Secondary labels, timestamps, and metadata.

### Named Rules
**The Sovereign Amber Rule.** Amber is strictly reserved for high-salience operational triggers, active scrutiny queues, and primary commit actions. It must never be diluted as a general decorative background wash.  
**The Verified Truth Rule.** Emerald (`#10b981`) denotes cryptographic certainty, Blue (`#3b82f6`) denotes deterministic cross-validation, Amber (`#f59e0b`) denotes unverified or pending state, and Rose (`#f43f5e`) denotes critical tampering or statutory failure. These four status semantics are inviolable.

## Typography

**Display Font:** Geist Sans (`var(--font-geist-sans), Arial, sans-serif`)  
**Body Font:** Geist Sans (`var(--font-geist-sans), Arial, sans-serif`)  
**Label/Mono Font:** Geist Mono (`var(--font-geist-mono), monospace`)  

**Character:** A pairing of geometric clarity and forensic precision. Geist Sans delivers crisp, legible interface typography across dense table grids, while Geist Mono anchors every financial figure, serial number, and cryptographic digest in unyielding mathematical alignment.

### Hierarchy
- **Display** (Bold 700, 1.5rem / 24px, line-height 1.2, letter-spacing -0.02em): Top-level cockpit banners, executive corpus summaries, and modal titles.
- **Headline** (Bold 700, 1.25rem / 20px, line-height 1.3, letter-spacing -0.015em): Section titles, inspection header titles, and ledger verification status.
- **Title** (Semi-bold 600, 1rem / 16px, line-height 1.4, letter-spacing -0.01em): Card titles, table column headers, and checklist item headers.
- **Body** (Regular 400, 0.875rem / 14px, line-height 1.5): Explanatory regulatory text, policy descriptions, and forensic audit narratives.
- **Label** (Semi-bold/Bold 600/700, 0.75rem / 12px, line-height 1.4, monospace): FDR serial numbers, bank IFSC codes, rupee amounts, timestamps, trust badges, and SHA-256 block hashes.

### Named Rules
**The Cryptographic Monospace Rule.** All instrument serials, transaction hashes, dates, amounts, IFSC codes, and time offsets must render in monospace (Geist Mono) to guarantee character-level scrutiny and column alignment.  
**The Scrutiny Density Rule.** Body copy and secondary telemetry default to compact sizes (12px to 14px / 0.75rem to 0.875rem) to maximize viewport density during multi-hour review shifts.

## Layout

Prama employs a responsive, grid-anchored layout optimized for 1600px widescreen desktop inspection monitors while scaling gracefully down to laptop displays:

- **Max Container Width**: Centered content container locked to `max-w-[1600px]` with standard `p-4 md:p-6` gutter padding.
- **Top Intelligence Bar**: Fixed sticky header (`sticky top-0 z-40`) featuring a glassmorphism backdrop blur (`backdrop-blur bg-white/95 dark:bg-zinc-950/95`), live PS 26265 emblem, interactive Time Machine scrubber, and instant audit health indicator.
- **Synchronized Dual-Pane Inspection**: The Inspector (`/inspector/[id]`) divides the viewport into a flexible 50/50 dual-pane architecture: left pane dedicated to high-resolution document viewing (PDF, OCR bounding boxes, ELA heatmaps, QR overlays), and right pane dedicated to discrepancy resolution, rule checklists, and Maker-Checker action buttons.
- **Dashboard Metric Ribbon**: Dense responsive grid (`grid-cols-1 md:grid-cols-3 gap-2.5`) surfacing key executive telemetry without requiring scrolling.

### Named Rules
**The Synchronized Dual-Pane Rule.** Document scrutiny always pairs visual source evidence (left canvas) with deterministic extracted fields and action triggers (right pane). Never separate forensic proof from the administrative decision.

## Elevation & Depth

Prama is built on a **Tonal Layering with Border Contours** philosophy. Surfaces are flat at rest, with depth conveyed through subtle background shifts and crisp 1px borders rather than diffuse drop shadows.

- **Surface Layering**: In dark mode, base canvas sits at `#09090b`, cards and panels sit at `#18181b`, and hover states step to `#27272a`.
- **Contour Borders**: All panels and interactive controls feature 1px solid borders (`border-slate-200` in light mode, `border-zinc-800` in dark mode) ensuring crisp definition across heterogeneous displays.
- **Micro-Shadows**: Minimal elevation (`shadow-sm`) applied only to cards and action buttons to distinguish them from background tracks.
- **Status Glows**: Dynamic radial glows (`animate-pulse-glow` in emerald, `animate-pulse-glow-red` in rose) are strictly reserved for live verification alerts and tamper alarms.

### Shadow Vocabulary
- **Card Contour** (`box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`): Subtle separation for cards, modals, and buttons.
- **Cryptographic Verification Pulse** (`box-shadow: 0 0 0 8px rgba(34, 197, 94, 0)`): Expanding halo indicating verified Ed25519 signature.
- **Tampering Alarm Pulse** (`box-shadow: 0 0 0 10px rgba(239, 68, 68, 0)`): Urgent alarm halo indicating compromised audit block or tampered monetary value.

### Named Rules
**The Flat Tonal Rule.** Surfaces are flat at rest and structured by 1px contour borders and subtle tonal steps. Ambient drop shadows are minimized to subtle elevations (`shadow-sm`); glowing halos are strictly reserved for live alarms and cryptographic pulses.

## Shapes

- **Base Form Language**: Disciplined, ergonomic squircle geometry balancing modern software density with institutional stability.
- **Container Radius**: Cards, modals, and prominent alert banners use a consistent 12px radius (`rounded-xl` / `12px`).
- **Interactive Component Radius**: Buttons, input fields, search bars, and dropdowns use an 8px radius (`rounded-lg` / `8px`).
- **Badges & Chips**: Telemetry chips, trust tier indicators, and quick filters use a 6px radius (`rounded-md` / `6px`).
- **Pills & Micro-Counters**: Numeric count pills and live status indicators use full rounded pills (`rounded-full` / `9999px`).

### Named Rules
**The Tactical Squircle Rule.** Containers, panels, and modals use a disciplined 12px radius (`rounded-xl`); buttons, badges, and inputs use a tighter 6px to 8px radius (`rounded-md` / `rounded-lg`). Sharp zero-radius and excessive pill shapes are excluded except for micro-counters.

## Components

### Buttons
- **Primary Action**: Bold, high-salience button in Sovereign Amber (`bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs px-3.5 py-2 shadow-sm`). Used for "Review Action Queue", "Verify Genuine QR", and "Advance Clock".
- **Secondary Action**: Subtle neutral container (`bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 shadow-sm px-3 py-2`).
- **Critical Action**: High-alert button in Tamper Rose (`bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs px-3.5 py-2`). Used for "Simulate Backdoor DB Sabotage" and "Reject Release".

### Chips & Provenance Badges
- **Tier 4 (Bank Confirmed)**: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 font-semibold px-2.5 py-0.5 rounded text-xs border`.
- **Tier 3 (Cross-Validated / Doc-Matched)**: `bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30 font-semibold px-2.5 py-0.5 rounded text-xs border`.
- **Tier 1 / 2 (Unverified / Self-Declared)**: `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 font-semibold px-2.5 py-0.5 rounded text-xs border`.
- **Critical Risk**: `bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30 font-bold font-mono px-2 py-0.5 rounded text-xs border`.

### Cards & Surface Containers
- **Standard Card**: `bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm`.
- **Telemetry Strip Card**: `bg-slate-50 dark:bg-zinc-950/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-zinc-800`.

### Inputs & Search Fields
- **Terminal Input**: `bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-sm`.

### Navigation
- **Header Bar**: Top sticky header with dark/light mode toggle, persona switcher, simulated time machine widget, and slide-out AICTE Copilot trigger.

### Named Rules
**The Non-Repudiation Action Rule.** Irreversible regulatory actions (Release Approval, Backdoor Sabotage Demo, Key Verification) must provide instant micro-state feedback (spinners, disabled state, color shifts) and log immediately to the SHA-256 ledger.

## Do's and Don'ts

### Do:
- **Do** use monospace fonts (`font-mono`) for all FDR serial numbers, IFSC codes, monetary amounts, and timestamps.
- **Do** maintain strict dual light/dark theme contrast compliance with 1px border contours.
- **Do** display the 4-Tier Provenance Badge on every data card and table row.
- **Do** anchor primary actions in solid Sovereign Amber (`#f59e0b`) with dark slate foreground text.
- **Do** preserve dense, information-rich layouts that maximize screen real estate during review shifts.

### Don't:
- **Don't** use low-contrast or light-colored text on unverified warning backgrounds.
- **Don't** separate visual document scans from extracted OCR values during forensic review.
- **Don't** invent generic pastel or whimsical accent colors outside the defined FinSec semantic palette.
- **Don't** apply heavy decorative box-shadows or gradients that distract from forensic document inspection.
- **Don't** truncate cryptographic hashes or monetary amounts without a one-click copy or inspect affordance.
