"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Crown,
  Users,
  Plus,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Link2,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaces, useCreateWorkspace } from "@/lib/workspace-hooks";
import { useWorkspaceStore } from "@/stores/workspace";
import { toast } from "sonner";

export default function WorkspacesPage() {
  const router = useRouter();
  const { data: workspaces, isLoading } = useWorkspaces();
  const { isSuperAdmin } = useWorkspaceStore();
  const create = useCreateWorkspace();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inherit, setInherit] = useState(true);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const ws = await create.mutateAsync({ name: name.trim(), inherit_from_primary: inherit });
      toast.success(`Workspace "${ws.name}" criado.`);
      setOpen(false);
      setName("");
      router.push(`/settings/workspaces/${ws.id}`);
    } catch {
      toast.error("Não foi possível criar o workspace.");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Configurações
          </Link>
          <h1 className="font-display font-bold text-2xl">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ambientes isolados — leads, envios e configurações próprias por cliente.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold text-background font-medium text-sm hover:bg-gold/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo workspace
          </button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(workspaces ?? []).map((ws) => (
            <Link
              key={ws.id}
              href={`/settings/workspaces/${ws.id}`}
              className="group relative rounded-xl border border-border bg-card p-5 hover:border-gold/30 transition-all duration-150"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                  {ws.is_primary ? (
                    <Crown className="w-5 h-5 text-gold" />
                  ) : (
                    <Building2 className="w-5 h-5 text-gold" />
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">{ws.name}</h3>
                {ws.is_primary && <span className="badge-gold">principal</span>}
                {!ws.is_active && <span className="badge-muted">inativo</span>}
              </div>
              <p className="text-xs text-muted-foreground/70 font-data mb-4">/{ws.slug}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {ws.member_count} {ws.member_count === 1 ? "membro" : "membros"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {ws.is_primary ? (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      fonte
                    </>
                  ) : ws.inherit_from_primary ? (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      herda config
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      config própria
                    </>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Dialog criar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo workspace</DialogTitle>
            <DialogDescription>
              Crie um ambiente isolado. Por padrão, herda toda a configuração do
              workspace principal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Nome</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cassino Aurora"
                autoFocus
              />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-white/[0.02] cursor-pointer">
              <input
                type="checkbox"
                checked={inherit}
                onChange={(e) => setInherit(e.target.checked)}
                className="mt-0.5 accent-[hsl(var(--gold))]"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Herdar do principal</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Usa providers, domínio, branding e limites do workspace principal.
                  Você pode desativar isso depois para configurar tudo próprio.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || create.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold text-background font-medium text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar workspace
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
