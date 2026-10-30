"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  Handle,
  Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Network, AlertTriangle, ShieldAlert, Sparkles,
  Building2, Landmark, FileText, ChevronRight, RefreshCw,
  Info, Eye, ArrowRight,
  ExternalLink, CheckCircle2, X, Filter
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

interface RawNode {
  id: string;
  label: string;
  type: "institution" | "bank" | "fdr" | "document";
  state?: string;
  amount?: number;
  risk?: string;
  size?: number;
  sha256?: string;
}

interface RawLink {
  source: string;
  target: string;
  relation: string;
}

interface CollusionRing {
  type: string;
  fdr_number?: string;
  sha256?: string;
  involved_institutions: string[];
  severity: string;
  explanation: string;
}

interface GraphData {
  nodes: RawNode[];
  links: RawLink[];
  collusion_rings: CollusionRing[];
  total_nodes: number;
  total_links: number;
}

// Custom Node Components
const InstitutionNode = ({ data }: { data: any }) => (
  <div className={`px-3 py-2.5 rounded-xl border text-xs shadow-md min-w-[170px] bg-white dark:bg-zinc-900 transition-all ${
    data.isRingMember 
      ? "border-red-500 shadow-red-500/20 ring-2 ring-red-500/40 scale-105" 
      : "border-slate-200 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500"
  }`}>
    <Handle type="target" position={Position.Top} className="!bg-slate-400 dark:!bg-zinc-500 !w-2 !h-2" />
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${data.isRingMember ? "bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400" : "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"}`}>
        <Building2 className="w-3.5 h-3.5" />
      </div>
      <div className="overflow-hidden">
        <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[120px]">{data.label}</div>
        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{data.state || "Technical College"}</div>
      </div>
    </div>
    {data.risk && (
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500 dark:text-zinc-400">Risk Level:</span>
        <span className={`px-1.5 py-0.5 rounded font-mono font-semibold ${
          data.risk === "CRITICAL" ? "bg-rose-100 text-rose-800 dark:bg-red-900/60 dark:text-red-300" :
          data.risk === "HIGH" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
        }`}>
          {data.risk}
        </span>
      </div>
    )}
    <Handle type="source" position={Position.Bottom} className="!bg-slate-400 dark:!bg-zinc-500 !w-2 !h-2" />
  </div>
);

const BankNode = ({ data }: { data: any }) => (
  <div className="px-3 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-500/60 bg-white dark:bg-zinc-900 text-xs shadow-md min-w-[160px]">
    <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-2 !h-2" />
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
        <Landmark className="w-3.5 h-3.5" />
      </div>
      <div className="overflow-hidden">
        <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[110px]">{data.label}</div>
        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Scheduled Bank</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-2 !h-2" />
  </div>
);

const FdrNode = ({ data }: { data: any }) => (
  <div className={`px-3 py-2 rounded-xl border text-xs shadow-md min-w-[150px] bg-white dark:bg-zinc-900 transition-all ${
    data.isRingMember 
      ? "border-red-500 ring-2 ring-red-500/40 bg-red-50 dark:bg-red-950/20" 
      : "border-amber-300 dark:border-amber-500/60"
  }`}>
    <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${data.isRingMember ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"}`}>
        <FileText className="w-3.5 h-3.5" />
      </div>
      <div className="overflow-hidden">
        <div className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 truncate max-w-[100px]">{data.label}</div>
        <div className="text-[10px] text-slate-500 dark:text-zinc-400">
          {data.amount ? `₹${(data.amount / 100000).toFixed(1)}L` : "FDR Deposit"}
        </div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2" />
  </div>
);

const DocumentClashNode = ({ data }: { data: any }) => (
  <div className="px-3 py-2.5 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-zinc-900 text-xs shadow-xl min-w-[170px] animate-pulse">
    <Handle type="target" position={Position.Top} className="!bg-red-500 !w-2 !h-2" />
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
        <ShieldAlert className="w-4 h-4" />
      </div>
      <div className="overflow-hidden">
        <div className="font-bold text-red-700 dark:text-red-400 truncate max-w-[110px]">{data.label}</div>
        <div className="text-[10px] text-red-600 dark:text-red-300 font-mono font-semibold">DUPLICATE FDR CLASH</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-red-500 !w-2 !h-2" />
  </div>
);

const nodeTypes = {
  institution: InstitutionNode,
  bank: BankNode,
  fdr: FdrNode,
  document: DocumentClashNode
};

