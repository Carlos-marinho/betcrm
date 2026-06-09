"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronsUpDown, Crown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceMe } from "@/lib/workspace-hooks";
import { useWorkspaceStore } from "@/stores/workspace";

export function WorkspaceSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useWorkspaceMe();
  const { workspaces, activeWorkspaceId, isSuperAdmin, setData, setActive } =
    useWorkspaceStore();

  // Popula o store quando /me resolve. Se o workspace ativo salvo no localStorage
  // não for mais acessível (ex: foi excluído), o store troca para o default —
  // nesse caso limpamos o cache para refazer as queries no workspace correto.
  useEffect(() => {
    if (!data) return;
    const before = useWorkspaceStore.getState().activeWorkspaceId;
    setData({
      workspaces: data.workspaces,
      defaultWorkspaceId: data.default_workspace_id,
      isSuperAdmin: data.is_super_admin,
    });
    const after = useWorkspaceStore.getState().activeWorkspaceId;
    if (before !== after) queryClient.clear();
  }, [data, setData, queryClient]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const canManage = isSuperAdmin || workspaces.some((w) => w.role === "admin");

  function handleSelect(id: number) {
    if (id !== activeWorkspaceId) {
      setActive(id);
      // Os query keys não carregam o workspace — limpamos o cache para forçar
      // refetch com o novo header X-Workspace-Id.
      queryClient.clear();
      router.refresh();
    }
    setOpen(false);
  }

  if (isLoading && workspaces.length === 0) {
    return (
      <div className="mx-3 mt-3 h-11 rounded-lg border border-border bg-white/[0.02] animate-pulse" />
    );
  }

  // Workspace único e não pode gerenciar: nem mostra o seletor.
  if (workspaces.length <= 1 && !canManage) return null;

  return (
    <div ref={ref} className="relative mx-3 mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150",
          open
            ? "border-gold/30 bg-gold/[0.06]"
            : "border-border bg-white/[0.02] hover:border-gold/20 hover:bg-white/[0.04]"
        )}
      >
        <div className="w-7 h-7 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
          {active?.is_primary ? (
            <Crown className="w-3.5 h-3.5 text-gold" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-gold" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-data leading-none mb-0.5">
            Workspace
          </p>
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {active?.name ?? "Selecione"}
          </p>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden animate-fade-up">
          <div className="max-h-64 overflow-y-auto py-1">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    isActive ? "bg-gold/[0.06]" : "hover:bg-white/[0.04]"
                  )}
                >
                  <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                    {ws.is_primary ? (
                      <Crown className="w-3 h-3 text-gold" />
                    ) : (
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate leading-tight",
                        isActive ? "text-gold" : "text-foreground"
                      )}
                    >
                      {ws.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-data uppercase tracking-wide">
                      {ws.role}
                    </p>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-gold shrink-0" />}
                </button>
              );
            })}
          </div>

          {canManage && (
            <Link
              href="/settings/workspaces"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 border-t border-border text-sm text-muted-foreground hover:text-gold hover:bg-white/[0.04] transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Gerenciar workspaces
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
