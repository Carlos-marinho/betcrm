"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useTemplatePreview,
  useProfiles,
  useSendMessage,
  useAbTests,
  useCreateAbTest,
  useDeleteAbTest,
  type MessageTemplate,
  type AbTest,
  type EmailAsset,
  type ProfileListItem,
} from "@/lib/hooks";
import { AssetLibraryModal } from "@/components/features/templates/asset-library-modal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Mail, MessageSquare, Bell, MessageCircle, Plus, Pencil, Trash2, Eye,
  FlaskConical, Loader2, CheckCircle, AlertCircle, User, ImageIcon, X, Images, RefreshCw,
  ChevronDown, Send, Search, Maximize2, Monitor, Smartphone, ZoomIn, ZoomOut,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CHANNELS = [
  { value: "", label: "Todos" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
  { value: "whatsapp", label: "WhatsApp" },
];

const channelIcon = {
  email: Mail, sms: MessageSquare, push: Bell, whatsapp: MessageCircle,
} as const;

const channelBadge = {
  email: "badge-gold", sms: "badge-teal", push: "badge-muted", whatsapp: "badge-teal",
} as const;

const templateSchema = z.object({
  name: z.string().min(2, "Nome precisa de pelo menos 2 caracteres"),
  code: z.string().min(2, "Código muito curto").regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  channel: z.enum(["email", "sms", "push", "whatsapp"]),
  category: z.string().optional(),
  subject: z.string().optional(),
  text_body: z.string().min(1, "Corpo é obrigatório"),
  html_body: z.string().optional(),
  banner_asset: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
});
type TemplateForm = z.infer<typeof templateSchema>;

function toCode(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
}

const JINJA_VARS = [
  "{{ profile.first_name }}",
  "{{ profile.email }}",
  "{{ profile.ltv }}",
  "{{ profile.favorite_game }}",
  "{{ event.amount }}",
  "{{ event.type }}",
];

// ── API Preview Modal ─────────────────────────────────────────────────────────

interface ApiPreviewModalProps {
  open: boolean;
  onClose: () => void;
  template: MessageTemplate | null;
}

function ApiPreviewModal({ open, onClose, template }: ApiPreviewModalProps) {
  const previewMutation = useTemplatePreview();
  const sendMutation = useSendMessage();
  const [fullscreenHtml, setFullscreenHtml] = useState<string | null>(null);
  const [fsViewMode, setFsViewMode] = useState<"desktop" | "mobile">("desktop");
  const [fsZoom, setFsZoom] = useState(0.65);
  const [fsEmailHeight, setFsEmailHeight] = useState(2000);
  const fsIframeRef = useRef<HTMLIFrameElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: profilesData, isLoading: profilesLoading } = useProfiles({ search: debouncedSearch });
  const [selectedProfile, setSelectedProfile] = useState<ProfileListItem | null>(null);
  const [profilePickerOpen, setProfilePickerOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");

  const profiles = profilesData?.results ?? [];
  const autoRenderedRef = useRef(false);

  // Debounce de 350ms para a busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset da flag ao fechar a modal
  useEffect(() => {
    if (!open) autoRenderedRef.current = false;
  }, [open]);

  // Auto-render com o primeiro profile quando a modal abre — dispara apenas uma
  // vez por abertura, mesmo que profilesLoading ou profiles mudem depois.
  useEffect(() => {
    if (!open || !template || profilesLoading || autoRenderedRef.current) return;
    autoRenderedRef.current = true;
    const first = profiles[0] ?? null;
    setSelectedProfile(first);
    previewMutation.mutate({
      id: template.id,
      profile_external_id: first?.external_id,
    });
    setPreviewTab("html");
    setProfilePickerOpen(false);
    setSearchQuery("");
  // profiles intencionalmente omitido: o auto-render usa o snapshot do momento
  // em que loading termina; seleções subsequentes são via handleSelectProfile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, profilesLoading, profiles]);

  function handleSelectProfile(profile: ProfileListItem) {
    if (!template) return;
    setSelectedProfile(profile);
    setProfilePickerOpen(false);
    setSearchQuery("");
    previewMutation.mutate({
      id: template.id,
      profile_external_id: profile.external_id,
    });
  }

  async function handleSendTest() {
    if (!template || !selectedProfile) return;
    try {
      await sendMutation.mutateAsync({
        profile_id: selectedProfile.id,
        channel: template.channel,
        template_code: template.code,
        bypass_quiet_hours: true,
        bypass_frequency_cap: true,
      });
      toast.success(`Mensagem de teste enviada para ${selectedProfile.email || selectedProfile.external_id}`);
    } catch {
      toast.error("Erro ao enviar mensagem de teste");
    }
  }

  const result = previewMutation.data;
  // Reset fullscreen state when opening (always start in desktop mode)
  useEffect(() => {
    if (fullscreenHtml) {
      setFsViewMode("desktop");
      setFsZoom(0.65);
      setFsEmailHeight(2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenHtml]);

  // Adjust default zoom when switching modes (height stays — iframe width never changes)
  useEffect(() => {
    setFsZoom(fsViewMode === "mobile" ? 1.0 : 0.65);
  }, [fsViewMode]);

  function handleFsIframeLoad() {
    try {
      const h = fsIframeRef.current?.contentDocument?.body?.scrollHeight;
      if (h && h > 100) setFsEmailHeight(h + 40);
    } catch {}
  }

  // Iframe always renders at 700px (actual email layout width).
  // Mobile mode applies an extra scale factor so the full 700px email
  // fits visually inside a 390px "phone frame" — content isn't clipped.
  const IFRAME_W = 700;
  const PHONE_W = 390;
  const iframeScale = fsViewMode === "mobile" ? (PHONE_W / IFRAME_W) * fsZoom : fsZoom;
  const displayedWidth = fsViewMode === "mobile"
    ? Math.round(PHONE_W * fsZoom)
    : Math.round(IFRAME_W * fsZoom);

  const Icon = template ? (channelIcon[template.channel] ?? FileText) : FileText;
  const badge = template ? (channelBadge[template.channel] ?? "badge-muted") : "badge-muted";

  return (
    <>
    {fullscreenHtml && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-900">
        {/* Toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 bg-zinc-950/80 border-b border-white/10 shrink-0">
          {/* Desktop / Mobile toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => setFsViewMode("desktop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                fsViewMode === "desktop"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button
              onClick={() => setFsViewMode("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                fsViewMode === "mobile"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => setFsZoom((z) => Math.max(0.2, parseFloat((z - 0.1).toFixed(1))))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Diminuir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center text-xs font-data text-white/60 select-none tabular-nums">
              {Math.round(fsZoom * 100)}%
            </span>
            <button
              onClick={() => setFsZoom((z) => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fit button */}
          <button
            onClick={() => setFsZoom(fsViewMode === "mobile" ? 1.0 : 0.65)}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 border border-white/10 hover:bg-white/5 transition-colors"
            title="Redefinir zoom para ajustar"
          >
            Ajustar
          </button>

          <span className="text-xs font-data text-white/20 ml-0.5">
            {fsViewMode === "mobile" ? `${PHONE_W}px` : `${IFRAME_W}px`}
          </span>

          <div className="flex-1" />

          <button
            onClick={() => setFullscreenHtml(null)}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview area — click outside email closes */}
        <div
          className="flex-1 overflow-auto bg-zinc-800 py-10"
          onClick={() => setFullscreenHtml(null)}
        >
          {/* Scaled email shell */}
          <div
            className="mx-auto shadow-2xl rounded-xl overflow-hidden"
            style={{
              width: displayedWidth,
              height: Math.round(fsEmailHeight * iframeScale),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              ref={fsIframeRef}
              srcDoc={fullscreenHtml}
              onLoad={handleFsIframeLoad}
              style={{
                width: IFRAME_W,
                height: fsEmailHeight,
                border: "none",
                display: "block",
                transform: `scale(${iframeScale})`,
                transformOrigin: "top left",
              }}
              title="Email preview fullscreen"
            />
          </div>
        </div>
      </div>,
      document.body
    )}
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Preview — {template?.name}</DialogTitle>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Preview — {template?.name}</h2>
              <span className={badge}>{template?.channel}</span>
            </div>
            <p className="text-xs font-data text-muted-foreground">{template?.code}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile selector bar */}
        <div className="px-6 py-3 border-b border-border/40 shrink-0 bg-white/[0.01]">
          <div className="flex items-center gap-2">
            {/* Selected profile display / trigger */}
            <div className="flex-1 relative">
              <button
                onClick={() => setProfilePickerOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-white/[0.03] border border-border hover:border-gold/30 text-sm transition-colors text-left"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {profilesLoading ? (
                  <span className="text-muted-foreground/50 text-xs flex-1">Carregando perfis...</span>
                ) : selectedProfile ? (
                  <span className="flex-1 truncate">
                    <span className="font-medium text-foreground">{selectedProfile.first_name || "Sem nome"}</span>
                    <span className="text-muted-foreground font-data ml-2 text-xs">{selectedProfile.external_id}</span>
                    {selectedProfile.email && (
                      <span className="text-muted-foreground/50 ml-2 text-xs">· {selectedProfile.email}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50 text-xs flex-1">Nenhum perfil selecionado</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform ${profilePickerOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown picker */}
              {profilePickerOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
                  {/* Search inside picker */}
                  <div className="p-2 border-b border-border/60">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nome, email ou ID..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/5 border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/40 focus:bg-white/[0.07] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {profilesLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                      </div>
                    ) : profiles.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum perfil encontrado
                      </div>
                    ) : (
                      profiles.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProfile(p)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors ${
                            selectedProfile?.id === p.id ? "bg-gold/[0.06] border-l-2 border-gold pl-[10px]" : ""
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                            {(p.first_name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium truncate">{p.first_name || "Sem nome"}</p>
                            <p className="text-xs font-data text-muted-foreground/70 truncate">{p.external_id}</p>
                          </div>
                          {p.email && (
                            <span className="text-xs text-muted-foreground/40 truncate shrink-0 max-w-[130px]">{p.email}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  {profilesData && profilesData.count > profiles.length && (
                    <div className="px-3 py-2 border-t border-border/40 text-xs text-muted-foreground/50 text-center">
                      Mostrando {profiles.length} de {profilesData.count} · refine a busca para ver mais
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Regerar */}
            <button
              onClick={() => selectedProfile && handleSelectProfile(selectedProfile)}
              disabled={previewMutation.isPending || !selectedProfile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-border disabled:opacity-40 transition-colors shrink-0"
              title="Regerar com o mesmo perfil"
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Regerar
            </button>

            {/* Enviar teste */}
            <button
              onClick={handleSendTest}
              disabled={sendMutation.isPending || !selectedProfile || !template}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-teal/90 text-primary-foreground hover:bg-teal disabled:opacity-40 transition-colors shrink-0"
              title="Enviar mensagem de teste para este perfil"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Enviar teste
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 min-h-0"
          onClick={() => profilePickerOpen && setProfilePickerOpen(false)}
        >
          {!result && previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Loader2 className="w-10 h-10 text-muted-foreground/30 animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Renderizando template...</p>
            </div>
          )}

          {!result && !previewMutation.isPending && !previewMutation.isError && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Aguardando renderização...</p>
            </div>
          )}

          {previewMutation.isError && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro ao renderizar template</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verifique a sintaxe Jinja2 do template</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-5 h-full flex flex-col">
              {/* Meta: De + Assunto */}
              {(result.from || result.subject) && (
                <div className="space-y-3">
                  {result.from && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-1">De</p>
                      <div className="px-3 py-2 bg-white/[0.03] border border-border/60 rounded-md text-sm font-data text-muted-foreground">
                        {result.from}
                      </div>
                    </div>
                  )}
                  {result.subject && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mb-1">Assunto</p>
                      <div className="px-3 py-2.5 bg-white/[0.03] border border-border/60 rounded-md text-sm text-foreground font-medium">
                        {result.subject}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Corpo */}
              {(result.html || result.text || result.body) && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Corpo</p>
                    {result.html && result.text && (
                      <div className="flex items-center gap-1 bg-card border border-border rounded-md p-0.5">
                        {[
                          { key: "html" as const, label: "HTML" },
                          { key: "text" as const, label: "Texto" },
                        ].map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setPreviewTab(t.key)}
                            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all ${
                              previewTab === t.key
                                ? "bg-gold/10 text-gold border border-gold/20"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {result.html && (previewTab === "html" || !result.text) ? (
                    <div className="flex-1 relative" style={{ minHeight: "320px" }}>
                      <div
                        className="absolute inset-0 bg-white rounded-xl overflow-auto shadow-inner"
                        dangerouslySetInnerHTML={{ __html: result.html }}
                      />
                      <button
                        onClick={() => setFullscreenHtml(result.html!)}
                        className="absolute bottom-2 right-2 z-10 p-1.5 rounded-md bg-black/25 hover:bg-black/50 text-white/80 hover:text-white transition-all shadow-sm"
                        title="Ver em tela cheia"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <pre className="flex-1 px-4 py-4 bg-white/[0.03] border border-border/60 rounded-xl text-xs font-data text-foreground whitespace-pre-wrap leading-relaxed overflow-auto" style={{ minHeight: "200px" }}>
                      {result.text ?? result.body}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-teal shrink-0">
                <CheckCircle className="w-3.5 h-3.5" />
                Template renderizado com sucesso
                {selectedProfile && (
                  <span className="text-muted-foreground/50">
                    · perfil{" "}
                    <span className="font-data text-muted-foreground">{selectedProfile.first_name || selectedProfile.external_id}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── A/B Test Modal ────────────────────────────────────────────────────────────

interface AbTestModalProps {
  open: boolean;
  onClose: () => void;
  currentTemplate: MessageTemplate | null;
}

function AbTestModal({ open, onClose, currentTemplate }: AbTestModalProps) {
  const { data: abTests, isLoading } = useAbTests();
  const createMutation = useCreateAbTest();
  const deleteMutation = useDeleteAbTest();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [goalMetric, setGoalMetric] = useState<"opened" | "clicked" | "converted">("clicked");

  async function handleCreate() {
    if (!newName.trim() || !currentTemplate) return;
    try {
      await createMutation.mutateAsync({
        name: newName,
        goal_metric: goalMetric,
        is_active: false,
      });
      setNewName("");
      setCreating(false);
      toast.success("Teste A/B criado");
    } catch {
      toast.error("Erro ao criar teste A/B");
    }
  }

  async function handleDelete(test: AbTest) {
    if (!confirm(`Deletar teste A/B "${test.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(test.id);
      toast.success("Teste removido");
    } catch {
      toast.error("Erro ao remover teste");
    }
  }

  const GOAL_LABELS = {
    opened: "Taxa de abertura",
    clicked: "Taxa de clique",
    converted: "Conversão (depósito)",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-teal" />
            Testes A/B
          </DialogTitle>
          <DialogDescription>
            Gerencie testes A/B para comparar variantes do template{" "}
            {currentTemplate && <span className="font-data font-medium text-foreground">{currentTemplate.code}</span>}.
          </DialogDescription>
        </DialogHeader>

        {/* Create new */}
        <div className="space-y-3">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-gold/30 hover:bg-gold/[0.03] transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Teste A/B
            </button>
          ) : (
            <div className="p-4 rounded-lg border border-gold/20 bg-gold/[0.03] space-y-3">
              <p className="text-sm font-medium text-foreground">Novo teste A/B</p>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Assunto mais urgente vs. amigável"
                autoFocus
              />
              <div className="space-y-1.5">
                <Label>Métrica objetivo</Label>
                <Select value={goalMetric} onValueChange={(v) => setGoalMetric(v as typeof goalMetric)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opened">Taxa de abertura</SelectItem>
                    <SelectItem value="clicked">Taxa de clique</SelectItem>
                    <SelectItem value="converted">Conversão (depósito após envio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || createMutation.isPending}
                  className="px-4 py-1.5 rounded-md text-sm font-medium bg-teal/90 text-primary-foreground hover:bg-teal disabled:opacity-50 transition-colors"
                >
                  Criar
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List of A/B tests */}
        <div className="space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 shimmer-bg rounded-lg" />)}
            </div>
          )}

          {!isLoading && abTests?.results.length === 0 && (
            <div className="py-8 text-center">
              <FlaskConical className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum teste A/B criado</p>
            </div>
          )}

          {abTests?.results.map((test) => (
            <div key={test.id} className="card-vault p-4 group">
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  test.is_active ? "bg-teal/10 text-teal" : "bg-white/5 text-muted-foreground"
                }`}>
                  <FlaskConical className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-foreground">{test.name}</span>
                    {test.is_active ? (
                      <span className="badge-teal">ativo</span>
                    ) : (
                      <span className="badge-muted">rascunho</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Objetivo: {GOAL_LABELS[test.goal_metric]} ·{" "}
                    {test.variants.length} variante{test.variants.length !== 1 ? "s" : ""}
                  </p>
                  {test.winner && (
                    <span className="badge-gold mt-1">
                      <CheckCircle className="w-3 h-3" />
                      Vencedor definido
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(test)}
                  className="p-1.5 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Variants */}
              {test.variants.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
                  {test.variants.map((variant) => {
                    const convRate =
                      variant.impressions > 0
                        ? Math.round((variant.conversions / variant.impressions) * 100)
                        : 0;
                    return (
                      <div key={variant.id} className="px-3 py-2 rounded-md bg-white/[0.02] border border-border/60">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {variant.label || `Variante ${variant.id}`}
                          </span>
                          <span className="text-xs font-data text-muted-foreground">{variant.weight}%</span>
                        </div>
                        <p className="text-xs font-data text-muted-foreground">{variant.template_code}</p>
                        {variant.impressions > 0 && (
                          <div className="mt-1.5">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{variant.impressions} envios</span>
                              <span className="text-teal">{convRate}%</span>
                            </div>
                            <div className="h-1 bg-border/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal rounded-full transition-all"
                                style={{ width: `${convRate}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 border border-border transition-colors"
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create / Edit Template Modal ──────────────────────────────────────────────

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  template?: MessageTemplate | null;
}

function TemplateModal({ open, onClose, template }: TemplateModalProps) {
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const isEditing = !!template;
  const [previewTab, setPreviewTab] = useState("form");
  const [assetLibOpen, setAssetLibOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<EmailAsset | null>(null);

  const {
    register, handleSubmit, control, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: template
      ? {
          name: template.name, code: template.code, channel: template.channel,
          category: template.category, subject: template.subject,
          text_body: template.text_body, html_body: template.html_body,
          banner_asset: template.banner_asset,
          is_active: template.is_active,
        }
      : { name: "", code: "", channel: "email", category: "", subject: "", text_body: "", html_body: "", banner_asset: null, is_active: true },
  });

  const watchChannel = watch("channel");
  const watchBodyText = watch("text_body");
  const watchSubject = watch("subject");
  const isActiveVal = watch("is_active");

  useEffect(() => {
    if (!open) return;
    reset(
      template
        ? {
            name: template.name, code: template.code, channel: template.channel,
            category: template.category, subject: template.subject,
            text_body: template.text_body, html_body: template.html_body,
            banner_asset: template.banner_asset,
            is_active: template.is_active,
          }
        : { name: "", code: "", channel: "email", category: "", subject: "", text_body: "", html_body: "", banner_asset: null, is_active: true }
    );
    // Pré-popula o preview do banner se template já tem um
    if (template?.banner_asset_url) {
      setSelectedBanner({
        id: template.banner_asset!,
        file_url: template.banner_asset_url,
        name: "Banner atual",
      } as EmailAsset);
    } else {
      setSelectedBanner(null);
    }
    setPreviewTab("form");
  }, [template, open, reset]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    if (!isEditing) setValue("code", toCode(e.target.value));
  }

  function insertVar(v: string) {
    setValue("text_body", (watch("text_body") || "") + v);
  }

  async function onSubmit(values: TemplateForm) {
    try {
      if (isEditing && template) {
        await updateMutation.mutateAsync({ id: template.id, ...values });
        toast.success("Template atualizado");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Template criado");
      }
      reset();
      onClose();
    } catch {
      toast.error("Erro ao salvar template");
    }
  }

  function handleBannerSelect(asset: EmailAsset) {
    setSelectedBanner(asset);
    setValue("banner_asset", asset.id);
    setAssetLibOpen(false);
  }

  function handleBannerClear() {
    setSelectedBanner(null);
    setValue("banner_asset", null);
  }

  function handleClose() {
    reset();
    setPreviewTab("form");
    setSelectedBanner(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Template" : "Novo Template"}</DialogTitle>
          <DialogDescription>
            Templates suportam variáveis Jinja2 (ex:{" "}
            <code className="font-data text-teal">{`{{ profile.first_name }}`}</code>).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={previewTab} onValueChange={setPreviewTab}>
          <TabsList>
            <TabsTrigger value="form">Editar</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          {/* ── Edit tab ── */}
          <TabsContent value="form">
            <form id="tpl-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-name">Nome</Label>
                  <Input
                    id="tpl-name"
                    placeholder="Ex: Boas-vindas Email"
                    {...register("name")}
                    onChange={handleNameChange}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-code">Código</Label>
                  <Input id="tpl-code" placeholder="welcome_email" className="font-data text-sm" {...register("code")} />
                  {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Canal</Label>
                  <Controller
                    control={control}
                    name="channel"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="push">Push</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-cat">
                    Categoria <span className="normal-case text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <Input id="tpl-cat" placeholder="transacional, marketing..." {...register("category")} />
                </div>
              </div>

              {watchChannel === "email" && (
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-subject">Assunto</Label>
                  <Input
                    id="tpl-subject"
                    placeholder={`Olá {{ profile.first_name }}, seu depósito foi confirmado!`}
                    {...register("subject")}
                  />
                </div>
              )}

              {watchChannel === "email" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>
                      Banner principal{" "}
                      <span className="normal-case text-muted-foreground/60">(opcional)</span>
                    </Label>
                    {selectedBanner && (
                      <button
                        type="button"
                        onClick={handleBannerClear}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Remover
                      </button>
                    )}
                  </div>

                  {selectedBanner ? (
                    <div
                      onClick={() => setAssetLibOpen(true)}
                      className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-gold/30 transition-colors bg-checkered"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedBanner.file_url || selectedBanner.file}
                        alt={selectedBanner.alt_text || selectedBanner.name}
                        className="w-full max-h-28 object-contain"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-white bg-black/60 px-3 py-1.5 rounded-lg">
                          Trocar banner
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAssetLibOpen(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border hover:border-gold/30 hover:bg-gold/[0.02] text-muted-foreground hover:text-foreground transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Selecionar banner</p>
                        <p className="text-xs text-muted-foreground/60">
                          Será exposto via <code className="font-data">{"{{ banner_url }}"}</code> no HTML
                        </p>
                      </div>
                      <Images className="w-4 h-4 ml-auto opacity-40" />
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tpl-body">Corpo da mensagem</Label>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {JINJA_VARS.slice(0, 3).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVar(v)}
                        className="px-1.5 py-0.5 rounded text-xs font-data bg-white/5 hover:bg-teal/10 hover:text-teal text-muted-foreground border border-border transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id="tpl-body"
                  rows={5}
                  placeholder={`Olá {{ profile.first_name }},\n\nSeu depósito de R$ {{ event.amount }} foi confirmado!`}
                  {...register("text_body")}
                />
                {errors.text_body && <p className="text-xs text-destructive">{errors.text_body.message}</p>}
              </div>

              {watchChannel === "email" && (
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-html">
                    HTML <span className="normal-case text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <Textarea
                    id="tpl-html"
                    rows={4}
                    className="font-data text-xs"
                    placeholder="<html>...</html>"
                    {...register("html_body")}
                  />
                </div>
              )}

              <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border bg-white/[0.02]">
                <div>
                  <p className="text-sm font-medium text-foreground">Ativo</p>
                  <p className="text-xs text-muted-foreground">Template disponível para uso em fluxos</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue("is_active", !isActiveVal)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${
                    isActiveVal ? "bg-teal/20 border-teal/40" : "bg-white/5 border-border"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                    isActiveVal ? "translate-x-5 bg-teal" : "bg-muted-foreground/40"
                  }`} />
                </button>
              </div>
            </form>
          </TabsContent>

          {/* ── Preview tab ── */}
          <TabsContent value="preview" className="pt-2">
            <div className="space-y-4">
              {watchSubject && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Assunto</p>
                  <div className="px-3 py-2 bg-white/[0.03] border border-border rounded-md text-sm text-foreground">
                    {watchSubject}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Corpo (rascunho)</p>
                <pre className="px-4 py-3 bg-white/[0.03] border border-border rounded-md text-xs font-data text-foreground whitespace-pre-wrap leading-relaxed min-h-[100px]">
                  {watchBodyText || (
                    <span className="text-muted-foreground/40">Escreva o corpo na aba Editar...</span>
                  )}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Variáveis como{" "}
                <code className="font-data text-teal">{`{{ profile.first_name }}`}</code>{" "}
                serão substituídas em tempo de envio.
              </p>
            </div>
          </TabsContent>
        </Tabs>

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
            form="tpl-form"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar template"}
          </button>
        </DialogFooter>
      </DialogContent>

      <AssetLibraryModal
        open={assetLibOpen}
        onClose={() => setAssetLibOpen(false)}
        onSelect={handleBannerSelect}
        filterType="banner"
      />
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [channel, setChannel] = useState("");
  const { data, isLoading } = useTemplates(channel || undefined);
  const deleteMutation = useDeleteTemplate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<MessageTemplate | null>(null);
  const [abTestTarget, setAbTestTarget] = useState<MessageTemplate | null>(null);
  const [assetLibOpen, setAssetLibOpen] = useState(false);

  function handleNew() { setEditTarget(null); setModalOpen(true); }
  function handleEdit(tpl: MessageTemplate) { setEditTarget(tpl); setModalOpen(true); }

  async function handleDelete(tpl: MessageTemplate) {
    if (!confirm(`Deletar template "${tpl.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(tpl.id);
      toast.success("Template removido");
    } catch {
      toast.error("Erro ao remover template");
    }
  }

  return (
    <>
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Sticky header: title + channel filter ── */}
      <div className="shrink-0 px-8 pt-8 pb-4 bg-background border-b border-border/30">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Templates</h1>
            <span className="text-sm text-muted-foreground mt-0.5 h-5 flex items-center">
              {isLoading ? <Skeleton className="h-3.5 w-24" /> : `${data?.count ?? 0} templates`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAssetLibOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-border transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
              Assets
            </button>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Template
            </button>
          </div>
        </div>

        {/* Channel filter */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit">
          {CHANNELS.map((ch) => (
            <button
              key={ch.value}
              onClick={() => setChannel(ch.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                channel === ch.value
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

      </div>{/* end sticky header */}

      {/* ── Scrollable content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-5">

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-vault p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-border/60 flex items-center gap-2">
                  <Skeleton className="h-6 w-14 rounded" />
                  <Skeleton className="h-6 w-10 rounded" />
                  <Skeleton className="h-6 w-14 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && data?.results.length === 0 && (
          <div className="card-vault p-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Nenhum template encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie templates de mensagem para Email, SMS, Push e WhatsApp.
            </p>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar template
            </button>
          </div>
        )}

        {/* Grid */}
        {!isLoading && data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
          {data.results.map((tpl) => {
            const Icon = channelIcon[tpl.channel] ?? FileText;
            const badge = channelBadge[tpl.channel] ?? "badge-muted";
            return (
              <div key={tpl.id} className="card-vault p-4 hover:border-gold/20 transition-all group flex flex-col">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    tpl.is_active ? "bg-white/5 text-muted-foreground" : "bg-white/[0.02] text-muted-foreground/40"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{tpl.name}</span>
                      <span className={badge}>{tpl.channel}</span>
                      {!tpl.is_active && <span className="badge-muted">inativo</span>}
                    </div>
                    <p className="text-xs font-data text-muted-foreground mb-1">{tpl.code}</p>
                    {tpl.subject && (
                      <p className="text-xs text-muted-foreground/70 truncate">{tpl.subject}</p>
                    )}
                    <p className="text-xs text-muted-foreground/40 mt-2">
                      {formatDistanceToNow(new Date(tpl.updated_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPreviewTarget(tpl)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-teal hover:bg-teal/10 transition-colors"
                    title="Preview renderizado via API"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => setAbTestTarget(tpl)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-teal hover:bg-teal/10 transition-colors"
                    title="Testes A/B"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    A/B
                  </button>
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}

      </div>{/* end scrollable */}
    </div>{/* end flex col */}

      <TemplateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        template={editTarget}
      />
      <ApiPreviewModal
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        template={previewTarget}
      />
      <AbTestModal
        open={!!abTestTarget}
        onClose={() => setAbTestTarget(null)}
        currentTemplate={abTestTarget}
      />
      <AssetLibraryModal
        open={assetLibOpen}
        onClose={() => setAssetLibOpen(false)}
      />
    </>
  );
}
