"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Network, AlertTriangle, ShieldAlert, Sparkles, 
  Building2, Landmark, FileText, ChevronRight, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Info, Eye, Layers, ArrowRight,
  ExternalLink, CheckCircle2, X
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
  
  // Selection and Focus State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [activeRing, setActiveRing] = useState<CollusionRing | null>(null);
  const [filterMode, setFilterMode] = useState<"ALL" | "SYNDICATE" | "INSTITUTIONS" | "BANKS">("ALL");
  const [showExplanationModal, setShowExplanationModal] = useState<boolean>(false);

  // Zoom & Pan state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNode = useRef<GraphNode | null>(null);

  // Persistent nodes simulation array
  const simNodes = useRef<GraphNode[]>([]);
  const simLinks = useRef<GraphLink[]>([]);

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

  // Initialize and filter simulation nodes
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    let targetNodes = graphData.nodes;
    if (filterMode === "SYNDICATE") {
      targetNodes = graphData.nodes.filter(n => 
        n.label.includes("Apex") || n.label.includes("SYNDICATE") || n.label.includes("State Bank")
      );
    } else if (filterMode === "INSTITUTIONS") {
      targetNodes = graphData.nodes.filter(n => n.type === "institution").slice(0, 45);
    } else if (filterMode === "BANKS") {
      targetNodes = graphData.nodes.filter(n => n.type === "bank" || n.type === "fdr").slice(0, 45);
    } else {
      // High-impact subset for clarity & performance
      targetNodes = graphData.nodes.slice(0, 65);
    }

    const nodeMap = new Map<string, GraphNode>();
    simNodes.current = targetNodes.map((n, i) => {
      const angle = (i / targetNodes.length) * Math.PI * 2;
      const radius = 120 + Math.random() * 140;
      const nodeObj: GraphNode = {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      };
      nodeMap.set(n.id, nodeObj);
      return nodeObj;
    });

    simLinks.current = graphData.links.filter(l => 
      nodeMap.has(l.source) && nodeMap.has(l.target)
    );
  }, [graphData, filterMode]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Physics step
      const nodes = simNodes.current;
      const links = simLinks.current;
      const nodeMap = new Map<string, GraphNode>();
      nodes.forEach(n => nodeMap.set(n.id, n));

      // Node repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = (n2.x || 0) - (n1.x || 0);
          const dy = (n2.y || 0) - (n1.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 160) {
            const force = (160 - dist) / dist * 0.05;
            if (n1 !== draggedNode.current) {
              n1.vx = (n1.vx || 0) - dx * force;
              n1.vy = (n1.vy || 0) - dy * force;
            }
            if (n2 !== draggedNode.current) {
              n2.vx = (n2.vx || 0) + dx * force;
              n2.vy = (n2.vy || 0) + dy * force;
            }
          }
        }
      }

      // Link attraction
      links.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (s && t) {
          const dx = (t.x || 0) - (s.x || 0);
          const dy = (t.y || 0) - (s.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 85) * 0.006;
          if (s !== draggedNode.current) {
            s.vx = (s.vx || 0) + dx * force;
            s.vy = (s.vy || 0) + dy * force;
          }
          if (t !== draggedNode.current) {
            t.vx = (t.vx || 0) - dx * force;
            t.vy = (t.vy || 0) - dy * force;
          }
        }
      });

      // Position update with bounds and damping
      nodes.forEach(n => {
        if (n !== draggedNode.current) {
          n.x = Math.max(40, Math.min(width - 40, (n.x || 0) + (n.vx || 0)));
          n.y = Math.max(40, Math.min(height - 40, (n.y || 0) + (n.vy || 0)));
          n.vx = (n.vx || 0) * 0.86;
          n.vy = (n.vy || 0) * 0.86;
        }
      });

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Determine active highlight neighborhood if a node is selected or hovered
      const activeId = selectedNode?.id || hoveredNode?.id;
      const neighborIds = new Set<string>();
      if (activeId) {
        neighborIds.add(activeId);
        links.forEach(l => {
          if (l.source === activeId) neighborIds.add(l.target);
          if (l.target === activeId) neighborIds.add(l.source);
        });
      }

      // 1. Draw Links
      links.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (s && t) {
          const isHighlighted = activeId && (l.source === activeId || l.target === activeId);
          const isDimmed = activeId && !isHighlighted;

          ctx.beginPath();
          ctx.moveTo(s.x || 0, s.y || 0);
          ctx.lineTo(t.x || 0, t.y || 0);

          if (isHighlighted) {
            ctx.strokeStyle = "#f43f5e";
            ctx.lineWidth = 2.5;
          } else if (isDimmed) {
            ctx.strokeStyle = "rgba(39, 39, 42, 0.2)";
            ctx.lineWidth = 0.5;
          } else {
            ctx.strokeStyle = "rgba(82, 82, 91, 0.35)";
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      });

      // 2. Draw Nodes
      nodes.forEach(n => {
        const isSelected = selectedNode?.id === n.id;
        const isHovered = hoveredNode?.id === n.id;
        const isNeighbor = neighborIds.has(n.id);
        const isDimmed = activeId && !isNeighbor;

        const radius = (n.size * 0.6) * (isHovered || isSelected ? 1.4 : 1.0);

        ctx.beginPath();
        ctx.arc(n.x || 0, n.y || 0, radius, 0, Math.PI * 2);

        // Node fill color by type & anomaly status
        if (n.label.includes("Apex") || n.label.includes("SYNDICATE")) {
          ctx.fillStyle = isDimmed ? "rgba(244, 63, 94, 0.2)" : "#f43f5e"; // Pulsing red
        } else if (n.type === "institution") {
          ctx.fillStyle = isDimmed ? "rgba(56, 189, 248, 0.2)" : "#38bdf8"; // Sky Blue
        } else if (n.type === "bank") {
          ctx.fillStyle = isDimmed ? "rgba(16, 185, 129, 0.2)" : "#10b981"; // Emerald
        } else if (n.type === "fdr") {
          ctx.fillStyle = isDimmed ? "rgba(168, 85, 247, 0.2)" : "#a855f7"; // Purple
        } else {
          ctx.fillStyle = isDimmed ? "rgba(245, 158, 11, 0.2)" : "#f59e0b"; // Amber
        }

        ctx.fill();

        // Stroke & Halo
        if (isSelected || isHovered) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#ffffff";
        } else {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = isDimmed ? "rgba(9, 9, 11, 0.4)" : "#09090b";
        }
        ctx.stroke();

        // Node Label
        if (!isDimmed || isNeighbor || transform.scale > 1.2) {
          ctx.font = isSelected || isHovered ? "bold 11px monospace" : "9px monospace";
          ctx.fillStyle = isSelected || isHovered ? "#ffffff" : isDimmed ? "#52525b" : "#d4d4d8";
          ctx.fillText(n.label.slice(0, 20), (n.x || 0) + radius + 4, (n.y || 0) + 3);
        }
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedNode, hoveredNode, transform]);

  // Convert client mouse coordinates to world canvas coordinates (accounting for zoom/pan)
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: (clientX - transform.x) / transform.scale,
      y: (clientY - transform.y) / transform.scale
    };
  };

  const findNodeAtPosition = (worldX: number, worldY: number): GraphNode | null => {
    for (const n of simNodes.current) {
      const dx = (n.x || 0) - worldX;
      const dy = (n.y || 0) - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= n.size * 1.2) {
        return n;
      }
    }
    return null;
  };

  // Canvas Mouse Interactions (Hover, Click, Drag, Pan)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);

    if (draggedNode.current) {
      draggedNode.current.x = x;
      draggedNode.current.y = y;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
      return;
    }

    if (isDraggingCanvas.current) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + (e.clientX - dragStart.current.x),
        y: prev.y + (e.clientY - dragStart.current.y)
      }));
      dragStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const hit = findNodeAtPosition(x, y);
    setHoveredNode(hit);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    const hit = findNodeAtPosition(x, y);

    if (hit) {
      draggedNode.current = hit;
      setSelectedNode(hit);
    } else {
      isDraggingCanvas.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    draggedNode.current = null;
    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.6, Math.min(2.5, prev.scale * zoomFactor))
    }));
  };

  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(2.5, prev.scale * 1.2) }));
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(0.6, prev.scale * 0.8) }));
  const resetView = () => setTransform({ scale: 1, x: 0, y: 0 });

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

  // Connected neighbors for the selected node
  const selectedNeighbors = selectedNode ? graphData.links.filter(l => 
    l.source === selectedNode.id || l.target === selectedNode.id
  ) : [];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            Interactive Collusion Topology & Syndicate Forensic Engine
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Click, drag, or hover any node to inspect relationship degree, isolate clusters, and explain statutory fraud syndicates.
          </p>
        </div>

        {/* View and Reset Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExplanationModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded text-xs font-semibold transition"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Explain Collusion Anatomy</span>
          </button>

          <button
            onClick={loadGraph}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-compute</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Canvas + Explainable Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Interactive Topology Canvas */}
        <div className="lg:col-span-8 bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            {/* Canvas Toolbar: Filter Chips + Legend + Zoom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
              {/* Cluster Filters */}
              <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-md border border-zinc-800">
                {(["ALL", "SYNDICATE", "INSTITUTIONS", "BANKS"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setFilterMode(mode);
                      setSelectedNode(null);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
                      filterMode === mode 
                        ? "bg-zinc-800 text-white font-bold shadow" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {mode === "SYNDICATE" ? "⚡ Collusion Syndicate" : mode}
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-sky-400">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span> College
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Bank
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> FDR Serial
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Collusion
                </span>
              </div>
            </div>

            {/* Interactive Canvas Container with Zoom Overlay */}
            <div className="relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={760}
                height={520}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-auto cursor-grab active:cursor-grabbing select-none"
              />

              {/* Floating Canvas Zoom Controls */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/80 p-1 rounded-md backdrop-blur">
                <button onClick={zoomIn} className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded" title="Zoom In">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button onClick={zoomOut} className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded" title="Zoom Out">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={resetView} className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded" title="Reset View">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hover Tooltip Overlay */}
              {hoveredNode && !selectedNode && (
                <div 
                  style={{
                    position: "absolute",
                    left: `${Math.min(600, Math.max(20, (hoveredNode.x || 0) * transform.scale + transform.x + 15))}px`,
                    top: `${Math.min(460, Math.max(20, (hoveredNode.y || 0) * transform.scale + transform.y - 15))}px`,
                    pointerEvents: "none"
                  }}
                  className="bg-zinc-950/95 border border-zinc-700 text-xs rounded-md p-2 shadow-2xl z-30 font-mono text-zinc-200 backdrop-blur"
                >
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {hoveredNode.label}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Type: {hoveredNode.type.toUpperCase()}</div>
                  {hoveredNode.state && <div className="text-[10px] text-zinc-400">State: {hoveredNode.state}</div>}
                  <div className="text-[9px] text-amber-400 mt-1">Click to lock & inspect connections</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800 mt-3 font-mono">
            <span>Graph Nodes: {simNodes.current.length} • Active Physics Links: {simLinks.current.length}</span>
            <span>Zoom: {Math.round(transform.scale * 100)}%</span>
          </div>
        </div>

        {/* Right 4 Cols: Explainable Node Inspector & Syndicate Anatomy */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Selected Node Deep Inspector */}
          {selectedNode ? (
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-lg p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  NODE FORENSIC INSPECTOR
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedNode.label}</h3>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Entity Type: <span className="text-zinc-200 font-semibold">{selectedNode.type.toUpperCase()}</span>
                  {selectedNode.state && ` • ${selectedNode.state}`}
                </div>
              </div>

              {/* Collusion indicator if part of the ring */}
              {selectedNode.label.includes("Apex") && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-500/60 rounded text-xs text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Cross-Institution Collusion Node</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This institution shares its physical FDR serial and document hash with 3 other colleges.
                  </p>
                </div>
              )}

              {/* Connections List */}
              <div className="space-y-1.5 text-xs">
                <div className="text-[11px] font-semibold text-zinc-300">
                  Direct Topology Connections ({selectedNeighbors.length}):
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {selectedNeighbors.map((link, idx) => {
                    const otherId = link.source === selectedNode.id ? link.target : link.source;
                    return (
                      <div key={idx} className="p-1.5 bg-zinc-950 rounded border border-zinc-800 text-[11px] font-mono flex items-center justify-between">
                        <span className="text-zinc-300 truncate">{otherId}</span>
                        <span className="text-[10px] text-amber-400">{link.relation}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Link
                href="/inspector/1"
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium transition flex items-center justify-center gap-1.5 border border-zinc-700"
              >
                <span>Open Full Instrument Dossier</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-400 space-y-2">
              <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Interactive Exploration Tip</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Click on any node in the topology canvas to lock its relationship neighborhood and view its statutory degree connections.
              </p>
            </div>
          )}

          {/* Collusion Ring Card */}
          {activeRing && (
            <div className="bg-rose-950/20 border border-rose-500/40 rounded-lg p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 animate-pulse" />
                  <span>Detected Syndicate Collusion</span>
                </div>
                <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-bold">
                  {activeRing.severity}
                </span>
              </div>

              <div>
                <div className="text-[10px] font-mono text-zinc-400">Shared Fixed Deposit Receipt Serial:</div>
                <div className="text-xs font-mono font-bold text-white mt-0.5">{activeRing.fdr_number}</div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-[11px] text-zinc-400">
                  Participating Technical Colleges ({activeRing.involved_institutions.length}):
                </div>
                <div className="space-y-1">
                  {activeRing.involved_institutions.map((inst, idx) => (
                    <div key={idx} className="p-2 rounded bg-zinc-950/80 border border-rose-900/60 text-zinc-200 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      <span className="truncate">{inst}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowExplanationModal(true)}
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition flex items-center justify-center gap-1.5 shadow"
              >
                <span>Explain Statutory Violation Anatomy</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deep Explainability Forensic Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Forensic Case File: Multi-Campus Collusion Syndicate</span>
              </div>
              <button onClick={() => setShowExplanationModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step-by-Step Anatomy of the Fraud */}
            <div className="space-y-4 text-xs">
              <p className="text-zinc-300 leading-relaxed">
                Traditional portals treat each college submission in isolation. Our graph engine performed multi-attribute cross-indexing across 604 deposits and detected the following synchronized breach:
              </p>

              <div className="space-y-3 font-mono text-[11px]">
                {/* Step 1 */}
                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span>1. The Root Deposit Instrument</span>
                  </div>
                  <p className="text-zinc-400">
                    FDR Serial: <strong className="text-white">SBIN/2026/APEX-SYNDICATE-99214</strong> issued at SBI Pune branch for ₹50,00,000.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span>2. The Synchronized Multi-Pledge</span>
                  </div>
                  <p className="text-zinc-400">
                    Four sister institutions under common management all submitted this exact receipt serial number and identical binary PDF document:
                  </p>
                  <ul className="list-disc pl-5 text-zinc-300 space-y-0.5 mt-1">
                    <li>Apex Allied Institute of Technology, Pune (Maharashtra)</li>
                    <li>Apex Allied College of Engineering, Nashik (Maharashtra)</li>
                    <li>Apex Allied Polytechnic College, Surat (Gujarat)</li>
                    <li>Apex Allied Institute of Pharmacy, Vadodara (Gujarat)</li>
                  </ul>
                </div>

                {/* Step 3 */}
                <div className="p-3 bg-rose-950/30 rounded-lg border border-rose-500/50 space-y-1 text-rose-300">
                  <div className="font-bold flex items-center gap-1.5 text-rose-400">
                    <span>3. Statutory Regulatory Violation</span>
                  </div>
                  <p className="leading-relaxed">
                    <strong>AICTE Approval Process Handbook (APH) Chapter II, Clause 2.14</strong>: A single security deposit cannot be pledged to multiple institutions. By multiplying one ₹50L deposit across 4 campuses, the trust created a <strong>₹1.5 Crore unbacked financial liability</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowExplanationModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-semibold transition"
              >
                Close Case File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
