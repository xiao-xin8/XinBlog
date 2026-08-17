import { connect } from 'cloudflare:sockets';

const VERSION = '1.0.0';



function jsonResponse(code, data, msg = 'ok', status = 200) {
  return new Response(JSON.stringify({ code, data, msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponseWithCache(code, data, msg = 'ok', status = 200, cacheControl = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }
  return new Response(JSON.stringify({ code, data, msg }), { status, headers });
}

function now() {
  return new Date().toISOString();
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readingTime(content) {
  const chars = content ? content.length : 0;
  return Math.max(1, Math.ceil(chars / 300));
}



function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  return Uint8Array.from(hex.match(/.{2}/g).map((b) => parseInt(b, 16)));
}

function base64UrlEncode(str) {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + padding);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { salt: bufToHex(salt), hash: bufToHex(derived) };
}

async function verifyPassword(password, saltHex, hashHex) {
  const encoder = new TextEncoder();
  const salt = hexToBuf(saltHex);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(derived) === hashHex;
}

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hash);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getEncryptionKey(env) {
  const raw = env.ENCRYPTION_KEY || env.JWT_SECRET || '';
  if (!raw) return null;
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptApiKey(env, plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith('enc:')) return plaintext;
  const key = await getEncryptionKey(env);
  if (!key) return plaintext;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return `enc:${bytesToBase64(combined)}`;
}

async function decryptApiKey(env, ciphertext) {
  if (!ciphertext || !ciphertext.startsWith('enc:')) return ciphertext;
  const key = await getEncryptionKey(env);
  if (!key) return null;
  try {
    const combined = base64ToBytes(ciphertext.slice(4));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('decrypt api key error:', err);
    return null;
  }
}

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${sigB64}`;
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(
    base64UrlDecode(sigB64)
      .split('')
      .map((c) => c.charCodeAt(0))
  );
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
  if (!valid) throw new Error('Invalid token');
  const payload = JSON.parse(base64UrlDecode(payloadB64));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}



function ensureDbConfig(env) {
  if (!env || !env.DB_CONFIG || typeof env.DB_CONFIG.prepare !== 'function') {
    const hasBinding = env && !!env.DB_CONFIG;
    const bindingType = hasBinding ? typeof env.DB_CONFIG : 'missing';
    const hasPrepare = hasBinding && typeof env.DB_CONFIG.prepare === 'function';
    throw new Error(
      `D1 数据库绑定 DB_CONFIG 未配置或无效（binding=${hasBinding}, type=${bindingType}, hasPrepare=${hasPrepare}），请在 Cloudflare Dashboard 中绑定后重新部署。`
    );
  }
}

function isBindingError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('D1 数据库绑定') ||
    msg.includes("Cannot read properties of undefined (reading 'prepare')") ||
    msg.includes("Cannot read property 'prepare' of undefined") ||
    msg.includes('DB_CONFIG.prepare is not a function')
  );
}

function getBindingDebugInfo(env, err) {
  const hasBinding = env && !!env.DB_CONFIG;
  return {
    error: err?.message || '',
    hasBinding,
    bindingType: hasBinding ? typeof env.DB_CONFIG : 'missing',
    hasPrepare: hasBinding ? typeof env.DB_CONFIG.prepare === 'function' : false,
  };
}

function getConfigDb(env) {
  ensureDbConfig(env);
  
  return env.DB_CONFIG.withSession ? env.DB_CONFIG.withSession('first-primary') : env.DB_CONFIG;
}

async function getSetting(env, key) {
  const db = getConfigDb(env);
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (!row || row.value === undefined || row.value === null || row.value === '') return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function setSetting(env, key, value) {
  const db = getConfigDb(env);
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(key, JSON.stringify(value), now())
    .run();
}

async function getSystem(env, key) {
  const db = getConfigDb(env);
  const row = await db.prepare('SELECT value FROM system WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}

async function setSystem(env, key, value) {
  const db = getConfigDb(env);
  await db.prepare('INSERT OR REPLACE INTO system (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(key, value, now())
    .run();
}



async function getCurrentUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload.type !== 'access') return null;
    const user = await env.DB_USERS.prepare(
      'SELECT id, username, email, avatar_base64, role, status, theme, ui FROM users WHERE id = ?'
    )
      .bind(payload.sub)
      .first();
    if (!user || user.status !== 1) return null;
    return user;
  } catch {
    return null;
  }
}

async function requireAuth(request, env, handler) {
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  return handler(request, env, user);
}

async function requireAdmin(request, env, handler) {
  
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  if (user.role !== 'super_admin') {
    return jsonResponse(403, null, 'Forbidden: super_admin only', 403);
  }
  return handler(request, env, user);
}

async function requireSuperAdmin(request, env, handler) {
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  if (user.role !== 'super_admin') return jsonResponse(403, null, 'Forbidden', 403);
  return handler(request, env, user);
}



async function setup(env) {
  return jsonResponse(0, { version: VERSION }, 'ok');
}

const defaultSiteConfig = {
  author: 'Xin',
  siteName: 'XinBlog',
  shareDescription: 'XinBlog - 一个记录生活、设计与技术感悟的个人博客',
  shareImage: '',
  themeColor: '#5b7cfa',
  pwaThemeColor: '#ffffff',
  language: 'zh-CN',
  postLayout: 'grid',
  footerText: '',
  lazyLoadMedia: false,
  cardTheme: {
    variant: 'default',
    layout: 'clean',
    showExcerpt: true,
    showTags: true,
    showMeta: true,
  },
  sceneTheme: {
    variant: 'default',
  },
  hero: {
    enabled: true,
    mode: 'classic',
    title: '',
    subtitle: '',
    badge: '',
    layout: {
      cols: 6,
      gap: 16,
      widgets: [],
    },
  },
  about: {
    name: '',
    subtitle: '',
    bio: '',
    tags: [],
  },
  font: {
    activeFontId: '',
    fonts: [],
    fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  live2d: {
    enabled: false,
    position: 'right',
    width: 280,
    height: 280,
    tools: ['hitokoto', 'asteroids', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
    drag: false,
    showToggleAfterQuit: true,
    logLevel: 'warn',
    waifuPath: '/live2d/waifu-tips.json',
    cdnPath: '/live2d-models/',
    cubism2Path: '/live2d/live2d.min.js',
    cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  },
  nav: {
    items: [],
    theme: {
      variant: 'default',
      glassOpacity: 0.4,
      blur: 16,
      borderOpacity: 0.2,
      shadowOpacity: 0.08,
      textColor: '',
      activeColor: '',
      logoText: '',
      hideOnScroll: true,
    },
  },
  clickEffect: {
    enabled: false,
    type: 'heart',
    colorMode: 'theme',
    customColor: '',
    textList: ['❤富强❤', '❤民主❤', '❤文明❤', '❤和谐❤', '❤自由❤', '❤平等❤', '❤公正❤', '❤法治❤'],
    intensity: 'medium',
  },
};

const defaultInteractionSettings = {
  commentsEnabled: true,
  likesEnabled: true,
  commentAudit: true,
};

const defaultFriendsConfig = {
  enabled: false,
  title: '友链',
  subtitle: '在时光中相遇，结识志同道合的朋友',
  cardStyle: 'standard',
  cardColor: '',
  avatarShape: 'rounded',
  showDescription: true,
};

async function getSiteConfigObject(env) {
  const site = (await getSetting(env, 'site')) || {};
  const hero = (await getSetting(env, 'hero')) || {};
  const about = (await getSetting(env, 'about')) || {};
  const friends = (await getSetting(env, 'friends')) || {};
  
  
  const activeThemeId = (await getSetting(env, 'active_theme')) || '';
  const cardTheme = activeThemeId
    ? { ...defaultSiteConfig.cardTheme, ...(site.cardTheme || {}) }
    : defaultSiteConfig.cardTheme;
  return {
    ...defaultSiteConfig,
    ...site,
    cardTheme,
    hero: { ...defaultSiteConfig.hero, ...hero, ...(site.hero || {}) },
    about: { ...defaultSiteConfig.about, ...about, ...(site.about || {}) },
    friends: { ...defaultFriendsConfig, ...friends, ...(site.friends || {}) },
    font: { ...defaultSiteConfig.font, ...(site.font || {}) },
  };
}

function escapeHtmlMeta(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectSiteMeta(html, config, requestUrl) {
  const title = escapeHtmlMeta(config.siteName || 'XinBlog');
  const description = escapeHtmlMeta(config.shareDescription || '');
  const themeColor = escapeHtmlMeta(config.pwaThemeColor || '#ffffff');
  const origin = new URL(requestUrl).origin;

  let image = config.shareImage || config.logo || '/logo.png';
  if (image.startsWith('data:')) {
    image = '/logo.png';
  }
  if (image && !image.startsWith('http')) {
    image = origin + (image.startsWith('/') ? '' : '/') + image;
  }
  image = escapeHtmlMeta(image);

  html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${description}" />`
  );
  html = html.replace(
    /<meta\s+name=["']theme-color["'][^>]*>/i,
    `<meta name="theme-color" content="${themeColor}" />`
  );

  const metaTags = [
    `<link rel="manifest" href="/manifest.json?v=2" />`,
    `<meta name="theme-color" content="${themeColor}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtmlMeta(requestUrl)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join('\n');

  return html.replace(/<head>/i, `<head>\n${metaTags}`);
}

async function getManifest(env, requestUrl) {
  try {
    const config = await getSiteConfigObject(env).catch(() => ({ ...defaultSiteConfig }));
    const origin = new URL(requestUrl).origin;
    const name = config.siteName || 'XinBlog';
    const shortName = name.length > 12 ? `${name.slice(0, 11)}…` : name;

    let iconSrc = config.logo || config.favicon || '/logo.png';
    if (iconSrc && !iconSrc.startsWith('http') && !iconSrc.startsWith('data:')) {
      iconSrc = origin + (iconSrc.startsWith('/') ? '' : '/') + iconSrc;
    }

    const manifest = {
      name,
      short_name: shortName,
      description: config.shareDescription || 'XinBlog - 记录生活，分享热爱',
      start_url: '/',
      display: 'standalone',
      background_color: config.pwaThemeColor || '#ffffff',
      theme_color: config.pwaThemeColor || '#ffffff',
      lang: config.language || 'zh-CN',
      icons: [
        { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    return new Response(JSON.stringify(manifest), {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('生成 manifest 失败:', err);
    return new Response(JSON.stringify({ error: 'manifest generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getSiteConfig(env) {
  
  try {
    const config = await getSiteConfigObject(env);
    return jsonResponseWithCache(0, { site: config }, 'ok', 200, 'public, max-age=120, stale-while-revalidate=86400');
  } catch (err) {
    if (isBindingError(err)) {
      console.error('读取站点配置失败，返回默认配置:', err);
      return jsonResponse(0, { site: { ...defaultSiteConfig }, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function listPosts(env, url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const tag = url.searchParams.get('tag');
  const offset = (page - 1) * limit;

  let posts;
  let total;

  if (tag) {
    const tagRow = await env.DB_POSTS.prepare('SELECT id FROM tags WHERE slug = ?').bind(tag).first();
    if (!tagRow) return jsonResponse(0, { list: [], total: 0, page, limit });
    posts = await env.DB_POSTS.prepare(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.cover_base64, p.author_id, p.status, p.views, p.reading_time, p.created_at, p.updated_at
       FROM posts p
       JOIN post_tags pt ON p.id = pt.post_id
       WHERE pt.tag_id = ? AND p.status = 'published'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(tagRow.id, limit, offset)
      .all();
    const countRow = await env.DB_POSTS.prepare(
      `SELECT COUNT(*) as c FROM posts p JOIN post_tags pt ON p.id = pt.post_id WHERE pt.tag_id = ? AND p.status = 'published'`
    )
      .bind(tagRow.id)
      .first();
    total = countRow.c;
  } else {
    posts = await env.DB_POSTS.prepare(
      `SELECT id, title, slug, excerpt, content, cover_base64, author_id, status, views, reading_time, created_at, updated_at
       FROM posts WHERE status = 'published' ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    const countRow = await env.DB_POSTS.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'published'").first();
    total = countRow.c;
  }

  
  const list = await fillPostTags(env, posts.results || []);
  return jsonResponseWithCache(0, { list, total, page, limit }, 'ok', 200, 'public, max-age=600');
}

async function fillPostTags(env, posts) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const tagRows = await env.DB_POSTS.prepare(
    `SELECT pt.post_id, t.id, t.name, t.slug, t.color
     FROM post_tags pt
     JOIN tags t ON pt.tag_id = t.id
     WHERE pt.post_id IN (${placeholders})`
  )
    .bind(...ids)
    .all();
  const tagMap = {};
  for (const row of tagRows.results || []) {
    if (!tagMap[row.post_id]) tagMap[row.post_id] = [];
    tagMap[row.post_id].push({ id: row.id, name: row.name, slug: row.slug, color: row.color });
  }
  return posts.map((p) => ({ ...p, tags: tagMap[p.id] || [] }));
}

async function getPost(env, path) {
  const slug = path.replace('/api/v1/posts/', '');
  const post = await env.DB_POSTS.prepare(
    `SELECT id, title, slug, excerpt, content, cover_base64, author_id, status, views, reading_time, created_at, updated_at
     FROM posts WHERE slug = ? AND status = 'published'`
  )
    .bind(slug)
    .first();
  if (!post) return jsonResponse(404, null, 'Post not found', 404);
  const list = await fillPostTags(env, [post]);
  await env.DB_POSTS.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(post.id).run();
  return jsonResponse(0, list[0]);
}

async function listTags(env) {
  const tags = await env.DB_POSTS.prepare(
    `SELECT t.id, t.name, t.slug, t.color, COUNT(pt.post_id) as post_count
     FROM tags t
     LEFT JOIN post_tags pt ON t.id = pt.tag_id
     LEFT JOIN posts p ON pt.post_id = p.id AND p.status = 'published'
     GROUP BY t.id`
  ).all();
  return jsonResponseWithCache(0, tags.results || [], 'ok', 200, 'public, max-age=600');
}

async function listPostsByTag(env, path) {
  const slug = path.replace('/api/v1/tags/', '').replace('/posts', '');
  return listPosts(env, new URL(`https://x.com/api/v1/posts?tag=${encodeURIComponent(slug)}`));
}

