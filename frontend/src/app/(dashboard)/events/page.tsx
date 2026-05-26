"use client";

import { useState, useCallback, useRef } from "react";
import { useRecentEvents } from "@/lib/hooks";
import { Zap, ChevronRight, Search, X, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventDetailDrawer } from "@/components/features/events/EventDetailDrawer";

const EVENT_META: Record<string, { label: string; badge: string }> = {
  "user.register": { label: "Cadastro de Usuário", badge: "badge-gold" },
  "user.login": { label: "Login de Usuário", badge: "badge-muted" },
  "user.logout": { label: "Logout de Usuário", badge: "badge-muted" },
  "payment.deposit.started": { label: "Depósito Iniciado", badge: "badge-gold" },
  "payment.deposit.completed": { label: "Depósito Concluído", badge: "badge-teal" },
  "payment.deposit.failed": { label: "Depósito Falhou", badge: "badge-red" },
  "payment.withdrawal.request": { label: "Saque Solicitado", badge: "badge-muted" },
  "payment.withdrawal.approved": { label: "Saque Aprovado", badge: "badge-teal" },
  "payment.withdrawal.rejected": { label: "Saque Rejeitado", badge: "badge-red" },
  "payment.withdrawal.completed": { label: "Saque Concluído", badge: "badge-teal" },
  "game.started": { label: "Jogo Iniciado", badge: "badge-muted" },
  "bonus.activated": { label: "Bônus Ativado", badge: "badge-teal" },
  "bonus.completed": { label: "Bônus Concluído", badge: "badge-teal" },
  "bonus.expired": { label: "Bônus Expirado", badge: "badge-red" },
  "cashback.paid": { label: "Cashback Pago", badge: "badge-teal" },
};

const EVENT_TYPE_OPTIONS = [
  { label: "Todos os tipos", value: "" },
  ...Object.entries(EVENT_META).map(([code, meta]) => ({
    label: meta.label,
    value: code,
  })),
];

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
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUser, setDebouncedUser] = useState("");
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleUserSearch(val: string) {
    setUserSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedUser(val), 380);
  }

  const { data, isLoading } = useRecentEvents({
    limit: 100,
    hours,
    paused,
    event_type: eventTypeFilter,
    user_external_id: debouncedUser,
  });
  const events = data?.results ?? [];

  const handleClose = useCallback(() => setSelectedEventId(null), []);

  const activeFilterCount = [eventTypeFilter !== "", debouncedUser !== ""].filter(Boolean).length;

  const selectedTypeLabel =
    EVENT_TYPE_OPTIONS.find((o) => o.value === eventTypeFilter)?.label ?? "Todos os tipos";

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">
        {/* ── Sticky header: title + controls + filters + column headers ── */}
        <div className="shrink-0 px-8 pt-8 pb-0 bg-background border-b border-border/30">
          {/* Title + controls */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="font-display font-bold text-2xl">Eventos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Feed em tempo real de eventos da plataforma
                {data ? ` · ${data.count} eventos` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
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

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <div className="relative">
              <button
                onClick={() => setShowTypeMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-all ${
                  eventTypeFilter
                    ? "bg-gold/10 text-gold border-gold/25"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {selectedTypeLabel}
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
              </button>
              {showTypeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-xl overflow-y-auto max-h-72 min-w-[220px]">
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setEventTypeFilter(opt.value); setShowTypeMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          eventTypeFilter === opt.value
                            ? "bg-gold/10 text-gold"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="Filtrar por ID de usuário..."
                className="bg-input border border-border rounded-md pl-8 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors w-56"
              />
              {userSearch && (
                <button
                  onClick={() => handleUserSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs font-medium text-gold">
                  <span className="w-4 h-4 rounded-full bg-gold text-[10px] font-bold text-background flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                  filtro{activeFilterCount !== 1 ? "s" : ""} ativo{activeFilterCount !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => { setEventTypeFilter(""); handleUserSearch(""); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-4 -mx-8 px-8 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-t border-border/50 bg-card/40">
            <span className="w-52">Evento</span>
            <span className="w-28">Usuário</span>
            <span className="w-28">Valor</span>
            <span className="flex-1">Quando</span>
            <span className="w-6" />
          </div>
        </div>

        {/* ── Scrollable rows ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="divide-y divide-border/50">
            {isLoading && (
              <div className="space-y-1.5 px-8 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-1.5">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24 flex-1" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && events.length === 0 && (
              <div className="px-8 py-16 text-center">
                <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {activeFilterCount > 0
                    ? "Nenhum evento com estes filtros nas últimas " + hours + "h"
                    : `Nenhum evento nas últimas ${hours}h`}
                </p>
                {activeFilterCount === 0 && (
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    Envie eventos via POST /api/v1/events/ingest/
                  </p>
                )}
              </div>
            )}

            {!isLoading &&
              events.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`w-full flex items-center gap-4 px-8 py-3 transition-all animate-fade-up text-left group ${
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
                        {Number(ev.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ev.occurred_at), { locale: ptBR, addSuffix: true })}
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

          <p className="text-xs text-muted-foreground/50 text-center px-8 py-3">
            Clique em um evento para ver detalhes · Atualiza a cada 5s ·
            integre via POST /api/v1/events/ingest/
          </p>
        </div>
      </div>

      <EventDetailDrawer eventId={selectedEventId} onClose={handleClose} />
    </>
  );
}
