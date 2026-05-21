export type NodeType =
  | "trigger"
  | "delay"
  | "send_message"
  | "condition"
  | "add_tag"
  | "remove_tag"
  | "wait_until_event"
  | "http_request"
  | "exit";

export type ConnectionPort = "next" | "next_true" | "next_false" | "next_timeout";

export interface NodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  config: Record<string, unknown>;
  position: NodePosition;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPort: ConnectionPort;
  toNodeId: string;
}

// API wire format (matches Django engine)
export interface ApiNode {
  id: string;
  type: NodeType;
  config?: Record<string, unknown>;
  next?: string;
  next_true?: string;
  next_false?: string;
  next_timeout?: string;
}

export interface FlowDefinition {
  nodes: ApiNode[];
}

export const NODE_WIDTH = 236;

export const NODE_HEIGHTS: Record<NodeType, number> = {
  trigger: 76,
  exit: 58,
  delay: 96,
  send_message: 108,
  condition: 108,
  add_tag: 84,
  remove_tag: 84,
  wait_until_event: 104,
  http_request: 112,
};

export const NODE_META: Record<
  NodeType,
  { label: string; color: string; darkBg: string; description: string }
> = {
  trigger: {
    label: "Gatilho",
    color: "#10B981",
    darkBg: "rgba(16, 185, 129, 0.08)",
    description: "Ponto de entrada do fluxo",
  },
  send_message: {
    label: "Enviar Mensagem",
    color: "#3B82F6",
    darkBg: "rgba(59, 130, 246, 0.08)",
    description: "Envia email, SMS, push ou WhatsApp",
  },
  delay: {
    label: "Aguardar",
    color: "#F59E0B",
    darkBg: "rgba(245, 158, 11, 0.08)",
    description: "Pausa antes de continuar",
  },
  condition: {
    label: "Condição",
    color: "#8B5CF6",
    darkBg: "rgba(139, 92, 246, 0.08)",
    description: "Divide fluxo com base em dado do perfil",
  },
  add_tag: {
    label: "Adicionar Tag",
    color: "#06B6D4",
    darkBg: "rgba(6, 182, 212, 0.08)",
    description: "Adiciona tag ao perfil",
  },
  remove_tag: {
    label: "Remover Tag",
    color: "#EF4444",
    darkBg: "rgba(239, 68, 68, 0.08)",
    description: "Remove tag do perfil",
  },
  wait_until_event: {
    label: "Aguardar Evento",
    color: "#F97316",
    darkBg: "rgba(249, 115, 22, 0.08)",
    description: "Espera evento específico com timeout",
  },
  http_request: {
    label: "Chamar Webhook",
    color: "#A855F7",
    darkBg: "rgba(168, 85, 247, 0.08)",
    description: "Dispara POST para URL externa (FlowLab ou webhook)",
  },
  exit: {
    label: "Finalizar",
    color: "#6B7280",
    darkBg: "rgba(107, 114, 128, 0.08)",
    description: "Termina o fluxo",
  },
};

// Maps which ports a node type exposes as outputs
export const NODE_OUTPUT_PORTS: Record<NodeType, ConnectionPort[]> = {
  trigger: ["next"],
  delay: ["next"],
  send_message: ["next"],
  add_tag: ["next"],
  remove_tag: ["next"],
  http_request: ["next"],
  condition: ["next_true", "next_false"],
  wait_until_event: ["next", "next_timeout"],
  exit: [],
};

