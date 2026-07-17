'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityDto,
  CampaignDto,
  CampaignGroupDto,
  ClubDto,
  ClubStatus,
  CreateCampaignInput,
  CreateGroupInput,
  EmailTemplateInput,
  FunnelAnalytics,
  JobDto,
  MembershipDto,
  UpdateGroupInput,
} from '@courtreach/shared';
import { apiFetch } from './api';

export interface CampaignGroupWithIds extends CampaignGroupDto {
  campaignIds: string[];
}

/* Campaigns */

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch<CampaignDto[]>('/campaigns'),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => apiFetch<CampaignDto>(`/campaigns/${id}`),
    refetchInterval: 5000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      apiFetch<CampaignDto>('/campaigns', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

/* Campaign Groups */

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<CampaignGroupWithIds[]>('/groups'),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) =>
      apiFetch<CampaignGroupWithIds>('/groups', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateGroupInput) =>
      apiFetch<CampaignGroupWithIds>(`/groups/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useSetGroupCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, campaignIds }: { groupId: string; campaignIds: string[] }) =>
      apiFetch<CampaignGroupWithIds>(`/groups/${groupId}/campaigns`, {
        method: 'PUT',
        body: { campaignIds },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useCampaignClubs(id: string, status?: string) {
  return useQuery({
    queryKey: ['campaign-clubs', id, status ?? 'all'],
    queryFn: () =>
      apiFetch<ClubDto[]>(`/campaigns/${id}/clubs${status ? `?status=${status}` : ''}`),
    refetchInterval: 5000,
  });
}

export function useCampaignJobs(id: string) {
  return useQuery({
    queryKey: ['campaign-jobs', id],
    queryFn: () => apiFetch<JobDto[]>(`/campaigns/${id}/jobs`),
    refetchInterval: 3000,
  });
}

export function useAnalytics(id: string) {
  return useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: () => apiFetch<FunnelAnalytics>(`/campaigns/${id}/analytics`),
    refetchInterval: 5000,
  });
}

export function useCampaignAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'discover' | 'verify' | 'send') =>
      apiFetch<JobDto>(`/campaigns/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-jobs', id] });
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

export function useCancelJob(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      apiFetch(`/campaigns/${campaignId}/jobs/${jobId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-jobs', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}

/* Clubs */

export function useClub(id: string) {
  return useQuery({
    queryKey: ['club', id],
    queryFn: () => apiFetch<ClubDto>(`/clubs/${id}`),
  });
}

export function useReviewClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, decision }: { clubId: string; decision: 'APPROVE_SEND' | 'SKIP' }) =>
      apiFetch(`/clubs/${clubId}/review`, { method: 'POST', body: { decision } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-clubs'] }),
  });
}

export function useUpdateClubStatus(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, status }: { clubId: string; status: ClubStatus }) =>
      apiFetch<ClubDto>(`/clubs/${clubId}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-clubs', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}

export function useImportClubs(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      apiFetch<{ imported: number }>(`/campaigns/${campaignId}/clubs/import`, {
        method: 'POST',
        body: { csv },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-clubs', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}

export function useSaveDraft(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject: string; body: string }) =>
      apiFetch(`/clubs/${clubId}/draft`, { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club', clubId] }),
  });
}

/* Activity & team & settings */

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () => apiFetch<ActivityDto[]>('/activity'),
    refetchInterval: 8000,
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<MembershipDto[]>('/team/members'),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }) =>
      apiFetch<{ token: string }>('/team/invites', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  });
}

export function useTemplate() {
  return useQuery({
    queryKey: ['template'],
    queryFn: () => apiFetch<EmailTemplateInput>('/settings/template'),
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmailTemplateInput) =>
      apiFetch('/settings/template', { method: 'PUT', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template'] }),
  });
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiFetch<Record<string, boolean>>('/settings/integrations'),
  });
}
