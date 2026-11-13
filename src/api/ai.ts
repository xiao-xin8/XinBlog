import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from './client';
import { getToken } from '@/utils/token';

export interface AiSettings {
  enabled: boolean;
  agentEnabled: boolean;
  webSearch?: boolean;
  model: string;
  imageModel: string;
  temperature: number;
  maxTokens: number;
  agentAvatar?: string;
}

export interface AiModel {
  id: string;
  name?: string;
  object?: string;
  created?: number;
  owned_by?: string;
  builtIn?: boolean;
}

export interface AiCustomModel {
  id: number;
  name: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiGeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  content: string;
  raw?: string;
}

export function isTextAiModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return !id.includes('flux') && !id.includes('sdxl') && !id.includes('whisper') && !id.includes('embedding') && !id.includes('bge');
}

export interface AiApiKey {
  id: number;
  name: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export async function fetchAiSettings(): Promise<AiSettings | null> {
  const res = await apiGet<AiSettings>('/api/v1/admin/settings/ai');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}

export async function updateAiSettings(settings: Partial<AiSettings>): Promise<AiSettings | null> {
  const res = await apiPatch<AiSettings>('/api/v1/admin/settings/ai', settings);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}

export async function fetchAiModels(): Promise<AiModel[]> {
  const res = await apiGet<{ models: AiModel[] }>('/api/v1/admin/ai/models');
  if (res.code !== 0 || !res.data) return [];
  return res.data.models;
}

export class AiGenerateError extends Error {
  raw?: string;
  model?: string;
  errorDetail?: string;
  firstError?: string;

