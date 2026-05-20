"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useTemplatePreview,
  useAbTests,
  useCreateAbTest,
  useDeleteAbTest,
  type MessageTemplate,
  type AbTest,
} from "@/lib/hooks";
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
  FlaskConical, Loader2, CheckCircle, AlertCircle, User,
} from "lucide-react";
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
  body_text: z.string().min(1, "Corpo é obrigatório"),
  body_html: z.string().optional(),
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
  const [profileId, setProfileId] = useState("");
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");

  function handlePreview() {
    if (!template) return;
    previewMutation.mutate({
      id: template.id,
      profile_external_id: profileId || undefined,
    });
  }

  const result = previewMutation.data;
  const Icon = template ? (channelIcon[template.channel] ?? FileText) : FileText;
  const badge = template ? (channelBadge[template.channel] ?? "badge-muted") : "badge-muted";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <DialogTitle>Preview — {template?.name}</DialogTitle>
            <span className={badge}>{template?.channel}</span>
          </div>
          <DialogDescription className="font-data">{template?.code}</DialogDescription>
        </DialogHeader>

        {/* Profile context input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="ID do usuário para contexto (opcional)"
              className="pl-8 text-sm font-data"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors shrink-0"
          >
            {previewMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Renderizar
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!result && !previewMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <Eye className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                Clique em <span className="text-foreground font-medium">Renderizar</span> para ver o template com variáveis substituídas
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Sem ID de usuário, usamos um perfil fictício com dados de exemplo
              </p>
            </div>
          )}

          {previewMutation.isError && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro ao renderizar template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verifique a sintaxe Jinja2 do template
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.from && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">De</p>
                  <div className="px-3 py-2 bg-white/[0.03] border border-border rounded-md text-sm font-data text-muted-foreground">
                    {result.from}
                  </div>
                </div>
              )}

              {result.subject && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Assunto</p>
                  <div className="px-3 py-2.5 bg-white/[0.03] border border-border rounded-md text-sm text-foreground font-medium">
                    {result.subject}
                  </div>
                </div>
              )}

              {(result.html || result.text || result.body) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">Corpo</p>
                  {result.html && result.text ? (
                    <>
                      <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit mb-3">
                        {[
                          { key: "html" as const, label: "HTML" },
                          { key: "text" as const, label: "Texto" },
                        ].map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setPreviewTab(t.key)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                              previewTab === t.key
                                ? "bg-gold/10 text-gold border border-gold/20"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {previewTab === "html" ? (
                        <div
                          className="p-5 bg-white rounded-lg text-sm leading-relaxed text-gray-900 max-h-[300px] overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: result.html }}
                        />
                      ) : (
                        <pre className="px-4 py-3 bg-white/[0.03] border border-border rounded-md text-xs font-data text-foreground whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                          {result.text}
                        </pre>
                      )}
                    </>
                  ) : result.html ? (
                    <div
                      className="p-5 bg-white rounded-lg text-sm leading-relaxed text-gray-900 max-h-[300px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: result.html }}
                    />
                  ) : (
                    <pre className="px-4 py-3 bg-white/[0.03] border border-border rounded-md text-xs font-data text-foreground whitespace-pre-wrap leading-relaxed">
                      {result.text ?? result.body}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-teal">
                <CheckCircle className="w-3.5 h-3.5" />
                Template renderizado com sucesso
              </div>
            </div>
          )}
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

  const {
    register, handleSubmit, control, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: template
      ? {
          name: template.name, code: template.code, channel: template.channel,
          category: template.category, subject: template.subject,
          body_text: template.body_text, body_html: template.body_html,
          is_active: template.is_active,
        }
      : { name: "", code: "", channel: "email", category: "", subject: "", body_text: "", body_html: "", is_active: true },
  });

  const watchChannel = watch("channel");
  const watchBodyText = watch("body_text");
  const watchSubject = watch("subject");
  const isActiveVal = watch("is_active");

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    if (!isEditing) setValue("code", toCode(e.target.value));
  }

  function insertVar(v: string) {
    setValue("body_text", (watch("body_text") || "") + v);
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

  function handleClose() {
    reset();
    setPreviewTab("form");
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
                  {...register("body_text")}
                />
                {errors.body_text && <p className="text-xs text-destructive">{errors.body_text.message}</p>}
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
                    {...register("body_html")}
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
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.count} templates` : "Carregando..."}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Template
          </button>
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

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-vault p-5 h-32 shimmer-bg" />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.results.map((tpl) => {
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
      </div>

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
    </DashboardShell>
  );
}
