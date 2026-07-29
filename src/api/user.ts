import { apiGet, apiPatch } from './client';
export interface UserProfile {
  nickname?: string;
  bio?: string;
  avatar?: string;
}
export interface UserSettingsResponse {
  theme: unknown | null;
  ui: { profile?: UserProfile } | null;
}
export async function fetchUserSettings(): Promise<UserSettingsResponse | null> {
  const res = await apiGet<UserSettingsResponse>('/api/v1/user/settings');
  if (res.code !== 0 || !res.data) return null;
  return res.data;
}
export async function updateUserSettings(settings: { ui?: { profile?: UserProfile } }): Promise<boolean> {
  const res = await apiPatch('/api/v1/user/settings', settings);
  return res.code === 0;
}
export async function fetchUserProfile(): Promise<UserProfile | null> {
  const settings = await fetchUserSettings();
  return settings?.ui?.profile || null;
}
export async function updateUserProfile(profile: UserProfile): Promise<boolean> {
  return updateUserSettings({ ui: { profile } });
}