export default function GraphPage() {
  const { isDark } = useTheme();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRing, setActiveRing] = useState<CollusionRing | null>(null);
  const [selectedNode, setSelectedNode] = useState<RawNode | null>(null);
  const [filterMode, setFilterMode] = useState<"SYNDICATE" | "ALL" | "INSTITUTIONS" | "BANKS">("SYNDICATE");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const loadGraph = async () => {
    try {
      setLoading(true);
      let data: GraphData;
      try {
        data = await fetchApi<GraphData>("/graph/rings");
      } catch {
        data = await fetchApi<GraphData>("/graph/syndicate");
      }
      setGraphData(data);
      if (data.collusion_rings.length > 0) {
        setActiveRing(data.collusion_rings[0]);
      }
    } catch (e) {
      console.error("Failed to load fraud ring graph:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // Layout positions: High-performance, explainable 3-tier syndicate layout
  useEffect(() => {
    if (!graphData) return;

    if (filterMode === "SYNDICATE" && activeRing) {
      const ringInsts = new Set(activeRing.involved_institutions);
      const ringFdr = activeRing.fdr_number;
      const ringSha = activeRing.sha256;

      // 1. Colleges involved in this specific ring
      const instNodes = graphData.nodes.filter(
        n => n.type === "institution" && ringInsts.has(n.label)
      );
      const instIds = new Set(instNodes.map(n => n.id));

      // 2. Shared FDR Serial instrument
      const fdrNodes = graphData.nodes.filter(n => {
        if (n.type !== "fdr") return false;
        if (ringFdr && n.label.includes(ringFdr)) return true;
        return graphData.links.some(l => instIds.has(l.source) && l.target === n.id);
      });
      const fdrIds = new Set(fdrNodes.map(n => n.id));

      // 3. Clashed Document node (if applicable)
      const docNodes = graphData.nodes.filter(n => {
        if (n.type !== "document") return false;
        if (ringSha && (n.id.includes(ringSha.slice(0, 8)) || (n.sha256 && n.sha256.startsWith(ringSha.slice(0, 8))))) return true;
        return graphData.links.some(l => fdrIds.has(l.source) && l.target === n.id);
      });
      const docIds = new Set(docNodes.map(n => n.id));

      // 4. Commercial Bank issuing the instrument
      const bankNodes = graphData.nodes.filter(n => {
        if (n.type !== "bank") return false;
        return graphData.links.some(l => fdrIds.has(l.source) && l.target === n.id);
      });
      const bankIds = new Set(bankNodes.map(n => n.id));

      const flowNodes: Node[] = [];

      // Col 1 (Left): Colluding Colleges
      const instStartY = Math.max(50, 220 - (instNodes.length * 55));
      instNodes.forEach((n, idx) => {
        flowNodes.push({
          id: n.id,
          type: n.type,
          position: { x: 80, y: instStartY + idx * 130 },
          data: {
            label: n.label,
            state: n.state,
            amount: n.amount,
            risk: n.risk || "CRITICAL",
            isRingMember: true
          }
        });
      });

      // Col 2 (Center): Shared Duplicate FDR & Clashed Documents
      fdrNodes.forEach((n, idx) => {
        flowNodes.push({
          id: n.id,
          type: n.type,
          position: { x: 500, y: 140 + idx * 150 },
          data: {
            label: n.label,
            state: n.state,
            amount: n.amount,
            risk: "CRITICAL",
            isRingMember: true
          }
        });
      });

      docNodes.forEach((n, idx) => {
        flowNodes.push({
          id: n.id,
          type: n.type,
          position: { x: 500, y: 310 + idx * 150 },
          data: {
            label: n.label,
            state: n.state,
            amount: n.amount,
            risk: "CRITICAL",
            isRingMember: true
          }
        });
      });

      // Col 3 (Right): Issuing Bank Branch
      bankNodes.forEach((n, idx) => {
        flowNodes.push({
          id: n.id,
          type: n.type,
          position: { x: 920, y: 180 + idx * 150 },
          data: {
            label: n.label,
            state: n.state,
            amount: n.amount,
            risk: n.risk,
            isRingMember: false
          }
        });
      });

      const activeIds = new Set(flowNodes.map(n => n.id));
      const flowEdges: Edge[] = [];

      graphData.links.forEach((l, idx) => {
        if (activeIds.has(l.source) && activeIds.has(l.target)) {
          const isDuplicatePledge = instIds.has(l.source) && fdrIds.has(l.target);
          const isDocClash = fdrIds.has(l.source) && docIds.has(l.target);
          const isBankLink = fdrIds.has(l.source) && bankIds.has(l.target);

          let edgeLabel = "";
          if (isDuplicatePledge) edgeLabel = "DUPLICATE PLEDGE";
          else if (isDocClash) edgeLabel = "CLASHED FILE";
          else if (isBankLink) edgeLabel = "ISSUED AT";

          flowEdges.push({
            id: `e-${l.source}-${l.target}-${idx}`,
            source: l.source,
            target: l.target,
            animated: true,
            label: edgeLabel,
            labelStyle: {
              fill: isDuplicatePledge ? "#ef4444" : "#8b5cf6",
              fontWeight: 700,
              fontSize: 10,
              fontFamily: "monospace"
            },
            labelBgStyle: {
              fill: isDark ? "#18181b" : "#ffffff",
              fillOpacity: 0.9,
              rx: 4
            },
            style: {
              stroke: isDuplicatePledge ? "#ef4444" : "#8b5cf6",
              strokeWidth: isDuplicatePledge ? 2.5 : 2,
              strokeDasharray: isDuplicatePledge ? "5 5" : undefined
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isDuplicatePledge ? "#ef4444" : "#8b5cf6",
              width: 14,
              height: 14
            }
          });
        }
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      return;
    }

    // Grid Layout for ALL, INSTITUTIONS, or BANKS view modes
    let targetRawNodes = graphData.nodes;
    if (filterMode === "INSTITUTIONS") {
      targetRawNodes = targetRawNodes.filter(n => n.type === "institution").slice(0, 30);
    } else if (filterMode === "BANKS") {
      targetRawNodes = targetRawNodes.filter(n => n.type === "bank" || n.type === "fdr").slice(0, 30);
    } else {
      const ringInsts = new Set(graphData.collusion_rings.flatMap(r => r.involved_institutions));
      const ringNodes = targetRawNodes.filter(n => ringInsts.has(n.label) || n.risk === "CRITICAL");
      const otherNodes = targetRawNodes.filter(n => !ringInsts.has(n.label) && n.risk !== "CRITICAL");
      targetRawNodes = [...ringNodes, ...otherNodes].slice(0, 35);
    }

    const cols = 5;
    const colWidth = 240;
    const rowHeight = 130;

    const flowNodes: Node[] = targetRawNodes.map((n, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * colWidth + 60;
      const y = row * rowHeight + 60;

      const isRingMember = graphData.collusion_rings.some(
        r => r.involved_institutions.includes(n.label) || (r.fdr_number && n.label.includes(r.fdr_number))
      );

      return {
        id: n.id,
        type: n.type,
        position: { x, y },
        data: {
          label: n.label,
          state: n.state,
          amount: n.amount,
          risk: n.risk,
          isRingMember
        }
      };
    });

    const nodeIds = new Set(targetRawNodes.map(n => n.id));
    const flowEdges: Edge[] = [];

    graphData.links.forEach((l, idx) => {
      if (nodeIds.has(l.source) && nodeIds.has(l.target)) {
        flowEdges.push({
          id: `e-all-${l.source}-${l.target}-${idx}`,
          source: l.source,
          target: l.target,
          animated: false,
          style: {
            stroke: isDark ? "#52525b" : "#94a3b8",
            strokeWidth: 1.2,
            opacity: 0.6
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDark ? "#52525b" : "#94a3b8",
            width: 12,
            height: 12
          }
        });
      }
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, activeRing, filterMode, isDark]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const raw = graphData?.nodes.find(n => n.id === node.id);
    if (raw) setSelectedNode(raw);
  }, [graphData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Generating interactive risk network graph...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-amber-500" />
            Duplicate FDR &amp; Fraud Ring Detection Network
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Interactive AICTE relationship graph detecting duplicate fixed deposit certificates, shared serial numbers, and multi-college collusion.
          </p>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1 rounded-lg text-xs shadow-sm">
          <button
            onClick={() => setFilterMode("SYNDICATE")}
            className={`px-3 py-1.5 rounded-md font-semibold transition flex items-center gap-1.5 ${filterMode === "SYNDICATE" ? "bg-rose-500 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Fraud Rings (Focused)</span>
          </button>
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${filterMode === "ALL" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Cluster Overview
          </button>
          <button
            onClick={() => setFilterMode("INSTITUTIONS")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${filterMode === "INSTITUTIONS" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Colleges Only
          </button>
          <button
            onClick={() => setFilterMode("BANKS")}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${filterMode === "BANKS" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Banks &amp; FDRs
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[650px]">
        {/* Left Side: Active Collusion Rings list */}
        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Suspected Duplicate Groups ({graphData?.collusion_rings.length || 0})</span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-red-950 dark:text-red-300 border border-rose-200 dark:border-red-800">
              Rule R08
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[560px] pr-1">
            {graphData?.collusion_rings.map((ring, idx) => {
              const isSelected = activeRing?.fdr_number === ring.fdr_number && activeRing?.sha256 === ring.sha256;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveRing(ring)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-rose-50 border-rose-400 dark:bg-red-950/40 dark:border-red-500 ring-1 ring-rose-400 dark:ring-red-500/50"
                      : "bg-slate-50 border-slate-200 dark:bg-zinc-950/60 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-600 dark:text-red-400">{ring.type}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-red-900/80 dark:text-white rounded font-bold">
                      {ring.severity}
                    </span>
                  </div>
                  {ring.fdr_number && (
                    <div className="mt-1 font-mono text-slate-700 dark:text-zinc-300 text-[11px] font-semibold">
                      FDR: {ring.fdr_number}
                    </div>
                  )}
                  <p className="mt-1.5 text-slate-600 dark:text-zinc-400 text-[11px] line-clamp-2">
                    {ring.explanation}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-500">
                    <span>Involved: {ring.involved_institutions.length} Colleges</span>
                    <ChevronRight className="w-3.5 h-3.5 text-rose-500 dark:text-red-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center / Right: Interactive React Flow Vector Graph */}
        <div className="lg:col-span-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl relative overflow-hidden h-[650px] shadow-sm">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            colorMode={isDark ? "dark" : "light"}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2.5}
          >
            <Background color={isDark ? "#3f3f46" : "#cbd5e1"} gap={20} size={1} />
            <Controls className="!bg-white dark:!bg-zinc-900 !border-slate-200 dark:!border-zinc-700 !text-slate-700 dark:!text-zinc-200 shadow-sm" />
            <MiniMap
              className="!bg-white dark:!bg-zinc-900 !border-slate-200 dark:!border-zinc-800 shadow-sm"
              nodeColor={(n) => {
                if (n.type === "institution") return "#3b82f6";
                if (n.type === "bank") return "#a855f7";
                if (n.type === "fdr") return "#f59e0b";
                return "#ef4444";
              }}
            />
          </ReactFlow>

          {/* Collusion Banner overlay */}
          {activeRing && (
            <div className="absolute top-3 left-3 z-10 max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-rose-300 dark:border-red-500/80 rounded-xl p-3.5 text-xs shadow-xl">
              <div className="flex items-center justify-between text-rose-600 dark:text-red-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Active Risk Ring: {activeRing.type}
                </span>
                <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-red-950 dark:text-red-300 border border-rose-200 dark:border-red-800 px-2 py-0.5 rounded font-bold">
                  {activeRing.severity}
                </span>
              </div>
              <p className="mt-1 text-slate-700 dark:text-zinc-300 text-[11px]">
                {activeRing.explanation}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {activeRing.involved_institutions.map((inst, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-medium border border-slate-200 dark:border-zinc-700">
                    {inst}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Node Click Flyout Drawer */}
          {selectedNode && (
            <div className="absolute bottom-3 right-3 z-10 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-xs shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-zinc-800">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-500" />
                  Node Details
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="text-slate-500 dark:text-zinc-400 text-[10px] uppercase font-semibold">Entity Label</div>
                <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{selectedNode.label}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Type:</span>
                  <span className="ml-1 font-semibold uppercase text-slate-800 dark:text-zinc-200">{selectedNode.type}</span>
                </div>
                {selectedNode.state && (
                  <div>
                    <span className="text-slate-500 dark:text-zinc-400">State:</span>
                    <span className="ml-1 text-slate-800 dark:text-zinc-200">{selectedNode.state}</span>
                  </div>
                )}
                {selectedNode.amount && (
                  <div className="col-span-2">
                    <span className="text-slate-500 dark:text-zinc-400">Amount:</span>
                    <span className="ml-1 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      ₹{selectedNode.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              {selectedNode.type === "fdr" && (
                <Link
                  href={`/inspector/1`}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 rounded-lg font-bold text-xs transition shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Deposit Details</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
