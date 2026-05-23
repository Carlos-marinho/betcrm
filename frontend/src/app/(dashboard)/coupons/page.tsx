"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  useToggleCoupon,
  useFlows,
  type CampaignCoupon,
} from "@/lib/hooks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ── Schema ────────────────────────────────────────────────────────────────────

const couponSchema = z.object({
  key: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  code: z
    .string()
    .min(1, "Obrigatório")
    .transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  flow_code: z.string().optional(),
  expires_at: z.string().optional(),
});

type CouponForm = z.infer<typeof couponSchema>;

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="ml-2 p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-yellow-400"
      title="Copiar código"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ── Coupon ticket ─────────────────────────────────────────────────────────────

function CouponTicket({ code, valid }: { code: string; valid: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-sm font-bold tracking-widest select-all"
      style={{
        border: `1.5px dashed ${valid ? "#FFD700" : "#3f3f46"}`,
        background: valid
          ? "linear-gradient(135deg,#0b0900 0%,#1a1200 100%)"
          : "#0f0f0f",
        color: valid ? "#FFD700" : "#52525b",
        letterSpacing: "0.18em",
        textShadow: valid ? "0 0 12px rgba(255,215,0,0.25)" : "none",
      }}
    >
      {code}
    </span>
  );
}

// ── Flow badge ────────────────────────────────────────────────────────────────

function FlowBadge({ flowCode }: { flowCode: string }) {
  if (!flowCode) return <span className="text-zinc-600 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
      <Zap size={10} className="text-yellow-600" />
      {flowCode}
    </span>
  );
}

// ── Active toggle ─────────────────────────────────────────────────────────────

