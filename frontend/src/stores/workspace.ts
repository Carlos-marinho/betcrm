import { create } from "zustand";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/auth";

export type WorkspaceRole = "admin" | "member" | "viewer";

export interface WorkspaceSummary {
  id: number;
  name: string;
  slug: string;
  is_primary: boolean;
  role: WorkspaceRole;
}

interface WorkspaceState {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: number | null;
  isSuperAdmin: boolean;
  loaded: boolean;
  setData: (data: {
    workspaces: WorkspaceSummary[];
    defaultWorkspaceId: number | null;
    isSuperAdmin: boolean;
  }) => void;
  setActive: (id: number) => void;
  reset: () => void;
}

function initialActiveId(): number | null {
  const stored = getActiveWorkspaceId();
  return stored ? Number(stored) : null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: initialActiveId(),
  isSuperAdmin: false,
  loaded: false,

  setData: ({ workspaces, defaultWorkspaceId, isSuperAdmin }) => {
    const current = get().activeWorkspaceId;
    // Mantém o workspace ativo salvo se ainda for acessível; senão usa o default.
    const stillValid = current != null && workspaces.some((w) => w.id === current);
    const active = stillValid ? current : defaultWorkspaceId;
    if (active != null) setActiveWorkspaceId(active);
    set({ workspaces, isSuperAdmin, activeWorkspaceId: active, loaded: true });
  },

  setActive: (id) => {
    setActiveWorkspaceId(id);
    set({ activeWorkspaceId: id });
  },

  reset: () => set({ workspaces: [], activeWorkspaceId: null, isSuperAdmin: false, loaded: false }),
}));

export function useActiveWorkspace(): WorkspaceSummary | null {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
}
