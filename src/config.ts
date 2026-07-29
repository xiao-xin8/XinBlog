export const CLOUD_BASE_URL = 'https://blogserve.pages.dev';
export function toAbsoluteCloudUrl(relative: string): string {
  if (/^https?:\/\//i.test(relative)) return relative;
  const base = CLOUD_BASE_URL.replace(/\/$/, '');
  return `${base}${relative.startsWith('/') ? '' : '/'}${relative}`;
}
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.2.1';
export const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'XinBlog';
export const SITE_HOMEPAGE_URL = import.meta.env.VITE_SITE_URL || 'https://xinblog.zhyhome.top';
export const DISABLE_CONTEXT_MENU = import.meta.env.VITE_DISABLE_CONTEXT_MENU === 'true';