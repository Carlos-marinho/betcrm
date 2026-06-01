"use client";

import {
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Target,
  Send,
  CheckCheck,
  MailOpen,
  MousePointerClick,
  X,
} from "lucide-react";
import {
  useFlowMessages,
  type FlowChannelMetrics,
} from "@/lib/hooks";

const CHANNEL_META: Record<
  string,
  { label: string; icon: typeof Mail; accent: string }
> = {
  email: { label: "Email", icon: Mail, accent: "text-sky-400" },
  sms: { label: "SMS", icon: Smartphone, accent: "text-emerald-400" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, accent: "text-green-400" },
  push: { label: "Push", icon: Bell, accent: "text-violet-400" },
};

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Mail;
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="font-mono text-sm text-white/90">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        {suffix && <span className="text-white/40">{suffix}</span>}
      </span>
    </div>
  );
}

function ChannelCard({ metrics }: { metrics: FlowChannelMetrics }) {
  const meta = CHANNEL_META[metrics.channel] ?? {
    label: metrics.channel,
    icon: Send,
    accent: "text-white/60",
  };
  const Icon = meta.icon;
  const isSms = metrics.channel === "sms" || metrics.channel === "whatsapp";

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B0F1C] p-3">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${meta.accent}`} />
        <span className="text-xs font-semibold text-white/85">{meta.label}</span>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-white/40">
          {metrics.sent.toLocaleString("pt-BR")} envios
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={CheckCheck} label="Entrega" value={metrics.delivery_rate} suffix="%" />
        <Stat icon={MousePointerClick} label="Clique" value={metrics.click_rate} suffix="%" />
        {isSms ? (
          <Stat icon={MousePointerClick} label="Cliques" value={metrics.clicked} />
        ) : (
          <Stat icon={MailOpen} label="Abertura" value={metrics.open_rate} suffix="%" />
        )}
        <Stat icon={Send} label="Entregues" value={metrics.delivered} />
      </div>

      {isSms && (
        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          Cliques rastreados via redirect próprio. SMS não possui evento de abertura.
        </p>
      )}
    </div>
  );
}

export function FlowMetricsPanel({
  flowId,
  onClose,
}: {
  flowId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useFlowMessages(flowId);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-screen w-[420px] max-w-[92vw] flex-col border-l border-white/10 bg-[#080B16] shadow-2xl">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-4">
          <Target className="h-4 w-4 text-gold" />
          <span className="text-sm font-semibold text-white/85">Métricas do fluxo</span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          )}

          {!isLoading && data && (
            <>
              {/* Meta de conversão */}
              <div className="rounded-xl border border-gold/20 bg-gold/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-gold/90">
                    <Target className="h-3.5 w-3.5" />
                    Meta atingida
                  </span>
                  <span className="font-mono text-2xl font-semibold text-gold">
                    {data.goal.goal_rate}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  {data.goal.reached.toLocaleString("pt-BR")} de{" "}
                  {data.goal.enrolled.toLocaleString("pt-BR")} inscritos alcançaram o objetivo
                </p>
              </div>

              {/* Totais consolidados */}
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Consolidado
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Stat icon={Send} label="Enviadas" value={data.totals.sent} />
                  <Stat icon={CheckCheck} label="Entregues" value={data.totals.delivered} />
                  <Stat icon={MailOpen} label="Abertura" value={data.totals.open_rate} suffix="%" />
                  <Stat
                    icon={MousePointerClick}
                    label="Clique"
                    value={data.totals.click_rate}
                    suffix="%"
                  />
                </div>
              </div>

              {/* Por canal */}
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Por canal
                </h3>
                {data.by_channel.length === 0 ? (
                  <p className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-6 text-center text-xs text-white/30">
                    Nenhuma mensagem enviada por este fluxo ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.by_channel.map((c) => (
                      <ChannelCard key={c.channel} metrics={c} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
