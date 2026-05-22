"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useFlows, useToggleFlow, useCreateFlow, useUpdateFlow, useFlowExecutions, useSegments,
  useFlowScheduleRuns,
  type Flow, type ScheduleConfig,
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
  XCircle, AlertTriangle, Clock, Zap, LayoutGrid, CalendarClock, Users, Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
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

const DAYS_OF_WEEK = [
  { value: 0, label: "Seg" },
  { value: 1, label: "Ter" },
  { value: 2, label: "Qua" },
  { value: 3, label: "Qui" },
  { value: 4, label: "Sex" },
  { value: 5, label: "Sáb" },
  { value: 6, label: "Dom" },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { value: "America/Manaus", label: "Manaus (UTC-4)" },
  { value: "America/Belem", label: "Belém (UTC-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (UTC-3)" },
  { value: "America/Recife", label: "Recife (UTC-3)" },
  { value: "UTC", label: "UTC" },
];

const flowSchema = z.object({
  name: z.string().min(2, "Nome precisa de pelo menos 2 caracteres"),
  code: z.string().min(2, "Código muito curto").regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  description: z.string().optional(),
  allow_reentry: z.boolean().default(false),
  reentry_cooldown_days: z.coerce.number().int().min(0).default(30),
});
type FlowForm = z.infer<typeof flowSchema>;
type TriggerType = "event" | "segment_entry" | "scheduled";
type Recurrence = "once" | "daily" | "weekly" | "monthly";

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

// ── Schedule state default ───────────────────────────────────────────────────

interface ScheduleState {
  recurrence: Recurrence;
  start_at: string;
  end_at: string;
  time: string;
  days_of_week: number[];
  day_of_month: number;
  timezone: string;
  audience: "all" | "segment";
  segment_code: string;
  send_rate_per_minute: number;
}

const DEFAULT_SCHEDULE: ScheduleState = {
  recurrence: "once",
  start_at: "",
  end_at: "",
  time: "09:00",
  days_of_week: [0, 1, 2, 3, 4],
  day_of_month: 1,
  timezone: "America/Sao_Paulo",
  audience: "all",
  segment_code: "",
  send_rate_per_minute: 120,
};

function scheduleConfigToState(config?: Partial<ScheduleConfig>): ScheduleState {
  if (!config || !config.recurrence) return { ...DEFAULT_SCHEDULE };
  return {
    recurrence: config.recurrence ?? "once",
    start_at: config.start_at ?? "",
    end_at: config.end_at ?? "",
    time: config.time ?? "09:00",
    days_of_week: config.days_of_week ?? [0, 1, 2, 3, 4],
    day_of_month: config.day_of_month ?? 1,
    timezone: config.timezone ?? "America/Sao_Paulo",
    audience: config.audience ?? "all",
    segment_code: config.segment_code ?? "",
    send_rate_per_minute: config.send_rate_per_minute ?? 120,
  };
}

function scheduleStateToConfig(s: ScheduleState): ScheduleConfig {
  const base: ScheduleConfig = {
    recurrence: s.recurrence,
    timezone: s.timezone,
    audience: s.audience,
    segment_code: s.audience === "segment" ? s.segment_code : undefined,
    start_at: s.start_at || undefined,
    end_at: s.end_at || undefined,
    send_rate_per_minute: s.send_rate_per_minute,
  };
  if (s.recurrence !== "once") {
    base.time = s.time;
    if (s.recurrence === "weekly") base.days_of_week = s.days_of_week;
    if (s.recurrence === "monthly") base.day_of_month = s.day_of_month;
  }
  return base;
}

function recurrenceLabel(cfg: Partial<ScheduleConfig>): string {
  const labels: Record<string, string> = {
    once: "Única vez",
    daily: "Diária",
    weekly: "Semanal",
    monthly: "Mensal",
  };
  return labels[cfg.recurrence ?? "once"] ?? cfg.recurrence ?? "—";
}

