"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useProviders, useCreateProvider, useUpdateProvider, useDeleteProvider,
  useDataRequests, useCreateDataRequest,
  useSystemSettings, useRotateApiKey, useSaveWebhookConfig,
  type ProviderConfig,
} from "@/lib/hooks";
import {
  ExternalLink, Database, Zap, Radio, Shield, Key, Webhook,
  Bell, Globe, CheckCircle, Copy, RefreshCw, Plus, Pencil, Trash2,
  Mail, MessageSquare, Smartphone, Server, Lock, AlertTriangle,
  Loader2, FileDown, UserX, Eye, EyeOff, Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEV_LINKS = [
  {
    label: "Django Admin", description: "Painel de administração completo do backend",
    href: `${API_BASE}/admin/`, icon: Database, badge: "badge-gold", badgeLabel: "admin",
  },
  {
    label: "Swagger / OpenAPI", description: "Documentação interativa de todos os endpoints REST",
    href: `${API_BASE}/api/docs/`, icon: Radio, badge: "badge-teal", badgeLabel: "docs",
  },
  {
    label: "ReDoc", description: "Documentação elegante dos contratos de API",
    href: `${API_BASE}/api/redoc/`, icon: Radio, badge: "badge-muted", badgeLabel: "redoc",
  },
  {
    label: "Flower (Celery)", description: "Monitoramento de workers e tasks assíncronas",
    href: "http://localhost:5555", icon: Zap, badge: "badge-gold", badgeLabel: "celery",
  },
];

const PROVIDER_CLASSES = [
  { value: "PostalEmailProvider", label: "Postal (self-hosted)", channel: "email" },
  { value: "MailgunEmailProvider", label: "Mailgun", channel: "email" },
  { value: "SmtpEmailProvider", label: "SMTP Genérico", channel: "email" },
  { value: "WebhookSmsProvider", label: "Webhook Genérico", channel: "sms" },
  { value: "ZenviaSmsProvider", label: "Zenvia", channel: "sms" },
  { value: "TwilioSmsProvider", label: "Twilio", channel: "sms" },
  { value: "FcmPushProvider", label: "Firebase Cloud Messaging", channel: "push" },
];

type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "email" | "url";
  required?: boolean;
  placeholder?: string;
  aliases?: string[];
};

type FromAddressConfig = {
  name: string;
  prefix: string;
};

const TRACKING_PROVIDERS = new Set(["PostalEmailProvider", "MailgunEmailProvider"]);
const REVEALABLE_CONFIG_FIELDS = new Set(["api_key", "webhook_signing_key"]);

const PROVIDER_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  PostalEmailProvider: [
    { key: "api_url", label: "API URL do Postal", type: "url", required: true, placeholder: "https://postal.example.com" },
    { key: "api_key", label: "API Key", type: "password", required: true },
    { key: "server", label: "Server Name", type: "text", required: true, placeholder: "betcrm" },
    { key: "default_from_email", label: "From Email", type: "email", required: true, placeholder: "noreply@example.com", aliases: ["from_email"] },
    { key: "default_from_name", label: "From Name", type: "text", placeholder: "BetCRM", aliases: ["from_name"] },
    { key: "webhook_secret", label: "Webhook Secret (tracking)", type: "password", placeholder: "Segredo HMAC configurado no Postal" },
  ],
  MailgunEmailProvider: [
    { key: "api_key", label: "API Key", type: "password", required: true },
    { key: "domain", label: "Domain", type: "text", required: true, placeholder: "mg.example.com" },
    { key: "default_from_email", label: "From Email", type: "email", required: true, aliases: ["from_email"] },
    { key: "default_from_name", label: "From Name", type: "text", placeholder: "BetCRM", aliases: ["from_name"] },
    { key: "region", label: "Region (us ou eu)", type: "text", placeholder: "us" },
    { key: "webhook_signing_key", label: "Webhook Signing Key (tracking)", type: "password", placeholder: "Signing key do painel Mailgun", aliases: ["webhook_secret"] },
  ],
  SmtpEmailProvider: [
    { key: "host", label: "SMTP Host", type: "text", required: true, placeholder: "smtp.example.com" },
    { key: "port", label: "Port", type: "number", required: true, placeholder: "587" },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "from_email", label: "From Email", type: "email", required: true },
  ],
  WebhookSmsProvider: [
    { key: "url", label: "Webhook URL", type: "url", required: true, placeholder: "https://api.example.com/sms" },
    { key: "auth_value", label: "Bearer Token / API Key", type: "password", aliases: ["api_key"] },
    { key: "sender_id", label: "Sender ID", type: "text", placeholder: "+5511...", aliases: ["from_number"] },
  ],
  ZenviaSmsProvider: [
    { key: "api_token", label: "API Token", type: "password", required: true },
    { key: "sender_id", label: "Sender ID", type: "text", required: true },
  ],
  TwilioSmsProvider: [
    { key: "account_sid", label: "Account SID", type: "text", required: true },
    { key: "auth_token", label: "Auth Token", type: "password", required: true },
    { key: "from_number", label: "From Number", type: "text", required: true, placeholder: "+15551234567" },
  ],
  FcmPushProvider: [
    { key: "server_key", label: "FCM Server Key", type: "password", required: true },
    { key: "sender_id", label: "Sender ID", type: "text", required: true },
  ],
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  whatsapp: Smartphone,
};

