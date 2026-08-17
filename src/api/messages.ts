import { apiGet, apiPost, apiDelete, apiPatch } from './client';
import type { MessageListResponse, MessageWallSettings, ApiResult } from '../types/interaction';

const MESSAGE_WALL_CACHE_KEY = 'message-wall-settings-cache';
const CACHE_TTL = 5 * 60 * 1000;

interface CachedSettings {
  data: MessageWallSettings;
  ts: number;
}

function readLocalCache(): MessageWallSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MESSAGE_WALL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSettings;
    if (!parsed.data || Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(MESSAGE_WALL_CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalCache(data: MessageWallSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MESSAGE_WALL_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore
  }
}

function clearLocalCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MESSAGE_WALL_CACHE_KEY);
  } catch {
    // ignore
  }
}

const defaultSettings: MessageWallSettings = {
  enabled: false,
  allowAnonymous: true,
  auditEnabled: false,
  defaultStyle: 'danmaku',
};

export async function getMessageWallSettings() {
  const cached = readLocalCache();
  if (cached) {
    const merged = { ...defaultSettings, ...cached };
    writeLocalCache(merged);
    return { code: 0, data: merged, msg: 'ok' } as ApiResult<MessageWallSettings>;
  }

  const res = await apiGet<MessageWallSettings>('/api/v1/settings/message-wall');
  if (res.code === 0 && res.data) {
    const merged = { ...defaultSettings, ...res.data };
    writeLocalCache(merged);
    return { ...res, data: merged };
  }
  return res;
}

export async function updateMessageWallSettings(data: MessageWallSettings) {
  const normalized = {
    enabled: data.enabled !== false,
    allowAnonymous: data.allowAnonymous !== false,
    auditEnabled: data.auditEnabled === true,
    defaultStyle: data.defaultStyle || 'danmaku',
  };
  const res = await apiPatch<MessageWallSettings>('/api/v1/admin/settings/message-wall', normalized);
  if (res.code === 0) {
    const merged = { ...defaultSettings, ...normalized, ...(res.data || {}) };
    writeLocalCache(merged);
    return { ...res, data: merged };
  } else {
    clearLocalCache();
  }
  return res;
}

export function getMessages(page = 1, limit = 20) {
  return apiGet<MessageListResponse>(`/api/v1/messages?page=${page}&limit=${limit}`);
}

export function getMyMessages() {
  return apiGet<MessageListResponse>('/api/v1/messages/my');
}

export function createMessage(content: string, nickname?: string) {
  return apiPost<{ id: number | null; status: string }>('/api/v1/messages', { content, nickname });
}

export function deleteMessage(id: number) {
  return apiDelete(`/api/v1/messages/${id}`);
}

export function getAdminMessages(status?: string, page = 1, limit = 20) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', String(page));
  params.append('limit', String(limit));
  return apiGet<MessageListResponse>(`/api/v1/admin/messages?${params.toString()}`);
}

export function updateAdminMessage(id: number, data: { status?: string }) {
  return apiPatch(`/api/v1/admin/messages/${id}`, data);
}

export function updateAdminMessagesBatch(ids: number[], status: string) {
  return apiPatch('/api/v1/admin/messages/batch', { ids, status });
}

export function deleteAdminMessage(id: number) {
  return apiDelete(`/api/v1/admin/messages/${id}`);
}