export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}`;
}

// Convert canvas state → Django engine JSON format
export function canvasToDefinition(
  nodes: FlowNode[],
  connections: Connection[]
): FlowDefinition {
  const apiNodes: ApiNode[] = nodes.map((node) => {
    const apiNode: ApiNode = { id: node.id, type: node.type };

    const cfg = { ...node.config };
    // Strip empty values
    Object.keys(cfg).forEach((k) => {
      if (cfg[k] === "" || cfg[k] === null || cfg[k] === undefined) delete cfg[k];
    });
    if (Object.keys(cfg).length > 0) apiNode.config = cfg;

    const outConns = connections.filter((c) => c.fromNodeId === node.id);
    for (const conn of outConns) {
      if (conn.fromPort === "next") apiNode.next = conn.toNodeId;
      else if (conn.fromPort === "next_true") apiNode.next_true = conn.toNodeId;
      else if (conn.fromPort === "next_false") apiNode.next_false = conn.toNodeId;
      else if (conn.fromPort === "next_timeout") apiNode.next_timeout = conn.toNodeId;
    }

    return apiNode;
  });

  return { nodes: apiNodes };
}

// Convert Django engine JSON → canvas state (auto-layout if needed)
export function definitionToCanvas(definition: FlowDefinition): {
  nodes: FlowNode[];
  connections: Connection[];
} {
  const apiNodes = definition?.nodes ?? [];
  const nodes: FlowNode[] = [];
  const connections: Connection[] = [];

  // Simple tree-layout: BFS from trigger
  const nodeMap = new Map(apiNodes.map((n) => [n.id, n]));
  const positioned = new Map<string, NodePosition>();
  const visited = new Set<string>();
  const queue: { id: string; col: number; row: number }[] = [];

  const triggerNode = apiNodes.find((n) => n.type === "trigger") ?? apiNodes[0];
  if (triggerNode) {
    queue.push({ id: triggerNode.id, col: 0, row: 0 });
  }

  const colWidths = new Map<number, number>(); // col -> max row used
  const colOffset = new Map<number, number>(); // col -> x pixel offset

  while (queue.length) {
    const { id, col, row } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const x = (col * 320) + 80;
    const y = (row * 200) + 80;
    positioned.set(id, { x, y });

    const api = nodeMap.get(id);
    if (!api) continue;

    const children: { port: ConnectionPort; target: string }[] = [];
    if (api.next) children.push({ port: "next", target: api.next });
    if (api.next_true) children.push({ port: "next_true", target: api.next_true });
    if (api.next_false) children.push({ port: "next_false", target: api.next_false });
    if (api.next_timeout) children.push({ port: "next_timeout", target: api.next_timeout });

    children.forEach(({ port, target }, i) => {
      const childCol = children.length > 1 ? col + i : col;
      const childRow = children.length > 1 ? row + 1 : row + 1;
      if (!visited.has(target)) {
        queue.push({ id: target, col: childCol, row: childRow });
      }
    });
  }

  // Any unvisited nodes (orphans) get placed in a column to the right
  let orphanRow = 0;
  apiNodes.forEach((api) => {
    if (!visited.has(api.id)) {
      positioned.set(api.id, { x: 800, y: orphanRow * 180 + 80 });
      orphanRow++;
    }
  });

  apiNodes.forEach((api, idx) => {
    const pos = positioned.get(api.id) ?? { x: 80, y: idx * 180 + 80 };
    nodes.push({
      id: api.id,
      type: api.type,
      config: api.config ?? {},
      position: pos,
    });

    const portMap: [ConnectionPort, string | undefined][] = [
      ["next", api.next],
      ["next_true", api.next_true],
      ["next_false", api.next_false],
      ["next_timeout", api.next_timeout],
    ];
    for (const [port, target] of portMap) {
      if (target) {
        connections.push({
          id: `${api.id}-${port}-${target}`,
          fromNodeId: api.id,
          fromPort: port,
          toNodeId: target,
        });
      }
    }
  });

  return { nodes, connections };
}

// Get port position in canvas space
export function getOutputPortPos(
  node: FlowNode,
  port: ConnectionPort
): { x: number; y: number } {
  const h = NODE_HEIGHTS[node.type] ?? 76;
  const w = NODE_WIDTH;
  const { x, y } = node.position;

  if (port === "next_true") return { x: x + w * 0.3, y: y + h };
  if (port === "next_false") return { x: x + w * 0.7, y: y + h };
  if (port === "next_timeout") return { x: x + w * 0.7, y: y + h };
  return { x: x + w / 2, y: y + h };
}

export function getInputPortPos(node: FlowNode): { x: number; y: number } {
  return { x: node.position.x + NODE_WIDTH / 2, y: node.position.y };
}

export function bezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dy = y2 - y1;
  const cp = Math.max(Math.abs(dy) * 0.55, 70);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}
