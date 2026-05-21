"use client";

import React from "react";
import {
  FlowNode,
  Connection,
  ConnectionPort,
  bezierPath,
  getOutputPortPos,
  getInputPortPos,
} from "./types";

const PORT_STROKE: Record<ConnectionPort, string> = {
  next: "rgba(255,255,255,0.25)",
  next_true: "#10B981",
  next_false: "#EF4444",
  next_timeout: "#F97316",
};

interface ConnectionsProps {
  nodes: FlowNode[];
  connections: Connection[];
  onDeleteConnection: (id: string) => void;
}

export function Connections({
  nodes,
  connections,
  onDeleteConnection,
}: ConnectionsProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <>
      {connections.map((conn) => {
        const fromNode = nodeMap.get(conn.fromNodeId);
        const toNode = nodeMap.get(conn.toNodeId);
        if (!fromNode || !toNode) return null;

        const from = getOutputPortPos(fromNode, conn.fromPort);
        const to = getInputPortPos(toNode);
        if (!isFinite(from.x) || !isFinite(from.y) || !isFinite(to.x) || !isFinite(to.y)) return null;
        const d = bezierPath(from.x, from.y, to.x, to.y);
        const stroke = PORT_STROKE[conn.fromPort] ?? PORT_STROKE.next;

        // Midpoint for potential interaction
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;

        return (
          <g key={conn.id} className="group/conn">
            {/* Wide invisible hit area */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onClick={() => onDeleteConnection(conn.id)}
            />
            {/* Visible path */}
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
            {/* Arrow head */}
            <polygon
              points={`${to.x},${to.y - 1} ${to.x - 4},${to.y - 9} ${to.x + 4},${to.y - 9}`}
              fill={stroke}
              style={{ pointerEvents: "none" }}
            />
            {/* Delete indicator at midpoint on hover */}
            <circle
              cx={mx}
              cy={my}
              r={6}
              fill="#0A0D1A"
              stroke={stroke}
              strokeWidth={1}
              opacity={0}
              className="group-hover/conn:opacity-100 transition-opacity"
              style={{ pointerEvents: "none" }}
            />
            <text
              x={mx}
              y={my + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fill={stroke}
              opacity={0}
              className="group-hover/conn:opacity-100 transition-opacity"
              style={{ pointerEvents: "none" }}
            >
              ×
            </text>
          </g>
        );
      })}
    </>
  );
}

interface DraftConnectionProps {
  fromNode: FlowNode;
  fromPort: ConnectionPort;
  toX: number;
  toY: number;
}

export function DraftConnection({
  fromNode,
  fromPort,
  toX,
  toY,
}: DraftConnectionProps) {
  const from = getOutputPortPos(fromNode, fromPort);
  const d = bezierPath(from.x, from.y, toX, toY);
  const stroke = PORT_STROKE[fromPort] ?? "#F0A500";

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeDasharray="6 3"
      strokeLinecap="round"
      opacity={0.7}
      style={{ pointerEvents: "none" }}
    />
  );
}
