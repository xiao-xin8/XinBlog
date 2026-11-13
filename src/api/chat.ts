import { apiGet, apiPatch, apiPost, apiDelete } from './client';
import { getToken } from '../utils/token';
import type { ApiResult, ChatSettings, CustomChatRoom, RoomUserOption } from '../types/interaction';

const CHAT_CACHE_KEY = 'chat-settings-cache';
const CACHE_TTL = 5 * 60 * 1000;

// 公开聊天房的固定标识（与后端 _worker.js 中 PUBLIC_CHAT_ROOM_KEY 保持一致）
export const PUBLIC_CHAT_ROOM_KEY = 'public';
export const PUBLIC_CHAT_ROOM_NAME = '公共聊天房';

// 全体聊天房：仅登录用户可进（走鉴权的全员房）
export const ALL_USERS_CHAT_ROOM_KEY = 'members';
export const ALL_USERS_CHAT_ROOM_NAME = '全体聊天房';

interface CachedSettings {
  data: ChatSettings;
  ts: number;
}

function readLocalCache(): ChatSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSettings;
    if (!parsed.data || Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(CHAT_CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalCache(data: ChatSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore
  }
}

function clearLocalCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHAT_CACHE_KEY);
  } catch {
    // ignore
  }
}

const defaultChatSettings: ChatSettings = {
  enabled: false,
  publicRoomEnabled: true,
  allUsersRoomEnabled: true,
};

export async function getChatSettings() {
  const cached = readLocalCache();
  if (cached) {
    const merged = { ...defaultChatSettings, ...cached };
    writeLocalCache(merged);
    return { code: 0, data: merged, msg: 'ok' } as ApiResult<ChatSettings>;
  }

  const res = await apiGet<ChatSettings>('/api/v1/settings/chat');
  if (res.code === 0 && res.data) {
    const merged = { ...defaultChatSettings, ...res.data };
    writeLocalCache(merged);
    return { ...res, data: merged };
  }
  return res;
}

// 后台读取（管理员/站主），绕过本地缓存以保证拿到最新值
export async function getAdminChatSettings() {
  const res = await apiGet<ChatSettings>('/api/v1/admin/settings/chat');
  if (res.code === 0 && res.data) {
    const merged = { ...defaultChatSettings, ...res.data };
    return { ...res, data: merged };
  }
  return res;
}

export async function updateChatSettings(data: ChatSettings) {
  const normalized = {
    enabled: data.enabled === true,
    publicRoomEnabled: data.publicRoomEnabled !== false,
    allUsersRoomEnabled: data.allUsersRoomEnabled !== false,
  };
  const res = await apiPatch<ChatSettings>('/api/v1/admin/settings/chat', normalized);
  if (res.code === 0) {
    const merged = { ...defaultChatSettings, ...normalized, ...(res.data || {}) };
    writeLocalCache(merged);
    return { ...res, data: merged };
  } else {
    clearLocalCache();
  }
  return res;
}

// 由 API_BASE 推导同源 WebSocket 地址：https -> wss，http -> ws
// 对需要鉴权的房间（如全体聊天房 members），可选附加登录 token，
// 供 Pages Worker 在握手阶段校验后注入身份给聊天 Worker。
// 游客房（public）可选附加昵称 nickname，供 Pages Worker 在握手阶段校验是否占用注册用户名。
export function buildChatWebSocketUrl(roomKey: string, token?: string, nickname?: string): string {
  const base = window.location;
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (nickname) params.set('nickname', nickname);
  const qs = params.toString();
  return `${protocol}//${base.host}/api/chat/room/${encodeURIComponent(roomKey)}/websocket${qs ? `?${qs}` : ''}`;
}

// 校验游客所选昵称是否占用已注册账号的用户名；仅当冲突时返回 ok=false。
// 供改名/进房前调用，由 Pages Worker 查询 users 表判定。
export async function checkGuestNickname(name: string): Promise<{ ok: boolean; message?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: '昵称不能为空' };
  try {
    const res = await apiGet<{ ok: boolean }>(
      `/api/chat/check-nickname?name=${encodeURIComponent(trimmed)}`
    );
    if (res.code === 0) return { ok: true };
    return { ok: false, message: res.msg || '该昵称已被注册用户占用，请换一个' };
  } catch {
    return { ok: false, message: '校验昵称失败，请稍后重试' };
  }
}

// ---------- 自定义聊天房 API ----------