async function register(request, env) {
  const body = await request.json();
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const email = body.email ? String(body.email).trim() : '';
  const code = body.code ? String(body.code).trim().toUpperCase() : '';

  const authSettings = (await getSetting(env, 'auth')) || {};
  if (authSettings.allowRegister === false) return jsonResponse(403, null, '当前已关闭注册');

  if (!username || !password) return jsonResponse(400, null, '用户名和密码必填');
  if (/[\u4e00-\u9fa5]/.test(username)) return jsonResponse(400, null, '用户名不能包含中文');
  if (password.length < 6) return jsonResponse(400, null, '密码至少 6 位');
  if (!email) return jsonResponse(400, null, '邮箱必填');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return jsonResponse(400, null, '邮箱格式不正确');

  if (authSettings.emailVerification === true) {
    if (!code) return jsonResponse(403, null, '请输入邮箱验证码');
    const record = await env.DB_USERS.prepare(
      'SELECT code, expires_at FROM verify_codes WHERE email = ?'
    )
      .bind(email)
      .first();
    if (!record) return jsonResponse(403, null, '请先获取邮箱验证码');
    if (record.code !== code) return jsonResponse(403, null, '验证码错误');
    const nowTime = new Date().toISOString();
    if (record.expires_at < nowTime) return jsonResponse(403, null, '验证码已过期');
    await env.DB_USERS.prepare('DELETE FROM verify_codes WHERE email = ?').bind(email).run();
  }

  
  const countRow = await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first();
  const role = countRow.c === 0 ? 'super_admin' : 'guest';

  const { salt, hash } = await hashPassword(password);
  const time = now();
  try {
    const result = await env.DB_USERS.prepare(
      'INSERT INTO users (username, email, email_verified, password_hash, password_salt, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(username, email, authSettings.emailVerification === true ? 1 : 0, hash, salt, role, 1, time, time)
      .run();
    const userId = result.meta ? result.meta.last_row_id : null;
    return jsonResponse(0, { id: userId, username, role }, '注册成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '用户名或邮箱已存在');
    }
    throw e;
  }
}

async function login(request, env) {
  const body = await request.json();
  const account = String(body.username || '').trim();
  const password = String(body.password || '');

  let user = await env.DB_USERS.prepare(
    'SELECT id, username, email, email_verified, avatar_base64, role, status, password_hash, password_salt FROM users WHERE username = ?'
  )
    .bind(account)
    .first();

  
  if (!user) {
    user = await env.DB_USERS.prepare(
      'SELECT id, username, email, email_verified, avatar_base64, role, status, password_hash, password_salt FROM users WHERE email = ?'
    )
      .bind(account)
      .first();
  }

  if (!user || user.status !== 1) return jsonResponse(401, null, '用户名或密码错误');
  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) return jsonResponse(401, null, '用户名或密码错误');

  const nowSec = Math.floor(Date.now() / 1000);
  const accessToken = await signJWT(
    { sub: user.id, username: user.username, role: user.role, type: 'access', iat: nowSec, exp: nowSec + 48 * 3600 },
    env.JWT_SECRET
  );
  const refreshToken = await signJWT(
    { sub: user.id, type: 'refresh', iat: nowSec, exp: nowSec + 7 * 24 * 3600 },
    env.JWT_SECRET
  );

  const tokenHash = await sha256Hex(refreshToken);
  const expiresAt = new Date((nowSec + 7 * 24 * 3600) * 1000).toISOString();
  await env.DB_USERS.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, tokenHash, expiresAt, now())
    .run();

  return jsonResponse(0, {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar_base64,
      role: user.role,
    },
  });
}

async function refreshToken(request, env) {
  const body = await request.json();
  const refreshToken = String(body.refreshToken || '');
  if (!refreshToken) return jsonResponse(400, null, 'Refresh token required');

  try {
    const payload = await verifyJWT(refreshToken, env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const tokenHash = await sha256Hex(refreshToken);
    const row = await env.DB_USERS.prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first();
    if (!row) return jsonResponse(401, null, 'Refresh token invalid');

    const user = await env.DB_USERS.prepare(
      'SELECT id, username, email, avatar_base64, role, status FROM users WHERE id = ?'
    )
      .bind(row.user_id)
      .first();
    if (!user || user.status !== 1) return jsonResponse(401, null, 'User invalid');

    const nowSec = Math.floor(Date.now() / 1000);
    const accessToken = await signJWT(
      { sub: user.id, username: user.username, role: user.role, type: 'access', iat: nowSec, exp: nowSec + 48 * 3600 },
      env.JWT_SECRET
    );

    
    await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).run();
    const refreshExpSec = nowSec + 30 * 24 * 3600;
    const newRefreshToken = await signJWT(
      { sub: user.id, type: 'refresh', iat: nowSec, exp: refreshExpSec },
      env.JWT_SECRET
    );
    const newRefreshTokenHash = await sha256Hex(newRefreshToken);
    await env.DB_USERS.prepare(
      'INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    )
      .bind(newRefreshTokenHash, user.id, new Date(refreshExpSec * 1000).toISOString())
      .run();

    return jsonResponse(0, {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        avatar: user.avatar_base64 || null,
        role: user.role,
      },
    });
  } catch {
    return jsonResponse(401, null, 'Refresh token invalid');
  }
}

async function logout(request, env) {
  
  let token = '';
  try {
    const body = await request.json();
    token = String(body?.refreshToken || body?.refresh_token || '');
  } catch {
    // 请求体为空或解析失败时忽略
  }

  if (!token) {
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }
  }

  if (token) {
    try {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      if (payload.type === 'refresh') {
        const tokenHash = await sha256Hex(token);
        await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).run();
      } else if (payload.sub) {
        
        await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(payload.sub).run();
      }
    } catch {
      // ignore
    }
  }
  return jsonResponse(0, null, 'Logged out');
}

async function getMe(request, env, user) {
  return jsonResponse(0, user);
}

async function getUserSettings(request, env, user) {
  let theme = null;
  let ui = null;
  try {
    theme = user.theme ? JSON.parse(user.theme) : null;
  } catch {
    theme = null;
  }
  try {
    ui = user.ui ? JSON.parse(user.ui) : null;
  } catch {
    ui = null;
  }
  return jsonResponseWithCache(0, { theme, ui }, 'ok', 200, 'private, max-age=30');
}

async function updateUserSettings(request, env, user) {
  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.theme !== undefined) {
    updates.push('theme = ?');
    params.push(JSON.stringify(body.theme));
  }
  if (body.ui !== undefined) {
    updates.push('ui = ?');
    params.push(JSON.stringify(body.ui));
    const avatar = body.ui?.profile?.avatar;
    if (avatar !== undefined) {
      updates.push('avatar_base64 = ?');
      params.push(avatar ? String(avatar) : null);
    }
  }

  if (updates.length === 0) return jsonResponse(400, null, '无更新内容');

  updates.push('updated_at = ?');
  params.push(now());
  params.push(user.id);

  await env.DB_USERS.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  return jsonResponse(0, null, '保存成功');
}

async function getDashboard(request, env, user) {
  const [postCount, tagCount, mediaCount, userCount] = await Promise.all([
    env.DB_POSTS.prepare("SELECT COUNT(*) as c FROM posts").first().then((r) => r.c),
    env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM tags').first().then((r) => r.c),
    env.DB_MEDIA.prepare('SELECT COUNT(*) as c FROM media').first().then((r) => r.c),
    env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first().then((r) => r.c),
  ]);
  const latestPosts = await env.DB_POSTS.prepare(
    'SELECT id, title, slug, status, created_at FROM posts ORDER BY created_at DESC LIMIT 5'
  ).all();
  return jsonResponse(0, {
    counts: { posts: postCount, tags: tagCount, media: mediaCount, users: userCount },
    latestPosts: latestPosts.results || [],
  });
}

async function listAdminPosts(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;

  const posts = await env.DB_POSTS.prepare(
    `SELECT id, title, slug, excerpt, status, views, reading_time, created_at, updated_at
     FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();
  const countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM posts').first();
  const list = await fillPostTags(env, posts.results || []);
  return jsonResponse(0, { list, total: countRow.c, page, limit });
}

async function getAdminPost(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const post = await env.DB_POSTS.prepare(
    `SELECT id, title, slug, excerpt, content, cover_base64, author_id, status, views, reading_time, created_at, updated_at
     FROM posts WHERE id = ?`
  )
    .bind(id)
    .first();
  if (!post) return jsonResponse(404, null, 'Post not found', 404);
  const list = await fillPostTags(env, [post]);
  return jsonResponse(0, list[0]);
}

async function listAdminTags(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;

  const tags = await env.DB_POSTS.prepare(
    `SELECT t.id, t.name, t.slug, t.color, COUNT(pt.post_id) as post_count
     FROM tags t
     LEFT JOIN post_tags pt ON t.id = pt.tag_id
     GROUP BY t.id
     ORDER BY t.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();
  const countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM tags').first();
  return jsonResponse(0, { list: tags.results || [], total: countRow.c, page, limit });
}

async function createPost(request, env, user) {
  const body = await request.json();
  const title = String(body.title || '').trim();
  let slug = String(body.slug || '').trim();
  const content = String(body.content || '');
  const excerpt = body.excerpt ? String(body.excerpt).trim() : content.slice(0, 160);
  const cover = body.coverBase64 || null;
  const tagIds = body.tagIds || [];
  const status = body.status === 'draft' ? 'draft' : 'published';

  if (!title || !content) return jsonResponse(400, null, '标题和内容必填');
  if (!slug) slug = slugify(title);
  if (!slug) slug = `post-${Date.now()}`;

  const time = now();
  try {
    const result = await env.DB_POSTS.prepare(
      'INSERT INTO posts (title, slug, excerpt, content, cover_base64, author_id, status, reading_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(title, slug, excerpt, content, cover, user.id, status, readingTime(content), time, time)
      .run();
    const postId = result.meta ? result.meta.last_row_id : null;

    for (const tagId of tagIds) {
      await env.DB_POSTS.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
        .bind(postId, tagId)
        .run();
    }

    return jsonResponse(0, { id: postId, slug }, '创建成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '文章 slug 已存在');
    }
    throw e;
  }
}

async function updatePost(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.title !== undefined) {
    updates.push('title = ?');
    params.push(String(body.title).trim());
  }
  if (body.slug !== undefined) {
    updates.push('slug = ?');
    params.push(String(body.slug).trim());
  }
  if (body.excerpt !== undefined) {
    updates.push('excerpt = ?');
    params.push(String(body.excerpt).trim());
  }
  if (body.content !== undefined) {
    updates.push('content = ?');
    params.push(String(body.content));
    updates.push('reading_time = ?');
    params.push(readingTime(String(body.content)));
  }
  if (body.coverBase64 !== undefined) {
    updates.push('cover_base64 = ?');
    params.push(body.coverBase64);
  }
  if (body.status !== undefined) {
    updates.push("status = ?");
    params.push(body.status === 'draft' ? 'draft' : 'published');
  }
  if (updates.length === 0) return jsonResponse(400, null, '无更新内容');

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  try {
    await env.DB_POSTS.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    if (body.tagIds !== undefined) {
      await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run();
      for (const tagId of body.tagIds) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
          .bind(id, tagId)
          .run();
      }
    }

    return jsonResponse(0, null, '更新成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '文章 slug 已存在');
    }
    throw e;
  }
}

async function deletePost(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM comments WHERE post_id = ?').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM likes WHERE post_id = ?').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}

async function createTag(request, env, user) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  let slug = String(body.slug || '').trim();
  const color = body.color ? String(body.color) : null;
  if (!name) return jsonResponse(400, null, '标签名必填');
  if (!slug) slug = slugify(name);
  if (!slug) slug = `tag-${Date.now()}`;

  try {
    const result = await env.DB_POSTS.prepare('INSERT INTO tags (name, slug, color) VALUES (?, ?, ?)')
      .bind(name, slug, color)
      .run();
    return jsonResponse(0, { id: result.meta ? result.meta.last_row_id : null, name, slug }, '创建成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '标签 slug 已存在');
    }
    throw e;
  }
}

async function updateTag(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const body = await request.json();
  const name = body.name !== undefined ? String(body.name).trim() : null;
  const slug = body.slug !== undefined ? String(body.slug).trim() : null;
  const color = body.color !== undefined ? String(body.color) : null;

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (slug) { updates.push('slug = ?'); params.push(slug); }
  if (color !== null) { updates.push('color = ?'); params.push(color); }
  if (updates.length === 0) return jsonResponse(400, null, '无更新内容');
  params.push(id);

  try {
    await env.DB_POSTS.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    return jsonResponse(0, null, '更新成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '标签 slug 已存在');
    }
    throw e;
  }
}

async function deleteTag(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE tag_id = ?').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}

async function updateSettings(request, env, user) {
  const body = await request.json();
  if (body.site) {
    const { hero, about, friends, ...siteRest } = body.site;
    await setSetting(env, 'site', siteRest);
    if (hero) await setSetting(env, 'hero', hero);
    if (about) await setSetting(env, 'about', about);
    if (friends) await setSetting(env, 'friends', friends);
  }
  return jsonResponse(0, null, '保存成功');
}



async function listAdminThemes(request, env, user) {
  const activeThemeId = (await getSetting(env, 'active_theme')) || '';
  let rows = { results: [] };
  try {
    rows = await env.DB_CONFIG.prepare(
      'SELECT id, name, source, content FROM themes ORDER BY updated_at DESC'
    ).all();
  } catch {
    rows = { results: [] };
  }
  const list = (rows.results || []).map((row) => {
    let previewImage = '';
    let description = '';
    let author = '';
    try {
      const content = JSON.parse(row.content || '{}');
      previewImage = content.previewImage || '';
      description = content.description || '';
      author = content.author || '';
    } catch {
      // ignore
    }
    return {
      id: row.id,
      name: row.name,
      source: row.source || '',
      previewImage,
      description,
      author,
      isActive: row.id === activeThemeId,
    };
  });
  return jsonResponse(0, list, 'ok');
}

async function getAdminTheme(request, env, user) {
  const id = new URL(request.url).pathname.split('/').filter(Boolean).pop();
  try {
    const row = await env.DB_CONFIG.prepare('SELECT content FROM themes WHERE id = ?').bind(id).first();
    if (!row) return jsonResponse(404, null, '主题不存在', 404);
    const content = JSON.parse(row.content || '{}');
    return jsonResponse(0, content, 'ok');
  } catch {
    return jsonResponse(500, null, '主题数据读取失败（主题表可能已移除）', 500);
  }
}

async function createAdminTheme(request, env, user) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();
    const name = String(body.name || '').trim();
    if (!id) return jsonResponse(400, null, '主题 ID 不能为空');
    if (!name) return jsonResponse(400, null, '主题名称不能为空');
    const content = JSON.stringify(body);
    const source = body.source || '';
    const exists = await env.DB_CONFIG.prepare('SELECT id FROM themes WHERE id = ?').bind(id).first();
    if (exists) {
      await env.DB_CONFIG.prepare(
        'UPDATE themes SET name = ?, source = ?, content = ?, updated_at = ? WHERE id = ?'
      )
        .bind(name, source, content, now(), id)
        .run();
    } else {
      await env.DB_CONFIG.prepare(
        'INSERT INTO themes (id, name, source, content, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, name, source, content, 0, now(), now())
        .run();
    }
    return jsonResponse(0, { id }, '保存成功');
  } catch {
    return jsonResponse(500, null, '主题保存失败（主题表可能已移除）', 500);
  }
}

async function updateAdminTheme(request, env, user) {
  try {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return jsonResponse(400, null, '主题名称不能为空');
    const content = JSON.stringify(body);
    const source = body.source || '';
    const exists = await env.DB_CONFIG.prepare('SELECT id FROM themes WHERE id = ?').bind(id).first();
    if (!exists) return jsonResponse(404, null, '主题不存在', 404);
    await env.DB_CONFIG.prepare(
      'UPDATE themes SET name = ?, source = ?, content = ?, updated_at = ? WHERE id = ?'
    )
      .bind(name, source, content, now(), id)
      .run();
    return jsonResponse(0, null, '更新成功');
  } catch {
    return jsonResponse(500, null, '主题更新失败（主题表可能已移除）', 500);
  }
}

async function applyAdminTheme(request, env, user) {
  const pathParts = new URL(request.url).pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 2];
  
  let postCard = null;
  try {
    const body = await request.json();
    if (body && body.postCard) postCard = body.postCard;
    else if (body && body.components && body.components.postCard) postCard = body.components.postCard;
  } catch {
    postCard = null;
  }
  if (!postCard) {
    try {
      const row = await env.DB_CONFIG.prepare('SELECT content FROM themes WHERE id = ?').bind(id).first();
      if (!row) return jsonResponse(404, null, '主题不存在', 404);
      const themeContent = JSON.parse(row.content || '{}');
      postCard = themeContent.components && themeContent.components.postCard ? themeContent.components.postCard : {};
    } catch {
      return jsonResponse(500, null, '主题数据读取失败（主题表可能已移除）', 500);
    }
  }
  await setSetting(env, 'active_theme', id);
  const site = (await getSetting(env, 'site')) || {};
  await setSetting(env, 'site', { ...site, cardTheme: { ...(site.cardTheme || {}), ...postCard } });
  return jsonResponse(0, null, '主题已应用');
}

