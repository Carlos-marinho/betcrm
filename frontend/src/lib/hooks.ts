"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  window_hours: number;
  profiles: { total: number; new: number; ftd: number };
  messages: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    open_rate: number;
    click_rate: number;
  };
  flows: { active: number; executions_active: number };
}

export function useAnalyticsOverview(hours = 24) {
  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview", hours],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/overview?hours=${hours}`);
      return data;
    },
    refetchInterval: 30_000,
  });
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export interface ProfileListItem {
  id: number;
  external_id: string;
  email: string;
  first_name: string;
  ltv: string;
  ftd_at: string | null;
  last_event_at: string | null;
  tags: string[];
  profile_type: "player" | "affiliate";
  is_active: boolean;
  is_verified: boolean;
}

export interface Profile extends ProfileListItem {
  phone: string;
  last_name: string;
  country: string;
  state: string;
  city: string;
  total_deposits: string;
  total_withdrawals: string;
  deposit_count: number;
  withdrawal_count: number;
  last_deposit_at: string | null;
  last_login_at: string | null;
  registered_at: string | null;
  favorite_game: string;
  ngr: string;
  consent_email: boolean;
  consent_sms: boolean;
  consent_push: boolean;
  consent_whatsapp: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProfileFilters {
  search?: string;
  page?: number;
  ordering?: string;
  has_ftd?: "true" | "false" | "";
  is_active?: "true" | "false" | "";
  profile_type?: "player" | "affiliate" | "";
  ltv_min?: string;
  ltv_max?: string;
}

export function useProfiles(params?: ProfileFilters) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page && params.page > 1) searchParams.set("page", String(params.page));
  if (params?.ordering) searchParams.set("ordering", params.ordering);
  if (params?.has_ftd) searchParams.set("has_ftd", params.has_ftd);
  if (params?.is_active) searchParams.set("is_active", params.is_active);
  if (params?.profile_type) searchParams.set("profile_type", params.profile_type);
  if (params?.ltv_min) searchParams.set("ltv_min", params.ltv_min);
  if (params?.ltv_max) searchParams.set("ltv_max", params.ltv_max);
  const qs = searchParams.toString();

  return useQuery<PaginatedResponse<ProfileListItem>>({
    queryKey: ["profiles", qs],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${qs ? `?${qs}` : ""}`);
      return data;
    },
  });
}

export function useProfile(id: number) {
  return useQuery<Profile>({
    queryKey: ["profiles", id],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Flows ─────────────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  recurrence: "once" | "daily" | "weekly" | "monthly";
  start_at?: string;
  end_at?: string;
  time?: string;
  days_of_week?: number[];
  day_of_month?: number;
  timezone: string;
  audience: "all" | "segment";
  segment_code?: string;
  send_rate_per_minute?: number;
}

export interface Flow {
  id: number;
  name: string;
  code: string;
  description: string;
  trigger_type: "event" | "segment_entry" | "scheduled";
  trigger_config: Record<string, unknown>;
  schedule_config: Partial<ScheduleConfig>;
  last_scheduled_run_at: string | null;
  is_active: boolean;
  allow_reentry: boolean;
  reentry_cooldown_days: number;
  goal_event_code: string;
  definition: { nodes: unknown[] };
  total_enrolled: number;
  total_completed: number;
  total_goal_reached: number;
  created_at: string;
  updated_at: string;
}

export function useFlows() {
  return useQuery<PaginatedResponse<Flow>>({
    queryKey: ["flows"],
    queryFn: async () => {
      const { data } = await api.get("/flows/");
      return data;
    },
  });
}

export function useFlow(id: number | null) {
  return useQuery<Flow>({
    queryKey: ["flows", id],
    queryFn: async () => {
      const { data } = await api.get(`/flows/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useToggleFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activate }: { id: number; activate: boolean }) => {
      const { data } = await api.post(`/flows/${id}/${activate ? "activate" : "deactivate"}/`);
      return data as Flow;
    },
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      queryClient.invalidateQueries({ queryKey: ["flows", flow.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

// ── Segments ──────────────────────────────────────────────────────────────────

export interface Segment {
  id: number;
  name: string;
  code: string;
  description: string;
  rules: unknown;
  is_active: boolean;
  member_count: number;
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSegments(params?: { search?: string; is_active?: "true" | "false" | "" }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.is_active) qs.set("is_active", params.is_active);
  const qsStr = qs.toString();

  return useQuery<PaginatedResponse<Segment>>({
    queryKey: ["segments", qsStr],
    queryFn: async () => {
      const { data } = await api.get(`/segments/${qsStr ? `?${qsStr}` : ""}`);
      return data;
    },
  });
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface EmailAsset {
  id: number;
  name: string;
  folder: string;
  file: string;
  file_url: string;
  asset_type: "banner" | "footer_logo" | "logo" | "general";
  alt_text: string;
  is_global_footer: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  code: string;
  name: string;
  channel: "email" | "sms" | "push" | "whatsapp";
  category: string;
  subject: string;
  body_html: string;
  body_text: string;
  banner_asset: number | null;
  banner_asset_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTemplates(channel?: string) {
  const qs = channel ? `?channel=${channel}` : "";
  return useQuery<PaginatedResponse<MessageTemplate>>({
    queryKey: ["templates", channel],
    queryFn: async () => {
      const { data } = await api.get(`/templates/${qs}`);
      return data;
    },
  });
}

// ── Flow Executions ───────────────────────────────────────────────────────────

export interface FlowExecution {
  id: number;
  flow: number;
  flow_code: string;
  profile: number;
  profile_external_id: string;
  state: "active" | "completed" | "goal_reached" | "exited" | "failed";
  current_node_id: string | null;
  next_run_at: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface FlowScheduleRun {
  id: number;
  flow: number;
  run_at: string;
  status: "running" | "completed" | "failed";
  enrolled_count: number;
  error_message: string;
}

export function useFlowScheduleRuns(flowId: number) {
  return useQuery<FlowScheduleRun[]>({
    queryKey: ["flows", flowId, "schedule_runs"],
    queryFn: async () => {
      const { data } = await api.get(`/flows/${flowId}/schedule_runs/`);
      return data;
    },
    enabled: !!flowId,
  });
}

export function useFlowExecutions(params?: { state?: string; flow?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.state) searchParams.set("state", params.state);
  if (params?.flow) searchParams.set("flow", String(params.flow));
  const qs = searchParams.toString();

  return useQuery<PaginatedResponse<FlowExecution>>({
    queryKey: ["executions", qs],
    queryFn: async () => {
      const { data } = await api.get(`/flows/executions/${qs ? `?${qs}` : ""}`);
      return data;
    },
    refetchInterval: 15_000,
  });
}

// ── Segment mutations ─────────────────────────────────────────────────────────

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Segment>) => {
      const { data } = await api.post("/segments/", payload);
      return data as Segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Segment> & { id: number }) => {
      const { data } = await api.patch(`/segments/${id}/`, payload);
      return data as Segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/segments/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
    },
  });
}

// ── Flow mutations ────────────────────────────────────────────────────────────

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Flow>) => {
      const { data } = await api.post("/flows/", payload);
      return data as Flow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Flow> & { id: number }) => {
      const { data } = await api.patch(`/flows/${id}/`, payload);
      return data as Flow;
    },
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      queryClient.invalidateQueries({ queryKey: ["flows", flow.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

// ── Template mutations ────────────────────────────────────────────────────────

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MessageTemplate>) => {
      const { data } = await api.post("/templates/", payload);
      return data as MessageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MessageTemplate> & { id: number }) => {
      const { data } = await api.patch(`/templates/${id}/`, payload);
      return data as MessageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

// ── Email Assets ──────────────────────────────────────────────────────────────

export function useAssets(params?: { asset_type?: string; folder?: string }) {
  const qs = new URLSearchParams();
  if (params?.asset_type) qs.set("asset_type", params.asset_type);
  if (params?.folder) qs.set("folder", params.folder);
  const q = qs.toString();

  return useQuery<PaginatedResponse<EmailAsset>>({
    queryKey: ["assets", q],
    queryFn: async () => {
      const { data } = await api.get(`/templates/assets/${q ? `?${q}` : ""}`);
      return data;
    },
  });
}

export function useAssetFolders() {
  return useQuery<string[]>({
    queryKey: ["assets", "folders"],
    queryFn: async () => {
      const { data } = await api.get("/templates/assets/folders/");
      return data;
    },
  });
}

export function useUploadAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/templates/assets/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data as EmailAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/assets/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useSetGlobalFooterAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/templates/assets/${id}/set_global_footer/`);
      return data as EmailAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

// ── Message log ───────────────────────────────────────────────────────────────

export interface MessageLog {
  id: number;
  profile: number;
  profile_external_id: string;
  template: number | null;
  template_code: string | null;
  channel: "email" | "sms" | "push" | "whatsapp";
  status: "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed" | "complained" | "unsubscribed" | "rejected";
  subject: string | null;
  body_preview: string;
  recipient: string;
  provider_name: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
}

export interface MessagingStats {
  sent_today: number;
  delivered_today: number;
  opened_today: number;
  clicked_today: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  period_days: number;
}

export function useMessagingStats(params?: { channel?: string; days?: number }) {
  const channel = params?.channel;
  const days = params?.days ?? 7;

  return useQuery<MessagingStats>({
    queryKey: ["messaging-stats", channel ?? "", days],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (channel) qs.set("channel", channel);
      qs.set("days", String(days));
      const { data } = await api.get(`/messaging/stats/?${qs.toString()}`);
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useMessageLogs(params?: { channel?: string; status?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.channel) searchParams.set("channel", params.channel);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", String(params.page));
  const qs = searchParams.toString();

  return useQuery<PaginatedResponse<MessageLog>>({
    queryKey: ["messages", qs],
    queryFn: async () => {
      const { data } = await api.get(`/messaging/logs/${qs ? `?${qs}` : ""}`);
      return data;
    },
    refetchInterval: 30_000,
  });
}

// ── Profile timeline ──────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: number;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface TimelineMessage {
  id: number;
  channel: string;
  template: string | null;
  status: string;
  sent_at: string | null;
  created_at?: string | null;
  opened_at: string | null;
  clicked_at: string | null;
}

export interface TimelineActivity {
  id: number;
  kind: "tag_change" | "flow_entry" | "flow_exit";
  occurred_at: string;
  data: {
    // tag_change
    added?: string[];
    removed?: string[];
    // flow_entry / flow_exit
    flow_code?: string;
    flow_name?: string;
    trigger?: string;
    state?: string;
    duration_hours?: number;
  };
}

export interface ProfileTimeline {
  events: TimelineEvent[];
  messages: TimelineMessage[];
  activities: TimelineActivity[];
}

export function useProfileTimeline(id: number) {
  return useQuery<ProfileTimeline>({
    queryKey: ["profiles", id, "timeline"],
    queryFn: async () => {
      const { data } = await api.get(`/profiles/${id}/timeline/`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Template preview ──────────────────────────────────────────────────────────

export interface TemplatePreviewResult {
  subject?: string;
  html?: string;
  text?: string;
  body?: string;
  from?: string;
}

export function useTemplatePreview() {
  return useMutation({
    mutationFn: async ({
      id,
      profile_external_id,
      extra_context,
    }: {
      id: number;
      profile_external_id?: string;
      extra_context?: Record<string, unknown>;
    }) => {
      const { data } = await api.post(`/templates/${id}/preview/`, {
        profile_external_id,
        extra_context,
      });
      return data as TemplatePreviewResult;
    },
  });
}

// ── Segment members ───────────────────────────────────────────────────────────

export function useSegmentMembers(id: number | null, limit = 20) {
  return useQuery<{ count_preview: number; results: ProfileListItem[] }>({
    queryKey: ["segments", id, "members", limit],
    queryFn: async () => {
      const { data } = await api.get(`/segments/${id}/members/?limit=${limit}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useSegmentPreviewCount() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/segments/${id}/preview_count/`);
      return data as { count: number };
    },
  });
}

// ── A/B Tests ─────────────────────────────────────────────────────────────────

export interface AbTestVariant {
  id: number;
  ab_test: number;
  template: number;
  template_code: string;
  weight: number;
  label: string;
  impressions: number;
  conversions: number;
}

export interface AbTest {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  goal_metric: "opened" | "clicked" | "converted";
  variants: AbTestVariant[];
  started_at: string | null;
  ended_at: string | null;
  winner: number | null;
  created_at: string;
  updated_at: string;
}

export function useAbTests() {
  return useQuery<PaginatedResponse<AbTest>>({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      const { data } = await api.get("/templates/ab-tests/");
      return data;
    },
  });
}

export function useCreateAbTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AbTest>) => {
      const { data } = await api.post("/templates/ab-tests/", payload);
      return data as AbTest;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ab-tests"] }),
  });
}

export function useUpdateAbTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<AbTest> & { id: number }) => {
      const { data } = await api.patch(`/templates/ab-tests/${id}/`, payload);
      return data as AbTest;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ab-tests"] }),
  });
}

export function useDeleteAbTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/ab-tests/${id}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ab-tests"] }),
  });
}

// ── Provider configs ──────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: number;
  name: string;
  channel: "email" | "sms" | "push" | "whatsapp";
  channel_display: string;
  provider_class: string;
  provider_class_display: string;
  config: Record<string, unknown>;
  is_active: boolean;
  is_primary: boolean;
  priority: number;
  daily_quota: number | null;
  monthly_quota: number | null;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SendMessagePayload {
  profile_id: number;
  channel: "email" | "sms" | "push" | "whatsapp";
  template_code: string;
  context?: Record<string, unknown>;
  from_email?: string;
  from_name?: string;
  bypass_quiet_hours?: boolean;
  bypass_frequency_cap?: boolean;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      const { data } = await api.post("/messaging/send/", payload);
      return data as { status: string; message_id?: string; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useProviders(channel?: string) {
  const qs = channel ? `?channel=${channel}` : "";
  return useQuery<PaginatedResponse<ProviderConfig>>({
    queryKey: ["providers", channel],
    queryFn: async () => {
      const { data } = await api.get(`/messaging/providers/${qs}`);
      return data;
    },
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ProviderConfig>) => {
      const { data } = await api.post("/messaging/providers/", payload);
      return data as ProviderConfig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ProviderConfig> & { id: number }) => {
      const { data } = await api.patch(`/messaging/providers/${id}/`, payload);
      return data as ProviderConfig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/messaging/providers/${id}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

// ── LGPD / Compliance ─────────────────────────────────────────────────────────

export interface DataRequest {
  id: number;
  profile_external_id: string;
  request_type: "export" | "delete" | "anonymize";
  request_type_display: string;
  status: "pending" | "processing" | "completed" | "failed";
  status_display: string;
  requested_via: string;
  notes: string;
  completed_at: string | null;
  created_at: string;
}

export function useDataRequests() {
  return useQuery<PaginatedResponse<DataRequest>>({
    queryKey: ["data-requests"],
    queryFn: async () => {
      const { data } = await api.get("/compliance/data-requests/");
      return data;
    },
  });
}

export function useCreateDataRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      external_id: string;
      request_type: string;
      notes?: string;
      source?: string;
    }) => {
      const { data } = await api.post("/compliance/data-request", payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["data-requests"] }),
  });
}

// ── Recent Events (live feed) ─────────────────────────────────────────────────

export interface RecentEvent {
  id: number;
  event_type_code: string;
  user_external_id: string;
  occurred_at: string;
  amount: number | null;
}

export interface EventProfile {
  id: number;
  external_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  ltv: string;
  total_deposits: string;
  deposit_count: number;
  is_active: boolean;
  is_verified: boolean;
  ftd_at: string | null;
  last_login_at: string | null;
}

export interface EventDetail {
  id: number;
  event_type: number;
  event_type_code: string;
  event_type_name: string;
  event_type_category: string;
  event_type_priority: string;
  external_event_id: string;
  user_external_id: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  received_at: string;
  processed: boolean;
  processed_at: string | null;
  processing_attempts: number;
  last_error: string;
  profile: EventProfile | null;
}

export function useEventDetail(id: number | null) {
  return useQuery<EventDetail>({
    queryKey: ["events", "detail", id],
    queryFn: async () => {
      const { data } = await api.get(`/events/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useRecentEvents(params?: {
  limit?: number;
  hours?: number;
  paused?: boolean;
  event_type?: string;
  user_external_id?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.hours) qs.set("hours", String(params.hours));
  if (params?.event_type) qs.set("event_type", params.event_type);
  if (params?.user_external_id) qs.set("user_external_id", params.user_external_id);

  return useQuery<{ count: number; results: RecentEvent[] }>({
    queryKey: ["events", "recent", params?.hours ?? 1, params?.limit ?? 50, params?.event_type ?? "", params?.user_external_id ?? ""],
    queryFn: async () => {
      const { data } = await api.get(`/events/recent/?${qs}`);
      return data;
    },
    refetchInterval: params?.paused ? false : 5_000,
  });
}

// ── Analytics Trend ───────────────────────────────────────────────────────────

export interface TrendDataPoint {
  date: string;
  day: string;
  email: number;
  sms: number;
  push: number;
  whatsapp: number;
}

export function useAnalyticsTrend(days = 7) {
  return useQuery<{ days: number; trend: TrendDataPoint[] }>({
    queryKey: ["analytics", "trend", days],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/trend?days=${days}`);
      return data;
    },
    refetchInterval: 60_000,
  });
}

// ── System Settings ───────────────────────────────────────────────────────────

export interface SystemSettings {
  ingest_api_key: string | null;
  ingest_api_key_created_at: string | null;
  ingest_api_key_last_used_at: string | null;
  webhook_url: string;
  webhook_events: string[];
}

export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await api.get("/settings/");
      return data;
    },
  });
}

export function useRotateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/settings/rotate-key/");
      return data as { ingest_api_key: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSaveWebhookConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { webhook_url?: string; webhook_events?: string[] }) => {
      const { data } = await api.put("/settings/webhook/", payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ── Campaign Coupons ──────────────────────────────────────────────────────────

export interface CampaignCoupon {
  id: number;
  key: string;
  code: string;
  description: string;
  flow_code: string;
  is_active: boolean;
  is_valid: boolean;
  has_been_sent: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponPayload {
  key: string;
  code: string;
  description?: string;
  flow_code?: string;
  is_active?: boolean;
  expires_at?: string | null;
}

export function useCoupons() {
  return useQuery<CampaignCoupon[]>({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data } = await api.get("/templates/coupons/");
      return data.results ?? data;
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CouponPayload) => {
      const { data } = await api.post("/templates/coupons/", payload);
      return data as CampaignCoupon;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CouponPayload & { id: number }) => {
      const { data } = await api.patch(`/templates/coupons/${id}/`, payload);
      return data as CampaignCoupon;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/templates/coupons/${id}/`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useToggleCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { data } = await api.patch(`/templates/coupons/${id}/`, { is_active });
      return data as CampaignCoupon;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}
