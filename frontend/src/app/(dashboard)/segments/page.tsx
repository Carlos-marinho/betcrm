"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useSegments,
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
  useSegmentMembers,
  useSegmentPreviewCount,
  type Segment,
  type ProfileListItem,
} from "@/lib/hooks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RulesBuilder, type SegmentRules } from "@/components/features/rules-builder";
import {
  Filter,
  Plus,
  Pencil,
  Trash2,
  Users,
  ExternalLink,
  TrendingUp,
  Search,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import Link from "next/link";

const segmentSchema = z.object({
  name: z.string().min(2, "Nome precisa de pelo menos 2 caracteres"),
  code: z
    .string()
    .min(2, "Código muito curto")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});
type SegmentForm = z.infer<typeof segmentSchema>;

function toCode(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
}

const EMPTY_RULES: SegmentRules = { operator: "AND", conditions: [] };

// ── Segment Modal (create / edit) ─────────────────────────────────────────────

interface SegmentModalProps {
  open: boolean;
  onClose: () => void;
  segment?: Segment | null;
}

function SegmentModal({ open, onClose, segment }: SegmentModalProps) {
  const createMutation = useCreateSegment();
  const updateMutation = useUpdateSegment();
  const previewCountMutation = useSegmentPreviewCount();
  const isEditing = !!segment;

  const [rules, setRules] = useState<SegmentRules>(() => {
    if (
      segment?.rules &&
      typeof segment.rules === "object" &&
      "conditions" in (segment.rules as object)
    ) {
      return segment.rules as SegmentRules;
    }
    return EMPTY_RULES;
  });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("info");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SegmentForm>({
    resolver: zodResolver(segmentSchema),
    defaultValues: segment
      ? {
          name: segment.name,
          code: segment.code,
          description: segment.description,
          is_active: segment.is_active,
        }
      : { name: "", code: "", description: "", is_active: true },
  });

  const isActiveVal = watch("is_active");

  useEffect(() => {
    if (!open) return;
    reset(
      segment
        ? {
            name: segment.name,
            code: segment.code,
            description: segment.description,
            is_active: segment.is_active,
          }
        : { name: "", code: "", description: "", is_active: true }
    );
    setRules(
      segment?.rules &&
        typeof segment.rules === "object" &&
        "conditions" in (segment.rules as object)
        ? (segment.rules as SegmentRules)
        : EMPTY_RULES
    );
    setPreviewCount(null);
    setActiveTab("info");
  }, [segment, open, reset]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue("name", e.target.value);
    if (!isEditing) setValue("code", toCode(e.target.value));
  }

  async function handlePreviewCount() {
    if (!isEditing || !segment) return;
    try {
      const res = await previewCountMutation.mutateAsync(segment.id);
      setPreviewCount(res.count);
    } catch {
      toast.error("Erro ao estimar audiência");
    }
  }

  async function onSubmit(values: SegmentForm) {
    try {
      if (isEditing && segment) {
        await updateMutation.mutateAsync({ id: segment.id, ...values, rules });
        toast.success("Segmento atualizado");
      } else {
        await createMutation.mutateAsync({ ...values, rules });
        toast.success("Segmento criado");
      }
      handleClose();
    } catch {
      toast.error("Erro ao salvar segmento");
    }
  }

  function handleClose() {
    reset();
    setRules(EMPTY_RULES);
    setPreviewCount(null);
    setActiveTab("info");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Segmento" : "Novo Segmento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Ajuste as informações e as regras de audiência do segmento."
              : "Defina um segmento com condições de audiência para usar em fluxos e campanhas."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="rules">
              Regras
              {rules.conditions.length > 0 && (
                <span className="ml-1.5 w-4 h-4 rounded-full bg-gold/20 text-gold text-[10px] font-data font-bold flex items-center justify-center">
                  {rules.conditions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Info tab ── */}
          <TabsContent value="info">
            <form
              id="seg-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="seg-name">Nome</Label>
                <Input
                  id="seg-name"
                  placeholder="Ex: Usuários VIP com FTD"
                  {...register("name")}
                  onChange={handleNameChange}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seg-code">Código</Label>
                <Input
                  id="seg-code"
                  placeholder="vip_ftd_users"
                  className="font-data text-sm"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-xs text-destructive">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seg-desc">
                  Descrição{" "}
                  <span className="normal-case text-muted-foreground/60">(opcional)</span>
                </Label>
                <Textarea
                  id="seg-desc"
                  placeholder="Descreva quando um usuário deve entrar neste segmento..."
                  rows={3}
                  {...register("description")}
                />
              </div>

              <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border bg-white/[0.02]">
                <div>
                  <p className="text-sm font-medium text-foreground">Ativo</p>
                  <p className="text-xs text-muted-foreground">
                    Segmento disponível para uso em fluxos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue("is_active", !isActiveVal)}
                  className={`relative w-10 h-5 rounded-full border transition-all ${
                    isActiveVal
                      ? "bg-teal/20 border-teal/40"
                      : "bg-white/5 border-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                      isActiveVal ? "translate-x-5 bg-teal" : "bg-muted-foreground/40"
                    }`}
                  />
                </button>
              </div>
            </form>
          </TabsContent>

          {/* ── Rules tab ── */}
          <TabsContent value="rules" className="pt-2">
            <div className="mb-3 px-3 py-2.5 rounded-lg border border-gold/15 bg-gold/[0.03] text-xs text-muted-foreground">
              Defina as condições que determinam quais usuários entram neste
              segmento. Clique em{" "}
              <span className="text-foreground font-medium">&quot;Estimar audiência&quot;</span>{" "}
              para ver quantos usuários se enquadram.
            </div>
            <RulesBuilder
              value={rules}
              onChange={setRules}
              previewCount={previewCount}
              onPreviewCount={isEditing ? handlePreviewCount : undefined}
              isLoadingCount={previewCountMutation.isPending}
            />
            {!isEditing && (
              <p className="text-xs text-muted-foreground/50 mt-3">
                Salve o segmento primeiro para poder estimar a audiência.
              </p>
            )}
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
            form="seg-form"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? "Salvando..."
              : isEditing
                ? "Salvar alterações"
                : "Criar segmento"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Segment Members Modal ─────────────────────────────────────────────────────

interface MembersModalProps {
  open: boolean;
  onClose: () => void;
  segment: Segment | null;
}

function MembersModal({ open, onClose, segment }: MembersModalProps) {
  const { data, isLoading } = useSegmentMembers(segment?.id ?? null, 50);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Membros — {segment?.name}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Carregando..."
              : data
                ? `${data.count_preview.toLocaleString("pt-BR")} usuários neste segmento (preview)`
                : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 shimmer-bg rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && data?.results.length === 0 && (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum usuário neste segmento
              </p>
            </div>
          )}

          {!isLoading && data && data.results.length > 0 && (
            <div className="divide-y divide-border/50">
              {data.results.map((profile: ProfileListItem) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 py-2.5 px-1 hover:bg-white/[0.02] rounded transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold/20 to-teal/10 border border-gold/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-gold">
                      {(
                        profile.first_name?.[0] ??
                        profile.email?.[0] ??
                        "?"
                      ).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {profile.first_name || profile.email || profile.external_id}
                    </p>
                    <p className="text-xs font-data text-muted-foreground">
                      {profile.external_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {profile.ftd_at && <span className="badge-teal">FTD</span>}
                    {profile.ltv && (
                      <span className="text-xs font-data text-muted-foreground">
                        R${" "}
                        {parseFloat(profile.ltv).toLocaleString("pt-BR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    )}
                    <Link
                      href={`/profiles/${profile.id}`}
                      className="p-1 text-muted-foreground/40 hover:text-gold transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          {data && (
            <p className="text-xs text-muted-foreground font-data mr-auto">
              Exibindo {Math.min(50, data.results.length)} de{" "}
              {data.count_preview.toLocaleString("pt-BR")} usuários
            </p>
          )}
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

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveFilter = "" | "true" | "false";

export default function SegmentsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Segment | null>(null);
  const [membersTarget, setMembersTarget] = useState<Segment | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useSegments({
    search: debouncedSearch,
    is_active: activeFilter,
  });
  const deleteMutation = useDeleteSegment();

  function handleSearch(val: string) {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 380);
  }

  function handleEdit(seg: Segment) {
    setEditTarget(seg);
    setModalOpen(true);
  }

  function handleNew() {
    setEditTarget(null);
    setModalOpen(true);
  }

  async function handleDelete(seg: Segment) {
    if (!confirm(`Deletar segmento "${seg.name}"? Esta ação não pode ser desfeita.`))
      return;
    try {
      await deleteMutation.mutateAsync(seg.id);
      toast.success("Segmento removido");
    } catch {
      toast.error("Erro ao remover segmento");
    }
  }

  const rulesCount = (seg: Segment) => {
    if (!seg.rules || typeof seg.rules !== "object") return 0;
    return (seg.rules as SegmentRules).conditions?.length ?? 0;
  };

  const activeFilterCount = [debouncedSearch !== "", activeFilter !== ""].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0">

        {/* ── Sticky header: title + search + filters ── */}
        <div className="shrink-0 px-8 pt-8 pb-4 bg-background border-b border-border/30">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Segmentos</h1>
            <span className="text-sm text-muted-foreground mt-0.5 h-5 flex items-center">
              {isLoading ? (
                <Skeleton className="h-3.5 w-24" />
              ) : (
                `${data?.count ?? 0} segmento${data?.count !== 1 ? "s" : ""}`
              )}
            </span>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Segmento
          </button>
        </div>

        {/* Search + status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="w-full bg-input border border-border rounded-md pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            {[
              { label: "Todos", value: "" as ActiveFilter },
              { label: "Ativos", value: "true" as ActiveFilter },
              { label: "Inativos", value: "false" as ActiveFilter },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActiveFilter(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeFilter === opt.value
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs font-medium text-gold">
              <span className="w-4 h-4 rounded-full bg-gold text-[10px] font-bold text-background flex items-center justify-center">
                {activeFilterCount}
              </span>
              filtro{activeFilterCount !== 1 ? "s" : ""} ativo{activeFilterCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        </div>{/* end sticky header */}

        {/* ── Scrollable content ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-5">

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-vault p-5 h-32">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-48" />
                    <div className="flex items-center gap-3 pt-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.results.length === 0 && (
          <div className="card-vault p-12 text-center">
            <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              {hasFilters ? "Nenhum segmento encontrado" : "Nenhum segmento ainda"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {hasFilters
                ? "Tente outros termos de busca ou remova os filtros."
                : "Crie segmentos de audiência para usar em fluxos e campanhas."}
            </p>
            {!hasFilters && (
              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gold text-primary-foreground hover:bg-gold/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar segmento
              </button>
            )}
          </div>
        )}

        {/* Segments grid */}
        {!isLoading && data && data.results.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 animate-fade-up">
            {data.results.map((seg) => (
              <div
                key={seg.id}
                className="card-vault p-5 hover:border-gold/20 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      seg.is_active
                        ? "bg-gold/10 text-gold"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {seg.name}
                      </span>
                      {seg.is_active ? (
                        <span className="badge-teal">ativo</span>
                      ) : (
                        <span className="badge-muted">inativo</span>
                      )}
                      {rulesCount(seg) > 0 && (
                        <span className="badge-gold">
                          {rulesCount(seg)} regra{rulesCount(seg) !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-data text-muted-foreground mb-1">
                      {seg.code}
                    </p>
                    {seg.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {seg.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground/60">
                      {seg.member_count > 0 && (
                        <button
                          onClick={() => setMembersTarget(seg)}
                          className="flex items-center gap-1 hover:text-teal transition-colors"
                        >
                          <Users className="w-3 h-3" />
                          <span className="font-data">
                            {seg.member_count.toLocaleString("pt-BR")}
                          </span>
                        </button>
                      )}
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formatDistanceToNow(new Date(seg.updated_at), {
                          locale: ptBR,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setMembersTarget(seg)}
                      className="p-1.5 rounded text-muted-foreground hover:text-teal hover:bg-teal/10 transition-colors"
                      title="Ver membros"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(seg)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(seg)}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        </div>{/* end scrollable */}
      </div>{/* end flex col */}

      <SegmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        segment={editTarget}
      />

      <MembersModal
        open={!!membersTarget}
        onClose={() => setMembersTarget(null)}
        segment={membersTarget}
      />
    </>
  );
}
