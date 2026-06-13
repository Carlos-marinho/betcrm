"use client";

import React, { useState } from "react";
import { useMessageLogs, useMessagingStats, useRetryMessage } from "@/lib/hooks";
import { SendMessageModal } from "@/components/features/messages/send-message-modal";
import { PurgeLogsModal } from "@/components/features/messages/purge-logs-modal";
import {
  Mail, MessageSquare, Bell, MessageCircle,
  CheckCircle2, XCircle, Clock, MailOpen, MousePointerClick,
  Activity, ChevronLeft, ChevronRight, Send, RotateCw, Trash2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CHANNEL_FILTERS = [
  { value: "", label: "Todos canais" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
  { value: "whatsapp", label: "WhatsApp" },
];

const STATUS_FILTERS = [
  { value: "", label: "Todos status" },
  { value: "sent", label: "Enviadas" },
  { value: "delivered", label: "Entregues" },
  { value: "opened", label: "Abertas" },
  { value: "clicked", label: "Clicadas" },
  { value: "bounced", label: "Bounce" },
  { value: "failed", label: "Falhou" },
];

const CHANNEL_ICON = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  whatsapp: MessageCircle,
} as const;

const CHANNEL_BADGE = {
  email: "badge-gold",
  sms: "badge-teal",
  push: "badge-muted",
  whatsapp: "badge-teal",
} as const;

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  pending:      { badge: "badge-muted",  icon: Clock,             label: "Pendente" },
  queued:       { badge: "badge-muted",  icon: Clock,             label: "Na fila" },
  sent:         { badge: "badge-muted",  icon: Activity,          label: "Enviada" },
  delivered:    { badge: "badge-teal",   icon: CheckCircle2,      label: "Entregue" },
  opened:       { badge: "badge-gold",   icon: MailOpen,          label: "Aberta" },
  clicked:      { badge: "badge-gold",   icon: MousePointerClick, label: "Clicada" },
  bounced:      { badge: "badge-red",    icon: XCircle,           label: "Bounce" },
  failed:       { badge: "badge-red",    icon: XCircle,           label: "Falhou" },
  complained:   { badge: "badge-red",    icon: XCircle,           label: "Spam" },
  unsubscribed: { badge: "badge-muted",  icon: XCircle,           label: "Descadastrado" },
  rejected:     { badge: "badge-muted",  icon: XCircle,           label: "Rejeitada" },
};

