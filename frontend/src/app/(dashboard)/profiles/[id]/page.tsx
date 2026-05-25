"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProfile, useProfileTimeline, type TimelineActivity } from "@/lib/hooks";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  DollarSign,
  Gamepad2,
  Tag,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Crown,
  CreditCard,
  Zap,
  MessageSquare,
  MailOpen,
  MousePointerClick,
  Bell,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

function fmt(val: string | null | undefined) {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return format(new Date(val), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtAgo(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return formatDistanceToNow(new Date(val), { locale: ptBR, addSuffix: true });
  } catch {
    return "—";
  }
}

function ConsentBadge({ label, granted }: { label: string; granted: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
      granted
        ? "bg-teal/5 border-teal/20 text-teal"
        : "bg-white/[0.03] border-border text-muted-foreground/50"
    }`}>
      {granted
        ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 shrink-0" />
      }
      {label}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-data text-foreground">{value}</span>
    </div>
  );
}

export default function ProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const profileId = parseInt(params.id, 10);
  const { data: profile, isLoading, isError } = useProfile(profileId);

  const ltv = profile?.ltv ? parseFloat(profile.ltv) : 0;
  const vipTier =
    ltv >= 50000 ? { label: "Diamante", color: "text-teal", bg: "bg-teal/10 border-teal/20" } :
    ltv >= 10000 ? { label: "Ouro", color: "text-gold", bg: "bg-gold/10 border-gold/20" } :
    ltv >= 2000  ? { label: "Prata", color: "text-foreground", bg: "bg-white/5 border-border" } :
    { label: "Bronze", color: "text-muted-foreground", bg: "bg-white/[0.03] border-border" };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto"><div className="p-8 space-y-6">
          {/* Back link */}
          <Skeleton className="h-4 w-20" />

          {/* Hero card */}
          <div className="card-vault p-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-10 rounded" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
                <Skeleton className="h-3.5 w-32" />
                <div className="flex items-center gap-4 pt-1">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              </div>
              <div className="space-y-1 text-right shrink-0">
                <Skeleton className="h-3 w-16 ml-auto" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-vault p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Timeline placeholder */}
          <div className="card-vault p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-7 w-48 rounded-lg" />
            </div>
            <div className="space-y-4 pl-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" />
                  <div className="flex-1 space-y-1.5 pb-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-28 rounded" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex-1 overflow-y-auto"><div className="p-8"><div className="card-vault p-12 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <div>
            <p className="font-display font-semibold text-foreground mb-1">Profile não encontrado</p>
            <p className="text-sm text-muted-foreground">O ID {profileId} não existe ou foi removido.</p>
          </div>
          <button
            onClick={() => router.push("/profiles")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-white/5 hover:bg-white/10 text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Profiles
          </button>
        </div>
    </div></div>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Sem nome";
  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");

  return (
    <div className="flex-1 overflow-y-auto"><div className="p-8 space-y-6">
      {/* Back */}
        <Link
          href="/profiles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Profiles
        </Link>

        {/* Hero card */}
        <div className="card-vault p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gold/20 to-teal/10 border border-gold/20 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-gold" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display font-bold text-xl text-foreground">{fullName}</h1>
                {profile.ftd_at && <span className="badge-teal">FTD</span>}
                {profile.is_deleted && <span className="badge-red">deletado</span>}
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${vipTier.bg} ${vipTier.color}`}>
                  <Crown className="w-3 h-3" />
                  {vipTier.label}
                </span>
              </div>
              <p className="font-data text-xs text-muted-foreground mb-3">{profile.external_id}</p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                {profile.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {profile.phone}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {location}
                  </span>
                )}
                {profile.registered_at && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    Desde {fmtDate(profile.registered_at)}
                  </span>
                )}
              </div>

              {/* Tags */}
              {profile.tags && profile.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground/50" />
                  {profile.tags.map((tag) => (
                    <span key={tag} className="badge-muted">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* LTV Highlight */}
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">LTV Total</p>
              <p className="font-data text-3xl font-semibold text-foreground">{fmt(profile.ltv)}</p>
              <p className="text-xs text-muted-foreground mt-1">NGR: {fmt(profile.ngr)}</p>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Financial */}
          <div className="card-vault p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-gold" />
              </div>
              <h3 className="font-display font-semibold text-sm">Financeiro</h3>
            </div>
            <div>
              <StatRow label="Total depositado" value={<span className="text-teal">{fmt(profile.total_deposits)}</span>} />
              <StatRow label="Total sacado" value={fmt(profile.total_withdrawals)} />
              <StatRow label="Qtd. depósitos" value={profile.deposit_count ?? "—"} />
              <StatRow label="Qtd. saques" value={profile.withdrawal_count ?? "—"} />
              <StatRow label="Primeiro depósito" value={fmtDate(profile.ftd_at)} />
              <StatRow label="Último depósito" value={fmtDate(profile.last_deposit_at)} />
            </div>
          </div>

          {/* Activity */}
          <div className="card-vault p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-teal" />
              </div>
              <h3 className="font-display font-semibold text-sm">Atividade</h3>
            </div>
            <div>
              <StatRow label="Último login" value={fmtAgo(profile.last_login_at)} />
              <StatRow label="Último evento" value={fmtAgo(profile.last_event_at)} />
              <StatRow label="Registrado" value={fmtDate(profile.registered_at)} />
              <StatRow
                label="Jogo favorito"
                value={
                  profile.favorite_game ? (
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {profile.favorite_game}
                    </span>
                  ) : "—"
                }
              />
              <StatRow label="Criado em" value={fmtDate(profile.created_at)} />
              <StatRow label="Atualizado" value={fmtAgo(profile.updated_at)} />
            </div>
          </div>

          {/* Consent & Channels */}
          <div className="card-vault p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-sm">Consentimentos</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ConsentBadge label="Email" granted={profile.consent_email} />
              <ConsentBadge label="SMS" granted={profile.consent_sms} />
              <ConsentBadge label="Push" granted={profile.consent_push} />
              <ConsentBadge label="WhatsApp" granted={profile.consent_whatsapp} />
            </div>

            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Canais habilitados</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  { label: "Email", ok: profile.consent_email },
                  { label: "SMS", ok: profile.consent_sms },
                  { label: "Push", ok: profile.consent_push },
                  { label: "WhatsApp", ok: profile.consent_whatsapp },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span>{label}</span>
                    {ok
                      ? <span className="text-teal flex items-center gap-1"><CheckCircle className="w-3 h-3" /> permitido</span>
                      : <span className="text-muted-foreground/40 flex items-center gap-1"><XCircle className="w-3 h-3" /> bloqueado</span>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      {/* Real Timeline */}
      <TimelineSection profileId={profileId} />
    </div>
    </div>
  );
}

// ── Timeline Component ────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { badge: string; dot: string }> = {
  "payment.deposit.completed": { badge: "badge-teal", dot: "bg-teal" },
  "payment.deposit.started":   { badge: "badge-gold", dot: "bg-gold/60" },
  "payment.deposit.failed":    { badge: "badge-red",  dot: "bg-destructive" },
  "user.register":             { badge: "badge-gold", dot: "bg-gold" },
  "user.login":                { badge: "badge-muted", dot: "bg-muted-foreground/30" },
  "payment.withdrawal.request":   { badge: "badge-muted", dot: "bg-muted-foreground/30" },
  "payment.withdrawal.completed": { badge: "badge-teal",  dot: "bg-teal/60" },
  "payment.withdrawal.rejected":  { badge: "badge-red",   dot: "bg-destructive/60" },
  "game.started":    { badge: "badge-muted", dot: "bg-muted-foreground/20" },
  "bonus.activated": { badge: "badge-teal",  dot: "bg-teal/40" },
  "bonus.expired":   { badge: "badge-red",   dot: "bg-destructive/60" },
  "cashback.paid":   { badge: "badge-teal",  dot: "bg-teal" },
};

