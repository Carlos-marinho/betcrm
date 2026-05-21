"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { FlowCanvas } from "@/components/features/flow-canvas/canvas";
import { NodeConfigPanel } from "@/components/features/flow-canvas/node-config-panel";
import {
  FlowNode,
  Connection,
  canvasToDefinition,
  definitionToCanvas,
} from "@/components/features/flow-canvas/types";
import { useFlows, useUpdateFlow, useToggleFlow, type Flow } from "@/lib/hooks";

function getFlowTriggerConfig(flow: Flow): Record<string, unknown> {
  if (flow.trigger_type === "event") {
    const eventCode = flow.trigger_config?.event_code;
    return typeof eventCode === "string" && eventCode ? { event_code: eventCode } : {};
  }

  if (flow.trigger_type === "segment_entry") {
    const segmentCode = flow.trigger_config?.segment_code;
    return typeof segmentCode === "string" && segmentCode ? { segment_code: segmentCode } : {};
  }

  return {};
}

function hydrateTriggerNodes(nodes: FlowNode[], flow: Flow): FlowNode[] {
  const triggerConfig = getFlowTriggerConfig(flow);
  if (Object.keys(triggerConfig).length === 0) return nodes;

  return nodes.map((node) =>
    node.type === "trigger"
      ? { ...node, config: { ...node.config, ...triggerConfig } }
      : node
  );
}

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const flowId = Number(id);

  const { data: flowsData, isLoading } = useFlows();
  const updateMutation = useUpdateFlow();
  const toggleMutation = useToggleFlow();

  const flow = flowsData?.results.find((f) => f.id === flowId);

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  // Re-open config panel whenever a node is selected
  useEffect(() => {
    if (selectedNodeId) setRightOpen(true);
  }, [selectedNodeId]);

  // Init canvas from flow definition
  useEffect(() => {
    if (flow && !initialized) {
      const def = (flow as unknown as { definition: { nodes: unknown[] } }).definition;
      if (def?.nodes?.length) {
        const { nodes: n, connections: c } = definitionToCanvas(def as never);
        setNodes(hydrateTriggerNodes(n, flow));
        setConnections(c);
      }
      setInitialized(true);
    }
  }, [flow, initialized]);

  function handleNodesChange(n: FlowNode[]) {
    setNodes(n);
    setIsDirty(true);
  }

  function handleConnectionsChange(c: Connection[]) {
    setConnections(c);
    setIsDirty(true);
  }

  function handleNodeUpdate(updated: FlowNode) {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setIsDirty(true);
  }

  async function handleSave() {
    try {
      const definition = canvasToDefinition(nodes, connections);
      await updateMutation.mutateAsync({
        id: flowId,
        definition,
      } as never);
      toast.success("Fluxo salvo");
      setIsDirty(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  async function handleToggle() {
    if (!flow) return;
    try {
      await toggleMutation.mutateAsync({ id: flowId, activate: !flow.is_active });
      toast.success(flow.is_active ? "Fluxo pausado" : "Fluxo ativado");
    } catch {
      toast.error("Erro ao alterar estado");
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Validate: check for nodes with missing required config
  const warnings = nodes.filter((n) => {
    if (n.type === "send_message" && (!n.config.channel || !n.config.template_code))
      return true;
    if (n.type === "condition" && !n.config.field) return true;
    return false;
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060810]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F0A500" }} />
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#060810]">
        <p className="text-white/40 text-sm">Fluxo não encontrado</p>
        <Link
          href="/flows"
          className="text-xs text-white/30 underline underline-offset-4 hover:text-white/60"
        >
          Voltar para fluxos
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#060810" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 h-12 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#080B16" }}
      >
        {/* Back */}
        <Link
          href="/flows"
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Fluxos
        </Link>

        <span style={{ color: "rgba(255,255,255,0.1)" }}>
          <ChevronRight className="w-3 h-3" />
        </span>

        {/* Flow name */}
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
          <span
            className="text-sm font-semibold truncate"
            style={{ color: "rgba(255,255,255,0.82)" }}
          >
            {flow.name}
          </span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {flow.code}
          </span>
        </div>

        {/* Status badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            background: flow.is_active ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${flow.is_active ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
            color: flow.is_active ? "#10B981" : "rgba(255,255,255,0.3)",
          }}
        >
          {flow.is_active ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Ativo
            </>
          ) : (
            "Inativo"
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "#F59E0B",
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {warnings.length} nó{warnings.length > 1 ? "s" : ""} incompleto{warnings.length > 1 ? "s" : ""}
          </div>
        )}

        {isDirty && (
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            · não salvo
          </span>
        )}

        <div className="flex-1" />

        {/* Node count */}
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          {nodes.length} nó{nodes.length !== 1 ? "s" : ""}
        </span>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{
            background: flow.is_active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
            border: `1px solid ${flow.is_active ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
            color: flow.is_active ? "#EF4444" : "#10B981",
          }}
        >
          {toggleMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : flow.is_active ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {flow.is_active ? "Pausar" : "Ativar"}
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || !isDirty}
          className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: isDirty ? "#F0A500" : "rgba(240,165,0,0.1)",
            color: isDirty ? "#060810" : "rgba(240,165,0,0.4)",
            border: "1px solid transparent",
          }}
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          Salvar
        </button>
      </div>

      {/* Main layout: canvas + optional right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            connections={connections}
            selectedNodeId={selectedNodeId}
            onNodesChange={handleNodesChange}
            onConnectionsChange={handleConnectionsChange}
            onSelectNode={setSelectedNodeId}
          />
        </div>

        {/* Right config panel — collapsible, toggle strip on left edge */}
        {selectedNode && (
          <div
            className="shrink-0"
            style={{
              display: "flex",
              flexDirection: "row",
              width: rightOpen ? 384 : 32,
              transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
              overflow: "hidden",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              background: "#080B16",
            }}
          >
            {/* Toggle strip — always visible at the left edge */}
            <button
              onClick={() => setRightOpen((v) => !v)}
              title={rightOpen ? "Recolher painel" : "Expandir painel"}
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
              {rightOpen
                ? <ChevronRight style={{ width: 12, height: 12 }} />
                : <ChevronLeft style={{ width: 12, height: 12 }} />
              }
            </button>

            {/* Panel content — fades out before overflow clips it */}
            <div
              style={{
                width: 352,
                flexShrink: 0,
                overflow: "hidden",
                opacity: rightOpen ? 1 : 0,
                transition: "opacity 0.12s ease",
                pointerEvents: rightOpen ? "auto" : "none",
                borderLeft: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <NodeConfigPanel
                node={selectedNode}
                onChange={handleNodeUpdate}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div
        className="flex items-center gap-4 px-4 h-6 shrink-0"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "#080B16",
        }}
      >
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
          {connections.length} conexão{connections.length !== 1 ? "ões" : ""}
        </span>
        {isDirty ? (
          <span className="text-[10px]" style={{ color: "rgba(245,158,11,0.5)" }}>
            · alterações não salvas
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(16,185,129,0.4)" }}>
            <CheckCircle2 className="w-2.5 h-2.5" />
            salvo
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.1)" }}>
          BetCRM Flow Editor
        </span>
      </div>
    </div>
  );
}
