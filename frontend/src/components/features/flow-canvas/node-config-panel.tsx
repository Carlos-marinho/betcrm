"use client";

import React from "react";
import { X, Info } from "lucide-react";
import { FlowNode, NODE_META } from "./types";

const TRIGGER_EVENTS = [
  { value: "user.register", label: "Registro de usuário" },
  { value: "payment.deposit.completed", label: "Depósito completado" },
  { value: "payment.deposit.started", label: "Depósito iniciado" },
  { value: "payment.deposit.failed", label: "Depósito falhou" },
  { value: "payment.withdrawal.request", label: "Saque solicitado" },
  { value: "payment.withdrawal.approved", label: "Saque aprovado" },
  { value: "payment.withdrawal.completed", label: "Saque completado" },
  { value: "game.started", label: "Jogo iniciado" },
  { value: "bonus.activated", label: "Bônus ativado" },
  { value: "bonus.completed", label: "Bônus completado" },
  { value: "bonus.expired", label: "Bônus expirado" },
  { value: "cashback.paid", label: "Cashback pago" },
];

const PROFILE_FIELDS = [
  { value: "deposit_count", label: "Qtd. depósitos" },
  { value: "total_deposited", label: "Total depositado" },
  { value: "ltv", label: "LTV" },
  { value: "is_active", label: "Ativo" },
  { value: "last_deposit_at", label: "Último depósito em" },
];

const OPERATORS = [
  { value: "eq", label: "== igual a" },
  { value: "ne", label: "!= diferente de" },
  { value: "gt", label: "> maior que" },
  { value: "gte", label: ">= maior ou igual" },
  { value: "lt", label: "< menor que" },
  { value: "lte", label: "<= menor ou igual" },
  { value: "contains", label: "contém" },
  { value: "isnull", label: "é nulo" },
];

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push Notification" },
  { value: "whatsapp", label: "WhatsApp" },
];