async function deleteAdminTheme(request, env, user) {
  try {
    const id = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    await env.DB_CONFIG.prepare('DELETE FROM themes WHERE id = ?').bind(id).run();
    const activeThemeId = (await getSetting(env, 'active_theme')) || '';
    if (activeThemeId === id) {
      await setSetting(env, 'active_theme', '');
    }
    return jsonResponse(0, null, '删除成功');
  } catch {
    return jsonResponse(500, null, '主题删除失败（主题表可能已移除）', 500);
  }
}

async function clearAdminActiveTheme(request, env, user) {
  await setSetting(env, 'active_theme', '');
  const site = (await getSetting(env, 'site')) || {};
  await setSetting(env, 'site', { ...site, cardTheme: defaultSiteConfig.cardTheme });
  return jsonResponse(0, null, '已恢复默认主题');
}

const MAX_MEDIA_CHUNK_SIZE = 80 * 1024; 

async function uploadMedia(request, env, user) {
  const body = await request.json();
  const name = String(body.name || 'image.jpg');
  const mimeType = String(body.mimeType || 'image/jpeg');
  const base64 = String(body.base64 || '');
  const width = body.width ? parseInt(body.width, 10) : null;
  const height = body.height ? parseInt(body.height, 10) : null;

  if (!base64) return jsonResponse(400, null, '图片数据为空');
  if (!mimeType.startsWith('image/')) return jsonResponse(400, null, '仅支持图片');
  if (base64.length > MAX_MEDIA_CHUNK_SIZE) {
    return jsonResponse(413, null, '图片超过单接口上限，请使用分片上传');
  }

  const size = Math.floor(base64.length * 0.75);
  const result = await env.DB_MEDIA.prepare(
    'INSERT INTO media (name, mime_type, size, base64_data, width, height, chunk_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(name, mimeType, size, base64, width, height, 0, now())
    .run();

  const id = result.meta ? result.meta.last_row_id : null;
  return jsonResponse(0, { id, url: `/api/v1/media/${id}`, size }, '上传成功');
}

async function initMediaUpload(request, env, user) {
  const body = await request.json();
  const name = String(body.name || 'image.jpg');
  const mimeType = String(body.mimeType || 'image/jpeg');
  const size = parseInt(body.size || '0', 10);
  const chunkCount = parseInt(body.chunkCount || '0', 10);
  const width = body.width ? parseInt(body.width, 10) : null;
  const height = body.height ? parseInt(body.height, 10) : null;

  if (!chunkCount || chunkCount <= 0) return jsonResponse(400, null, '分片数量无效');
  if (!size) return jsonResponse(400, null, '文件大小无效');
  if (!mimeType.startsWith('image/')) return jsonResponse(400, null, '仅支持图片');

  const result = await env.DB_MEDIA.prepare(
    'INSERT INTO media (name, mime_type, size, base64_data, width, height, chunk_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(name, mimeType, size, '', width, height, chunkCount, now())
    .run();

  const id = result.meta ? result.meta.last_row_id : null;
  return jsonResponse(0, { id }, '初始化成功');
}

async function uploadMediaChunk(request, env, user) {
  const pathParts = new URL(request.url).pathname.split('/');
  const mediaId = parseInt(pathParts[pathParts.length - 1], 10);
  if (!mediaId) return jsonResponse(400, null, '媒体 ID 无效');

  const body = await request.json();
  const chunkIndex = parseInt(body.chunkIndex ?? body.chunk_index ?? '0', 10);
  const chunkData = String(body.chunkData ?? body.chunk_data ?? '');

  if (!chunkData) return jsonResponse(400, null, '分片数据为空');
  if (chunkData.length > MAX_MEDIA_CHUNK_SIZE) return jsonResponse(413, null, '分片过大');

  await env.DB_MEDIA.prepare(
    'INSERT INTO media_chunks (media_id, chunk_index, chunk_data, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(mediaId, chunkIndex, chunkData, now())
    .run();

  return jsonResponse(0, null, '分片上传成功');
}

async function finalizeMediaUpload(request, env, user) {
  const pathParts = new URL(request.url).pathname.split('/');
  const mediaId = parseInt(pathParts[pathParts.length - 1], 10);
  if (!mediaId) return jsonResponse(400, null, '媒体 ID 无效');

  const media = await env.DB_MEDIA.prepare('SELECT chunk_count FROM media WHERE id = ?')
    .bind(mediaId)
    .first();
  if (!media) return jsonResponse(404, null, '媒体不存在');

  const chunkRows = await env.DB_MEDIA.prepare(
    'SELECT chunk_index FROM media_chunks WHERE media_id = ? ORDER BY chunk_index ASC'
  )
    .bind(mediaId)
    .all();

  const uploaded = new Set((chunkRows.results || []).map((r) => r.chunk_index));
  const missing = [];
  for (let i = 0; i < media.chunk_count; i++) {
    if (!uploaded.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    return jsonResponse(400, { missing }, `缺少分片: ${missing.join(', ')}`);
  }

  return jsonResponse(0, { id: mediaId, url: `/api/v1/media/${mediaId}` }, '上传完成');
}

async function getMedia(env, id, request, ctx) {
  const cacheKey = new URL(request.url);
  let response;
  try {
    response = await caches.default.match(cacheKey);
    if (response) return response;
  } catch {
    // 缓存读取失败时继续回源
  }

  const row = await env.DB_MEDIA.prepare(
    'SELECT id, name, mime_type, size, base64_data, width, height, chunk_count FROM media WHERE id = ?'
  )
    .bind(id)
    .first();
  if (!row) return new Response('Not found', { status: 404 });

  const mimeType = String(row.mime_type || 'image/jpeg');
  let base64 = String(row.base64_data || '');

  if (row.chunk_count > 0) {
    const chunkRows = await env.DB_MEDIA.prepare(
      'SELECT chunk_data FROM media_chunks WHERE media_id = ? ORDER BY chunk_index ASC'
    )
      .bind(id)
      .all();
    const chunks = (chunkRows.results || []).map((r) => String(r.chunk_data || ''));
    if (chunks.length !== row.chunk_count) {
      return new Response('Media incomplete', { status: 500 });
    }
    base64 = chunks.join('');
  }

  if (!base64) {
    return new Response('Media data empty', { status: 500 });
  }

  let binary;
  try {
    binary = Uint8Array.from(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  } catch (e) {
    return new Response('Media decode failed', { status: 500 });
  }
  response = new Response(binary, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': String(binary.length),
    },
  });

  try {
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  } catch {
    // 缓存写入失败不影响响应
  }
  return response;
}

async function deleteMedia(request, env, user) {
  const pathParts = new URL(request.url).pathname.split('/');
  const mediaId = parseInt(pathParts[pathParts.length - 1], 10);
  if (!mediaId) return jsonResponse(400, null, '媒体 ID 无效');

  const row = await env.DB_MEDIA.prepare('SELECT id FROM media WHERE id = ?').bind(mediaId).first();
  if (!row) return jsonResponse(404, null, '媒体不存在');

  await env.DB_MEDIA.prepare('DELETE FROM media_chunks WHERE media_id = ?').bind(mediaId).run();
  await env.DB_MEDIA.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();

  
  try {
    const publicUrl = new URL(`/api/v1/media/${mediaId}`, request.url);
    await caches.default.delete(publicUrl);
  } catch {
    // 缓存清理失败不影响删除结果
  }

  return jsonResponse(0, null, '删除成功');
}

async function getMediaBindings(env, mediaId) {
  const urlPattern = `/api/v1/media/${mediaId}`;
  const bindings = [];

  
  const posts = await env.DB_POSTS.prepare(
    `SELECT id, title, slug, cover_base64, content FROM posts
     WHERE cover_base64 LIKE ? OR content LIKE ?`
  )
    .bind(`%${urlPattern}%`, `%${urlPattern}%`)
    .all();
  for (const p of posts.results || []) {
    bindings.push({
      type: 'post',
      id: p.id,
      title: p.title,
      slug: p.slug,
      field: p.cover_base64 && p.cover_base64.includes(urlPattern) ? 'cover' : 'content',
    });
  }

  
  const users = await env.DB_USERS.prepare(
    `SELECT id, username, avatar_base64 FROM users WHERE avatar_base64 LIKE ?`
  )
    .bind(`%${urlPattern}%`)
    .all();
  for (const u of users.results || []) {
    bindings.push({ type: 'user', id: u.id, name: u.username });
  }

  
  const friends = await env.DB_CONFIG.prepare(
    `SELECT id, name, avatar FROM friends WHERE avatar LIKE ?`
  )
    .bind(`%${urlPattern}%`)
    .all();
  for (const f of friends.results || []) {
    bindings.push({ type: 'friend', id: f.id, name: f.name });
  }

  
  try {
    const site = (await getSetting(env, 'site')) || {};
    const hero = (await getSetting(env, 'hero')) || {};
    const about = (await getSetting(env, 'about')) || {};

    const check = (key, value) => {
      if (typeof value === 'string' && value.includes(urlPattern)) {
        bindings.push({ type: 'site', key });
      }
    };
    check('site.logo', site.logo);
    check('site.favicon', site.favicon);
    check('site.shareImage', site.shareImage);
    check('hero.backgroundImage', hero.backgroundImage);
    check('about.avatar', about.avatar);
  } catch {
    // 配置读取失败不影响绑定结果
  }

  return bindings;
}

async function listAdminMedia(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;

  const media = await env.DB_MEDIA.prepare(
    `SELECT id, name, mime_type, size, width, height, chunk_count, created_at
     FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();
  const countRow = await env.DB_MEDIA.prepare('SELECT COUNT(*) as c FROM media').first();

  return jsonResponse(0, { list: media.results || [], total: countRow.c, page, limit });
}

async function getAdminMediaUsage(request, env, user) {
  try {
    const row = await env.DB_MEDIA.prepare(
      'SELECT COALESCE(SUM(size), 0) as total, COUNT(*) as count FROM media'
    ).first();
    
    const totalSize = Math.floor(Number(row.total) * 1.42);
    return jsonResponse(0, { totalSize, count: row.count });
  } catch (err) {
    return jsonResponse(500, null, `统计媒体用量失败: ${err.message}`);
  }
}

async function getAdminMediaUsageDetail(request, env, user) {
  try {
    const rawRow = await env.DB_MEDIA.prepare(
      'SELECT COALESCE(SUM(size), 0) as total FROM media'
    ).first();
    const mediaRow = await env.DB_MEDIA.prepare(
      'SELECT COALESCE(SUM(LENGTH(base64_data)), 0) as total FROM media'
    ).first();
    const chunksRow = await env.DB_MEDIA.prepare(
      'SELECT COALESCE(SUM(LENGTH(chunk_data)), 0) as total FROM media_chunks'
    ).first();
    const countRow = await env.DB_MEDIA.prepare('SELECT COUNT(*) as count FROM media').first();
    const rawSize = Number(rawRow.total);
    const base64Size = Number(mediaRow.total);
    const chunkSize = Number(chunksRow.total);
    const totalSize = base64Size + chunkSize;
    return jsonResponse(0, {
      rawSize,
      base64Size,
      chunkSize,
      totalSize,
      count: countRow.count,
      ratio: rawSize > 0 ? Number((totalSize / rawSize).toFixed(2)) : 0,
    });
  } catch (err) {
    return jsonResponse(500, null, `精确统计媒体用量失败: ${err.message}`);
  }
}

async function getAdminMedia(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '媒体 ID 无效');

  const row = await env.DB_MEDIA.prepare(
    `SELECT id, name, mime_type, size, width, height, chunk_count, created_at
     FROM media WHERE id = ?`
  )
    .bind(id)
    .first();
  if (!row) return jsonResponse(404, null, '媒体不存在', 404);

  const bindings = await getMediaBindings(env, id);
  return jsonResponse(0, { ...row, bindings });
}

async function updateAdminMedia(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '媒体 ID 无效');

  const row = await env.DB_MEDIA.prepare('SELECT id, name FROM media WHERE id = ?').bind(id).first();
  if (!row) return jsonResponse(404, null, '媒体不存在', 404);

  const body = await request.json();
  const rawBase64 = String(body.base64 || '');
  const mimeType = String(body.mimeType || 'image/jpeg');
  const width = body.width ? parseInt(body.width, 10) : null;
  const height = body.height ? parseInt(body.height, 10) : null;
  const name = body.name ? String(body.name) : row.name;

  if (!rawBase64) return jsonResponse(400, null, '图片数据为空');
  if (!mimeType.startsWith('image/')) return jsonResponse(400, null, '仅支持图片');

  
  const base64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
  if (!base64) return jsonResponse(400, null, '图片数据为空');

  const size = Math.floor(base64.length * 0.75);

  
  await env.DB_MEDIA.prepare('DELETE FROM media_chunks WHERE media_id = ?').bind(id).run();

  if (base64.length <= MAX_MEDIA_CHUNK_SIZE) {
    
    await env.DB_MEDIA.prepare(
      `UPDATE media SET name = ?, mime_type = ?, size = ?, base64_data = ?, width = ?, height = ?, chunk_count = 0, created_at = ?
       WHERE id = ?`
    )
      .bind(name, mimeType, size, base64, width, height, now(), id)
      .run();
  } else {
    
    const chunkCount = Math.ceil(base64.length / MAX_MEDIA_CHUNK_SIZE);
    await env.DB_MEDIA.prepare(
      `UPDATE media SET name = ?, mime_type = ?, size = ?, base64_data = ?, width = ?, height = ?, chunk_count = ?, created_at = ?
       WHERE id = ?`
    )
      .bind(name, mimeType, size, '', width, height, chunkCount, now(), id)
      .run();

    for (let i = 0; i < chunkCount; i++) {
      const chunkData = base64.slice(i * MAX_MEDIA_CHUNK_SIZE, (i + 1) * MAX_MEDIA_CHUNK_SIZE);
      await env.DB_MEDIA.prepare(
        'INSERT INTO media_chunks (media_id, chunk_index, chunk_data, created_at) VALUES (?, ?, ?, ?)'
      )
        .bind(id, i, chunkData, now())
        .run();
    }
  }

  
  try {
    const publicUrl = new URL(`/api/v1/media/${id}`, request.url);
    await caches.default.delete(publicUrl);
  } catch {
    // 缓存清理失败不影响更新结果
  }

  return jsonResponse(0, { id, url: `/api/v1/media/${id}`, size }, '替换成功');
}

async function listDatabases(request, env, user) {
  const bindings = [];
  if (env.DB_USERS) bindings.push({ binding: 'DB_USERS', name: 'myblog-users' });
  if (env.DB_POSTS) bindings.push({ binding: 'DB_POSTS', name: 'myblog-posts' });
  if (env.DB_CONFIG) bindings.push({ binding: 'DB_CONFIG', name: 'myblog-config' });
  if (env.DB_MEDIA) bindings.push({ binding: 'DB_MEDIA', name: 'myblog-media' });

  
  const stats = {};
  try {
    stats.users = (await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first()).c;
    stats.refresh_tokens = (await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM refresh_tokens').first()).c;
  } catch {
    stats.users = -1;
  }
  try {
    stats.posts = (await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM posts').first()).c;
    stats.tags = (await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM tags').first()).c;
  } catch {
    stats.posts = -1;
  }
  try {
    stats.settings = (await env.DB_CONFIG.prepare('SELECT COUNT(*) as c FROM settings').first()).c;
  } catch {
    stats.settings = -1;
  }
  try {
    stats.media = (await env.DB_MEDIA.prepare('SELECT COUNT(*) as c FROM media').first()).c;
  } catch {
    stats.media = -1;
  }

  return jsonResponse(0, { bindings, stats, version: VERSION });
}

async function getSystemStatus(request, env, user) {
  const initialized = await getSystem(env, 'initialized');
  return jsonResponse(0, {
    version: VERSION,
    initialized: initialized === '1',
    role: user.role,
    timestamp: now(),
  });
}



const defaultAuthSettings = {
  allowRegister: true,
  emailVerification: false,
};

async function getAuthSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'auth')) || {};
    return jsonResponseWithCache(0, { ...defaultAuthSettings, ...data }, 'ok', 200, 'public, max-age=60');
  } catch (err) {
    if (isBindingError(err)) {
      console.error('读取认证设置失败，返回默认设置:', err);
      return jsonResponse(0, { ...defaultAuthSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateAuthSettings(request, env, user) {
  const body = await request.json();
  const data = {
    allowRegister: body.allowRegister !== false,
    emailVerification: body.emailVerification === true,
  };
  await setSetting(env, 'auth', data);
  return jsonResponse(0, data, '保存成功');
}



const defaultEmailSettings = {
  provider: 'resend',
  from: '',
  fromName: '',
  resendApiKey: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: false,
};

async function getEmailSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'email')) || {};
    
    return jsonResponse(0, { ...defaultEmailSettings, ...data }, 'ok');
  } catch (err) {
    if (isBindingError(err)) {
      console.error('读取邮箱配置失败，返回默认配置:', err);
      return jsonResponse(0, { ...defaultEmailSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateEmailSettings(request, env, user) {
  const body = await request.json();
  const data = {
    provider: String(body.provider || 'resend'),
    from: String(body.from || ''),
    fromName: String(body.fromName || ''),
    resendApiKey: String(body.resendApiKey || ''),
    smtpHost: String(body.smtpHost || ''),
    smtpPort: parseInt(body.smtpPort || '587', 10) || 587,
    smtpUser: String(body.smtpUser || ''),
    smtpPass: String(body.smtpPass || ''),
    smtpSecure: body.smtpSecure === true,
  };
  await setSetting(env, 'email', data);
  return jsonResponse(0, data, '保存成功');
}

const defaultEmailTemplate = {
  subject: '您的注册验证码',
  html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>注册验证码</title>
</head>
<body style='margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;'>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(91,124,250,0.12);">
          <tr>
            <td style="padding:40px 32px 32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;font-weight:700;">{{siteName}}</h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">{{siteTitle}}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">您好，<strong>{{username}}</strong>：</p>
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">感谢您注册 {{siteName}}，请在 {{expireMinutes}} 分钟内使用以下验证码完成注册：</p>
              <div style="text-align:center;padding:24px 0;">
                <table cellpadding="0" cellspacing="0" border="0" bgcolor="#5b7cfa" style="background-color:#5b7cfa;border-radius:12px;display:inline-block;">
                  <tr>
                    <td style="padding:16px 32px;text-align:center;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;line-height:1;">{{code}}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">如果这不是您本人的操作，请忽略此邮件。验证码仅用于注册验证，请勿泄露给他人。</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">本邮件由 {{siteName}} 自动发送</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  text: '您好，{{username}}：感谢您注册 {{siteName}}，验证码是 {{code}}，{{expireMinutes}} 分钟内有效。如非本人操作请忽略。',
};

function applyEmailTemplate(template, variables) {
  let subject = template.subject || defaultEmailTemplate.subject;
  let html = template.html || defaultEmailTemplate.html;
  let text = template.text || defaultEmailTemplate.text;
  for (const [key, value] of Object.entries(variables)) {
    const reg = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    subject = subject.replace(reg, String(value));
    html = html.replace(reg, String(value));
    text = text.replace(reg, String(value));
  }
  return { subject, html, text };
}

async function getEmailTemplateSettings(request, env, user) {
  try {
    const db = getConfigDb(env);
    const usedSession = env.DB_CONFIG && typeof env.DB_CONFIG.withSession === 'function';
    const [subjectRow, htmlRow, textRow] = await Promise.all([
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_subject').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_html').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_text').first(),
    ]);
    const data = {
      subject: subjectRow?.value || null,
      html: htmlRow?.value || null,
      text: textRow?.value || null,
    };
    const hasAny = data.subject || data.html || data.text;
    return jsonResponse(
      0,
      {
        subject: data.subject || defaultEmailTemplate.subject,
        html: data.html || defaultEmailTemplate.html,
        text: data.text || defaultEmailTemplate.text,
        _debug: {
          source: hasAny ? 'split_fields' : 'default',
          hasSubject: !!data.subject,
          hasHtml: !!data.html,
          hasText: !!data.text,
          usedSession,
        },
      },
      'ok'
    );
  } catch (err) {
    
    if (isBindingError(err)) {
      console.error('读取邮件模板失败，返回默认模板:', err);
      return jsonResponse(0, { ...defaultEmailTemplate, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateEmailTemplateSettings(request, env, user) {
  const body = await request.json();
  const db = getConfigDb(env);
  const ts = now();
  const data = {
    subject: String(body.subject || defaultEmailTemplate.subject),
    html: String(body.html || defaultEmailTemplate.html),
    text: String(body.text || defaultEmailTemplate.text),
  };
  
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind('email_subject', data.subject, ts).run();
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind('email_html', data.html, ts).run();
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind('email_text', data.text, ts).run();
  return jsonResponse(0, data, '保存成功');
}

async function sendEmailByProvider(env, to, subject, text, html) {
  const settings = (await getSetting(env, 'email')) || {};
  const provider = settings.provider || 'resend';

  if (!settings.from) {
    throw new Error('未配置发件人邮箱');
  }

  
  const sendPromise = (async () => {
    if (provider === 'smtp') {
      return sendEmailBySMTP(settings, to, subject, text, html);
    }

    if (provider !== 'resend') {
      throw new Error(`暂不支持的邮件服务商：${provider}`);
    }
    if (!settings.resendApiKey) {
      throw new Error('未配置 Resend API Key');
    }

    const from = settings.fromName ? `${settings.fromName} <${settings.from}>` : settings.from;
    const payload = {
      from,
      to,
      subject,
      text,
    };
    if (html) payload.html = html;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.resendApiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }
    return true;
  })();

  return withTimeout(sendPromise, 25000, '邮件发送');
}



function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildMimeMessage({ from, fromName, to, subject, text, html }) {
  const boundary = '----=_Part_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  const fromHeader = fromName ? `${fromName} <${from}>` : from;
  const encodeHeader = (value) => {
    if (/^[\x00-\x7f]+$/.test(value)) return value;
    return '=?UTF-8?B?' + utf8ToBase64(value) + '?=';
  };

  let body = [
    'MIME-Version: 1.0',
    `From: ${encodeHeader(fromHeader)}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(text),
  ];

  if (html) {
    body = body.concat([
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      utf8ToBase64(html),
    ]);
  }

  body = body.concat([`--${boundary}--`, '']);
  return body.join('\r\n');
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function smtpReadLine(reader) {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) throw new Error('SMTP 连接被意外关闭');
    buffer += decoder.decode(value, { stream: true });
    const idx = buffer.indexOf('\r\n');
    if (idx >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      return line;
    }
  }
}

async function smtpReadResponse(reader, expectedCode, timeoutMs = 15000) {
  while (true) {
    const line = await withTimeout(smtpReadLine(reader), timeoutMs, 'SMTP 读取响应');
    if (!line) continue;
    const code = parseInt(line.slice(0, 3), 10);
    if (Number.isNaN(code)) throw new Error(`SMTP 响应异常：${line}`);
    if (expectedCode && code !== expectedCode) {
      throw new Error(`SMTP 错误 ${code}：${line}`);
    }
    if (line[3] === ' ') return { code, line };
  }
}

async function smtpSend(writer, line) {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(line + '\r\n'));
}


async function smtpReadEhloCapabilities(reader, writer, ehloHost, timeoutMs = 15000) {
  await smtpSend(writer, `EHLO ${ehloHost}`);
  const lines = [];
  while (true) {
    const line = await withTimeout(smtpReadLine(reader), timeoutMs, 'SMTP 读取 EHLO 响应');
    if (!line) continue;
    const code = parseInt(line.slice(0, 3), 10);
    if (Number.isNaN(code)) throw new Error(`SMTP EHLO 响应异常：${line}`);
    if (code !== 250) throw new Error(`SMTP EHLO 失败 ${code}：${line}`);
    lines.push(line);
    if (line[3] === ' ') break;
  }
  const caps = { auth: [] };
  for (const line of lines) {
    const m = line.match(/^250[ -]([A-Z0-9_]+)(?: |$)/i);
    if (!m) continue;
    const name = m[1].toUpperCase();
    const value = line.slice(m[0].length).trim();
    if (name === 'AUTH') {
      caps.auth = value.toUpperCase().split(/\s+/).filter(Boolean);
    } else {
      caps[name] = value;
    }
  }
  return caps;
}

async function smtpAuthPlain(reader, writer, user, pass) {
  const authPlain = utf8ToBase64(`\u0000${user}\u0000${pass}`);
  await smtpSend(writer, `AUTH PLAIN ${authPlain}`);
  await smtpReadResponse(reader, 235, 15000);
}

async function smtpAuthLogin(reader, writer, user, pass) {
  await smtpSend(writer, 'AUTH LOGIN');
  await smtpReadResponse(reader, 334, 15000);
  await smtpSend(writer, utf8ToBase64(user));
  await smtpReadResponse(reader, 334, 15000);
  await smtpSend(writer, utf8ToBase64(pass));
  await smtpReadResponse(reader, 235, 15000);
}

async function sendEmailBySMTP(settings, to, subject, text, html) {
  const host = String(settings.smtpHost || '').trim();
  const port = parseInt(settings.smtpPort || '587', 10) || 587;
  const user = String(settings.smtpUser || '');
  const pass = String(settings.smtpPass || '');
  const secure = settings.smtpSecure === true;
  const from = String(settings.from || '');
  const fromName = String(settings.fromName || '');

  if (!host) throw new Error('未配置 SMTP 服务器');
  if (!user) throw new Error('未配置 SMTP 用户名');
  if (!pass) throw new Error('未配置 SMTP 密码');

  const message = buildMimeMessage({ from, fromName, to, subject, text, html });

  
  let secureTransport;
  if (port === 465) {
    secureTransport = 'on';
  } else if (port === 587) {
    secureTransport = 'starttls';
  } else {
    secureTransport = secure ? 'on' : 'off';
  }

  
  const ehloHost = from.includes('@') ? from.split('@')[1] : 'cloudflare-workers';

  let socket;
  try {
    socket = connect({ hostname: host, port }, { secureTransport });
  } catch (e) {
    throw new Error(`无法连接 SMTP 服务器：${e.message}`);
  }

  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();

  try {
    
    await smtpReadResponse(reader, 220, 15000);

    
    let caps = await smtpReadEhloCapabilities(reader, writer, ehloHost, 15000);

    
    if (secureTransport === 'starttls') {
      if (caps.STARTTLS === undefined) {
        throw new Error('SMTP 服务器未声明 STARTTLS 支持');
      }
      await smtpSend(writer, 'STARTTLS');
      await smtpReadResponse(reader, 220, 15000);

      
      
      try { reader.releaseLock(); } catch {}
      try { writer.releaseLock(); } catch {}

      let secureSocket;
      try {
        secureSocket = socket.startTls();
      } catch (e) {
        throw new Error(`STARTTLS 升级失败：${e.message}`);
      }
      socket = secureSocket; 
      reader = secureSocket.readable.getReader();
      writer = secureSocket.writable.getWriter();
      caps = await smtpReadEhloCapabilities(reader, writer, ehloHost, 15000);
    }

    if (user && pass) {
      if (!caps.auth.length) {
        throw new Error('SMTP 服务器未声明任何认证方式');
      }
      if (caps.auth.includes('PLAIN')) {
        await smtpAuthPlain(reader, writer, user, pass);
      } else if (caps.auth.includes('LOGIN')) {
        await smtpAuthLogin(reader, writer, user, pass);
      } else {
        throw new Error(`SMTP 服务器不支持的认证方式：${caps.auth.join(', ')}`);
      }
    }

    await smtpSend(writer, `MAIL FROM:<${from}>`);
    await smtpReadResponse(reader, 250, 15000);
    await smtpSend(writer, `RCPT TO:<${to}>`);
    await smtpReadResponse(reader, 250, 15000);
    await smtpSend(writer, 'DATA');
    await smtpReadResponse(reader, 354, 15000);

    
    const escapedMessage = message
      .split('\r\n')
      .map((line) => (line.startsWith('.') ? '.' + line : line))
      .join('\r\n');
    await smtpSend(writer, escapedMessage + '\r\n.');
    await smtpReadResponse(reader, 250, 30000);

    await smtpSend(writer, 'QUIT');
  } catch (e) {
    
    throw new Error(e.message || 'SMTP 发送失败');
  } finally {
    try { await writer.close(); } catch {}
    try { await reader.cancel(); } catch {}
    try { await socket.close(); } catch {}
  }

  return true;
}

async function sendVerifyCode(request, env) {
  const body = await request.json();
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();

  if (!username) return jsonResponse(400, null, '用户名必填');
  if (/[\u4e00-\u9fa5]/.test(username)) return jsonResponse(400, null, '用户名不能包含中文');
  if (!email) return jsonResponse(400, null, '邮箱必填');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return jsonResponse(400, null, '邮箱格式不正确');

  const existingUser = await env.DB_USERS.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  )
    .bind(username, email)
    .first();
  if (existingUser) return jsonResponse(409, null, '用户名或邮箱已被注册');

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await env.DB_USERS.prepare(
    'INSERT INTO verify_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, created_at = excluded.created_at'
  )
    .bind(email, code, expiresAt, now())
    .run();

  const emailSettings = (await getSetting(env, 'email')) || {};
  const provider = emailSettings.provider || 'resend';
  const emailConfigured =
    (provider === 'resend' && !!emailSettings.resendApiKey && !!emailSettings.from) ||
    (provider === 'smtp' &&
      !!emailSettings.from &&
      !!emailSettings.smtpHost &&
      !!emailSettings.smtpUser &&
      !!emailSettings.smtpPass);

  if (!emailConfigured) {
    return jsonResponse(503, { sent: false }, '邮件服务未配置，无法发送验证码');
  }

  try {
    const db = getConfigDb(env);
    const [subjectRow, htmlRow, textRow] = await Promise.all([
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_subject').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_html').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_text').first(),
    ]);
    const template = {
      subject: subjectRow?.value || '',
      html: htmlRow?.value || '',
      text: textRow?.value || '',
    };
    const site = (await getSetting(env, 'site')) || {};
    const expireMinutes = 10;
    const { subject, html, text } = applyEmailTemplate(template, {
      username,
      email,
      code,
      expireMinutes,
      siteName: site.siteName || '站点',
      siteTitle: site.siteName || '站点',
    });
    await sendEmailByProvider(env, email, subject, text, html);
  } catch (e) {
    console.error(e);
    if (emailConfigured) {
      return jsonResponse(500, { sent: false }, `邮件发送失败：${e.message || '未知错误'}`);
    }
    // 未配置邮件服务时，仅记录验证码，不阻止注册流程
  }

  return jsonResponse(0, { sent: true }, '验证码已发送');
}



