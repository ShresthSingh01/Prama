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
  <div className="px-3 py-2.5 rounded-xl border border-purple-300 dark:border-purple-500/60 bg-white dark:bg-zinc-900 text-xs shadow-md min-w-[160px]">
    <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2 !h-2" />
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
        <Landmark className="w-3.5 h-3.5" />
      </div>
      <div className="overflow-hidden">
        <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[110px]">{data.label}</div>
        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Scheduled Bank</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2 !h-2" />
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
  const [filterMode, setFilterMode] = useState<"ALL" | "SYNDICATE" | "INSTITUTIONS" | "BANKS">("ALL");

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

  // Layout positions using grid columns
  useEffect(() => {
    if (!graphData) return;

    let targetRawNodes = graphData.nodes;

    if (filterMode === "SYNDICATE" && activeRing) {
      const ringInsts = new Set(activeRing.involved_institutions);
      targetRawNodes = targetRawNodes.filter(n => 
        ringInsts.has(n.label) || 
        (activeRing.fdr_number && n.label.includes(activeRing.fdr_number)) ||
        n.type === "document"
      );
    } else if (filterMode === "INSTITUTIONS") {
      targetRawNodes = targetRawNodes.filter(n => n.type === "institution");
    } else if (filterMode === "BANKS") {
      targetRawNodes = targetRawNodes.filter(n => n.type === "bank" || n.type === "fdr");
    }

    const ringInstitutions = new Set(activeRing?.involved_institutions || []);
    const ringFdr = activeRing?.fdr_number;

    const columnX: Record<string, number> = {
      institution: 100,
      bank: 500,
      fdr: 900,
      document: 1300
    };

    const rowCounters: Record<string, number> = {
      institution: 0,
      bank: 0,
      fdr: 0,
      document: 0
    };

    const flowNodes: Node[] = targetRawNodes.map((n) => {
      const col = n.type in columnX ? n.type : "institution";
      const x = columnX[col] + (Math.sin(rowCounters[col]) * 40);
      const y = rowCounters[col] * 90 + 50;
      rowCounters[col]++;

      const isRingMember = 
        ringInstitutions.has(n.label) || 
        (Boolean(ringFdr) && n.label.includes(ringFdr || "")) ||
        n.type === "document";

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
        const sourceNode = targetRawNodes.find(n => n.id === l.source);
        const targetNode = targetRawNodes.find(n => n.id === l.target);
        const isRingEdge = Boolean(
          (sourceNode && ringInstitutions.has(sourceNode.label)) ||
          (targetNode && ringInstitutions.has(targetNode.label)) ||
          (sourceNode && ringFdr && sourceNode.label.includes(ringFdr)) ||
          (targetNode && ringFdr && targetNode.label.includes(ringFdr))
        );

        flowEdges.push({
          id: `e-${l.source}-${l.target}-${idx}`,
          source: l.source,
          target: l.target,
          animated: isRingEdge,
          style: {
            stroke: isRingEdge ? "#ef4444" : (isDark ? "#52525b" : "#94a3b8"),
            strokeWidth: isRingEdge ? 2.5 : 1.2,
            opacity: isRingEdge ? 1 : 0.6
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isRingEdge ? "#ef4444" : (isDark ? "#52525b" : "#94a3b8"),
            width: 14,
            height: 14
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
            Bank & College Risk Network (Fraud Ring Detection)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Interactive relationship map identifying duplicate fixed deposit certificates, shared serial numbers, and common bank branches.
          </p>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1 rounded-lg text-xs shadow-sm">
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-3 py-1 rounded-md font-medium transition ${filterMode === "ALL" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            All Nodes
          </button>
          <button
            onClick={() => setFilterMode("SYNDICATE")}
            className={`px-3 py-1 rounded-md font-medium transition ${filterMode === "SYNDICATE" ? "bg-rose-500 text-white font-bold" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Fraud Rings Only
          </button>
          <button
            onClick={() => setFilterMode("INSTITUTIONS")}
            className={`px-3 py-1 rounded-md font-medium transition ${filterMode === "INSTITUTIONS" ? "bg-blue-600 text-white font-bold" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Institutions
          </button>
          <button
            onClick={() => setFilterMode("BANKS")}
            className={`px-3 py-1 rounded-md font-medium transition ${filterMode === "BANKS" ? "bg-purple-600 text-white font-bold" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Banks & FDRs
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
              <span>Discovered Collusion Rings ({graphData?.collusion_rings.length || 0})</span>
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
