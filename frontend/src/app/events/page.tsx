"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { useRecentEvents } from "@/lib/hooks";
import { Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const EVENT_BADGE: Record<string, string> = {
  "payment.deposit.completed": "badge-teal",
  "payment.deposit.started": "badge-gold",
  "payment.deposit.failed": "badge-red",
  "user.register": "badge-gold",
  "user.login": "badge-muted",
  "game.started": "badge-muted",
  "bonus.activated": "badge-teal",
  "bonus.expired": "badge-red",
  "payment.withdrawal.request": "badge-muted",
  "payment.withdrawal.completed": "badge-teal",
  "cashback.paid": "badge-teal",
};

function getBadge(type: string) {
  return EVENT_BADGE[type] ?? "badge-muted";
}

export default function EventsPage() {
  const [paused, setPaused] = useState(false);
  const [hours, setHours] = useState(1);

  const { data, isLoading } = useRecentEvents({ limit: 100, hours, paused });
  const events = data?.results ?? [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Eventos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Feed em tempo real de eventos da plataforma
              {data ? ` · ${data.count} eventos` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Window selector */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              {[
                { label: "1h", value: 1 },
                { label: "6h", value: 6 },
                { label: "24h", value: 24 },
              ].map((w) => (
                <button
                  key={w.value}
                  onClick={() => setHours(w.value)}
                  className={`px-2.5 py-1 rounded text-xs font-data font-medium transition-all ${
                    hours === w.value
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {!paused && (
              <div className="flex items-center gap-1.5 text-xs text-teal">
                <span className="live-dot" />
                ao vivo
              </div>
            )}
            <button
              onClick={() => setPaused((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                paused
                  ? "bg-teal/10 text-teal border-teal/20"
                  : "bg-white/5 text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {paused ? "▶ Retomar" : "⏸ Pausar"}
            </button>
          </div>
        </div>

        <div className="card-vault overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span className="w-52">Evento</span>
            <span className="w-28">Usuário</span>
            <span className="w-28">Valor</span>
            <span className="flex-1">Quando</span>
          </div>

          <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 shimmer-bg rounded" />
                ))}
              </div>
            )}

            {!isLoading && events.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhum evento nas últimas {hours}h
                </p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  Envie eventos via POST /api/v1/events/ingest/
                </p>
              </div>
            )}

            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors animate-fade-up"
              >
                <div className="w-52">
                  <span className={getBadge(ev.event_type_code)}>
                    {ev.event_type_code.split(".").join(" › ")}
                  </span>
                </div>
                <div className="w-28">
                  <span className="font-data text-xs text-muted-foreground truncate block">
                    {ev.user_external_id}
                  </span>
                </div>
                <div className="w-28">
                  {ev.amount != null ? (
                    <span className="font-data text-xs text-foreground">
                      R$ {Number(ev.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(ev.occurred_at), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center">
          Atualiza a cada 5s · integre via POST /api/v1/events/ingest/
        </p>
      </div>
    </DashboardShell>
  );
}