function ActiveToggle({
  id,
  active,
}: {
  id: number;
  active: boolean;
}) {
  const toggle = useToggleCoupon();
  return (
    <button
      onClick={() => toggle.mutate({ id, is_active: !active })}
      disabled={toggle.isPending}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:opacity-50 ${
        active
          ? "bg-yellow-500"
          : "bg-zinc-700"
      }`}
      role="switch"
      aria-checked={active}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          active ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const { data: coupons = [], isLoading } = useCoupons();
  const { data: flowsData } = useFlows();
  const flows = Array.isArray(flowsData)
    ? flowsData
    : (flowsData as { results?: unknown[] })?.results ?? [];

  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignCoupon | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CouponForm>({ resolver: zodResolver(couponSchema) });

  const openCreate = () => {
    setEditing(null);
    reset({ key: "", code: "", description: "", flow_code: "", expires_at: "" });
    setOpen(true);
  };

  const openEdit = (c: CampaignCoupon) => {
    setEditing(c);
    reset({
      key: c.key,
      code: c.code,
      description: c.description,
      flow_code: c.flow_code || "",
      expires_at: c.expires_at
        ? c.expires_at.slice(0, 16)
        : "",
    });
    setOpen(true);
  };

  const onSubmit = async (values: CouponForm) => {
    const payload = {
      ...values,
      expires_at: values.expires_at || null,
    };
    try {
      if (editing) {
        await updateCoupon.mutateAsync({ id: editing.id, ...payload });
        toast.success("Cupom atualizado");
      } else {
        await createCoupon.mutateAsync(payload);
        toast.success("Cupom criado");
      }
      setOpen(false);
    } catch {
      toast.error("Erro ao salvar cupom");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCoupon.mutateAsync(id);
      toast.success("Cupom removido");
      setDeletingId(null);
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const active = coupons.filter((c) => c.is_active).length;
  const expired = coupons.filter((c) => !c.is_valid && c.is_active).length;
  const reused = coupons.filter((c) => c.has_been_sent).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800/60 bg-[#09090b]/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Ticket size={18} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Cupons de Campanha
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {coupons.length} cupons &middot; {active} ativos
                {expired > 0 && (
                  <span className="text-orange-400 ml-1">
                    · {expired} expirado{expired > 1 ? "s" : ""}
                  </span>
                )}
                {reused > 0 && (
                  <span className="text-amber-500 ml-1">
                    · {reused} já usado{reused > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs tracking-wider px-4"
          >
            <Plus size={14} />
            NOVO CUPOM
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-zinc-900 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && coupons.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Ticket size={28} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">Nenhum cupom cadastrado</p>
            <Button
              onClick={openCreate}
              variant="outline"
              className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 text-xs"
            >
              Criar primeiro cupom
            </Button>
          </div>
        )}

        {/* Table */}
        {!isLoading && coupons.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1.6fr_1.8fr_1.5fr_80px_40px] gap-4 px-5 py-2.5 bg-zinc-900/50 border-b border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Chave</span>
              <span>Código</span>
              <span>Descrição</span>
              <span>Flow</span>
              <span className="text-center">Ativo</span>
              <span />
            </div>

            {/* Rows */}
            <div className="divide-y divide-zinc-800/60">
              {coupons.map((coupon, i) => (
                <div
                  key={coupon.id}
                  className="grid grid-cols-[1fr_1.6fr_1.8fr_1.5fr_80px_40px] gap-4 px-5 py-3.5 items-center hover:bg-zinc-900/40 transition-colors group"
                  style={{
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {/* Key */}
                  <div>
                    <span className="font-mono text-xs text-zinc-300 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
                      {coupon.key}
                    </span>
                  </div>

                  {/* Code — the star */}
                  <div className="flex items-center">
                    <CouponTicket code={coupon.code} valid={coupon.is_valid} />
                    <CopyButton text={coupon.code} />
                    {!coupon.is_valid && coupon.expires_at && (
                      <span
                        className="ml-2 flex items-center gap-1 text-[10px] text-orange-400"
                        title="Cupom expirado"
                      >
                        <AlertCircle size={10} />
                        exp.
                      </span>
                    )}
                    {coupon.has_been_sent && (
                      <span
                        className="ml-2 flex items-center gap-1 text-[10px] text-amber-500"
                        title="Este código já foi enviado em um flow. Considere trocar para não repetir o mesmo cupom."
                      >
                        <AlertTriangle size={11} />
                        já usado
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400 truncate">
                      {coupon.description || (
                        <span className="text-zinc-600">—</span>
                      )}
                    </p>
                    {coupon.expires_at && (
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Expira{" "}
                        {format(new Date(coupon.expires_at), "dd/MM/yy HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    )}
                  </div>

                  {/* Flow */}
                  <div>
                    <FlowBadge flowCode={coupon.flow_code} />
                  </div>

                  {/* Toggle */}
                  <div className="flex justify-center">
                    <ActiveToggle id={coupon.id} active={coupon.is_active} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(coupon)}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingId(coupon.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="mt-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-5 py-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-zinc-300 font-medium">Como funciona:</span> Os
            flows referenciam cupons pela{" "}
            <span className="font-mono text-yellow-600/80 text-[11px]">
              chave
            </span>{" "}
            (ex:{" "}
            <span className="font-mono text-yellow-600/80 text-[11px]">
              welcome
            </span>
            ). Ao alterar o{" "}
            <span className="text-zinc-300">Código</span>, o novo valor é
            aplicado em todos os envios futuros em até 60 segundos —{" "}
            <span className="text-zinc-300">sem reiniciar servidor</span>.
          </p>
        </div>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="bg-zinc-950 border-zinc-800 text-white max-w-lg"
          style={{ boxShadow: "0 0 0 1px #27272a, 0 24px 64px rgba(0,0,0,0.7)" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Ticket size={16} className="text-yellow-400" />
              {editing ? "Editar cupom" : "Novo cupom"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Key + Code */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">
                  Chave interna <span className="text-red-500">*</span>
                </Label>
                <Input
                  {...register("key")}
                  placeholder="ex: welcome"
                  disabled={!!editing}
                  className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm focus:border-yellow-500/60 disabled:opacity-50 disabled:cursor-not-allowed h-9"
                />
                {errors.key && (
                  <p className="text-[11px] text-red-400">{errors.key.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">
                  Código do cupom <span className="text-red-500">*</span>
                </Label>
                <Input
                  {...register("code")}
                  placeholder="ex: BOAS100"
                  className="bg-zinc-900 border-zinc-700 text-yellow-400 font-mono text-sm tracking-widest uppercase focus:border-yellow-500/60 h-9"
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.value = t.value.toUpperCase();
                  }}
                />
                {errors.code && (
                  <p className="text-[11px] text-red-400">{errors.code.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Descrição</Label>
              <Input
                {...register("description")}
                placeholder="Boas-vindas — 100% no primeiro depósito"
                className="bg-zinc-900 border-zinc-700 text-white text-sm focus:border-zinc-600 h-9"
              />
            </div>

            {/* Flow */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Flow vinculado</Label>
              <Select
                onValueChange={(v) => setValue("flow_code", v === "__none__" ? "" : v)}
                defaultValue={editing?.flow_code || "__none__"}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-sm h-9 focus:border-zinc-600">
                  <SelectValue placeholder="Selecionar flow..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                  <SelectItem value="__none__" className="text-zinc-500 text-xs">
                    Nenhum
                  </SelectItem>
                  {(flows as { id: number; code: string; name: string }[]).map((f) => (
                    <SelectItem key={f.id} value={f.code} className="text-sm font-mono">
                      {f.code}
                      <span className="text-zinc-500 text-xs ml-2 font-sans">
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expiry */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">
                Expiração{" "}
                <span className="text-zinc-600">(opcional)</span>
              </Label>
              <Input
                {...register("expires_at")}
                type="datetime-local"
                className="bg-zinc-900 border-zinc-700 text-white text-sm focus:border-zinc-600 h-9 [color-scheme:dark]"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs tracking-wider px-5"
              >
                {isSubmitting
                  ? "Salvando..."
                  : editing
                  ? "SALVAR ALTERAÇÕES"
                  : "CRIAR CUPOM"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Dialog ── */}
      <Dialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <DialogContent
          className="bg-zinc-950 border-zinc-800 text-white max-w-sm"
          style={{ boxShadow: "0 0 0 1px #27272a, 0 24px 64px rgba(0,0,0,0.7)" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <Trash2 size={15} className="text-red-400" />
              Remover cupom
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400 pt-1">
            Esta ação é irreversível. O código deixará de ser enviado nos emails
            a partir do próximo render.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeletingId(null)}
              className="text-zinc-400 text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={deleteCoupon.isPending}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold tracking-wider"
            >
              {deleteCoupon.isPending ? "Removendo..." : "REMOVER"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