  constructor(message: string, details?: { raw?: string; model?: string; error?: string; firstError?: string }) {
    super(message);
    this.name = 'AiGenerateError';
    this.raw = details?.raw;
    this.model = details?.model;
    this.errorDetail = details?.error;
    this.firstError = details?.firstError;
  }
}

export async function generateAiPost(
  topic: string,
  existingTags: { id: number; name: string }[],
  options: { model?: string; temperature?: number; maxTokens?: number; description?: string } = {}
): Promise<AiGeneratedPost> {
  const res = await apiPost<AiGeneratedPost>('/api/v1/admin/ai/generate', {
    topic,
    existingTags,
    description: options.description,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  if (res.code !== 0 || !res.data) {
    const details = (res.data || {}) as {
      raw?: string;
      model?: string;
      error?: string;
      firstError?: string;
    };
    throw new AiGenerateError(res.msg || 'AI 生成失败，请稍后重试', {
      raw: details.raw,
      model: details.model,
      error: details.error,
      firstError: details.firstError,
    });
  }
  return res.data;
}

export async function formatOptimize(
  content: string,
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; model: string }> {
  const res = await apiPost<{ content: string; model: string }>('/api/v1/admin/ai/format', {
    content,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || 'AI 格式优化失败，请稍后重试');
  }
  return res.data;
}

export async function generateAiSummary(
  title: string,
  content: string,
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<{ excerpt: string; model: string }> {
  const res = await apiPost<{ excerpt: string; model: string }>('/api/v1/admin/ai/summary', {
    title,
    content,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || 'AI 摘要生成失败，请稍后重试');
  }
  return res.data;
}

export async function chatWithAi(
  messages: { role: string; content: string }[],
  options: { model?: string; stream?: boolean; temperature?: number; max_tokens?: number } = {}
): Promise<Response> {
  return fetch(`${API_BASE}/api/v1/admin/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      messages,
      model: options.model,
      stream: options.stream ?? true,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });
}

export async function agentChatStream(
  messages: { role: string; content: string }[],
  options: { model?: string; mode?: 'warm' | 'humorous' | 'professional'; sessionId?: string } = {}
): Promise<Response> {
  return fetch(`${API_BASE}/api/v1/admin/ai/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      messages,
      model: options.model,
      mode: options.mode,
      sessionId: options.sessionId,
    }),
  });
}

// ---- Agent 持久会话（对标 dsh-edge /api/sessions） ----
export interface AgentSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
export interface AgentTrailBlock {
  kind: 'think' | 'tool' | 'tool-result' | 'content';
  text?: string;
  name?: string;
  params?: string;
  output?: string;
  summary?: string;
  idx?: number;
  ok?: boolean;
  status?: string;
}
export interface AgentSessionDetail extends AgentSession {
  messages: { role: 'user' | 'assistant'; content: string; trail?: AgentTrailBlock[] }[];
  partIndex?: number; // 当前返回片 index（单分片加载时）
  partTotal?: number; // 总片数
}
// 同步校验返回
export interface AgentSessionCheck {
  id: string;
  title: string;
  updatedAt: string;
  partTotal: number;
  needsSync: boolean;
}

export async function fetchAgentSessions(): Promise<AgentSession[]> {
  const q = new URLSearchParams({ limit: '100' });
  const res = await apiGet<{ list: AgentSession[] }>(`/api/v1/admin/ai/agent/sessions?${q}`);
  if (res.code !== 0 || !res.data) return [];
  return res.data.list || [];
}

export async function fetchAgentSession(id: string): Promise<AgentSessionDetail | null> {
  const res = await apiGet<{ session: AgentSessionDetail }>(
    `/api/v1/admin/ai/agent/sessions/${encodeURIComponent(id)}`
  );
  if (res.code !== 0 || !res.data) return null;
  return res.data.session;
}

// 分片加载：取指定 part_index 的单个分片消息（0 为最早；负值落到最后一片）
export async function fetchAgentSessionPart(id: string, partIndex: number): Promise<AgentSessionDetail | null> {
  const q = new URLSearchParams({ part: String(partIndex) });
  const res = await apiGet<{ session: AgentSessionDetail }>(
    `/api/v1/admin/ai/agent/sessions/${encodeURIComponent(id)}?${q}`
  );
  if (res.code !== 0 || !res.data) return null;
  return res.data.session;
}

// 同步校验：传本地已加载的用户消息条数(localCount)，后端用「云端回合数 > localCount」判断是否需拉取
export async function fetchAgentSessionCheck(
  id: string,
  _localUpdated: number,
  localCount = 0
): Promise<AgentSessionCheck | null> {
  const q = new URLSearchParams({ check: '1', localUpdated: String(_localUpdated || 0), localCount: String(localCount) });
  const res = await apiGet<{ session: AgentSessionCheck }>(
    `/api/v1/admin/ai/agent/sessions/${encodeURIComponent(id)}?${q}`
  );
  if (res.code !== 0 || !res.data) return null;
  return res.data.session;
}

export async function deleteAgentSession(id: string): Promise<boolean> {
  const res = await apiDelete(`/api/v1/admin/ai/agent/sessions/${encodeURIComponent(id)}`);
  return res.code === 0;
}

export async function clearAgentSessions(): Promise<boolean> {
  const res = await apiDelete('/api/v1/admin/ai/agent/sessions');
  return res.code === 0;
}

// 对挂起中的写操作确认/取消：返回后同一 SSE 流会继续执行并回传结果
export async function confirmAgentAction(token: string, approved: boolean): Promise<boolean> {
  const res = await apiPost<{ ok: boolean }>('/api/v1/admin/ai/agent/confirm', { token, approved });
  return res.code === 0;
}

// 回滚 AI 已执行的写操作（24 小时内有效，仅本人可回滚）
export async function undoAgentWrite(undoId: string): Promise<{ ok: boolean; msg?: string }> {
  const res = await apiPost<{ ok: boolean }>('/api/v1/admin/ai/agent/undo', { undoId });
  return { ok: res.code === 0, msg: res.msg };
}

// ---- 管理后台：AI 写操作回滚记录管理（云端持久化，跨设备可见） ----
export interface AiUndoLog {
  id: string;
  skill: string;
  args: Record<string, unknown>;
  target: string;
  undoPreview: string;
  operator: string;
  created_at: string;
  used_at: string | null;
  status: 'pending' | 'used' | 'expired';
}
export interface AiUndoLogPage {
  list: AiUndoLog[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchAiUndoLogs(status: string, page = 1, pageSize = 20): Promise<AiUndoLogPage> {
  const q = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
  const res = await apiGet<AiUndoLogPage>(`/api/v1/admin/ai/agent/undo/list?${q}`);
  if (res.code !== 0 || !res.data) return { list: [], total: 0, page, pageSize };
  return res.data;
}

export async function undoAgentWriteAdmin(id: string): Promise<{ ok: boolean; msg?: string }> {
  const res = await apiPost<{ ok: boolean }>(`/api/v1/admin/ai/agent/undo/${encodeURIComponent(id)}`, {});
  return { ok: res.code === 0, msg: res.msg };
}

export async function deleteAiUndoLog(id: string): Promise<boolean> {
  const res = await apiDelete(`/api/v1/admin/ai/agent/undo/${encodeURIComponent(id)}`);
  return res.code === 0;
}

export async function fetchAgentEnabled(): Promise<boolean> {
  const res = await apiGet<{ enabled: boolean }>('/api/v1/settings/agent');
  if (res.code !== 0 || !res.data) return false;
  return res.data.enabled === true;
}

export async function fetchAiApiKeys(): Promise<AiApiKey[]> {
  const res = await apiGet<{ list: AiApiKey[] }>('/api/v1/admin/ai/keys');
  if (res.code !== 0 || !res.data) return [];
  return res.data.list;
}

export async function createAiApiKey(name: string): Promise<{ id?: number; key?: string; msg?: string }> {
  const res = await apiPost<{ id: number; key: string }>('/api/v1/admin/ai/keys', { name });
  if (res.code !== 0) return { msg: res.msg };
  return res.data || {};
}

export async function deleteAiApiKey(id: number): Promise<boolean> {
  const res = await apiDelete(`/api/v1/admin/ai/keys/${id}`);
  return res.code === 0;
}

export async function fetchAiCustomModels(): Promise<AiCustomModel[]> {
  const res = await apiGet<{ list: AiCustomModel[] }>('/api/v1/admin/ai/custom-models');
  if (res.code !== 0 || !res.data) return [];
  return res.data.list;
}

export async function createAiCustomModel(data: Omit<AiCustomModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiCustomModel | null> {
  const res = await apiPost<AiCustomModel>('/api/v1/admin/ai/custom-models', data);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}

export async function updateAiCustomModel(id: number, data: Omit<AiCustomModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiCustomModel | null> {
  const res = await apiPatch<AiCustomModel>(`/api/v1/admin/ai/custom-models/${id}`, data);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}

export async function deleteAiCustomModel(id: number): Promise<boolean> {
  const res = await apiDelete(`/api/v1/admin/ai/custom-models/${id}`);
  return res.code === 0;
}
