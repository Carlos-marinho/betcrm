"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { WorkspaceRole, WorkspaceSummary } from "@/stores/workspace";

// ── /me ────────────────────────────────────────────────────────────────────

export interface WorkspaceMeResponse {
  is_super_admin: boolean;
  default_workspace_id: number | null;
  workspaces: WorkspaceSummary[];
}

export function useWorkspaceMe() {
  return useQuery<WorkspaceMeResponse>({
    queryKey: ["workspaces", "me"],
    queryFn: async () => {
      const { data } = await api.get("/workspaces/me/");
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Workspaces (gestão) ──────────────────────────────────────────────────────

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  is_primary: boolean;
  is_active: boolean;
  member_count: number;
  inherit_from_primary: boolean;
  created_at: string;
  updated_at: string;
}

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces", "list"],
    queryFn: async () => {
      const { data } = await api.get("/workspaces/");
      return data.results ?? data;
    },
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; slug?: string; inherit_from_primary?: boolean }) => {
      const { data } = await api.post("/workspaces/", payload);
      return data as Workspace;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; name?: string; is_active?: boolean }) => {
      const { data } = await api.patch(`/workspaces/${id}/`, payload);
      return data as Workspace;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/workspaces/${id}/`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

// ── Settings do workspace ────────────────────────────────────────────────────

export interface WorkspaceSettings {
  inherit_from_primary: boolean;
  ingest_api_key: string | null;
  ingest_api_key_created_at: string | null;
  ingest_api_key_last_used_at: string | null;
  webhook_url: string;
  webhook_events: string[];
  brand_name: string;
  logo_asset: number | null;
  public_site_url: string;
  deposit_url: string;
  support_url: string;
  unsubscribe_url: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  tracking_base_url: string;
  sms_link_tracking_enabled: boolean | null;
  email_daily_cap: number | null;
  sms_daily_cap: number | null;
  push_daily_cap: number | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  /** Valores efetivos em uso (herança do principal + fallback de env). Só no GET. */
  effective?: Record<string, string | number | boolean | null>;
}

export function useWorkspaceSettings(workspaceId: number | null) {
  return useQuery<WorkspaceSettings>({
    queryKey: ["workspaces", workspaceId, "settings"],
    enabled: workspaceId != null,
    queryFn: async () => {
      const { data } = await api.get(`/workspaces/${workspaceId}/settings/`);
      return data;
    },
  });
}

export function useUpdateWorkspaceSettings(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<WorkspaceSettings>) => {
      const { data } = await api.patch(`/workspaces/${workspaceId}/settings/`, payload);
      return data as WorkspaceSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "settings"] });
      qc.invalidateQueries({ queryKey: ["workspaces", "list"] });
    },
  });
}

export function useRotateIngestKey(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/workspaces/${workspaceId}/rotate-ingest-key/`);
      return data as { ingest_api_key: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "settings"] }),
  });
}

// ── Membros ──────────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  id: number;
  user: number;
  username: string;
  email: string;
  role: WorkspaceRole;
  is_default: boolean;
  created_at: string;
}

export function useWorkspaceMembers(workspaceId: number | null) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspaces", workspaceId, "members"],
    enabled: workspaceId != null,
    queryFn: async () => {
      const { data } = await api.get(`/workspaces/${workspaceId}/members/`);
      return data;
    },
  });
}

export function useAddMember(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user: number; role: WorkspaceRole }) => {
      const { data } = await api.post(`/workspaces/${workspaceId}/members/`, payload);
      return data as WorkspaceMember;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] }),
  });
}

export function useRemoveMember(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: number) => {
      await api.delete(`/workspaces/${workspaceId}/members/${membershipId}/`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] }),
  });
}

// ── Usuários (para atribuição) ───────────────────────────────────────────────

export interface AppUser {
  id: number;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
}

export function useAppUsers(enabled = true) {
  return useQuery<AppUser[]>({
    queryKey: ["workspaces", "users"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get("/workspaces/users/");
      return data;
    },
  });
}