function fmtN(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

function fmtRate(r: number | undefined): string | null {
  if (r === undefined || r === 0) return null;
  return `${r.toFixed(1)}%`;
}

const PERIOD_OPTIONS = [
  { value: 1,  label: "Hoje" },
  { value: 7,  label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
];

export default function MessagesPage() {
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [statsDays, setStatsDays] = useState(7);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);

  const retryMessage = useRetryMessage();

  const handleRetry = (id: number) => {
    retryMessage.mutate(id, {
      onSuccess: () => toast.success("Mensagem reenfileirada para reenvio"),
      onError: () => toast.error("Não foi possível reenviar a mensagem"),
    });
  };

  const { data, isLoading } = useMessageLogs({
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
    page,
  });

  const { data: stats, isLoading: statsLoading } = useMessagingStats({
    channel: channelFilter || undefined,
    days: statsDays,
  });

  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === statsDays)?.label ?? `${statsDays}d`;

  const statCards = [
    {
      label: "Enviadas hoje",
      icon: Activity,
      value: fmtN(stats?.sent_today),
      sub: null,
      accent: "text-muted-foreground",
    },
    {
      label: "Entregues hoje",
      icon: CheckCircle2,
      value: fmtN(stats?.delivered_today),
      sub: fmtRate(stats?.delivery_rate),
      accent: "text-teal",
    },
    {
      label: "Abertas hoje",
      icon: MailOpen,
      value: fmtN(stats?.opened_today),
      sub: fmtRate(stats?.open_rate),
      accent: "text-gold",
    },
    {
      label: "Clicadas hoje",
      icon: MousePointerClick,
      value: fmtN(stats?.clicked_today),
      sub: fmtRate(stats?.click_rate),
      accent: "text-gold",
    },
  ];

  return (
    <>
      <SendMessageModal open={sendModalOpen} onClose={() => setSendModalOpen(false)} />
      <PurgeLogsModal open={purgeModalOpen} onClose={() => setPurgeModalOpen(false)} />
      <div className="flex flex-col flex-1 min-h-0">

        {/* ── Sticky header: title + stats + filters + column headers ── */}
        <div className="shrink-0 px-8 pt-8 pb-0 bg-background border-b border-border/30">
          {/* Title row */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="font-display font-bold text-2xl">Mensagens</h1>
              <span className="text-sm text-muted-foreground mt-0.5 h-5 flex items-center">
                {isLoading ? <Skeleton className="h-3.5 w-40" /> : `${data?.count.toLocaleString("pt-BR") ?? 0} mensagens no período`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPurgeModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar logs
              </button>
              <button
                onClick={() => setSendModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-background text-xs font-semibold hover:bg-gold/90 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar mensagem
              </button>
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatsDays(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      statsDays === opt.value
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-teal">
                <span className="live-dot" />
                atualiza a cada 30s
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="card-vault p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${stat.accent}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    {statsLoading ? (
                      <Skeleton className="h-5 w-16 mt-0.5" />
                    ) : (
                      <p className="font-data text-lg font-semibold text-foreground leading-tight">{stat.value}</p>
                    )}
                    {!statsLoading && stat.sub && (
                      <p className={`text-xs font-data ${stat.accent} opacity-70`}>{stat.sub} ({periodLabel})</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              {CHANNEL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setChannelFilter(f.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    channelFilter === f.value
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === f.value
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[80px_120px_130px_1fr_110px_120px_92px] px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-t border-border/50 bg-card/40">
            <div>Canal</div>
            <div>Usuário</div>
            <div>Template</div>
            <div>Assunto</div>
            <div>Status</div>
            <div>Enviada</div>
            <div className="text-right">Ações</div>
          </div>
        </div>

        {/* ── Scrollable rows ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="divide-y divide-border/50">
            {isLoading && Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[80px_120px_130px_1fr_110px_120px_92px] px-4 py-3">
                <div><Skeleton className="h-4 w-14" /></div>
                <div><Skeleton className="h-4 w-20" /></div>
                <div><Skeleton className="h-4 w-24" /></div>
                <div><Skeleton className="h-4 w-40" /></div>
                <div><Skeleton className="h-4 w-16" /></div>
                <div><Skeleton className="h-4 w-20" /></div>
                <div className="flex justify-end"><Skeleton className="h-4 w-16" /></div>
              </div>
            ))}

            {!isLoading && data?.results.map((msg) => {
              const ChanIcon = CHANNEL_ICON[msg.channel] ?? Mail;
              const chanBadge = CHANNEL_BADGE[msg.channel] ?? "badge-muted";
              const statusCfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.sent;

              return (
                <div key={msg.id} className="grid grid-cols-[80px_120px_130px_1fr_110px_120px_92px] px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center">
                    <span className={chanBadge}>
                      <ChanIcon className="w-3 h-3" />
                      {msg.channel}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-data text-xs text-muted-foreground truncate">{msg.profile_external_id}</span>
                  </div>
                  <div className="flex items-center">
                    {msg.template_code
                      ? <span className="font-data text-xs text-foreground truncate">{msg.template_code}</span>
                      : <span className="text-muted-foreground/30">—</span>
                    }
                  </div>
                  <div className="flex items-center min-w-0">
                    <span className="text-xs text-muted-foreground truncate">{msg.subject || "—"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={statusCfg.badge}>{statusCfg.label}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground">
                      {msg.sent_at
                        ? formatDistanceToNow(new Date(msg.sent_at), { locale: ptBR, addSuffix: true })
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-end">
                    {msg.status === "failed" ? (
                      <button
                        onClick={() => handleRetry(msg.id)}
                        disabled={retryMessage.isPending && retryMessage.variables === msg.id}
                        title={msg.error_message ? `Falha: ${msg.error_message}` : "Reenviar mensagem"}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gold border border-gold/20 hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <RotateCw className={`w-3 h-3 ${retryMessage.isPending && retryMessage.variables === msg.id ? "animate-spin" : ""}`} />
                        Reenviar
                      </button>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </div>
                </div>
              );
            })}

            {!isLoading && data?.results.length === 0 && (
              <div className="px-4 py-16 text-center">
                <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada para este filtro.</p>
              </div>
            )}
          </div>

          {data && data.count > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-data">
                Página {page} de {totalPages} · {data.count.toLocaleString("pt-BR")} total
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
