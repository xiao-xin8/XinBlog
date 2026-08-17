import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { FriendLink } from '@/types';

export interface FriendsListResult {
  list: FriendLink[];
}

export async function fetchFriends(): Promise<FriendsListResult> {
  const res = await apiGet<FriendsListResult>('/api/v1/friends');
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '获取友链失败');
  }
  return res.data;
}

export async function fetchAdminFriends(): Promise<FriendsListResult> {
  const res = await apiGet<FriendsListResult>('/api/v1/admin/friends');
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '获取友链失败');
  }
  return res.data;
}

export async function createAdminFriend(friend: Omit<FriendLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<FriendLink> {
  const res = await apiPost<FriendLink>('/api/v1/admin/friends', friend);
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '创建友链失败');
  }
  return res.data;
}

export async function updateAdminFriend(id: number, friend: Partial<Omit<FriendLink, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const res = await apiPatch<unknown>(`/api/v1/admin/friends/${id}`, friend);
  if (res.code !== 0) {
    throw new Error(res.msg || '更新友链失败');
  }
}

export async function deleteAdminFriend(id: number): Promise<void> {
  const res = await apiDelete<unknown>(`/api/v1/admin/friends/${id}`);
  if (res.code !== 0) {
    throw new Error(res.msg || '删除友链失败');
  }
}
