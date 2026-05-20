"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { useAnalyticsOverview, useAnalyticsTrend } from "@/lib/hooks";
import { Users, TrendingUp, MessageSquare, Workflow, MailOpen, MousePointerClick } from "lucide-react";
import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const WINDOWS = [
  { label: "1h", value: 1 },
  { label: "6h", value: 6 },
  { label: "24h", value: 24 },
  { label: "7d", value: 168 },
];

const FUNNEL_COLORS = {
  total: "rgba(255,255,255,0.15)",
  sent: "rgba(240,165,0,0.5)",
  delivered: "#F0A500",
  opened: "rgba(0,201,167,0.7)",
  clicked: "#00C9A7",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-vault p-3 text-xs space-y-1.5 min-w-[130px]">
      <p className="font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
          </div>
          <span className="font-data text-foreground">{entry.value.toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [hours, setHours] = useState(24);
  const { data, isLoading } = useAnalyticsOverview(hours);
  const { data: trendData, isLoading: trendLoading } = useAnalyticsTrend(7);

  const chartData = trendData?.trend ?? [];
  const hasChartData = chartData.some(
    (d) => d.email > 0 || d.sms > 0 || d.push > 0 || d.whatsapp > 0
  );

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Análises</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Métricas de performance da plataforma</p>
          </div>

          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setHours(w.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-data font-medium transition-all ${
                  hours === w.value
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Profiles KPIs */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Perfis
          </h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title="Total de Perfis"
              value={isLoading ? "—" : (data?.profiles.total ?? 0).toLocaleString("pt-BR")}
              description="usuários ativos"
              icon={<Users />}
              loading={isLoading}
            />
            <MetricCard
              title={`Novos (${WINDOWS.find((w) => w.value === hours)?.label})`}
              value={isLoading ? "—" : (data?.profiles.new ?? 0).toLocaleString("pt-BR")}
              description="registros no período"
              icon={<TrendingUp />}
              accent="gold"
              loading={isLoading}
            />
            <MetricCard
              title={`FTDs (${WINDOWS.find((w) => w.value === hours)?.label})`}
              value={isLoading ? "—" : (data?.profiles.ftd ?? 0).toLocaleString("pt-BR")}
              description="primeiros depósitos"
              icon={<TrendingUp />}
              accent="teal"
              loading={isLoading}
            />
          </div>
        </section>

        {/* Messages KPIs */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Mensagens
          </h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Enviadas" value={isLoading ? "—" : (data?.messages.sent ?? 0).toLocaleString("pt-BR")} icon={<MessageSquare />} loading={isLoading} />
            <MetricCard title="Entregues" value={isLoading ? "—" : (data?.messages.delivered ?? 0).toLocaleString("pt-BR")} icon={<MessageSquare />} accent="teal" loading={isLoading} />
            <MetricCard title="Taxa de abertura" value={isLoading ? "—" : `${data?.messages.open_rate ?? 0}%`} description={`${data?.messages.opened ?? 0} abertas`} icon={<MailOpen />} accent="gold" loading={isLoading} />
            <MetricCard title="Taxa de clique" value={isLoading ? "—" : `${data?.messages.click_rate ?? 0}%`} description={`${data?.messages.clicked ?? 0} clicadas`} icon={<MousePointerClick />} accent="gold" loading={isLoading} />
          </div>
        </section>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Area Chart — last 7 days trend */}
          <div className="card-vault p-5 lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-semibold text-sm">Mensagens por Canal — últimos 7 dias</h3>
              {!trendLoading && !hasChartData && (
                <span className="badge-muted">sem dados</span>
              )}
            </div>

            {trendLoading ? (
              <div className="h-[200px] shimmer-bg rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEmail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F0A500" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F0A500" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSms" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPush" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(240 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(240 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="email" name="Email" stroke="#F0A500" strokeWidth={1.5} fill="url(#gradEmail)" dot={false} />
                  <Area type="monotone" dataKey="sms" name="SMS" stroke="#00C9A7" strokeWidth={1.5} fill="url(#gradSms)" dot={false} />
                  <Area type="monotone" dataKey="push" name="Push" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} fill="url(#gradPush)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-gold inline-block" /> Email</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-teal inline-block" /> SMS</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-white/30 inline-block" /> Push</span>
            </div>
          </div>

          {/* Funnel */}
          <div className="card-vault p-5 lg:col-span-2">
            <h3 className="font-display font-semibold text-sm mb-5">Funil de Mensagens</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-7 shimmer-bg rounded" />)}
              </div>
            ) : data ? (
              <div className="space-y-2">
                {[
                  { label: "Total", value: data.messages.total, color: FUNNEL_COLORS.total },
                  { label: "Enviadas", value: data.messages.sent, color: FUNNEL_COLORS.sent },
                  { label: "Entregues", value: data.messages.delivered, color: FUNNEL_COLORS.delivered },
                  { label: "Abertas", value: data.messages.opened, color: FUNNEL_COLORS.opened },
                  { label: "Clicadas", value: data.messages.clicked, color: FUNNEL_COLORS.clicked },
                ].map((step) => {
                  const maxVal = data.messages.total || 1;
                  const pct = Math.round((step.value / maxVal) * 100);
                  return (
                    <div key={step.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14 text-right font-data shrink-0">{step.label}</span>
                      <div className="flex-1 h-6 bg-border/30 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm flex items-center px-2 transition-all duration-700"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: step.color }}
                        >
                          <span className="text-xs font-data font-medium text-white/80">{step.value.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <span className="text-xs font-data text-muted-foreground w-7 shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Flows KPIs */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Fluxos
          </h2>
          <div className="grid gap-4 grid-cols-2">
            <MetricCard title="Fluxos Ativos" value={isLoading ? "—" : data?.flows.active ?? 0} icon={<Workflow />} accent="teal" loading={isLoading} />
            <MetricCard title="Execuções Ativas" value={isLoading ? "—" : data?.flows.executions_active ?? 0} description="em andamento agora" icon={<Workflow />} loading={isLoading} />
          </div>
        </section>

        {/* Daily bar chart */}
        <div className="card-vault p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-sm">Volume por Canal — últimos 7 dias</h3>
            {!trendLoading && !hasChartData && (
              <span className="badge-muted">sem dados</span>
            )}
          </div>
          {trendLoading ? (
            <div className="h-[180px] shimmer-bg rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "hsl(240 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(240 12% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="email" name="Email" fill="#F0A500" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="sms" name="SMS" fill="#00C9A7" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="push" name="Push" fill="rgba(255,255,255,0.2)" opacity={0.8} radius={[2, 2, 0, 0]} />
                <Bar dataKey="whatsapp" name="WhatsApp" fill="#25D366" opacity={0.7} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
