import { getToken } from '@/utils/token';
import type { AuthUser } from '@/stores/authStore';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface ApiResult<T = unknown> {
  code: number;
  data: T;
  msg: string;
}



interface CacheEntry<T> {
  data: ApiResult<T>;
  ts: number;
  promise?: Promise<ApiResult<T>>;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();


const CACHE_TTL: Record<string, number> = {
  '/api/v1/site': 3 * 60 * 60 * 1000, // 站点配置 3 小时
  '/api/v1/tags': 60 * 60 * 1000, // 标签列表 1 小时
  '/api/v1/posts': 30 * 60 * 1000, // 文章列表 30 分钟
  '/api/v1/user/settings': 30 * 60 * 1000, // 用户设置 30 分钟
  '/api/v1/settings/interaction': 0, // 互动开关由业务层自行缓存，不走内存缓存
  '/api/v1/admin/posts': 10 * 60 * 1000, // 管理后台文章列表 10 分钟
  '/api/v1/admin/tags': 10 * 60 * 1000, // 管理后台标签列表 10 分钟
  '/api/v1/admin/media': 5 * 60 * 1000, // 管理后台媒体列表 5 分钟
  '/api/v1/admin/dashboard': 5 * 60 * 1000, // 仪表盘 5 分钟
};

const DEFAULT_TTL = 5 * 60 * 1000; 

function getCacheKey(method: string, path: string): string {
  return `${method}:${path}`;
}

function getCacheTtl(path: string): number {
  const cleanPath = path.split('?')[0];
  
  if (
    cleanPath.includes('/comments') ||
    cleanPath.includes('/likes') ||
    cleanPath.startsWith('/api/v1/messages')
  )
    return 0;
  for (const prefix of Object.keys(CACHE_TTL)) {
    if (cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) return CACHE_TTL[prefix];
  }
  return DEFAULT_TTL;
}

function readCache<T>(key: string, ttl: number): ApiResult<T> | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.promise) return null;
  if (Date.now() - entry.ts > ttl) return null;
  return entry.data;
}

function stripQuery(path: string): string {
  return path.split('?')[0];
}

function invalidateRelatedCaches(path: string) {
  const base = stripQuery(path);
  
  const segments = base.split('/').filter(Boolean);
  const resourcePrefix = '/' + segments.slice(0, 4).join('/'); 

  const related: string[] = [resourcePrefix];
  if (resourcePrefix.startsWith('/api/v1/admin/posts')) {
    related.push('/api/v1/posts');
  } else if (resourcePrefix.startsWith('/api/v1/admin/tags')) {
    related.push('/api/v1/tags');
  } else if (base === '/api/v1/admin/settings/interaction') {
    related.push('/api/v1/settings/interaction');
  } else if (base.startsWith('/api/v1/admin/settings/')) {
    
    const settingKey = base.replace('/api/v1/admin/settings/', '');
    related.push(`/api/v1/settings/${settingKey}`);
  } else if (resourcePrefix.startsWith('/api/v1/admin/friends')) {
    related.push('/api/v1/friends');
  } else if (resourcePrefix.startsWith('/api/v1/admin/media')) {
    related.push('/api/v1/media');
  } else if (resourcePrefix.startsWith('/api/v1/admin/themes')) {
    related.push('/api/v1/site');
  }

  for (const key of memoryCache.keys()) {
    for (const prefix of related) {
      if (key.includes(prefix)) {
        memoryCache.delete(key);
        break;
      }
    }
  }
}

interface CustomRequestInit extends RequestInit {
  _retry?: boolean;
}

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('auth-state');
    if (!raw) return false;
    const persisted = JSON.parse(raw);
    const refreshToken = persisted?.state?.refreshToken;
    if (!refreshToken) return false;

    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = (await res.json()) as { code: number; data?: { accessToken: string; refreshToken: string; user: AuthUser }; msg?: string };
    if (data.code !== 0 || !data.data) {
      
      const { useAuthStore } = await import('@/stores/authStore');
      useAuthStore.getState().logout();
      return false;
    }

    const { accessToken, refreshToken: newRefreshToken, user } = data.data;
    const newState = { state: { isAuthenticated: true, user, token: accessToken, refreshToken: newRefreshToken }, version: 0 };
    localStorage.setItem('auth-state', JSON.stringify(newState));
    localStorage.setItem(
      'auth-state-sync',
      JSON.stringify({ isAuthenticated: true, user, token: accessToken, refreshToken: newRefreshToken })
    );
    
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.getState().setAuth(accessToken, newRefreshToken, user as AuthUser);
    return true;
  } catch {
    return false;
  }
}

async function fetchInternal<T = unknown>(path: string, options: RequestInit): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (options.headers) {
    const extra = options.headers as Record<string, string>;
    Object.assign(headers, extra);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    let data: ApiResult<T>;
    try {
      data = (await res.json()) as ApiResult<T>;
    } catch {
      data = { code: res.status || 500, data: null as T, msg: `请求失败，HTTP ${res.status}` };
    }

    if (!res.ok && data.code === 0) {
      data.code = res.status;
    }
    return data;
  } catch (err) {
    return { code: 500, data: null as T, msg: err instanceof Error ? err.message : '网络请求异常' };
  }
}

export function peekCache<T = unknown>(path: string): { data: T | null; hit: boolean } {
  const key = getCacheKey('GET', path);
  const ttl = getCacheTtl(path);
  const cached = readCache<T>(key, ttl);
  if (cached && cached.code === 0) {
    return { data: cached.data, hit: true };
  }
  return { data: null, hit: false };
}

export async function apiFetch<T = unknown>(path: string, options: CustomRequestInit = {}): Promise<ApiResult<T>> {
  const method = options.method || 'GET';
  const isRetry = options._retry === true;
  const key = getCacheKey(method, path);
  const ttl = getCacheTtl(path);

  
  if (method !== 'GET') {
    const result = await fetchInternal<T>(path, options);
    if (result.code === 401 && !isRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(path, { ...options, _retry: true });
      }
    }
    if (result.code === 0) {
      invalidateRelatedCaches(path);
    }
    return result;
  }

  
  const cached = readCache<T>(key, ttl);
  if (cached) {
    return cached;
  }

  
  const entry = memoryCache.get(key);
  if (entry?.promise) {
    return entry.promise as Promise<ApiResult<T>>;
  }

  
  const promise = fetchInternal<T>(path, options);
  memoryCache.set(key, { data: { code: 0, data: null as T, msg: '' }, ts: Date.now(), promise });

  const result = await promise;
  if (result.code === 401 && !isRetry) {
    memoryCache.delete(key);
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retry: true });
    }
  }

  
  if (result.code !== 0) {
    memoryCache.delete(key);
  } else {
    memoryCache.set(key, { data: result, ts: Date.now() });
  }
  return result;
}

export async function apiGet<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: 'GET' });
}

export async function apiPost<T = unknown>(path: string, body: unknown, options: Omit<RequestInit, 'method' | 'body'> = {}) {
  return apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) });
}

export async function apiPatch<T = unknown>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function apiDelete<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' });
}