// ── FlowModal ────────────────────────────────────────────────────────────────

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
    (flow?.trigger_type as TriggerType) ?? "event"
  );
  const [triggerEvent, setTriggerEvent] = useState(
    typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : ""
  );
  const [triggerSegment, setTriggerSegment] = useState(
    typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : ""
  );
  const [schedule, setSchedule] = useState<ScheduleState>(
    scheduleConfigToState(flow?.schedule_config)
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
    setTriggerType((flow?.trigger_type as TriggerType) ?? "event");
    setTriggerEvent(typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : "");
    setTriggerSegment(typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : "");
    setSchedule(scheduleConfigToState(flow?.schedule_config));
  }, [flow, reset, open]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue("name", v);
    if (!isEditing) setValue("code", toCode(v));
  }

  function patchSchedule(patch: Partial<ScheduleState>) {
    setSchedule((prev) => ({ ...prev, ...patch }));
  }

  async function onSubmit(values: FlowForm) {
    if (triggerType === "event" && !triggerEvent) {
      toast.error("Selecione um evento de disparo");
      return;
    }
    if (triggerType === "segment_entry" && !triggerSegment) {
      toast.error("Selecione um segmento de entrada");
      return;
    }
    if (triggerType === "scheduled") {
      if (schedule.recurrence === "once" && !schedule.start_at) {
        toast.error("Informe a data e hora de início para o agendamento");
        return;
      }
      if (schedule.recurrence === "weekly" && schedule.days_of_week.length === 0) {
        toast.error("Selecione ao menos um dia da semana");
        return;
      }
      if (schedule.audience === "segment" && !schedule.segment_code) {
        toast.error("Selecione o segmento para o público-alvo");
        return;
      }
    }

    const trigger_config =
      triggerType === "event"
        ? { event_code: triggerEvent }
        : triggerType === "segment_entry"
          ? { segment_code: triggerSegment }
          : {};

    const schedule_config = triggerType === "scheduled" ? scheduleStateToConfig(schedule) : {};

    try {
      const payload = {
        ...values,
        trigger_type: triggerType,
        trigger_config,
        schedule_config,
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
    setTriggerType((flow?.trigger_type as TriggerType) ?? "event");
    setTriggerEvent(typeof flow?.trigger_config?.event_code === "string" ? flow.trigger_config.event_code : "");
    setTriggerSegment(typeof flow?.trigger_config?.segment_code === "string" ? flow.trigger_config.segment_code : "");
    setSchedule(scheduleConfigToState(flow?.schedule_config));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Fluxo" : "Novo Fluxo"}</DialogTitle>
          <DialogDescription>
            Configure um fluxo de automação para engajamento de usuários.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
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

          {/* Código */}
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

          {/* Tipo de gatilho */}
          <div className="space-y-1.5">
            <Label>Tipo de gatilho</Label>
            <Select value={triggerType} onValueChange={(value) => setTriggerType(value as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">
                  <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-gold" /> Evento disparado</span>
                </SelectItem>
                <SelectItem value="segment_entry">
                  <span className="flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5 text-teal" /> Entrada em segmento</span>
                </SelectItem>
                <SelectItem value="scheduled">
                  <span className="flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5 text-violet-400" /> Campanha agendada</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gatilho: Evento */}
          {triggerType === "event" && (
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
          )}

          {/* Gatilho: Segmento */}
          {triggerType === "segment_entry" && (
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

          {/* Gatilho: Agendado */}
          {triggerType === "scheduled" && (
            <div className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-foreground">Configuração de agenda</span>
              </div>

              {/* Recorrência */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recorrência</Label>
                <Select
                  value={schedule.recurrence}
                  onValueChange={(v) => patchSchedule({ recurrence: v as Recurrence })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Única vez</SelectItem>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data/hora de início */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {schedule.recurrence === "once" ? "Data e hora *" : "Início (opcional)"}
                </Label>
                <Input
                  type="datetime-local"
                  className="h-9 font-data text-sm"
                  value={schedule.start_at}
                  onChange={(e) => patchSchedule({ start_at: e.target.value })}
                />
              </div>

              {/* Horário do dia (para recorrentes) */}
              {schedule.recurrence !== "once" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Horário do dia</Label>
                  <Input
                    type="time"
                    className="h-9 font-data text-sm w-36"
                    value={schedule.time}
                    onChange={(e) => patchSchedule({ time: e.target.value })}
                  />
                </div>
              )}

              {/* Dias da semana (weekly) */}
              {schedule.recurrence === "weekly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dias da semana</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map((d) => {
                      const selected = schedule.days_of_week.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() =>
                            patchSchedule({
                              days_of_week: selected
                                ? schedule.days_of_week.filter((x) => x !== d.value)
                                : [...schedule.days_of_week, d.value].sort(),
                            })
                          }
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                            selected
                              ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                              : "bg-white/5 text-muted-foreground border-border hover:border-violet-500/30"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dia do mês (monthly) */}
              {schedule.recurrence === "monthly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    className="h-9 font-data text-sm w-24"
                    value={schedule.day_of_month}
                    onChange={(e) => patchSchedule({ day_of_month: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              {/* Data de término (para recorrentes) */}
              {schedule.recurrence !== "once" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Término (opcional)</Label>
                  <Input
                    type="date"
                    className="h-9 font-data text-sm w-40"
                    value={schedule.end_at}
                    onChange={(e) => patchSchedule({ end_at: e.target.value })}
                  />
                </div>
              )}

              {/* Fuso horário */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fuso horário</Label>
                <Select
                  value={schedule.timezone}
                  onValueChange={(v) => patchSchedule({ timezone: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Taxa de envio */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Taxa de envio (por minuto)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    className="h-9 font-data text-sm w-28"
                    value={schedule.send_rate_per_minute}
                    onChange={(e) => patchSchedule({ send_rate_per_minute: Math.max(1, parseInt(e.target.value) || 120) })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {schedule.send_rate_per_minute >= 1 && (
                      <>
                        ≈ 1 envio a cada{" "}
                        <span className="font-medium text-foreground">
                          {(60 / schedule.send_rate_per_minute) >= 1
                            ? `${Math.round(60 / schedule.send_rate_per_minute)}s`
                            : `${(60 / schedule.send_rate_per_minute * 1000).toFixed(0)}ms`}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Espaça os envios para não parecer spam. 120/min recomendado para email.
                </p>
              </div>

              {/* Público-alvo */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Público-alvo</Label>
                <Select
                  value={schedule.audience}
                  onValueChange={(v) => patchSchedule({ audience: v as "all" | "segment" })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Todos os usuários ativos</span>
                    </SelectItem>
                    <SelectItem value="segment">
                      <span className="flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5" /> Segmento específico</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Segmento */}
              {schedule.audience === "segment" && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Segmento *</Label>
                  <Select
                    value={schedule.segment_code}
                    onValueChange={(v) => patchSchedule({ segment_code: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione um segmento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {segments?.results.map((seg) => (
                        <SelectItem key={seg.id} value={seg.code}>
                          <span className="flex items-center gap-2">
                            <LayoutGrid className="w-3.5 h-3.5 text-teal" />
                            {seg.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Reentrada */}
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

          {/* Descrição */}
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

// ── Trigger badge ─────────────────────────────────────────────────────────────

function TriggerBadge({ flow }: { flow: Flow }) {
  if (flow.trigger_type === "event") {
    const event = TRIGGER_EVENTS.find((e) => e.value === flow.trigger_config?.event_code);
    return (
      <span className="flex items-center gap-1 text-xs text-gold/80">
        <Zap className="w-3 h-3" />
        {event?.label ?? String(flow.trigger_config?.event_code ?? "evento")}
      </span>
    );
  }
  if (flow.trigger_type === "segment_entry") {
    return (
      <span className="flex items-center gap-1 text-xs text-teal/80">
        <LayoutGrid className="w-3 h-3" />
        Segmento: {String(flow.trigger_config?.segment_code ?? "—")}
      </span>
    );
  }
  if (flow.trigger_type === "scheduled") {
    const cfg = flow.schedule_config;
    if (!cfg?.recurrence) return <span className="text-xs text-violet-400/80 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Agendado</span>;
    return (
      <span className="flex items-center gap-1 text-xs text-violet-400/80">
        <CalendarClock className="w-3 h-3" />
        {recurrenceLabel(cfg)}
        {cfg.time && cfg.recurrence !== "once" && ` às ${cfg.time}`}
        {cfg.audience === "segment" && cfg.segment_code && ` · ${cfg.segment_code}`}
      </span>
    );
  }
  return null;
}

// ── Schedule last run info ────────────────────────────────────────────────────

const RUN_STATUS_CONFIG = {
  completed: { color: "text-teal", label: "OK" },
  running:   { color: "text-gold", label: "rodando" },
  failed:    { color: "text-destructive", label: "falhou" },
};

function ScheduleLastRun({ flow }: { flow: Flow }) {
  const { data: runs } = useFlowScheduleRuns(flow.id);
  if (flow.trigger_type !== "scheduled") return null;

  const last = runs?.[0];

  if (!last) return (
    <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
      <Calendar className="w-3 h-3" /> Nunca executado
    </span>
  );

  const cfg = RUN_STATUS_CONFIG[last.status] ?? RUN_STATUS_CONFIG.completed;

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Calendar className="w-3 h-3 shrink-0" />
      <span>{formatDistanceToNow(new Date(last.run_at), { locale: ptBR, addSuffix: true })}</span>
      <span className={`font-medium ${cfg.color}`}>· {cfg.label}</span>
      {last.status === "completed" && last.enrolled_count > 0 && (
        <span className="text-muted-foreground/70">· {last.enrolled_count.toLocaleString("pt-BR")} enrolados</span>
      )}
    </span>
  );
}

// ── FlowsPage ─────────────────────────────────────────────────────────────────

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
    <>
    <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Fluxos</h1>
            <span className="text-sm text-muted-foreground mt-0.5 h-5 flex items-center">
              {isLoading ? <Skeleton className="h-3.5 w-28" /> : `${data?.count ?? 0} fluxos cadastrados`}
            </span>
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
                  <div key={i} className="card-vault p-4 flex items-center gap-4">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-7 w-20 rounded-md shrink-0" />
                  </div>
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

            {!isLoading && data && (
            <div className="grid gap-3 animate-fade-up">
              {data.results.map((flow) => (
                <div
                  key={flow.id}
                  className="card-vault p-4 flex items-center gap-4 hover:border-gold/20 transition-all group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    flow.is_active
                      ? flow.trigger_type === "scheduled"
                        ? "bg-violet-500/10 text-violet-400"
                        : "bg-teal/10 text-teal"
                      : "bg-white/5 text-muted-foreground"
                  }`}>
                    {flow.trigger_type === "scheduled"
                      ? <CalendarClock className="w-4 h-4" />
                      : <Workflow className="w-4 h-4" />}
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
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="font-data">{flow.code}</span>
                      <TriggerBadge flow={flow} />
                      <ScheduleLastRun flow={flow} />
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
            )}
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
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
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
    </>
  );
}