async function getPostIdBySlug(env, slug) {
  const row = await env.DB_POSTS.prepare('SELECT id FROM posts WHERE slug = ? AND status = ?')
    .bind(slug, 'published')
    .first();
  return row ? row.id : null;
}

async function getUserMap(env, userIds) {
  const map = {};
  if (!userIds.length) return map;
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await env.DB_USERS.prepare(
    `SELECT id, username, avatar_base64 FROM users WHERE id IN (${placeholders})`
  )
    .bind(...userIds)
    .all();
  for (const row of rows.results || []) {
    map[row.id] = row;
  }
  return map;
}

async function getPostMap(env, postIds) {
  const map = {};
  if (!postIds.length) return map;
  const placeholders = postIds.map(() => '?').join(',');
  const rows = await env.DB_POSTS.prepare(`SELECT id, title, slug FROM posts WHERE id IN (${placeholders})`)
    .bind(...postIds)
    .all();
  for (const row of rows.results || []) {
    map[row.id] = row;
  }
  return map;
}

async function getInteractionSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'interaction')) || {};
    return jsonResponseWithCache(
      0,
      { ...defaultInteractionSettings, ...data },
      'ok',
      200,
      'public, max-age=60'
    );
  } catch (err) {
    if (isBindingError(err)) {
      console.error('读取互动设置失败，返回默认设置:', err);
      return jsonResponse(0, { ...defaultInteractionSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateInteractionSettings(request, env, user) {
  const body = await request.json();
  const data = {
    commentsEnabled: body.commentsEnabled !== false,
    likesEnabled: body.likesEnabled !== false,
    commentAudit: body.commentAudit === true,
  };
  await setSetting(env, 'interaction', data);
  return jsonResponse(0, data, '保存成功');
}

async function listComments(env, url, path) {
  const slug = path.replace('/api/v1/posts/', '').replace('/comments', '');
  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const comments = await env.DB_POSTS.prepare(
    `SELECT id, post_id, user_id, content, status, created_at, updated_at
     FROM comments
     WHERE post_id = ? AND status = 'approved'
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(postId, limit, offset)
    .all();

  const countRow = await env.DB_POSTS.prepare(
    "SELECT COUNT(*) as c FROM comments WHERE post_id = ? AND status = 'approved'"
  )
    .bind(postId)
    .first();

  const list = comments.results || [];
  const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))];
  const userMap = await getUserMap(env, userIds);

  const results = list.map((c) => ({
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    content: c.content,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    username: userMap[c.user_id]?.username || '未知用户',
    avatar: userMap[c.user_id]?.avatar_base64 || null,
  }));

  return jsonResponse(0, { list: results, total: countRow.c, page, limit });
}

async function createComment(request, env, user) {
  const path = new URL(request.url).pathname;
  const slug = path.replace('/api/v1/posts/', '').replace('/comments', '');
  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  const settings = (await getSetting(env, 'interaction')) || {};
  if (settings.commentsEnabled === false) return jsonResponse(403, null, '评论功能已关闭');

  const body = await request.json();
  const content = String(body.content || '').trim();
  if (!content) return jsonResponse(400, null, '评论内容不能为空');
  if (content.length > 2000) return jsonResponse(400, null, '评论内容不能超过 2000 字');

  const status = settings.commentAudit === false ? 'approved' : 'pending';
  const time = now();

  const result = await env.DB_POSTS.prepare(
    'INSERT INTO comments (post_id, user_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(postId, user.id, content, status, time, time)
    .run();

  return jsonResponse(0, { id: result.meta ? result.meta.last_row_id : null, status }, '评论成功');
}

async function deleteComment(request, env, user) {
  const path = new URL(request.url).pathname;
  const match = path.match(/\/api\/v1\/posts\/([^/]+)\/comments\/(\d+)/);
  if (!match) return jsonResponse(400, null, '路径无效');
  const slug = match[1];
  const commentId = parseInt(match[2], 10);

  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  const comment = await env.DB_POSTS.prepare('SELECT id, user_id FROM comments WHERE id = ? AND post_id = ?')
    .bind(commentId, postId)
    .first();
  if (!comment) return jsonResponse(404, null, '评论不存在', 404);

  if (comment.user_id !== user.id && user.role !== 'super_admin') {
    return jsonResponse(403, null, '无权删除该评论');
  }

  await env.DB_POSTS.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return jsonResponse(0, null, '删除成功');
}

async function getLikes(request, env, user) {
  const path = new URL(request.url).pathname;
  const slug = path.replace('/api/v1/posts/', '').replace('/likes', '');
  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  const countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM likes WHERE post_id = ?')
    .bind(postId)
    .first();

  let liked = false;
  if (user) {
    const likeRow = await env.DB_POSTS.prepare('SELECT id FROM likes WHERE post_id = ? AND user_id = ?')
      .bind(postId, user.id)
      .first();
    liked = !!likeRow;
  }

  return jsonResponse(0, { count: countRow.c, liked });
}

async function createLike(request, env, user) {
  const path = new URL(request.url).pathname;
  const slug = path.replace('/api/v1/posts/', '').replace('/likes', '');
  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  const settings = (await getSetting(env, 'interaction')) || {};
  if (settings.likesEnabled === false) return jsonResponse(403, null, '点赞功能已关闭');

  try {
    await env.DB_POSTS.prepare('INSERT INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)')
      .bind(postId, user.id, now())
      .run();
    return jsonResponse(0, null, '点赞成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '已经点赞过');
    }
    throw e;
  }
}

async function deleteLike(request, env, user) {
  const path = new URL(request.url).pathname;
  const slug = path.replace('/api/v1/posts/', '').replace('/likes', '');
  const postId = await getPostIdBySlug(env, slug);
  if (!postId) return jsonResponse(404, null, '文章不存在', 404);

  await env.DB_POSTS.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?')
    .bind(postId, user.id)
    .run();
  return jsonResponse(0, null, '取消点赞成功');
}

async function listAdminComments(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const status = url.searchParams.get('status') || '';
  const offset = (page - 1) * limit;

  let comments;
  let total;
  const validStatuses = ['pending', 'approved', 'rejected'];

  if (status && validStatuses.includes(status)) {
    comments = await env.DB_POSTS.prepare(
      `SELECT id, post_id, user_id, content, status, created_at, updated_at
       FROM comments WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(status, limit, offset)
      .all();
    const countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM comments WHERE status = ?')
      .bind(status)
      .first();
    total = countRow.c;
  } else {
    comments = await env.DB_POSTS.prepare(
      `SELECT id, post_id, user_id, content, status, created_at, updated_at
       FROM comments ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    const countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM comments').first();
    total = countRow.c;
  }

  const list = comments.results || [];
  const postIds = [...new Set(list.map((c) => c.post_id))];
  const userIds = [...new Set(list.map((c) => c.user_id))];
  const postMap = await getPostMap(env, postIds);
  const userMap = await getUserMap(env, userIds);

  const results = list.map((c) => ({
    id: c.id,
    postId: c.post_id,
    postTitle: postMap[c.post_id]?.title || '',
    postSlug: postMap[c.post_id]?.slug || '',
    userId: c.user_id,
    content: c.content,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    username: userMap[c.user_id]?.username || '未知用户',
    avatar: userMap[c.user_id]?.avatar_base64 || null,
  }));

  return jsonResponse(0, { list: results, total, page, limit });
}

async function updateAdminCommentsBatch(request, env, user) {
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => Number.isInteger(i)) : [];
  const valid = ['pending', 'approved', 'rejected'];
  if (!valid.includes(body.status)) return jsonResponse(400, null, '状态无效');
  if (ids.length === 0) return jsonResponse(400, null, '未选择任何评论');
  await env.DB_POSTS.prepare(
    `UPDATE comments SET status = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`
  )
    .bind(body.status, now(), ...ids)
    .run();
  return jsonResponse(0, null, `已更新 ${ids.length} 条评论`);
}

async function updateAdminComment(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const comment = await env.DB_POSTS.prepare('SELECT id FROM comments WHERE id = ?').bind(id).first();
  if (!comment) return jsonResponse(404, null, '评论不存在', 404);

  const body = await request.json();
  if (body.status === undefined) return jsonResponse(400, null, '无更新内容');

  const valid = ['pending', 'approved', 'rejected'];
  if (!valid.includes(body.status)) return jsonResponse(400, null, '状态无效');

  await env.DB_POSTS.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?')
    .bind(body.status, now(), id)
    .run();
  return jsonResponse(0, null, '保存成功');
}

async function deleteAdminComment(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  await env.DB_POSTS.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}



const defaultMessageWallSettings = {
  enabled: false,
  allowAnonymous: true,
  auditEnabled: false,
  defaultStyle: 'danmaku',
};

async function getMessageWallSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'message_wall')) || {};
    return jsonResponseWithCache(
      0,
      { ...defaultMessageWallSettings, ...data },
      'ok',
      200,
      'public, max-age=60'
    );
  } catch (err) {
    if (isBindingError(err)) {
      return jsonResponse(0, { ...defaultMessageWallSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateMessageWallSettings(request, env, user) {
  const body = await request.json();
  const data = {
    enabled: body.enabled !== false,
    allowAnonymous: body.allowAnonymous !== false,
    auditEnabled: body.auditEnabled === true,
    defaultStyle: body.defaultStyle || 'danmaku',
  };
  await setSetting(env, 'message_wall', data);
  return jsonResponse(0, data, '保存成功');
}

async function listMessages(env, url) {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let messages, countRow;
  try {
    const db = getConfigDb(env);
    messages = await db.prepare(
      `SELECT id, content, nickname, user_id, status, created_at, updated_at
       FROM message_wall
       WHERE status = 'approved'
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    countRow = await db.prepare(
      "SELECT COUNT(*) as c FROM message_wall WHERE status = 'approved'"
    ).first();
  } catch {
    
    return jsonResponse(0, { list: [], total: 0, page, limit });
  }

  const list = messages.results || [];
  const userIds = [...new Set(list.map((m) => m.user_id).filter(Boolean))];
  const userMap = await getUserMap(env, userIds);

  const results = list.map((m) => ({
    id: m.id,
    content: m.content,
    nickname: m.nickname,
    userId: m.user_id,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    username: m.user_id ? (userMap[m.user_id]?.username || null) : null,
    avatar: m.user_id ? (userMap[m.user_id]?.avatar_base64 || null) : null,
  }));

  return jsonResponse(0, { list: results, total: countRow.c, page, limit });
}

async function listMyMessages(request, env, user) {
  const db = getConfigDb(env);
  let rows;
  try {
    rows = await db.prepare(
      'SELECT id, content, nickname, user_id, status, created_at, updated_at FROM message_wall WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();
  } catch {
    return jsonResponse(0, { list: [], total: 0 });
  }
  const list = (rows.results || []).map((m) => ({
    id: m.id,
    content: m.content,
    nickname: m.nickname,
    userId: m.user_id,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));
  return jsonResponse(0, { list, total: list.length });
}

async function createMessage(request, env, user) {
  const settings = (await getSetting(env, 'message_wall')) || {};
  if (settings.enabled === false) return jsonResponse(403, null, '留言墙功能已关闭');

  const body = await request.json();
  const content = String(body.content || '').trim();
  if (!content) return jsonResponse(400, null, '留言内容不能为空');
  if (content.length > 2000) return jsonResponse(400, null, '留言内容不能超过 2000 字');

  let nickname = null;
  if (!user) {
    if (settings.allowAnonymous === false) return jsonResponse(403, null, '暂不支持匿名留言');
    nickname = String(body.nickname || '').trim();
    if (!nickname) return jsonResponse(400, null, '请填写昵称');
    if (nickname.length > 20) return jsonResponse(400, null, '昵称不能超过 20 个字符');
  }

  const status = settings.auditEnabled === false ? 'approved' : 'pending';
  const time = now();

  try {
    const db = getConfigDb(env);
    const result = await db.prepare(
      'INSERT INTO message_wall (content, nickname, user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(content, nickname, user ? user.id : null, status, time, time)
      .run();
    return jsonResponse(0, { id: result.meta ? result.meta.last_row_id : null, status }, '留言成功');
  } catch {
    return jsonResponse(500, null, '留言功能暂不可用，请稍后再试', 500);
  }
}

async function deleteMessage(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const db = getConfigDb(env);
  const message = await db.prepare('SELECT id, user_id FROM message_wall WHERE id = ?')
    .bind(id)
    .first();
  if (!message) return jsonResponse(404, null, '留言不存在', 404);

  if (!message.user_id) return jsonResponse(403, null, '匿名留言不可删除');
  if (message.user_id !== user.id && user.role !== 'super_admin') {
    return jsonResponse(403, null, '无权删除该留言');
  }

  await db.prepare('DELETE FROM message_wall WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}

async function listAdminMessages(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const status = url.searchParams.get('status') || '';
  const offset = (page - 1) * limit;

  let messages, total;
  const validStatuses = ['pending', 'approved', 'rejected'];
  try {
    const db = getConfigDb(env);
    if (status && validStatuses.includes(status)) {
      messages = await db.prepare(
        `SELECT id, content, nickname, user_id, status, created_at, updated_at
         FROM message_wall WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(status, limit, offset)
        .all();
      const countRow = await db.prepare('SELECT COUNT(*) as c FROM message_wall WHERE status = ?')
        .bind(status)
        .first();
      total = countRow.c;
    } else {
      messages = await db.prepare(
        `SELECT id, content, nickname, user_id, status, created_at, updated_at
         FROM message_wall ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(limit, offset)
        .all();
      const countRow = await db.prepare('SELECT COUNT(*) as c FROM message_wall').first();
      total = countRow.c;
    }
  } catch {
    
    return jsonResponse(0, { list: [], total: 0, page, limit });
  }

  const list = messages.results || [];
  const userIds = [...new Set(list.map((m) => m.user_id).filter(Boolean))];
  const userMap = await getUserMap(env, userIds);

  const results = list.map((m) => ({
    id: m.id,
    content: m.content,
    nickname: m.nickname,
    userId: m.user_id,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    username: m.user_id ? (userMap[m.user_id]?.username || null) : null,
    avatar: m.user_id ? (userMap[m.user_id]?.avatar_base64 || null) : null,
  }));

  return jsonResponse(0, { list: results, total, page, limit });
}

async function updateAdminMessagesBatch(request, env, user) {
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => Number.isInteger(i)) : [];
  const valid = ['pending', 'approved', 'rejected'];
  if (!valid.includes(body.status)) return jsonResponse(400, null, '状态无效');
  if (ids.length === 0) return jsonResponse(400, null, '未选择任何留言');
  await getConfigDb(env)
    .prepare(
      `UPDATE message_wall SET status = ?, updated_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`
    )
    .bind(body.status, now(), ...ids)
    .run();
  return jsonResponse(0, null, `已更新 ${ids.length} 条留言`);
}

async function updateAdminMessage(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const db = getConfigDb(env);
  const message = await db.prepare('SELECT id FROM message_wall WHERE id = ?').bind(id).first();
  if (!message) return jsonResponse(404, null, '留言不存在', 404);

  const body = await request.json();
  if (body.status === undefined) return jsonResponse(400, null, '无更新内容');

  const valid = ['pending', 'approved', 'rejected'];
  if (!valid.includes(body.status)) return jsonResponse(400, null, '状态无效');

  await db.prepare('UPDATE message_wall SET status = ?, updated_at = ? WHERE id = ?')
    .bind(body.status, now(), id)
    .run();
  return jsonResponse(0, null, '保存成功');
}

async function deleteAdminMessage(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  await getConfigDb(env).prepare('DELETE FROM message_wall WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}



async function listAdminUsers(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;

  const list = await env.DB_USERS.prepare(
    'SELECT id, username, email, role, status, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
  )
    .bind(limit, offset)
    .all();
  const countRow = await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first();

  return jsonResponse(0, { list: list.results || [], total: countRow.c, page, limit });
}

async function updateAdminUser(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  const body = await request.json();

  const target = await env.DB_USERS.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!target) return jsonResponse(404, null, '用户不存在', 404);

  const updates = [];
  const params = [];
  if (body.username !== undefined) {
    updates.push('username = ?');
    params.push(String(body.username).trim());
  }
  if (body.email !== undefined) {
    updates.push('email = ?');
    params.push(body.email ? String(body.email).trim() : null);
  }
  if (body.role !== undefined) {
    updates.push('role = ?');
    params.push(String(body.role));
  }
  if (body.status !== undefined) {
    updates.push('status = ?');
    params.push(body.status ? 1 : 0);
  }
  if (body.emailVerified !== undefined) {
    updates.push('email_verified = ?');
    params.push(body.emailVerified ? 1 : 0);
  }
  if (updates.length === 0) return jsonResponse(400, null, '无更新内容');

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  try {
    await env.DB_USERS.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    return jsonResponse(0, null, '保存成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, '用户名或邮箱已存在');
    }
    throw e;
  }
}

async function deleteAdminUser(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (Number.isNaN(id)) return jsonResponse(400, null, '用户 ID 无效');

  const target = await env.DB_USERS.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();
  if (!target) return jsonResponse(404, null, '用户不存在', 404);

  
  if (id === user.id) {
    return jsonResponse(403, null, '不能删除当前登录用户');
  }

  
  if (target.role === 'super_admin') {
    const admins = await env.DB_USERS.prepare(
      "SELECT COUNT(*) as c FROM users WHERE role = 'super_admin' AND status = 1"
    ).first();
    if (admins.c <= 1) {
      return jsonResponse(403, null, '不能删除最后一个超级管理员');
    }
  }

  
  await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(id).run();
  await env.DB_USERS.prepare('DELETE FROM verify_codes WHERE email IN (SELECT email FROM users WHERE id = ?)').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM likes WHERE user_id = ?').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM comments WHERE user_id = ?').bind(id).run();
  await env.DB_USERS.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

  return jsonResponse(0, null, '删除成功');
}



function rowToFriend(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    avatar: row.avatar,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listFriends(env) {
  const friends = await env.DB_CONFIG.prepare(
    `SELECT id, name, url, description, avatar, sort_order, created_at, updated_at
     FROM friends ORDER BY sort_order DESC, created_at DESC`
  ).all();
  return jsonResponseWithCache(0, { list: (friends.results || []).map(rowToFriend) }, 'ok', 200, 'public, max-age=600');
}

async function listAdminFriends(request, env, user) {
  const friends = await env.DB_CONFIG.prepare(
    `SELECT id, name, url, description, avatar, sort_order, created_at, updated_at
     FROM friends ORDER BY sort_order DESC, created_at DESC`
  ).all();
  return jsonResponse(0, { list: (friends.results || []).map(rowToFriend) });
}

async function createFriend(request, env, user) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  const description = body.description ? String(body.description).trim() : '';
  const avatar = body.avatar ? String(body.avatar) : '';
  const sortOrder = body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) || 0 : 0;

  if (!name) return jsonResponse(400, null, '友链名称必填');
  if (!url) return jsonResponse(400, null, '友链链接必填');

  const time = now();
  const result = await env.DB_CONFIG.prepare(
    'INSERT INTO friends (name, url, description, avatar, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(name, url, description, avatar, sortOrder, time, time)
    .run();
  const id = result.meta ? result.meta.last_row_id : null;
  return jsonResponse(0, { id, name, url, description, avatar, sortOrder, createdAt: time, updatedAt: time }, '创建成功');
}

async function updateFriend(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '友链 ID 无效');

  const friend = await env.DB_CONFIG.prepare('SELECT id FROM friends WHERE id = ?').bind(id).first();
  if (!friend) return jsonResponse(404, null, '友链不存在', 404);

  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonResponse(400, null, '友链名称必填');
    updates.push('name = ?');
    params.push(name);
  }
  if (body.url !== undefined) {
    const url = String(body.url).trim();
    if (!url) return jsonResponse(400, null, '友链链接必填');
    updates.push('url = ?');
    params.push(url);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    params.push(body.description ? String(body.description).trim() : '');
  }
  if (body.avatar !== undefined) {
    updates.push('avatar = ?');
    params.push(body.avatar ? String(body.avatar) : '');
  }
  if (body.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(parseInt(body.sortOrder, 10) || 0);
  }
  if (updates.length === 0) return jsonResponse(400, null, '无更新内容');

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  await env.DB_CONFIG.prepare(`UPDATE friends SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  return jsonResponse(0, null, '更新成功');
}

async function deleteFriend(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '友链 ID 无效');
  await env.DB_CONFIG.prepare('DELETE FROM friends WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}




const AI_MODEL_COST = {
  'gpt-4o-mini': '轻量',
  'gpt-4o': '中消耗',
  'gpt-4': '高消耗',
  'llama-3.3-70b': '高消耗',
  'deepseek-r1': '高消耗',
  'qwen2.5-coder-32b': '高消耗',
  'text-embedding-3-small': '轻量',
};

const AI_MODEL_MAP = {
  'gpt-4o-mini': '@cf/meta/llama-3.2-3b-instruct',
  'gpt-4o': '@cf/meta/llama-3.1-8b-instruct-fp8',
  'gpt-4': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'llama-3.3-70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'deepseek-r1': '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  'qwen2.5-coder-32b': '@cf/qwen/qwen2.5-coder-32b-instruct',
  'text-embedding-3-small': '@cf/baai/bge-small-en-v1.5',
  'text-embedding-3-large': '@cf/baai/bge-large-en-v1.5',
  'bge-m3': '@cf/baai/bge-m3',
  'flux-1-schnell': '@cf/black-forest-labs/flux-1-schnell',
  'flux-2-klein-4b': '@cf/black-forest-labs/flux-2-klein-4b',
  'flux-2-klein-9b': '@cf/black-forest-labs/flux-2-klein-9b',
  'sdxl-base': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  'whisper': '@cf/openai/whisper',
};

function resolveAiModel(input) {
  return AI_MODEL_MAP[input] || input;
}

function extractAiResponse(result) {
  if (!result) return '';
  if (typeof result.response === 'string') return result.response;
  if (typeof result.content === 'string') return result.content;
  if (typeof result.response === 'object' && result.response !== null) {
    return JSON.stringify(result.response);
  }
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

function isCustomModel(modelAlias) {
  return typeof modelAlias === 'string' && modelAlias.startsWith('custom:');
}

function parseCustomModelId(modelAlias) {
  if (!isCustomModel(modelAlias)) return null;
  const id = parseInt(modelAlias.replace('custom:', ''), 10);
  return Number.isNaN(id) ? null : id;
}

async function listCustomModels(env, enabledOnly = false) {
  let stmt = env.DB_CONFIG.prepare('SELECT id, name, model_id, base_url, api_key, enabled, created_at, updated_at FROM ai_custom_models');
  if (enabledOnly) {
    stmt = env.DB_CONFIG.prepare('SELECT id, name, model_id, base_url, api_key, enabled, created_at, updated_at FROM ai_custom_models WHERE enabled = 1');
  }
  const { results } = await stmt.all();
  const models = (results || []).map((row) => ({
    id: row.id,
    name: row.name,
    modelId: row.model_id,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  for (const m of models) {
    m.apiKey = await decryptApiKey(env, m.apiKey);
  }
  return models;
}

async function getCustomModelById(env, id) {
  const row = await env.DB_CONFIG.prepare('SELECT id, name, model_id, base_url, api_key, enabled, created_at, updated_at FROM ai_custom_models WHERE id = ?')
    .bind(id)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    modelId: row.model_id,
    baseUrl: row.base_url,
    apiKey: await decryptApiKey(env, row.api_key),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createCustomModel(env, data) {
  const now = new Date().toISOString();
  const encryptedKey = await encryptApiKey(env, data.apiKey);
  const res = await env.DB_CONFIG.prepare(
    'INSERT INTO ai_custom_models (name, model_id, base_url, api_key, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(data.name, data.modelId, data.baseUrl, encryptedKey, data.enabled ? 1 : 0, now, now)
    .run();
  return { id: res.meta?.last_row_id, ...data };
}

async function updateCustomModel(env, id, data) {
  const now = new Date().toISOString();
  const encryptedKey = await encryptApiKey(env, data.apiKey);
  await env.DB_CONFIG.prepare(
    'UPDATE ai_custom_models SET name = ?, model_id = ?, base_url = ?, api_key = ?, enabled = ?, updated_at = ? WHERE id = ?'
  )
    .bind(data.name, data.modelId, data.baseUrl, encryptedKey, data.enabled ? 1 : 0, now, id)
    .run();
  return await getCustomModelById(env, id);
}

async function deleteCustomModel(env, id) {
  await env.DB_CONFIG.prepare('DELETE FROM ai_custom_models WHERE id = ?').bind(id).run();
  return true;
}

async function callCustomModelNonStream(custom, body) {
  const url = custom.baseUrl.replace(/\/$/, '') + '/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custom.apiKey}`,
    },
    body: JSON.stringify({
      model: custom.modelId,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`自定义模型请求失败 (${res.status}): ${text}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '';
  return { content };
}

async function callCustomModelStream(custom, body) {
  const url = custom.baseUrl.replace(/\/$/, '') + '/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custom.apiKey}`,
    },
    body: JSON.stringify({
      model: custom.modelId,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`自定义模型流式请求失败 (${res.status}): ${text}`);
  }
  return res.body;
}

function stripThinkingTags(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
}

function sanitizeJsonControlChars(text) {
  
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code === 0x09) return '\\t';
      if (code === 0x0a) return '\\n';
      if (code === 0x0d) return '\\r';
      if (code === 0x08) return '\\b';
      if (code === 0x0c) return '\\f';
      return '';
    });
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let trimmed = text.trim();

  
  try {
    return JSON.parse(trimmed);
  } catch {}

  
  try {
    const sanitized = sanitizeJsonControlChars(trimmed);
    if (sanitized !== trimmed) {
      return JSON.parse(sanitized);
    }
  } catch {}

  
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  
  
  let start = trimmed.indexOf('{');
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(trimmed.slice(start, i + 1));
            } catch {}
            break;
            // 如果解析失败，尝试下一个 { 开头
          }
        }
      }
    }
    start = trimmed.indexOf('{', start + 1);
  }
  return null;
}

