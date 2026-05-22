"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProfiles,
  useTemplates,
  useProviders,
  useSendMessage,
  type SendMessagePayload,
} from "@/lib/hooks";
import {
  Mail,
  MessageSquare,
  Bell,
  MessageCircle,
  Radar,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const CHANNELS = [
  { value: "email",     label: "Email",     Icon: Mail },
  { value: "sms",       label: "SMS",       Icon: MessageSquare },
  { value: "push",      label: "Push",      Icon: Bell },
  { value: "whatsapp",  label: "WhatsApp",  Icon: MessageCircle },
] as const;

type Channel = (typeof CHANNELS)[number]["value"];
type FromAddressOption = {
  email: string;
  name: string;
  label: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

function configString(config: Record<string, unknown> | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getFromAddressOptions(provider: { config: Record<string, unknown> } | undefined): FromAddressOption[] {
  if (!provider?.config) return [];

  const config = provider.config;
  const options: FromAddressOption[] = [];
  const defaultEmail = configString(config, "default_from_email") || configString(config, "from_email");
  const defaultName = configString(config, "default_from_name") || configString(config, "from_name");
  const domain = configString(config, "domain") || defaultEmail.split("@")[1] || "";

  if (defaultEmail) {
    options.push({
      email: defaultEmail,
      name: defaultName,
      label: defaultName ? `${defaultName} <${defaultEmail}>` : defaultEmail,
    });
  }

  const extra = Array.isArray(config.from_addresses) ? config.from_addresses : [];
  extra.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const prefix = typeof record.prefix === "string" ? record.prefix.trim() : "";
    if (!prefix) return;
    const email = prefix.includes("@") || !domain ? prefix : `${prefix}@${domain}`;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (options.some((option) => option.email === email)) return;
    options.push({
      email,
      name,
      label: name ? `${name} <${email}>` : email,
    });
  });

  return options;
}

export function SendMessageModal({ open, onClose }: Props) {
  const [profileSearch, setProfileSearch] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [channel, setChannel] = useState<Channel>("email");
  const [templateCode, setTemplateCode] = useState("");
  const [selectedFrom, setSelectedFrom] = useState("");
  const [bypassQuietHours, setBypassQuietHours] = useState(false);
  const [bypassFrequencyCap, setBypassFrequencyCap] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: profilesData } = useProfiles({
    search: profileSearch || undefined,
    page: 1,
  });

  const { data: templatesData } = useTemplates(channel);

  const { data: providersData } = useProviders(channel);

  const sendMutation = useSendMessage();

  const activeProvider =
    providersData?.results.find((p) => p.is_active && p.is_primary) ??
    providersData?.results.find((p) => p.is_active);
  const trackingEnabled = activeProvider?.tracking_enabled ?? false;
  const fromOptions = getFromAddressOptions(activeProvider);
  const selectedFromOption = fromOptions.find((option) => option.email === selectedFrom);

  const selectedProfile = profilesData?.results.find(
    (p) => p.id === selectedProfileId
  );

  function handleClose() {
    setProfileSearch("");
    setSelectedProfileId(null);
    setChannel("email");
    setTemplateCode("");
    setSelectedFrom("");
    setBypassQuietHours(false);
    setBypassFrequencyCap(false);
    setSent(false);
    sendMutation.reset();
    onClose();
  }

  async function handleSend() {
    if (!selectedProfileId || !templateCode) return;

    const payload: SendMessagePayload = {
      profile_id: selectedProfileId,
      channel,
      template_code: templateCode,
      from_email: channel === "email" ? selectedFromOption?.email : undefined,
      from_name: channel === "email" ? selectedFromOption?.name : undefined,
      bypass_quiet_hours: bypassQuietHours,
      bypass_frequency_cap: bypassFrequencyCap,
    };

    try {
      await sendMutation.mutateAsync(payload);
      setSent(true);
    } catch {
      // error handled by sendMutation.error
    }
  }

  const canSend = !!selectedProfileId && !!templateCode && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Enviar mensagem</DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-12 h-12 text-teal" />
            <p className="font-semibold text-foreground">Mensagem enviada</p>
            <p className="text-sm text-muted-foreground text-center">
              A mensagem foi enviada com sucesso e aparecerá no log em instantes.
            </p>
            <Button onClick={handleClose} className="mt-2">Fechar</Button>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Profile */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Destinatário
              </Label>
              <Input
                placeholder="Buscar por ID ou e-mail..."
                value={profileSearch}
                onChange={(e) => {
                  setProfileSearch(e.target.value);
                  setSelectedProfileId(null);
                }}
                className="bg-background border-border"
              />
              {profileSearch && profilesData?.results && profilesData.results.length > 0 && !selectedProfileId && (
                <div className="border border-border rounded-lg overflow-hidden">
                  {profilesData.results.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        setProfileSearch(p.email || p.external_id);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-border/50 last:border-0"
                    >
                      <span className="font-data text-xs text-foreground">{p.external_id}</span>
                      {p.email && (
                        <span className="text-xs text-muted-foreground">{p.email}</span>
                      )}
                      {p.first_name && (
                        <span className="text-xs text-muted-foreground ml-auto">{p.first_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedProfile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal/5 border border-teal/20 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal shrink-0" />
                  <span className="text-xs text-foreground font-data">{selectedProfile.external_id}</span>
                  {selectedProfile.email && (
                    <span className="text-xs text-muted-foreground">{selectedProfile.email}</span>
                  )}
                </div>
              )}
            </div>

            {/* Channel */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Canal</Label>
              <div className="flex gap-2">
                {CHANNELS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setChannel(value); setTemplateCode(""); setSelectedFrom(""); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      channel === value
                        ? "bg-gold/10 border-gold/30 text-gold"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {channel === "email" && fromOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Remetente
                </Label>
                <Select
                  value={selectedFrom || "__template_default__"}
                  onValueChange={(value) => setSelectedFrom(value === "__template_default__" ? "" : value)}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Usar padrão..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__template_default__">
                      Padrão do template/provedor
                    </SelectItem>
                    {fromOptions.map((option) => (
                      <SelectItem key={`${option.name}:${option.email}`} value={option.email}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Template */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Template</Label>
              <Select value={templateCode} onValueChange={setTemplateCode}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {templatesData?.results.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      <span className="font-data text-xs">{t.code}</span>
                      {t.name && <span className="text-muted-foreground ml-2 text-xs">{t.name}</span>}
                    </SelectItem>
                  ))}
                  {templatesData?.results.filter((t) => t.is_active).length === 0 && (
                    <SelectItem value="__none" disabled>
                      Nenhum template ativo para {channel}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Tracking badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
              trackingEnabled
                ? "bg-teal/5 border-teal/20 text-teal"
                : "bg-white/[0.03] border-border text-muted-foreground"
            }`}>
              <Radar className="w-3.5 h-3.5 shrink-0" />
              {trackingEnabled
                ? "Tracking de abertura e clique ativo (webhook configurado)"
                : "Sem tracking — webhook não configurado para este canal"}
            </div>

            {/* Advanced options */}
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                Opções avançadas
              </summary>
              <div className="mt-3 space-y-2 pl-1">
                <label className="flex items-center gap-2 cursor-pointer group/opt">
                  <input
                    type="checkbox"
                    checked={bypassQuietHours}
                    onChange={(e) => setBypassQuietHours(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover/opt:text-foreground transition-colors">
                    Ignorar quiet hours
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/opt">
                  <input
                    type="checkbox"
                    checked={bypassFrequencyCap}
                    onChange={(e) => setBypassFrequencyCap(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover/opt:text-foreground transition-colors">
                    Ignorar frequency cap
                  </span>
                </label>
              </div>
            </details>

            {/* Error */}
            {sendMutation.isError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {(sendMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erro ao enviar mensagem"}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} className="border-border">
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend}
                className="bg-gold text-background hover:bg-gold/90 gap-1.5"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
