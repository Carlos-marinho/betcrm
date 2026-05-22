"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Info, Plus, Trash2, Send, Zap, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Search, Mail } from "lucide-react";
import { api } from "@/lib/api";
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

const PROFILE_FIELD_OPTIONS = [
  { value: "external_id", label: "ID externo" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
  { value: "first_name", label: "Nome" },
  { value: "last_name", label: "Sobrenome" },
  { value: "document", label: "CPF/Documento" },
  { value: "country", label: "País" },
  { value: "state", label: "Estado" },
  { value: "city", label: "Cidade" },
  { value: "deposit_count", label: "Qtd. depósitos" },
  { value: "total_deposits", label: "Total depositado" },
  { value: "ltv", label: "LTV" },
  { value: "tags", label: "Tags" },
  { value: "favorite_game", label: "Jogo favorito" },
  { value: "registered_at", label: "Cadastrou em" },
  { value: "last_deposit_at", label: "Último depósito em" },
  { value: "last_login_at", label: "Último login em" },
  { value: "ftd_at", label: "FTD em" },
  { value: "is_active", label: "Ativo" },
  { value: "is_verified", label: "Verificado" },
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
                onChange={(v) => {
                  onChange({
                    ...node,
                    config: {
                      ...node.config,
                      channel: v,
                      from_email: "",
                      from_name: "",
                    },
                  });
                }}
                options={CHANNELS}
                placeholder="Selecionar canal..."
              />
            </Field>
            {node.config.channel === "email" ? (
              <>
                <EmailTemplatePicker
                  value={String(node.config.template_code ?? "")}
                  onChange={(code) => set("template_code", code)}
                />
                <EmailFromPicker
                  valueEmail={String(node.config.from_email ?? "")}
                  valueName={String(node.config.from_name ?? "")}
                  onChange={(from) => {
                    onChange({
                      ...node,
                      config: {
                        ...node.config,
                        from_email: from?.email ?? "",
                        from_name: from?.name ?? "",
                      },
                    });
                  }}
                />
              </>
            ) : (
              <Field label="Código do template">
                <ConfigInput
                  value={String(node.config.template_code ?? "")}
                  onChange={(v) => set("template_code", v)}
                  placeholder="ex: welcome_sms_v1"
                  mono
                />
              </Field>
            )}
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
            {node.config.channel === "email" && !!node.config.template_code && (
              <TestEmailSection templateCode={String(node.config.template_code)} />
            )}
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

        {node.type === "http_request" && (
          <HttpRequestConfig node={node} set={set} />
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

// ── HTTP Request node config ──────────────────────────────────────────────────

function HttpRequestConfig({
  node,
  set,
}: {
  node: FlowNode;
  set: (key: string, value: unknown) => void;
}) {
  const profileFields: string[] = Array.isArray(node.config.profile_fields)
    ? (node.config.profile_fields as string[])
    : [];

  const extraPayload: Record<string, string> =
    node.config.extra_payload && typeof node.config.extra_payload === "object"
      ? (node.config.extra_payload as Record<string, string>)
      : {};

  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  function toggleField(field: string) {
    const next = profileFields.includes(field)
      ? profileFields.filter((f) => f !== field)
      : [...profileFields, field];
    set("profile_fields", next);
  }

  function addExtra() {
    const k = newKey.trim();
    const v = newVal.trim();
    if (!k) return;
    set("extra_payload", { ...extraPayload, [k]: v });
    setNewKey("");
    setNewVal("");
  }

  function removeExtra(key: string) {
    const next = { ...extraPayload };
    delete next[key];
    set("extra_payload", next);
  }

  return (
    <>
      <Field label="URL do Webhook (FlowLab)">
        <ConfigInput
          value={String(node.config.url ?? "")}
          onChange={(v) => set("url", v)}
          placeholder="https://flowlab.io/webhook/..."
          mono
        />
        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
          Método POST. Será chamado quando o fluxo atingir este nó.
        </p>
      </Field>

      <Field label="Campos do perfil no payload">
        <div className="space-y-1.5 mt-0.5">
          {PROFILE_FIELD_OPTIONS.map((opt) => {
            const checked = profileFields.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <CheckboxInput
                  checked={checked}
                  onChange={() => toggleField(opt.value)}
                />
                <span
                  className="text-xs"
                  style={{ color: checked ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)" }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-[9px] font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "rgba(255,255,255,0.2)" }}
                >
                  {opt.value}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[10px] mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
          Campos marcados serão enviados no body JSON do POST.
        </p>
      </Field>

      <Field label="Payload extra (livre)">
        {Object.entries(extraPayload).length > 0 && (
          <div className="space-y-1.5 mb-2">
            {Object.entries(extraPayload).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span
                  className="flex-1 rounded px-2 py-1 text-[10px] font-mono truncate"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }}
                >
                  {k}: {v}
                </span>
                <button
                  onClick={() => removeExtra(k)}
                  className="shrink-0 p-1 rounded transition-colors"
                  style={{ color: "rgba(239,68,68,0.5)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#EF4444")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.5)")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="chave"
            className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-mono outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              minWidth: 0,
            }}
            onKeyDown={(e) => e.key === "Enter" && addExtra()}
          />
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            placeholder="valor"
            className="flex-1 rounded-lg px-2 py-1.5 text-[10px] outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              minWidth: 0,
            }}
            onKeyDown={(e) => e.key === "Enter" && addExtra()}
          />
          <button
            onClick={addExtra}
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{
              background: "rgba(168,85,247,0.15)",
              border: "1px solid rgba(168,85,247,0.2)",
              color: "#A855F7",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
          Pares chave/valor adicionais incluídos no POST. Pressione Enter para adicionar.
        </p>
      </Field>

      <Callout>
        <p>O payload sempre inclui <span style={{ color: "rgba(168,85,247,0.9)" }}>_betcrm_flow</span> e <span style={{ color: "rgba(168,85,247,0.9)" }}>_betcrm_execution</span> para rastreabilidade.</p>
        <p>Erros HTTP não interrompem o fluxo — são registrados no contexto e a execução continua.</p>
      </Callout>

      <TestWebhookSection
        url={String(node.config.url ?? "")}
        profileFields={profileFields}
        extraPayload={extraPayload}
      />
    </>
  );
}

// ── Test email section ────────────────────────────────────────────────────────

function TestEmailSection({ templateCode }: { templateCode: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message_id?: string; error?: string } | null>(null);

  async function send() {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/flows/test_email/", {
        template_code: templateCode,
        test_email: email.trim(),
      });
      setResult(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro desconhecido";
      setResult({ success: false, error: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(59,130,246,0.2)", background: "rgba(59,130,246,0.04)" }}
    >
      <button
        onClick={() => { setOpen((v) => !v); setResult(null); }}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
        style={{ color: "rgba(59,130,246,0.85)" }}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Send className="w-3 h-3" />
          Enviar e-mail de teste
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: "1px solid rgba(59,130,246,0.12)" }}>
          <p className="text-[10px] pt-2.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            Renderiza o template com perfil fictício e envia para o e-mail abaixo via provider ativo.
          </p>
          <div className="flex gap-1.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
              }}
              onKeyDown={(e) => e.key === "Enter" && send()}
              onFocus={(e) => { e.target.style.borderColor = "rgba(59,130,246,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
            <button
              onClick={send}
              disabled={loading || !email.trim()}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
              style={{ background: "rgba(59,130,246,0.2)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {loading ? "Enviando…" : "Enviar"}
            </button>
          </div>

          {result && (
            <div
              className="flex items-start gap-2 rounded-lg px-2.5 py-2"
              style={{
                background: result.success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${result.success ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              {result.success
                ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#EF4444" }} />}
              <p className="text-[10px]" style={{ color: result.success ? "#10B981" : "#EF4444" }}>
                {result.success
                  ? `Enviado! ID: ${result.message_id || "—"}`
                  : result.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Test webhook section + modal ──────────────────────────────────────────────

interface WebhookTestResult {
  status_code?: number;
  body?: unknown;
  headers?: Record<string, string>;
  duration_ms?: number;
  error?: string;
}

function WebhookResultModal({
  result,
  onClose,
}: {
  result: WebhookTestResult;
  onClose: () => void;
}) {
  const isOk = result.status_code !== undefined && result.status_code < 400;
  const bodyStr =
    result.body !== undefined
      ? typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body, null, 2)
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "#0D1120", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4" style={{ color: "#A855F7" }} />
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.88)" }}>
              Resultado do teste
            </span>
          </div>
          <div className="flex items-center gap-3">
            {result.duration_ms !== undefined && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {result.duration_ms}ms
              </span>
            )}
            <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: "calc(80vh - 56px)" }}>
          {/* Status or error */}
          {result.error ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#EF4444" }} />
              <span className="text-xs" style={{ color: "#EF4444" }}>{result.error}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{
                background: isOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${isOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              {isOk
                ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10B981" }} />
                : <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#EF4444" }} />}
              <span
                className="text-sm font-bold"
                style={{ color: isOk ? "#10B981" : "#EF4444" }}
              >
                HTTP {result.status_code}
              </span>
              <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {isOk ? "sucesso" : "erro"}
              </span>
            </div>
          )}

          {/* Body */}
          {bodyStr && (
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Response body
              </p>
              <pre
                className="rounded-lg px-3 py-2.5 text-[10px] overflow-x-auto whitespace-pre-wrap break-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "monospace",
                }}
              >
                {bodyStr}
              </pre>
            </div>
          )}

          {/* Selected headers */}
          {result.headers && Object.keys(result.headers).length > 0 && (
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Headers da resposta
              </p>
              <div
                className="rounded-lg px-3 py-2 space-y-1"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {Object.entries(result.headers)
                  .filter(([k]) =>
                    ["content-type", "x-request-id", "x-powered-by", "server"].includes(k.toLowerCase())
                  )
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[10px]" style={{ fontFamily: "monospace" }}>
                      <span style={{ color: "rgba(168,85,247,0.7)", minWidth: 120 }}>{k}</span>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>{v}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TestWebhookSection({
  url,
  profileFields,
  extraPayload,
}: {
  url: string;
  profileFields: string[];
  extraPayload: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [modalResult, setModalResult] = useState<WebhookTestResult | null>(null);

  async function runTest() {
    if (!url.trim()) return;
    setLoading(true);
    setModalResult(null);
    try {
      const { data } = await api.post("/flows/test_webhook/", {
        url: url.trim(),
        profile_fields: profileFields,
        extra_payload: extraPayload,
      });
      setModalResult(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: WebhookTestResult; status?: number } };
      if (axiosErr.response?.data) {
        setModalResult(axiosErr.response.data);
      } else {
        setModalResult({ error: "Erro ao conectar ao backend" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={runTest}
        disabled={loading || !url.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-opacity disabled:opacity-40"
        style={{
          background: "rgba(168,85,247,0.12)",
          border: "1px solid rgba(168,85,247,0.25)",
          color: "#A855F7",
        }}
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Zap className="w-3.5 h-3.5" />}
        {loading ? "Disparando…" : "Testar webhook agora"}
      </button>

      {modalResult && (
        <WebhookResultModal
          result={modalResult}
          onClose={() => setModalResult(null)}
        />
      )}
    </>
  );
}

// ── Email Template Picker ─────────────────────────────────────────────────────

interface FromAddressOption {
  email: string;
  name: string;
  label: string;
}

function configString(config: Record<string, unknown> | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getFromAddressOptions(provider: { config: Record<string, unknown> } | null): FromAddressOption[] {
  if (!provider?.config) return [];

  const config = provider.config;
  const options: FromAddressOption[] = [];
  const defaultEmail = configString(config, "default_from_email") || configString(config, "from_email");
  const defaultName = configString(config, "default_from_name") || configString(config, "from_name");
  const domain = configString(config, "domain") || defaultEmail.split("@")[1] || "";

  if (defaultEmail) {
    options.push({
      email: defaultEmail,
      name: defaultName,
      label: defaultName ? `${defaultName} <${defaultEmail}>` : defaultEmail,
    });
  }

  const extra = Array.isArray(config.from_addresses) ? config.from_addresses : [];
  extra.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const prefix = typeof record.prefix === "string" ? record.prefix.trim() : "";
    if (!prefix) return;
    const email = prefix.includes("@") || !domain ? prefix : `${prefix}@${domain}`;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (options.some((option) => option.email === email)) return;
    options.push({
      email,
      name,
      label: name ? `${name} <${email}>` : email,
    });
  });

  return options;
}

function EmailFromPicker({
  valueEmail,
  valueName,
  onChange,
}: {
  valueEmail: string;
  valueName: string;
  onChange: (from: FromAddressOption | null) => void;
}) {
  const [options, setOptions] = useState<FromAddressOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get("/messaging/providers/?channel=email&is_active=true&page_size=200")
      .then(({ data }) => {
        if (cancelled) return;
        const providers = (data.results ?? data) as Array<{
          is_primary: boolean;
          config: Record<string, unknown>;
        }>;
        const provider = providers.find((p) => p.is_primary) ?? providers[0] ?? null;
        setOptions(getFromAddressOptions(provider));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || options.length === 0) return null;

  const selectedValue = valueEmail || "__template_default__";

  return (
    <Field label="Remetente">
      <ConfigSelect
        value={selectedValue}
        onChange={(value) => {
          if (value === "__template_default__") {
            onChange(null);
            return;
          }
          const option = options.find((item) => item.email === value) ?? null;
          onChange(option);
        }}
        options={[
          { value: "__template_default__", label: "Padrão do template/provedor" },
          ...options.map((option) => ({ value: option.email, label: option.label })),
        ]}
        placeholder="Selecionar remetente..."
      />
      {valueEmail && (
        <p className="text-[10px] mt-1 font-mono" style={{ color: "rgba(255,255,255,0.24)" }}>
          {valueName ? `${valueName} <${valueEmail}>` : valueEmail}
        </p>
      )}
    </Field>
  );
}

interface TemplateOption {
  id: number;
  code: string;
  name: string;
  subject: string;
  description: string;
  category: string;
  from_name: string;
  from_email: string;
  html_body: string;
  is_active: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  transactional: { bg: "rgba(59,130,246,0.12)", text: "#3B82F6", border: "rgba(59,130,246,0.25)" },
  marketing: { bg: "rgba(240,165,0,0.12)", text: "#F0A500", border: "rgba(240,165,0,0.25)" },
  system: { bg: "rgba(107,114,128,0.12)", text: "#9CA3AF", border: "rgba(107,114,128,0.25)" },
};

function EmailTemplatePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setSelectedName(null); return; }
    api.get(`/templates/?channel=email&search=${encodeURIComponent(value)}`)
      .then(({ data }) => {
        const results: TemplateOption[] = data.results ?? data;
        const match = results.find((t) => t.code === value);
        if (match) setSelectedName(match.name);
      })
      .catch(() => {});
  }, [value]);

  return (
    <Field label="Template de email">
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs transition-all text-left"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: value ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
      >
        <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: value ? "#3B82F6" : "rgba(255,255,255,0.3)" }} />
        <div className="flex-1 min-w-0">
          {value ? (
            <>
              <div className="truncate font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                {selectedName ?? value}
              </div>
              <div className="font-mono text-[9px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                {value}
              </div>
            </>
          ) : (
            <span>Selecionar template de email...</span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>

      {open && (
        <TemplatePickerModal
          selected={value}
          onSelect={(code, name) => { onChange(code); setSelectedName(name); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </Field>
  );
}

function TemplatePickerModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (code: string, name: string) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    api.get("/templates/?channel=email&is_active=true&page_size=200")
      .then(({ data }) => {
        const results: TemplateOption[] = data.results ?? data;
        setTemplates(results);
        if (selected) {
          const match = results.find((t) => t.code === selected);
          if (match) setActiveId(match.id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });

  const activeTemplate = templates.find((t) => t.id === activeId) ?? null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "#080B16",
          border: "1px solid rgba(255,255,255,0.09)",
          maxWidth: 920,
          maxHeight: "82vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              <Mail className="w-4 h-4" style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                Templates de Email
              </h2>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                {loading ? "Carregando..." : `${templates.length} template${templates.length !== 1 ? "s" : ""} disponível${templates.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "rgba(255,255,255,0.22)" }}
            />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, código ou assunto..."
              className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)",
              }}
              onFocus={(e) => { e.target.style.borderColor = "rgba(59,130,246,0.35)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>
        </div>

        {/* Body: list + preview */}
        <div className="flex flex-1 min-h-0">
          {/* Left: template list */}
          <div
            className="w-72 shrink-0 overflow-y-auto"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "rgba(59,130,246,0.5)" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
                  {search ? "Nenhum template encontrado." : "Nenhum template de email disponível."}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map((t) => {
                  const isActive = t.id === activeId;
                  const isSelected = t.code === selected;
                  const catStyle = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.system;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveId(t.id)}
                      onDoubleClick={() => onSelect(t.code, t.name)}
                      className="w-full text-left rounded-lg px-3 py-2.5 transition-all"
                      style={{
                        background: isActive ? "rgba(59,130,246,0.1)" : "transparent",
                        border: `1px solid ${isActive ? "rgba(59,130,246,0.28)" : "transparent"}`,
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="text-xs font-medium leading-tight flex-1 min-w-0 truncate"
                          style={{ color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)" }}
                        >
                          {t.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} title="Template atual" />
                          )}
                          <span
                            className="rounded text-[9px] font-medium px-1.5 py-0.5 whitespace-nowrap"
                            style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}
                          >
                            {t.category}
                          </span>
                        </div>
                      </div>
                      {t.subject && (
                        <p className="text-[10px] mt-1 truncate" style={{ color: "rgba(255,255,255,0.28)" }}>
                          {t.subject}
                        </p>
                      )}
                      <p className="text-[9px] font-mono mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.18)" }}>
                        {t.code}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!activeTemplate ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <Mail className="w-7 h-7" style={{ color: "rgba(255,255,255,0.1)" }} />
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Selecione um template para pré-visualizar
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Metadata bar */}
                <div
                  className="px-5 py-3.5 shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: "rgba(255,255,255,0.88)" }}>
                        {activeTemplate.name}
                      </h3>
                      {activeTemplate.subject && (
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                          <span style={{ color: "rgba(255,255,255,0.22)" }}>Assunto: </span>
                          {activeTemplate.subject}
                        </p>
                      )}
                      {(activeTemplate.from_name || activeTemplate.from_email) && (
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>
                          De: {activeTemplate.from_name
                            ? `${activeTemplate.from_name} <${activeTemplate.from_email}>`
                            : activeTemplate.from_email}
                        </p>
                      )}
                      {activeTemplate.description && (
                        <p className="text-[10px] mt-1.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.22)" }}>
                          {activeTemplate.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onSelect(activeTemplate.code, activeTemplate.name)}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
                      style={{
                        background: "rgba(59,130,246,0.15)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        color: "#3B82F6",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.25)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.15)"; }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Usar template
                    </button>
                  </div>
                </div>

                {/* HTML preview */}
                <div className="flex-1 min-h-0 p-4">
                  {activeTemplate.html_body ? (
                    <div
                      className="w-full h-full rounded-xl overflow-hidden"
                      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#ffffff" }}
                    >
                      <EmailPreviewFrame html={activeTemplate.html_body} />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full rounded-xl flex items-center justify-center"
                      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                        Template sem body HTML
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailPreviewFrame({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const IFRAME_W = 600;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) {
        const s = el.clientWidth / IFRAME_W;
        setScale(s);
        scaleRef.current = s;
      }
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Forward wheel events from the overlay into the iframe's scroll
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      iframeRef.current?.contentWindow?.scrollBy(e.deltaX / scaleRef.current, e.deltaY / scaleRef.current);
    };
    overlay.addEventListener("wheel", handler, { passive: false });
    return () => overlay.removeEventListener("wheel", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-same-origin"
        title="Email preview"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: IFRAME_W,
          height: `${Math.round(100 / scale)}%`,
          border: "none",
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          pointerEvents: "none",
          display: "block",
        }}
      />
      {/* Transparent overlay: captures wheel events and forwards to iframe scroll, blocks all clicks */}
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, cursor: "default" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
