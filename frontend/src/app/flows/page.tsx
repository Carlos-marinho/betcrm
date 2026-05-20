"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/shell";
import {
  useFlows, useToggleFlow, useCreateFlow, useUpdateFlow, useFlowExecutions, useSegments, type Flow,
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
  Workflow, Play, Pause, Plus, Pencil, Activity, CheckCircle2,
  XCircle, AlertTriangle, Clock, Zap, LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const TRIGGER_EVENTS = [
  { value: "user.register", label: "Registro de usuário" },
  { value: "payment.deposit.completed", label: "Depósito completado" },
  { value: "payment.deposit.started", label: "Depósito iniciado" },
  { value: "payment.deposit.failed", label: "Depósito falhou" },
  { value: "payment.withdrawal.request", label: "Saque solicitado" },
  { value: "payment.withdrawal.approved", label: "Saque aprovado" },
  { value: "payment.withdrawal.completed", label: "Saque completado" },
  { value: "game.started", label: "Jogo iniciado" },
  { value: "bonus.activated", label: "Bônus ativado" },
  { value: "bonus.completed", label: "Bônus completado" },
  { value: "bonus.expired", label: "Bônus expirado" },
  { value: "cashback.paid", label: "Cashback pago" },
];

const flowSchema = z.object({
  name: z.string().min(2, "Nome precisa de pelo menos 2 caracteres"),
  code: z.string().min(2, "Código muito curto").regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  description: z.string().optional(),
  allow_reentry: z.boolean().default(false),
  reentry_cooldown_days: z.coerce.number().int().min(0).default(30),
});
type FlowForm = z.infer<typeof flowSchema>;
type TriggerType = "event" | "segment_entry";

const DEFAULT_DEFINITION = {
  nodes: [
    { id: "start", type: "trigger", next: "exit" },
    { id: "exit", type: "exit" },
  ],
};

function toCode(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
}

const STATE_CONFIG = {
  active: { badge: "badge-teal", icon: Activity, label: "Ativo" },
  completed: { badge: "badge-muted", icon: CheckCircle2, label: "Completo" },
  goal_reached: { badge: "badge-gold", icon: CheckCircle2, label: "Meta atingida" },
  exited: { badge: "badge-muted", icon: XCircle, label: "Saiu" },
  failed: { badge: "badge-red", icon: AlertTriangle, label: "Falhou" },
};

const STATE_FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "completed", label: "Completos" },
  { value: "goal_reached", label: "Meta" },
  { value: "failed", label: "Falhos" },
];

interface FlowModalProps {
  open: boolean;
  onClose: () => void;
  flow?: Flow | null;
}

