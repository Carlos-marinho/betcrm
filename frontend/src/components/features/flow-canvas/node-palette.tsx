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
  Plus,
} from "lucide-react";
import { NodeType, NODE_META } from "./types";

const PALETTE: { type: NodeType; icon: React.FC<{ style?: React.CSSProperties }> }[] = [
  { type: "trigger", icon: Zap },
  { type: "send_message", icon: Mail },
  { type: "delay", icon: Clock },
  { type: "condition", icon: GitFork },
  { type: "add_tag", icon: Tag },
  { type: "remove_tag", icon: XCircle },
  { type: "wait_until_event", icon: Timer },
  { type: "exit", icon: LogOut },
];

const SECTION_LABELS: Partial<Record<NodeType, string>> = {
  trigger: "Entrada",
  send_message: "Ações",
  condition: "Lógica",
  add_tag: "Perfil",
  exit: "Saída",
};

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "#080B16", borderRight: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p
          className="text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          Nós
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {PALETTE.map(({ type, icon: Icon }, idx) => {
          const meta = NODE_META[type];
          const sectionLabel = SECTION_LABELS[type];

          return (
            <React.Fragment key={type}>
              {sectionLabel && idx !== 0 && (
                <div
                  className="mx-3 my-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                />
              )}
              {sectionLabel && (
                <p
                  className="px-3 pt-1 pb-1 text-[9px] uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.18)" }}
                >
                  {sectionLabel}
                </p>
              )}
              <button
                onClick={() => onAddNode(type)}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left group"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
                title={meta.description}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}15` }}
                >
                  <Icon style={{ width: 12, height: 12, color: meta.color }} />
                </div>
                <span
                  className="text-xs flex-1 text-left"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {meta.label}
                </span>
                <Plus
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                />
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Tips */}
      <div
        className="p-3 shrink-0 space-y-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {[
          "Clique para adicionar",
          "Arraste para mover nós",
          "Clique na porta para conectar",
          "Scroll para zoom",
          "Clique na conexão para deletar",
        ].map((tip) => (
          <p key={tip} className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>
            · {tip}
          </p>
        ))}
      </div>
    </div>
  );
}
