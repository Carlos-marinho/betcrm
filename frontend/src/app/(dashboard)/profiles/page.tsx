"use client";

import { useState, useRef } from "react";
import { ImportProfilesModal } from "@/components/features/profiles/ImportProfilesModal";
import { useProfiles, type ProfileFilters } from "@/lib/hooks";
import {
  Search, ChevronLeft, ChevronRight, ExternalLink, Upload,
  SlidersHorizontal, X, ArrowUpDown, ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

const ORDERING_OPTIONS = [
  { label: "Mais recentes", value: "-created_at" },
  { label: "Mais antigos", value: "created_at" },
  { label: "Maior LTV", value: "-ltv" },
  { label: "Menor LTV", value: "ltv" },
  { label: "Último evento", value: "-last_event_at" },
  { label: "Mais depósitos", value: "-deposit_count" },
];

type FTDFilter = "" | "true" | "false";
type StatusFilter = "" | "true" | "false";
type TypeFilter = "" | "player" | "affiliate";

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
        active
          ? "bg-gold/12 text-gold border-gold/30"
          : "bg-transparent text-muted-foreground border-border hover:border-border/80 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default function ProfilesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [ordering, setOrdering] = useState("-created_at");
  const [showOrderingMenu, setShowOrderingMenu] = useState(false);
  const [ftd, setFtd] = useState<FTDFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [profileType, setProfileType] = useState<TypeFilter>("");
  const [ltvMin, setLtvMin] = useState("");
  const [ltvMax, setLtvMax] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 380);
  }

  function clearFilters() {
    setFtd("");
    setStatus("");
    setProfileType("");
    setLtvMin("");
    setLtvMax("");
    setPage(1);
  }

  const activeFilterCount = [
    ftd !== "",
    status !== "",
    profileType !== "",
    ltvMin !== "",
    ltvMax !== "",
  ].filter(Boolean).length;

  const filters: ProfileFilters = {
    search: debouncedSearch,
    page,
    ordering,
    has_ftd: ftd,
    is_active: status,
    profile_type: profileType,
    ltv_min: ltvMin,
    ltv_max: ltvMax,
  };

  const { data, isLoading, refetch } = useProfiles(filters);
  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  const currentOrderingLabel =
    ORDERING_OPTIONS.find((o) => o.value === ordering)?.label ?? "Mais recentes";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">Perfis</h1>
          <span className="text-sm text-muted-foreground mt-0.5 h-5 flex items-center">
            {isLoading ? (
              <Skeleton className="h-3.5 w-36" />
            ) : (
              `${data?.count.toLocaleString("pt-BR") ?? 0} usuários cadastrados`
            )}
          </span>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
          style={{
            background: "rgba(240,165,0,0.1)",
            border: "1px solid rgba(240,165,0,0.22)",
            color: "#F0A500",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(240,165,0,0.16)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(240,165,0,0.1)";
          }}
        >
          <Upload className="w-3.5 h-3.5" />
          Importar CSV
        </button>
      </div>

      <ImportProfilesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Search + filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, email, ID..."
            className="w-full bg-input border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-all ${
            showFilters || activeFilterCount > 0
              ? "bg-gold/10 text-gold border-gold/25"
              : "bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-gold text-[10px] font-bold text-background flex items-center justify-center ml-0.5">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Ordering dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOrderingMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border border-border bg-card text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {currentOrderingLabel}
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
          </button>
          {showOrderingMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowOrderingMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                {ORDERING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setOrdering(opt.value);
                      setPage(1);
                      setShowOrderingMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      ordering === opt.value
                        ? "bg-gold/10 text-gold"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card-vault p-4 space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Filtros ativos
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
                Limpar tudo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* FTD */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Status FTD</p>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip label="Todos" active={ftd === ""} onClick={() => { setFtd(""); setPage(1); }} />
                <FilterChip label="Com FTD" active={ftd === "true"} onClick={() => { setFtd("true"); setPage(1); }} />
                <FilterChip label="Sem FTD" active={ftd === "false"} onClick={() => { setFtd("false"); setPage(1); }} />
              </div>
            </div>

            {/* Status ativo */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Conta</p>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip label="Todos" active={status === ""} onClick={() => { setStatus(""); setPage(1); }} />
                <FilterChip label="Ativa" active={status === "true"} onClick={() => { setStatus("true"); setPage(1); }} />
                <FilterChip label="Inativa" active={status === "false"} onClick={() => { setStatus("false"); setPage(1); }} />
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Tipo</p>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip label="Todos" active={profileType === ""} onClick={() => { setProfileType(""); setPage(1); }} />
                <FilterChip label="Jogador" active={profileType === "player"} onClick={() => { setProfileType("player"); setPage(1); }} />
                <FilterChip label="Afiliado" active={profileType === "affiliate"} onClick={() => { setProfileType("affiliate"); setPage(1); }} />
              </div>
            </div>
          </div>

          {/* LTV range */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Faixa de LTV (R$)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Mínimo"
                value={ltvMin}
                onChange={(e) => { setLtvMin(e.target.value); setPage(1); }}
                className="w-32 bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
              />
              <span className="text-muted-foreground/40 text-sm">—</span>
              <input
                type="number"
                placeholder="Máximo"
                value={ltvMax}
                onChange={(e) => { setLtvMax(e.target.value); setPage(1); }}
                className="w-32 bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-vault overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-data">
            {isLoading ? (
              <Skeleton className="h-3.5 w-32 inline-block" />
            ) : (
              <>{data?.count.toLocaleString("pt-BR") ?? 0} <span className="text-muted-foreground/60">usuários encontrados</span></>
            )}
          </span>
          {data && totalPages > 1 && (
            <span className="text-xs text-muted-foreground/60 font-data">
              página {page} de {totalPages}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Usuário
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ID externo
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  LTV
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  FTD
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Último evento
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))}
              {!isLoading &&
                data?.results.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold/20 to-teal/10 border border-gold/15 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-gold">
                            {(
                              p.first_name?.[0] ??
                              p.email?.[0] ??
                              "?"
                            ).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground leading-tight">
                            {p.first_name || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {p.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-data text-xs text-muted-foreground">
                        {p.external_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.profile_type === "affiliate" ? "badge-gold" : "badge-muted"}>
                        {p.profile_type === "affiliate" ? "afiliado" : "jogador"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-data text-foreground">
                        {p.ltv
                          ? `R$ ${parseFloat(p.ltv).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.ftd_at ? (
                        <span className="badge-teal">FTD</span>
                      ) : (
                        <span className="badge-muted">sem FTD</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {p.last_event_at
                          ? formatDistanceToNow(new Date(p.last_event_at), {
                              locale: ptBR,
                              addSuffix: true,
                            })
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/profiles/${p.id}`}
                        className="text-muted-foreground hover:text-gold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              {!isLoading && data?.results.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground text-sm"
                  >
                    {activeFilterCount > 0 || debouncedSearch
                      ? "Nenhum perfil encontrado com estes filtros."
                      : "Nenhum perfil encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.count > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-data">
              Página {page} de {totalPages} ·{" "}
              {data.count.toLocaleString("pt-BR")} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