function FlowModal({ open, onClose, flow }: FlowModalProps) {
  const createMutation = useCreateFlow();
  const updateMutation = useUpdateFlow();
  const { data: segments } = useSegments();
  const isEditing = !!flow;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FlowForm>({
    resolver: zodResolver(flowSchema),
    defaultValues: flow
      ? {
          name: flow.name,
          code: flow.code,
          description: flow.description,
          allow_reentry: flow.allow_reentry,
          reentry_cooldown_days: flow.reentry_cooldown_days,
        }
      : { name: "", code: "", description: "", allow_reentry: false, reentry_cooldown_days: 30 },
  });
  const allowReentry = watch("allow_reentry");

  const [triggerType, setTriggerType] = useState<TriggerType>(
    flow?.trigger_type === "segment_entry" ? "segment_entry" : "event"
  );
  const [triggerEvent, setTriggerEvent] = useState(
    typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : ""
  );
  const [triggerSegment, setTriggerSegment] = useState(
    typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : ""
  );

  useEffect(() => {
    reset(
      flow
        ? {
            name: flow.name,
            code: flow.code,
            description: flow.description,
            allow_reentry: flow.allow_reentry,
            reentry_cooldown_days: flow.reentry_cooldown_days,
          }
        : { name: "", code: "", description: "", allow_reentry: false, reentry_cooldown_days: 30 }
    );
    setTriggerType(flow?.trigger_type === "segment_entry" ? "segment_entry" : "event");
    setTriggerEvent(typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : "");
    setTriggerSegment(typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : "");
  }, [flow, reset, open]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue("name", v);
    if (!isEditing) setValue("code", toCode(v));
  }

  async function onSubmit(values: FlowForm) {
    const trigger_config =
      triggerType === "event"
        ? { event_code: triggerEvent }
        : { segment_code: triggerSegment };

    if (triggerType === "event" && !triggerEvent) {
      toast.error("Selecione um evento de disparo");
      return;
    }

    if (triggerType === "segment_entry" && !triggerSegment) {
      toast.error("Selecione um segmento de entrada");
      return;
    }

    try {
      const payload = {
        ...values,
        trigger_type: triggerType,
        trigger_config,
        definition: flow?.definition ?? DEFAULT_DEFINITION,
      };
      if (isEditing && flow) {
        await updateMutation.mutateAsync({ id: flow.id, ...payload });
        toast.success("Fluxo atualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Fluxo criado");
      }
      reset();
      onClose();
    } catch {
      toast.error("Erro ao salvar fluxo");
    }
  }

  function handleClose() {
    reset();
    setTriggerType(flow?.trigger_type === "segment_entry" ? "segment_entry" : "event");
    setTriggerEvent(typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : "");
    setTriggerSegment(typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : "");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Fluxo" : "Novo Fluxo"}</DialogTitle>
          <DialogDescription>
            Configure um fluxo de automação para engajamento de usuários.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="flow-name">Nome</Label>
            <Input
              id="flow-name"
              placeholder="Ex: Boas-vindas FTD"
              {...register("name")}
              onChange={handleNameChange}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flow-code">Código</Label>
            <Input
              id="flow-code"
              placeholder="Ex: welcome_ftd"
              className="font-data text-sm"
              {...register("code")}
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de gatilho</Label>
            <Select value={triggerType} onValueChange={(value) => setTriggerType(value as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Evento disparado</SelectItem>
                <SelectItem value="segment_entry">Entrada em segmentação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {triggerType === "event" ? (
            <div className="space-y-1.5">
              <Label>Evento de disparo</Label>
              <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((ev) => (
                    <SelectItem key={ev.value} value={ev.value}>
                      <span className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-gold" />
                        {ev.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Segmento de entrada</Label>
              <Select value={triggerSegment} onValueChange={setTriggerSegment}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um segmento..." />
                </SelectTrigger>
                <SelectContent>
                  {segments?.results.map((segment) => (
                    <SelectItem key={segment.id} value={segment.code}>
                      <span className="flex items-center gap-2">
                        <LayoutGrid className="w-3.5 h-3.5 text-teal" />
                        {segment.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {segments?.results.length === 0 && (
                <p className="text-xs text-muted-foreground">Crie um segmento antes de usar este gatilho.</p>
              )}
            </div>
          )}

          <label className="flex items-start gap-3 rounded-md border border-border bg-white/[0.02] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-gold"
              {...register("allow_reentry")}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-foreground">Permitir reentrada</span>
              <span className="block text-xs text-muted-foreground">
                Usuários podem entrar novamente após finalizar ou sair do fluxo.
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="flow-cap">Cooldown de reentrada (dias)</Label>
            <Input
              id="flow-cap"
              type="number"
              min={0}
              placeholder="30"
              className={`font-data ${allowReentry ? "" : "opacity-60"}`}
              readOnly={!allowReentry}
              {...register("reentry_cooldown_days")}
            />
            <p className="text-xs text-muted-foreground">
              {allowReentry
                ? "Intervalo mínimo antes de permitir uma nova entrada."
                : "Ative reentrada para aplicar este intervalo."}
            </p>
            {errors.reentry_cooldown_days && <p className="text-xs text-destructive">{errors.reentry_cooldown_days.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flow-desc">Descrição <span className="normal-case text-muted-foreground/60">(opcional)</span></Label>
            <Textarea
              id="flow-desc"
              placeholder="Descreva o objetivo deste fluxo..."
              rows={2}
              {...register("description")}
            />
          </div>

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
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar fluxo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FlowsPage() {
  const { data, isLoading } = useFlows();
  const toggle = useToggleFlow();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Flow | null>(null);
  const [tab, setTab] = useState("flows");
  const [stateFilter, setStateFilter] = useState("");

  const { data: executions, isLoading: execLoading } = useFlowExecutions({ state: stateFilter || undefined });

  async function handleToggle(id: number, currentlyActive: boolean) {
    try {
      await toggle.mutateAsync({ id, activate: !currentlyActive });
      toast.success(currentlyActive ? "Fluxo desativado" : "Fluxo ativado");
    } catch {
      toast.error("Erro ao alterar estado do fluxo");
    }
  }

  function handleNew() {
    setEditTarget(null);
    setModalOpen(true);
  }

  function handleEdit(flow: Flow) {
    setEditTarget(flow);
    setModalOpen(true);
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Fluxos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.count} fluxos cadastrados` : "Carregando..."}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Fluxo
          </button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="flows">Fluxos</TabsTrigger>
            <TabsTrigger value="executions">Execuções</TabsTrigger>
          </TabsList>

          {/* ── FLOWS TAB ── */}
          <TabsContent value="flows">
            {isLoading && (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="card-vault p-5 h-20 shimmer-bg" />
                ))}
              </div>
            )}

            {!isLoading && data?.results.length === 0 && (
              <div className="card-vault p-12 text-center">
                <Workflow className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Nenhum fluxo criado ainda</p>
                <p className="text-sm text-muted-foreground mb-4">Automatize o engajamento dos seus usuários.</p>
                <button
                  onClick={handleNew}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Criar fluxo
                </button>
              </div>
            )}

            <div className="grid gap-3">
              {data?.results.map((flow) => (
                <div
                  key={flow.id}
                  className="card-vault p-4 flex items-center gap-4 hover:border-gold/20 transition-all group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    flow.is_active ? "bg-teal/10 text-teal" : "bg-white/5 text-muted-foreground"
                  }`}>
                    <Workflow className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-foreground truncate">{flow.name}</span>
                      {flow.is_active ? (
                        <span className="badge-teal">ativo</span>
                      ) : (
                        <span className="badge-muted">inativo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-data">{flow.code}</span>
                      {flow.description && <span className="truncate max-w-xs">{flow.description}</span>}
                      <span className="shrink-0">
                        atualizado{" "}
                        {formatDistanceToNow(new Date(flow.updated_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(flow)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                      title="Editar metadados"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/flows/${flow.id}`}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all"
                      title="Abrir editor de fluxo"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Editor
                    </Link>
                    <button
                      onClick={() => handleToggle(flow.id, flow.is_active)}
                      disabled={toggle.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        flow.is_active
                          ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                          : "bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
                      } disabled:opacity-50`}
                    >
                      {flow.is_active ? (
                        <><Pause className="w-3.5 h-3.5" /> Pausar</>
                      ) : (
                        <><Play className="w-3.5 h-3.5" /> Ativar</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── EXECUTIONS TAB ── */}
          <TabsContent value="executions">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit">
                {STATE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStateFilter(f.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      stateFilter === f.value
                        ? "bg-gold/10 text-gold border border-gold/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-teal">
                <span className="live-dot" />
                atualiza a cada 15s
              </div>
            </div>

            <div className="card-vault overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fluxo</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuário</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Iniciou</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Próxima exec.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execLoading && Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="px-4 py-3"><div className="h-4 w-28 shimmer-bg rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 shimmer-bg rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-16 shimmer-bg rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-24 shimmer-bg rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 shimmer-bg rounded" /></td>
                      </tr>
                    ))}
                    {!execLoading && executions?.results.map((exec) => {
                      const cfg = STATE_CONFIG[exec.state] ?? STATE_CONFIG.exited;
                      return (
                        <tr key={exec.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-data text-xs text-foreground">{exec.flow_code}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-data text-xs text-muted-foreground">{exec.profile_external_id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cfg.badge}>{cfg.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(exec.started_at), { locale: ptBR, addSuffix: true })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {exec.next_run_at ? (
                              <span className="text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {formatDistanceToNow(new Date(exec.next_run_at), { locale: ptBR, addSuffix: true })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!execLoading && executions?.results.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                          Nenhuma execução encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <FlowModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        flow={editTarget}
      />
    </DashboardShell>
  );
}