const CHANNEL_BADGES: Record<string, string> = {
  email: "badge-gold",
  sms: "badge-teal",
  push: "badge-muted",
  whatsapp: "badge-teal",
};

// ── Helper: Copy button ───────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Provider Config Modal ─────────────────────────────────────────────────────

interface ProviderModalProps {
  open: boolean;
  onClose: () => void;
  provider?: ProviderConfig | null;
}

const providerFormSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  channel: z.enum(["email", "sms", "push", "whatsapp"]),
  provider_class: z.string().min(1, "Selecione o provider"),
  is_active: z.boolean().default(true),
  is_primary: z.boolean().default(false),
  priority: z.number().min(1).max(999).default(100),
  daily_quota: z.preprocess(
    (value) => (typeof value === "number" && Number.isNaN(value) ? null : value),
    z.number().min(0).nullable().optional()
  ),
  monthly_quota: z.preprocess(
    (value) => (typeof value === "number" && Number.isNaN(value) ? null : value),
    z.number().min(0).nullable().optional()
  ),
});
type ProviderForm = z.infer<typeof providerFormSchema>;

function getProviderFormDefaults(provider?: ProviderConfig | null): ProviderForm {
  return provider
    ? {
        name: provider.name,
        channel: provider.channel,
        provider_class: provider.provider_class,
        is_active: provider.is_active,
        is_primary: provider.is_primary,
        priority: provider.priority,
        daily_quota: provider.daily_quota ?? undefined,
        monthly_quota: provider.monthly_quota ?? undefined,
      }
    : {
        name: "",
        channel: "email",
        provider_class: "",
        is_active: true,
        is_primary: false,
        priority: 100,
      };
}

function isFilledConfigValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function getProviderConfigFields(provider?: ProviderConfig | null): Record<string, unknown> {
  if (!provider?.config) return {};

  const config = { ...provider.config };
  const schema = PROVIDER_CONFIG_SCHEMAS[provider.provider_class] ?? [];

  schema.forEach((field) => {
    const aliasKey = field.aliases?.find((key) => isFilledConfigValue(provider.config[key]));
    if (!isFilledConfigValue(config[field.key]) && aliasKey) {
      config[field.key] = provider.config[aliasKey];
    }

    field.aliases?.forEach((key) => {
      delete config[key];
    });
  });

  return config;
}

function configValueToInputValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value);
}

function normalizeFromAddresses(value: unknown): FromAddressConfig[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        name: typeof record.name === "string" ? record.name : "",
        prefix: typeof record.prefix === "string"
          ? record.prefix
          : typeof record.email === "string"
            ? record.email.split("@")[0] ?? ""
            : "",
      };
    })
    .filter((item): item is FromAddressConfig => !!item);
}

