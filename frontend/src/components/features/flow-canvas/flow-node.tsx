"use client";

import React from "react";
import {
  Zap,
  Mail,
  Clock,
  GitFork,
  Tag,
  XCircle,
  Timer,
  LogOut,
  Trash2,
} from "lucide-react";
import {
  FlowNode,
  NodeType,
  ConnectionPort,
  NODE_WIDTH,
  NODE_HEIGHTS,
  NODE_META,
  NODE_OUTPUT_PORTS,
} from "./types";

const ICONS: Record<NodeType, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  trigger: Zap,
  send_message: Mail,
  delay: Clock,
  condition: GitFork,
  add_tag: Tag,
  remove_tag: XCircle,
  wait_until_event: Timer,
  exit: LogOut,
};

const PORT_COLORS: Record<ConnectionPort, string> = {
  next: "rgba(255,255,255,0.35)",
  next_true: "#10B981",
  next_false: "#EF4444",
  next_timeout: "#F97316",
};

const PORT_LABELS: Record<ConnectionPort, string> = {
  next: "",
  next_true: "sim",
  next_false: "não",
  next_timeout: "timeout",
};

interface FlowNodeCardProps {
  node: FlowNode;
  isSelected: boolean;
  isConnectingMode: boolean;
  isConnectingSource: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onPortClick: (port: ConnectionPort, e: React.MouseEvent) => void;
  onNodeClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

export function FlowNodeCard({
  node,
  isSelected,
  isConnectingMode,
  isConnectingSource,
  onMouseDown,
  onPortClick,
  onNodeClick,
  onDelete,
}: FlowNodeCardProps) {
  const meta = NODE_META[node.type];
  const Icon = ICONS[node.type];
  const h = NODE_HEIGHTS[node.type];
  const w = NODE_WIDTH;
  const outputPorts = NODE_OUTPUT_PORTS[node.type];
  const isTarget = isConnectingMode && !isConnectingSource;

  return (
    <div
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: w,
        zIndex: isSelected ? 30 : 10,
      }}
    >
      {/* Input port — top center */}
      {node.type !== "trigger" && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
          }}
          onClick={onNodeClick}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: `2px solid ${isTarget ? "#F0A500" : "rgba(255,255,255,0.2)"}`,
              background: "#0A0D1A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isConnectingMode ? "crosshair" : "default",
              transition: "all 0.15s",
              boxShadow: isTarget ? "0 0 10px rgba(240,165,0,0.4)" : "none",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isTarget ? "#F0A500" : "rgba(255,255,255,0.25)",
              }}
            />
          </div>
        </div>
      )}

      {/* Node card */}
      <div
        onMouseDown={isConnectingMode ? undefined : onMouseDown}
        onClick={onNodeClick}
        style={{
          width: w,
          height: h,
          borderRadius: 12,
          border: `1.5px solid ${
            isSelected
              ? meta.color
              : isTarget
              ? "#F0A500"
              : "rgba(255,255,255,0.08)"
          }`,
          background: `linear-gradient(145deg, ${meta.darkBg} 0%, rgba(12,16,32,0.97) 100%)`,
          overflow: "hidden",
          cursor: isConnectingMode ? (isTarget ? "crosshair" : "default") : "grab",
          userSelect: "none",
          boxShadow: isSelected
            ? `0 0 0 1px ${meta.color}40, 0 8px 24px rgba(0,0,0,0.4)`
            : isTarget
            ? "0 0 16px rgba(240,165,0,0.25)"
            : "0 4px 16px rgba(0,0,0,0.3)",
          transition: "border-color 0.15s, box-shadow 0.15s",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header stripe */}
        <div
          style={{
            height: 3,
            background: meta.color,
            opacity: isSelected ? 1 : 0.6,
            flexShrink: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: `${meta.color}1A`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon
              style={{ width: 12, height: 12, color: meta.color }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
            >
              {meta.label}
            </p>
            <p
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
              }}
            >
              {node.id}
            </p>
          </div>
          {node.type !== "trigger" && node.type !== "exit" && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.2)",
                flexShrink: 0,
                padding: 0,
              }}
              title="Remover nó"
            >
              <Trash2 style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>

        {/* Config preview */}
        <NodePreview node={node} />
      </div>

      {/* Output ports — bottom */}
      {outputPorts.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: -14,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: outputPorts.length === 1 ? "center" : "space-around",
            pointerEvents: isConnectingMode ? "none" : "auto",
          }}
        >
          {outputPorts.map((port) => {
            const color = PORT_COLORS[port];
            const label = PORT_LABELS[port];
            return (
              <div
                key={port}
                onClick={(e) => {
                  e.stopPropagation();
                  onPortClick(port, e);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  cursor: "crosshair",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `2px solid ${color}`,
                    background: "#0A0D1A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                </div>
                {label && (
                  <span
                    style={{
                      fontSize: 8,
                      color,
                      opacity: 0.75,
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NodePreview({ node }: { node: FlowNode }) {
  const cfg = node.config ?? {};
  const style: React.CSSProperties = {
    padding: "6px 10px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 3,
  };
  const textStyle: React.CSSProperties = {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const valStyle: React.CSSProperties = {
    ...textStyle,
    color: "rgba(255,255,255,0.7)",
  };

  if (node.type === "send_message") {
    const ch = cfg.channel as string | undefined;
    const tpl = cfg.template_code as string | undefined;
    return (
      <div style={style}>
        {ch && (
          <p style={textStyle}>
            Canal:{" "}
            <span style={valStyle}>{ch.toUpperCase()}</span>
          </p>
        )}
        {tpl && (
          <p style={textStyle}>
            Template:{" "}
            <span style={{ ...valStyle, fontFamily: "monospace" }}>
              {tpl}
            </span>
          </p>
        )}
        {!ch && !tpl && (
          <p style={{ ...textStyle, color: "rgba(255,255,255,0.2)" }}>
            Não configurado
          </p>
        )}
      </div>
    );
  }

  if (node.type === "delay") {
    const parts: string[] = [];
    if (Number(cfg.days) > 0) parts.push(`${cfg.days}d`);
    if (Number(cfg.hours) > 0) parts.push(`${cfg.hours}h`);
    if (Number(cfg.minutes) > 0) parts.push(`${cfg.minutes}min`);
    if (Number(cfg.seconds) > 0) parts.push(`${cfg.seconds}s`);
    return (
      <div style={style}>
        <p style={textStyle}>
          {parts.length ? (
            <>
              Esperar:{" "}
              <span style={valStyle}>{parts.join(" ")}</span>
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.2)" }}>Não configurado</span>
          )}
        </p>
      </div>
    );
  }

  if (node.type === "condition") {
    return (
      <div style={style}>
        {cfg.field ? (
          <p style={textStyle}>
            <span style={valStyle}>{String(cfg.field)}</span>{" "}
            <span style={{ color: "rgba(139,92,246,0.8)" }}>{String(cfg.operator ?? "==")}</span>{" "}
            <span style={valStyle}>{JSON.stringify(cfg.value)}</span>
          </p>
        ) : (
          <p style={{ ...textStyle, color: "rgba(255,255,255,0.2)" }}>
            Condição não definida
          </p>
        )}
      </div>
    );
  }

  if (node.type === "add_tag" || node.type === "remove_tag") {
    const tag = cfg.tag as string | undefined;
    return (
      <div style={style}>
        <p style={textStyle}>
          {tag ? (
            <>
              Tag:{" "}
              <span style={{ ...valStyle, fontFamily: "monospace" }}>
                {tag}
              </span>
            </>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.2)" }}>Sem tag</span>
          )}
        </p>
      </div>
    );
  }

  if (node.type === "wait_until_event") {
    const ev = cfg.event_code as string | undefined;
    const th = cfg.timeout_hours as number | undefined;
    return (
      <div style={style}>
        {ev && (
          <p style={textStyle}>
            Evento: <span style={valStyle}>{ev}</span>
          </p>
        )}
        {th && (
          <p style={textStyle}>
            Timeout: <span style={valStyle}>{th}h</span>
          </p>
        )}
        {!ev && (
          <p style={{ ...textStyle, color: "rgba(255,255,255,0.2)" }}>
            Não configurado
          </p>
        )}
      </div>
    );
  }

  if (node.type === "trigger") {
    const eventCode = cfg.event_code as string | undefined;
    const segmentCode = cfg.segment_code as string | undefined;
    const triggerLabel = eventCode ?? (segmentCode ? `Segmento: ${segmentCode}` : "Início do fluxo");

    return (
      <div style={style}>
        <p style={{ ...textStyle, color: "rgba(255,255,255,0.2)" }}>
          {triggerLabel}
        </p>
      </div>
    );
  }

  return (
    <div style={style}>
      <p style={{ ...textStyle, color: "rgba(255,255,255,0.2)" }}>
        Fim do fluxo
      </p>
    </div>
  );
}
