import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from './client';
import { getToken } from '@/utils/token';
export interface AiSettings {
  enabled: boolean;
  model: string;
  imageModel: string;
  temperature: number;
  maxTokens: number;
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