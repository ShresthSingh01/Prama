"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Network, AlertTriangle, ShieldAlert, Sparkles, 
  Building2, Landmark, FileText, ChevronRight, RefreshCw
} from "lucide-react";
import { fetchApi } from "@/lib/api";

interface GraphNode {
  id: string;
  label: string;
  type: "institution" | "bank" | "fdr" | "document";
  state?: string;
  amount?: number;
  risk?: string;
  size: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
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
  nodes: GraphNode[];
  links: GraphLink[];
  collusion_rings: CollusionRing[];
  total_nodes: number;
  total_links: number;
}

export default function SyndicateGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeRing, setActiveRing] = useState<CollusionRing | null>(null);

  const loadGraph = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<GraphData>("/graph/rings");
      setGraphData(data);
      if (data.collusion_rings.length > 0) {
        setActiveRing(data.collusion_rings[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // HTML5 Canvas Force Physics Simulation
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Filter nodes to a manageable high-impact subset for performance and clarity
    // Focus on the collusion syndicate + 30 nearby institutions
    const syndicateFdr = graphData.collusion_rings[0]?.fdr_number;
    const priorityNodeIds = new Set<string>();
    
    // Find all links related to the collusion FDR
    graphData.links.forEach(l => {
      if (l.source.includes("fdr_") || l.target.includes("fdr_")) {
        priorityNodeIds.add(typeof l.source === "string" ? l.source : (l.source as any).id);
        priorityNodeIds.add(typeof l.target === "string" ? l.target : (l.target as any).id);
      }
    });

    const displayNodes: GraphNode[] = graphData.nodes.slice(0, 60).map(n => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * (width * 0.7),
      y: height / 2 + (Math.random() - 0.5) * (height * 0.7),
      vx: 0,
      vy: 0
    }));

    const nodeMap = new Map<string, GraphNode>();
    displayNodes.forEach(n => nodeMap.set(n.id, n));

    const displayLinks = graphData.links.filter(l => 
      nodeMap.has(l.source) && nodeMap.has(l.target)
    );

    let animationFrameId: number;

    const simulate = () => {
      // Simple force simulation
      // Repulsion between nodes
      for (let i = 0; i < displayNodes.length; i++) {
        for (let j = i + 1; j < displayNodes.length; j++) {
          const n1 = displayNodes[i];
          const n2 = displayNodes[j];
          const dx = (n2.x || 0) - (n1.x || 0);
          const dy = (n2.y || 0) - (n1.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (180 - dist) / dist * 0.04;
            n1.vx = (n1.vx || 0) - dx * force;
            n1.vy = (n1.vy || 0) - dy * force;
            n2.vx = (n2.vx || 0) + dx * force;
            n2.vy = (n2.vy || 0) + dy * force;
          }
        }
      }

      // Link spring attraction
      displayLinks.forEach(l => {
        const source = nodeMap.get(l.source);
        const target = nodeMap.get(l.target);
        if (source && target) {
          const dx = (target.x || 0) - (source.x || 0);
          const dy = (target.y || 0) - (source.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 90) * 0.005;
          source.vx = (source.vx || 0) + dx * force;
          source.vy = (source.vy || 0) + dy * force;
          target.vx = (target.vx || 0) - dx * force;
          target.vy = (target.vy || 0) - dy * force;
        }
      });

      // Update positions & damping
      displayNodes.forEach(n => {
        n.x = Math.max(30, Math.min(width - 30, (n.x || 0) + (n.vx || 0)));
        n.y = Math.max(30, Math.min(height - 30, (n.y || 0) + (n.vy || 0)));
        n.vx = (n.vx || 0) * 0.88;
        n.vy = (n.vy || 0) * 0.88;
      });

      // Draw canvas
      ctx.clearRect(0, 0, width, height);

      // Draw links
      displayLinks.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (s && t) {
          ctx.beginPath();
          ctx.moveTo(s.x || 0, s.y || 0);
          ctx.lineTo(t.x || 0, t.y || 0);
          ctx.strokeStyle = "rgba(63, 63, 70, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw nodes
      displayNodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x || 0, n.y || 0, n.size * 0.6, 0, Math.PI * 2);

        if (n.type === "institution") {
          ctx.fillStyle = n.label.includes("Apex") ? "#f43f5e" : "#38bdf8";
        } else if (n.type === "bank") {
          ctx.fillStyle = "#10b981";
        } else if (n.type === "fdr") {
          ctx.fillStyle = n.label.includes("SYNDICATE") ? "#f43f5e" : "#a855f7";
        } else {
          ctx.fillStyle = "#f59e0b";
        }

        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#09090b";
        ctx.stroke();

        // Node Label
        ctx.font = "9px monospace";
        ctx.fillStyle = "#a1a1aa";
        ctx.fillText(n.label.slice(0, 18), (n.x || 0) + 10, (n.y || 0) + 3);
      });

      animationFrameId = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [graphData]);

  if (loading || !graphData) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-zinc-400 font-mono">Synthesizing multi-institution relationship graph...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            Syndicated Collusion & Fraud Ring Topology
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Graph network linking Institutions, Banks, FDR Serials, and Binary Document Hashes to uncover coordinated misuse.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadGraph}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-compute Clusters</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Canvas + Syndicate Alert Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Interactive Topology Canvas */}
        <div className="lg:col-span-8 bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-zinc-200">Force-Directed Relationship View</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Institution
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Bank
                </span>
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> FDR Serial
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span> Syndicate Ring
                </span>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={760}
                height={500}
                className="w-full h-auto cursor-grab active:cursor-grabbing"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800 mt-3 font-mono">
            <span>Nodes: {graphData.total_nodes} • Edges: {graphData.total_links}</span>
            <span>Collusion Rings Detected: {graphData.collusion_rings.length}</span>
          </div>
        </div>

        {/* Right 4 Cols: Syndicate Ring Intelligence Panel */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Active Ring Alert Card */}
          {activeRing && (
            <div className="bg-rose-950/20 border border-rose-500/40 rounded-lg p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 animate-pulse" />
                <span>Detected Syndicate Collusion</span>
              </div>

              <div>
                <div className="text-xs font-mono text-zinc-400">Common FDR Serial:</div>
                <div className="text-sm font-mono font-bold text-white mt-0.5">{activeRing.fdr_number}</div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-[11px] text-zinc-400">Involved Colluding Institutions ({activeRing.involved_institutions.length}):</div>
                <div className="space-y-1">
                  {activeRing.involved_institutions.map((inst, idx) => (
                    <div key={idx} className="p-2 rounded bg-zinc-950/80 border border-rose-900/60 text-zinc-200 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span className="truncate">{inst}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300">
                {activeRing.explanation}
              </div>

              <Link
                href="/inspector/1"
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition flex items-center justify-center gap-1.5"
              >
                <span>Inspect Primary Collusion Node</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Collusion Rings List */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Discovered Multi-Institution Rings
            </h3>

            <div className="space-y-2">
              {graphData.collusion_rings.map((ring, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveRing(ring)}
                  className={`p-3 rounded border text-xs cursor-pointer transition ${
                    activeRing === ring
                      ? "bg-zinc-800 border-amber-500/50 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                    <span className="text-amber-400 font-bold">{ring.type}</span>
                    <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 rounded font-bold">{ring.severity}</span>
                  </div>
                  <div className="font-semibold text-zinc-200 truncate">{ring.fdr_number || ring.sha256?.slice(0, 16)}</div>
                  <div className="text-[10px] text-zinc-400 mt-1">{ring.involved_institutions.length} institutions cross-linked</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