function listAiModels() {
  const created = Math.floor(Date.now() / 1000);
  return Object.keys(AI_MODEL_MAP).map((id) => ({
    id,
    object: 'model',
    created,
    owned_by: 'cloudflare-workers-ai',
  }));
}

function aiGenerateId(prefix = 'chatcmpl') {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '')}`;
}

function aiNowUnix() {
  return Math.floor(Date.now() / 1000);
}

const defaultAiSettings = {
  enabled: false,
  model: 'llama-3.3-70b',
  imageModel: 'flux-1-schnell',
  temperature: 0.7,
  maxTokens: 4096,
};

async function getAiSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'ai')) || {};
    return jsonResponse(0, { ...defaultAiSettings, ...data });
  } catch (err) {
    if (isBindingError(err)) {
      return jsonResponse(0, { ...defaultAiSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateAiSettings(request, env, user) {
  const body = await request.json();
  const data = {
    enabled: body.enabled === true,
    model: String(body.model || defaultAiSettings.model),
    imageModel: String(body.imageModel || defaultAiSettings.imageModel),
    temperature: Math.min(2, Math.max(0, parseFloat(body.temperature ?? defaultAiSettings.temperature) || defaultAiSettings.temperature)),
    maxTokens: Math.min(8192, Math.max(2048, parseInt(body.maxTokens ?? defaultAiSettings.maxTokens, 10) || defaultAiSettings.maxTokens)),
  };
  await setSetting(env, 'ai', data);
  return jsonResponse(0, data, '保存成功');
}

async function checkAiEnabled(env) {
  const settings = (await getSetting(env, 'ai')) || {};
  return settings.enabled === true;
}

async function verifyAiApiKey(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  
  if (env.AI_API_KEY && token === env.AI_API_KEY) return true;

  
  const hash = await sha256Hex(token);
  const row = await env.DB_CONFIG.prepare(
    'SELECT id FROM ai_api_keys WHERE key_hash = ? AND enabled = 1'
  )
    .bind(hash)
    .first();
  return !!row;
}

async function listAiApiKeys(request, env, user) {
  const rows = await env.DB_CONFIG.prepare(
    'SELECT id, name, enabled, created_at, updated_at FROM ai_api_keys ORDER BY created_at DESC'
  ).all();
  return jsonResponse(0, { list: rows.results || [] });
}

async function createAiApiKey(request, env, user) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  if (!name) return jsonResponse(400, null, '名称必填');

  const keyPrefix = 'xb-';
  const keySuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const rawKey = `${keyPrefix}${keySuffix}`;
  const keyHash = await sha256Hex(rawKey);
  const time = now();

  try {
    const result = await env.DB_CONFIG.prepare(
      'INSERT INTO ai_api_keys (name, key_hash, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(name, keyHash, 1, time, time)
      .run();
    return jsonResponse(0, { id: result.meta ? result.meta.last_row_id : null, name, key: rawKey }, '创建成功');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return jsonResponse(409, null, 'API Key 冲突，请重试');
    }
    throw e;
  }
}

async function deleteAiApiKey(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, 'ID 无效');
  await env.DB_CONFIG.prepare('DELETE FROM ai_api_keys WHERE id = ?').bind(id).run();
  return jsonResponse(0, null, '删除成功');
}

async function listAdminAiModels(request, env, user) {
  const builtIn = Object.keys(AI_MODEL_MAP).map((id) => {
    const cost = AI_MODEL_COST[id];
    return { id, name: cost ? `${id}（${cost}）` : id, builtIn: true };
  });
  const custom = await listCustomModels(env, true);
  const customModels = custom.map((m) => ({ id: `custom:${m.id}`, name: `${m.name}（自定义）`, builtIn: false }));
  return jsonResponse(0, { models: [...customModels, ...builtIn] });
}

async function listAiCustomModels(request, env, user) {
  const rows = await env.DB_CONFIG.prepare(
    'SELECT id, name, model_id, base_url, api_key, enabled, created_at, updated_at FROM ai_custom_models ORDER BY created_at DESC'
  ).all();
  return jsonResponse(0, { list: (rows.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    modelId: row.model_id,
    baseUrl: row.base_url,
    apiKey: '',
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) });
}

function validateCustomModel(body, requireApiKey = true) {
  const name = String(body.name || '').trim();
  const modelId = String(body.modelId || '').trim();
  const baseUrl = String(body.baseUrl || '').trim();
  const apiKey = String(body.apiKey || '').trim();
  if (!name) return { error: '模型显示名称必填' };
  if (!modelId) return { error: '模型 ID 必填' };
  if (!baseUrl) return { error: 'Base URL 必填' };
  if (requireApiKey && !apiKey) return { error: 'API Key 必填' };
  if (!/^https?:\/\//i.test(baseUrl)) return { error: 'Base URL 必须以 http:// 或 https:// 开头' };
  return { data: { name, modelId, baseUrl, apiKey, enabled: body.enabled !== false } };
}

function maskCustomModel(model) {
  if (!model) return model;
  return { ...model, apiKey: '' };
}

async function createAiCustomModel(request, env, user) {
  const body = await request.json();
  const validation = validateCustomModel(body, true);
  if (validation.error) return jsonResponse(400, null, validation.error);
  const model = await createCustomModel(env, validation.data);
  return jsonResponse(0, maskCustomModel({ id: model.id, ...validation.data }), '创建成功');
}

async function updateAiCustomModel(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, 'ID 无效');
  const body = await request.json();
  const validation = validateCustomModel(body, false);
  if (validation.error) return jsonResponse(400, null, validation.error);
  let data = validation.data;
  if (!data.apiKey) {
    const existing = await env.DB_CONFIG.prepare('SELECT api_key FROM ai_custom_models WHERE id = ?').bind(id).first();
    if (!existing) return jsonResponse(404, null, '模型不存在');
    data = { ...data, apiKey: existing.api_key };
  }
  const model = await updateCustomModel(env, id, data);
  if (!model) return jsonResponse(404, null, '模型不存在');
  return jsonResponse(0, maskCustomModel(model), '更新成功');
}

async function deleteAiCustomModelHandler(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, 'ID 无效');
  await deleteCustomModel(env, id);
  return jsonResponse(0, null, '删除成功');
}

async function loadPrompt(env, request, name) {
  if (name === 'article-generation') {
    return `你是一位专业的中文博客作者。请根据用户提供的主题生成一篇完整的博客文章。
