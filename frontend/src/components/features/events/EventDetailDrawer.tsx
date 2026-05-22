"use client";

import { useEventDetail, type EventDetail } from "@/lib/hooks";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Hash,
  Tag,
  Zap,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

// ── JSON Viewer ───────────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function JsonNode({ value, depth = 0 }: { value: JsonValue; depth?: number }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === "boolean")
    return <span className={value ? "json-true" : "json-false"}>{String(value)}</span>;
  if (typeof value === "number") return <span className="json-number">{value}</span>;
  if (typeof value === "string") return <span className="json-string">"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="json-bracket">[]</span>;
    return (
      <span>
        <span className="json-bracket">[</span>
        <div style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
          {value.map((item, i) => (
            <div key={i}>
              <JsonNode value={item as JsonValue} depth={depth + 1} />
              {i < value.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
        </div>
        <span className="json-bracket" style={{ paddingLeft: `${depth * 16}px` }}>]</span>
      </span>
    );
  }

  const entries = Object.entries(value as Record<string, JsonValue>);
  if (entries.length === 0) return <span className="json-bracket">{"{}"}</span>;

  return (
    <span>
      <span className="json-bracket">{"{"}</span>
      <div style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
        {entries.map(([k, v], i) => (
          <div key={k}>
            <span className="json-key">"{k}"</span>
            <span className="json-colon">: </span>
            <JsonNode value={v as JsonValue} depth={depth + 1} />
            {i < entries.length - 1 && <span className="json-comma">,</span>}
          </div>
        ))}
      </div>
      <span className="json-bracket" style={{ paddingLeft: `${depth * 16}px` }}>{"}"}</span>
    </span>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-gold/10 text-gold border-gold/20",
  low: "bg-white/5 text-muted-foreground border-white/10",
};

const CATEGORY_LABEL: Record<string, string> = {
  acquisition: "Aquisição",
  engagement: "Engajamento",
  monetization: "Monetização",
  retention: "Retenção",
  promotion: "Promoção",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-white/5 rounded" />
      <div className="h-4 w-64 bg-white/5 rounded" />
      <div className="h-px bg-border" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-white/5 rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
        ))}
      </div>
      <div className="h-px bg-border" />
      <div className="h-32 bg-white/5 rounded" />
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function DrawerContent({ event }: { event: EventDetail }) {
  const profile = event.profile;
  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "?"
    : event.user_external_id.slice(0, 2).toUpperCase();

  const fullName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-5 border-b border-border/60 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-lg leading-tight text-foreground">
              {event.event_type_name}
            </h2>
            <p className="font-data text-xs text-muted-foreground mt-0.5 truncate">
              {event.event_type_code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
              PRIORITY_STYLE[event.event_type_priority] ?? PRIORITY_STYLE.low
            }`}
          >
            {event.event_type_priority}
          </span>
          {event.event_type_category && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-muted-foreground border border-white/8">
              {CATEGORY_LABEL[event.event_type_category] ?? event.event_type_category}
            </span>
          )}
          {event.processed ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal/10 text-teal border border-teal/20">
              <CheckCircle2 className="w-3 h-3" />
              processado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gold/10 text-gold border border-gold/20">
              <Clock className="w-3 h-3" />
              pendente
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── User ── */}
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Usuário
          </h3>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{
                  background: profile?.is_active
                    ? "linear-gradient(135deg, rgba(0,201,167,0.25), rgba(0,201,167,0.08))"
                    : "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
                  border: profile?.is_active
                    ? "1px solid rgba(0,201,167,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: profile?.is_active ? "#00C9A7" : "hsl(var(--muted-foreground))",
                }}
              >
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                {fullName ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{fullName}</span>
                      {profile?.is_verified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-teal shrink-0" />
                      )}
                    </div>
                    {profile?.email && (
                      <p className="font-data text-xs text-muted-foreground mt-0.5 truncate">
                        {profile.email}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="font-data text-sm text-muted-foreground">
                    {event.user_external_id}
                  </span>
                )}

                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {profile?.tags?.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/8"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                  {(profile?.tags?.length ?? 0) > 4 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      +{profile!.tags.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {profile && (
                <Link
                  href={`/profiles/${profile.id}`}
                  className="shrink-0 p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Ver perfil completo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {profile && (
              <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">LTV</p>
                  <p className="font-data text-sm font-semibold text-gold">
                    R$ {Number(profile.ltv).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Depósitos</p>
                  <p className="font-data text-sm font-semibold text-foreground">
                    {profile.deposit_count}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">Total</p>
                  <p className="font-data text-sm font-semibold text-foreground">
                    R$ {Number(profile.total_deposits).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {!profile && (
              <p className="mt-3 text-xs text-muted-foreground/50 italic">
                Perfil não encontrado para este external_id
              </p>
            )}
          </div>
        </section>

        {/* ── Metadata ── */}
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Metadados do evento
          </h3>

          <div className="space-y-2.5">
            <MetaRow
              icon={<Hash className="w-3.5 h-3.5" />}
              label="ID interno"
              value={String(event.id)}
              mono
            />
            <MetaRow
              icon={<Hash className="w-3.5 h-3.5" />}
              label="ID externo"
              value={event.external_event_id}
              mono
            />
            <MetaRow
              icon={<User className="w-3.5 h-3.5" />}
              label="User external ID"
              value={event.user_external_id}
              mono
            />
            <MetaRow
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Ocorreu em"
              value={format(new Date(event.occurred_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              sub={formatDistanceToNow(new Date(event.occurred_at), { locale: ptBR, addSuffix: true })}
            />
            <MetaRow
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Recebido em"
              value={format(new Date(event.received_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            />
            {event.processed && event.processed_at && (
              <MetaRow
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-teal" />}
                label="Processado em"
                value={format(new Date(event.processed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              />
            )}
            {event.processing_attempts > 0 && (
              <MetaRow
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                label="Tentativas"
                value={String(event.processing_attempts)}
                mono
              />
            )}
            {event.last_error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-medium text-red-400 uppercase tracking-wide mb-0.5">Último erro</p>
                  <p className="font-data text-xs text-red-300/80 break-all">{event.last_error}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Payload ── */}
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Payload
          </h3>
          <div className="json-viewer">
            <JsonNode value={event.payload as JsonValue} />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  sub,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground/40 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide leading-none mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm text-foreground break-all leading-snug ${
            mono ? "font-data" : ""
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Drawer wrapper ────────────────────────────────────────────────────────────

interface EventDetailDrawerProps {
  eventId: number | null;
  onClose: () => void;
}

export function EventDetailDrawer({ eventId, onClose }: EventDetailDrawerProps) {
  const { data: event, isLoading } = useEventDetail(eventId);
  const drawerRef = useRef<HTMLDivElement>(null);
  const open = eventId !== null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Trap scroll on body when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(5, 5, 20, 0.72)",
          backdropFilter: "blur(4px)",
          transition: "opacity 200ms ease",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 92vw)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)",
          background: "hsl(240 42% 7%)",
          borderLeft: "1px solid hsl(var(--border))",
          boxShadow: "-24px 0 80px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "hsl(var(--muted-foreground))",
            cursor: "pointer",
            transition: "background 150ms",
          }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
        >
          <X size={14} />
        </button>

        {/* Content */}
        {open && (
          <>
            {isLoading && <DrawerSkeleton />}
            {!isLoading && event && <DrawerContent event={event} />}
            {!isLoading && !event && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm">Evento não encontrado</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* JSON viewer styles */}
      <style>{`
        .json-viewer {
          font-family: var(--font-geist-mono), 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.7;
          padding: 16px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          overflow-x: auto;
          white-space: pre;
        }
        .json-key    { color: hsl(var(--muted-foreground)); }
        .json-string { color: #00C9A7; }
        .json-number { color: #F0A500; }
        .json-true   { color: #3b82f6; }
        .json-false  { color: #ef4444; }
        .json-null   { color: #a855f7; }
        .json-bracket { color: rgba(255,255,255,0.35); }
        .json-colon  { color: rgba(255,255,255,0.25); }
        .json-comma  { color: rgba(255,255,255,0.2); }
      `}</style>
    </>
  );
}
