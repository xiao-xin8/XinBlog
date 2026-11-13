// 从持久化的登录态中读取访问令牌（JWT）。
// 注意：当前实现将 JWT 明文存放在 localStorage，存在 XSS 窃取风险；
// 若要彻底消除该风险，需要后端改为下发 httpOnly Cookie，前端不再自行读取。
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
