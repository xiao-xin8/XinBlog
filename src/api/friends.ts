import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { FriendLink, FriendApplication } from '@/types';

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



export interface FriendApplyPayload {
  name: string;
  url: string;
  description?: string;
  email?: string;
  avatar?: string;
}

export interface FriendApplicationsResult {
  list: FriendApplication[];
  total: number;
}

export async function applyFriend(payload: FriendApplyPayload): Promise<{ status: string }> {
  const res = await apiPost<{ status: string }>('/api/v1/friends/apply', payload);
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '提交申请失败');
  }
  return res.data;
}

export async function fetchFriendApplications(page = 1, limit = 10): Promise<FriendApplicationsResult> {
  const res = await apiGet<FriendApplicationsResult>(
    `/api/v1/admin/friends/applications?page=${page}&limit=${limit}`
  );
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '获取申请失败');
  }
  return res.data;
}

export async function auditFriendApplication(
  id: number,
  status: 'approved' | 'rejected',
  remark?: string
): Promise<void> {
  const res = await apiPatch<unknown>(`/api/v1/admin/friends/applications/${id}`, { status, remark });
  if (res.code !== 0) {
    throw new Error(res.msg || '审核失败');
  }
}

export async function fetchMyFriendApplications(): Promise<FriendApplicationsResult> {
  const res = await apiGet<FriendApplicationsResult>('/api/v1/friends/applications/my');
  if (res.code !== 0 || !res.data) {
    throw new Error(res.msg || '获取申请记录失败');
  }
  return res.data;
}

export async function deleteFriendApplication(id: number): Promise<void> {
  const res = await apiDelete<unknown>(`/api/v1/admin/friends/applications/${id}`);
  if (res.code !== 0) {
    throw new Error(res.msg || '删除失败');
  }
}
