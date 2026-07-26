import { apiGet, apiPatch } from './client';
import type { InteractionSettings, ApiResult } from '../types/interaction';

const INTERACTION_CACHE_KEY = 'interaction-settings-cache';
const CACHE_TTL = 5 * 60 * 1000; 

interface CachedInteraction {
  data: InteractionSettings;
  ts: number;
}

function readLocalCache(): InteractionSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INTERACTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInteraction;
    if (!parsed.data || Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(INTERACTION_CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalCache(data: InteractionSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INTERACTION_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    
  }
}

function clearLocalCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INTERACTION_CACHE_KEY);
  } catch {
    
  }
}

const defaultSettings: InteractionSettings = {
  commentsEnabled: true,
  likesEnabled: true,
  commentAudit: true,
};

export async function getInteractionSettings() {
  const cached = readLocalCache();
  if (cached) {
    const merged = { ...defaultSettings, ...cached };
    writeLocalCache(merged);
    return { code: 0, data: merged, msg: 'ok' } as ApiResult<InteractionSettings>;
  }

  const res = await apiGet<InteractionSettings>('/api/v1/settings/interaction');
  if (res.code === 0 && res.data) {
    const merged = { ...defaultSettings, ...res.data };
    writeLocalCache(merged);
    return { ...res, data: merged };
  }
  return res;
}

export async function updateInteractionSettings(data: InteractionSettings) {
  const normalized = {
    commentsEnabled: data.commentsEnabled !== false,
    likesEnabled: data.likesEnabled !== false,
    commentAudit: data.commentAudit === true,
  };
  const res = await apiPatch<InteractionSettings>('/api/v1/admin/settings/interaction', normalized);
  if (res.code === 0) {
    const merged = { ...defaultSettings, ...normalized, ...(res.data || {}) };
    writeLocalCache(merged);
    return { ...res, data: merged };
  } else {
    clearLocalCache();
  }
  return res;
}
