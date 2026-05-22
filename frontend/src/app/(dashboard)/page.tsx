"use client";

import { MetricCard } from "@/components/dashboard/metric-card";
import { useAnalyticsOverview, useRecentEvents } from "@/lib/hooks";
import { Users, TrendingUp, MessageSquare, Workflow, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const PERIODS = [
  { label: "6h",  hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d",  hours: 168 },
  { label: "30d", hours: 720 },
] as const;

type PeriodHours = (typeof PERIODS)[number]["hours"];

function windowLabel(hours: number): string {
  if (hours < 24) return `${hours}h`;
  return `${hours / 24}d`;
}

function eventColor(type: string) {
  if (type.includes("deposit.completed")) return "badge-teal";
  if (type.includes("deposit.started")) return "badge-gold";
  if (type.includes("withdrawal")) return "badge-muted";
  if (type.includes("register")) return "badge-gold";
  if (type.includes("bonus")) return "badge-teal";
  if (type.includes("failed")) return "badge-red";
  return "badge-muted";
}

export default function DashboardPage() {
  const [hours, setHours] = useState<PeriodHours>(24);
  const { data, isLoading } = useAnalyticsOverview(hours);
  const { data: eventsData, isLoading: eventsLoading } = useRecentEvents({ limit: 8, hours, paused: hours > 24 });

  const ftdRate =
    data && data.profiles.total > 0
      ? ((data.profiles.ftd / data.profiles.total) * 100).toFixed(1) + "%"
      : "—";

  const liveEvents = eventsData?.results ?? [];
  const isLive = hours <= 24;
  const wLabel = windowLabel(hours);

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Últimas {wLabel}
              {isLive && " · atualiza a cada 30s"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex items-center bg-card border border-border rounded-lg p-0.5 gap-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.hours}
                  onClick={() => setHours(p.hours)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-data font-medium transition-all duration-150",
                    hours === p.hours
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Live / historic badge */}
            {isLive ? (
              <div className="flex items-center gap-1.5 text-xs text-teal">
                <span className="live-dot" />
                Ao vivo
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <History className="w-3 h-3" />
                Histórico
              </div>
            )}
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 animate-fade-up">
          <MetricCard
            title="Total de Perfis"
            value={isLoading ? "—" : (data?.profiles.total ?? 0).toLocaleString("pt-BR")}
            description={`+${data?.profiles.new ?? 0} novos nas últ. ${wLabel}`}
            icon={<Users />}
            accent="default"
            loading={isLoading}
          />
          <MetricCard
            title="Conversão FTD"
            value={isLoading ? "—" : ftdRate}
            description={`${data?.profiles.ftd ?? 0} FTDs nas últ. ${wLabel}`}
            icon={<TrendingUp />}
            accent="gold"
            loading={isLoading}
          />
          <MetricCard
            title={`Mensagens (${wLabel})`}
            value={isLoading ? "—" : (data?.messages.sent ?? 0).toLocaleString("pt-BR")}
            description={`${data?.messages.open_rate ?? 0}% taxa de abertura`}
            icon={<MessageSquare />}
            accent="teal"
            loading={isLoading}
          />
          <MetricCard
            title="Fluxos Ativos"
            value={isLoading ? "—" : data?.flows.active ?? 0}
            description={`${data?.flows.executions_active ?? 0} execuções ativas`}
            icon={<Workflow />}
            accent="default"
            loading={isLoading}
          />
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {/* Events Feed */}
          <div className="card-vault p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm">Feed de Eventos</h3>
              {isLive ? (
                <div className="flex items-center gap-1.5 text-xs text-teal">
                  <span className="live-dot" />
                  ao vivo
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <History className="w-3 h-3" />
                  últ. {wLabel}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {eventsLoading && (
                <div className="space-y-1.5 py-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-3.5 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              )}
              {!eventsLoading && liveEvents.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nenhum evento nas últimas {wLabel}
                </p>
              )}
              {!eventsLoading && liveEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 animate-fade-up"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={eventColor(ev.event_type_code)}>
                      {ev.event_type_code.split(".").slice(-1)[0]}
                    </span>
                    <span className="text-xs font-data text-muted-foreground truncate">
                      {ev.user_external_id}
                    </span>
                  </div>
                  <span className="text-xs font-data text-muted-foreground/60 shrink-0 ml-2">
                    {formatDistanceToNow(new Date(ev.occurred_at), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Messages Breakdown */}
          <div className="card-vault p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm">Performance de Mensagens</h3>
              <span className="badge-muted">{wLabel}</span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-1 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Enviadas",  value: data?.messages.sent ?? 0,       max: data?.messages.total ?? 1, color: "bg-gold" },
                  { label: "Entregues", value: data?.messages.delivered ?? 0,   max: data?.messages.total ?? 1, color: "bg-teal" },
                  { label: "Abertas",   value: data?.messages.opened ?? 0,      max: data?.messages.total ?? 1, color: "bg-teal/60" },
                  { label: "Clicadas",  value: data?.messages.clicked ?? 0,     max: data?.messages.total ?? 1, color: "bg-teal/30" },
                ].map((row) => {
                  const pct = row.max > 0 ? Math.round((row.value / row.max) * 100) : 0;
                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-data text-foreground">
                          {row.value.toLocaleString("pt-BR")}
                          <span className="text-muted-foreground ml-1">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full ${row.color} rounded-full transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