const EVENT_LABELS: Record<string, string> = {
  "user.register":                 "Cadastro",
  "payment.deposit.completed":     "Depósito confirmado",
  "payment.deposit.started":       "Depósito iniciado",
  "payment.deposit.failed":        "Depósito falhou",
  "payment.withdrawal.request":    "Saque solicitado",
  "payment.withdrawal.completed":  "Saque concluído",
  "payment.withdrawal.rejected":   "Saque rejeitado",
  "bonus.activated":   "Bônus ativado",
  "bonus.completed":   "Bônus concluído",
  "bonus.expired":     "Bônus expirado",
  "cashback.paid":     "Cashback pago",
};

const MSG_STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  queued:      { icon: Clock,             color: "text-muted-foreground", label: "Enfileirada" },
  sent:        { icon: MessageSquare,     color: "text-muted-foreground", label: "Enviada" },
  delivered:   { icon: CheckCircle,       color: "text-teal",             label: "Entregue" },
  opened:      { icon: MailOpen,          color: "text-gold",             label: "Aberta" },
  clicked:     { icon: MousePointerClick, color: "text-gold",             label: "Clicada" },
  bounced:     { icon: XCircle,           color: "text-destructive",      label: "Bounce" },
  failed:      { icon: XCircle,           color: "text-destructive",      label: "Falhou" },
  rejected:    { icon: XCircle,           color: "text-muted-foreground", label: "Rejeitada" },
};

