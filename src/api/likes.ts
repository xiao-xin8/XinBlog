import { apiGet, apiPost, apiDelete } from './client';
import type { LikeStatus } from '../types/interaction';

export function getLikes(slug: string) {
  return apiGet<LikeStatus>(`/api/v1/posts/${encodeURIComponent(slug)}/likes`);
}

export function createLike(slug: string) {
  return apiPost(`/api/v1/posts/${encodeURIComponent(slug)}/likes`, {});
}

export function deleteLike(slug: string) {
  return apiDelete(`/api/v1/posts/${encodeURIComponent(slug)}/likes`);
}
