// 云端静态资源站点地址：本地 serve/ 目录会部署到该地址（Cloudflare Pages）。
// 若后续改为本地内置资源，只需调整此处或移除相关调用即可。
export const CLOUD_BASE_URL = 'https://blogserve.pages.dev';

export function toAbsoluteCloudUrl(relative: string): string {
  if (/^https?:\/\//i.test(relative)) return relative;
  const base = CLOUD_BASE_URL.replace(/\/$/, '');
  return `${base}${relative.startsWith('/') ? '' : '/'}${relative}`;
}

// ---------- 可被 .env 覆盖的站点元信息（方便 fork 后自定义，避免硬编码） ----------
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.7.1';
export const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'XinBlog';
export const SITE_HOMEPAGE_URL = import.meta.env.VITE_SITE_URL || 'https://xinblog.zhyhome.top';

// 是否禁用浏览器右键菜单（默认不禁用，开源更友好；设为 "true" 可恢复防复制行为）
export const DISABLE_CONTEXT_MENU = import.meta.env.VITE_DISABLE_CONTEXT_MENU === 'true';