function getFromAddressDomain(config: Record<string, unknown>) {
  const domain = configValueToInputValue(config.domain).trim();
  if (domain) return domain;

  const defaultEmail = configValueToInputValue(
    config.default_from_email ?? config.from_email
  ).trim();
  const atIndex = defaultEmail.lastIndexOf("@");
  return atIndex >= 0 ? defaultEmail.slice(atIndex + 1) : "";
}

function ProviderModal({ open, onClose, provider }: ProviderModalProps) {
  const createMutation = useCreateProvider();
  const updateMutation = useUpdateProvider();
  const isEditing = !!provider;

  const [configFields, setConfigFields] = useState<Record<string, unknown>>(() => getProviderConfigFields(provider));
  const [visibleConfigFields, setVisibleConfigFields] = useState<Set<string>>(new Set());

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<ProviderForm>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: getProviderFormDefaults(provider),
  });

  const watchProviderClass = watch("provider_class");
  const watchChannel = watch("channel");
  const isActiveVal = watch("is_active");
  const isPrimaryVal = watch("is_primary");

  useEffect(() => {
    if (!open) return;
    reset(getProviderFormDefaults(provider));
    setConfigFields(getProviderConfigFields(provider));
    setVisibleConfigFields(new Set());
  }, [provider, open, reset]);

  const configSchema = PROVIDER_CONFIG_SCHEMAS[watchProviderClass] ?? [];
  const availableClasses = PROVIDER_CLASSES.filter((p) => p.channel === watchChannel);

  function setConfigField(key: string, value: string) {
    setConfigFields((prev) => ({ ...prev, [key]: value }));
  }

  function setFromAddresses(value: FromAddressConfig[]) {
    setConfigFields((prev) => ({ ...prev, from_addresses: value }));
  }

  function toggleConfigFieldVisibility(key: string) {
    setVisibleConfigFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function onSubmit(values: ProviderForm) {
    const normalizedConfig = { ...configFields };
    if (values.channel === "email") {
      normalizedConfig.from_addresses = normalizeFromAddresses(configFields.from_addresses)
        .map((item) => ({
          name: item.name.trim(),
          prefix: item.prefix.trim(),
        }))
        .filter((item) => item.prefix);
    } else {
      delete normalizedConfig.from_addresses;
    }
    const payload = {
      ...values,
      config: normalizedConfig,
      priority: Number.isNaN(values.priority) ? 100 : values.priority,
      daily_quota: (values.daily_quota === undefined || Number.isNaN(values.daily_quota as number)) ? null : values.daily_quota,
      monthly_quota: (values.monthly_quota === undefined || Number.isNaN(values.monthly_quota as number)) ? null : values.monthly_quota,
    };
    try {
      if (isEditing && provider) {
        await updateMutation.mutateAsync({ id: provider.id, ...payload });
        toast.success("Provedor atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Provedor criado");
      }
      handleClose();
    } catch {
      toast.error("Erro ao salvar provedor");
    }
  }

  function handleClose() {
    reset();
    setConfigFields({});
    setVisibleConfigFields(new Set());
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            {isEditing ? "Editar Provedor" : "Novo Provedor"}
          </DialogTitle>
          <DialogDescription>
            Configure um canal de envio de mensagens. Credenciais são armazenadas criptografadas.
          </DialogDescription>
        </DialogHeader>

        <form id="provider-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input {...register("name")} placeholder="Ex: Postal Produção, Mailgun BR" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Channel + Provider class */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={watchChannel} onValueChange={(v) => { setValue("channel", v as ProviderForm["channel"]); setValue("provider_class", ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Select value={watchProviderClass} onValueChange={(v) => setValue("provider_class", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {availableClasses.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.provider_class && <p className="text-xs text-destructive">{errors.provider_class.message}</p>}
            </div>
          </div>

          {/* Dynamic config fields */}
          {configSchema.length > 0 && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Configuração do Provedor
                </p>
              </div>
              {configSchema.map((field) => {
                const canReveal = field.type === "password" && REVEALABLE_CONFIG_FIELDS.has(field.key);
                const isVisible = visibleConfigFields.has(field.key);

                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`cfg-${field.key}`}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`cfg-${field.key}`}
                        type={field.type === "password" && !isVisible ? "password" : "text"}
                        value={configValueToInputValue(configFields[field.key])}
                        onChange={(e) => setConfigField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`${field.type === "password" ? "font-data" : ""} ${canReveal ? "pr-10" : ""}`}
                      />
                      {canReveal && (
                        <button
                          type="button"
                          onClick={() => toggleConfigFieldVisibility(field.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                          aria-label={isVisible ? "Ocultar valor" : "Mostrar valor"}
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {watchChannel === "email" && watchProviderClass && (
            <FromAddressesEditor
              value={normalizeFromAddresses(configFields.from_addresses)}
              domain={getFromAddressDomain(configFields)}
              onChange={setFromAddresses}
            />
          )}

          {/* Webhook tracking URL (for tracking-capable providers when editing) */}
          {isEditing && provider && TRACKING_PROVIDERS.has(watchProviderClass) && (
            <div className="space-y-2 p-4 rounded-lg border border-teal/20 bg-teal/[0.03]">
              <div className="flex items-center gap-2">
                <Webhook className="w-3.5 h-3.5 text-teal" />
                <p className="text-xs font-medium text-teal uppercase tracking-wider">
                  URL de Webhook de Tracking
                </p>
                {provider.tracking_enabled && <span className="badge-teal ml-auto">ativo</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no painel do provedor para receber eventos de entrega, abertura e clique.
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-border rounded-md">
                <code className="font-data text-xs text-teal flex-1 break-all">
                  {API_BASE}/api/v1/messaging/webhooks/{provider.id}
                </code>
                <CopyButton value={`${API_BASE}/api/v1/messaging/webhooks/${provider.id}`} />
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                Configure o <strong>Webhook Secret</strong> acima com o mesmo segredo usado no provedor para habilitar verificação HMAC.
              </p>
            </div>
          )}

          {/* Priority + quotas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Input type="number" min={1} max={999} {...register("priority", { valueAsNumber: true })} />
              <p className="text-[10px] text-muted-foreground/60">Menor = mais prioritário</p>
            </div>
            <div className="space-y-1.5">
              <Label>Cota diária</Label>
              <Input type="number" min={0} placeholder="ilimitado" {...register("daily_quota", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cota mensal</Label>
              <Input type="number" min={0} placeholder="ilimitado" {...register("monthly_quota", { valueAsNumber: true })} />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            {[
              { key: "is_active" as const, val: isActiveVal, label: "Ativo", desc: "Provedor habilitado para envio" },
              { key: "is_primary" as const, val: isPrimaryVal, label: "Principal", desc: "Preferencial neste canal" },
            ].map(({ key, val, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2.5 px-4 rounded-lg border border-border bg-white/[0.02]">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue(key, !val)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${val ? "bg-teal/20 border-teal/40" : "bg-white/5 border-border"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${val ? "translate-x-5 bg-teal" : "bg-muted-foreground/40"}`} />
                </button>
              </div>
            ))}
          </div>
        </form>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="provider-form"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar" : "Criar provider"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FromAddressesEditor({
  value,
  domain,
  onChange,
}: {
  value: FromAddressConfig[];
  domain: string;
  onChange: (value: FromAddressConfig[]) => void;
}) {
  function update(index: number, key: keyof FromAddressConfig, nextValue: string) {
    onChange(value.map((item, i) => (i === index ? { ...item, [key]: nextValue } : item)));
  }

  function addAddress() {
    onChange([...value, { name: "", prefix: "" }]);
  }

  function removeAddress(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3 p-4 rounded-lg border border-border bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Remetentes disponíveis
          </p>
        </div>
        <button
          type="button"
          onClick={addAddress}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem remetentes extras. O envio usa o From padrão configurado acima.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => {
            const preview = item.prefix
              ? item.prefix.includes("@") || !domain
                ? item.prefix
                : `${item.prefix}@${domain}`
              : domain
                ? `prefixo@${domain}`
                : "prefixo@dominio";

            return (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Nome</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => update(index, "name", e.target.value)}
                    placeholder="Betnice Promo"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Prefixo</Label>
                  <Input
                    value={item.prefix}
                    onChange={(e) => update(index, "prefix", e.target.value)}
                    placeholder="promo"
                    className="font-data"
                  />
                  <p className="text-[10px] text-muted-foreground/60 font-data">{preview}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAddress(index)}
                  className="mt-6 w-9 h-9 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors flex items-center justify-center"
                  aria-label="Remover remetente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LGPD Request Modal ────────────────────────────────────────────────────────

const lgpdSchema = z.object({
  external_id: z.string().min(1, "ID do usuário obrigatório"),
  request_type: z.enum(["export", "delete", "anonymize"]),
  notes: z.string().optional(),
});
type LgpdForm = z.infer<typeof lgpdSchema>;

interface LgpdModalProps {
  open: boolean;
  onClose: () => void;
}

function LgpdRequestModal({ open, onClose }: LgpdModalProps) {
  const createMutation = useCreateDataRequest();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<LgpdForm>({
    resolver: zodResolver(lgpdSchema),
    defaultValues: { external_id: "", request_type: "export", notes: "" },
  });

  const requestType = watch("request_type");

  const REQUEST_INFO = {
    export: {
      icon: FileDown,
      color: "text-teal",
      bg: "bg-teal/5 border-teal/15",
      title: "Exportar dados do titular",
      desc: "Gera arquivo JSON com todos os dados do usuário (Art. 18 LGPD). O usuário receberá um link para download.",
      confirmLabel: "Exportar dados",
    },
    delete: {
      icon: UserX,
      color: "text-destructive",
      bg: "bg-destructive/5 border-destructive/15",
      title: "Solicitar exclusão",
      desc: "Remove todos os dados pessoais identificáveis do perfil (Art. 18, XII LGPD). Irreversível.",
      confirmLabel: "Solicitar exclusão",
    },
    anonymize: {
      icon: EyeOff,
      color: "text-muted-foreground",
      bg: "bg-white/5 border-border",
      title: "Anonimizar perfil",
      desc: "Mantém histórico agregado mas remove identificadores pessoais (nome, email, CPF, telefone).",
      confirmLabel: "Anonimizar",
    },
  };

  const info = REQUEST_INFO[requestType];
  const InfoIcon = info.icon;

  async function onSubmit(values: LgpdForm) {
    try {
      await createMutation.mutateAsync({ ...values, source: "admin_panel" });
      toast.success("Solicitação LGPD criada e enfileirada para processamento");
      reset();
      onClose();
    } catch {
      toast.error("Erro ao criar solicitação LGPD");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal" />
            Nova Solicitação LGPD
          </DialogTitle>
          <DialogDescription>
            Crie uma solicitação de exportação ou exclusão de dados conforme Art. 18 da LGPD.
          </DialogDescription>
        </DialogHeader>

        <form id="lgpd-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ID do usuário (external_id)</Label>
            <Input
              {...register("external_id")}
              placeholder="Ex: user_abc123"
              className="font-data"
            />
            {errors.external_id && <p className="text-xs text-destructive">{errors.external_id.message}</p>}
          </div>

          {/* Request type selector */}
          <div className="space-y-2">
            <Label>Tipo de solicitação</Label>
            {(["export", "anonymize", "delete"] as const).map((type) => {
              const ri = REQUEST_INFO[type];
              const RiIcon = ri.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue("request_type", type)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    requestType === type ? `${ri.bg} border-opacity-100` : "bg-white/[0.02] border-border hover:border-white/15"
                  }`}
                >
                  <RiIcon className={`w-4 h-4 mt-0.5 shrink-0 ${requestType === type ? ri.color : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${requestType === type ? ri.color : "text-muted-foreground"}`}>
                      {ri.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ri.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label>
              Observações <span className="normal-case text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              {...register("notes")}
              rows={2}
              placeholder="Motivo, ticket de suporte, etc."
            />
          </div>

          {requestType === "delete" && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                <strong>Ação irreversível.</strong> Todos os dados pessoais serão permanentemente removidos.
              </p>
            </div>
          )}
        </form>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="lgpd-form"
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors ${
              requestType === "delete"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-teal text-primary-foreground hover:bg-teal/90"
            }`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : info.confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

const WEBHOOK_EVENT_DEFS = [
  { code: "user.register", description: "Usuário registrado na plataforma" },
  { code: "payment.deposit.completed", description: "Depósito completado com sucesso" },
  { code: "payment.deposit.failed", description: "Depósito falhou ou foi rejeitado" },
  { code: "payment.withdrawal.completed", description: "Saque processado" },
  { code: "bonus.activated", description: "Bônus ativado pelo usuário" },
  { code: "cashback.paid", description: "Cashback creditado" },
];

export default function SettingsPage() {
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderConfig | null>(null);
  const [lgpdModalOpen, setLgpdModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEventsLocal, setWebhookEventsLocal] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const { data: providersData, isLoading: loadingProviders } = useProviders();
  const deleteProvider = useDeleteProvider();
  const { data: dataRequests } = useDataRequests();
  const { data: settings, isLoading: loadingSettings } = useSystemSettings();
  const rotateKeyMutation = useRotateApiKey();
  const saveWebhookMutation = useSaveWebhookConfig();

  // Sync webhook config from API once loaded
  useEffect(() => {
    if (settings && !settingsLoaded) {
      setWebhookUrl(settings.webhook_url ?? "");
      setWebhookEventsLocal(settings.webhook_events ?? []);
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);

  const apiKey = settings?.ingest_api_key ?? null;

  async function handleDeleteProvider(p: ProviderConfig) {
    if (!confirm(`Remover provedor "${p.name}"?`)) return;
    try {
      await deleteProvider.mutateAsync(p.id);
      toast.success("Provedor removido");
    } catch {
      toast.error("Erro ao remover provedor");
    }
  }

  async function handleSaveWebhook() {
    try {
      await saveWebhookMutation.mutateAsync({
        webhook_url: webhookUrl,
        webhook_events: webhookEventsLocal,
      });
      toast.success("Configuração de webhook salva");
    } catch {
      toast.error("Erro ao salvar webhook");
    }
  }

  function toggleWebhookEvent(code: string) {
    setWebhookEventsLocal((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleRotateKey() {
    if (!confirm("Gerar uma nova API key? A chave atual será invalidada imediatamente.")) return;
    try {
      await rotateKeyMutation.mutateAsync();
      toast.success("Nova API key gerada — copie agora, não será exibida novamente");
    } catch {
      toast.error("Erro ao rotacionar chave");
    }
  }

  const STATUS_CONFIG = {
    pending: { badge: "badge-gold", icon: Clock, label: "Pendente" },
    processing: { badge: "badge-teal", icon: Loader2, label: "Processando" },
    completed: { badge: "badge-teal", icon: CheckCircle, label: "Concluído" },
    failed: { badge: "badge-red", icon: AlertTriangle, label: "Falhou" },
  } as const;

  const TYPE_LABELS = {
    export: { icon: FileDown, label: "Exportação", color: "text-teal" },
    delete: { icon: UserX, label: "Exclusão", color: "text-destructive" },
    anonymize: { icon: EyeOff, label: "Anonimização", color: "text-muted-foreground" },
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto">
    <div className="p-8 space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ferramentas administrativas, provedores de mensagem e compliance
          </p>
        </div>

        <Tabs defaultValue="system">
          <TabsList>
            <TabsTrigger value="system">Sistema</TabsTrigger>
            <TabsTrigger value="providers">Provedores</TabsTrigger>
            <TabsTrigger value="api">Chaves de API</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* ── SISTEMA ── */}
          <TabsContent value="system" className="space-y-6">
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Ferramentas administrativas
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEV_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-vault p-4 flex items-center gap-3 group hover:border-gold/25 transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-gold group-hover:bg-gold/10 transition-all">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-foreground">{link.label}</span>
                          <span className={link.badge}>{link.badgeLabel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── PROVIDERS ── */}
          <TabsContent value="providers" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                  Provedores de mensagem
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configure provedores de Email, SMS e Push. O sistema usa o de maior prioridade disponível.
                </p>
              </div>
              <button
                onClick={() => { setEditProvider(null); setProviderModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Novo Provedor
              </button>
            </div>

            {loadingProviders && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card-vault p-4 flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingProviders && providersData?.results.length === 0 && (
              <div className="card-vault p-10 text-center">
                <Server className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">Nenhum provedor configurado</p>
                <p className="text-xs text-muted-foreground/60 mb-4">
                  Configure pelo menos um provedor de email para começar a enviar mensagens.
                </p>
                <button
                  onClick={() => { setEditProvider(null); setProviderModalOpen(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Configurar provedor
                </button>
              </div>
            )}

            <div className="space-y-2">
              {providersData?.results.map((p) => {
                const ChanIcon = CHANNEL_ICONS[p.channel] ?? Mail;
                const chanBadge = CHANNEL_BADGES[p.channel] ?? "badge-muted";
                return (
                  <div key={p.id} className="card-vault p-4 group hover:border-gold/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        p.is_active ? "bg-white/5 text-muted-foreground" : "bg-white/[0.02] text-muted-foreground/30"
                      }`}>
                        <ChanIcon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{p.name}</span>
                          <span className={chanBadge}>{p.channel_display}</span>
                          {p.is_primary && <span className="badge-gold">principal</span>}
                          {p.is_active ? (
                            <span className="badge-teal">ativo</span>
                          ) : (
                            <span className="badge-muted">inativo</span>
                          )}
                          {p.tracking_enabled && <span className="badge-teal">tracking</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.provider_class_display} · prioridade {p.priority}
                          {p.daily_quota && ` · ${p.daily_quota.toLocaleString("pt-BR")}/dia`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { setEditProvider(p); setProviderModalOpen(true); }}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProvider(p)}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ── API KEYS ── */}
          <TabsContent value="api" className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border border-gold/15 bg-gold/[0.04] p-4">
              <Key className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gold mb-1">API Keys de Ingestão</p>
                <p className="text-xs text-muted-foreground">
                  Use estas chaves para autenticar requisições à API de ingestão de eventos. Nunca exponha em código client-side.
                </p>
              </div>
            </div>

            <div className="card-vault p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Chave de produção</p>
                  <p className="text-xs text-muted-foreground">Utilizada para autenticar webhooks e ingestão de eventos</p>
                </div>
                {apiKey ? <span className="badge-teal">ativa</span> : <span className="badge-muted">não gerada</span>}
              </div>

              {loadingSettings ? (
                <Skeleton className="h-9 w-full rounded-md" />
              ) : apiKey ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-border rounded-md">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <code className="font-data text-xs text-foreground flex-1 select-all blur-sm hover:blur-none transition-all duration-300">
                      {apiKey}
                    </code>
                    <CopyButton value={apiKey} />
                  </div>
                  <p className="text-xs text-muted-foreground/60">Passe o cursor sobre a chave para revelar.</p>
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {settings?.ingest_api_key_created_at
                        ? `Criada ${formatDistanceToNow(new Date(settings.ingest_api_key_created_at), { locale: ptBR, addSuffix: true })}`
                        : "Data de criação desconhecida"}
                      {settings?.ingest_api_key_last_used_at
                        ? ` · usado ${formatDistanceToNow(new Date(settings.ingest_api_key_last_used_at), { locale: ptBR, addSuffix: true })}`
                        : ""}
                    </p>
                    <button
                      onClick={handleRotateKey}
                      disabled={rotateKeyMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-destructive border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${rotateKeyMutation.isPending ? "animate-spin" : ""}`} />
                      Rotacionar chave
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">Nenhuma API key gerada ainda</p>
                  <button
                    onClick={handleRotateKey}
                    disabled={rotateKeyMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
                  >
                    <Key className="w-4 h-4" />
                    {rotateKeyMutation.isPending ? "Gerando..." : "Gerar API key"}
                  </button>
                </div>
              )}
            </div>

            <div className="card-vault p-5">
              <p className="text-sm font-medium text-foreground mb-1">Exemplo de uso</p>
              <p className="text-xs text-muted-foreground mb-3">Envio de evento via API REST:</p>
              <pre className="font-data text-xs text-teal bg-black/40 rounded-lg p-4 overflow-x-auto">
{`POST ${API_BASE}/api/v1/events/ingest/
X-Signature: sha256=<hmac_sha256_do_body>
Content-Type: application/json

{
  "event_type": "payment.deposit.completed",
  "external_event_id": "evt_unique_123",
  "user_external_id": "user_456",
  "occurred_at": "2026-05-19T14:30:00Z",
  "payload": { "amount": 500.00, "currency": "BRL" }
}`}
              </pre>
            </div>
          </TabsContent>

          {/* ── WEBHOOKS ── */}
          <TabsContent value="webhooks" className="space-y-6">
            <div className="card-vault p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Webhook className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Endpoint de destino</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure um endpoint para receber eventos em tempo real via HTTP POST.
              </p>
              <div className="flex gap-2">
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://seu-sistema.com/webhook/betcrm"
                  className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/40 transition-colors"
                />
                <button
                  onClick={handleSaveWebhook}
                  disabled={saveWebhookMutation.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors shrink-0"
                >
                  {saveWebhookMutation.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Eventos disparados
                </h2>
                <p className="text-xs text-muted-foreground/60">
                  {webhookEventsLocal.length} habilitado{webhookEventsLocal.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="card-vault divide-y divide-border">
                {WEBHOOK_EVENT_DEFS.map((ev) => {
                  const enabled = webhookEventsLocal.includes(ev.code);
                  return (
                    <div key={ev.code} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="font-data text-xs text-foreground mb-0.5">{ev.code}</p>
                        <p className="text-xs text-muted-foreground">{ev.description}</p>
                      </div>
                      <button
                        onClick={() => toggleWebhookEvent(ev.code)}
                        className={`relative w-10 h-5 rounded-full border transition-all shrink-0 ml-4 ${enabled ? "bg-teal/20 border-teal/40" : "bg-white/5 border-border"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${enabled ? "translate-x-5 bg-teal" : "bg-muted-foreground/40"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSaveWebhook}
                  disabled={saveWebhookMutation.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-white/5 text-foreground border border-border hover:border-gold/30 hover:text-gold disabled:opacity-50 transition-colors"
                >
                  {saveWebhookMutation.isPending ? "Salvando..." : "Salvar seleção de eventos"}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* ── COMPLIANCE ── */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 rounded-lg border border-teal/15 bg-teal/[0.04] p-4">
                <Shield className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-teal mb-1">LGPD — Módulo ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Todos os envios verificam consentimento antes de disparar. Titulares podem exportar ou excluir seus dados a qualquer momento.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLgpdModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-teal/90 text-primary-foreground hover:bg-teal transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Nova solicitação
              </button>
            </div>

            {/* Data requests list */}
            {dataRequests && dataRequests.results.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                  Solicitações recentes
                </h2>
                <div className="card-vault overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuário</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Criada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataRequests.results.map((req) => {
                          const typeInfo = TYPE_LABELS[req.request_type];
                          const TypeIcon = typeInfo.icon;
                          const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                          const StatusIcon = statusCfg.icon;
                          return (
                            <tr key={req.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-data text-xs text-muted-foreground">{req.profile_external_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`flex items-center gap-1.5 text-xs font-medium ${typeInfo.color}`}>
                                  <TypeIcon className="w-3.5 h-3.5" />
                                  {typeInfo.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={statusCfg.badge}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusCfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(req.created_at), { locale: ptBR, addSuffix: true })}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Consent verification rules */}
            <div className="card-vault p-5">
              <p className="text-sm font-medium text-foreground mb-3">Regras de consentimento por canal</p>
              <div className="space-y-2 text-xs">
                {[
                  { channel: "Email", rule: "Requer consent_email = true" },
                  { channel: "SMS", rule: "Requer consent_sms = true" },
                  { channel: "Push", rule: "Requer consent_push = true e push_token preenchido" },
                  { channel: "WhatsApp", rule: "Requer consent_whatsapp = true e opt-in Meta" },
                ].map((item) => (
                  <div key={item.channel} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <span className="text-foreground">{item.channel}</span>
                    <span className="text-muted-foreground">{item.rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>

      <ProviderModal
        open={providerModalOpen}
        onClose={() => { setProviderModalOpen(false); setEditProvider(null); }}
        provider={editProvider}
      />
      <LgpdRequestModal open={lgpdModalOpen} onClose={() => setLgpdModalOpen(false)} />
    </>
  );
}
