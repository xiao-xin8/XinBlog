import type { UserRole } from '@/stores/authStore';

/** 是否为站主（超级管理员）：拥有后台全部权限 */
export function isSuperAdmin(role?: UserRole | null): boolean {
  return role === 'super_admin';
}

/** 是否可进入管理后台（管理员或站主） */
export function isContentAdmin(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'super_admin';
}