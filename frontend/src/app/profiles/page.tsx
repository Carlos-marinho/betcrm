"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ImportProfilesModal } from "@/components/features/profiles/ImportProfilesModal";
import { useProfiles } from "@/lib/hooks";
import { Search, ChevronLeft, ChevronRight, ExternalLink, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

export default function ProfilesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setDebouncedSearch(val), 400);
    setTimer(t);
  }

  const { data, isLoading, refetch } = useProfiles({ search: debouncedSearch, page, ordering: "-created_at" });

  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Perfis</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data ? `${data.count.toLocaleString("pt-BR")} usuários cadastrados` : "Carregando..."}
            </p>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: "rgba(240,165,0,0.1)",
              border: "1px solid rgba(240,165,0,0.22)",
              color: "#F0A500",
            }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = "rgba(240,165,0,0.16)"); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = "rgba(240,165,0,0.1)"); }}
          >
            <Upload className="w-3.5 h-3.5" />
            Importar CSV
          </button>
        </div>

        <ImportProfilesModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => { refetch(); }}
        />

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, email, ID..."
            className="w-full bg-input border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="card-vault overflow-hidden">
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
                {isLoading && (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><div className="h-4 w-36 shimmer-bg rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 shimmer-bg rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 shimmer-bg rounded ml-auto" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 shimmer-bg rounded" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 shimmer-bg rounded" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                )}
                {!isLoading && data?.results.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {p.first_name || "—"}{" "}
                          <span className="text-muted-foreground font-normal">{p.email}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-data text-xs text-muted-foreground">{p.external_id}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-data text-foreground">
                        {p.ltv ? `R$ ${parseFloat(p.ltv).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
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
                          ? formatDistanceToNow(new Date(p.last_event_at), { locale: ptBR, addSuffix: true })
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
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Nenhum profile encontrado.
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
                Página {page} de {totalPages} · {data.count.toLocaleString("pt-BR")} total
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
    </DashboardShell>
  );
}
