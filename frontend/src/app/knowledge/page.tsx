"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  BookOpen, GitBranch, RefreshCw,
  Sliders, ArrowRight, Check
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

interface ConceptMeta {
  id: string;
  path: string;
  type: string;
  title: string;
  parameters: Record<string, any>;
  related: string[];
  source?: string;
}

interface ConceptDetail extends ConceptMeta {
  body: string;
}

interface ConceptsResponse {
  concepts: ConceptMeta[];
  graph: {
    nodes: Array<{ id: string; path: string; label: string; type: string }>;
    links: Array<{ source: string; target: string; relation: string }>;
  };
}

// Concept Node Component
const ConceptNode = ({ data }: { data: any }) => {
  const isSelected = data.isSelected;
  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    rule: { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-500/40" },
    policy: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-500/40" },
    bank: { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-400", border: "border-purple-300 dark:border-purple-500/40" },
    lifecycle: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-300 dark:border-emerald-500/40" },
    regulation: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/40" },
  };

  const style = typeColors[data.type] || { bg: "bg-slate-50 dark:bg-zinc-800", text: "text-slate-700 dark:text-zinc-300", border: "border-slate-300 dark:border-zinc-700" };

  return (
    <div className={`px-3 py-2.5 rounded-xl border text-xs shadow-md min-w-[160px] bg-white dark:bg-zinc-900 transition-all ${
      isSelected 
        ? "ring-2 ring-amber-500 border-amber-500 scale-105 shadow-xl" 
        : style.border
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 dark:!bg-zinc-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${style.bg} ${style.text}`}>
          {data.type}
        </span>
      </div>
      <div className="mt-1 font-semibold text-slate-900 dark:text-zinc-100 truncate max-w-[150px]">{data.label}</div>
      {data.parametersCount > 0 && (
        <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-mono">
          {data.parametersCount} bound parameter(s)
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 dark:!bg-zinc-500 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  concept: ConceptNode
};

export default function KnowledgePage() {
  const { isDark } = useTheme();
  const [conceptsData, setConceptsData] = useState<ConceptsResponse | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("rules/R01-fdr-number-format.md");
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloading, setReloading] = useState<boolean>(false);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const loadConcepts = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<ConceptsResponse>("/knowledge/concepts");
      setConceptsData(data);
      if (data.concepts && data.concepts.length > 0) {
        if (!data.concepts.some(c => c.path === selectedPath)) {
          setSelectedPath(data.concepts[0].path);
        }
      }
    } catch (e) {
      console.error("Failed to load knowledge concepts:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadConceptDetail = async (path: string) => {
    try {
      let data: ConceptDetail;
      try {
        data = await fetchApi<ConceptDetail>(`/knowledge/concepts/${path}`);
      } catch {
        data = await fetchApi<ConceptDetail>(`/knowledge/concept?path=${encodeURIComponent(path)}`);
      }
      setConceptDetail(data);
    } catch (e) {
      console.error("Failed to load concept detail:", e);
    }
  };

  useEffect(() => {
    loadConcepts();
  }, []);

  useEffect(() => {
    if (selectedPath) {
      loadConceptDetail(selectedPath);
    }
  }, [selectedPath]);

  // Construct React Flow graph
  useEffect(() => {
    if (!conceptsData) return;

    const columnX: Record<string, number> = {
      regulation: 50,
      policy: 350,
      rule: 650,
      bank: 950,
      lifecycle: 1250
    };

    const rowCounters: Record<string, number> = {
      regulation: 0,
      policy: 0,
      rule: 0,
      bank: 0,
      lifecycle: 0
    };

    const flowNodes: Node[] = conceptsData.graph.nodes.map((n) => {
      const col = n.type in columnX ? n.type : "rule";
      const x = columnX[col] + (Math.sin(rowCounters[col]) * 30);
      const y = rowCounters[col] * 90 + 50;
      rowCounters[col]++;

      const meta = conceptsData.concepts.find(c => c.path === n.path);
      const parametersCount = Object.keys(meta?.parameters || {}).length;

      return {
        id: n.id,
        type: "concept",
        position: { x, y },
        data: {
          label: n.label,
          type: n.type,
          path: n.path,
          parametersCount,
          isSelected: n.path === selectedPath
        }
      };
    });

    const nodeIds = new Set(conceptsData.graph.nodes.map(n => n.id));
    const flowEdges: Edge[] = [];

    conceptsData.graph.links.forEach((l, idx) => {
      if (nodeIds.has(l.source) && nodeIds.has(l.target)) {
        flowEdges.push({
          id: `e-k-${l.source}-${l.target}-${idx}`,
          source: l.source,
          target: l.target,
          animated: l.relation === "governs",
          style: {
            stroke: l.relation === "governs" ? "#f59e0b" : (isDark ? "#52525b" : "#94a3b8"),
            strokeWidth: 1.5,
            opacity: 0.6
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: l.relation === "governs" ? "#f59e0b" : (isDark ? "#52525b" : "#94a3b8"),
            width: 14,
            height: 14
          }
        });
      }
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [conceptsData, selectedPath, isDark]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const path = (node.data as any)?.path;
    if (path) setSelectedPath(path);
  }, []);

  const handleReloadBundle = async () => {
    setReloading(true);
    setReloadMsg(null);
    try {
      const res = await fetchApi<any>("/knowledge/reload", { method: "POST" });
      setReloadMsg(`Knowledge bundle reloaded (${res.loaded_files_count} files). Audit logged.`);
      await loadConcepts();
      if (selectedPath) await loadConceptDetail(selectedPath);
    } catch (e: any) {
      setReloadMsg(`Reload failed: ${e.message}`);
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading AICTE compliance handbook & rule specifications...</span>
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
            <BookOpen className="w-5 h-5 text-amber-500" />
            AICTE Rules & Compliance Policies (Open Knowledge Format)
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Human-readable regulatory rules and threshold parameters bound live into the Prama automated scrutiny engine.
          </p>
        </div>

        <button
          onClick={handleReloadBundle}
          disabled={reloading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reloading ? "animate-spin text-amber-500" : ""}`} />
          <span>{reloading ? "Reloading..." : "Hot Reload Policies"}</span>
        </button>
      </div>

      {reloadMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{reloadMsg}</span>
        </div>
      )}

      {/* Main Grid: Vector Graph on Left, Document Viewer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[650px]">
        {/* Left: Concept Tree + Vector Graph */}
        <div className="lg:col-span-7 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl relative overflow-hidden h-[650px] flex flex-col shadow-sm">
          <div className="p-3 bg-white dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-amber-500" />
              Policy Concept Graph
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              {conceptsData?.concepts.length || 0} Policies • Click any node to inspect
            </span>
          </div>

          <div className="flex-1 relative">
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
              minZoom={0.3}
              maxZoom={2.0}
            >
              <Background color={isDark ? "#3f3f46" : "#cbd5e1"} gap={20} size={1} />
              <Controls className="!bg-white dark:!bg-zinc-900 !border-slate-200 dark:!border-zinc-700 !text-slate-700 dark:!text-zinc-200 shadow-sm" />
              <MiniMap
                className="!bg-white dark:!bg-zinc-900 !border-slate-200 dark:!border-zinc-800 shadow-sm"
                nodeColor={(n) => {
                  const t = (n.data as any)?.type;
                  if (t === "rule") return "#ef4444";
                  if (t === "policy") return "#3b82f6";
                  if (t === "bank") return "#a855f7";
                  return "#10b981";
                }}
              />
            </ReactFlow>
          </div>
        </div>

        {/* Right: Markdown Concept Viewer */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col h-[650px] overflow-y-auto shadow-sm">
          {conceptDetail ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                    {conceptDetail.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">{conceptDetail.path}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{conceptDetail.title}</h2>
              </div>

              {/* Bound Parameters Widget */}
              {Object.keys(conceptDetail.parameters || {}).length > 0 && (
                <div className="bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-700/80 rounded-xl p-3.5 text-xs space-y-1.5 shadow-sm">
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Active Threshold Parameters (Bound to Engine)</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-800 dark:text-zinc-300 overflow-x-auto p-2 bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800">
                    {JSON.stringify(conceptDetail.parameters, null, 2)}
                  </pre>
                </div>
              )}

              {/* Markdown Body */}
              <div className="text-slate-700 dark:text-zinc-300 leading-relaxed space-y-2 whitespace-pre-wrap font-sans text-xs">
                {conceptDetail.body}
              </div>

              {/* Related Links */}
              {conceptDetail.related && conceptDetail.related.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-2">Related Policies:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {conceptDetail.related.map((rel, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPath(rel)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md text-[10px] font-mono flex items-center gap-1 border border-slate-200 dark:border-zinc-700 transition"
                      >
                        <span>{rel}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 dark:text-zinc-400 text-xs font-medium">
              Select a policy node from the graph to inspect its clauses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
