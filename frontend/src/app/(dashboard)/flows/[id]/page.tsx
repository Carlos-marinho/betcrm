"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Pause,
  Play,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { FlowCanvas } from "@/components/features/flow-canvas/canvas";
import { NodeConfigPanel } from "@/components/features/flow-canvas/node-config-panel";
import {
  canvasToDefinition,
  definitionToCanvas,
  type Connection,
  type FlowDefinition,
  type FlowNode,
} from "@/components/features/flow-canvas/types";
import { useFlow, useToggleFlow, useUpdateFlow, type Flow } from "@/lib/hooks";

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

function getIncompleteNodes(nodes: FlowNode[]) {
  return nodes.filter((node) => {
    if (node.type === "send_message") {
      return !node.config.channel || !node.config.template_code;
    }
    if (node.type === "condition") return !node.config.field;
    if (node.type === "wait_until_event") return !node.config.event_code;
    if (node.type === "http_request") return !node.config.url;
    return false;
  });
}

export default function FlowEditorPage() {
  const params = useParams<{ id: string }>();
  const flowId = Number(params.id);
  const validFlowId = Number.isFinite(flowId) && flowId > 0 ? flowId : null;

  const { data: flow, isLoading, isError } = useFlow(validFlowId);
  const updateMutation = useUpdateFlow();
  const toggleMutation = useToggleFlow();

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    if (!flow) return;

    const definition = flow.definition as FlowDefinition | undefined;
    if (definition?.nodes?.length) {
      const canvas = definitionToCanvas(definition);
      setNodes(hydrateTriggerNodes(canvas.nodes, flow));
      setConnections(canvas.connections);
    } else {
      const canvas = definitionToCanvas({
        nodes: [
          { id: "start", type: "trigger", next: "exit" },
          { id: "exit", type: "exit" },
        ],
      });
      setNodes(hydrateTriggerNodes(canvas.nodes, flow));
      setConnections(canvas.connections);
    }

    setSelectedNodeId(null);
    setIsDirty(false);
  }, [flow]);

  useEffect(() => {
    if (selectedNodeId) setRightOpen(true);
  }, [selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );
  const warnings = useMemo(() => getIncompleteNodes(nodes), [nodes]);

  function handleNodesChange(nextNodes: FlowNode[]) {
    setNodes(nextNodes);
    setIsDirty(true);
  }

  function handleConnectionsChange(nextConnections: Connection[]) {
    setConnections(nextConnections);
    setIsDirty(true);
  }

  function handleNodeUpdate(updatedNode: FlowNode) {
    setNodes((current) =>
      current.map((node) => (node.id === updatedNode.id ? updatedNode : node))
    );
    setIsDirty(true);
  }

  async function handleSave() {
    if (!validFlowId) return;

    try {
      await updateMutation.mutateAsync({
        id: validFlowId,
        definition: canvasToDefinition(nodes, connections),
      } as Partial<Flow> & { id: number });
      toast.success("Fluxo salvo");
      setIsDirty(false);
    } catch {
      toast.error("Erro ao salvar fluxo");
    }
  }

  async function handleToggle() {
    if (!flow || !validFlowId) return;

    try {
      await toggleMutation.mutateAsync({ id: validFlowId, activate: !flow.is_active });
      toast.success(flow.is_active ? "Fluxo pausado" : "Fluxo ativado");
    } catch {
      toast.error("Erro ao alterar estado do fluxo");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060810]">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!validFlowId || isError || !flow) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#060810]">
        <p className="text-sm text-white/40">Fluxo não encontrado</p>
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#060810]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#080B16] px-4">
        <Link
          href="/flows"
          className="flex items-center gap-1.5 text-xs text-white/35 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Fluxos
        </Link>

        <ChevronRight className="h-3 w-3 text-white/10" />

        <div className="flex min-w-0 items-center gap-2">
          <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-white/30" />
          <span className="truncate text-sm font-semibold text-white/85">{flow.name}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/30">
            {flow.code}
          </span>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            flow.is_active
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
              : "border-white/10 bg-white/5 text-white/35"
          }`}
        >
          {flow.is_active && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
          {flow.is_active ? "Ativo" : "Inativo"}
        </div>

        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {warnings.length} incompleto{warnings.length > 1 ? "s" : ""}
          </div>
        )}

        {isDirty && <span className="text-[10px] text-white/30">alterações não salvas</span>}

        <div className="flex-1" />

        <span className="text-[10px] text-white/20">
          {nodes.length} nó{nodes.length !== 1 ? "s" : ""}
        </span>

        <button
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          className={`flex h-7 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all disabled:opacity-50 ${
            flow.is_active
              ? "border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/15"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/15"
          }`}
        >
          {toggleMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : flow.is_active ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {flow.is_active ? "Pausar" : "Ativar"}
        </button>

        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || !isDirty}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-transparent bg-gold px-3 text-xs font-semibold text-[#060810] transition-all hover:bg-gold/90 disabled:bg-gold/10 disabled:text-gold/40"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Salvar
        </button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <FlowCanvas
            nodes={nodes}
            connections={connections}
            selectedNodeId={selectedNodeId}
            onNodesChange={handleNodesChange}
            onConnectionsChange={handleConnectionsChange}
            onSelectNode={setSelectedNodeId}
          />
        </div>

        {selectedNode && (
          <aside
            className="flex shrink-0 overflow-hidden border-l border-white/10 bg-[#080B16] transition-[width]"
            style={{ width: rightOpen ? 384 : 32 }}
          >
            <button
              onClick={() => setRightOpen((current) => !current)}
              title={rightOpen ? "Recolher painel" : "Expandir painel"}
              className="flex h-full w-8 shrink-0 items-center justify-center text-white/25 transition-colors hover:text-white/60"
            >
              {rightOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>

            <div
              className="w-[352px] shrink-0 overflow-hidden border-l border-white/10 transition-opacity"
              style={{
                opacity: rightOpen ? 1 : 0,
                pointerEvents: rightOpen ? "auto" : "none",
              }}
            >
              <NodeConfigPanel
                node={selectedNode}
                onChange={handleNodeUpdate}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </aside>
        )}
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-white/5 bg-[#080B16] px-4">
        <span className="text-[10px] text-white/20">
          {connections.length} conexão{connections.length !== 1 ? "ões" : ""}
        </span>
        {isDirty ? (
          <span className="text-[10px] text-amber-400/55">alterações não salvas</span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400/50">
            <CheckCircle2 className="h-2.5 w-2.5" />
            salvo
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-white/15">BetCRM Flow Editor</span>
      </footer>
    </div>
  );
}
