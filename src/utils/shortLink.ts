// 短链分享（方案 A，零数据库）：短码 = base64url(slug)，与后端 _worker.js 的 base64UrlEncode 保持一致。
// 后端在主 fetch 的 SPA 兜底前拦截 /s/:code，解出 slug 后 302 到 /post/{slug}。

function base64UrlEncode(input: string): string {
  // slug 为 slugify 产物（ASCII：字母/数字/连字符），btoa 安全
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function encodeShortCode(slug: string): string {
  return base64UrlEncode(slug);
}

export function buildShortUrl(slug: string): string {
  const code = encodeShortCode(slug);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/s/${code}`;
  }
  return `/s/${code}`;
}