const CHANNEL_ICONS_MSG: Record<string, React.ElementType> = {
  email: Mail, sms: MessageSquare, push: Bell, whatsapp: MessageCircle,
};

const FLOW_STATE_CONFIG: Record<string, { label: string; color: string }> = {
  completed:    { label: "Concluído", color: "text-teal" },
  goal_reached: { label: "Objetivo atingido", color: "text-teal" },
  exited:       { label: "Saiu", color: "text-muted-foreground" },
  failed:       { label: "Falhou", color: "text-destructive" },
};

function ActivityItem({ item }: { item: TimelineActivity }) {
  const d = item.data;

  if (item.kind === "tag_change") {
    return (
      <div className="relative pb-4">
        <div className="absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-background bg-muted-foreground/40" />
        <div className="pl-3">
          <div className="flex items-start gap-2 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />
            <span className="text-xs text-muted-foreground/70 font-medium mt-0.5">Mudança de tags</span>
            <span className="text-xs text-muted-foreground/60 mt-0.5 ml-auto">
              {formatDistanceToNow(new Date(item.occurred_at), { locale: ptBR, addSuffix: true })}
            </span>
          </div>
          <div className="pl-5 mt-1 flex flex-wrap gap-1">
            {(d.added ?? []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal/10 border border-teal/20 text-teal">
                +{t}
              </span>
            ))}
            {(d.removed ?? []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 border border-destructive/20 text-destructive">
                −{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === "flow_entry") {
    return (
      <div className="relative pb-4">
        <div className="absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-background bg-gold/60" />
        <div className="pl-3 flex items-start gap-2 flex-wrap">
          <Zap className="w-3 h-3 text-gold/70 mt-0.5 shrink-0" />
          <span className="badge-gold">Entrou em jornada</span>
          <span className="text-xs font-data text-muted-foreground">{d.flow_name ?? d.flow_code}</span>
          <span className="text-xs text-muted-foreground/60 mt-0.5 ml-auto">
            {formatDistanceToNow(new Date(item.occurred_at), { locale: ptBR, addSuffix: true })}
          </span>
        </div>
      </div>
    );
  }

  if (item.kind === "flow_exit") {
    const stateCfg = FLOW_STATE_CONFIG[d.state ?? ""] ?? { label: d.state ?? "Saiu", color: "text-muted-foreground" };
    return (
      <div className="relative pb-4">
        <div className="absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-background bg-muted-foreground/30" />
        <div className="pl-3 flex items-start gap-2 flex-wrap">
          <Zap className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0" />
          <span className="badge-muted">Saiu da jornada</span>
          <span className="text-xs font-data text-muted-foreground">{d.flow_name ?? d.flow_code}</span>
          <span className={`text-[10px] font-medium ${stateCfg.color}`}>{stateCfg.label}</span>
          {d.duration_hours != null && (
            <span className="text-[10px] text-muted-foreground/50">{d.duration_hours}h</span>
          )}
          <span className="text-xs text-muted-foreground/60 mt-0.5 ml-auto">
            {formatDistanceToNow(new Date(item.occurred_at), { locale: ptBR, addSuffix: true })}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function payloadString(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function eventAmount(type: string, payload: Record<string, unknown>) {
  if (![
    "payment.deposit.completed",
    "payment.withdrawal.request",
    "payment.withdrawal.completed",
    "cashback.paid",
  ].includes(type)) return "";

  const raw = payloadString(payload, "amount");
  if (!raw) return "";
  const value = Math.abs(Number(raw));
  if (!Number.isFinite(value)) return "";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function eventMeta(type: string, payload: Record<string, unknown>) {
  if (type === "payment.deposit.failed") return payloadString(payload, "failureReason", "reason");
  if (type === "bonus.activated") return payloadString(payload, "bonusCode", "bonus_code");
  return "";
}

type ActiveTab = "all" | "events" | "messages" | "flows" | "tags";

function TimelineSection({ profileId }: { profileId: number }) {
  const { data, isLoading, isError } = useProfileTimeline(profileId);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [expandedPayloads, setExpandedPayloads] = useState<Set<number>>(new Set());

  function togglePayload(id: number) {
    setExpandedPayloads((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  type TimelineItem =
    | { kind: "event"; id: number; type: string; occurred_at: string; payload: Record<string, unknown> }
    | { kind: "message"; id: number; channel: string; template: string | null; status: string; sent_at: string | null; created_at?: string | null }
    | { kind: "activity"; item: TimelineActivity; occurred_at: string };

  const allItems: TimelineItem[] = [
    ...(data?.events ?? []).map((e) => ({
      kind: "event" as const,
      id: e.id, type: e.type, occurred_at: e.occurred_at, payload: e.payload,
    })),
    ...(data?.messages ?? []).map((m) => ({
      kind: "message" as const,
      id: m.id, channel: m.channel, template: m.template,
      status: m.status, sent_at: m.sent_at, created_at: m.created_at,
    })),
    ...(data?.activities ?? []).map((a) => ({
      kind: "activity" as const,
      item: a,
      occurred_at: a.occurred_at,
    })),
  ].sort((a, b) => {
    const getDate = (i: typeof a) =>
      i.kind === "message" ? (i.sent_at ?? i.created_at ?? "") : i.occurred_at;
    return new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime();
  });

  const flowActivities = (data?.activities ?? []).filter(
    (a) => a.kind === "flow_entry" || a.kind === "flow_exit"
  );
  const tagActivities = (data?.activities ?? []).filter((a) => a.kind === "tag_change");

  const filtered: TimelineItem[] =
    activeTab === "events"
      ? allItems.filter((i) => i.kind === "event")
      : activeTab === "messages"
        ? allItems.filter((i) => i.kind === "message")
        : activeTab === "flows"
          ? flowActivities.map((a) => ({ kind: "activity" as const, item: a, occurred_at: a.occurred_at }))
          : activeTab === "tags"
            ? tagActivities.map((a) => ({ kind: "activity" as const, item: a, occurred_at: a.occurred_at }))
            : allItems;

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "all",      label: "Tudo" },
    { key: "events",   label: `Eventos${data ? ` (${data.events.length})` : ""}` },
    { key: "messages", label: `Mensagens${data ? ` (${data.messages.length})` : ""}` },
    { key: "flows",    label: `Jornadas${data ? ` (${flowActivities.length})` : ""}` },
    { key: "tags",     label: `Tags${data ? ` (${tagActivities.length})` : ""}` },
  ];

  return (
    <div className="card-vault p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">Histórico de Atividade</h3>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-border rounded-lg p-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4 pl-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" />
              <div className="flex-1 space-y-1.5 pb-3 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="py-8 text-center">
          <AlertTriangle className="w-7 h-7 text-destructive/60 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Não foi possível carregar o histórico</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="py-8 text-center">
          <Clock className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum histórico encontrado</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border/60" />

          <div className="space-y-0">
            {filtered.map((item) => {
              if (item.kind === "activity") {
                return (
                  <ActivityItem key={`act-${item.item.id}`} item={item.item} />
                );
              }

              if (item.kind === "event") {
                const colors = EVENT_COLORS[item.type] ?? { badge: "badge-muted", dot: "bg-muted-foreground/30" };
                const label = EVENT_LABELS[item.type] ?? item.type;
                const amount = eventAmount(item.type, item.payload);
                const meta = eventMeta(item.type, item.payload);
                const isExpanded = expandedPayloads.has(item.id);
                const hasPayload = Object.keys(item.payload ?? {}).length > 0;
                return (
                  <div key={`evt-${item.id}`} className="relative pb-4">
                    <div className={`absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-background ${colors.dot}`} />
                    <div className="pl-3">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Zap className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />
                        <span className={colors.badge}>{label}</span>
                        {amount && (
                          <span className="text-xs font-data text-muted-foreground">{amount}</span>
                        )}
                        {meta && (
                          <span className="text-xs text-muted-foreground/60">{meta}</span>
                        )}
                        <span className="text-xs text-muted-foreground/60 mt-0.5">
                          {formatDistanceToNow(new Date(item.occurred_at), { locale: ptBR, addSuffix: true })}
                        </span>
                        {hasPayload && (
                          <button
                            onClick={() => togglePayload(item.id)}
                            className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      {isExpanded && hasPayload && (
                        <pre className="mt-2 px-3 py-2 bg-white/[0.03] border border-border/60 rounded text-[10px] font-data text-muted-foreground overflow-x-auto max-h-32">
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              }

              // message
              const statusCfg = MSG_STATUS_CONFIG[item.status] ?? MSG_STATUS_CONFIG.sent;
              const StatusIcon = statusCfg.icon;
              const ChanIcon = CHANNEL_ICONS_MSG[item.channel] ?? MessageSquare;
              return (
                <div key={`msg-${item.id}`} className="relative pb-4">
                  <div className="absolute -left-4 top-2 w-2.5 h-2.5 rounded-full border-2 border-background bg-white/20" />
                  <div className="pl-3 flex items-start gap-2 flex-wrap">
                    <ChanIcon className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <span className="badge-muted">
                      <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                      {statusCfg.label}
                    </span>
                    {item.template && (
                      <span className="text-xs font-data text-muted-foreground">{item.template}</span>
                    )}
                    <span className="text-xs text-muted-foreground/60">
                      {item.sent_at || item.created_at
                        ? formatDistanceToNow(new Date(item.sent_at ?? item.created_at ?? ""), { locale: ptBR, addSuffix: true })
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
