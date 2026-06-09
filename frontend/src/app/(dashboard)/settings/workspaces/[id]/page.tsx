"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Building2,
  Key,
  Copy,
  RefreshCw,
  Check,
  Loader2,
  Globe,
  Palette,
  Gauge,
  Users,
  Link2,
  Trash2,
  Plus,
  Server,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkspaces,
  useWorkspaceSettings,
  useUpdateWorkspaceSettings,
  useRotateIngestKey,
  useWorkspaceMembers,
  useAddMember,
  useRemoveMember,
  useAppUsers,
  type WorkspaceSettings,
} from "@/lib/workspace-hooks";
import { useWorkspaceStore, type WorkspaceRole } from "@/stores/workspace";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WorkspaceDetailPage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const { isSuperAdmin } = useWorkspaceStore();

  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);
  const { data: settings, isLoading } = useWorkspaceSettings(workspaceId);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6">
      <div className="mb-6">
        <Link
          href="/settings/workspaces"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Workspaces
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
            {workspace?.is_primary ? (
              <Crown className="w-5 h-5 text-gold" />
            ) : (
              <Building2 className="w-5 h-5 text-gold" />
            )}
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl leading-tight">
              {workspace?.name ?? "Workspace"}
            </h1>
            <p className="text-xs text-muted-foreground/70 font-data">
              /{workspace?.slug}
            </p>
          </div>
        </div>
      </div>

      {isLoading || !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-96 rounded-lg" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="ingest">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="ingest">
              <Key className="w-3.5 h-3.5 mr-1.5" />
              Ingestão
            </TabsTrigger>
            <TabsTrigger value="domain">
              <Globe className="w-3.5 h-3.5 mr-1.5" />
              Domínio & Tracking
            </TabsTrigger>
            <TabsTrigger value="branding">
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="caps">
              <Gauge className="w-3.5 h-3.5 mr-1.5" />
              Limites
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Membros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingest">
            <IngestTab workspaceId={workspaceId} settings={settings} />
          </TabsContent>
          <TabsContent value="domain">
            <ConfigTab
              workspaceId={workspaceId}
              settings={settings}
              isPrimary={!!workspace?.is_primary}
              section="domain"
            />
          </TabsContent>
          <TabsContent value="branding">
            <ConfigTab
              workspaceId={workspaceId}
              settings={settings}
              isPrimary={!!workspace?.is_primary}
              section="branding"
            />
          </TabsContent>
          <TabsContent value="caps">
            <ConfigTab
              workspaceId={workspaceId}
              settings={settings}
              isPrimary={!!workspace?.is_primary}
              section="caps"
            />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab workspaceId={workspaceId} canAdd={isSuperAdmin} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Inheritance banner ───────────────────────────────────────────────────────

function InheritBanner({
  workspaceId,
  settings,
  isPrimary,
}: {
  workspaceId: number;
  settings: WorkspaceSettings;
  isPrimary: boolean;
}) {
  const update = useUpdateWorkspaceSettings(workspaceId);
  if (isPrimary) return null;

  async function toggle(value: boolean) {
    try {
      await update.mutateAsync({ inherit_from_primary: value });
      toast.success(value ? "Herdando do principal." : "Configuração própria ativada.");
    } catch {
      toast.error("Não foi possível atualizar.");
    }
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-gold/20 bg-gold/[0.04] mb-5">
      <Link2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gold mb-0.5">Herança do principal</p>
        <p className="text-xs text-muted-foreground">
          {settings.inherit_from_primary
            ? "Este workspace usa os providers, domínio, branding e limites do principal. Desative para configurar tudo próprio."
            : "Este workspace usa configuração própria. Ative para voltar a herdar do principal."}
        </p>
      </div>
      <button
        onClick={() => toggle(!settings.inherit_from_primary)}
        disabled={update.isPending}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          settings.inherit_from_primary ? "bg-gold" : "bg-white/10"
        }`}
        aria-label="Alternar herança"
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            settings.inherit_from_primary ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

// ── Config tab (domain / branding / caps) ────────────────────────────────────

type Section = "domain" | "branding" | "caps";

const SECTION_FIELDS: Record<
  Section,
  { key: keyof WorkspaceSettings; label: string; type?: string; placeholder?: string }[]
> = {
  domain: [
    { key: "from_email", label: "From email", type: "email", placeholder: "no-reply@suamarca.com" },
    { key: "from_name", label: "From name", placeholder: "Sua Marca" },
    { key: "reply_to", label: "Reply-to", type: "email", placeholder: "suporte@suamarca.com" },
    { key: "tracking_base_url", label: "Domínio de tracking", type: "url", placeholder: "https://trk.suamarca.com" },
  ],
  branding: [
    { key: "brand_name", label: "Nome da marca", placeholder: "Sua Marca" },
    { key: "public_site_url", label: "Site público", type: "url", placeholder: "https://suamarca.com" },
    { key: "deposit_url", label: "URL de depósito", type: "url", placeholder: "https://suamarca.com/depositar" },
    { key: "support_url", label: "URL de suporte", type: "url", placeholder: "https://suamarca.com/suporte" },
    { key: "unsubscribe_url", label: "URL de descadastro", type: "url", placeholder: "https://suamarca.com/unsubscribe" },
  ],
  caps: [
    { key: "email_daily_cap", label: "Cap diário de email", type: "number", placeholder: "2" },
    { key: "sms_daily_cap", label: "Cap diário de SMS", type: "number", placeholder: "1" },
    { key: "push_daily_cap", label: "Cap diário de push", type: "number", placeholder: "3" },
    { key: "quiet_hours_start", label: "Quiet hours — início (0-23)", type: "number", placeholder: "23" },
    { key: "quiet_hours_end", label: "Quiet hours — fim (0-23)", type: "number", placeholder: "8" },
  ],
};

function ConfigTab({
  workspaceId,
  settings,
  isPrimary,
  section,
}: {
  workspaceId: number;
  settings: WorkspaceSettings;
  isPrimary: boolean;
  section: Section;
}) {
  const update = useUpdateWorkspaceSettings(workspaceId);
  const fields = SECTION_FIELDS[section];

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const v = settings[f.key];
      init[f.key as string] = v === null || v === undefined ? "" : String(v);
    }
    setForm(init);
  }, [settings, section]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = !isPrimary && settings.inherit_from_primary;
  const effective = settings.effective ?? {};

  function effectiveStr(key: string): string {
    const v = effective[key];
    return v === null || v === undefined ? "" : String(v);
  }

  async function save() {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = form[f.key as string];
      if (f.type === "number") {
        payload[f.key as string] = raw === "" ? null : Number(raw);
      } else {
        payload[f.key as string] = raw;
      }
    }
    try {
      await update.mutateAsync(payload as Partial<WorkspaceSettings>);
      toast.success("Configuração salva.");
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <div className="max-w-2xl">
      <InheritBanner workspaceId={workspaceId} settings={settings} isPrimary={isPrimary} />

      {locked && (
        <p className="text-xs text-muted-foreground mb-4">
          Valores herdados do workspace principal (somente leitura). Desative a
          herança acima para editar.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => {
            const key = f.key as string;
            const eff = effectiveStr(key);
            // Quando herda, mostra o valor efetivo (read-only). Caso contrário,
            // mostra o override próprio, usando o efetivo como placeholder.
            const value = locked ? eff : (form[key] ?? "");
            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{f.label}</Label>
                <Input
                  id={key}
                  type={f.type ?? "text"}
                  value={value}
                  placeholder={eff || f.placeholder}
                  disabled={locked}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [key]: e.target.value }))
                  }
                />
              </div>
            );
          })}
        </div>

        {section === "domain" && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            Os providers de envio (Postal/Mailgun/SMS) deste workspace são cadastrados
            em Configurações → Providers com o workspace ativo.
          </p>
        )}

        {!locked && (
          <div className="flex justify-end mt-6">
            <button
              onClick={save}
              disabled={update.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-medium text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ingest tab ───────────────────────────────────────────────────────────────

function IngestTab({
  workspaceId,
  settings,
}: {
  workspaceId: number;
  settings: WorkspaceSettings;
}) {
  const rotate = useRotateIngestKey(workspaceId);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const key = settings.ingest_api_key;

  function copy() {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function doRotate() {
    if (!confirm("Rotacionar a API key? Integrações com a chave antiga deixarão de funcionar.")) return;
    try {
      await rotate.mutateAsync();
      toast.success("Nova API key gerada.");
      setRevealed(true);
    } catch {
      toast.error("Não foi possível rotacionar.");
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-gold/20 bg-gold/[0.04]">
        <Key className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-gold mb-0.5">API key de ingestão</p>
          <p className="text-xs text-muted-foreground">
            Esta chave roteia os eventos recebidos para este workspace. Cada workspace
            tem a sua — use-a como segredo HMAC nos webhooks da plataforma.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <Label className="mb-2 block">Chave atual</Label>
        {key ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-border text-sm font-data text-foreground truncate">
              {revealed ? key : `${key.slice(0, 16)}${"•".repeat(16)}`}
            </code>
            <button
              onClick={() => setRevealed((v) => !v)}
              className="px-3 py-2.5 rounded-lg border border-border text-xs hover:bg-white/5 transition-colors"
            >
              {revealed ? "Ocultar" : "Revelar"}
            </button>
            <button
              onClick={copy}
              className="px-3 py-2.5 rounded-lg border border-border hover:bg-white/5 transition-colors"
              aria-label="Copiar"
            >
              {copied ? (
                <Check className="w-4 h-4 text-teal" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma chave gerada ainda. Gere a primeira abaixo.
          </p>
        )}

        <div className="flex items-center justify-between mt-5 pt-5 border-t border-border">
          <div className="text-xs text-muted-foreground font-data">
            {settings.ingest_api_key_last_used_at
              ? `Último uso: ${formatDistanceToNow(new Date(settings.ingest_api_key_last_used_at), { addSuffix: true, locale: ptBR })}`
              : "Nunca usada"}
          </div>
          <button
            onClick={doRotate}
            disabled={rotate.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:border-gold/30 hover:bg-gold/[0.04] transition-colors disabled:opacity-50"
          >
            {rotate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {key ? "Rotacionar chave" : "Gerar chave"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Members tab ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: "Administrador",
  member: "Membro",
  viewer: "Leitura",
};

function MembersTab({ workspaceId, canAdd }: { workspaceId: number; canAdd: boolean }) {
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
  const { data: users } = useAppUsers(canAdd);
  const add = useAddMember(workspaceId);
  const remove = useRemoveMember(workspaceId);

  const [userId, setUserId] = useState<string>("");
  const [role, setRole] = useState<WorkspaceRole>("member");

  const memberUserIds = useMemo(
    () => new Set((members ?? []).map((m) => m.user)),
    [members]
  );
  const availableUsers = (users ?? []).filter((u) => !memberUserIds.has(u.id));

  async function handleAdd() {
    if (!userId) return;
    try {
      await add.mutateAsync({ user: Number(userId), role });
      toast.success("Membro adicionado.");
      setUserId("");
    } catch {
      toast.error("Não foi possível adicionar.");
    }
  }

  async function handleRemove(id: number) {
    try {
      await remove.mutateAsync(id);
      toast.success("Membro removido.");
    } catch {
      toast.error("Não foi possível remover.");
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {canAdd && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-gold" />
            Adicionar membro
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.username} {u.email ? `· ${u.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="viewer">Leitura</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={handleAdd}
              disabled={!userId || add.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-medium text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {add.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Adicionar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (members ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Nenhum membro neste workspace ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {(members ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-semibold text-muted-foreground uppercase">
                    {m.username.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.username}</p>
                    <p className="text-xs text-muted-foreground/70">{m.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge-muted">{ROLE_LABELS[m.role]}</span>
                  {canAdd && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                      aria-label="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
