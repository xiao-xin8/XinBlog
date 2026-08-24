import { apiGet, apiPost, apiDelete, apiPatch } from './client';
import type { CommentListResponse, AdminCommentListResponse } from '../types/interaction';

export function getComments(slug: string, page = 1, limit = 20) {
  return apiGet<CommentListResponse>(
    `/api/v1/posts/${encodeURIComponent(slug)}/comments?page=${page}&limit=${limit}`
  );
}

export function createComment(slug: string, content: string, parentId?: number | null) {
  return apiPost<{ id: number | null; status: string; notifyErrors?: string[] }>(
    `/api/v1/posts/${encodeURIComponent(slug)}/comments`,
    { content, parentId }
  );
}

export function deleteComment(slug: string, commentId: number) {
  return apiDelete(`/api/v1/posts/${encodeURIComponent(slug)}/comments/${commentId}`);
}

export function getAdminComments(status?: string, page = 1, limit = 20) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', String(page));
  params.append('limit', String(limit));
  return apiGet<AdminCommentListResponse>(`/api/v1/admin/comments?${params.toString()}`);
}

export function updateAdminComment(id: number, data: { status?: string; content?: string }) {
  return apiPatch(`/api/v1/admin/comments/${id}`, data);
}

export function updateAdminCommentsBatch(ids: number[], status: string) {
  return apiPatch('/api/v1/admin/comments/batch', { ids, status });
}

export function deleteAdminComment(id: number) {
  return apiDelete(`/api/v1/admin/comments/${id}`);
}