export interface CustomRoomListResult {
  list: CustomChatRoom[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRoomInput {
  name: string;
  description?: string;
  cover?: string;
  max_users?: number;
  members?: number[];
  enabled?: boolean;
}

// 当前登录用户可见的自定义房间（自己是成员且已启用）
export async function getMyChatRooms() {
  const res = await apiGet<{ list: CustomChatRoom[] }>('/api/v1/chat/my-rooms');
  return res;
}

// 管理端：分页列出自定义房间
export async function getAdminChatRooms(page = 1, limit = 20) {
  const res = await apiGet<CustomRoomListResult>(`/api/v1/admin/chat/rooms?page=${page}&limit=${limit}`);
  return res;
}

// 成员选择器：按用户名模糊搜索已启用用户（分页）
export async function searchRoomUsers(keyword = '', page = 1, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (keyword) params.set('keyword', keyword);
  const res = await apiGet<{ list: RoomUserOption[]; total: number; page: number; limit: number }>(
    `/api/v1/admin/chat/rooms/search-users?${params.toString()}`
  );
  return res;
}

// 管理端：读取某房间的成员（编辑回显）
export async function getAdminChatRoomMembers(roomKey: string) {
  const res = await apiGet<{ list: RoomUserOption[] }>(`/api/v1/admin/chat/rooms/${roomKey}/members`);
  return res;
}

// 创建自定义房间
export async function createChatRoom(data: AdminRoomInput) {
  const res = await apiPost<{ room_key: string }>('/api/v1/admin/chat/rooms', data);
  return res;
}

// 编辑自定义房间
export async function updateChatRoom(roomKey: string, data: Omit<AdminRoomInput, 'members' | 'enabled'> & { members?: number[]; enabled?: boolean }) {
  const res = await apiPatch<unknown>(`/api/v1/admin/chat/rooms/${roomKey}`, data);
  return res;
}

// 删除自定义房间
export async function deleteChatRoom(roomKey: string) {
  const res = await apiDelete<unknown>(`/api/v1/admin/chat/rooms/${roomKey}`);
  return res;
}

// ===== 聊天图片（存于聊天 Worker 的 DO，独立于博客媒体库）=====

// 构造聊天图片的完整访问 URL（供 <img> / 放大预览使用）。
// 公共房无需鉴权；members/自定义房需要登录，URL 上附带 token 供 Pages 校验。
export function buildChatMediaUrl(roomKey: string, id: string): string {
  const token = getToken();
  const base = `/api/v1/chat/media/${encodeURIComponent(roomKey)}/${encodeURIComponent(id)}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// 上传一张聊天图片（仅登录用户；游客由后端返回未授权），返回存好的 media id。
export async function uploadChatImage(roomKey: string, mime: string, base64: string): Promise<string> {
  const token = getToken();
  const res = await fetch(
    `/api/v1/chat/media/upload?room=${encodeURIComponent(roomKey)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mime, base64 }),
    }
  );
  let data: { id?: string; error?: string; code?: string } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* ignore */
  }
  if (!res.ok || !data.id) {
    throw new Error(data.error || '图片上传失败');
  }
  return data.id;
}

// ===== 管理后台：查看/管理各聊天房 DO 内消息与图片数据 =====

export interface AdminChatDoRoom {
  roomKey: string;
  /** 聊天房显示名（固定房为内置常量，自定义房来自配置库；后端未返回时为空） */
  name?: string;
  messageCount?: number;
  mediaCount?: number;
  mediaBytes?: number;
  error?: boolean;
}

export interface AdminChatDoItem {
  id: string;
  mime: string;
  bytes: number;
}

// 各房间 DO 概览（消息数 / 图片数 / 图片字节数）
export async function fetchAdminChatDoOverview(): Promise<AdminChatDoRoom[] | null> {
  const res = await apiGet<{ rooms: AdminChatDoRoom[] }>('/api/v1/admin/chat/do/overview');
  if (res.code !== 0 || !res.data) return null;
  return res.data.rooms || [];
}

// 列出某房间 DO 内已存聊天图片
export async function fetchAdminChatMedia(roomKey: string): Promise<AdminChatDoItem[] | null> {
  const res = await apiGet<{ items: AdminChatDoItem[] }>(`/api/v1/admin/chat/do/media/${encodeURIComponent(roomKey)}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data.items || [];
}

// 删除某房间 DO 内的单张聊天图片
export async function deleteAdminChatMedia(roomKey: string, id: string): Promise<boolean> {
  const res = await apiDelete<unknown>(`/api/v1/admin/chat/do/media/${encodeURIComponent(roomKey)}/${encodeURIComponent(id)}`);
  return res.code === 0;
}