interface NodeConfigPanelProps {
  node: FlowNode;
  onChange: (node: FlowNode) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onChange, onClose }: NodeConfigPanelProps) {
  const meta = NODE_META[node.type];

  function set(key: string, value: unknown) {
    onChange({ ...node, config: { ...node.config, [key]: value } });
  }

  function setId(newId: string) {
    onChange({ ...node, id: newId });
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "#080B16" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: meta.color }}
          />
          <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.88)" }}>
            {meta.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Description */}
      <div
        className="px-4 py-2.5 shrink-0 flex items-start gap-2"
        style={{ background: `${meta.color}08`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <Info className="w-3 h-3 mt-0.5 shrink-0" style={{ color: `${meta.color}80` }} />
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
          {meta.description}
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <Field label="ID do Nó">
          <ConfigInput
            value={node.id}
            onChange={setId}
            placeholder="ex: send_email_1"
            mono
          />
          <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
            Identificador único dentro deste fluxo.
          </p>
        </Field>

        {node.type === "trigger" && (
          <Field label="Evento de referência">
            <ConfigSelect
              value={String(node.config.event_code ?? "")}
              onChange={(v) => set("event_code", v)}
              options={TRIGGER_EVENTS}
              placeholder="Selecionar evento..."
            />
            <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              Apenas visual — o trigger real é configurado no fluxo.
            </p>
          </Field>
        )}

        {node.type === "send_message" && (
          <>
            <Field label="Canal">
              <ConfigSelect
                value={String(node.config.channel ?? "")}
                onChange={(v) => set("channel", v)}
                options={CHANNELS}
                placeholder="Selecionar canal..."
              />
            </Field>
            <Field label="Código do template">
              <ConfigInput
                value={String(node.config.template_code ?? "")}
                onChange={(v) => set("template_code", v)}
                placeholder="ex: welcome_email_v1"
                mono
              />
            </Field>
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <CheckboxInput
                  checked={!!node.config.bypass_quiet_hours}
                  onChange={(v) => set("bypass_quiet_hours", v)}
                />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Ignorar horário silencioso
                </span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <CheckboxInput
                  checked={!!node.config.bypass_frequency_cap}
                  onChange={(v) => set("bypass_frequency_cap", v)}
                />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Ignorar limite de frequência
                </span>
              </label>
            </div>
          </>
        )}

        {node.type === "delay" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dias">
              <ConfigInput
                type="number"
                value={String(node.config.days ?? 0)}
                onChange={(v) => set("days", Math.max(0, Number(v)))}
                placeholder="0"
              />
            </Field>
            <Field label="Horas">
              <ConfigInput
                type="number"
                value={String(node.config.hours ?? 0)}
                onChange={(v) => set("hours", Math.max(0, Number(v)))}
                placeholder="0"
              />
            </Field>
            <Field label="Minutos">
              <ConfigInput
                type="number"
                value={String(node.config.minutes ?? 0)}
                onChange={(v) => set("minutes", Math.max(0, Number(v)))}
                placeholder="0"
              />
            </Field>
            <Field label="Segundos">
              <ConfigInput
                type="number"
                value={String(node.config.seconds ?? 0)}
                onChange={(v) => set("seconds", Math.max(0, Number(v)))}
                placeholder="0"
              />
            </Field>
          </div>
        )}

        {node.type === "condition" && (
          <>
            <Field label="Campo do perfil">
              <ConfigSelect
                value={String(node.config.field ?? "")}
                onChange={(v) => set("field", v)}
                options={PROFILE_FIELDS}
                placeholder="Selecionar campo..."
              />
            </Field>
            <Field label="Operador">
              <ConfigSelect
                value={String(node.config.operator ?? "eq")}
                onChange={(v) => set("operator", v)}
                options={OPERATORS}
                placeholder="Selecionar..."
              />
            </Field>
            <Field label="Valor">
              <ConfigInput
                value={String(node.config.value ?? "")}
                onChange={(v) => {
                  const n = Number(v);
                  set("value", v === "" ? "" : isNaN(n) ? v : n);
                }}
                placeholder="ex: 0"
              />
            </Field>
            <Callout>
              <p>
                Porta{" "}
                <span style={{ color: "#10B981" }}>SIM</span>: condição verdadeira
              </p>
              <p>
                Porta{" "}
                <span style={{ color: "#EF4444" }}>NÃO</span>: condição falsa
              </p>
            </Callout>
          </>
        )}

        {(node.type === "add_tag" || node.type === "remove_tag") && (
          <Field label="Nome da tag">
            <ConfigInput
              value={String(node.config.tag ?? "")}
              onChange={(v) => set("tag", v)}
              placeholder="ex: ftd_completed"
              mono
            />
          </Field>
        )}

        {node.type === "wait_until_event" && (
          <>
            <Field label="Evento aguardado">
              <ConfigSelect
                value={String(node.config.event_code ?? "")}
                onChange={(v) => set("event_code", v)}
                options={TRIGGER_EVENTS}
                placeholder="Selecionar evento..."
              />
            </Field>
            <Field label="Timeout (horas)">
              <ConfigInput
                type="number"
                value={String(node.config.timeout_hours ?? 72)}
                onChange={(v) => set("timeout_hours", Math.max(1, Number(v)))}
                placeholder="72"
              />
            </Field>
            <Callout>
              <p>
                Porta{" "}
                <span style={{ color: "#10B981" }}>evento</span>: evento recebido a tempo
              </p>
              <p>
                Porta{" "}
                <span style={{ color: "#F97316" }}>timeout</span>: tempo esgotado
              </p>
            </Callout>
          </>
        )}

        {node.type === "exit" && (
          <div
            className="rounded-lg p-4 text-center"
            style={{ background: "rgba(107,114,128,0.08)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              Nó de saída — sem configurações adicionais.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ConfigInput({
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.8)",
        fontFamily: mono ? "monospace" : undefined,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "rgba(240,165,0,0.4)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(255,255,255,0.08)";
      }}
    />
  );
}

function ConfigSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-xs outline-none transition-colors appearance-none"
      style={{
        background: "rgba(10,13,26,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: value ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
      }}
    >
      <option value="">{placeholder ?? "Selecionar..."}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxInput({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 rounded cursor-pointer"
      style={{ accentColor: "#F0A500" }}
    />
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-3 space-y-1.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {React.Children.map(children, (child) => (
        <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {child}
        </div>
      ))}
    </div>
  );
}
