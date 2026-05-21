"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  FlowNode,
  Connection,
  NodeType,
  ConnectionPort,
  NODE_WIDTH,
  NODE_HEIGHTS,
  getOutputPortPos,
  getInputPortPos,
  bezierPath,
  generateId,
} from "./types";
import { FlowNodeCard } from "./flow-node";
import { Connections, DraftConnection } from "./connections";
import { NodePalette } from "./node-palette";

interface FlowCanvasProps {
  nodes: FlowNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  onNodesChange: (nodes: FlowNode[]) => void;
  onConnectionsChange: (connections: Connection[]) => void;
  onSelectNode: (id: string | null) => void;
}

export function FlowCanvas({
  nodes,
  connections,
  selectedNodeId,
  onNodesChange,
  onConnectionsChange,
  onSelectNode,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);
  const [pan, setPan] = useState({ x: 120, y: 60 });
  const [zoom, setZoom] = useState(1.1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    port: ConnectionPort;
  } | null>(null);
  const [mouseCanvas, setMouseCanvas] = useState({ x: 0, y: 0 });

  // Convert screen coords → canvas coords
  const toCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // ESC to cancel connection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConnectingFrom(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId && document.activeElement?.tagName !== "INPUT") {
          onNodesChange(nodes.filter((n) => n.id !== selectedNodeId));
          onConnectionsChange(
            connections.filter(
              (c) => c.fromNodeId !== selectedNodeId && c.toNodeId !== selectedNodeId
            )
          );
          onSelectNode(null);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, nodes, connections, onNodesChange, onConnectionsChange, onSelectNode]);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only pan when clicking directly on the canvas background
      if (
        target === containerRef.current ||
        target.classList.contains("canvas-surface")
      ) {
        if (connectingFrom) {
          setConnectingFrom(null);
          return;
        }
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        onSelectNode(null);
      }
    },
    [pan, connectingFrom, onSelectNode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = toCanvas(e.clientX, e.clientY);
      setMouseCanvas(canvas);

      if (isPanning) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }

      if (draggingId) {
        onNodesChange(
          nodes.map((n) =>
            n.id === draggingId
              ? {
                  ...n,
                  position: {
                    x: canvas.x - dragOffset.x,
                    y: canvas.y - dragOffset.y,
                  },
                }
              : n
          )
        );
      }
    },
    [isPanning, panStart, draggingId, dragOffset, toCanvas, nodes, onNodesChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingId(null);
  }, []);

  // Non-passive wheel listener so preventDefault() actually blocks browser zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => {
        const newZoom = Math.max(0.25, Math.min(2.5, z * delta));
        setPan((p) => ({
          x: mouseX - (mouseX - p.x) * (newZoom / z),
          y: mouseY - (mouseY - p.y) * (newZoom / z),
        }));
        return newZoom;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleNodeDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const canvas = toCanvas(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setDraggingId(nodeId);
      setDragOffset({
        x: canvas.x - node.position.x,
        y: canvas.y - node.position.y,
      });
    },
    [nodes, toCanvas]
  );

  const handlePortClick = useCallback(
    (nodeId: string, port: ConnectionPort, e: React.MouseEvent) => {
      e.stopPropagation();
      if (connectingFrom) {
        // Cancel if same node
        if (connectingFrom.nodeId === nodeId) {
          setConnectingFrom(null);
          return;
        }
        // Can't connect same port twice — remove old
        const filtered = connections.filter(
          (c) =>
            !(
              c.fromNodeId === connectingFrom.nodeId &&
              c.fromPort === connectingFrom.port
            )
        );
        onConnectionsChange([
          ...filtered,
          {
            id: generateId("conn"),
            fromNodeId: connectingFrom.nodeId,
            fromPort: connectingFrom.port,
            toNodeId: nodeId,
          },
        ]);
        setConnectingFrom(null);
      } else {
        setConnectingFrom({ nodeId, port });
      }
    },
    [connectingFrom, connections, onConnectionsChange]
  );

  const handleNodeClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (connectingFrom && connectingFrom.nodeId !== nodeId) {
        // Connect to this node's input
        const filtered = connections.filter(
          (c) =>
            !(
              c.fromNodeId === connectingFrom.nodeId &&
              c.fromPort === connectingFrom.port
            )
        );
        onConnectionsChange([
          ...filtered,
          {
            id: generateId("conn"),
            fromNodeId: connectingFrom.nodeId,
            fromPort: connectingFrom.port,
            toNodeId: nodeId,
          },
        ]);
        setConnectingFrom(null);
      } else if (!connectingFrom) {
        onSelectNode(nodeId);
      }
    },
    [connectingFrom, connections, onConnectionsChange, onSelectNode]
  );

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const prefix =
        type === "send_message"
          ? "msg"
          : type === "wait_until_event"
          ? "wait"
          : type;
      const id = generateId(prefix);
      const center = toCanvas(
        (containerRef.current?.clientWidth ?? 600) / 2,
        (containerRef.current?.clientHeight ?? 400) / 2
      );
      const newNode: FlowNode = {
        id,
        type,
        config: {},
        position: {
          x: center.x - NODE_WIDTH / 2 + Math.random() * 60 - 30,
          y: center.y - NODE_HEIGHTS[type] / 2 + Math.random() * 60 - 30,
        },
      };
      onNodesChange([...nodes, newNode]);
      onSelectNode(id);
    },
    [nodes, onNodesChange, onSelectNode, toCanvas]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      onNodesChange(nodes.filter((n) => n.id !== nodeId));
      onConnectionsChange(
        connections.filter(
          (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
        )
      );
      if (selectedNodeId === nodeId) onSelectNode(null);
    },
    [nodes, connections, selectedNodeId, onNodesChange, onConnectionsChange, onSelectNode]
  );

  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    if (nodes.length === 0) {
      setPan({ x: 120, y: 60 });
      setZoom(1.1);
      return;
    }
    const targetZoom = 1.15;
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_WIDTH));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + (NODE_HEIGHTS[n.type] ?? 76)));
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const panX = (containerW - (maxX - minX) * targetZoom) / 2 - minX * targetZoom;
    const panY = Math.max(60, (containerH - (maxY - minY) * targetZoom) / 2 - minY * targetZoom);
    setZoom(targetZoom);
    setPan({ x: panX, y: panY });
  }, [nodes]);

  // Auto-center on first node load
  useEffect(() => {
    if (nodes.length > 0 && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      fitView();
    }
  }, [nodes, fitView]);

  const [leftOpen, setLeftOpen] = useState(true);

  const connectingNode = connectingFrom
    ? nodes.find((n) => n.id === connectingFrom.nodeId)
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left palette — collapsible, row-reverse so toggle stays visible on collapse */}
      <div
        className="shrink-0"
        style={{
          display: "flex",
          flexDirection: "row-reverse",
          width: leftOpen ? 208 : 32,
          transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          background: "#080B16",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Toggle strip — first in DOM, visually on the right via row-reverse */}
        <button
          onClick={() => setLeftOpen((v) => !v)}
          title={leftOpen ? "Recolher painel" : "Expandir painel"}
          style={{
            width: 32,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "rgba(255,255,255,0.2)",
            background: "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.2)";
          }}
        >
          {leftOpen
            ? <ChevronLeft style={{ width: 12, height: 12 }} />
            : <ChevronRight style={{ width: 12, height: 12 }} />
          }
        </button>

        {/* Palette content — fades out before width collapse clips it */}
        <div
          style={{
            width: 176,
            flexShrink: 0,
            overflowY: "auto",
            height: "100%",
            opacity: leftOpen ? 1 : 0,
            transition: "opacity 0.12s ease",
            pointerEvents: leftOpen ? "auto" : "none",
          }}
        >
          <NodePalette onAddNode={handleAddNode} />
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{
          background: "#060810",
          cursor: isPanning ? "grabbing" : connectingFrom ? "crosshair" : "default",
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid dots background */}
        <div
          className="canvas-surface absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)`,
            backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Ambient glow center */}
        <div
          className="canvas-surface absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at ${pan.x + 400}px ${pan.y + 300}px, rgba(240,165,0,0.025) 0%, transparent 70%)`,
          }}
        />

        {/* Transform container */}
        <div
          style={{
            position: "absolute",
            transformOrigin: "0 0",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG for connections */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 10000,
              height: 10000,
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <Connections
              nodes={nodes}
              connections={connections}
              onDeleteConnection={(id) =>
                onConnectionsChange(connections.filter((c) => c.id !== id))
              }
            />

            {/* Draft connection line while connecting */}
            {connectingNode && connectingFrom && (
              <DraftConnection
                fromNode={connectingNode}
                fromPort={connectingFrom.port}
                toX={mouseCanvas.x}
                toY={mouseCanvas.y}
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <FlowNodeCard
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isConnectingMode={!!connectingFrom}
              isConnectingSource={connectingFrom?.nodeId === node.id}
              onMouseDown={(e) => handleNodeDragStart(node.id, e)}
              onPortClick={(port, e) => handlePortClick(node.id, port, e)}
              onNodeClick={(e) => handleNodeClick(node.id, e)}
              onDelete={() => handleDeleteNode(node.id)}
            />
          ))}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div
            className="canvas-surface absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(240,165,0,0.06)", border: "1px solid rgba(240,165,0,0.12)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="rgba(240,165,0,0.4)" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
              Adicione nós pelo painel à esquerda
            </p>
          </div>
        )}

        {/* Zoom controls */}
        <div
          className="absolute bottom-4 right-4 flex items-center gap-1.5"
          style={{ zIndex: 50 }}
        >
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            −
          </button>
          <span
            className="text-[10px] w-10 text-center tabular-nums"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            +
          </button>
          <button
            onClick={fitView}
            className="ml-1 h-7 px-2 rounded-lg text-[10px] transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            Encaixar
          </button>
        </div>

        {/* Connecting mode indicator */}
        {connectingFrom && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs"
            style={{
              background: "rgba(240,165,0,0.12)",
              border: "1px solid rgba(240,165,0,0.3)",
              color: "#F0A500",
              zIndex: 50,
            }}
          >
            Clique em outro nó para conectar · ESC para cancelar
          </div>
        )}

        {/* DEL hint when node selected */}
        {selectedNodeId && !connectingFrom && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.25)",
              zIndex: 50,
            }}
          >
            DEL para remover nó selecionado
          </div>
        )}
      </div>
    </div>
  );
}
