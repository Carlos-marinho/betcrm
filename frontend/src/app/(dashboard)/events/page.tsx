"use client";

import { useState, useCallback } from "react";
import { useRecentEvents } from "@/lib/hooks";
import { Zap, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventDetailDrawer } from "@/components/features/events/EventDetailDrawer";

const EVENT_META: Record<string, { label: string; badge: string }> = {
  "user.register":                { label: "Cadastro de Usuário",    badge: "badge-gold"  },
  "user.login":                   { label: "Login de Usuário",        badge: "badge-muted" },
  "user.logout":                  { label: "Logout de Usuário",       badge: "badge-muted" },
  "payment.deposit.started":      { label: "Depósito Iniciado",       badge: "badge-gold"  },
  "payment.deposit.completed":    { label: "Depósito Concluído",      badge: "badge-teal"  },
  "payment.deposit.failed":       { label: "Depósito Falhou",         badge: "badge-red"   },
  "payment.withdrawal.request":   { label: "Saque Solicitado",        badge: "badge-muted" },
  "payment.withdrawal.approved":  { label: "Saque Aprovado",          badge: "badge-teal"  },
  "payment.withdrawal.rejected":  { label: "Saque Rejeitado",         badge: "badge-red"   },
  "payment.withdrawal.completed": { label: "Saque Concluído",         badge: "badge-teal"  },
  "game.started":                 { label: "Jogo Iniciado",           badge: "badge-muted" },
  "bonus.activated":              { label: "Bônus Ativado",           badge: "badge-teal"  },
  "bonus.completed":              { label: "Bônus Concluído",         badge: "badge-teal"  },
  "bonus.expired":                { label: "Bônus Expirado",          badge: "badge-red"   },
  "cashback.paid":                { label: "Cashback Pago",           badge: "badge-teal"  },
};

function getBadge(type: string) {
  return EVENT_META[type]?.badge ?? "badge-muted";
}

function getLabel(type: string) {
  return EVENT_META[type]?.label ?? type.split(".").join(" › ");
}

export default function EventsPage() {
  const [paused, setPaused] = useState(false);
  const [hours, setHours] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const { data, isLoading } = useRecentEvents({ limit: 100, hours, paused });
  const events = data?.results ?? [];

  const handleClose = useCallback(() => setSelectedEventId(null), []);

  return (
    <>
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
            <span className="w-6" />
          </div>

          <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {isLoading && (
              <div className="space-y-1.5 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-0 py-1.5">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24 flex-1" />
                  </div>
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

            {!isLoading &&
              events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3 transition-all animate-fade-up text-left group ${
                    selectedEventId === ev.id
                      ? "bg-teal/[0.04] border-l-2 border-teal"
                      : "hover:bg-white/[0.025] border-l-2 border-transparent"
                  }`}
                >
                  <div className="w-52">
                    <span className={getBadge(ev.event_type_code)}>
                      {getLabel(ev.event_type_code)}
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
                        R${" "}
                        {Number(ev.amount).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
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
                  <div className="w-6 flex items-center justify-center">
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-all ${
                        selectedEventId === ev.id
                          ? "text-teal"
                          : "text-muted-foreground/20 group-hover:text-muted-foreground/60"
                      }`}
                    />
                  </div>
                </button>
              ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center">
          Clique em um evento para ver detalhes · Atualiza a cada 5s · integre via POST /api/v1/events/ingest/
        </p>
      </div>

      <EventDetailDrawer eventId={selectedEventId} onClose={handleClose} />
    </>
  );
}