必须严格按照以下 json 格式返回，不要包含任何其他解释文字、markdown 代码块或 XML 标签：
{
  "title": "文章标题",
  "excerpt": "160字以内的摘要",
  "tags": ["标签1", "标签2"],
  "content": "Markdown 格式的正文内容，800-2000字"
}`;
  }
  if (name === 'format-optimization') {
    return '你是一位专业的文字编辑。请优化用户提供的 Markdown 文本，改善排版和表达，保持原意不变。只返回优化后的 Markdown 内容，不要包含任何解释。';
  }
  return '';
}

async function findOrCreateTags(env, tagNames) {
  const result = [];
  for (const name of tagNames) {
    const trimmed = String(name).trim();
    if (!trimmed) continue;
    let tag = await env.DB_POSTS.prepare('SELECT id, name, slug, color FROM tags WHERE name = ?')
      .bind(trimmed)
      .first();
    if (!tag) {
      const slug = slugify(trimmed) || `tag-${Date.now()}`;
      try {
        const insert = await env.DB_POSTS.prepare('INSERT INTO tags (name, slug, color) VALUES (?, ?, ?)')
          .bind(trimmed, slug, null)
          .run();
        tag = {
          id: insert.meta ? insert.meta.last_row_id : null,
          name: trimmed,
          slug,
          color: null,
        };
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          tag = await env.DB_POSTS.prepare('SELECT id, name, slug, color FROM tags WHERE slug = ?')
            .bind(slug)
            .first();
        } else {
          throw e;
        }
      }
    }
    if (tag) result.push(tag);
  }
  return result;
}

async function aiGeneratePost(request, env, user) {
  if (!env.AI) {
    return jsonResponse(503, null, 'AI 绑定未配置，请在 Cloudflare Dashboard 中绑定 AI 后重试', 503);
  }
  const enabled = await checkAiEnabled(env);
  if (!enabled) return jsonResponse(403, null, 'AI 功能已关闭', 403);

  const body = await request.json();
  const topic = String(body.topic || '').trim();
  const description = String(body.description || '').trim();
  const existingTags = body.existingTags || [];
  if (!topic) return jsonResponse(400, null, '请输入文章主题');

  const settings = (await getSetting(env, 'ai')) || {};
  const modelAlias = body.model || settings.model || defaultAiSettings.model;
  const temperature = body.temperature !== undefined ? Number(body.temperature) : (settings.temperature ?? defaultAiSettings.temperature);
  const maxTokens = body.maxTokens !== undefined ? Number(body.maxTokens) : (settings.maxTokens ?? defaultAiSettings.maxTokens);

  const promptTemplate = await loadPrompt(env, request, 'article-generation');
  const systemPrompt = promptTemplate || `你是一位专业的中文博客作者。请根据用户提供的主题生成一篇完整的博客文章。
