import type { UserRole } from '@/stores/authStore';


export function isSuperAdmin(role?: UserRole | null): boolean {
  return role === 'super_admin';
}


export function isContentAdmin(role?: UserRole | null): boolean {
  return role === 'admin' || role === 'super_admin';
}