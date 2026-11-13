import { apiGet } from './client';
import type { Post, Tag } from '@/types';

export interface BackendTag {
  id?: number | string;
  name: string;
  slug: string;
  color?: string;
  post_count?: number;
}

export interface BackendPost {
  id: number | string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_base64?: string;
  author_id: number | string;
  status: string;
  views: number;
  reading_time: number;
  created_at: string;
  updated_at: string;
  tags?: BackendTag[];
}

export interface PostsResponse {
  list: BackendPost[];
  total: number;
  page: number;
  limit: number;
}

export interface PostsPageResponse {
  list: Post[];
  total: number;
  page: number;
  limit: number;
}

export function transformTag(backend: BackendTag): Tag {
  return {
    id: String(backend.id ?? backend.slug),
    name: backend.name,
    slug: backend.slug,
    color: backend.color,
    count: backend.post_count ?? 0,
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function transformPost(backend: BackendPost, defaultAuthor = '星语'): Post {
  let cover = backend.cover_base64 || undefined;
  if (cover && !cover.startsWith('data:') && !cover.startsWith('http') && !cover.startsWith('/api/v1/media/') && !cover.startsWith(`${API_BASE}/api/v1/media/`)) {
    cover = `data:image/jpeg;base64,${cover}`;
  }
  return {
    id: String(backend.id),
    title: backend.title,
    slug: backend.slug,
    excerpt: backend.excerpt || '',
    content: backend.content || '',
    cover,
    author: defaultAuthor,
    tags: (backend.tags || []).map(transformTag),
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    readingTime: backend.reading_time || 1,
    views: backend.views ?? 0,
  };
}

export interface FetchPostsOptions {
  page?: number;
  limit?: number;
  tag?: string;
}

const MAX_PAGE_LIMIT = 50;

function buildPostsQuery(options?: FetchPostsOptions): { params: URLSearchParams; page: number; limit: number } {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, options?.limit ?? 10));
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (options?.tag) params.set('tag', options.tag);
  return { params, page, limit };
}

export async function fetchPostsPage(options?: FetchPostsOptions): Promise<PostsPageResponse> {
  const { params, page, limit } = buildPostsQuery(options);
  const res = await apiGet<PostsResponse>(`/api/v1/posts?${params.toString()}`);
  if (res.code !== 0 || !res.data) {
    return { list: [], total: 0, page, limit };
  }
  return {
    ...res.data,
    list: res.data.list.map((p) => transformPost(p)),
  };
}

export async function fetchPosts(options?: FetchPostsOptions | string): Promise<Post[]> {
  const opts: FetchPostsOptions = typeof options === 'string' ? { tag: options } : options || {};
  const data = await fetchPostsPage({ ...opts, limit: opts.limit ?? MAX_PAGE_LIMIT });
  return data.list;
}

export async function fetchAllPosts(tag?: string): Promise<Post[]> {
  const all: Post[] = [];
  let page = 1;
  while (true) {
    const data = await fetchPostsPage({ page, limit: MAX_PAGE_LIMIT, tag });
    all.push(...data.list);
    if (data.list.length < data.limit || all.length >= data.total) break;
    page += 1;
  }
  return all;
}

export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const res = await apiGet<BackendPost>(`/api/v1/posts/${slug}`);
  if (res.code !== 0 || !res.data) return null;
  return transformPost(res.data);
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await apiGet<BackendTag[]>('/api/v1/tags');
  if (res.code !== 0 || !res.data) return [];
  return res.data.map(transformTag);
}