必须严格按照以下 json 格式返回，不要包含任何其他解释文字、markdown 代码块或 XML 标签：
{
  "title": "文章标题",
  "excerpt": "160字以内的摘要",
  "tags": ["标签1", "标签2"],
  "content": "Markdown 格式的正文内容，800-2000字"
}`;

  const tagNames = Array.isArray(existingTags)
    ? existingTags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : [];
  let userPrompt = `主题：${topic}\n现有标签供参考（可直接使用或新增）：${tagNames.join('、') || '无'}`;
  if (description) {
    userPrompt += `\n补充要求：${description}`;
  }
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let raw = '';
  let actualModel = modelAlias;
  try {
    if (isCustomModel(modelAlias)) {
      const customId = parseCustomModelId(modelAlias);
      const custom = customId ? await getCustomModelById(env, customId) : null;
      if (!custom || !custom.enabled) {
        return jsonResponse(400, null, '自定义模型不存在或已禁用', 400);
      }
      const res = await callCustomModelNonStream(custom, { messages, temperature, max_tokens: maxTokens });
      raw = res.content;
      actualModel = custom.modelId;
    } else {
      const model = resolveAiModel(modelAlias);
      actualModel = model;
      try {
        const aiResult = await env.AI.run(model, {
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });
        raw = extractAiResponse(aiResult);
      } catch (firstErr) {
        console.error('AI generate first try error:', firstErr);
        const firstErrMsg = firstErr.message || String(firstErr);
        try {
          const aiResult = await env.AI.run(model, {
            messages,
            temperature,
            max_tokens: maxTokens,
          });
          raw = extractAiResponse(aiResult);
        } catch (secondErr) {
          console.error('AI generate fallback error:', secondErr);
          const secondErrMsg = secondErr.message || String(secondErr);
          return jsonResponse(
            502,
            { model: actualModel, error: secondErrMsg, firstError: firstErrMsg, raw },
            `AI 生成失败（模型：${actualModel}）：${secondErrMsg}`,
            502
          );
        }
      }
    }
  } catch (err) {
    console.error('AI generate error:', err);
    const errMsg = err.message || String(err);
    return jsonResponse(502, { model: actualModel, error: errMsg, raw }, `AI 生成失败（模型：${actualModel}）：${errMsg}`, 502);
  }

  let parsed = extractJson(raw);
  if (!parsed) {
    raw = stripThinkingTags(raw);
    parsed = extractJson(raw);
  }
  if (!parsed) {
    let parseError = 'AI 返回格式无法解析';
    try {
      JSON.parse(raw.trim());
    } catch (e) {
      parseError = e.message || 'AI 返回格式无法解析';
    }
    console.error('AI generate parse error:', parseError, 'raw:', raw);
    return jsonResponse(502, { raw, model: actualModel, error: parseError }, `AI 返回格式无法解析：${parseError}`, 502);
  }

  const title = String(parsed.title || '').trim();
  const excerpt = String(parsed.excerpt || '').trim();
  const content = String(parsed.content || '').trim();
  const parsedTagNames = Array.isArray(parsed.tags) ? parsed.tags : [];

  if (!title || !content) {
    return jsonResponse(502, { raw: parsed, rawText: raw, model: actualModel, error: 'AI 返回内容不完整' }, 'AI 返回内容不完整，请重试', 502);
  }

  return jsonResponse(0, {
    title,
    excerpt,
    content,
    tags: parsedTagNames.map((n) => String(n).trim()).filter(Boolean),
    raw,
  });
}

async function aiChat(request, env, user) {
  if (!env.AI) {
    return jsonResponse(503, null, 'AI 绑定未配置', 503);
  }
  const enabled = await checkAiEnabled(env);
  if (!enabled) return jsonResponse(403, null, 'AI 功能已关闭', 403);

  const body = await request.json();
  const messages = body.messages || [];
  const modelAlias = body.model || defaultAiSettings.model;
  const stream = body.stream === true;
  const aiSettings = (await getSetting(env, 'ai')) || {};
  const parsedTemp = parseFloat(body.temperature);
  const temperature = Number.isNaN(parsedTemp)
    ? (aiSettings.temperature ?? defaultAiSettings.temperature)
    : Math.min(2, Math.max(0, parsedTemp));
  const parsedMaxTokens = parseInt(body.max_tokens, 10);
  const maxTokens = Number.isNaN(parsedMaxTokens)
    ? (aiSettings.maxTokens ?? defaultAiSettings.maxTokens)
    : Math.min(8192, Math.max(256, parsedMaxTokens));

  const options = { messages, temperature, max_tokens: maxTokens };
  if (stream) options.stream = true;

  
  if (isCustomModel(modelAlias)) {
    const customId = parseCustomModelId(modelAlias);
    const custom = customId ? await getCustomModelById(env, customId) : null;
    if (!custom || !custom.enabled) {
      return jsonResponse(400, null, '自定义模型不存在或已禁用', 400);
    }
    try {
      if (!stream) {
        const res = await callCustomModelNonStream(custom, options);
        return jsonResponse(0, {
          id: aiGenerateId(),
          object: 'chat.completion',
          created: aiNowUnix(),
          model: custom.modelId,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: stripThinkingTags(res.content), refusal: null },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      }
      const openAiStream = await callCustomModelStream(custom, options);
      const id = aiGenerateId();
      const created = aiNowUnix();
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = openAiStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = new TextDecoder().decode(value);
              for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const jsonText = trimmed.slice(5).trim();
                if (!jsonText || jsonText === '[DONE]') continue;
                let chunk = {};
                try {
                  chunk = JSON.parse(jsonText);
                } catch {
                  continue;
                }
                const delta = chunk.choices?.[0]?.delta;
                const content = delta?.content || delta?.reasoning_content || '';
                if (!content) continue;
                const payload = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model: modelAlias,
                  choices: [{ index: 0, delta: { content: stripThinkingTags(content) }, finish_reason: null }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            console.error('custom stream error:', err);
            controller.error(err);
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (err) {
      console.error('custom chat error:', err);
      return jsonResponse(502, null, `AI 对话失败：${err.message || String(err)}`, 502);
    }
  }

  const model = resolveAiModel(modelAlias);

  let aiResult;
  try {
    aiResult = await env.AI.run(model, options);
  } catch (err) {
    console.error('AI.run chat error:', err);
    return jsonResponse(502, null, `AI 对话失败：${err.message || String(err)}`, 502);
  }

  if (!stream) {
    const content = stripThinkingTags(extractAiResponse(aiResult));
    return jsonResponse(0, {
      id: aiGenerateId(),
      object: 'chat.completion',
      created: aiNowUnix(),
      model: modelAlias,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content, refusal: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  
  const id = aiGenerateId();
  const created = aiNowUnix();
  const encoder = new TextEncoder();
  const aiStream = aiResult;

  const readable = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const jsonText = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
            if (!jsonText || jsonText === '[DONE]') continue;
            let chunk = {};
            try {
              chunk = JSON.parse(jsonText);
            } catch {
              continue;
            }
            const chunkText = extractAiResponse(chunk);
            if (!chunkText) continue;
            const payload = {
              id,
              object: 'chat.completion.chunk',
              created,
              model: modelAlias,
              choices: [{ index: 0, delta: { content: stripThinkingTags(chunkText) }, finish_reason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        console.error('stream error:', err);
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function aiFormatOptimize(request, env, user) {
  if (!env.AI) {
    return jsonResponse(503, null, 'AI 绑定未配置', 503);
  }
  const enabled = await checkAiEnabled(env);
  if (!enabled) return jsonResponse(403, null, 'AI 功能已关闭', 403);

  const body = await request.json();
  const content = String(body.content || '').trim();
  if (!content) {
    return jsonResponse(400, null, '缺少 content 参数', 400);
  }

  const settings = (await getSetting(env, 'ai')) || {};
  const modelAlias = body.model || settings.model || defaultAiSettings.model;
  const temperature = body.temperature !== undefined
    ? Number(body.temperature)
    : (settings.temperature ?? defaultAiSettings.temperature);
  const maxTokens = body.maxTokens !== undefined
    ? Number(body.maxTokens)
    : (settings.maxTokens ?? defaultAiSettings.maxTokens);

  const systemPrompt = await loadPrompt(env, request, 'format-optimization');
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请优化以下 Markdown 文本，只返回优化后的 Markdown 内容：\n\n${content}` },
  ];

  let optimized = '';
  let actualModel = modelAlias;
  try {
    if (isCustomModel(modelAlias)) {
      const customId = parseCustomModelId(modelAlias);
      const custom = customId ? await getCustomModelById(env, customId) : null;
      if (!custom || !custom.enabled) {
        return jsonResponse(400, null, '自定义模型不存在或已禁用', 400);
      }
      const res = await callCustomModelNonStream(custom, { messages, temperature, max_tokens: maxTokens });
      optimized = res.content;
      actualModel = custom.modelId;
    } else {
      const model = resolveAiModel(modelAlias);
      const aiResult = await env.AI.run(model, { messages, temperature, max_tokens: maxTokens });
      optimized = extractAiResponse(aiResult);
      actualModel = model;
    }
  } catch (err) {
    console.error('AI format error:', err);
    return jsonResponse(502, { model: actualModel, error: err.message || String(err) }, `AI 格式优化失败（模型：${actualModel}）：${err.message || String(err)}`, 502);
  }

  optimized = stripThinkingTags(optimized);
  
  optimized = optimized.replace(/^```markdown\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  return jsonResponse(0, { content: optimized, model: modelAlias });
}

async function openaiModels(request, env) {
  const ok = await verifyAiApiKey(request, env);
  if (!ok) {
    return openaiJsonResponse({ error: { message: 'Invalid API key', type: 'authentication_error' } }, 401);
  }
  const builtIn = listAiModels();
  const custom = await listCustomModels(env, true);
  const customModels = (custom || []).map((m) => ({
    id: `custom:${m.id}`,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'custom',
  }));
  return openaiJsonResponse({ object: 'list', data: [...customModels, ...builtIn] });
}

function openaiCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function openaiJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...openaiCorsHeaders() },
  });
}

async function openaiChatCompletions(request, env) {
  const ok = await verifyAiApiKey(request, env);
  if (!ok) {
    return openaiJsonResponse({ error: { message: 'Invalid API key', type: 'authentication_error' } }, 401);
  }
  if (!env.AI) {
    return openaiJsonResponse({ error: { message: 'AI binding not configured', type: 'ai_error' } }, 503);
  }

  const body = await request.json();
  const messages = body.messages || [];
  const modelAlias = body.model || defaultAiSettings.model;
  const stream = body.stream === true;
  const parsedTemp = parseFloat(body.temperature);
  const temperature = Number.isNaN(parsedTemp)
    ? defaultAiSettings.temperature
    : Math.min(2, Math.max(0, parsedTemp));
  const parsedMaxTokens = parseInt(body.max_tokens, 10);
  const maxTokens = Number.isNaN(parsedMaxTokens)
    ? defaultAiSettings.maxTokens
    : Math.min(8192, Math.max(256, parsedMaxTokens));

  const options = { messages, temperature, max_tokens: maxTokens };

  
  if (isCustomModel(modelAlias)) {
    const customId = parseCustomModelId(modelAlias);
    const custom = customId ? await getCustomModelById(env, customId) : null;
    if (!custom || !custom.enabled) {
      return openaiJsonResponse({ error: { message: '自定义模型不存在或已禁用', type: 'invalid_request_error' } }, 400);
    }
    try {
      if (!stream) {
        const res = await callCustomModelNonStream(custom, options);
        return openaiJsonResponse({
          id: aiGenerateId(),
          object: 'chat.completion',
          created: aiNowUnix(),
          model: custom.modelId,
          choices: [{ index: 0, message: { role: 'assistant', content: stripThinkingTags(res.content), refusal: null }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      }
      const openAiStream = await callCustomModelStream(custom, options);
      const id = aiGenerateId();
      const created = aiNowUnix();
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = openAiStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = new TextDecoder().decode(value);
              for (const line of text.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const jsonText = trimmed.slice(5).trim();
                if (!jsonText || jsonText === '[DONE]') continue;
                let chunk = {};
                try {
                  chunk = JSON.parse(jsonText);
                } catch {
                  continue;
                }
                const delta = chunk.choices?.[0]?.delta;
                const content = delta?.content || delta?.reasoning_content || '';
                if (!content) continue;
                const payload = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model: custom.modelId,
                  choices: [{ index: 0, delta: { content: stripThinkingTags(content) }, finish_reason: null }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...openaiCorsHeaders(),
        },
      });
    } catch (err) {
      return openaiJsonResponse({ error: { message: err.message || String(err), type: 'ai_error' } }, 502);
    }
  }

  const model = resolveAiModel(modelAlias);
  if (stream) options.stream = true;

  let aiResult;
  try {
    aiResult = await env.AI.run(model, options);
  } catch (err) {
    return openaiJsonResponse({ error: { message: err.message || String(err), type: 'ai_error' } }, 502);
  }

  if (!stream) {
    const content = stripThinkingTags(extractAiResponse(aiResult));
    return openaiJsonResponse({
      id: aiGenerateId(),
      object: 'chat.completion',
      created: aiNowUnix(),
      model: modelAlias,
      choices: [{ index: 0, message: { role: 'assistant', content, refusal: null }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  const id = aiGenerateId();
  const created = aiNowUnix();
  const encoder = new TextEncoder();
  const aiStream = aiResult;

  const readable = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const jsonText = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
            if (!jsonText || jsonText === '[DONE]') continue;
            let chunk = {};
            try {
              chunk = JSON.parse(jsonText);
            } catch {
              continue;
            }
            const chunkText = extractAiResponse(chunk);
            if (!chunkText) continue;
            const payload = {
              id,
              object: 'chat.completion.chunk',
              created,
              model: modelAlias,
              choices: [{ index: 0, delta: { content: stripThinkingTags(chunkText) }, finish_reason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...openaiCorsHeaders(),
    },
  });
}

async function openaiEmbeddings(request, env) {
  const ok = await verifyAiApiKey(request, env);
  if (!ok) {
    return openaiJsonResponse({ error: { message: 'Invalid API key', type: 'authentication_error' } }, 401);
  }
  if (!env.AI) {
    return openaiJsonResponse({ error: { message: 'AI binding not configured', type: 'ai_error' } }, 503);
  }

  const body = await request.json();
  const modelAlias = body.model || 'bge-m3';
  const model = resolveAiModel(modelAlias);
  const inputs = Array.isArray(body.input) ? body.input : [body.input];

  let result;
  try {
    result = await env.AI.run(model, { text: inputs });
  } catch (err) {
    return openaiJsonResponse({ error: { message: err.message || String(err), type: 'ai_error' } }, 502);
  }

  const embeddings = result.data || [];
  return openaiJsonResponse({
    object: 'list',
    data: embeddings.map((item, index) => ({
      object: 'embedding',
      index,
      embedding: item.embedding || item,
    })),
    model: modelAlias,
    usage: { prompt_tokens: 0, total_tokens: 0 },
  });
}



function checkEnv(env) {
  const missing = [];
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!env.DB_USERS || typeof env.DB_USERS.prepare !== 'function') missing.push('DB_USERS binding');
  if (!env.DB_POSTS || typeof env.DB_POSTS.prepare !== 'function') missing.push('DB_POSTS binding');
  if (!env.DB_CONFIG || typeof env.DB_CONFIG.prepare !== 'function') missing.push('DB_CONFIG binding');
  if (!env.DB_MEDIA || typeof env.DB_MEDIA.prepare !== 'function') missing.push('DB_MEDIA binding');
  return missing;
}








async function resolveUrl(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonResponse(400, null, '缺少 url 参数');
  }
  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    const finalUrl = response.url;
    
    let playlistId = '';
    const idMatch = finalUrl.match(/[?&]id=(\d+)/);
    if (idMatch) {
      playlistId = idMatch[1];
    } else {
      const pathMatch = finalUrl.match(/\/playlist\/(\d+)/);
      if (pathMatch) playlistId = pathMatch[1];
    }
    return jsonResponse(0, { finalUrl, playlistId }, 'ok');
  } catch (err) {
    return jsonResponse(500, null, `解析失败：${err.message}`, 500);
  }
}





async function proxyImage(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonResponse(400, null, '缺少 url 参数');
  }
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    return jsonResponse(500, null, `图片代理失败：${err.message}`, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const missingEnv = checkEnv(env);
    if (missingEnv.length > 0) {
      return jsonResponse(500, null, `环境变量/绑定缺失：${missingEnv.join('、')}`, 500);
    }

    try {
      
      if (method === 'GET' && path === '/v1/models') return await openaiModels(request, env);
      if (method === 'POST' && path === '/v1/chat/completions') return await openaiChatCompletions(request, env);
      if (method === 'POST' && path === '/v1/embeddings') return await openaiEmbeddings(request, env);

      
      if (method === 'POST' && path === '/api/v1/setup') return await setup(env);

      
      if (method === 'GET' && path === '/api/v1/site') return await getSiteConfig(env);
      if (method === 'GET' && path === '/manifest.json') return await getManifest(env, request.url);
      if (method === 'GET' && path === '/api/v1/posts') return await listPosts(env, url);

      
      if (method === 'GET' && path === '/api/v1/resolve-url') return await resolveUrl(request);

      
      if (method === 'GET' && path === '/api/v1/proxy-image') return await proxyImage(request);

      
      if (method === 'GET' && path.match(/^\/api\/v1\/posts\/[^/]+\/comments$/)) return await listComments(env, url, path);
      if (method === 'POST' && path.match(/^\/api\/v1\/posts\/[^/]+\/comments$/)) return await requireAuth(request, env, createComment);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/posts\/[^/]+\/comments\/\d+$/)) return await requireAuth(request, env, deleteComment);
      if (method === 'GET' && path.match(/^\/api\/v1\/posts\/[^/]+\/likes$/)) {
        const user = await getCurrentUser(request, env);
        return await getLikes(request, env, user);
      }
      if (method === 'POST' && path.match(/^\/api\/v1\/posts\/[^/]+\/likes$/)) return await requireAuth(request, env, createLike);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/posts\/[^/]+\/likes$/)) return await requireAuth(request, env, deleteLike);

      if (method === 'GET' && path.startsWith('/api/v1/posts/')) return await getPost(env, path);
      if (method === 'GET' && path === '/api/v1/tags') return await listTags(env);
      if (method === 'GET' && path.startsWith('/api/v1/media/')) {
        const mediaId = parseInt(path.replace('/api/v1/media/', ''), 10);
        if (!mediaId) return jsonResponse(400, null, '媒体 ID 无效');
        return await getMedia(env, mediaId, request, ctx);
      }
      if (method === 'GET' && path.endsWith('/posts') && path.startsWith('/api/v1/tags/')) {
        return await listPostsByTag(env, path);
      }

      
      if (method === 'GET' && path === '/api/v1/friends') return await listFriends(env);

      
      if (method === 'POST' && path === '/api/v1/auth/register') return await register(request, env);
      if (method === 'POST' && path === '/api/v1/auth/login') return await login(request, env);
      if (method === 'POST' && path === '/api/v1/auth/refresh') return await refreshToken(request, env);
      if (method === 'POST' && path === '/api/v1/auth/logout') return await logout(request, env);
      if (method === 'GET' && path === '/api/v1/auth/me') return await requireAuth(request, env, getMe);
      if (method === 'POST' && path === '/api/v1/auth/verify-code') return await sendVerifyCode(request, env);

      
      if (method === 'GET' && path === '/api/v1/settings/auth') return await getAuthSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/email') return await getEmailSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/email-template') return await getEmailTemplateSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/interaction') return await getInteractionSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/message-wall') return await getMessageWallSettings(request, env);

      
      if (method === 'GET' && path === '/api/v1/messages/my') return await requireAuth(request, env, listMyMessages);
      if (method === 'GET' && path === '/api/v1/messages') return await listMessages(env, url);
      if (method === 'POST' && path === '/api/v1/messages') {
        const user = await getCurrentUser(request, env);
        return await createMessage(request, env, user);
      }
      if (method === 'DELETE' && path.match(/^\/api\/v1\/messages\/\d+$/)) return await requireAuth(request, env, deleteMessage);

      
      if (method === 'GET' && path === '/api/v1/user/settings') return await requireAuth(request, env, getUserSettings);
      if (method === 'PATCH' && path === '/api/v1/user/settings') return await requireAuth(request, env, updateUserSettings);

      
      if (method === 'GET' && path === '/api/v1/admin/dashboard') return await requireAdmin(request, env, getDashboard);
      if (method === 'GET' && path === '/api/v1/admin/posts') return await requireAdmin(request, env, listAdminPosts);
      if (method === 'GET' && path.startsWith('/api/v1/admin/posts/')) return await requireAdmin(request, env, getAdminPost);
      if (method === 'POST' && path === '/api/v1/admin/posts') return await requireAdmin(request, env, createPost);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/posts/')) return await requireAdmin(request, env, updatePost);
      if (method === 'DELETE' && path.startsWith('/api/v1/admin/posts/')) return await requireAdmin(request, env, deletePost);
      if (method === 'GET' && path === '/api/v1/admin/tags') return await requireAdmin(request, env, listAdminTags);
      if (method === 'POST' && path === '/api/v1/admin/tags') return await requireAdmin(request, env, createTag);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/tags/')) return await requireAdmin(request, env, updateTag);
      if (method === 'DELETE' && path.startsWith('/api/v1/admin/tags/')) return await requireAdmin(request, env, deleteTag);
      if (method === 'PATCH' && path === '/api/v1/admin/settings') return await requireAdmin(request, env, updateSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/auth') return await requireAdmin(request, env, getAuthSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/auth') return await requireAdmin(request, env, updateAuthSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/email') return await requireAdmin(request, env, getEmailSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/email') return await requireAdmin(request, env, updateEmailSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/email-template') return await requireAdmin(request, env, getEmailTemplateSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/email-template') return await requireAdmin(request, env, updateEmailTemplateSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/interaction') return await requireAdmin(request, env, getInteractionSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/interaction') return await requireAdmin(request, env, updateInteractionSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/message-wall') return await requireAdmin(request, env, getMessageWallSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/message-wall') return await requireAdmin(request, env, updateMessageWallSettings);
      if (method === 'GET' && path === '/api/v1/admin/messages') return await requireAdmin(request, env, listAdminMessages);
      if (method === 'PATCH' && path === '/api/v1/admin/messages/batch') return await requireAdmin(request, env, updateAdminMessagesBatch);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/messages\/\d+$/)) return await requireAdmin(request, env, updateAdminMessage);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/messages\/\d+$/)) return await requireAdmin(request, env, deleteAdminMessage);
      if (method === 'GET' && path === '/api/v1/admin/comments') return await requireAdmin(request, env, listAdminComments);
      if (method === 'PATCH' && path === '/api/v1/admin/comments/batch') return await requireAdmin(request, env, updateAdminCommentsBatch);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/comments\/\d+$/)) return await requireAdmin(request, env, updateAdminComment);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/comments\/\d+$/)) return await requireAdmin(request, env, deleteAdminComment);
      if (method === 'GET' && path === '/api/v1/admin/users') return await requireAdmin(request, env, listAdminUsers);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/users/')) return await requireSuperAdmin(request, env, updateAdminUser);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/users\/\d+$/)) return await requireSuperAdmin(request, env, deleteAdminUser);

      
      if (method === 'GET' && path === '/api/v1/admin/friends') return await requireAdmin(request, env, listAdminFriends);
      if (method === 'POST' && path === '/api/v1/admin/friends') return await requireAdmin(request, env, createFriend);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/friends\/\d+$/)) return await requireAdmin(request, env, updateFriend);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/friends\/\d+$/)) return await requireAdmin(request, env, deleteFriend);

      if (method === 'GET' && path === '/api/v1/admin/media') return await requireAdmin(request, env, listAdminMedia);
      if (method === 'GET' && path === '/api/v1/admin/media/usage') return await requireAdmin(request, env, getAdminMediaUsage);
      if (method === 'GET' && path === '/api/v1/admin/media/usage/detail') return await requireAdmin(request, env, getAdminMediaUsageDetail);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireAdmin(request, env, getAdminMedia);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireAdmin(request, env, updateAdminMedia);
      if (method === 'POST' && path === '/api/v1/admin/media/upload') return await requireAdmin(request, env, uploadMedia);
      if (method === 'POST' && path === '/api/v1/admin/media/init') return await requireAdmin(request, env, initMediaUpload);
      if (method === 'POST' && path.startsWith('/api/v1/admin/media/chunk/')) return await requireAdmin(request, env, uploadMediaChunk);
      if (method === 'POST' && path.startsWith('/api/v1/admin/media/finalize/')) return await requireAdmin(request, env, finalizeMediaUpload);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireAdmin(request, env, deleteMedia);

      
      if (method === 'GET' && path === '/api/v1/admin/system/databases') return await requireAdmin(request, env, listDatabases);
      if (method === 'GET' && path === '/api/v1/admin/system/status') return await requireSuperAdmin(request, env, getSystemStatus);

      
      if (method === 'GET' && path === '/api/v1/admin/settings/ai') return await requireAdmin(request, env, getAiSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/ai') return await requireAdmin(request, env, updateAiSettings);
      if (method === 'GET' && path === '/api/v1/admin/ai/models') return await requireAdmin(request, env, listAdminAiModels);
      if (method === 'POST' && path === '/api/v1/admin/ai/generate') return await requireAdmin(request, env, aiGeneratePost);
      if (method === 'POST' && path === '/api/v1/admin/ai/format') return await requireAdmin(request, env, aiFormatOptimize);
      if (method === 'POST' && path === '/api/v1/admin/ai/chat') return await requireAdmin(request, env, aiChat);
      if (method === 'GET' && path === '/api/v1/admin/ai/keys') return await requireAdmin(request, env, listAiApiKeys);
      if (method === 'POST' && path === '/api/v1/admin/ai/keys') return await requireAdmin(request, env, createAiApiKey);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/ai\/keys\/\d+$/)) return await requireAdmin(request, env, deleteAiApiKey);
      if (method === 'GET' && path === '/api/v1/admin/ai/custom-models') return await requireAdmin(request, env, listAiCustomModels);
      if (method === 'POST' && path === '/api/v1/admin/ai/custom-models') return await requireAdmin(request, env, createAiCustomModel);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/ai\/custom-models\/\d+$/)) return await requireAdmin(request, env, updateAiCustomModel);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/ai\/custom-models\/\d+$/)) return await requireAdmin(request, env, deleteAiCustomModelHandler);

      
      if (method === 'GET' && path === '/api/v1/admin/themes') return await requireAdmin(request, env, listAdminThemes);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireAdmin(request, env, getAdminTheme);
      if (method === 'POST' && path === '/api/v1/admin/themes') return await requireAdmin(request, env, createAdminTheme);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+\/apply$/)) return await requireAdmin(request, env, applyAdminTheme);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireAdmin(request, env, updateAdminTheme);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireAdmin(request, env, deleteAdminTheme);
      if (method === 'POST' && path === '/api/v1/admin/themes/clear-active') return await requireAdmin(request, env, clearAdminActiveTheme);

      
      if (method === 'GET' && path === '/api/v1/ai/v1/models') return await openaiModels(request, env);
      if (method === 'POST' && path === '/api/v1/ai/v1/chat/completions') return await openaiChatCompletions(request, env);
      if (method === 'POST' && path === '/api/v1/ai/v1/embeddings') return await openaiEmbeddings(request, env);

      
      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        if (!assetResponse || assetResponse.status === 404) {
          return jsonResponse(404, null, 'Not Found', 404);
        }
        const contentType = assetResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const html = await assetResponse.text();
          const site = await getSiteConfigObject(env).catch(() => ({ ...defaultSiteConfig }));
          const modifiedHtml = injectSiteMeta(html, site, request.url);
          return new Response(modifiedHtml, {
            status: assetResponse.status,
            statusText: assetResponse.statusText,
            headers: assetResponse.headers,
          });
        }
        return assetResponse;
      }

      return jsonResponse(404, null, 'Not Found', 404);
    } catch (err) {
      console.error(err);
      const msg = err.message || 'Internal Server Error';
      
      if (
        msg.includes('D1 数据库绑定') ||
        msg.includes("Cannot read properties of undefined (reading 'prepare')") ||
        msg.includes("Cannot read property 'prepare' of undefined") ||
        msg.includes('DB_CONFIG.prepare is not a function')
      ) {
        return jsonResponse(
          500,
          { _debug: getBindingDebugInfo(env, err) },
          'D1 数据库绑定异常，请检查 DB_CONFIG/DB_USERS/DB_POSTS/DB_MEDIA 是否已在 Cloudflare Dashboard 中正确绑定并重新部署。',
          500
        );
      }
      return jsonResponse(500, null, msg, 500);
    }
  },
};
