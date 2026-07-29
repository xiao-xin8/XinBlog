import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { ThemePackage } from '@/types';
export interface DashboardCounts {
  posts: number;
  tags: number;
  media: number;
  users: number;
}
export interface LatestPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  created_at: string;
}
export interface DashboardResponse {
  counts: DashboardCounts;
  latestPosts: LatestPost[];
}
export interface DatabaseBinding {
  binding: string;
  name: string;
}
export interface DatabaseStats {
  users: number;
  refresh_tokens: number;
  posts: number;
  tags: number;
  settings: number;
  media: number;
}
export interface DatabasesResponse {
  bindings: DatabaseBinding[];
  stats: DatabaseStats;
  version: string;
}
export async function fetchDashboard(): Promise<DashboardResponse | null> {
  const res = await apiGet<DashboardResponse>('/api/v1/admin/dashboard');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function fetchDatabases(): Promise<DatabasesResponse | null> {
  const res = await apiGet<DatabasesResponse>('/api/v1/admin/system/databases');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export interface AdminPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_base64?: string;
  status: 'published' | 'draft';
  views: number;
  reading_time: number;
  created_at: string;
  updated_at: string;
  tags?: AdminTag[];
}
export interface AdminPostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  coverBase64?: string;
  status?: 'published' | 'draft';
  tagIds?: number[];
}
export async function fetchAdminPosts(page = 1, limit = 10): Promise<PagedResult<AdminPost> | null> {
  const res = await apiGet<PagedResult<AdminPost>>(`/api/v1/admin/posts?page=${page}&limit=${limit}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function fetchAdminPost(id: number): Promise<AdminPost | null> {
  const res = await apiGet<AdminPost>(`/api/v1/admin/posts/${id}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function createAdminPost(post: AdminPostInput): Promise<{ id?: number; slug?: string; msg?: string }> {
  const res = await apiPost<{ id: number; slug: string }>('/api/v1/admin/posts', post);
  if (res.code !== 0) return { msg: res.msg };
  return res.data || {};
}
export async function updateAdminPost(id: number, post: AdminPostInput): Promise<{ msg?: string }> {
  const res = await apiPatch(`/api/v1/admin/posts/${id}`, post);
  if (res.code !== 0) return { msg: res.msg };
  return {};
}
export async function deleteAdminPost(id: number): Promise<{ msg?: string }> {
  const res = await apiDelete(`/api/v1/admin/posts/${id}`);
  if (res.code !== 0) return { msg: res.msg };
  return {};
}
export interface AdminMedia {
  id: number;
  name: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  chunk_count: number;
  created_at: string;
}
export interface AdminMediaBinding {
  type: 'post' | 'user' | 'friend' | 'site';
  id?: number;
  title?: string;
  slug?: string;
  name?: string;
  key?: string;
  field?: string;
}
export interface AdminMediaDetail extends AdminMedia {
  bindings: AdminMediaBinding[];
}
export interface AdminMediaUpdateInput {
  base64: string;
  mimeType?: string;
  width?: number;
  height?: number;
  name?: string;
}
export async function fetchAdminMedia(page = 1, limit = 10): Promise<PagedResult<AdminMedia> | null> {
  const res = await apiGet<PagedResult<AdminMedia>>(`/api/v1/admin/media?page=${page}&limit=${limit}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function fetchAdminMediaDetail(id: number): Promise<AdminMediaDetail | null> {
  const res = await apiGet<AdminMediaDetail>(`/api/v1/admin/media/${id}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export interface AdminMediaUsage {
  totalSize: number;
  count: number;
}
export interface AdminMediaUsageDetail {
  rawSize: number;
  base64Size: number;
  chunkSize: number;
  totalSize: number;
  count: number;
  ratio: number;
}
export async function fetchAdminMediaUsage(): Promise<AdminMediaUsage | null> {
  const res = await apiGet<AdminMediaUsage>('/api/v1/admin/media/usage');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function fetchAdminMediaUsageDetail(): Promise<AdminMediaUsageDetail | null> {
  const res = await apiGet<AdminMediaUsageDetail>('/api/v1/admin/media/usage/detail');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function updateAdminMedia(
  id: number,
  input: AdminMediaUpdateInput
): Promise<{ msg?: string; data?: { id: number; url: string; size: number } }> {
  const res = await apiPatch<{ id: number; url: string; size: number }>(`/api/v1/admin/media/${id}`, input);
  if (res.code !== 0) return { msg: res.msg };
  return { data: res.data };
}
export interface AdminTag {
  id: number;
  name: string;
  slug: string;
  color?: string;
  post_count?: number;
}
export interface AdminTagInput {
  name: string;
  slug?: string;
  color?: string;
}
export async function fetchAdminTags(page = 1, limit = 10): Promise<PagedResult<AdminTag> | null> {
  const res = await apiGet<PagedResult<AdminTag>>(`/api/v1/admin/tags?page=${page}&limit=${limit}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function createAdminTag(tag: AdminTagInput): Promise<{ id?: number; msg?: string }> {
  const res = await apiPost<{ id: number }>('/api/v1/admin/tags', tag);
  if (res.code !== 0) return { msg: res.msg };
  return res.data || {};
}
export async function updateAdminTag(id: number, tag: AdminTagInput): Promise<{ msg?: string }> {
  const res = await apiPatch(`/api/v1/admin/tags/${id}`, tag);
  if (res.code !== 0) return { msg: res.msg };
  return {};
}
export async function deleteAdminTag(id: number): Promise<{ msg?: string }> {
  const res = await apiDelete(`/api/v1/admin/tags/${id}`);
  if (res.code !== 0) return { msg: res.msg };
  return {};
}
export interface AuthSettings {
  allowRegister: boolean;
  emailVerification: boolean;
}
export async function fetchAuthSettings(): Promise<AuthSettings | null> {
  const res = await apiGet<AuthSettings>('/api/v1/settings/auth');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function updateAuthSettings(settings: AuthSettings): Promise<boolean> {
  const res = await apiPatch('/api/v1/admin/settings/auth', settings);
  return res.code === 0;
}
export interface EmailSettings {
  provider: 'resend' | 'smtp';
  from: string;
  fromName: string;
  resendApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
}
export async function fetchEmailSettings(): Promise<EmailSettings | null> {
  const res = await apiGet<EmailSettings>('/api/v1/settings/email');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function updateEmailSettings(settings: Partial<EmailSettings>): Promise<boolean> {
  const res = await apiPatch('/api/v1/admin/settings/email', settings);
  return res.code === 0;
}
export interface EmailTemplateSettings {
  subject: string;
  html: string;
  text: string;
}
export async function fetchEmailTemplateSettings(): Promise<EmailTemplateSettings> {
  const res = await apiGet<EmailTemplateSettings & { _debug?: unknown }>('/api/v1/admin/settings/email-template');
  if (res.code !== 0) {
    throw new Error(res.msg || '加载邮件模板失败');
  }
  if (!res.data) {
    throw new Error('邮件模板数据为空');
  }
  const { subject, html, text } = res.data;
  return { subject, html, text };
}
export async function updateEmailTemplateSettings(settings: Partial<EmailTemplateSettings>): Promise<EmailTemplateSettings | null> {
  const res = await apiPatch<EmailTemplateSettings & { _debug?: unknown }>('/api/v1/admin/settings/email-template', settings);
  if (res.code !== 0 || !res.data) return null;
  const { subject, html, text } = res.data;
  return { subject, html, text };
}
export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  status: number;
  created_at: string;
  updated_at: string;
}
export interface PagedResult<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}
export async function fetchAdminUsers(page = 1, limit = 10): Promise<PagedResult<AdminUser> | null> {
  const res = await apiGet<PagedResult<AdminUser>>(`/api/v1/admin/users?page=${page}&limit=${limit}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function updateAdminUser(id: number, data: Partial<AdminUser>): Promise<boolean> {
  const res = await apiPatch(`/api/v1/admin/users/${id}`, data);
  return res.code === 0;
}
export async function deleteAdminUser(id: number): Promise<{ msg?: string }> {
  const res = await apiDelete(`/api/v1/admin/users/${id}`);
  if (res.code !== 0) return { msg: res.msg };
  return {};
}
export interface AdminTheme {
  id: string;
  name: string;
  source?: string;
  previewImage?: string;
  description?: string;
  author?: string;
  isActive: boolean;
}
export async function fetchAdminThemes(): Promise<AdminTheme[] | null> {
  const res = await apiGet<AdminTheme[]>('/api/v1/admin/themes');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function fetchAdminTheme(id: string): Promise<ThemePackage | null> {
  const res = await apiGet<ThemePackage>(`/api/v1/admin/themes/${id}`);
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function createAdminTheme(theme: ThemePackage): Promise<boolean> {
  const res = await apiPost('/api/v1/admin/themes', theme);
  return res.code === 0;
}
export async function applyAdminTheme(id: string, postCard?: unknown): Promise<boolean> {
  const res = await apiPatch(`/api/v1/admin/themes/${id}/apply`, postCard ? { postCard } : {});
  return res.code === 0;
}
export async function deleteAdminTheme(id: string): Promise<boolean> {
  const res = await apiDelete(`/api/v1/admin/themes/${id}`);
  return res.code === 0;
}
export async function clearAdminActiveTheme(): Promise<boolean> {
  try {
    const res = await apiPost('/api/v1/admin/themes/clear-active', {});
    return res.code === 0;
  } catch {
    return false;
  }
}
export async function updateAdminTheme(id: string, theme: ThemePackage): Promise<boolean> {
  const res = await apiPatch(`/api/v1/admin/themes/${id}`, theme);
  return res.code === 0;
}