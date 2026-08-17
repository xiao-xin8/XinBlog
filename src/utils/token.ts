export function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('auth-state');
    if (!raw) return '';
    const state = JSON.parse(raw);
    return state?.state?.token || '';
  } catch {
    return '';
  }
}
