// xinblog 后端 API（单文件 Worker）
// 部署方式：Cloudflare Pages + _routes.json + 4 个 D1 数据库
// 注意：表结构由用户在 Cloudflare Dashboard 或 wrangler 中手动执行 SQL 初始化，Worker 只处理 API。

import { connect } from 'cloudflare:sockets';

const VERSION = '1.0.0';
const GLOBAL_DAILY_EMAIL_LIMIT = 200; // 全局每日邮件发送总量上限

// ---------- 工具函数 ----------

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

// ---------- Web Crypto 工具 ----------

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

// ---------- 数据库辅助 ----------

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

// ---------- Agent 持久会话（对标 dsh-edge SessionPersistence） ----------
// 会话与消息保存在 DB_CONFIG（settings 库），跨刷新/换设备不丢、可重放、可续聊。
// 表 agent_sessions 存会话元数据；会话消息按 JSON 存 setting `_agent_session_msg:<id>`。

let _agentSessionInitialized = false;
// 每片最多保存的消息条数（10 条一片，自动切分，支持分片加载）
const AGENT_SESSION_PART_SIZE = 10;

/**
 * 把扁平消息数组按顺序切分为若干片（含其内容/trail）。
 * 返回 [{ messages: [...] }] 数组，index 即 part_index。
 */
function chunkAgentMessages(messages) {
  const chunks = [];
  for (let i = 0; i < messages.length; i += AGENT_SESSION_PART_SIZE) {
    chunks.push({ messages: messages.slice(i, i + AGENT_SESSION_PART_SIZE) });
  }
  return chunks;
}

async function ensureAgentSessionTable(env) {
  // 建表/迁移只做一次：进程级 _agentSessionInitialized 标记 + 完成后写 system.agent_sessions_init 标记。
  // 关键：以真实表结构为准（sqlite_master / PRAGMA），不信任旧标记 ——
  // 防止旧库标记已置 1 但子表缺失时提前返回，导致子表永远建不出来、消息存不进去。
  if (_agentSessionInitialized) return;
  const db = getConfigDb(env);
  try {
    const hasSessions = await tableExists(db, 'agent_sessions');
    const hasSub = await tableExists(db, 'agent_session_messages');
    // 结构完整（主表+子表都在）→ 无需任何改动，幂等早退
    if (hasSessions && hasSub) {
      _agentSessionInitialized = true;
      return;
    }
    // —— 首次初始化 / 结构缺失（如旧库只有 agent_sessions.messages 列、没有子表）：自动修复 ——
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS agent_sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '新对话',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`
      )
      .run();
    // 分片存储：每片固定条数消息，避免单行 JSON 随会话无限膨胀（自动切分 + 分片加载）
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS agent_session_messages (
          session_id TEXT NOT NULL,
          part_index INTEGER NOT NULL,
          part_data TEXT NOT NULL,
          PRIMARY KEY (session_id, part_index)
        )`
      )
      .run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated ON agent_sessions(updated_at DESC)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_sm_session ON agent_session_messages(session_id)').run();

    // 旧库迁移：agent_sessions 若还带旧 messages 列（整段 JSON 存对话），
    // 先把数据分片搬进子表，再删掉旧列，让表结构对齐运行时新 schema。
    if (hasSessions && (await columnExists(db, 'agent_sessions', 'messages'))) {
      const old = await db
        .prepare("SELECT id, messages FROM agent_sessions WHERE messages IS NOT NULL AND messages != '' AND messages != '[]'")
        .all();
      for (const row of old.results || []) {
        let arr = [];
        try {
          arr = JSON.parse(row.messages);
        } catch {}
        if (Array.isArray(arr) && arr.length) {
          await migrateAgentMessagesToParts(db, row.id, arr);
        }
      }
      // 删掉旧列（不支持 DROP COLUMN 的环境静默保留，该列此后不再使用）
      try {
        await db.prepare('ALTER TABLE agent_sessions DROP COLUMN messages').run();
      } catch (e) {
        console.error('ensureAgentSessionTable drop messages col:', e && e.message);
      }
    }

    // 写标记（迁移成功完成后才写，保证只迁移一次）
    await db
      .prepare('INSERT OR REPLACE INTO system (key, value, updated_at) VALUES (\'agent_sessions_init\', \'1\', datetime(\'now\'))')
      .run();
    _agentSessionInitialized = true;
  } catch (e) {
    // 建表/迁移失败打日志（会话可能不可用），但不抛到请求链路；不置位，下次请求会重试
    console.error('ensureAgentSessionTable:', e && e.message);
  }
}

// 检测表是否存在（以 sqlite_master 真实结构为准）
async function tableExists(db, name) {
  const r = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).first();
  return !!r;
}

// 检测表中是否存在某列（PRAGMA table_info 不支持绑定表名，表名来自代码内常量，安全）
async function columnExists(db, table, col) {
  const r = await db.prepare(`PRAGMA table_info(${table})`).all();
  return (r.results || []).some((c) => c.name === col);
}

// 把旧 schema 一整段 messages 切分写入子表（复用 chunkAgentMessages 分片规则）
async function migrateAgentMessagesToParts(db, id, messages) {
  const chunks = chunkAgentMessages(messages);
  if (!chunks.length) return;
  const insert = db.prepare('INSERT OR REPLACE INTO agent_session_messages (session_id, part_index, part_data) VALUES (?, ?, ?)');
  for (let i = 0; i < chunks.length; i++) {
    await insert.bind(id, i, JSON.stringify(chunks[i].messages)).run();
  }
}

function normalizeAgentMessage(m) {
  if (!m) return null;
  const content = m && typeof m.content === 'string' ? m.content : '';
  let role = m && m.role;
  if (role !== 'user' && role !== 'assistant') role = 'user';
  if (!content) return null;
  return { role, content };
}

async function agentSessionGet(env, id) {
  // 读取前确保结构完整（幂等）：旧库迁移/建表只发生一次，避免读到缺失的子表
  await ensureAgentSessionTable(env);
  const db = getConfigDb(env);
  const row = await db
    .prepare('SELECT id, title, created_at, updated_at FROM agent_sessions WHERE id = ?')
    .bind(id)
    .first();
  if (!row) return null;
  let messages = [];
  try {
    const parts = await db
      .prepare('SELECT part_index, part_data FROM agent_session_messages WHERE session_id = ? ORDER BY part_index ASC')
      .bind(id)
      .all();
    for (const p of parts.results || []) {
      const arr = JSON.parse(p.part_data);
      if (Array.isArray(arr)) messages = messages.concat(arr);
    }
  } catch (e) {
    console.error('agentSessionGet parts:', e && e.message);
  }
  return { id: row.id, title: row.title, messages, createdAt: row.created_at, updatedAt: row.updated_at };
}

// 分片加载。partIndex >= 0 按正序取第 N 片（0 为最早）；
// partIndex < 0 按倒序取（-1 为最后/最新一片，-2 为倒数第二……），供前端"向上翻"加载更早历史。
async function agentSessionGetPart(env, id, partIndex) {
  const db = getConfigDb(env);
  const row = await db
    .prepare('SELECT part_index, part_data FROM agent_session_messages WHERE session_id = ? ORDER BY part_index ASC')
    .bind(id)
    .all();
  const parts = (row.results || []).map((p) => ({
    index: Number(p.part_index),
    data: (() => {
      try {
        const arr = JSON.parse(p.part_data);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    })(),
  }));
  const total = parts.length;
  let target = null;
  let n = Number(partIndex);
  if (!Number.isFinite(n)) n = -1;
  if (total === 0) {
    target = null;
  } else if (n < 0) {
    // 前端统一用 -1 拉「全量」（本地再按 10 条一页分页展示）：
    // 按回合分块存储后，这里把全部回合的消息按顺序合并成一份返回。
    const merged = [];
    for (const p of parts) merged.push(...p.data);
    return { total, partIndex: -1, messages: merged };
  } else {
    // 正索引：取第 N 个回合（0 为最早）——保留按回合逐片拉取的扩展能力
    target = parts.find((p) => p.index === n) || parts[parts.length - 1];
  }
  return { total, partIndex: target ? target.index : -1, messages: target ? target.data : [] };
}

async function agentSessionSave(env, id, title, messages) {
  // 保存前确保会话表/分片子表已建（幂等，不重复建表）：
  // 进程内 _agentSessionInitialized 标记 + system.agent_sessions_init 标记 + CREATE TABLE IF NOT EXISTS 三重保障。
  // 防止 aiAgent 首次落库时子表尚未创建（旧库由 config.sql 初始化只有 messages 列、没有子表）而写入失败。
  await ensureAgentSessionTable(env);
  const db = getConfigDb(env);
  const slug = String(title || '新对话').slice(0, 60);
  const nowIso = new Date().toISOString();
  const existing = await db.prepare('SELECT created_at FROM agent_sessions WHERE id = ?').bind(id).first();
  const createdAt = existing ? existing.created_at : nowIso;
  // 保留足够历史，但设个总条数上限，防止无限膨胀撑爆存储
  const capped = messages.slice(-2000);
  await db
    .prepare('INSERT OR REPLACE INTO agent_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .bind(id, slug, createdAt, nowIso)
    .run();
  // 按「每个回合」分块存储：一条用户消息及其后续的思考/工具调用/回复合为一个回合，存成一行。
  // part_index 为该回合在会话内的序号（0 为最早）。这样数据库里不再是一条整段 JSON，
  // 而是按问答回合逐行分开，读/看表都更清晰，也便于按回合分页拉取。
  const blocks = splitAgentSessionMessages(capped);
  await db.prepare('DELETE FROM agent_session_messages WHERE session_id = ?').bind(id).run();
  for (let i = 0; i < blocks.length; i++) {
    await db
      .prepare('INSERT OR REPLACE INTO agent_session_messages (session_id, part_index, part_data) VALUES (?, ?, ?)')
      .bind(id, i, JSON.stringify(blocks[i]))
      .run();
  }
  // 返回服务器落库时间戳，供前端作为"云端同步游标"（避免用客户端 Date.now() 造成时钟偏差）
  return { updatedAt: nowIso };
}

// 把扁平消息序列切成「回合」块：role='user' 开启一个新回合，
// 并把其后直到下一条用户消息之间的 assistant/tool 内容归入该回合。
function splitAgentSessionMessages(messages) {
  const blocks = [];
  let cur = [];
  for (const m of messages) {
    if (m.role === 'user' && cur.length) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(m);
  }
  if (cur.length) blocks.push(cur);
  return blocks.length ? blocks : [[]];
}

// 构造「一条 assistant 展示记录」：正文 + 该轮完整 trail + 用量，供逐轮持久化。
// 这样每一轮问答（思考/工具/正文）都作为独立 assistant 消息保存，历史轮次的步骤可在前端重建。
function makeAssistantDisplay(content, trail, stats) {
  const m = { role: 'assistant' };
  if (content) m.content = content;
  if (trail && trail.length) m.trail = trail;
  m._display = true;
  if (stats && stats.rounds) m.rounds = stats.rounds;
  if (stats && stats.tokens && (stats.tokens.prompt || stats.tokens.completion || stats.tokens.total)) {
    m.usage = stats.tokens;
  }
  m.updatedAt = new Date().toISOString();
  return m;
}

async function agentSessionList(env, limit = 50) {
  const db = getConfigDb(env);
  const rows = await db
    .prepare('SELECT id, title, created_at, updated_at FROM agent_sessions ORDER BY updated_at DESC LIMIT ?')
    .bind(Math.min(Number(limit) || 50, 100))
    .all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function agentSessionDelete(env, id) {
  const db = getConfigDb(env);
  await db.prepare('DELETE FROM agent_sessions WHERE id = ?').bind(id).run();
  await db.prepare('DELETE FROM agent_session_messages WHERE session_id = ?').bind(id).run();
}

// 时间戳从 2026-01-01 起记（近百年不溢出），保证 ID 随时间递增、可排序可判断新旧
const SESSION_ID_EPOCH = new Date('2026-01-01T00:00:00.000Z').getTime();
function makeAgentSessionId() {
  const tick = Date.now() - SESSION_ID_EPOCH;
  return `s_${tick.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Agent Web Search 技能（对标 dsh-edge web_search） ----------
// 通过 DuckDuckGo 免 key 端点做联网检索，返回结构化真实网页结果供 agent 引用。
// 说明：旧实现使用 Instant Answer 接口，它只返回维基式摘要，普通问题基本为空，故改为真实搜索结果页。
const WEB_SEARCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 提取页面中所有带指定 class 的 <a> 标签，兼容属性顺序与多 class 写法
function extractAnchors(html, className) {
  const out = [];
  const classRe = new RegExp(`(?:^|\\s)${className}(?:\\s|$)`);
  const re = /<a\s([^>]*)>([\s\S]*?)<\/a>/g;
  for (const m of String(html || '').matchAll(re)) {
    const attrs = m[1];
    const cls = attrs.match(/class="([^"]*)"/);
    if (!cls || !classRe.test(cls[1])) continue;
    const href = attrs.match(/href="([^"]*)"/);
    if (!href) continue;
    out.push({ href: href[1], inner: m[2] });
  }
  return out;
}

// 解析 html.duckduckgo.com/html/ 结果页：标题 result__a、摘要 result__snippet（均为 <a>）
function parseDdgHtml(html, maxResults) {
  const anchors = extractAnchors(html, 'result__a');
  const snippets = extractAnchors(html, 'result__snippet');
  const results = [];
  for (let i = 0; i < anchors.length && results.length < maxResults; i++) {
    const realUrl = resolveDdgUrl(anchors[i].href);
    if (!realUrl) continue;
    results.push({
      kind: 'result',
      title: stripHtmlTags(anchors[i].inner) || realUrl,
      url: realUrl,
      snippet: stripHtmlTags(snippets[i] ? snippets[i].inner : ''),
    });
  }
  return results;
}

// 解析 lite.duckduckgo.com/lite/ 结果页：链接 class="result-link"，摘要在 td.result-snippet
function parseDdgLite(html, maxResults) {
  const s = String(html || '');
  const links = extractAnchors(s, 'result-link');
  const snippets = [...s.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  const results = [];
  for (let i = 0; i < links.length && results.length < maxResults; i++) {
    const realUrl = resolveDdgUrl(links[i].href);
    if (!realUrl) continue;
    results.push({
      kind: 'result',
      title: stripHtmlTags(links[i].inner) || realUrl,
      url: realUrl,
      snippet: stripHtmlTags(snippets[i] || ''),
    });
  }
  return results;
}

// 取 XML 标签文本，兼容 CDATA 包裹
function pickXmlTag(block, tag) {
  const m = String(block || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1];
  return v.trim();
}

// 解析 Bing RSS 搜索结果（XML）：结构稳定、无需 key，作为首选搜索源
function parseBingRss(xml, maxResults) {
  const results = [];
  for (const it of String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    if (results.length >= maxResults) break;
    const url = stripHtmlTags(pickXmlTag(it[1], 'link'));
    if (!/^https?:\/\//i.test(url)) continue;
    results.push({
      kind: 'result',
      title: stripHtmlTags(pickXmlTag(it[1], 'title')) || url,
      url,
      snippet: stripHtmlTags(pickXmlTag(it[1], 'description')),
    });
  }
  return results;
}

async function agentWebSearch(query, maxResults = 5) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: '缺少搜索关键词' };
  // 依次尝试多个免 key 端点，任一解析出结果即返回（Bing RSS 最稳，DDG 作兜底）
  const endpoints = [
    { url: 'https://www.bing.com/search?format=rss&count=10&q=' + encodeURIComponent(q), parse: parseBingRss },
    { url: 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), parse: parseDdgHtml },
    { url: 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(q), parse: parseDdgLite },
  ];
  let lastErr = '';
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: { 'User-Agent': WEB_SEARCH_UA, Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      });
      if (!res.ok) {
        lastErr = 'HTTP ' + res.status;
        continue;
      }
      const results = ep.parse(await res.text(), maxResults);
      if (results.length) return { ok: true, data: { query: q, results } };
    } catch (e) {
      lastErr = e && e.message;
    }
  }
  return {
    ok: false,
    error: '没有找到相关结果，可尝试换关键词' + (lastErr ? `（${lastErr}）` : ''),
  };
}

// 解析 DuckDuckGo 跳转链接（//duckduckgo.com/l/?uddg=<真实地址>），还原真实目标 URL
function resolveDdgUrl(u) {
  const s = String(u || '');
  try {
    const parsed = new URL(s, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return uddg;
  } catch {
    /* 非标准 URL 继续走下方兜底 */
  }
  if (/^\/\//.test(s)) return 'https:' + s;
  if (/^https?:\/\//i.test(s)) return s;
  return '';
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
  // 对配置类读取使用 first-primary，避免 D1 读副本异步复制导致保存后仍读到旧数据
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

// ---------- 认证中间件 ----------

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

// 供 WebSocket 握手使用：直接校验一个原始 access token，返回登录用户（鉴权放 Pages 端）。
async function resolveAuthIdentity(token, env) {
  if (!token) return null;
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload.type !== 'access') return null;
    const user = await env.DB_USERS.prepare(
      'SELECT id, username, email, avatar_base64, role, status FROM users WHERE id = ?'
    )
      .bind(payload.sub)
      .first();
    if (!user || user.status !== 1) return null;
    return user;
  } catch {
    return null;
  }
}

// 把新身份头合并进原请求头，返回带 mergedHeaders 的对象。
function buildAuthHeaders(requestHeaders, identity) {
  const headers = new Headers(requestHeaders);
  headers.set('x-user-id', String(identity.id));
  headers.set('x-username', String(identity.username || ''));
  return { mergedHeaders: headers };
}

// 构造指向聊天 DO 的"内部"媒体/数据子路径 URL（/api/room/<key><subPath>）。
// 聊天 Worker 无公网端口，只能经 Pages 的 env.CHAT Service Binding 内部调用。
function buildChatSubUrl(roomKey, subPath) {
  const u = new URL('https://internal');
  u.pathname = `/api/room/${roomKey}${subPath.charAt(0) === '/' ? subPath : '/' + subPath}`;
  return u;
}

async function requireAuth(request, env, handler) {
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  return handler(request, env, user);
}

async function requireAdmin(request, env, handler) {
  // 管理后台：管理员(admin)与超级管理员(super_admin)可访问内容/社区管理接口；
  // 站主级配置(用户/系统/外观/主题/AI凭据等)另走 requireSuperAdmin
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return jsonResponse(403, null, 'Forbidden', 403);
  }
  return handler(request, env, user);
}

async function requireSuperAdmin(request, env, handler) {
  const user = await getCurrentUser(request, env);
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  if (user.role !== 'super_admin') return jsonResponse(403, null, 'Forbidden', 403);
  return handler(request, env, user);
}

// ---------- 接口处理器 ----------

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
  const ai = (await getSetting(env, 'ai')) || {};
  // 自愈兜底：没有应用任何主题时，强制将 cardTheme 归一为原生默认卡片（variant='default'，
  // 走 PostCard 的 else 回退分支），避免旧数据残留 cloud-overlay 导致主页永远显示非默认卡片。
  const activeThemeId = (await getSetting(env, 'active_theme')) || '';
  const cardTheme = activeThemeId
    ? { ...defaultSiteConfig.cardTheme, ...(site.cardTheme || {}) }
    : defaultSiteConfig.cardTheme;
  return {
    ...defaultSiteConfig,
    ...site,
    // AI 智能体开关：站点 AI 功能开启且启用了 Agent 时侧边栏显示「AI 助手」入口，
    // 并入 site config 一并下发，与「友链/音乐」一致，首次绘制即可见，避免条目晚插入造成闪烁。
    agentEnabled: ai.agentEnabled === true && ai.enabled === true,
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
  // 拆分到多个 key 存储，避免单条记录因 Base64 图片过大超过 D1 1MB 限制
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

  // 填充标签
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

// ---------- 速率限制 ----------

let rateLimitTableReady = false;

async function ensureRateLimitTable(env) {
  if (rateLimitTableReady) return;
  await env.DB_USERS.prepare(
    'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL)'
  ).run();
  rateLimitTableReady = true;
}

// 刷新令牌复用检测（refresh token reuse detection）：
// 每张 refresh token 带一个 jti，每次「轮换」会把它标记为已消费（consumed=1）并签发带新 jti 的令牌。
// 若某 refresh token 的 hash 已不在 refresh_tokens 表、但其 jti 被标记为已消费，说明该令牌曾被使用过
// （即被「重放」），判定为被盗用 → 作废该用户全部会话。这是让会话「常驻」又不放大令牌泄露风险的关键安全控制。
let refreshJtiTableReady = false;
async function ensureRefreshJtiTable(env) {
  if (refreshJtiTableReady) return;
  await env.DB_USERS.prepare(
    'CREATE TABLE IF NOT EXISTS refresh_token_jtis (jti TEXT PRIMARY KEY, user_id TEXT, consumed INTEGER NOT NULL DEFAULT 0, created_at TEXT)'
  ).run();
  refreshJtiTableReady = true;
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

// 原子计数限流：key 在 windowSec 秒窗口内最多允许 limit 次，返回 true 表示放行
async function checkRateLimit(env, key, limit, windowSec) {
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const bucketKey = `rl:${key}:${bucket}`;
  const db = env.DB_USERS;
  try {
    await db.prepare(
      'INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = rate_limits.count + 1'
    )
      .bind(bucketKey, bucket)
      .run();
  } catch (e) {
    // 旧库缺少表时懒创建，并放行本次请求
    if (e.message && e.message.includes('no such table')) {
      await ensureRateLimitTable(env);
      return true;
    }
    throw e;
  }
  const row = await db.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(bucketKey).first();
  if (!row) return true;
  // 窗口翻转后复用了旧桶行时重置计数
  if (row.window_start !== bucket) {
    await db.prepare('UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?').bind(bucket, bucketKey).run();
    return true;
  }
  // 概率性清理过期桶，防止表无限增长
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(bucket - 3).run();
  }
  return row.count <= limit;
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

  // 速率限制：按 IP 与邮箱限流，防止批量灌号
  const regIp = getClientIp(request);
  if (!(await checkRateLimit(env, `reg:ip:${regIp}`, 5, 3600))) {
    return jsonResponse(429, null, '注册过于频繁，请稍后再试', 429);
  }
  if (!(await checkRateLimit(env, `reg:email:${email.toLowerCase()}`, 3, 3600))) {
    return jsonResponse(429, null, '该邮箱注册过于频繁，请稍后再试', 429);
  }

  if (authSettings.emailVerification === true) {
    if (!code) return jsonResponse(403, null, '请输入邮箱验证码');
    const record = await env.DB_USERS.prepare(
      'SELECT code, expires_at FROM verify_codes WHERE email = ?'
    )
      .bind(email)
      .first();
    if (!record) return jsonResponse(403, null, '请先获取邮箱验证码');
    if (record.code !== code) {
      // 验证码比对限流：防止对同一邮箱爆破验证码
      if (!(await checkRateLimit(env, `vc-check:${email.toLowerCase()}`, 5, 600))) {
        return jsonResponse(429, null, '验证码错误次数过多，请重新获取', 429);
      }
      return jsonResponse(403, null, '验证码错误');
    }
    const nowTime = new Date().toISOString();
    if (record.expires_at < nowTime) return jsonResponse(403, null, '验证码已过期');
    await env.DB_USERS.prepare('DELETE FROM verify_codes WHERE email = ?').bind(email).run();
  }

  // 注册场景验证：开关开启时需通过人机验证
  if (authSettings.registerVerification === true) {
    if (!(await verifyHuman(request, env, body))) {
      return jsonResponse(403, null, '人机验证未通过，请重试');
    }
  }

  // 第一个注册用户自动成为 super_admin
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

  // 登录场景验证：开关开启时需通过人机验证
  const authSettings = (await getSetting(env, 'auth')) || {};
  if (authSettings.loginVerification === true) {
    if (!(await verifyHuman(request, env, body))) {
      return jsonResponse(403, null, '人机验证未通过，请重试');
    }
  }

  // 速率限制：按 IP 与账号限流，防止暴力破解
  const loginIp = getClientIp(request);
  if (!(await checkRateLimit(env, `login:ip:${loginIp}`, 10, 600))) {
    return jsonResponse(429, null, '尝试次数过多，请 10 分钟后再试', 429);
  }
  const accountKey = account.toLowerCase();
  if (!(await checkRateLimit(env, `login:acc:${accountKey}`, 5, 600))) {
    return jsonResponse(429, null, '该账号尝试次数过多，请 10 分钟后再试', 429);
  }

  let user = await env.DB_USERS.prepare(
    'SELECT id, username, email, email_verified, avatar_base64, role, status, password_hash, password_salt FROM users WHERE username = ?'
  )
    .bind(account)
    .first();

  // 允许使用邮箱登录
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
  await ensureRefreshJtiTable(env);
  const accessToken = await signJWT(
    { sub: user.id, username: user.username, role: user.role, type: 'access', iat: nowSec, exp: nowSec + 48 * 3600 },
    env.JWT_SECRET
  );
  // refresh token 改为 30 天滑动窗口（与刷新后的时长一致），配合前端持续保活实现「活跃即不掉线」
  const refreshJti = crypto.randomUUID();
  const refreshExp = nowSec + 30 * 24 * 3600;
  const refreshToken = await signJWT(
    { sub: user.id, type: 'refresh', jti: refreshJti, iat: nowSec, exp: refreshExp },
    env.JWT_SECRET
  );

  const tokenHash = await sha256Hex(refreshToken);
  const expiresAt = new Date(refreshExp * 1000).toISOString();
  await env.DB_USERS.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, tokenHash, expiresAt, now())
    .run();
  await env.DB_USERS.prepare('INSERT INTO refresh_token_jtis (jti, user_id, consumed, created_at) VALUES (?, ?, 0, ?)')
    .bind(refreshJti, user.id, now())
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
    await ensureRefreshJtiTable(env);
    const payload = await verifyJWT(refreshToken, env.JWT_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const tokenHash = await sha256Hex(refreshToken);
    const row = await env.DB_USERS.prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first();

    // 复用检测：令牌不在当前有效表里，但 jti 已被标记为「已消费」（说明此前已被轮换/使用过），
    // 即被重放 → 判定为被盗用，作废该用户全部会话（强制两端下线）。
    if (!row) {
      const used = payload.jti
        ? await env.DB_USERS.prepare('SELECT consumed FROM refresh_token_jtis WHERE jti = ?').bind(payload.jti).first()
        : null;
      if (used && used.consumed === 1) {
        await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(payload.sub).run();
        return jsonResponse(401, null, 'Refresh token reuse detected, all sessions revoked');
      }
      return jsonResponse(401, null, 'Refresh token invalid');
    }

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

    // 刷新后使旧 refresh token 失效（单次使用 + 轮换策略），并标记其 jti 已消费
    await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).run();
    if (payload.jti) {
      await env.DB_USERS.prepare('UPDATE refresh_token_jtis SET consumed = 1 WHERE jti = ?').bind(payload.jti).run();
    }
    const newRefreshJti = crypto.randomUUID();
    const refreshExpSec = nowSec + 30 * 24 * 3600;
    const newRefreshToken = await signJWT(
      { sub: user.id, type: 'refresh', jti: newRefreshJti, iat: nowSec, exp: refreshExpSec },
      env.JWT_SECRET
    );
    const newRefreshTokenHash = await sha256Hex(newRefreshToken);
    await env.DB_USERS.prepare(
      'INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
    )
      .bind(newRefreshTokenHash, user.id, new Date(refreshExpSec * 1000).toISOString())
      .run();
    await env.DB_USERS.prepare('INSERT INTO refresh_token_jtis (jti, user_id, consumed, created_at) VALUES (?, ?, 0, ?)')
      .bind(newRefreshJti, user.id, now())
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
  // 优先从请求体获取 refreshToken，同时兼容 Authorization 头
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
        // 若仅提供 access token，则撤销该用户的全部 refresh tokens（兜底安全策略）
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
  // 折线统计：最近 N 天的逐日数据（created_at 为 ISO 字符串，substr 取日期分组）
  let days = 30;
  try {
    const p = new URL(request.url).searchParams.get('days');
    if (p) days = parseInt(p, 10);
  } catch {}
  if (![7, 30, 90].includes(days)) days = 30;
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const dayList = [];
  for (let i = days - 1; i >= 0; i--) {
    dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  const fill = (rows) => {
    const map = Object.fromEntries((rows || []).map((r) => [r.day, r.c]));
    return dayList.map((d) => map[d] || 0);
  };
  const countByDay = (db, table) =>
    db
      .prepare(`SELECT substr(created_at,1,10) AS day, COUNT(*) AS c FROM ${table} WHERE created_at >= ? GROUP BY day`)
      .bind(sinceIso)
      .all()
      .then((r) => fill(r.results));

  const [postCount, tagCount, mediaCount, userCount, postsTrend, commentsTrend, likesTrend, usersTrend, mediaTrend, viewsRow] =
    await Promise.all([
      env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM posts').first().then((r) => r.c),
      env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM tags').first().then((r) => r.c),
      env.DB_MEDIA.prepare('SELECT COUNT(*) as c FROM media').first().then((r) => r.c),
      env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first().then((r) => r.c),
      countByDay(env.DB_POSTS, 'posts'),
      countByDay(env.DB_POSTS, 'comments'),
      countByDay(env.DB_POSTS, 'likes'),
      countByDay(env.DB_USERS, 'users'),
      countByDay(env.DB_MEDIA, 'media'),
      env.DB_POSTS.prepare('SELECT COALESCE(SUM(views),0) AS v FROM posts').first(),
    ]);

  const latestPosts = await env.DB_POSTS.prepare(
    'SELECT id, title, slug, status, created_at FROM posts ORDER BY created_at DESC LIMIT 5'
  ).all();
  return jsonResponse(0, {
    counts: { posts: postCount, tags: tagCount, media: mediaCount, users: userCount, views: viewsRow.v },
    latestPosts: latestPosts.results || [],
    trends: { days, dates: dayList, posts: postsTrend, comments: commentsTrend, likes: likesTrend, users: usersTrend, media: mediaTrend },
  });
}

async function listAdminPosts(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;
  const keyword = (url.searchParams.get('keyword') || '').trim();

  let posts, countRow;
  if (keyword) {
    const like = `%${keyword}%`;
    posts = await env.DB_POSTS.prepare(
      `SELECT id, title, slug, excerpt, status, views, reading_time, created_at, updated_at
       FROM posts WHERE title LIKE ? OR excerpt LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(like, like, limit, offset)
      .all();
    countRow = await env.DB_POSTS.prepare(
      'SELECT COUNT(*) as c FROM posts WHERE title LIKE ? OR excerpt LIKE ?'
    )
      .bind(like, like)
      .first();
  } else {
    posts = await env.DB_POSTS.prepare(
      `SELECT id, title, slug, excerpt, status, views, reading_time, created_at, updated_at
       FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();
    countRow = await env.DB_POSTS.prepare('SELECT COUNT(*) as c FROM posts').first();
  }
  const list = await fillPostTags(env, posts.results || []);
  return jsonResponse(0, { list, total: countRow.c, page, limit });
}

async function getAdminPost(request, env, user) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id')
    ? parseInt(url.searchParams.get('id'), 10)
    : parseInt(request.url.split('/').pop(), 10);
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
  // 删除该文章下所有评论（含楼中楼，先删子再删父，避免外键约束报错）
  await deleteCommentsByPost(env, id);
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
    // 合并而非整体覆盖：AI 改协议/简介等只传部分字段时，不能把 site 里其它配置（配色/字体/外观等）冲掉
    const currentSite = (await getSetting(env, 'site')) || {};
    await setSetting(env, 'site', { ...currentSite, ...siteRest });
    if (hero) {
      const curHero = (await getSetting(env, 'hero')) || {};
      await setSetting(env, 'hero', { ...curHero, ...hero });
    }
    if (about) {
      const curAbout = (await getSetting(env, 'about')) || {};
      await setSetting(env, 'about', { ...curAbout, ...about });
    }
    if (friends) {
      const curFriends = (await getSetting(env, 'friends')) || {};
      await setSetting(env, 'friends', { ...curFriends, ...friends });
    }
  }
  return jsonResponse(0, null, '保存成功');
}

// ---------- 主题管理 ----------

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
  // 优先使用请求体传入的 postCard（前端内置主题直接带上，避免依赖 D1 中可能过期的旧数据）
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

const MAX_MEDIA_CHUNK_SIZE = 80 * 1024; // 80KB base64 per chunk, well under D1 100KB statement limit

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

  // 清理 Cloudflare 缓存中的旧图片
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

  // 文章封面与正文引用
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

  // 用户头像
  const users = await env.DB_USERS.prepare(
    `SELECT id, username, avatar_base64 FROM users WHERE avatar_base64 LIKE ?`
  )
    .bind(`%${urlPattern}%`)
    .all();
  for (const u of users.results || []) {
    bindings.push({ type: 'user', id: u.id, name: u.username });
  }

  // 友链头像
  const friends = await env.DB_CONFIG.prepare(
    `SELECT id, name, avatar FROM friends WHERE avatar LIKE ?`
  )
    .bind(`%${urlPattern}%`)
    .all();
  for (const f of friends.results || []) {
    bindings.push({ type: 'friend', id: f.id, name: f.name });
  }

  // 站点设置中的图片引用（配置读取一次，避免多次查询）
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
    // 按实际观察比例 1.42 估算 D1 真实存储占用，只读 size 字段、省额度
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
  const url = new URL(request.url);
  const id = url.searchParams.get('id')
    ? parseInt(url.searchParams.get('id'), 10)
    : parseInt(request.url.split('/').pop(), 10);
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

  // 兼容前端可能传入的完整 data URI scheme，统一提取纯 base64
  const base64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
  if (!base64) return jsonResponse(400, null, '图片数据为空');

  const size = Math.floor(base64.length * 0.75);

  // 清理旧分片
  await env.DB_MEDIA.prepare('DELETE FROM media_chunks WHERE media_id = ?').bind(id).run();

  if (base64.length <= MAX_MEDIA_CHUNK_SIZE) {
    // 小文件直接存储完整 base64
    await env.DB_MEDIA.prepare(
      `UPDATE media SET name = ?, mime_type = ?, size = ?, base64_data = ?, width = ?, height = ?, chunk_count = 0, created_at = ?
       WHERE id = ?`
    )
      .bind(name, mimeType, size, base64, width, height, now(), id)
      .run();
  } else {
    // 大文件分片存储，避免超过 D1 单条语句限制
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

  // 清理 Cloudflare 缓存中的旧图片
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

  // 获取各库表行数作为容量参考
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

// ---------- 认证/安全设置 ----------

const defaultAuthSettings = {
  allowRegister: true,
  emailVerification: false,
  enableForgotPassword: false,
  // 各场景是否启用验证（开关可实时调整）
  loginVerification: false,
  registerVerification: false,
  forgotPasswordVerification: false,
  // 人机验证：none | turnstile | math | geetest | hcaptcha
  verificationMode: 'none',
  turnstileSiteKey: '',
  turnstileSecret: '',
  geetestCaptchaId: '',
  geetestCaptchaKey: '',
  hcaptchaSiteKey: '',
  hcaptchaSecret: '',
};

async function getAuthSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'auth')) || {};
    const result = { ...defaultAuthSettings, ...data };
    // 密钥不回显前端
    if (result.turnstileSecret) result.turnstileSecret = '****';
    if (result.geetestCaptchaKey) result.geetestCaptchaKey = '****';
    if (result.hcaptchaSecret) result.hcaptchaSecret = '****';
    return jsonResponseWithCache(0, result, 'ok', 200, 'public, max-age=60');
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
  const existing = (await getSetting(env, 'auth')) || {};
  const merged = { ...defaultAuthSettings, ...existing };
  // 与已有配置合并，允许"用户管理-验证设置"单独保存验证相关字段而不覆盖其它配置
  const verificationMode = ['none', 'turnstile', 'math', 'geetest', 'hcaptcha'].includes(body.verificationMode)
    ? body.verificationMode
    : merged.verificationMode;
  const data = {
    ...merged,
    allowRegister: body.allowRegister !== undefined ? body.allowRegister !== false : merged.allowRegister,
    emailVerification: body.emailVerification !== undefined ? body.emailVerification === true : merged.emailVerification,
    enableForgotPassword: body.enableForgotPassword !== undefined
      ? body.enableForgotPassword === true
      : merged.enableForgotPassword,
    loginVerification: body.loginVerification !== undefined
      ? body.loginVerification === true
      : merged.loginVerification,
    registerVerification: body.registerVerification !== undefined
      ? body.registerVerification === true
      : merged.registerVerification,
    forgotPasswordVerification: body.forgotPasswordVerification !== undefined
      ? body.forgotPasswordVerification === true
      : merged.forgotPasswordVerification,
    verificationMode,
    turnstileSiteKey: body.turnstileSiteKey !== undefined
      ? String(body.turnstileSiteKey || '').trim()
      : merged.turnstileSiteKey,
    // 空值或星号表示"保持不变"；密钥不回显前端
    turnstileSecret:
      body.turnstileSecret === undefined ||
      body.turnstileSecret === '' ||
      body.turnstileSecret === '****'
        ? merged.turnstileSecret
        : String(body.turnstileSecret || '').trim(),
    geetestCaptchaId: body.geetestCaptchaId !== undefined
      ? String(body.geetestCaptchaId || '').trim()
      : merged.geetestCaptchaId,
    geetestCaptchaKey:
      body.geetestCaptchaKey === undefined ||
      body.geetestCaptchaKey === '' ||
      body.geetestCaptchaKey === '****'
        ? merged.geetestCaptchaKey
        : String(body.geetestCaptchaKey || '').trim(),
    hcaptchaSiteKey: body.hcaptchaSiteKey !== undefined
      ? String(body.hcaptchaSiteKey || '').trim()
      : merged.hcaptchaSiteKey,
    hcaptchaSecret:
      body.hcaptchaSecret === undefined ||
      body.hcaptchaSecret === '' ||
      body.hcaptchaSecret === '****'
        ? merged.hcaptchaSecret
        : String(body.hcaptchaSecret || '').trim(),
  };
  await setSetting(env, 'auth', data);
  return jsonResponse(0, data, '保存成功');
}

// ---------- 邮箱设置 ----------

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
    const result = { ...defaultEmailSettings, ...data };
    // 邮箱配置含敏感信息且后台会频繁修改，禁止缓存避免保存后仍显示旧值
    // 脱敏，不将密钥明文返回前端
    if (result.resendApiKey) result.resendApiKey = '****';
    if (result.smtpPass) result.smtpPass = '****';
    return jsonResponse(0, result, 'ok');
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
  const existing = (await getSetting(env, 'email')) || {};
  const data = {
    provider: String(body.provider || 'resend'),
    from: String(body.from || ''),
    fromName: String(body.fromName || ''),
    resendApiKey: body.resendApiKey === '****' ? existing.resendApiKey : String(body.resendApiKey || ''),
    smtpHost: String(body.smtpHost || ''),
    smtpPort: parseInt(body.smtpPort || '587', 10) || 587,
    smtpUser: String(body.smtpUser || ''),
    smtpPass: body.smtpPass === '****' ? existing.smtpPass : String(body.smtpPass || ''),
    smtpSecure: body.smtpSecure === true,
  };
  await setSetting(env, 'email', data);
  // 返回时也脱敏
  const result = { ...data };
  if (result.resendApiKey) result.resendApiKey = '****';
  if (result.smtpPass) result.smtpPass = '****';
  return jsonResponse(0, result, '保存成功');
}

// ---------- 评论邮件通知设置 ----------

const defaultCommentNotifySettings = {
  enabled: false,
  notifyEmail: '',
  dailyLimit: 100,
  reserveForRegister: 10,
  notifyAdminOnNew: true,
  notifyAdminReply: true,
  notifyUserReply: false,
};

async function getCommentNotifySettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'comment_notify')) || {};
    const result = { ...defaultCommentNotifySettings, ...data };
    return jsonResponse(0, result, 'ok');
  } catch (err) {
    if (isBindingError(err)) {
      console.error('读取评论通知设置失败，返回默认配置:', err);
      return jsonResponse(0, { ...defaultCommentNotifySettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateCommentNotifySettings(request, env, user) {
  const body = await request.json();
  const existing = (await getSetting(env, 'comment_notify')) || {};
  const data = {
    enabled: body.enabled === true,
    notifyEmail: String(body.notifyEmail || existing.notifyEmail || ''),
    dailyLimit: parseInt(body.dailyLimit, 10) || defaultCommentNotifySettings.dailyLimit,
    reserveForRegister: parseInt(body.reserveForRegister, 10) || defaultCommentNotifySettings.reserveForRegister,
    notifyAdminOnNew: body.notifyAdminOnNew !== false,
    notifyAdminReply: body.notifyAdminReply !== false,
    notifyUserReply: body.notifyUserReply === true,
  };
  await setSetting(env, 'comment_notify', data);
  return jsonResponse(0, data, '保存成功');
}

// ---------- 每日邮件发送计数 ----------

async function getEmailDailyCount(env) {
  const data = await getSetting(env, 'email_daily_count');
  const today = new Date().toISOString().slice(0, 10);
  if (data && data.date === today) {
    return data.count || 0;
  }
  return 0;
}

async function incrementEmailDailyCount(env) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await getSetting(env, 'email_daily_count');
  const count = (data && data.date === today ? (data.count || 0) : 0) + 1;
  await setSetting(env, 'email_daily_count', { date: today, count });
  return count;
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

const defaultResetEmailTemplate = {
  subject: '您的密码重置验证码',
  html: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置密码</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
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
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">我们收到了您重置 {{siteName}} 密码的请求，请在 {{expireMinutes}} 分钟内使用以下验证码完成密码重置：</p>
              <div style="text-align:center;padding:24px 0;">
                <table cellpadding="0" cellspacing="0" border="0" bgcolor="#5b7cfa" style="background-color:#5b7cfa;border-radius:12px;display:inline-block;">
                  <tr>
                    <td style="padding:16px 32px;text-align:center;">
                      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;line-height:1;">{{code}}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">验证码仅用于密码重置，请勿泄露给他人。如果您没有申请重置密码，请忽略此邮件并尽快修改密码。</p>
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
  text: '您好，{{username}}：我们收到了重置 {{siteName}} 密码的请求，请在 {{expireMinutes}} 分钟内使用验证码 {{code}} 完成重置。如非本人操作请忽略此邮件。',
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
    const isReset = new URL(request.url).searchParams.get('kind') === 'reset';
    const prefix = isReset ? 'email_reset' : 'email';
    const fallback = isReset ? defaultResetEmailTemplate : defaultEmailTemplate;
    const [subjectRow, htmlRow, textRow] = await Promise.all([
      db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_subject`).first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_html`).first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_text`).first(),
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
        subject: data.subject || fallback.subject,
        html: data.html || fallback.html,
        text: data.text || fallback.text,
        _debug: {
          kind: isReset ? 'reset' : 'register',
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
    // D1 绑定类异常只影响读取，返回默认模板即可保证前端可用；其它异常继续抛出以便排查
    if (isBindingError(err)) {
      console.error('读取邮件模板失败，返回默认模板:', err);
      const fallback = new URL(request.url).searchParams.get('kind') === 'reset' ? defaultResetEmailTemplate : defaultEmailTemplate;
      return jsonResponse(0, { ...fallback, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateEmailTemplateSettings(request, env, user) {
  const body = await request.json();
  const db = getConfigDb(env);
  const ts = now();
  const isReset = body.kind === 'reset';
  const prefix = isReset ? 'email_reset' : 'email';
  const fallback = isReset ? defaultResetEmailTemplate : defaultEmailTemplate;
  // 读取现有模板：只覆盖 body 中显式传入的字段，未传的保留已有值（没有则用默认模板）。
  // 避免 AI 只改 subject 时把已自定义的 html/text 冲成默认模板。
  const [subjectRow, htmlRow, textRow] = await Promise.all([
    db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_subject`).first(),
    db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_html`).first(),
    db.prepare('SELECT value FROM settings WHERE key = ?').bind(`${prefix}_text`).first(),
  ]);
  const existing = {
    subject: subjectRow?.value || fallback.subject,
    html: htmlRow?.value || fallback.html,
    text: textRow?.value || fallback.text,
  };
  const data = {
    subject: body.subject !== undefined ? String(body.subject) : existing.subject,
    html: body.html !== undefined ? String(body.html) : existing.html,
    text: body.text !== undefined ? String(body.text) : existing.text,
  };
  // 拆分为三个独立 key 存储，避免单条 JSON 解析或读取异常
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(`${prefix}_subject`, data.subject, ts).run();
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(`${prefix}_html`, data.html, ts).run();
  await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
    .bind(`${prefix}_text`, data.text, ts).run();
  return jsonResponse(0, data, '保存成功');
}

async function sendEmailByProvider(env, to, subject, text, html, critical = false) {
  const settings = (await getSetting(env, 'email')) || {};
  const provider = settings.provider || 'resend';

  if (!settings.from) {
    throw new Error('未配置发件人邮箱');
  }

  // 非关键邮件检查每日发送限额
  if (!critical) {
    const notifySettings = (await getSetting(env, 'comment_notify')) || {};
    const dailyLimit = notifySettings.dailyLimit || 100;
    const reserveForRegister = notifySettings.reserveForRegister || 10;
    const maxNotify = dailyLimit - reserveForRegister;
    console.log('[email-send] daily limit check:', { dailyLimit, reserveForRegister, maxNotify });
    if (maxNotify <= 0) {
      console.log('[email-send] maxNotify <= 0, skipping');
      throw new Error('每日发件限额已全部预留给注册验证，无法发送通知邮件');
    }
    const currentCount = await getEmailDailyCount(env);
    console.log('[email-send] currentCount:', currentCount, 'maxNotify:', maxNotify);
    if (currentCount >= maxNotify) {
      console.log('[email-send] daily limit reached, skipping');
      throw new Error(`每日发件通知已达上限（${maxNotify} 封），超出部分已被限制`);
    }
  }

  // 邮件发送整体加超时保护，避免 SMTP/Resend 网络挂起导致 Worker 一直不返回
  const sendPromise = (async () => {
    if (provider === 'smtp') {
      const ok = await sendEmailBySMTP(settings, to, subject, text, html);
      await incrementEmailDailyCount(env);
      return ok;
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
    console.log('[email-send] Resend response status:', res.status);
    if (!res.ok) {
      const err = await res.text();
      console.log('[email-send] Resend error body:', err);
      throw new Error(`Resend error: ${err}`);
    }
    await incrementEmailDailyCount(env);
    return true;
  })();

  return withTimeout(sendPromise, 25000, '邮件发送');
}

// ---------- SMTP 客户端（基于 Cloudflare TCP Sockets） ----------

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

// 读取 EHLO 返回的全部 250 多行响应，解析 AUTH 与 STARTTLS 能力
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

  // 端口决定传输层安全策略：465 强制隐式 TLS；587 优先 STARTTLS；其余按用户开关
  let secureTransport;
  if (port === 465) {
    secureTransport = 'on';
  } else if (port === 587) {
    secureTransport = 'starttls';
  } else {
    secureTransport = secure ? 'on' : 'off';
  }

  // EHLO 参数使用发件人域名；若无法取得则使用 cloudflare-workers，避免被反垃圾策略拒绝
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
    // 连接握手阶段使用较短超时，避免 SMTP 不可达时长期占用 Worker
    await smtpReadResponse(reader, 220, 15000);

    // 读取服务器能力列表（AUTH/STARTTLS）
    let caps = await smtpReadEhloCapabilities(reader, writer, ehloHost, 15000);

    // STARTTLS：确认服务器支持后再升级，升级后重新 EHLO 并重新读取能力
    if (secureTransport === 'starttls') {
      if (caps.STARTTLS === undefined) {
        throw new Error('SMTP 服务器未声明 STARTTLS 支持');
      }
      await smtpSend(writer, 'STARTTLS');
      await smtpReadResponse(reader, 220, 15000);

      // 升级 TLS 前必须释放旧 reader/writer 的锁，而不是关闭流；
      // close()/cancel() 会向底层连接发送 EOF，导致 startTls() 时握手挂起或失败。
      try { reader.releaseLock(); } catch {}
      try { writer.releaseLock(); } catch {}

      let secureSocket;
      try {
        secureSocket = socket.startTls();
      } catch (e) {
        throw new Error(`STARTTLS 升级失败：${e.message}`);
      }
      socket = secureSocket; // 后续清理需要关闭升级后的 socket
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

    // 点号转义：行首的点号需补一个点；末尾单独一行点号表示结束
    const escapedMessage = message
      .split('\r\n')
      .map((line) => (line.startsWith('.') ? '.' + line : line))
      .join('\r\n');
    await smtpSend(writer, escapedMessage + '\r\n.');
    await smtpReadResponse(reader, 250, 30000);

    await smtpSend(writer, 'QUIT');
  } catch (e) {
    // 包装下层错误，保留原始信息
    throw new Error(e.message || 'SMTP 发送失败');
  } finally {
    try { await writer.close(); } catch {}
    try { await reader.cancel(); } catch {}
    try { await socket.close(); } catch {}
  }

  return true;
}

// ---------- 人机验证（Human Verification） ----------

const MATH_CAPTCHA_TTL_MS = 5 * 60 * 1000; // 算术验证题有效期 5 分钟
const MATH_CAPTCHA_SALT = 'math-captcha-v1';

// HMAC-SHA256 无状态签名（题目不落库）
async function hmacSignBase64(secret, data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// HMAC-SHA256 十六进制小写签名（极验 GT4 的 sign_token 要求 hex 输出，不能用 base64）
async function hmacSignHex(secret, data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// 生成一道算术题：返回题目文本与签名 token（答案加密在 token 内，不落库）
async function issueMathCaptcha(request, env) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(env, `mc:ip:${ip}`, 10, 60))) {
    return jsonResponse(429, null, '获取题目过于频繁，请稍后再试', 429);
  }
  const a = 1 + Math.floor(Math.random() * 20);
  const b = 1 + Math.floor(Math.random() * 20);
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer;
  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;
  const payload = { answer, exp: Date.now() + MATH_CAPTCHA_TTL_MS };
  const data = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSignBase64(env.JWT_SECRET + MATH_CAPTCHA_SALT, data);
  return jsonResponse(0, { question: `${a} ${op} ${b}`, token: `${data}.${sig}` }, 'ok');
}

// 校验算术题答案（token 验签 + 过期 + 答案比对）
async function verifyMathCaptcha(env, body) {
  const token = String(body.mathToken || '').trim();
  const answer = body.mathAnswer;
  if (!token || answer === undefined || answer === null || answer === '') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false; // token 格式为 data.sig，共两段
  const [data, sig] = parts;
  let payload;
  try {
    const expectSig = await hmacSignBase64(env.JWT_SECRET + MATH_CAPTCHA_SALT, data);
    if (expectSig !== sig) return false;
    payload = JSON.parse(base64UrlDecode(data));
  } catch {
    return false;
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
  const num = Number(answer);
  if (!Number.isFinite(num)) return false;
  return Math.abs(num - payload.answer) < 1e-6;
}

// Cloudflare Turnstile 服务端校验
async function verifyTurnstile(secret, token, ip) {
  if (!secret || !token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip && ip !== 'unknown') form.append('remoteip', ip);
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const result = await resp.json();
    return !!result && result.success === true;
  } catch {
    return false;
  }
}

// 极验 GT4 服务端二次校验
async function verifyGeetest(captchaId, captchaKey, body) {
  const lotNumber = String(body.lotNumber || '').trim();
  const captchaOutput = String(body.captchaOutput || '').trim();
  const passToken = String(body.passToken || '').trim();
  const genTime = String(body.genTime || '').trim();
  if (!captchaId || !captchaKey || !lotNumber || !captchaOutput || !passToken || !genTime) {
    return false;
  }
  try {
    const signToken = await hmacSignHex(captchaKey, lotNumber);
    const form = new URLSearchParams();
    form.append('lot_number', lotNumber);
    form.append('captcha_output', captchaOutput);
    form.append('pass_token', passToken);
    form.append('gen_time', genTime);
    form.append('sign_token', signToken);
    const resp = await fetch(
      `https://gcaptcha4.geetest.com/validate?captcha_id=${encodeURIComponent(captchaId)}`,
      { method: 'POST', body: form }
    );
    const result = await resp.json();
    return !!result && result.result === 'success';
  } catch {
    return false;
  }
}

// hCaptcha 服务端二次校验
async function verifyHCaptcha(secret, token, ip) {
  if (!secret || !token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip && ip !== 'unknown') form.append('remoteip', ip);
    const resp = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      body: form,
    });
    const result = await resp.json();
    return !!result && result.success === true;
  } catch {
    return false;
  }
}

// 统一入口：按后台配置执行人机验证，返回 true 表示通过
async function verifyHuman(request, env, body) {
  const authSettings = (await getSetting(env, 'auth')) || {};
  const mode = authSettings.verificationMode || 'none';
  if (mode === 'none') return true;
  if (mode === 'math') return verifyMathCaptcha(env, body);
  if (mode === 'turnstile') {
    return verifyTurnstile(authSettings.turnstileSecret, body.turnstileToken, getClientIp(request));
  }
  if (mode === 'geetest') {
    return verifyGeetest(authSettings.geetestCaptchaId, authSettings.geetestCaptchaKey, body);
  }
  if (mode === 'hcaptcha') {
    return verifyHCaptcha(authSettings.hcaptchaSecret, body.hcaptchaToken, getClientIp(request));
  }
  return true;
}

// 前端获取当前验证模式、各场景开关与公开配置（sitekey / captchaId 本就公开，可安全下发）
async function getCaptchaConfig(request, env) {
  const authSettings = (await getSetting(env, 'auth')) || {};
  const mode = authSettings.verificationMode || 'none';
  return jsonResponse(
    0,
    {
      mode,
      loginRequired: authSettings.loginVerification === true,
      registerRequired: authSettings.registerVerification === true,
      forgotRequired: authSettings.forgotPasswordVerification === true,
      turnstileSiteKey: mode === 'turnstile' ? authSettings.turnstileSiteKey || '' : '',
      geetestCaptchaId: mode === 'geetest' ? authSettings.geetestCaptchaId || '' : '',
      hcaptchaSiteKey: mode === 'hcaptcha' ? authSettings.hcaptchaSiteKey || '' : '',
    },
    'ok'
  );
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

  // 检查邮箱验证开关
  const authSettings = (await getSetting(env, 'auth')) || {};
  if (authSettings.emailVerification !== true) {
    return jsonResponse(403, null, '未开启注册邮箱验证功能');
  }

  // 注册发码场景验证：开关开启时需通过人机验证
  if (authSettings.registerVerification === true) {
    if (!(await verifyHuman(request, env, body))) {
      return jsonResponse(403, null, '人机验证未通过，请重试');
    }
  }

  // 速率限制：按 IP、邮箱及每日上限限流，防止验证码轰炸
  const vcIp = getClientIp(request);
  if (!(await checkRateLimit(env, `vc:ip:${vcIp}`, 5, 600))) {
    return jsonResponse(429, null, '发送过于频繁，请稍后再试', 429);
  }
  const vcEmail = email.toLowerCase();
  if (!(await checkRateLimit(env, `vc:email:${vcEmail}`, 3, 600))) {
    return jsonResponse(429, null, '该邮箱发送过于频繁，请 10 分钟后再试', 429);
  }
  if (!(await checkRateLimit(env, `vc:day:${vcEmail}`, 10, 86400))) {
    return jsonResponse(429, null, '该邮箱今日发送次数已达上限', 429);
  }

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

  // 全局每日邮件总量限制
  const currentCount = await getEmailDailyCount(env);
  if (currentCount >= GLOBAL_DAILY_EMAIL_LIMIT) {
    return jsonResponse(429, { sent: false }, '今日邮件发送总量已达上限，请明日再试');
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
    await sendEmailByProvider(env, email, subject, text, html, true);
  } catch (e) {
    console.error(e);
    if (emailConfigured) {
      return jsonResponse(500, { sent: false }, `邮件发送失败：${e.message || '未知错误'}`);
    }
    // 未配置邮件服务时，仅记录验证码，不阻止注册流程
  }

  return jsonResponse(0, { sent: true }, '验证码已发送');
}

async function sendForgotCode(request, env) {
  const body = await request.json();
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();
  const authSettings = (await getSetting(env, 'auth')) || {};

  if (authSettings.enableForgotPassword !== true) {
    return jsonResponse(403, null, '未开启找回密码功能');
  }
  if (!username || /[\u4e00-\u9fa5]/.test(username)) return jsonResponse(400, null, '用户名不合法');
  if (!email) return jsonResponse(400, null, '邮箱必填');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return jsonResponse(400, null, '邮箱格式不正确');

  // 忘记密码发码场景验证：开关开启时需通过人机验证
  if (authSettings.forgotPasswordVerification === true) {
    if (!(await verifyHuman(request, env, body))) {
      return jsonResponse(403, null, '人机验证未通过，请重试');
    }
  }

  // 速率限制：按 IP、邮箱及每日上限限流，找回密码与注册发送共用一套防线
  const fpIp = getClientIp(request);
  if (!(await checkRateLimit(env, `fp:ip:${fpIp}`, 5, 600))) {
    return jsonResponse(429, null, '操作过于频繁，请稍后再试', 429);
  }
  const fpEmail = email.toLowerCase();
  if (!(await checkRateLimit(env, `fp:email:${fpEmail}`, 3, 600))) {
    return jsonResponse(429, null, '该邮箱操作过于频繁，请 10 分钟后再试', 429);
  }
  if (!(await checkRateLimit(env, `fp:day:${fpEmail}`, 10, 86400))) {
    return jsonResponse(429, null, '该邮箱今日操作次数已达上限', 429);
  }

  // 校验用户名与邮箱匹配且已注册；不匹配时仍返回统一提示，防止账号枚举
  const user = await env.DB_USERS.prepare(
    'SELECT username, email FROM users WHERE username = ? OR email = ?'
  )
    .bind(username, fpEmail)
    .first();
  const matched =
    !!user &&
    user.username === username &&
    String(user.email || '').toLowerCase() === fpEmail;
  if (!matched) {
    return jsonResponse(0, { sent: false, _debug: { matched: false, username, email } }, '验证码已发送');
  }

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB_USERS.prepare(
    'INSERT INTO verify_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, created_at = excluded.created_at'
  )
    .bind(fpEmail, code, expiresAt, now())
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
    return jsonResponse(503, { sent: false }, '邮件服务未配置，无法发送重置邮件');
  }

  // 全局每日邮件总量限制
  const globalCount = await getEmailDailyCount(env);
  if (globalCount >= GLOBAL_DAILY_EMAIL_LIMIT) {
    return jsonResponse(429, { sent: false }, '今日邮件发送总量已达上限，请明日再试');
  }

  let sendStatus = 'not_attempted';
  let sendError = '';
  const debugBase = { matched: true, provider, emailConfigured, email };

  try {
    const db = getConfigDb(env);
    const [subjectRow, htmlRow, textRow] = await Promise.all([
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_reset_subject').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_reset_html').first(),
      db.prepare('SELECT value FROM settings WHERE key = ?').bind('email_reset_text').first(),
    ]);
    const template = {
      subject: subjectRow?.value || defaultResetEmailTemplate.subject,
      html: htmlRow?.value || defaultResetEmailTemplate.html,
      text: textRow?.value || defaultResetEmailTemplate.text,
    };
    const site = (await getSetting(env, 'site')) || {};
    const { subject, html, text } = applyEmailTemplate(template, {
      username,
      email,
      code,
      expireMinutes: 10,
      siteName: site.siteName || '站点',
      siteTitle: site.siteName || '站点',
    });
    try {
      await sendEmailByProvider(env, email, subject, text, html, true);
      sendStatus = 'sent';
    } catch (sendErr) {
      sendStatus = 'failed';
      sendError = sendErr.message || String(sendErr);
      console.error(sendErr);
      return jsonResponse(500, { sent: false, _debug: { ...debugBase, sendStatus, sendError } }, `邮件发送失败：${sendError}`);
    }
  } catch (e) {
    console.error(e);
    if (emailConfigured) {
      return jsonResponse(500, { sent: false, _debug: { ...debugBase, sendStatus, sendError, stage: e.message || 'template' } }, `邮件发送失败：${e.message || '未知错误'}`);
    }
  }

  return jsonResponse(0, { sent: true, _debug: { ...debugBase, sendStatus, sendError } }, '验证码已发送');
}

async function resetPassword(request, env) {
  const body = await request.json();
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim();
  const code = String(body.code || '').trim().toUpperCase();
  const password = String(body.password || '');
  const authSettings = (await getSetting(env, 'auth')) || {};

  if (authSettings.enableForgotPassword !== true) {
    return jsonResponse(403, null, '未开启找回密码功能');
  }
  if (!username || !email) return jsonResponse(400, null, '用户名和邮箱必填');
  if (password.length < 6) return jsonResponse(400, null, '密码至少 6 位');
  if (!code) return jsonResponse(400, null, '请输入邮箱验证码');

  const record = await env.DB_USERS.prepare(
    'SELECT code, expires_at FROM verify_codes WHERE email = ?'
  )
    .bind(email.toLowerCase())
    .first();
  if (!record) return jsonResponse(403, null, '请先获取重置验证码');
  if (record.code !== code) {
    if (!(await checkRateLimit(env, `vc-check:${email.toLowerCase()}`, 5, 600))) {
      return jsonResponse(429, null, '验证码错误次数过多，请重新获取', 429);
    }
    return jsonResponse(403, null, '验证码错误');
  }
  if (record.expires_at < new Date().toISOString()) return jsonResponse(403, null, '验证码已过期');

  const user = await env.DB_USERS.prepare(
    'SELECT id FROM users WHERE username = ? AND email = ?'
  )
    .bind(username, email.toLowerCase())
    .first();
  if (!user) return jsonResponse(403, null, '用户不存在');

  const { salt, hash } = await hashPassword(password);
  await env.DB_USERS.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?'
  )
    .bind(hash, salt, now(), user.id)
    .run();
  await env.DB_USERS.prepare('DELETE FROM verify_codes WHERE email = ?').bind(email.toLowerCase()).run();
  return jsonResponse(0, null, '密码已重置，请使用新密码登录');
}

async function changePassword(request, env, user) {
  const body = await request.json();
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (!currentPassword) return jsonResponse(400, null, '请输入当前密码');
  if (newPassword.length < 6) return jsonResponse(400, null, '新密码至少 6 位');
  if (newPassword === currentPassword) return jsonResponse(400, null, '新密码不能与当前密码相同');

  // 登录后修改密码始终可用（不受找回密码开关控制）；按账号限流防止爆破
  if (!(await checkRateLimit(env, `cp:${user.id}`, 5, 600))) {
    return jsonResponse(429, null, '操作过于频繁，请稍后再试', 429);
  }

  const row = await env.DB_USERS.prepare(
    'SELECT id, password_hash, password_salt, status FROM users WHERE id = ?'
  )
    .bind(user.id)
    .first();
  if (!row) return jsonResponse(404, null, '用户不存在');
  if (row.status === 'banned') return jsonResponse(403, null, '账号已被禁用');

  const valid = await verifyPassword(currentPassword, row.password_salt, row.password_hash);
  if (!valid) return jsonResponse(403, null, '当前密码不正确');

  const { salt, hash } = await hashPassword(newPassword);
  await env.DB_USERS.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?'
  )
    .bind(hash, salt, now(), user.id)
    .run();
  return jsonResponse(0, null, '密码已修改');
}

// ---------- 互动/评论/点赞 ----------

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
    `SELECT id, post_id, user_id, content, parent_id, status, created_at, updated_at
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
  const parentUserIds = [...new Set(list.map((c) => c.parent_id).filter(Boolean))];
  // 获取父评论的用户 ID
  const parentCommentMap = {};
  if (parentUserIds.length > 0) {
    const parentComments = await env.DB_POSTS.prepare(
      `SELECT id, user_id FROM comments WHERE id IN (${parentUserIds.join(',')})`
    ).all();
    (parentComments.results || []).forEach((pc) => {
      parentCommentMap[pc.id] = pc.user_id;
    });
  }
  const allUserIds = [...new Set([...userIds, ...Object.values(parentCommentMap).filter(Boolean)])];
  const userMap = await getUserMap(env, allUserIds);

  const results = list.map((c) => ({
    id: c.id,
    postId: c.post_id,
    userId: c.user_id,
    content: c.content,
    parentId: c.parent_id || null,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    username: userMap[c.user_id]?.username || '未知用户',
    avatar: userMap[c.user_id]?.avatar_base64 || null,
    replyToUsername: c.parent_id ? (userMap[parentCommentMap[c.parent_id]]?.username || null) : null,
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

  const parentId = parseInt(body.parentId, 10) || null;
  if (parentId) {
    const parentExists = await env.DB_POSTS.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
      .bind(parentId, postId)
      .first();
    if (!parentExists) return jsonResponse(400, null, '回复的评论不存在');
  }

  const status = settings.commentAudit === false ? 'approved' : 'pending';
  const time = now();

  const result = await env.DB_POSTS.prepare(
    'INSERT INTO comments (post_id, user_id, content, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(postId, user.id, content, parentId, status, time, time)
    .run();

  const commentId = result.meta ? result.meta.last_row_id : null;

  // 同步发送邮件通知，并把错误/日志返回给前端（便于排查）
  // 无论评论状态是 pending（审核中）还是 approved，都通知站长去处理
  const notifyErrors = [];
  if (commentId) {
    const errs = await sendCommentNotifications(request, env, postId, slug, user, content, parentId, commentId, status);
    notifyErrors.push(...(Array.isArray(errs) ? errs : []));
  }

  return jsonResponse(0, { id: commentId, status, notifyErrors }, '评论成功');
}

// ---------- 评论邮件通知发送 ----------

function buildEmailHtml(siteName, title, bodyLines, postTitle, postUrl, time) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
        <tr><td style="padding:32px 32px 0">
          <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;font-weight:700">${title}</h2>
          <p style="margin:0 0 24px;font-size:13px;color:#999">${time}</p>
        </td></tr>
        <tr><td style="padding:0 32px">
          ${bodyLines.map((line) => `<p style="margin:0 0 12px;font-size:15px;color:#333;line-height:1.7">${line}</p>`).join('')}
        </td></tr>
        <tr><td style="padding:24px 32px 32px">
          ${postUrl ? `<a href="${postUrl}" style="display:inline-block;padding:10px 28px;background:#1677ff;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">查看文章</a>` : ''}
          <p style="margin:16px 0 0;font-size:12px;color:#bbb">来自 ${siteName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendCommentNotifications(request, env, postId, slug, commenter, content, parentId, commentId, commentStatus = 'pending') {
  const notifySettings = (await getSetting(env, 'comment_notify')) || {};
  const errors = [];
  console.log('[comment-notify] notifySettings:', JSON.stringify(notifySettings));
  // 未开启或未配置邮箱属于“正常跳过”，不是失败，不返回错误（避免评论成功却提示报错）
  if (!notifySettings.enabled) {
    console.log('[comment-notify] disabled, skip');
    return [];
  }
  if (!notifySettings.notifyEmail) {
    console.log('[comment-notify] notifyEmail empty, skip');
    return [];
  }
  console.log('[comment-notify] enabled, sending to:', notifySettings.notifyEmail);

  const site = (await getSetting(env, 'site')) || {};
  const siteName = site.siteName || 'XinBlog';
  const post = await env.DB_POSTS.prepare('SELECT title FROM posts WHERE id = ?').bind(postId).first();
  const postTitle = post ? post.title : '未知文章';
  let reqOrigin = '';
  try {
    reqOrigin = request ? new URL(request.url).origin : '';
  } catch (e) {
    reqOrigin = '';
  }
  const baseUrl = site.siteUrl || reqOrigin || 'https://xingze.work';
  const postUrl = `${baseUrl}/post/${slug}`;
  const adminUrl = `${baseUrl}/admin`;
  const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const needAudit = commentStatus === 'pending' ? '（需审核后公开显示）' : '';

  if (parentId) {
    // 回复评论
    const parentComment = await env.DB_POSTS.prepare('SELECT user_id FROM comments WHERE id = ?').bind(parentId).first();
    if (!parentComment) return;

    const parentUser = await env.DB_USERS.prepare('SELECT id, username, email, role FROM users WHERE id = ?')
      .bind(parentComment.user_id)
      .first();
    if (!parentUser) return;

    const isAdmin = commenter.role === 'super_admin';
    const isParentAdmin = parentUser.role === 'super_admin';

    // 通知被回复的用户
    let shouldNotifyUser = false;
    if (isAdmin) {
      // 站长回复用户
      shouldNotifyUser = notifySettings.notifyAdminReply;
    } else if (!isParentAdmin) {
      // 用户回复用户
      shouldNotifyUser = notifySettings.notifyUserReply;
    }

    if (shouldNotifyUser && parentUser.email) {
      const subject = `${commenter.username} 回复了您在「${postTitle}」中的评论${needAudit ? '（待审核）' : ''}`;
      const text = `您收到了一条来自 ${commenter.username} 的回复：\n\n${content}\n\n文章：${postTitle}\n链接：${postUrl}`;
      const html = buildEmailHtml(siteName, `您收到了一条回复`, [
        `${commenter.username} 回复您在文章「${postTitle}」中的评论：`,
        content,
        needAudit && `提示：该回复需审核后才能公开显示。`,
      ].filter(Boolean), postTitle, postUrl, time);
      try {
        await sendEmailByProvider(env, parentUser.email, subject, text, html);
        errors.push('通知被回复用户成功(邮箱发送成功)');
      } catch (e) {
        console.error('发送回复通知给用户失败:', e.message);
        errors.push(`回复用户邮件失败: ${e.message}`);
      }
    }

    // 通知站长有新回复（站长不是被回复者时才通知）
    if (notifySettings.notifyAdminOnNew && !isParentAdmin && notifySettings.notifyEmail) {
      const subject = `[${siteName}] ${commenter.username} 回复了评论`;
      const text = `用户 ${commenter.username} 回复了 ${parentUser.username} 在文章「${postTitle}」中的评论：\n\n${content}\n\n链接：${postUrl}`;
      const html = buildEmailHtml(siteName, `${commenter.username} 回复了评论`, [
        `用户 ${commenter.username} 回复了 ${parentUser.username} 在文章「${postTitle}」中的评论：`,
        content,
        needAudit && `提示：该回复需审核后才能公开显示。`,
      ].filter(Boolean), postTitle, postUrl, time);
      try {
        await sendEmailByProvider(env, notifySettings.notifyEmail, subject, text, html);
        errors.push('通知站长(新回复)邮件发送成功');
      } catch (e) {
        console.error('发送新回复通知给站长失败:', e.message);
        errors.push(`站长(新回复)邮件失败: ${e.message}`);
      }
    }
  } else {
    // 新评论（非回复）- 通知站长
    if (notifySettings.notifyAdminOnNew && notifySettings.notifyEmail) {
      const subject = `[${siteName}] ${commenter.username} 发表了新评论`;
      const text = `用户 ${commenter.username} 在文章「${postTitle}」中发表了评论：\n\n${content}\n\n链接：${postUrl}`;
      const html = buildEmailHtml(siteName, `${commenter.username} 发表了新评论`, [
        `用户 ${commenter.username} 在文章「${postTitle}」中发表了评论：`,
        content,
        needAudit && `提示：该评论需审核后才能公开显示。`,
      ].filter(Boolean), postTitle, postUrl, time);
      try {
        await sendEmailByProvider(env, notifySettings.notifyEmail, subject, text, html);
        errors.push('通知站长(新评论)邮件发送成功');
      } catch (e) {
        console.error('发送新评论通知给站长失败:', e.message);
        errors.push(`站长(新评论)邮件失败: ${e.message}`);
      }
    }
  }

  if (!errors.length) errors.push('无通知邮件需发送（或无 email 收件人）');
  return errors;
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

  await deleteCommentTree(env, commentId);
  return jsonResponse(0, null, '删除成功');
}

// ---------- 评论树删除工具 ----------
// 删除评论及其所有子（楼中楼）评论。先删最深层子评论，再逐层向上删父，避免外键约束失败。

async function deleteCommentTree(env, rootId) {
  const ordered = [];
  await collectCommentTree(env, rootId, ordered);
  // ordered 为「最深层子 → ...」，最后补上根评论，保证根最后删，避免外键约束失败
  ordered.push(rootId);
  for (const id of ordered) {
    await env.DB_POSTS.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  }
}

// 递归收集，把子评论先塞进数组（深度优先、子在前）
async function collectCommentTree(env, parentId, ordered) {
  const rows = await env.DB_POSTS.prepare('SELECT id FROM comments WHERE parent_id = ?')
    .bind(parentId)
    .all();
  for (const row of rows.results || []) {
    await collectCommentTree(env, row.id, ordered);
    ordered.push(row.id);
  }
}

// 删除某文章下全部评论：先解除文章内评论的楼中楼外键引用，再整体删除
async function deleteCommentsByPost(env, postId) {
  await env.DB_POSTS.prepare('UPDATE comments SET parent_id = NULL WHERE post_id = ?').bind(postId).run();
  await env.DB_POSTS.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
}

// 删除某用户全部评论：先解除指向该用户评论的子评论引用，再删除
async function deleteCommentsByUser(env, userId) {
  await env.DB_POSTS.prepare(
    'UPDATE comments SET parent_id = NULL WHERE parent_id IN (SELECT id FROM comments WHERE user_id = ?)'
  ).bind(userId).run();
  await env.DB_POSTS.prepare('DELETE FROM comments WHERE user_id = ?').bind(userId).run();
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
  const kw = (url.searchParams.get('keyword') || '').trim();
  const useStatus = status && validStatuses.includes(status);
  const like = kw ? `%${kw}%` : '';

  const where = [];
  const params = [];
  if (useStatus) {
    where.push('status = ?');
    params.push(status);
  }
  if (kw) {
    where.push('content LIKE ?');
    params.push(like);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

  comments = await env.DB_POSTS.prepare(
    `SELECT id, post_id, user_id, content, status, created_at, updated_at
     FROM comments${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();
  total = (
    await env.DB_POSTS.prepare(`SELECT COUNT(*) as c FROM comments${whereSql}`).bind(...params).first()
  ).c;

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
  await deleteCommentTree(env, id);
  return jsonResponse(0, null, '删除成功');
}

// ---------- 留言墙 ----------

const defaultMessageWallSettings = {
  enabled: false,
  allowAnonymous: true,
  auditEnabled: false,
  defaultStyle: 'danmaku',
  danmakuRepeatSec: 45,
  danmakuTrackCount: 12,
  danmakuSpeedMin: 8,
  danmakuSpeedMax: 11,
  danmakuIntervalMin: 6,
  danmakuIntervalMax: 10,
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
  const clampNum = (v, min, max, def) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const intervalMin = clampNum(body.danmakuIntervalMin, 1, 60, defaultMessageWallSettings.danmakuIntervalMin);
  const intervalMax = clampNum(body.danmakuIntervalMax, intervalMin, 120, defaultMessageWallSettings.danmakuIntervalMax);
  const speedMin = clampNum(body.danmakuSpeedMin, 1, 60, defaultMessageWallSettings.danmakuSpeedMin);
  const speedMax = clampNum(body.danmakuSpeedMax, speedMin, 120, defaultMessageWallSettings.danmakuSpeedMax);
  const data = {
    enabled: body.enabled !== false,
    allowAnonymous: body.allowAnonymous !== false,
    auditEnabled: body.auditEnabled === true,
    defaultStyle: body.defaultStyle || 'danmaku',
    danmakuRepeatSec: clampNum(body.danmakuRepeatSec, 5, 600, defaultMessageWallSettings.danmakuRepeatSec),
    danmakuTrackCount: clampNum(body.danmakuTrackCount, 2, 30, defaultMessageWallSettings.danmakuTrackCount),
    danmakuSpeedMin: speedMin,
    danmakuSpeedMax: speedMax,
    danmakuIntervalMin: intervalMin,
    danmakuIntervalMax: intervalMax,
  };
  await setSetting(env, 'message_wall', data);
  return jsonResponse(0, data, '保存成功');
}

// ---------- 聊天室设置 ----------
const PUBLIC_CHAT_ROOM_KEY = 'public';
const PUBLIC_CHAT_ROOM_NAME = '公共聊天房';
const ALL_USERS_CHAT_ROOM_KEY = 'members';
const ALL_USERS_CHAT_ROOM_NAME = '全体聊天房';

const defaultChatSettings = {
  enabled: false, // 功能总开关：控制主页侧边栏是否显示聊天室入口
  publicRoomEnabled: true, // 公共聊天房开关：控制无需鉴权可进的公共房是否开放
  allUsersRoomEnabled: true, // 全体聊天房开关：控制仅登录用户可进的全员房是否开放
};

async function getChatSettings(request, env, user) {
  try {
    const data = (await getSetting(env, 'chat')) || {};
    return jsonResponseWithCache(
      0,
      { ...defaultChatSettings, ...data },
      'ok',
      200,
      'public, max-age=60'
    );
  } catch (err) {
    if (isBindingError(err)) {
      return jsonResponse(0, { ...defaultChatSettings, _debug: getBindingDebugInfo(env, err) }, 'ok');
    }
    throw err;
  }
}

async function updateChatSettings(request, env, user) {
  const body = await request.json();
  const data = {
    enabled: body.enabled === true,
    publicRoomEnabled: body.publicRoomEnabled !== false,
    allUsersRoomEnabled: body.allUsersRoomEnabled !== false,
  };
  await setSetting(env, 'chat', data);
  return jsonResponse(0, data, '保存成功');
}

// ---------- 自定义聊天房间（后台创建、按成员授权、可设封面/人数上限） ----------

// 惰性建表缓存：同一 DB 实例只建一次表，避免每次请求重复 DDL
const ensuredRoomTables = new WeakSet();

async function ensureChatRoomTables(env) {
  const db = getConfigDb(env);
  if (ensuredRoomTables.has(db)) return db;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS chat_rooms (
        room_key   TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cover      TEXT NOT NULL DEFAULT '',
        max_users  INTEGER NOT NULL DEFAULT 0,
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS chat_room_members (
        room_key  TEXT NOT NULL,
        user_id   INTEGER NOT NULL,
        username  TEXT NOT NULL DEFAULT '',
        added_at  TEXT NOT NULL,
        PRIMARY KEY (room_key, user_id)
      )`
    ),
  ]);
  ensuredRoomTables.add(db);
  return db;
}

// 生成不与他人冲突的自定义房间 key（与内置 public/members 区分）
function randomRoomKey() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return 'c_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// 当前登录用户可见（自己是成员且已启用）的自定义房间；未登录返回空
async function listMyChatRooms(request, env, user) {
  if (!user) return jsonResponse(0, { list: [] }, 'ok');
  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const rows = await db.prepare(
    `SELECT r.room_key, r.name, r.description, r.cover, r.max_users, r.enabled,
            (SELECT COUNT(*) FROM chat_room_members m WHERE m.room_key = r.room_key) AS member_count
     FROM chat_rooms r
     JOIN chat_room_members cm ON cm.room_key = r.room_key
     WHERE r.enabled = 1 AND cm.user_id = ?
     ORDER BY r.created_at DESC`
  ).bind(user.id).all();
  return jsonResponse(0, { list: rows.results || [] }, 'ok');
}

// 管理端：分页列出自定义房间
async function listAdminChatRooms(request, env, user) {
  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const rows = await db.prepare(
    `SELECT r.room_key, r.name, r.description, r.cover, r.max_users, r.enabled, r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM chat_room_members m WHERE m.room_key = r.room_key) AS member_count
     FROM chat_rooms r
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  const countRow = await db.prepare('SELECT COUNT(*) as c FROM chat_rooms').first();
  return jsonResponse(0, { list: rows.results || [], total: countRow.c, page, limit });
}

// 成员选择器：按用户名模糊搜索已启用用户，分页
async function searchRoomUsers(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const keyword = (url.searchParams.get('keyword') || '').trim();

  let list, countRow;
  if (keyword) {
    const like = `%${keyword}%`;
    list = await env.DB_USERS.prepare(
      'SELECT id, username FROM users WHERE status = 1 AND username LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?'
    ).bind(like, limit, offset).all();
    countRow = await env.DB_USERS.prepare(
      'SELECT COUNT(*) as c FROM users WHERE status = 1 AND username LIKE ?'
    ).bind(like).first();
  } else {
    list = await env.DB_USERS.prepare(
      'SELECT id, username FROM users WHERE status = 1 ORDER BY id ASC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
    countRow = await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users WHERE status = 1').first();
  }
  return jsonResponse(0, { list: list.results || [], total: countRow.c, page, limit });
}

// 管理端：读取某房间成员（编辑回显）。房间 key 走 query ?key=，兼容原路径形式
async function getAdminChatRoomMembers(request, env, user) {
  const url = new URL(request.url);
  const parts = request.url.split('/');
  const key = url.searchParams.get('key')
    ? decodeURIComponent(url.searchParams.get('key'))
    : decodeURIComponent(parts[parts.length - 2]);
  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const rows = await db.prepare(
    'SELECT user_id AS id, username FROM chat_room_members WHERE room_key = ? ORDER BY added_at ASC'
  ).bind(key).all();
  return jsonResponse(0, { list: rows.results || [] }, 'ok');
}

// 连接用：按房间 key 读取启用中的自定义房间，并校验指定用户是否为成员；通过则返回房间，否则返回 null
async function getRoomForConnect(roomKey, userId, env) {
  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const room = await db.prepare('SELECT room_key, name, max_users FROM chat_rooms WHERE room_key = ? AND enabled = 1')
    .bind(roomKey).first();
  if (!room) return null;
  const member = await db.prepare('SELECT 1 AS ok FROM chat_room_members WHERE room_key = ? AND user_id = ?')
    .bind(roomKey, userId).first();
  if (!member) return null;
  return { room_key: room.room_key, name: room.name, max_users: room.max_users || 0 };
}

// 管理端：聊天 DO 概览（各房间的消息数/图片数/图片字节数）。
// 枚举固定房（公共房 + 全体房）+ 配置库中的自定义房，逐个调用聊天 DO /stats。
async function adminChatDoOverview(request, env, user) {
  if (!env.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
  const keys = [PUBLIC_CHAT_ROOM_KEY, ALL_USERS_CHAT_ROOM_KEY];
  try {
    await ensureChatRoomTables(env);
    const db = getConfigDb(env);
    const rows = await db.prepare('SELECT room_key, name FROM chat_rooms WHERE enabled = 1').all();
    (rows.results || []).forEach((r) => keys.push(String(r.room_key)));
  } catch (e) { /* 配置库异常时仍返回固定房 */ }
  const rooms = [];
  for (const key of keys) {
    try {
      const upstream = await env.CHAT.fetch(buildChatSubUrl(key, '/stats'));
      const j = await upstream.json();
      rooms.push({ roomKey: key, ...j });
    } catch (e) {
      rooms.push({ roomKey: key, error: true });
    }
  }
  return jsonResponse(0, { rooms }, 'ok');
}

// 管理端：列出某房间 DO 里已存的聊天图片元信息
async function adminListChatMedia(request, env, user) {
  const parts = request.url.split('/');
  const roomKey = decodeURIComponent(parts[parts.length - 1]);
  if (!env.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
  const upstream = await env.CHAT.fetch(buildChatSubUrl(roomKey, '/media'));
  const j = await upstream.json().catch(() => ({}));
  return jsonResponse(0, { items: j.items || [] }, 'ok');
}

// 管理端：删除某房间 DO 里的单张聊天图片
async function adminDeleteChatMedia(request, env, user) {
  const parts = request.url.split('/');
  const id = decodeURIComponent(parts[parts.length - 1]);
  const roomKey = decodeURIComponent(parts[parts.length - 2]);
  if (!env.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
  const upstream = await env.CHAT.fetch(buildChatSubUrl(roomKey, '/media/' + id), { method: 'DELETE' });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
}

// 创建自定义房间：建房间 + 写入成员（自动把创建者加入，保证管理员能进入）
async function createChatRoom(request, env, user) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  if (!name) return jsonResponse(400, null, '房间名称不能为空');
  if (name.length > 24) return jsonResponse(400, null, '房间名称过长（最多 24 字）');
  const description = String(body.description || '').trim().slice(0, 200);
  const cover = String(body.cover || '').trim().slice(0, 300);
  const maxUsers = Math.max(0, Math.min(500, Number(body.max_users) || 0));
  const memberIds = Array.isArray(body.members)
    ? [...new Set((body.members || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const ids = memberIds.includes(user.id) ? memberIds : [user.id, ...memberIds];
  const names = await env.DB_USERS.prepare(
    `SELECT id, username FROM users WHERE id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  const nameMap = new Map((names.results || []).map((r) => [r.id, r.username]));

  const roomKey = randomRoomKey();
  const nowTs = now();
  const stmts = [
    db.prepare(
      'INSERT INTO chat_rooms (room_key, name, description, cover, max_users, enabled, created_by, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?,?)'
    ).bind(roomKey, name, description, cover, maxUsers, user.id, nowTs, nowTs),
  ];
  ids.forEach((uid) =>
    stmts.push(
      db.prepare(
        'INSERT OR IGNORE INTO chat_room_members (room_key, user_id, username, added_at) VALUES (?,?,?,?)'
      ).bind(roomKey, uid, nameMap.get(uid) || '', nowTs)
    )
  );
  await db.batch(stmts);
  return jsonResponse(0, { room_key: roomKey }, '创建成功');
}

// 编辑房间：更新字段，可选整体替换成员
async function updateChatRoom(request, env, user) {
  const key = decodeURIComponent(request.url.split('/').pop());
  const body = await request.json();

  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  const exist = await db.prepare('SELECT room_key FROM chat_rooms WHERE room_key = ?').bind(key).first();
  if (!exist) return jsonResponse(404, null, '房间不存在', 404);

  const sets = ['updated_at = ?'];
  const params = [now()];
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonResponse(400, null, '房间名称不能为空');
    if (name.length > 24) return jsonResponse(400, null, '房间名称过长（最多 24 字）');
    sets.push('name = ?');
    params.push(name);
  }
  if (body.description !== undefined) {
    sets.push('description = ?');
    params.push(String(body.description || '').slice(0, 200));
  }
  if (body.cover !== undefined) {
    sets.push('cover = ?');
    params.push(String(body.cover || '').slice(0, 300));
  }
  if (body.max_users !== undefined) {
    sets.push('max_users = ?');
    params.push(Math.max(0, Math.min(500, Number(body.max_users) || 0)));
  }
  if (body.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(body.enabled ? 1 : 0);
  }
  const stmts = [db.prepare(`UPDATE chat_rooms SET ${sets.join(', ')} WHERE room_key = ?`).bind(...params, key)];

  if (Array.isArray(body.members)) {
    const memberIds = [...new Set((body.members || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const ids = memberIds.includes(user.id) ? memberIds : [user.id, ...memberIds];
    const names = await env.DB_USERS.prepare(
      `SELECT id, username FROM users WHERE id IN (${ids.map(() => '?').join(',')})`
    ).bind(...ids).all();
    const nameMap = new Map((names.results || []).map((r) => [r.id, r.username]));
    const nowTs = now();
    stmts.push(db.prepare('DELETE FROM chat_room_members WHERE room_key = ?').bind(key));
    ids.forEach((uid) =>
      stmts.push(
        db.prepare('INSERT INTO chat_room_members (room_key, user_id, username, added_at) VALUES (?,?,?,?)').bind(
          key,
          uid,
          nameMap.get(uid) || '',
          nowTs
        )
      )
    );
  }
  await db.batch(stmts);
  return jsonResponse(0, null, '保存成功');
}

// 删除自定义房间（含其成员关系）
async function deleteChatRoom(request, env, user) {
  const key = decodeURIComponent(request.url.split('/').pop());
  await ensureChatRoomTables(env);
  const db = getConfigDb(env);
  await db.batch([
    db.prepare('DELETE FROM chat_rooms WHERE room_key = ?').bind(key),
    db.prepare('DELETE FROM chat_room_members WHERE room_key = ?').bind(key),
  ]);
  return jsonResponse(0, null, '删除成功');
}

// 公开聊天房元数据（当前仅一个公共房，多房间管理后续版本扩展）
async function getChatPublicRoom(env) {
  const settings = (await getSetting(env, 'chat')) || {};
  return {
    key: PUBLIC_CHAT_ROOM_KEY,
    name: PUBLIC_CHAT_ROOM_NAME,
    enabled: settings.publicRoomEnabled !== false,
  };
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
    // 表不存在或数据库异常时按空数据处理，避免报错
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
    // 表不存在或数据库异常时按空数据处理，避免报错
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

// ---------- 用户管理 ----------

async function listAdminUsers(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
  const offset = (page - 1) * limit;
  const keyword = (url.searchParams.get('keyword') || '').trim();

  let list, countRow;
  if (keyword) {
    const like = `%${keyword}%`;
    list = await env.DB_USERS.prepare(
      'SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
      .bind(like, like, limit, offset)
      .all();
    countRow = await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users WHERE username LIKE ? OR email LIKE ?')
      .bind(like, like)
      .first();
  } else {
    list = await env.DB_USERS.prepare(
      'SELECT id, username, email, role, status, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
      .bind(limit, offset)
      .all();
    countRow = await env.DB_USERS.prepare('SELECT COUNT(*) as c FROM users').first();
  }

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

  // 禁止删除当前登录用户，避免把自己锁在外面
  if (id === user.id) {
    return jsonResponse(403, null, '不能删除当前登录用户');
  }

  // 禁止删除最后一个 super_admin，避免系统失去管理入口
  if (target.role === 'super_admin') {
    const admins = await env.DB_USERS.prepare(
      "SELECT COUNT(*) as c FROM users WHERE role = 'super_admin' AND status = 1"
    ).first();
    if (admins.c <= 1) {
      return jsonResponse(403, null, '不能删除最后一个超级管理员');
    }
  }

  // 级联清理：登录令牌、验证码、点赞、评论
  await env.DB_USERS.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(id).run();
  await env.DB_USERS.prepare('DELETE FROM verify_codes WHERE email IN (SELECT email FROM users WHERE id = ?)').bind(id).run();
  await env.DB_POSTS.prepare('DELETE FROM likes WHERE user_id = ?').bind(id).run();
  await deleteCommentsByUser(env, id);
  await env.DB_USERS.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

  return jsonResponse(0, null, '删除成功');
}

// ---------- 友链管理 ----------

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

// ---------- 友链申请 ----------
// 申请数据存 settings 表 key='friend_applications' 的 JSON 数组，避免改库结构。

async function readFriendApplications(env) {
  const list = (await getSetting(env, 'friend_applications')) || [];
  return Array.isArray(list) ? list : [];
}

async function writeFriendApplications(env, list) {
  await setSetting(env, 'friend_applications', list);
}

async function applyFriend(request, env, user) {
  // 需要登录：user 由 requireAuth 传入
  const body = await request.json();
  const name = String(body.name || '').trim();
  const url = String(body.url || '').trim();
  const description = body.description ? String(body.description).trim() : '';
  const email = body.email ? String(body.email).trim() : '';
  const avatar = body.avatar ? String(body.avatar).trim() : '';

  const friendsConfig = (await getSetting(env, 'friends')) || {};
  if (friendsConfig.applyEnabled !== true) {
    return jsonResponse(400, null, '暂未开放友链申请');
  }

  if (!name) return jsonResponse(400, null, '站点名称必填');
  if (!url) return jsonResponse(400, null, '站点链接必填');

  const time = now();
  let id = 1;
  const list = await readFriendApplications(env);
  if (list.length > 0) {
    const maxId = Math.max(...list.map((a) => Number(a.id) || 0));
    id = maxId + 1;
  }
  // 若未开启审核，则申请直接生效为正式友链
  if (friendsConfig.applyNeedsAudit !== true) {
    await env.DB_CONFIG.prepare(
      'INSERT INTO friends (name, url, description, avatar, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(name, url, description, avatar, 0, time, time)
      .run();
    return jsonResponse(0, { id, status: 'approved', autoApproved: true }, '友链申请成功');
  }

  list.push({
    id,
    name,
    url,
    description,
    email,
    avatar,
    status: 'pending',
    remark: '',
    applyUserId: user ? user.id : null,
    applyUserName: user ? user.username : '',
    createdAt: time,
    updatedAt: time,
  });
  await writeFriendApplications(env, list);
  return jsonResponse(0, { id, status: 'pending' }, '友链申请已提交，等待审核');
}

async function listMyFriendApplications(request, env, user) {
  if (!user) return jsonResponse(401, null, 'Unauthorized', 401);
  const list = (await readFriendApplications(env)).filter((a) => a.applyUserId === user.id);
  list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return jsonResponse(0, {
    list: list.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      description: a.description ?? '',
      avatar: a.avatar ?? '',
      status: a.status,
      remark: a.remark ?? '',
      createdAt: a.createdAt,
    })),
  });
}

async function listFriendApplications(request, env, user) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10));
  const list = await readFriendApplications(env);
  list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const total = list.length;
  const start = (page - 1) * limit;
  const pageList = list.slice(start, start + limit);
  return jsonResponse(0, { list: pageList, total });
}

async function auditFriendApplication(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '申请 ID 无效');

  const body = await request.json();
  const status = body.status;
  if (status !== 'approved' && status !== 'rejected') {
    return jsonResponse(400, null, '审核状态无效');
  }
  const remark = body.remark ? String(body.remark).trim() : '';

  const list = await readFriendApplications(env);
  const idx = list.findIndex((a) => Number(a.id) === id);
  if (idx === -1) return jsonResponse(404, null, '申请不存在', 404);
  const app = list[idx];

  if (status === 'approved') {
    // 通过：写入正式友链
    const time = now();
    await env.DB_CONFIG.prepare(
      'INSERT INTO friends (name, url, description, avatar, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(app.name, app.url, app.description || '', app.avatar || '', 0, time, time)
      .run();
  }
  list[idx] = { ...app, status, remark, updatedAt: now() };
  await writeFriendApplications(env, list);
  return jsonResponse(0, null, status === 'approved' ? '已通过并添加为友链' : '已驳回');
}

async function deleteFriendApplication(request, env, user) {
  const id = parseInt(request.url.split('/').pop(), 10);
  if (!id) return jsonResponse(400, null, '申请 ID 无效');
  const list = await readFriendApplications(env);
  const next = list.filter((a) => Number(a.id) !== id);
  await writeFriendApplications(env, next);
  return jsonResponse(0, null, '已删除');
}

// ---------- AI 功能 ----------

// OpenAI 风格别名 -> Cloudflare Workers AI 实际模型 ID
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
  // OpenAI 兼容分片：优先取 delta/message 的 content；choices 为空（流式结束/usage 标记）时丢弃
  if (Array.isArray(result.choices)) {
    if (result.choices.length === 0) return '';
    const first = result.choices[0];
    const part = (first && (first.delta || first.message)) || first;
    if (part && typeof part.content === 'string') return part.content;
    if (part && typeof part.reasoning_content === 'string') return part.reasoning_content;
    return '';
  }
  if (typeof result.response === 'object' && result.response !== null) {
    return JSON.stringify(result.response);
  }
  if (typeof result === 'string') return result;
  return '';
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

// 自动识别请求地址：若 baseUrl 已以 /chat/completions 结尾，说明用户填的是完整 endpoint，直接使用；
// 否则视为 Base URL，自动拼接 OpenAI 兼容路径 /v1/chat/completions。
function buildCustomModelEndpoint(custom) {
  const base = String(custom.baseUrl || '').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(base)) {
    return base;
  }
  return base + '/v1/chat/completions';
}

async function callCustomModelNonStream(custom, body) {
  const url = buildCustomModelEndpoint(custom);
  const reqBody = {
    model: custom.modelId,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    stream: false,
  };
  if (Array.isArray(body.tools) && body.tools.length) {
    reqBody.tools = body.tools;
    if (body.tool_choice) reqBody.tool_choice = body.tool_choice;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custom.apiKey}`,
    },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`自定义模型请求失败 (${res.status}): ${text}`);
  }
  const json = await res.json();
  const message = json.choices?.[0]?.message || {};
  return {
    content: message.content || '',
    tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    message,
    usage: json.usage || null,
  };
}

async function callCustomModelStream(custom, body) {
  const url = buildCustomModelEndpoint(custom);
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
      ...(Array.isArray(body.tools) && body.tools.length ? { tools: body.tools } : {}),
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
  // 去掉完整的 <thinking>...</thinking> 块（大小写不敏感、容忍标签内空格）
  return text
    .replace(/<thinking\s*>[\s\S]*?<\/thinking\s*>/gi, '')
    .replace(/<thinking\s*>/gi, '')
    .trim();
}

function sanitizeJsonControlChars(text) {
  // 去掉 BOM，并把未转义的控制字符（tab/换行等）转换为 JSON 转义序列
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

  // 1. 直接解析
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 1.5 尝试清理控制字符后再解析
  try {
    const sanitized = sanitizeJsonControlChars(trimmed);
    if (sanitized !== trimmed) {
      return JSON.parse(sanitized);
    }
  } catch {}

  // 2. 提取 ```json ... ``` 或 ``` ... ``` 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 3. 从第一个 { 开始，找到第一个可完整解析的 JSON 对象
  //    该实现会跳过字符串内部的 { 和 }，避免 content 中的 Markdown/代码块干扰
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
  agentEnabled: false,
  webSearch: false,
  model: 'llama-3.3-70b',
  imageModel: 'flux-1-schnell',
  temperature: 0.7,
  maxTokens: 4096,
  agentAvatar: '',
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
    agentEnabled: body.agentEnabled === true,
    webSearch: body.webSearch === true,
    model: String(body.model || defaultAiSettings.model),
    imageModel: String(body.imageModel || defaultAiSettings.imageModel),
    temperature: Math.min(2, Math.max(0, parseFloat(body.temperature ?? defaultAiSettings.temperature) || defaultAiSettings.temperature)),
    maxTokens: Math.min(65536, Math.max(2048, parseInt(body.maxTokens ?? defaultAiSettings.maxTokens, 10) || defaultAiSettings.maxTokens)),
    agentAvatar: typeof body.agentAvatar === 'string' ? body.agentAvatar.slice(0, 200000) : '',
  };
  await setSetting(env, 'ai', data);
  return jsonResponse(0, data, '保存成功');
}

async function checkAiEnabled(env) {
  const settings = (await getSetting(env, 'ai')) || {};
  return settings.enabled === true;
}

async function getAgentSettings(request, env) {
  try {
    const settings = (await getSetting(env, 'ai')) || {};
    return jsonResponseWithCache(0, { enabled: settings.agentEnabled === true && settings.enabled === true }, 'ok', 200, 'public, max-age=60');
  } catch (err) {
    if (isBindingError(err)) return jsonResponse(0, { enabled: false }, 'ok');
    throw err;
  }
}

async function verifyAiApiKey(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  // 内置 API Key（环境变量，不存储到 D1）
  if (env.AI_API_KEY && token === env.AI_API_KEY) return true;

  // 用户添加的 API Key
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

// 提示词统一外置到 /prompts/<name>.txt（随静态资源部署，便于无构建修改）。
// 优先读取文件内容；若读取失败（缺文件/无法访问），再回退到内置默认值，避免功能不可用。
const DEFAULT_PROMPTS = {
  'article-generation': `你是一位专业的中文博客作者。请根据用户提供的主题生成一篇完整的博客文章。
必须严格按照以下 json 格式返回，不要包含任何其他解释文字、markdown 代码块或 XML 标签：
{
  "title": "文章标题",
  "excerpt": "160字以内的摘要",
  "tags": ["标签1", "标签2"],
  "content": "Markdown 格式的正文内容，800-2000字"
}`,
  'format-optimization': '你是一位专业的文字编辑。请优化用户提供的 Markdown 文本，改善排版和表达，保持原意不变。只返回优化后的 Markdown 内容，不要包含任何解释。',
  'article-summary': '你是一位专业的文章摘要助手。请根据用户提供的文章标题和正文，生成一段简洁的中文摘要。要求：1. 160 字以内；2. 保留文章的核心观点和关键信息；3. 语言通顺、客观，避免使用第一人称；4. 只返回摘要文本本身，不要添加任何解释、引号、markdown 标记或"以下是摘要"之类的前缀。',
  'agent-core': `你是这个博客站点的 AI 助手，由超级管理员直接使用。你的目标是「用户让你做什么，你就能自己完成什么」——但前提是：想清楚再动手、做一步汇报一步、绝不擅自越权。

【铁律，必须无条件遵守】
1. 严禁乱调工具。技能清单里没有的、或用户没让做的事，一律不碰。能用纯回答处理的问题，绝不调用任何技能。
2. 动手前必须思考。思考就是普通的文本：每执行一个子任务之前，先在这条回复里用 <thinking>...</thinking> 标签把这一步想清楚、写详细，再调用工具。思考写在回复文本里、和工具调用同一轮产出，不额外占用轮次；想一步、做一步，再想下一步、再做下一步。分步任务每一步动手前都要先写出思考；不思考就调用工具，视为违规。
3. 先拆解再执行。把用户的一句话拆成明确、有序的多个子任务，按顺序逐个完成，全部完成后再统一汇报；不许做到一半就停下，也不许跳步、并行抢跑。
4. 写操作必须征得同意。凡是删除、修改、发布、改权限、批审核等一切改动数据的操作，先清楚说明「要做什么、影响哪些内容」，等用户明确确认后才能真正执行；用户没点头，宁可不做，绝不擅自改数据。
5. 只答事实、不脑补。技能返回什么就基于什么回答；数据里看不到的，就明说「看不到/没有」，禁止编造数字或结论。
6. 控制范围与篇幅。不要在一个回答里塞无关内容，不要长篇大论；说明讲清楚即可，输出用 Markdown，代码/列表规范排版。

【输出格式硬性要求】
1. 凡是这一轮要调用工具，必须先在这条回复里用 <thinking>...</thinking> 写出思考过程，紧跟着再给出工具调用；思考与工具调用必须在同一轮输出中一起产出，先思考、后调用，禁止先调工具再补思考。
2. 思考过程不设固定模板、不规定内容，由你自由展开，尽量写详细、写充分（意图分析、拆解步骤、判断依据、取舍理由等，怎么想就怎么写），给自己留足思考空间。
3. 不写 <thinking> 就直接调用工具，视为违规，会被要求重做。
4. 纯文本回答（不调用任何工具）也要先用 <thinking> 想一下再答。

【工作方式】
- 一句话：把用户诉求拆解为有序子任务 →（必要时）open_skills 打开技能 → 按「思考（<thinking> 文本）→ 调用技能 → 再思考 → …」的链路逐步执行，直到全部完成 → 最后归纳成自然语言回答。
- 每一步动手前先把这一步的打算写进 <thinking>，让用户看到你在想什么，也让多步任务的顺序清晰可见。
- 普通闲聊（问候、介绍站点等）：不需要技能，直接回答，零工具开销。
- 全程中文、口语化、语气温和友好，但立场要坚定、规则要清楚。

【状态自查】每次动手前自查：我这一步是不是用户要的？会不会改动数据？要不要先问用户？三条都过关才执行。`,
};

async function loadPrompt(env, request, name) {
  try {
    if (env.ASSETS && request) {
      const url = new URL(`/prompts/${name}.txt`, request.url).href;
      const res = await env.ASSETS.fetch(new Request(url));
      if (res && res.ok) {
        const text = (await res.text()).trim();
        if (text) return text;
      }
    }
  } catch (_) {
    // 读取失败走默认值
  }
  return DEFAULT_PROMPTS[name] || '';
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
      if (!env.AI) {
        return jsonResponse(503, null, 'AI 绑定未配置，请在 Cloudflare Dashboard 中绑定 AI 后重试', 503);
      }
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
    : Math.min(65536, Math.max(256, parsedMaxTokens));

  const options = { messages, temperature, max_tokens: maxTokens };
  if (stream) options.stream = true;

  // 自定义模型
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

  if (!env.AI) {
    return jsonResponse(503, null, 'AI 绑定未配置', 503);
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

  // 流式响应
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

// ============ Agent 技能框架（B 方案：懒加载技能 + 单请求内多轮工具调用） ============
// 常驻 system prompt 仅携带「短技能清单」；要干活时模型先用 open_skills 打开技能，
// 再在同一请求内连续多轮「思考 -> 调用技能 -> 再思考」，直到产出最终回复（省 token）。
// 注意：思考就是模型回复里的普通文本（<thinking>...</thinking>），不占用额外工具轮次，
// 与工具调用在同一轮 generation 里产出，前端并列展示。

const OPEN_SKILLS_TOOL = {
  type: 'function',
  function: {
    name: 'open_skills',
    description:
      '将当前任务需要用到的技能「打开」以获得它们的完整参数用法。当普通对话无法满足用户、需要查询/处理站点数据或执行管理任务时调用；一次可打开多个技能，之后就可以直接调用这些技能。',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: '要打开的技能 id 列表，例如 ["app.ping","content.stats"]',
        },
      },
      required: ['ids'],
    },
  },
};

// v1：演示/占位技能，execute 的落点为既有 admin API / D1（阶段 4 填充真实实现）
// 技能注册表（运行时从 public/skills/*.txt 加载，见 ensureSkills）

// 常驻技能：首轮即注入 tools（无需先 open_skills），减少一次往返调用。
// 与 public/prompts/agent-core.txt 的【常驻技能】清单保持一致。
// 博客核心定位：文章/评论/标签 优先 —— 查询 + 核心写操作都常驻（写操作经确认卡片兜底）。
const ALWAYS_ACTIVE_SKILLS = [
  // —— 内容（博客灵魂）——
  'article.list',
  'article.read',
  'article.create',
  'article.update',
  'article.delete',
  'comment.list',
  'comment.review',
  'comment.delete',
  'tag.list',
  'tag.create',
  'tag.update',
  'tag.delete',
  // —— 站点与总览 ——
  'site.info',
  'dashboard.stat',
  // —— 其它常用 ——
  'message.list',
  'user.list',
  'friend.list',
  'media.list',
  'media.usage',
  'chat.room.list',
  'ai.models',
  'ai.settings',
];


// 通用：以「管理员身份」调用内部 handler，返回 { ok, data|error }
// handler 统一为 (request, env, user) => Promise<Response(jsonResponse<{code,data}>)
async function agentSkillCall(env, user, handler, query = {}) {
  const q = new URLSearchParams(query).toString();
  const req = new Request('https://agent.local' + (q ? '?' + q : ''), { method: 'GET' });
  const res = await handler(req, env, user);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || !json || json.code !== 0) {
    return { ok: false, error: (json && json.message) || `请求失败 ${res.status}` };
  }
  return { ok: true, data: json.data };
}

// ============ 技能注册表：运行时从 public/skills/*.txt 加载 ============
// 技能「定义」静态化（TXT），worker 只保留通用调度器。用 request.url 拼静态地址，
// 与 loadPrompt 抓 /prompts/*.txt 同一套路。
const SKILL_PACKAGE_FILES = [
  '01-site',
  '02-content-articles',
  '03-content-tags',
  '04-content-comments',
  '05-content-messages',
  '06-users',
  '07-friends',
  '08-media',
  '09-chat',
  '10-ai',
];

// 只读技能对应的内部 handler（统一签名 (request, env, user) => Response）
const SKILL_HANDLERS = {
  getDashboard,
  listAdminPosts,
  getAdminPost,
  listAdminTags,
  listAdminComments,
  listAdminUsers,
  listAdminFriends,
  listFriendApplications,
  listAdminMedia,
  getAdminMedia,
  getAdminMediaUsage,
  getAdminMediaUsageDetail,
  listAdminMessages,
  listAdminChatRooms,
  getAdminChatRoomMembers,
  searchRoomUsers,
  adminChatDoOverview,
  getSystemStatus,
  listDatabases,
  listAdminAiModels,
  getAiSettings,
  getAuthSettings,
  getEmailSettings,
  getEmailTemplateSettings,
  getCommentNotifySettings,
  getInteractionSettings,
  getMessageWallSettings,
  getChatSettings,
};

// 特殊执行器：不能走通用 (request,env,user) 调用的技能放这里
const SKILL_EXECUTORS = {
  'site.info': async (ctx) => ({ ok: true, data: await getSiteConfig(ctx.env) }),
};

// ---------- Agent 写操作：确认后执行 ----------
// 写技能不会立即执行，而是：SSE 发 confirm_request → 用户点「确认」继续同一轮 → 才真正调用 handler。
// handler 复用它已存在的写接口；superAdmin 为 true 的技能仅站点账号可执行。
const SKILL_WRITE = {
  'article.create': { handler: createPost, method: 'POST', keyParam: null, params: ['title', 'slug', 'content', 'excerpt', 'coverBase64', 'tagIds', 'status'], superAdmin: false },
  'article.update': { handler: updatePost, method: 'PATCH', keyParam: 'id', params: ['title', 'slug', 'content', 'excerpt', 'coverBase64', 'tagIds', 'status'], superAdmin: false },
  'article.delete': { handler: deletePost, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  'tag.create': { handler: createTag, method: 'POST', keyParam: null, params: ['name', 'slug', 'color'], superAdmin: false },
  'tag.update': { handler: updateTag, method: 'PATCH', keyParam: 'id', params: ['name', 'slug', 'color'], superAdmin: false },
  'tag.delete': { handler: deleteTag, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  'comment.review': { handler: updateAdminCommentsBatch, method: 'PATCH', keyParam: null, params: ['ids', 'status', 'action'], superAdmin: false },
  'comment.delete': { handler: deleteAdminComment, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  'message.review': { handler: updateAdminMessagesBatch, method: 'PATCH', keyParam: null, params: ['ids', 'status', 'action'], superAdmin: false },
  'message.delete': { handler: deleteAdminMessage, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  'friend.create': { handler: createFriend, method: 'POST', keyParam: null, params: ['name', 'url', 'avatar', 'description'], superAdmin: false },
  'friend.application.review': { handler: auditFriendApplication, method: 'PATCH', keyParam: 'id', params: ['status', 'remark'], superAdmin: false },
  'user.update': { handler: updateAdminUser, method: 'PATCH', keyParam: 'id', params: ['role', 'status', 'emailVerified'], superAdmin: true },
  'user.delete': { handler: deleteAdminUser, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  // —— 文本/内容类（AI 擅长写，仅站主）——
  'site.settings.emailTemplate.update': { handler: updateEmailTemplateSettings, method: 'PATCH', keyParam: null, params: ['kind', 'subject', 'html', 'text'], superAdmin: true },
  'site.terms.update': { handler: updateSettings, method: 'PATCH', keyParam: null, params: ['termsAgreement', 'termsPrivacy'], superAdmin: true, wrapSite: true },
  'site.info.update': { handler: updateSettings, method: 'PATCH', keyParam: null, params: ['description', 'announcement', 'title', 'subtitle'], superAdmin: true, wrapSite: true },
  // —— 友链补充 ——
  'friend.update': { handler: updateFriend, method: 'PATCH', keyParam: 'id', params: ['name', 'url', 'description', 'avatar', 'sortOrder'], superAdmin: false },
  'friend.application.delete': { handler: deleteFriendApplication, method: 'DELETE', keyParam: 'id', params: [], superAdmin: true },
  // —— 聊天室 ——
  'chat.room.create': { handler: createChatRoom, method: 'POST', keyParam: null, params: ['name', 'description', 'cover', 'maxUsers', 'members'], superAdmin: false },
  'chat.room.update': { handler: updateChatRoom, method: 'PATCH', keyParam: 'key', params: ['name', 'description', 'cover', 'maxUsers', 'enabled', 'members'], superAdmin: false },
  'chat.room.delete': { handler: deleteChatRoom, method: 'DELETE', keyParam: 'key', params: [], superAdmin: true },
};

// 进程内「待确认」登记表：token -> { resolve, timer, skill, target }
const writeConfirmMap = new Map();

function waitWriteConfirm(token, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      writeConfirmMap.delete(token);
      resolve({ approved: false, reason: '确认超时，操作未执行' });
    }, timeoutMs);
    writeConfirmMap.set(token, { resolve, timer });
  });
}

// 用户确认/取消端点：只唤醒挂起的 SSE 流（真正执行由 AI 那一轮继续完成）
async function confirmWriteAction(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const approved = body.approved !== false;
  const pending = token && writeConfirmMap.get(token);
  if (!pending) return jsonResponse(404, null, '确认请求不存在或已超时', 404);
  clearTimeout(pending.timer);
  writeConfirmMap.delete(token);
  pending.resolve({ approved });
  return jsonResponse(0, { ok: true, approved });
}

// 把技能描述成人类可读的确认文案
function describeWriteAction(skillId, args) {
  const brief = (v) => (v === undefined || v === null ? '' : String(v).slice(0, 40));
  switch (skillId) {
    case 'article.delete': return `删除文章（id ${brief(args.id)}）`;
    case 'article.create': return `创建文章《${brief(args.title)}》`;
    case 'article.update': return `编辑文章（id ${brief(args.id)}）`;
    case 'tag.delete': return `删除标签（id ${brief(args.id)}）`;
    case 'tag.create': return `创建标签「${brief(args.name)}」`;
    case 'tag.update': return `编辑标签（id ${brief(args.id)}）`;
    case 'comment.delete': return `删除评论（id ${brief(args.id)}）`;
    case 'comment.review': return `审核评论（ids ${brief(args.ids)} → ${brief(args.status || args.action)}）`;
    case 'message.delete': return `删除留言（id ${brief(args.id)}）`;
    case 'message.review': return `审核留言（ids ${brief(args.ids)} → ${brief(args.status || args.action)}）`;
    case 'friend.create': return `添加友链「${brief(args.name)}」`;
    case 'friend.application.review': return `审核友链申请（id ${brief(args.id)} → ${brief(args.status)}）`;
    case 'user.update': return `修改用户（id ${brief(args.id)}，role/status）`;
    case 'user.delete': return `删除用户（id ${brief(args.id)}）`;
    case 'site.settings.emailTemplate.update': {
      const which = args.kind === 'reset' ? '找回密码' : '通用';
      return `更新${which}邮件模板（主题：${brief(args.subject)}）`;
    }
    case 'site.terms.update': return `更新协议/隐私政策内容（${args.termsAgreement !== undefined ? '用户协议' : ''}${args.termsPrivacy !== undefined ? (args.termsAgreement !== undefined ? '、' : '') + '隐私政策' : ''}）`;
    case 'site.info.update': return `更新站点信息（${Object.keys(args || {}).map((k) => k).filter((k) => args[k] !== undefined).join('、') || '无' }）`;
    case 'friend.update': return `编辑友链（id ${brief(args.id)}${args.name ? '，名称 ' + brief(args.name) : ''}）`;
    case 'friend.application.delete': return `删除友链申请（id ${brief(args.id)}）`;
    case 'chat.room.create': return `创建聊天室「${brief(args.name)}」`;
    case 'chat.room.update': return `编辑聊天室（key ${brief(args.key)}${args.name ? '，名称 ' + brief(args.name) : ''}）`;
    case 'chat.room.delete': return `删除聊天室（key ${brief(args.key)}）`;
    default: return `执行写操作 ${skillId}`;
  }
}

// ---------- AI 写操作回滚（Undo） ----------
// undo 日志存 config 库。建表走「进程级标记 + CREATE TABLE IF NOT EXISTS」，单次幂等，绝不重复创建。
let _undoTableInitialized = false;
async function ensureUndoLogTable(env) {
  if (_undoTableInitialized) return;
  const db = getConfigDb(env);
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ai_undo_log (
        id TEXT PRIMARY KEY,
        skill TEXT NOT NULL,
        args TEXT NOT NULL DEFAULT '{}',
        before_data TEXT,
        after_data TEXT,
        operator TEXT,
        created_at TEXT NOT NULL,
        used_at TEXT
      )`
    )
    .run();
  _undoTableInitialized = true;
}

function safeParse(s) {
  try {
    if (s === null || s === undefined) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// 收集某文章的评论完整行（按 id 升序，父在前，保证外键引用合法）
async function collectCommentsByPost(env, postId) {
  const rows = await env.DB_POSTS.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC').bind(postId).all();
  return rows.results || [];
}

// 收集某用户的评论完整行（按 id 升序）
async function collectCommentsByUser(env, userId) {
  const rows = await env.DB_POSTS.prepare('SELECT * FROM comments WHERE user_id = ? ORDER BY id ASC').bind(userId).all();
  return rows.results || [];
}

// 评论删除子树：deleteCommentTree 删的是根及其全部子孙。这里按 id 升序收集完整行
async function collectCommentSubtreeRows(env, rootId) {
  const all = await env.DB_POSTS.prepare('SELECT * FROM comments WHERE id = ? OR parent_id = ?').bind(rootId, rootId).all();
  return all.results || [];
}

// 撤销动作的「操作前快照 + 恢复」映射。snapshot 在执行前调用，restore 在回滚时调用。
const UNDO_MAP = {
  // —— 文章 ——
  'article.create': {
    snapshot: () => null,
    after: (result) => ({ id: result && result.id }),
    restore: async (env, log) => {
      const after = safeParse(log.after_data) || {};
      const id = Number(after.id);
      if (!id) return { ok: false, error: '缺少新文章 id' };
      await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run();
      await env.DB_POSTS.prepare('DELETE FROM comments WHERE post_id = ?').bind(id).run();
      await env.DB_POSTS.prepare('DELETE FROM likes WHERE post_id = ?').bind(id).run();
      await env.DB_POSTS.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
      return { ok: true, message: `已删除创建的文章 #${id}` };
    },
  },
  'article.update': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const post = await env.DB_POSTS.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
      if (!post) return null;
      const tags = await env.DB_POSTS.prepare('SELECT tag_id FROM post_tags WHERE post_id = ?').bind(id).all();
      return { post, tags: (tags.results || []).map((r) => r.tag_id) };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.post) return { ok: false, error: '缺少文章快照' };
      const p = before.post;
      await env.DB_POSTS.prepare(
        'UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, cover_base64 = ?, status = ?, views = ?, reading_time = ?, updated_at = ? WHERE id = ?'
      )
        .bind(p.title, p.slug, p.excerpt, p.content, p.cover_base64, p.status, p.views, p.reading_time, now(), p.id)
        .run();
      await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(p.id).run();
      for (const tagId of before.tags || []) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(p.id, tagId).run();
      }
      return { ok: true, message: `已恢复文章《${p.title}》` };
    },
  },
  'article.delete': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const post = await env.DB_POSTS.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
      if (!post) return null;
      const postTags = await env.DB_POSTS.prepare('SELECT tag_id FROM post_tags WHERE post_id = ?').bind(id).all();
      const comments = await collectCommentsByPost(env, id);
      const likes = await env.DB_POSTS.prepare('SELECT * FROM likes WHERE post_id = ?').bind(id).all();
      return { post, postTags: (postTags.results || []).map((r) => r.tag_id), comments, likes: likes.results || [] };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.post) return { ok: false, error: '缺少文章快照' };
      const p = before.post;
      await env.DB_POSTS.prepare(
        'INSERT OR IGNORE INTO posts (id, title, slug, excerpt, content, cover_base64, author_id, status, views, reading_time, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      )
        .bind(p.id, p.title, p.slug, p.excerpt, p.content, p.cover_base64, p.author_id, p.status, p.views, p.reading_time, p.created_at, now())
        .run();
      for (const tagId of before.postTags || []) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(p.id, tagId).run();
      }
      for (const c of before.comments || []) {
        await env.DB_POSTS.prepare(
          'INSERT OR IGNORE INTO comments (id, post_id, user_id, content, parent_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
        )
          .bind(c.id, c.post_id, c.user_id, c.content, c.parent_id, c.status, c.created_at, c.updated_at)
          .run();
      }
      for (const l of before.likes || []) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO likes (id, post_id, user_id, created_at) VALUES (?,?,?,?)')
          .bind(l.id, l.post_id, l.user_id, l.created_at)
          .run();
      }
      return { ok: true, message: `已恢复文章《${p.title}》` };
    },
  },
  // —— 标签 ——
  'tag.create': {
    snapshot: () => null,
    after: (result) => ({ id: result && result.id }),
    restore: async (env, log) => {
      const id = Number((safeParse(log.after_data) || {}).id);
      if (!id) return { ok: false, error: '缺少新标签 id' };
      await env.DB_POSTS.prepare('DELETE FROM post_tags WHERE tag_id = ?').bind(id).run();
      await env.DB_POSTS.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
      return { ok: true, message: `已删除创建的标签 #${id}` };
    },
  },
  'tag.update': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const tag = await env.DB_POSTS.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first();
      return tag || null;
    },
    after: null,
    restore: async (env, log) => {
      const t = safeParse(log.before_data);
      if (!t || !t.id) return { ok: false, error: '缺少标签快照' };
      await env.DB_POSTS.prepare('UPDATE tags SET name = ?, slug = ?, color = ? WHERE id = ?')
        .bind(t.name, t.slug, t.color, t.id)
        .run();
      return { ok: true, message: `已恢复标签「${t.name}」` };
    },
  },
  'tag.delete': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const tag = await env.DB_POSTS.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first();
      if (!tag) return null;
      const links = await env.DB_POSTS.prepare('SELECT post_id FROM post_tags WHERE tag_id = ?').bind(id).all();
      return { tag, links: (links.results || []).map((r) => r.post_id) };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.tag) return { ok: false, error: '缺少标签快照' };
      const t = before.tag;
      await env.DB_POSTS.prepare('INSERT OR IGNORE INTO tags (id, name, slug, color) VALUES (?,?,?,?)')
        .bind(t.id, t.name, t.slug, t.color)
        .run();
      for (const postId of before.links || []) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(postId, t.id).run();
      }
      return { ok: true, message: `已恢复标签「${t.name}」` };
    },
  },
  // —— 评论 ——
  'comment.review': {
    snapshot: async (env, args) => {
      const ids = (args.ids || []).filter((i) => Number.isInteger(Number(i))).map(Number);
      if (!ids.length) return null;
      const rows = await env.DB_POSTS.prepare(
        `SELECT id, status FROM comments WHERE id IN (${ids.map(() => '?').join(',')})`
      )
        .bind(...ids)
        .all();
      return (rows.results || []).map((r) => ({ id: r.id, status: r.status }));
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!Array.isArray(before) || !before.length) return { ok: false, error: '缺少评论状态快照' };
      for (const row of before) {
        await env.DB_POSTS.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?')
          .bind(row.status, now(), row.id)
          .run();
      }
      return { ok: true, message: `已恢复 ${before.length} 条评论状态` };
    },
  },
  'comment.delete': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const root = await env.DB_POSTS.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first();
      if (!root) return null;
      const rows = await collectCommentSubtreeRows(env, id);
      return { comments: rows.sort((a, b) => a.id - b.id) };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      const list = (before && before.comments) || [];
      if (!list.length) return { ok: false, error: '缺少评论快照' };
      for (const c of list) {
        await env.DB_POSTS.prepare(
          'INSERT OR IGNORE INTO comments (id, post_id, user_id, content, parent_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
        )
          .bind(c.id, c.post_id, c.user_id, c.content, c.parent_id, c.status, c.created_at, c.updated_at)
          .run();
      }
      return { ok: true, message: `已恢复 ${list.length} 条评论` };
    },
  },
  // —— 留言墙 ——
  'message.review': {
    snapshot: async (env, args) => {
      const ids = (args.ids || []).filter((i) => Number.isInteger(Number(i))).map(Number);
      if (!ids.length) return null;
      const rows = await getConfigDb(env)
        .prepare(`SELECT id, status FROM message_wall WHERE id IN (${ids.map(() => '?').join(',')})`)
        .bind(...ids)
        .all();
      return (rows.results || []).map((r) => ({ id: r.id, status: r.status }));
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!Array.isArray(before) || !before.length) return { ok: false, error: '缺少留言状态快照' };
      for (const row of before) {
        await getConfigDb(env)
          .prepare('UPDATE message_wall SET status = ?, updated_at = ? WHERE id = ?')
          .bind(row.status, now(), row.id)
          .run();
      }
      return { ok: true, message: `已恢复 ${before.length} 条留言状态` };
    },
  },
  'message.delete': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const row = await getConfigDb(env).prepare('SELECT * FROM message_wall WHERE id = ?').bind(id).first();
      return row || null;
    },
    after: null,
    restore: async (env, log) => {
      const m = safeParse(log.before_data);
      if (!m || !m.id) return { ok: false, error: '缺少留言快照' };
      await getConfigDb(env)
        .prepare('INSERT OR IGNORE INTO message_wall (id, content, nickname, user_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .bind(m.id, m.content, m.nickname, m.user_id, m.status, m.created_at, m.updated_at)
        .run();
      return { ok: true, message: '已恢复该留言' };
    },
  },
  // —— 友链 ——
  'friend.create': {
    snapshot: () => null,
    after: (result) => ({ id: result && result.id }),
    restore: async (env, log) => {
      const id = Number((safeParse(log.after_data) || {}).id);
      if (!id) return { ok: false, error: '缺少新友链 id' };
      await env.DB_CONFIG.prepare('DELETE FROM friends WHERE id = ?').bind(id).run();
      return { ok: true, message: `已删除创建的友链 #${id}` };
    },
  },
  'friend.update': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const row = await env.DB_CONFIG.prepare('SELECT * FROM friends WHERE id = ?').bind(id).first();
      return row || null;
    },
    after: null,
    restore: async (env, log) => {
      const f = safeParse(log.before_data);
      if (!f || !f.id) return { ok: false, error: '缺少友链快照' };
      await env.DB_CONFIG.prepare(
        'UPDATE friends SET name = ?, url = ?, description = ?, avatar = ?, sort_order = ?, updated_at = ? WHERE id = ?'
      )
        .bind(f.name, f.url, f.description, f.avatar, f.sort_order, now(), f.id)
        .run();
      return { ok: true, message: `已恢复友链「${f.name}」` };
    },
  },
  'friend.application.review': {
    snapshot: async (env, args) => {
      const list = (await getSetting(env, 'friend_applications')) || [];
      const app = list.find((a) => Number(a.id) === Number(args.id));
      return app ? { ...app } : null;
    },
    after: (result, args) => ({ status: args.status }),
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      const after = safeParse(log.after_data) || {};
      if (!before || !before.id) return { ok: false, error: '缺少申请快照' };
      // 原操作是「通过」（创建了正式友链）→ 删除对应友链
      if (after.status === 'approved') {
        await env.DB_CONFIG.prepare('DELETE FROM friends WHERE name = ? AND url = ?').bind(before.name, before.url).run();
      }
      const list = (await getSetting(env, 'friend_applications')) || [];
      const idx = list.findIndex((a) => Number(a.id) === Number(before.id));
      if (idx !== -1) list[idx] = { ...list[idx], status: before.status, updatedAt: now() };
      await setSetting(env, 'friend_applications', list);
      return { ok: true, message: `已恢复友链申请（${before.name}）状态` };
    },
  },
  'friend.application.delete': {
    snapshot: async (env, args) => {
      const list = (await getSetting(env, 'friend_applications')) || [];
      const app = list.find((a) => Number(a.id) === Number(args.id));
      return app ? { ...app } : null;
    },
    after: null,
    restore: async (env, log) => {
      const app = safeParse(log.before_data);
      if (!app || !app.id) return { ok: false, error: '缺少申请快照' };
      const list = (await getSetting(env, 'friend_applications')) || [];
      if (list.some((a) => Number(a.id) === Number(app.id))) return { ok: true, message: '该申请已存在，无需恢复' };
      list.push(app);
      await setSetting(env, 'friend_applications', list);
      return { ok: true, message: `已恢复友链申请（${app.name}）` };
    },
  },
  // —— 用户 ——
  'user.update': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const row = await env.DB_USERS.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return row || null;
    },
    after: null,
    restore: async (env, log) => {
      const u = safeParse(log.before_data);
      if (!u || !u.id) return { ok: false, error: '缺少用户快照' };
      await env.DB_USERS.prepare(
        'UPDATE users SET username = ?, email = ?, email_verified = ?, role = ?, status = ?, updated_at = ? WHERE id = ?'
      )
        .bind(u.username, u.email, u.email_verified, u.role, u.status, now(), u.id)
        .run();
      return { ok: true, message: `已恢复用户「${u.username}」` };
    },
  },
  'user.delete': {
    snapshot: async (env, args) => {
      const id = Number(args.id);
      const user = await env.DB_USERS.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      if (!user) return null;
      const likes = await env.DB_POSTS.prepare('SELECT * FROM likes WHERE user_id = ?').bind(id).all();
      const comments = await collectCommentsByUser(env, id);
      return { user, likes: likes.results || [], comments };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.user) return { ok: false, error: '缺少用户快照' };
      const u = before.user;
      try {
        await env.DB_USERS.prepare(
          'INSERT OR IGNORE INTO users (id, username, email, email_verified, password_hash, password_salt, avatar_base64, theme, ui, role, status, verify_code, verify_code_expires_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        )
          .bind(u.id, u.username, u.email, u.email_verified, u.password_hash, u.password_salt, u.avatar_base64, u.theme, u.ui, u.role, u.status, u.verify_code, u.verify_code_expires_at, u.created_at, u.updated_at)
          .run();
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          return { ok: false, error: `恢复失败：用户名/邮箱已被占用（${e.message.split(':').pop() || ''}）` };
        }
        throw e;
      }
      for (const c of before.comments || []) {
        await env.DB_POSTS.prepare(
          'INSERT OR IGNORE INTO comments (id, post_id, user_id, content, parent_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
        )
          .bind(c.id, c.post_id, c.user_id, c.content, c.parent_id, c.status, c.created_at, c.updated_at)
          .run();
      }
      for (const l of before.likes || []) {
        await env.DB_POSTS.prepare('INSERT OR IGNORE INTO likes (id, post_id, user_id, created_at) VALUES (?,?,?,?)')
          .bind(l.id, l.post_id, l.user_id, l.created_at)
          .run();
      }
      return { ok: true, message: `已恢复用户「${u.username}」` };
    },
  },
  // —— 站点配置 / 邮件模板 ——
  'site.settings.emailTemplate.update': {
    snapshot: async (env, args) => {
      const prefix = args.kind === 'reset' ? 'email_reset' : 'email';
      const db = getConfigDb(env);
      const get = async (k) => (await db.prepare('SELECT value FROM settings WHERE key = ?').bind(k).first())?.value ?? null;
      return { prefix, subject: await get(`${prefix}_subject`), html: await get(`${prefix}_html`), text: await get(`${prefix}_text`) };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.prefix) return { ok: false, error: '缺少模板快照' };
      const db = getConfigDb(env);
      const restore = async (key, value) => {
        if (value === null || value === undefined) {
          await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
        } else {
          await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)').bind(key, value, now()).run();
        }
      };
      await restore(`${before.prefix}_subject`, before.subject);
      await restore(`${before.prefix}_html`, before.html);
      await restore(`${before.prefix}_text`, before.text);
      return { ok: true, message: '已恢复邮件模板' };
    },
  },
  'site.terms.update': {
    snapshot: async (env) => (await getSetting(env, 'site')) || null,
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before) return { ok: false, error: '缺少站点配置快照' };
      await setSetting(env, 'site', before);
      return { ok: true, message: '已恢复协议/隐私配置' };
    },
  },
  'site.info.update': {
    snapshot: async (env) => (await getSetting(env, 'site')) || null,
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before) return { ok: false, error: '缺少站点配置快照' };
      await setSetting(env, 'site', before);
      return { ok: true, message: '已恢复站点信息' };
    },
  },
  // —— 聊天室 ——
  'chat.room.create': {
    snapshot: () => null,
    after: (result) => ({ key: result && result.room_key }),
    restore: async (env, log) => {
      const key = (safeParse(log.after_data) || {}).key;
      if (!key) return { ok: false, error: '缺少新房间 key' };
      await ensureChatRoomTables(env);
      const db = getConfigDb(env);
      await db.prepare('DELETE FROM chat_room_members WHERE room_key = ?').bind(key).run();
      await db.prepare('DELETE FROM chat_rooms WHERE room_key = ?').bind(key).run();
      return { ok: true, message: `已删除创建的聊天室（${key}）` };
    },
  },
  'chat.room.update': {
    snapshot: async (env, args) => {
      await ensureChatRoomTables(env);
      const db = getConfigDb(env);
      const key = String(args.key || '');
      if (!key) return null;
      const room = await db.prepare('SELECT * FROM chat_rooms WHERE room_key = ?').bind(key).first();
      if (!room) return null;
      const members = await db.prepare('SELECT * FROM chat_room_members WHERE room_key = ?').bind(key).all();
      return { room, members: members.results || [] };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.room) return { ok: false, error: '缺少聊天室快照' };
      const db = getConfigDb(env);
      const r = before.room;
      await db.prepare(
        'UPDATE chat_rooms SET name = ?, description = ?, cover = ?, max_users = ?, enabled = ?, updated_at = ? WHERE room_key = ?'
      )
        .bind(r.name, r.description, r.cover, r.max_users, r.enabled, now(), r.room_key)
        .run();
      await db.prepare('DELETE FROM chat_room_members WHERE room_key = ?').bind(r.room_key).run();
      for (const m of before.members || []) {
        await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_key, user_id, username, added_at) VALUES (?,?,?,?)')
          .bind(m.room_key, m.user_id, m.username, m.added_at)
          .run();
      }
      return { ok: true, message: `已恢复聊天室「${r.name}」` };
    },
  },
  'chat.room.delete': {
    snapshot: async (env, args) => {
      await ensureChatRoomTables(env);
      const db = getConfigDb(env);
      const key = String(args.key || '');
      if (!key) return null;
      const room = await db.prepare('SELECT * FROM chat_rooms WHERE room_key = ?').bind(key).first();
      if (!room) return null;
      const members = await db.prepare('SELECT * FROM chat_room_members WHERE room_key = ?').bind(key).all();
      return { room, members: members.results || [] };
    },
    after: null,
    restore: async (env, log) => {
      const before = safeParse(log.before_data);
      if (!before || !before.room) return { ok: false, error: '缺少聊天室快照' };
      const db = getConfigDb(env);
      const r = before.room;
      await db.prepare(
        'INSERT OR IGNORE INTO chat_rooms (room_key, name, description, cover, max_users, enabled, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
      )
        .bind(r.room_key, r.name, r.description, r.cover, r.max_users, r.enabled, r.created_by, r.created_at, now())
        .run();
      for (const m of before.members || []) {
        await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_key, user_id, username, added_at) VALUES (?,?,?,?)')
          .bind(m.room_key, m.user_id, m.username, m.added_at)
          .run();
      }
      return { ok: true, message: `已恢复聊天室「${r.name}」` };
    },
  },
};

// 写操作执行完成后的结果文案（用于结果卡展示）
function describeWriteDone(skillId, args, result) {
  switch (skillId) {
    case 'article.create': return `已创建文章《${String(args.title || '').slice(0, 20)}》`;
    case 'article.update': return `已编辑文章 #${args.id}`;
    case 'article.delete': return `已删除文章 #${args.id}`;
    case 'tag.create': return `已创建标签「${String(args.name || '').slice(0, 20)}」`;
    case 'tag.update': return `已编辑标签 #${args.id}`;
    case 'tag.delete': return `已删除标签 #${args.id}`;
    case 'comment.review': return `已审核 ${(args.ids || []).length} 条评论 → ${args.status || args.action}`;
    case 'comment.delete': return `已删除评论 #${args.id}`;
    case 'message.review': return `已审核 ${(args.ids || []).length} 条留言 → ${args.status || args.action}`;
    case 'message.delete': return `已删除留言 #${args.id}`;
    case 'friend.create': return `已添加友链「${String(args.name || '').slice(0, 20)}」`;
    case 'friend.update': return `已编辑友链 #${args.id}`;
    case 'friend.application.review': return `已审核友链申请 #${args.id} → ${args.status}`;
    case 'friend.application.delete': return `已删除友链申请 #${args.id}`;
    case 'user.update': return `已修改用户 #${args.id}`;
    case 'user.delete': return `已删除用户 #${args.id}`;
    case 'site.settings.emailTemplate.update': return `已更新邮件模板`;
    case 'site.terms.update': return `已更新协议/隐私配置`;
    case 'site.info.update': return `已更新站点信息`;
    case 'chat.room.create': return `已创建聊天室「${String(args.name || '').slice(0, 20)}」`;
    case 'chat.room.update': return `已编辑聊天室（${args.key}）`;
    case 'chat.room.delete': return `已删除聊天室（${args.key}）`;
    default: return '已执行';
  }
}

// 回滚预览文案：告诉用户「回滚将恢复到什么状态」（基于操作前快照 before_data）
function describeUndoPreview(skillId, before) {
  const trunc = (s, n = 18) => {
    const t = String(s || '');
    return t.length > n ? t.slice(0, n) + '…' : t;
  };
  try {
    switch (skillId) {
      case 'article.update': {
        const p = before && before.post;
        return p ? `将文章《${trunc(p.title)}》恢复为操作前的标题、摘要、内容、标签与封面` : '将文章恢复为操作前状态';
      }
      case 'article.delete': {
        const b = before || {};
        return `将恢复已删除的文章《${trunc(b.post && b.post.title)}》及 ${(b.comments || []).length} 条评论、${(b.likes || []).length} 个点赞`;
      }
      case 'article.create': return '将删除新建的文章及其评论、点赞';
      case 'tag.update': return before && before.name ? `将标签恢复为「${trunc(before.name)}」` : '将标签恢复为操作前状态';
      case 'tag.delete': {
        const b = before || {};
        return `将恢复已删除的标签「${trunc(b.tag && b.tag.name)}」及其关联的 ${(b.links || []).length} 篇文章`;
      }
      case 'tag.create': return '将删除新建的标签';
      case 'comment.review': {
        const list = Array.isArray(before) ? before : [];
        return list.length ? `将 ${list.length} 条评论状态恢复为操作前` : '将评论状态恢复为操作前';
      }
      case 'comment.delete': {
        const list = (before && before.comments) || [];
        return list.length ? `将恢复 ${list.length} 条评论（含回复）` : '将恢复被删除的评论';
      }
      case 'message.review': {
        const list = Array.isArray(before) ? before : [];
        return list.length ? `将 ${list.length} 条留言状态恢复为操作前` : '将留言状态恢复为操作前';
      }
      case 'message.delete': return before ? `将恢复留言「${trunc(before.content)}」` : '将恢复被删除的留言';
      case 'friend.create': return '将删除新建的友链';
      case 'friend.update': return before && before.name ? `将友链「${trunc(before.name)}」恢复为操作前信息` : '将友链恢复为操作前信息';
      case 'friend.application.review': return before && before.name ? `将友链申请（${trunc(before.name)}）状态恢复为操作前` : '将友链申请状态恢复为操作前';
      case 'friend.application.delete': return before && before.name ? `将恢复已删除的友链申请「${trunc(before.name)}」` : '将恢复已删除的友链申请';
      case 'user.update': return before && before.username ? `将用户「${trunc(before.username)}」的账号信息恢复为操作前` : '将用户信息恢复为操作前';
      case 'user.delete': {
        const b = before || {};
        return `将恢复已删除的用户「${trunc(b.user && b.user.username)}」及 ${(b.comments || []).length} 条评论、${(b.likes || []).length} 个点赞`;
      }
      case 'site.settings.emailTemplate.update': return '将邮件模板恢复为操作前内容';
      case 'site.terms.update': return '将协议/隐私配置恢复为操作前';
      case 'site.info.update': return '将站点信息恢复为操作前';
      case 'chat.room.create': return '将删除新建的聊天室';
      case 'chat.room.update': return before && before.room ? `将聊天室「${trunc(before.room.name)}」恢复为操作前信息及成员` : '将聊天室恢复为操作前状态';
      case 'chat.room.delete': return before && before.room ? `将恢复已删除的聊天室「${trunc(before.room.name)}」及 ${(before.members || []).length} 位成员` : '将恢复已删除的聊天室';
      default: return '将恢复到操作前状态';
    }
  } catch {
    return '将恢复到操作前状态';
  }
}


// 写技能执行：登记 → 发确认 → 等用户点一下（SSE 保持挂起）→ 通过才调写 handler
async function executeWriteSkill(skillId, args, ctx) {
  const meta = SKILL_WRITE[skillId];
  if (!meta) return { ok: false, error: `未知写技能：${skillId}` };
  if (!ctx.send || !ctx.waitWriteConfirm) {
    return { ok: false, needConfirm: true, error: '此操作需要确认后才能执行' };
  }
  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const target = describeWriteAction(skillId, args);
  ctx.send('confirm_request', { token, skill: skillId, target, params: summarizeToolArgsJson(args) });
  const decision = await ctx.waitWriteConfirm(token);
  if (!decision || !decision.approved) {
    return { ok: false, cancelled: true, error: decision && decision.reason ? decision.reason : '用户取消了此操作' };
  }
  // 权限：superAdmin 专属操作按当前登录者角色收紧（删除/用户等仅站点账号）
  if (meta.superAdmin && ctx.user && ctx.user.role !== 'super_admin') {
    return { ok: false, error: '需要站点（站长）权限才能执行该操作' };
  }
  // 抓操作前快照（用于回滚）
  const ud = UNDO_MAP[skillId];
  let before = null;
  if (ud && ud.snapshot) {
    try {
      before = await ud.snapshot(ctx.env, args);
    } catch (e) {
      before = null;
    }
  }
  const result = await doWriteSkill(meta, args, ctx);
  // 执行成功后：登记 undo 记录，并推送 write_result 事件给前端（结果卡 + 回滚按钮）
  if (result.ok && ud && ctx.send) {
    try {
      await ensureUndoLogTable(ctx.env);
      const after = ud.after ? ud.after(result.data, args) : null;
      await getConfigDb(ctx.env)
        .prepare(
          'INSERT INTO ai_undo_log (id, skill, args, before_data, after_data, operator, created_at) VALUES (?,?,?,?,?,?,?)'
        )
        .bind(
          token,
          skillId,
          JSON.stringify(args || {}),
          before ? JSON.stringify(before) : null,
          after ? JSON.stringify(after) : null,
          ctx.user ? String(ctx.user.id) : null,
          now()
        )
        .run();
      ctx.send('write_result', {
        token,
        undoId: token,
        skill: skillId,
        target,
        ok: true,
        message: describeWriteDone(skillId, args, result),
        undoPreview: describeUndoPreview(skillId, before),
      });
    } catch (e) {
      console.error('record undo failed:', e);
    }
  } else if (ctx.send) {
    // 执行失败：反馈给前端，避免结果卡一直停在「正在执行」
    ctx.send('write_result', {
      token,
      skill: skillId,
      target,
      ok: false,
      message: (result && result.error) || '操作执行失败',
      error: (result && result.error) || '操作执行失败',
    });
  }
  return result;
}

// 回滚端点：仅发起该操作的本人可回滚，24 小时内有效，回滚后标记已用（不可重复回滚）
// 通用：对一条回滚记录执行恢复（权限/时效已由调用方校验）
async function applyUndo(env, log) {
  const restorer = UNDO_MAP[log.skill];
  if (!restorer || !restorer.restore) return { ok: false, error: `该操作不支持回滚（${log.skill}）` };
  let r;
  try {
    r = await restorer.restore(env, log);
  } catch (e) {
    return { ok: false, error: `回滚失败：${e.message || String(e)}` };
  }
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || '回滚失败' };
  await getConfigDb(env).prepare('UPDATE ai_undo_log SET used_at = ? WHERE id = ?').bind(now(), log.id).run();
  return { ok: true, message: (r && r.message) || '已回滚' };
}

async function undoAgentWrite(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const undoId = String(body.undoId || '').trim();
  if (!undoId) return jsonResponse(400, null, '缺少 undoId');
  await ensureUndoLogTable(env);
  const db = getConfigDb(env);
  const log = await db.prepare('SELECT * FROM ai_undo_log WHERE id = ?').bind(undoId).first();
  if (!log) return jsonResponse(404, null, '回滚记录不存在或已过期', 404);
  if (log.used_at) return jsonResponse(400, null, '该操作已回滚过');
  const created = Date.parse(log.created_at);
  if (Number.isNaN(created) || Date.now() - created > 24 * 3600 * 1000) {
    return jsonResponse(400, null, '回滚已过期（操作后 24 小时内有效）');
  }
  if (log.operator && String(log.operator) !== String(user.id)) {
    return jsonResponse(403, null, '只能回滚自己执行的操作', 403);
  }
  const r = await applyUndo(env, log);
  if (!r.ok) return jsonResponse(500, null, r.error, 500);
  return jsonResponse(0, null, r.message);
}

// 管理后台：站长可回滚任意一条回滚记录（跨设备可见），其余限制与本人回滚一致
async function undoAgentWriteAdmin(request, env, user) {
  const id = String(new URL(request.url).pathname.split('/').pop() || '').trim();
  if (!id) return jsonResponse(400, null, '缺少记录 id');
  await ensureUndoLogTable(env);
  const db = getConfigDb(env);
  const log = await db.prepare('SELECT * FROM ai_undo_log WHERE id = ?').bind(id).first();
  if (!log) return jsonResponse(404, null, '回滚记录不存在', 404);
  if (log.used_at) return jsonResponse(400, null, '该操作已回滚过');
  const created = Date.parse(log.created_at);
  if (Number.isNaN(created) || Date.now() - created > 24 * 3600 * 1000) {
    return jsonResponse(400, null, '回滚已过期（操作后 24 小时内有效）');
  }
  const r = await applyUndo(env, log);
  if (!r.ok) return jsonResponse(500, null, r.error, 500);
  return jsonResponse(0, null, r.message);
}

// 管理后台：查询所有回滚记录（云端持久化，跨设备可见）
async function listUndoLogs(request, env, user) {
  await ensureUndoLogTable(env);
  const db = getConfigDb(env);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20));
  const offset = (page - 1) * pageSize;
  const where = [];
  const binds = [];
  if (status === 'used') where.push('used_at IS NOT NULL');
  else if (status === 'pending') where.push('used_at IS NULL');
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const totalRow = await db.prepare(`SELECT COUNT(*) AS c FROM ai_undo_log ${whereSql}`).bind(...binds).first();
  const rows = await db
    .prepare(`SELECT * FROM ai_undo_log ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, pageSize, offset)
    .all();
  const opIds = [...new Set((rows.results || []).map((r) => r.operator).filter(Boolean))];
  const userMap = {};
  for (const id of opIds) {
    const u = await env.DB_USERS.prepare('SELECT id, username FROM users WHERE id = ?').bind(id).first();
    if (u) userMap[id] = u.username;
  }
  const list = (rows.results || []).map((r) => {
    const args = safeParse(r.args) || {};
    const before = safeParse(r.before_data);
    const expired = !r.used_at && (Number.isNaN(Date.parse(r.created_at)) || Date.now() - Date.parse(r.created_at) > 24 * 3600 * 1000);
    return {
      id: r.id,
      skill: r.skill,
      args,
      target: describeWriteAction(r.skill, args),
      undoPreview: describeUndoPreview(r.skill, before),
      operator: r.operator ? userMap[r.operator] || '已删除用户' : '站内系统',
      created_at: r.created_at,
      used_at: r.used_at,
      status: r.used_at ? 'used' : expired ? 'expired' : 'pending',
    };
  });
  return jsonResponse(0, { list, total: totalRow ? totalRow.c || 0 : 0, page, pageSize });
}

// 管理后台：删除一条回滚记录
async function deleteUndoLog(request, env, user) {
  const id = String(new URL(request.url).pathname.split('/').pop() || '').trim();
  if (!id) return jsonResponse(400, null, '缺少记录 id');
  await ensureUndoLogTable(env);
  const db = getConfigDb(env);
  const res = await db.prepare('DELETE FROM ai_undo_log WHERE id = ?').bind(id).run();
  if (!res.meta || !res.meta.changes) return jsonResponse(404, null, '回滚记录不存在', 404);
  return jsonResponse(0, null, '已删除该回滚记录');
}

// 组装并调用真实写 handler（method/path/body 复用它已有的内部 handler）
async function doWriteSkill(meta, args, ctx) {
  let body = {};
  for (const f of meta.params || []) if (args[f] !== undefined) body[f] = args[f];
  // 聊天室等字段做后端参数名对齐
  if (body.maxUsers !== undefined && body.max_users === undefined) {
    body.max_users = body.maxUsers;
    delete body.maxUsers;
  }
  // 站点配置类：updateSettings 期望 body.site 承载站点字段（协议/简介等）
  if (meta.wrapSite) body = { site: body };
  let path = '';
  if (meta.keyParam && args[meta.keyParam] !== undefined) path += '/' + encodeURIComponent(args[meta.keyParam]);
  const req = new Request('https://agent.local' + path, {
    method: meta.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await meta.handler(req, ctx.env, ctx.user);
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || !json || json.code !== 0) {
    return { ok: false, error: (json && json.message) || `执行失败 HTTP ${res.status}` };
  }
  return { ok: true, data: json.data };
}

function summarizeToolArgsJson(args) {
  try {
    const s = JSON.stringify(args || {});
    return s.length > 200 ? s.slice(0, 200) + '…' : s;
  } catch {
    return String(args || '');
  }
}

function _parseParams(def) {
  let p;
  try {
    p = JSON.parse(def.params || '{}');
  } catch {
    p = {};
  }
  // OpenAI 兼容接口要求 function schema 必须是 type: "object" 的合法 JSON Schema。
  // 无参数技能（params 为空/缺失/{}）统一规范化为空对象 schema，避免被严格模型以 type: null 拒绝。
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.type !== 'object') {
    p = { type: 'object', properties: {}, additionalProperties: false };
  }
  return p;
}

function buildSkillFromDef(def) {
  const exec = SKILL_EXECUTORS[def.skill];
  // 技能 id 允许含点（用于可读），但 OpenAI 函数名只允许 [A-Za-z0-9_-]，
  // 故生成 toolName，执行时再由 toolName 反查回原始 id。
  const toolName = def.skill.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    id: def.skill,
    toolName,
    name: def.name || def.skill,
    description: def.desc || '',
    visible: def.visible !== 'false',
    toolDef: {
      type: 'function',
      function: { name: toolName, description: def.desc || '', parameters: _parseParams(def) },
    },
    execute: exec
      ? exec
      : SKILL_WRITE[def.skill]
        ? (ctx, args) => executeWriteSkill(def.skill, args, ctx)
        : (ctx, args) => {
            const handler = SKILL_HANDLERS[def.handler];
            if (!handler) return Promise.resolve({ ok: false, error: `未知 handler：${def.handler}` });
            const allowed = new Set(Object.keys(_parseParams(def).properties || {}));
            const q = {};
            for (const key of allowed) if (args[key] !== undefined) q[key] = args[key];
            return agentSkillCall(ctx.env, ctx.user, handler, q);
          },
  };
}

function parseSkillFile(text) {
  const skills = [];
  const blocks = String(text || '').split(/^---+\s*$/m);
  for (const block of blocks) {
    const def = {};
    for (const raw of block.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      def[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    if (def.skill) skills.push(def);
  }
  return skills;
}

let agentSkillCache = null;

async function ensureSkills(env, request) {
  if (agentSkillCache) return agentSkillCache;
  const map = {};
  for (const pkg of SKILL_PACKAGE_FILES) {
    let text = null;
    try {
      const url = new URL(`/skills/${pkg}.txt`, request.url);
      const res = await fetch(url.toString());
      if (res.ok) text = await res.text();
    } catch {}
    if (!text) continue;
    for (const def of parseSkillFile(text)) {
      map[def.skill] = buildSkillFromDef(def);
    }
  }
  // 元技能：始终可用
  map['open_skills'] = {
    id: 'open_skills',
    name: '打开技能',
    description: '打开一个或多个技能的完整用法，以实现当前任务',
    visible: false,
    toolDef: OPEN_SKILLS_TOOL,
    execute: null,
  };
  map['app.ping'] = {
    id: 'app.ping',
    name: '在线检测',
    description: '测试 Agent 是否在线。无参数。',
    visible: true,
    toolDef: {
      type: 'function',
      function: {
        name: 'app.ping',
        description: '测试 Agent 是否在线。返回 pong 与当前时间。',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    async execute(ctx) {
      return { ok: true, data: { pong: 'pong', time: new Date().toISOString() } };
    },
  };
  // 联网检索技能：Web Search（读网页检索摘要，供完成任务时查证资料）
  map['web.search'] = {
    id: 'web.search',
    name: '联网搜索',
    description: '联网搜索关键词并返回结构化结果（含摘要与链接），用于查证最新信息、找资料。注意：结果可能不完整，必要时再配 web.fetch 抓取原文。',
    visible: true,
    toolDef: {
      type: 'function',
      function: {
        name: 'web_search',
        description: '联网搜索关键词并返回结构化结果（含摘要与链接）。参数 query: 搜索关键词字符串。',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string', description: '要搜索的关键词' } },
          required: ['query'],
          additionalProperties: false,
        },
      },
    },
    async execute(ctx, args) {
      return await agentWebSearch(args && args.query, 5);
    },
  };
  // 网页抓取技能：Web Fetch（读取指定 URL 的纯文本正文）
  map['web.fetch'] = {
    id: 'web.fetch',
    name: '抓取网页',
    description: '抓取指定 URL 的网页正文（纯文本），用于读取搜索结果对应的原文内容。',
    visible: true,
    toolDef: {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: '抓取指定 URL 的网页正文（纯文本，去除标签）。参数 url: 以 http(s):// 开头的完整网址。',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: '要抓取的完整网页地址' } },
          required: ['url'],
          additionalProperties: false,
        },
      },
    },
    async execute(ctx, args) {
      const url = String((args && args.url) || '').trim();
      if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'url 必须是 http(s):// 开头的完整地址' };
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 XinBlog-Agent/1.0', Accept: 'text/html,text/plain' },
          redirect: 'follow',
        });
        if (!res.ok) return { ok: false, error: `请求失败 HTTP ${res.status}` };
        const text = await res.text();
        const plain = stripHtmlTags(text);
        const maxLen = 6000;
        const body = plain.length > maxLen ? plain.slice(0, maxLen) + '\n…(已截断)' : plain;
        if (!body.trim()) return { ok: false, error: '网页没有可读取的正文' };
        return { ok: true, data: { url, text: body } };
      } catch (e) {
        return { ok: false, error: '抓取失败：' + (e && e.message) };
      }
    },
  };
  agentSkillCache = map;
  return map;
}

// 移除 HTML 标签/脚本/样式，得到近似纯文本
function stripHtmlTags(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function agentSkillManifest(skills) {
  const lines = Object.values(skills)
    .filter((s) => s.visible)
    .map((s) => `- ${s.id}：${s.description}`);
  return lines.length ? lines.join('\n') : '（暂无可用技能）';
}

function extractToolCalls(result) {
  if (!result) return [];
  if (Array.isArray(result.tool_calls)) return result.tool_calls;
  if (Array.isArray(result.choices)) {
    const first = result.choices[0];
    const msg = first && (first.message || first.delta);
    if (msg && Array.isArray(msg.tool_calls)) return msg.tool_calls;
  }
  if (typeof result.output === 'string') {
    try {
      const p = JSON.parse(result.output);
      if (Array.isArray(p.tool_calls)) return p.tool_calls;
    } catch {}
  }
  return [];
}

function normalizeToolCall(tc) {
  if (!tc) return null;
  const fn = tc.function || {};
  const name = fn.name || tc.name || '';
  const id = tc.id || `call_${Math.random().toString(36).slice(2, 10)}`;
  let args = {};
  if (typeof fn.arguments === 'string') {
    try {
      args = JSON.parse(fn.arguments);
    } catch {}
  } else if (fn.arguments && typeof fn.arguments === 'object') {
    args = fn.arguments;
  }
  return { id, name, args };
}

async function executeAgentSkill(name, args, ctx, active, skills) {
  if (name === 'open_skills') {
    const ids = Array.isArray(args.ids) ? args.ids : [];
    const opened = [];
    for (const id of ids) {
      const s = skills[id];
      if (s) {
        active.add(id);
        opened.push({ id: s.id, name: s.name, description: s.description, parameters: s.toolDef.function.parameters });
      } else {
        opened.push({ id, error: '技能不存在或未注册' });
      }
    }
    return { ok: true, data: { opened, tip: '这些技能已打开，接下来可以直接调用它们完成子任务。' } };
  }
  // 模型返回的是 toolName（点被替换为 _），需反查回原始 id。
  // 硬编码技能（如 web.search → web_search）未设置 toolName，故再兜底匹配 toolDef.function.name。
  let skill = skills[name];
  if (!skill) {
    skill = Object.values(skills).find(
      (s) =>
        s.toolName === name ||
        (s.toolDef && s.toolDef.function && s.toolDef.function.name === name)
    );
  }
  if (!skill || typeof skill.execute !== 'function') return { ok: false, error: `未知技能：${name}` };
  try {
    return await skill.execute(ctx, args);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// 流式 tool_calls 增量合并：按 index 把分片 arguments/name 拼成完整调用（OpenAI 流式格式）
function mergeStreamToolCalls(acc, deltas) {
  for (const d of deltas || []) {
    const idx = d.index ?? 0;
    let cur = acc[idx];
    if (!cur) {
      cur = { id: d.id || '', type: d.type || 'function', function: { name: '', arguments: '' } };
      acc[idx] = cur;
    }
    if (d.id) cur.id = d.id;
    if (d.function && typeof d.function.name === 'string' && d.function.name) cur.function.name = d.function.name;
    if (d.function && typeof d.function.arguments === 'string') cur.function.arguments += d.function.arguments;
  }
  return acc;
}

// Agent 单轮流式生成（async generator）：逐块 yield 事件，边读边推，结束时汇总完整结果。
// - reasoning 事件：来自 delta.reasoning_content 或正文里的 <thinking>...</thinking>（真实思考，边读边发）
// - content 事件：正文文本（已剥掉思考标签），逐块发出实现打字机效果
// - done 事件：{ content, reasoning, tool_calls, usage } 完整汇总
// 兼容：自定义模型走 callCustomModelStream；内置模型走 env.AI.run({stream:true})。
// 若某模型对 stream:true 不生效（返回整段 JSON），choice.delta||choice.message 兜底也能解析出完整结果。
async function* streamAgentTurn(env, modelAlias, custom, messages, tools) {
  const decoder = new TextDecoder();
  let upstream;
  if (custom) {
    upstream = await callCustomModelStream(custom, { messages, temperature: 0.6, max_tokens: 2048, tools });
  } else {
    const model = resolveAiModel(modelAlias);
    upstream = await env.AI.run(model, { messages, temperature: 0.6, max_tokens: 2048, tools, stream: true });
  }
  const reader = upstream.getReader();

  let accContent = '';
  let accReasoning = '';
  let toolCalls = [];
  let usage = null;

  // 正文 <thinking>...</thinking> 标签剥离器（标签可能跨多个 chunk，且大小写/空格不固定），
  // 把思考文本转成 reasoning 事件；只有真正的正文才进 accContent。
  let buf = '';
  let inThink = false;
  let thinkAcc = '';
  const pending = [];
  const findOpenIdx = (s) => {
    const m = s.match(/<thinking\s*>/i);
    return m ? m.index : -1;
  };
  const findCloseIdx = (s) => {
    const m = s.match(/<\/thinking\s*>/i);
    return m ? m.index : -1;
  };
  const closeTagLen = (s) => {
    const m = s.match(/<\/thinking\s*>/i);
    return m ? m[0].length : '</thinking>'.length;
  };
  const pushText = (text) => {
    buf += text;
    while (buf.length) {
      if (!inThink) {
        const open = findOpenIdx(buf);
        if (open === -1) {
          // 正文除累积进 accContent 外，也即时以 content_delta 流式透出，
          // 让「回复正文」与「思考」一样逐字实时显示（思考走 think_delta，正文走 content_delta）
          accContent += buf;
          pending.push({ type: 'content_delta', text: buf });
          buf = '';
          break;
        }
        const head = buf.slice(0, open);
        if (head) {
          accContent += head;
          pending.push({ type: 'content_delta', text: head });
        }
        buf = buf.slice(open);
        inThink = true;
      } else {
        const close = findCloseIdx(buf);
        if (close === -1) {
          thinkAcc += buf;
          buf = '';
          break;
        }
        thinkAcc += buf.slice(0, close);
        buf = buf.slice(close + closeTagLen(buf));
        if (thinkAcc.trim()) {
          accReasoning += thinkAcc;
          pending.push({ type: 'reasoning', text: thinkAcc });
        }
        thinkAcc = '';
        inThink = false;
      }
    }
  };

  let rawLines = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    rawLines += decoder.decode(value, { stream: true });
    const lines = rawLines.split('\n');
    rawLines = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const jsonText = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      if (!jsonText || jsonText === '[DONE]') continue;
      let chunk;
      try {
        chunk = JSON.parse(jsonText);
      } catch {
        continue;
      }
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices && chunk.choices[0];
      const delta = choice && (choice.delta || choice.message);
      if (!delta) continue;
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        accReasoning += delta.reasoning_content;
        pending.push({ type: 'reasoning', text: delta.reasoning_content });
      }
      if (typeof delta.content === 'string' && delta.content) pushText(delta.content);
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
        toolCalls = mergeStreamToolCalls(toolCalls, delta.tool_calls);
      }
    }
    while (pending.length) yield pending.shift();
  }
  // 流结束：清掉未闭合 thinking 里残留的思考文本
  if (thinkAcc.trim()) {
    accReasoning += thinkAcc;
    pending.push({ type: 'reasoning', text: thinkAcc });
    thinkAcc = '';
  }
  while (pending.length) yield pending.shift();
  yield { type: 'done', content: accContent, reasoning: accReasoning, tool_calls: toolCalls, usage };
}

function describeToolData(data) {
  if (!data) return '';
  if (typeof data !== 'object') return `（${String(data).slice(0, 40)}）`;
  return `（${Object.keys(data).length} 项字段）`;
}

function summarizeToolArg(args) {
  try {
    const s = JSON.stringify(args === undefined ? {} : args);
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return String(args || '');
  }
}

function summarizeToolOutput(exec) {
  try {
    const data = exec && exec.ok ? exec.data : null;
    if (data == null) return '';
    let s = typeof data === 'string' ? data : JSON.stringify(data);
    if (!s) return '';
    if (s.length > 300) s = `${s.slice(0, 300)}…`;
    return s;
  } catch {
    return '';
  }
}

function sumUsage(acc, usage) {
  if (!usage || typeof usage !== 'object') return acc;
  const get = (k) => {
    const v = usage[k];
    return typeof v === 'number' ? v : 0;
  };
  acc.prompt += get('prompt_tokens') || get('input_tokens');
  acc.completion += get('completion_tokens') || get('output_tokens');
  acc.total += get('total_tokens') || 0;
  return acc;
}

// ---------- Agent 性格（人格提示词）----------
const AGENT_PERSONA = {
  warm: {
    name: '温柔体贴',
    block:
      '【当前性格：温柔体贴】用极其温柔、体贴、有耐心的语气说话，轻声细语、语气温馨，多表达关心与鼓励，让用户感到被照顾。规则照旧铁打不动：涉及写操作仍必须先征得用户确认。',
  },
  humorous: {
    name: '幽默风趣',
    block:
      '【当前性格：幽默风趣】轻松俏皮、妙语连珠，偶尔开个无伤大雅的小玩笑或打个生动有趣的比方，让对话不枯燥。但玩笑绝不影响准确性与纪律、不冒犯；涉及写操作的确认铁律照旧，一个都不能省。',
  },
  professional: {
    name: '严谨专业',
    block:
      '【当前性格：严谨专业】简明扼要、直奔结论，先给答案再给必要依据，用词精准克制，不废话不煽情。写操作确认从无例外，严格按流程执行。',
  },
};

// ---------- Agent 对话端点：SSE 事件流 ----------
async function aiAgent(request, env, user) {
  const enabled = await checkAiEnabled(env);
  if (!enabled) return jsonResponse(403, null, 'AI 功能已关闭', 403);

  const body = await request.json();
  // 无状态对话：前端每次携带完整历史（user/assistant），后端不保存、不建表。
  const userMessages = (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: String(m.content || '') }))
    .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'));
  if (!userMessages.length) return jsonResponse(400, null, '缺少消息', 400);
  // 前端已把全部历史发上来，无需再从云端加载会话
  const sessionMessages = [];
  const sessionTitle = null;

  const aiSettings = (await getSetting(env, 'ai')) || {};
  const modelAlias = body.model || aiSettings.model || defaultAiSettings.model;
  const mode = AGENT_PERSONA[body.mode] ? body.mode : 'warm';

  // 加载技能注册表（静态 TXT）
  let skills;
  try {
    skills = await ensureSkills(env, request);
  } catch (e) {
    skills = { app: () => null };
  }

  let systemPrompt = await loadPrompt(env, request, 'agent-core');
  if (!systemPrompt) systemPrompt = DEFAULT_PROMPTS['agent-core'] || '';
  systemPrompt = `${systemPrompt}\n\n${AGENT_PERSONA[mode].block}\n\n## 当前可用技能清单\n${agentSkillManifest(skills)}\n（需要时用 open_skills 打开技能的完整用法；普通聊天不要使用技能。）`;

  const encoder = new TextEncoder();
  const maxIters = 8;

  const readable = new ReadableStream({
    async start(controller) {
      const send = (type, data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      try {
        const custom = isCustomModel(modelAlias)
          ? await getCustomModelById(env, parseCustomModelId(modelAlias))
          : null;
        if (isCustomModel(modelAlias) && (!custom || !custom.enabled)) throw new Error('自定义模型不存在或已禁用');
        if (!custom && !env.AI) throw new Error('AI 绑定未配置');

        const historyMessages = [...sessionMessages, ...userMessages];
        // 发给模型的上下文：剥离 trail 等前端展示字段，并滤除无正文且无工具调用的纯展示条，
        // 避免把未知字段（trail/_display/updatedAt）传给第三方模型。
        const contextMessages = historyMessages
          .filter((m) =>
            m.role === 'user'
              ? m.content !== undefined
              : m.role === 'tool'
                ? !!m.tool_call_id
                : m.content !== undefined || (Array.isArray(m.tool_calls) && m.tool_calls.length)
          )
          .map((m) => {
            const out = { role: m.role };
            if (m.content !== undefined && m.content !== null) out.content = String(m.content);
            if (m.role === 'tool' && m.tool_call_id) out.tool_call_id = m.tool_call_id;
            if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) out.tool_calls = m.tool_calls;
            return out;
          });
        const messages = [
          // 权重排序：老历史在前 → 系统提示词居中 → 最新一条用户消息放最后（当前问题权重最高）
          ...contextMessages.slice(0, Math.max(0, contextMessages.length - 1)),
          { role: 'system', content: systemPrompt },
          ...contextMessages.slice(-1),
        ];
        // 初始即打开「常驻技能」（与 agent-core 提示词中的【常驻技能】清单一致）：
        // 首轮 tools 就含这些技能的 toolDef，AI 无需 open_skills 即可直接调用，省一次往返。
        // 含核心写操作（文章/评论/标签增删改）——真正执行前仍会走确认卡片，不因常驻而失去安全闸。
        const active = new Set(ALWAYS_ACTIVE_SKILLS.filter((id) => skills[id] && skills[id].visible));
        let finished = false;
        // 轮次与 token 统计
        let stats = { rounds: 0, tokens: { prompt: 0, completion: 0, total: 0 } };

        for (let it = 0; it < maxIters && !finished; it++) {
          const webSearchOn = aiSettings.webSearch === true;
          const tools = [
            OPEN_SKILLS_TOOL,
            ...[...active]
              .map((id) => (skills[id] ? skills[id].toolDef : null))
              .filter((td) => td && (webSearchOn || (td.function && td.function.name !== 'web_search' && td.function.name !== 'web_fetch'))),
          ];
          // 单轮流式生成：思考（reasoning）逐字实时推；正文缓冲到本轮结束再按用途分发，
          // 避免工具轮里的叙述被当成多条 AI 回复（叙述并入思考过程，只有最终轮正文才是回复）。
          let turnContent = '';
          let turnReasoning = '';
          let turnToolCalls = [];
          let turnUsage = null;
          for await (const evt of streamAgentTurn(env, modelAlias, custom, messages, tools)) {
            if (evt.type === 'content_delta') {
              // 回复正文逐字流式透出，随生成实时展示给用户
              send('content_delta', { text: evt.text });
            } else if (evt.type === 'reasoning') {
              turnReasoning += evt.text;
              send('think_delta', { text: evt.text });
            } else if (evt.type === 'done') {
              turnContent = evt.content || '';
              turnReasoning = evt.reasoning || '';
              turnToolCalls = evt.tool_calls || [];
              turnUsage = evt.usage || null;
            }
          }
          const content = turnContent.trim();
          stats.rounds += 1;
          stats.tokens = sumUsage(stats.tokens, turnUsage);

          const toolCalls = turnToolCalls.map(normalizeToolCall).filter(Boolean);

          if (toolCalls.length) {
            // 思考兜底（最后手段）：本轮调了工具、但既没 reasoning 也没叙述时才合成占位思考
            if (!turnReasoning.trim() && !content) {
              const fallbackThink =
                `我准备调用工具${toolCalls.map((tc) => `「${tc.name}」`).join('、')}来完成这一步：` +
                toolCalls.map((tc) => `${tc.name}(${summarizeToolArg(tc.args)})`).join('；');
              send('think_delta', { text: fallbackThink });
            }
            // assistant(tool_calls) 的 content 置 null：仅携带工具调用，不参与展示
            const assistantMsg = { role: 'assistant', content: null, tool_calls: turnToolCalls };
            messages.push(assistantMsg);
          } else {
            // 最终轮：正文即最终回答（再剥一次 thinking 标签兜底），本轮结束
            finished = true;
            break;
          }

          for (let ci = 0; ci < toolCalls.length; ci++) {
            const tc = toolCalls[ci];
            const paramsPreview = summarizeToolArg(tc.args);
            send('tool_start', { id: tc.id, name: tc.name, params: paramsPreview, idx: ci });
            let exec;
            try {
              exec = await executeAgentSkill(tc.name, tc.args, { env, request, user, send, waitWriteConfirm }, active, skills);
            } catch (e) {
              exec = { ok: false, error: e.message || String(e) };
            }
            const toolResultMsg = { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(exec) };
            messages.push(toolResultMsg);
            const summary = exec && exec.ok ? '完成' + describeToolData(exec.data) : `出错：${exec && exec.error}`;
            const output = summarizeToolOutput(exec);
            send('tool_result', {
              id: tc.id,
              name: tc.name,
              ok: !!(exec && exec.ok),
              summary,
              output,
              idx: ci,
            });
          }
        }

        if (!finished) send('error', { message: '已超过最大步骤数，请精简描述后重试' });
        send('stats', { rounds: stats.rounds, tokens: stats.tokens });
        // 无状态：对话不落库，前端自己保存本地
        send('done', {});
      } catch (err) {
        console.error('agent error:', err);
        send('error', { message: err.message || String(err) });
        send('done', {});
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
      if (!env.AI) {
        return jsonResponse(503, null, 'AI 绑定未配置', 503);
      }
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
  // 去除可能包裹的 markdown 代码块
  optimized = optimized.replace(/^```markdown\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  return jsonResponse(0, { content: optimized, model: modelAlias });
}

async function aiGenerateSummary(request, env, user) {
  const enabled = await checkAiEnabled(env);
  if (!enabled) return jsonResponse(403, null, 'AI 功能已关闭', 403);

  const body = await request.json();
  const title = String(body.title || '').trim();
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

  const systemPrompt = await loadPrompt(env, request, 'article-summary');
  // 正文过长时截断，避免超出模型上下文
  const safeContent = content.length > 12000 ? content.slice(0, 12000) : content;
  const userPrompt = `请为下面这篇文章生成摘要。\n标题：${title || '（无标题）'}\n正文：\n${safeContent}`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let summary = '';
  let actualModel = modelAlias;
  try {
    if (isCustomModel(modelAlias)) {
      const customId = parseCustomModelId(modelAlias);
      const custom = customId ? await getCustomModelById(env, customId) : null;
      if (!custom || !custom.enabled) {
        return jsonResponse(400, null, '自定义模型不存在或已禁用', 400);
      }
      const res = await callCustomModelNonStream(custom, { messages, temperature, max_tokens: maxTokens });
      summary = res.content;
      actualModel = custom.modelId;
    } else {
      if (!env.AI) {
        return jsonResponse(503, null, 'AI 绑定未配置', 503);
      }
      const model = resolveAiModel(modelAlias);
      const aiResult = await env.AI.run(model, { messages, temperature, max_tokens: maxTokens });
      summary = extractAiResponse(aiResult);
      actualModel = model;
    }
  } catch (err) {
    console.error('AI summary error:', err);
    return jsonResponse(502, { model: actualModel, error: err.message || String(err) }, `AI 摘要生成失败（模型：${actualModel}）：${err.message || String(err)}`, 502);
  }

  summary = stripThinkingTags(summary).trim();
  // 去除可能包裹的 markdown 代码块或首尾引号
  summary = summary.replace(/^```\s*/, '').replace(/\s*```$/, '').replace(/^["“'`]|["”'`]$/g, '').trim();

  return jsonResponse(0, { excerpt: summary, model: modelAlias });
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
    : Math.min(65536, Math.max(256, parsedMaxTokens));

  const options = { messages, temperature, max_tokens: maxTokens };

  // 自定义模型
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

  if (!env.AI) {
    return openaiJsonResponse({ error: { message: 'AI binding not configured', type: 'ai_error' } }, 503);
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

// ---------- 主入口 ----------

function checkEnv(env) {
  const missing = [];
  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!env.DB_USERS || typeof env.DB_USERS.prepare !== 'function') missing.push('DB_USERS binding');
  if (!env.DB_POSTS || typeof env.DB_POSTS.prepare !== 'function') missing.push('DB_POSTS binding');
  if (!env.DB_CONFIG || typeof env.DB_CONFIG.prepare !== 'function') missing.push('DB_CONFIG binding');
  if (!env.DB_MEDIA || typeof env.DB_MEDIA.prepare !== 'function') missing.push('DB_MEDIA binding');
  return missing;
}

// ---------- 短链接解析 ----------

/**
 * 解析网易云音乐分享短链接 / 任意 URL，跟随重定向后返回最终 URL。
 * 主要用于解析 163cn.tv 短链接，获取真实歌单页面地址。
 * 服务端请求不受 CORS 限制，可正常跟随重定向。
 */
async function resolveUrl(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonResponse(400, null, '缺少 url 参数');
  }
  // 只允许解析 YouTube 链接（防止滥用开放解析）
  if (!target.startsWith('https://youtu.be/') && !target.startsWith('https://www.youtube.com/')) {
    return jsonResponse(403, null, '只允许解析 YouTube 链接');
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
    // 从最终 URL 中提取歌单 ID
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

/**
 * 代理图片资源（解决跨域/CDN 域名在 PWA 中显示 URL 的问题）
 * GET /api/v1/proxy-image?url=...
 */
async function proxyImage(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonResponse(400, null, '缺少 url 参数');
  }
  // 只允许图片cdn使用，只允许http/https且是静态资源域名
  const allowedHosts = [
    'i.ytimg.com', // YouTube 封面图
    'img.youtube.com', // YouTube 封面图
    'i.imgur.com', // Imgur 图片
    'picsum.photos', // 占位图
    'images.unsplash.com', // Unsplash
  ];
  try {
    const targetUrl = new URL(target);
    if (!allowedHosts.includes(targetUrl.hostname)) {
      return jsonResponse(403, null, '只允许指定图片域名的代理');
    }
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
      // 生成"登录/权限失败"的错误帧，确保前端收到可读错误
      function rejectChatSocket(message, code = 403) {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ error: message, code }));
        pair[1].close(1011, String(code));
        return new Response(null, { status: 101, webSocket: pair[0] });
      }

      // 聊天室：同源转发给 xin--blog-chat-worker（Service Binding env.CHAT，内部调用，不出公网）
      // 浏览器只连博客同源域名，国内可访问；聊天 Worker 通过绑定被调用，无公网暴露。
      // 鉴权在 Pages 端完成：公共房（public）免鉴权；成员房（members）及自定义房（c_*）需在
      // 校验 token 后注入身份头给聊天 Worker；自定义房还会据此校验成员身份并带上人数上限。
      if (path.startsWith('/api/chat/')) {
        // 昵称查重接口：供前端在改名/进房前校验昵称是否占用注册用户名（纯 HTTP，不走 WS）
        if (path === '/api/chat/check-nickname') {
          const name = (url.searchParams.get('name') || '').trim();
          if (!name) return jsonResponse(400, null, '昵称不能为空', 400);
          const row = await env.DB_USERS.prepare('SELECT id FROM users WHERE username = ?').bind(name).first();
          if (row) return jsonResponse(409, null, '该昵称已被注册用户占用，请换一个');
          return jsonResponse(0, { ok: true }, 'ok');
        }

        if (!env.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
        const chatUrl = new URL(request.url);
        // 取到房间 key（/api/chat/room/<key>/websocket -> members/public）
        const seg = chatUrl.pathname.replace(/^\/api\/chat/, '').split('/').filter(Boolean);
        const roomKey = seg[0] === 'room' ? seg[1] : null;
        const isMembers = roomKey === ALL_USERS_CHAT_ROOM_KEY;
        const isCustom = !!roomKey && roomKey.startsWith('c_');

        // 游客房（public）昵称若命中注册用户名，握手阶段直接拒绝，保护注册账号的用户名权益。
        // 已登录用户（携带有效 token，且其用户名与昵称一致）使用自己的用户名，属于本人，不视为占用。
        let identity = null;
        let forwarded = new Request(chatUrl.toString(), request);
        if (roomKey === PUBLIC_CHAT_ROOM_KEY) {
          const guestName = (chatUrl.searchParams.get('nickname') || '').trim();
          // 先认领登录身份：已登录用户在公共房同样注入身份头，让聊天 Worker 识别"本人多端"，
          // 否则同一账号多客户端会被误判为昵称重复。此解析必须在 guestName 判断之外执行，
          // 因为登录用户进公共房时常不带 nickname（用户名走 WS 的 { name }），若只在
          // guestName 内解析，identity 恒为 null，导致身份头缺失、后端误判游客。
          const token = chatUrl.searchParams.get('token') || '';
          if (token) identity = await resolveAuthIdentity(token, env);
          if (guestName) {
            let own = false;
            if (identity && identity.username === guestName) own = true;
            if (!own) {
              const takenUser = await env.DB_USERS.prepare('SELECT id FROM users WHERE username = ?').bind(guestName).first();
              if (takenUser) return rejectChatSocket('该昵称已被注册用户占用，请换一个', 409);
            }
          }
          if (identity) {
            forwarded = new Request(chatUrl.toString(), {
              ...request,
              headers: buildAuthHeaders(request.headers, identity).mergedHeaders,
            });
          }
        }

        let maxUsers = 0;
        if (isMembers || isCustom) {
          // 成员房/自定义房：从握手 URL 提取 token 并校验，成功后注入身份头
          const token = chatUrl.searchParams.get('token') || '';
          identity = await resolveAuthIdentity(token, env);
          if (!identity) return rejectChatSocket('登录已失效，请重新登录后再进入聊天室');
          if (isCustom) {
            // 自定义房：校验该用户是否为成员，并读取人数上限
            const room = await getRoomForConnect(roomKey, identity.id, env);
            if (!room) return rejectChatSocket('房间不存在或您不在该房间成员列表中');
            maxUsers = room.max_users;
          }
          // 注入可信身份头（内部绑定调用，聊天 Worker 直接信任）
          forwarded = new Request(chatUrl.toString(), {
            ...request,
            headers: buildAuthHeaders(request.headers, identity).mergedHeaders,
          });
          if (maxUsers > 0) {
            const h = forwarded.headers;
            h.set('x-room-max-users', String(maxUsers));
            forwarded = new Request(forwarded, { headers: h });
          }
        }

        // /api/chat/room/... -> /api/room/... ，让聊天 Worker 按官方 /api/room 路由处理
        chatUrl.pathname = '/api' + chatUrl.pathname.slice('/api/chat'.length);
        forwarded = new Request(chatUrl.toString(), forwarded);
        return env.CHAT.fetch(forwarded);
      }

      // ====== 聊天图片（独立于博客媒体库，存于聊天 Worker 的 DO 内）=====
      // 读取图片：public 免鉴权；members/自定义房需登录（自定义房还需是成员）。
      // 图片 <img> 无法带自定义 header，故鉴权统一走 URL 上的 ?token=（前端渲染图片时按房间类型附带）。
      async function canViewChatRoomMedia(roomKey, req) {
        if (!env.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
        if (roomKey === PUBLIC_CHAT_ROOM_KEY) return true;
        const token = new URL(req.url).searchParams.get('token') || '';
        const identity = token ? await resolveAuthIdentity(token, env) : null;
        if (!identity) return jsonResponse(401, null, '请登录后再查看聊天图片', 401);
        if (roomKey === ALL_USERS_CHAT_ROOM_KEY) return true;
        if (roomKey.startsWith('c_')) {
          const room = await getRoomForConnect(roomKey, identity.id, env);
          return room ? true : jsonResponse(403, null, '您不在该房间成员列表中', 403);
        }
        return true;
      }
      // 上传图片：仅登录用户；自定义房校验成员身份。
      async function chatUploadMedia(req, env2, user) {
        if (!env2.CHAT) return jsonResponse(500, null, '聊天服务未绑定（env.CHAT）', 500);
        const key = (new URL(req.url).searchParams.get('room') || PUBLIC_CHAT_ROOM_KEY).trim();
        const identity = await resolveAuthIdentity(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '', env2);
        const uid = (identity && identity.id) || user.id;
        if (key.startsWith('c_')) {
          const room = await getRoomForConnect(key, uid, env2);
          if (!room) return jsonResponse(403, null, '您不在该房间成员列表中', 403);
        }
        let body;
        try { body = await req.json(); } catch (e) { return jsonResponse(400, null, '请求体不是合法 JSON', 400); }
        const upstream = await env2.CHAT.fetch(buildChatSubUrl(key, '/media'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const text = await upstream.text();
        return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
      }

      if (method === 'GET' && path.match(/^\/api\/v1\/chat\/media\/[^/]+\/[^/]+$/)) {
        // path = /api/v1/chat/media/<roomKey>/<id>
        const seg = path.split('/');
        const roomKey = seg[5];
        const id = seg[6];
        const ok = await canViewChatRoomMedia(roomKey, request);
        if (ok !== true) return ok;
        const upstream = await env.CHAT.fetch(buildChatSubUrl(roomKey, '/media/' + id), { method: 'GET' });
        return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'image/jpeg', 'cache-control': upstream.headers.get('cache-control') || 'private, max-age=86400' } });
      }
      if (method === 'POST' && path === '/api/v1/chat/media/upload') {
        return await requireAuth(request, env, chatUploadMedia);
      }

      // OpenAI 兼容接口（标准路径 /v1/*，供外部客户端直接以域名作为 base URL 调用）
      if (method === 'GET' && path === '/v1/models') return await openaiModels(request, env);
      if (method === 'POST' && path === '/v1/chat/completions') return await openaiChatCompletions(request, env);
      if (method === 'POST' && path === '/v1/embeddings') return await openaiEmbeddings(request, env);

      // 初始化
      if (method === 'POST' && path === '/api/v1/setup') return await setup(env);

      // 公开接口
      if (method === 'GET' && path === '/api/v1/site') return await getSiteConfig(env);
      if (method === 'GET' && path === '/manifest.json') return await getManifest(env, request.url);
      if (method === 'GET' && path === '/api/v1/posts') return await listPosts(env, url);

      // 短链接解析（无需认证，用于解析网易云分享短链接 163cn.tv）
      if (method === 'GET' && path === '/api/v1/resolve-url') return await resolveUrl(request);

      // 图片代理（解决跨域/CDN 域名在 PWA 中显示 URL 的问题）
      if (method === 'GET' && path === '/api/v1/proxy-image') return await proxyImage(request);

      // 文章评论/点赞（需在通用 getPost 之前匹配）
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

      // 友链公开接口
      if (method === 'GET' && path === '/api/v1/friends') return await listFriends(env);
      // 友链申请（需登录）
      if (method === 'POST' && path === '/api/v1/friends/apply') return await requireAuth(request, env, applyFriend);
      // 我的友链申请记录（需登录）
      if (method === 'GET' && path === '/api/v1/friends/applications/my') return await requireAuth(request, env, listMyFriendApplications);

      // 认证接口
      if (method === 'POST' && path === '/api/v1/auth/register') return await register(request, env);
      if (method === 'POST' && path === '/api/v1/auth/login') return await login(request, env);
      if (method === 'POST' && path === '/api/v1/auth/refresh') return await refreshToken(request, env);
      if (method === 'POST' && path === '/api/v1/auth/logout') return await logout(request, env);
      if (method === 'GET' && path === '/api/v1/auth/me') return await requireAuth(request, env, getMe);
      if (method === 'POST' && path === '/api/v1/auth/verify-code') return await sendVerifyCode(request, env);
      if (method === 'POST' && path === '/api/v1/auth/forgot-code') return await sendForgotCode(request, env);
      if (method === 'POST' && path === '/api/v1/auth/reset-password') return await resetPassword(request, env);

      // 人机验证（公开配置 + 算术题）
      if (method === 'GET' && path === '/api/v1/auth/captcha/config') return await getCaptchaConfig(request, env);
      if (method === 'POST' && path === '/api/v1/auth/captcha/math') return await issueMathCaptcha(request, env);

      // 站点公开设置
      if (method === 'GET' && path === '/api/v1/settings/auth') return await getAuthSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/email') return await getEmailSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/email-template') return await getEmailTemplateSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/interaction') return await getInteractionSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/message-wall') return await getMessageWallSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/chat') return await getChatSettings(request, env);
      if (method === 'GET' && path === '/api/v1/settings/agent') return await getAgentSettings(request, env);

      // 自定义聊天房：当前登录用户可见的房间列表
      if (method === 'GET' && path === '/api/v1/chat/my-rooms') return await requireAuth(request, env, listMyChatRooms);

      // 留言墙公开接口
      if (method === 'GET' && path === '/api/v1/messages/my') return await requireAuth(request, env, listMyMessages);
      if (method === 'GET' && path === '/api/v1/messages') return await listMessages(env, url);
      if (method === 'POST' && path === '/api/v1/messages') {
        const user = await getCurrentUser(request, env);
        return await createMessage(request, env, user);
      }
      if (method === 'DELETE' && path.match(/^\/api\/v1\/messages\/\d+$/)) return await requireAuth(request, env, deleteMessage);

      // 用户个人设置（主题/UI 等）
      if (method === 'GET' && path === '/api/v1/user/settings') return await requireAuth(request, env, getUserSettings);
      if (method === 'PATCH' && path === '/api/v1/user/settings') return await requireAuth(request, env, updateUserSettings);
      // 修改登录账号密码（需登录）
      if (method === 'POST' && path === '/api/v1/user/change-password') return await requireAuth(request, env, changePassword);

      // 管理接口
      if (method === 'GET' && path === '/api/v1/admin/dashboard') return await requireAdmin(request, env, getDashboard);
      // 文章：管理员可写/可改/可发布，仅站主可删除
      if (method === 'GET' && path === '/api/v1/admin/posts') return await requireAdmin(request, env, listAdminPosts);
      if (method === 'GET' && path.startsWith('/api/v1/admin/posts/')) return await requireAdmin(request, env, getAdminPost);
      if (method === 'POST' && path === '/api/v1/admin/posts') return await requireAdmin(request, env, createPost);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/posts/')) return await requireAdmin(request, env, updatePost);
      if (method === 'DELETE' && path.startsWith('/api/v1/admin/posts/')) return await requireSuperAdmin(request, env, deletePost);
      // 标签
      if (method === 'GET' && path === '/api/v1/admin/tags') return await requireAdmin(request, env, listAdminTags);
      if (method === 'POST' && path === '/api/v1/admin/tags') return await requireAdmin(request, env, createTag);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/tags/')) return await requireAdmin(request, env, updateTag);
      if (method === 'DELETE' && path.startsWith('/api/v1/admin/tags/')) return await requireSuperAdmin(request, env, deleteTag);
      // 站点配置通用保存接口（协议/外观/主题等共用），仅站主
      if (method === 'PATCH' && path === '/api/v1/admin/settings') return await requireSuperAdmin(request, env, updateSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/auth') return await requireSuperAdmin(request, env, getAuthSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/auth') return await requireSuperAdmin(request, env, updateAuthSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/email') return await requireSuperAdmin(request, env, getEmailSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/email') return await requireSuperAdmin(request, env, updateEmailSettings);
      if (method === 'GET' && path === '/api/v1/admin/settings/email-template') return await requireSuperAdmin(request, env, getEmailTemplateSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/email-template') return await requireSuperAdmin(request, env, updateEmailTemplateSettings);
      // 评论通知：管理页可读，仅站主可改
      if (method === 'GET' && path === '/api/v1/admin/settings/comment-notify') return await requireAdmin(request, env, getCommentNotifySettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/comment-notify') return await requireSuperAdmin(request, env, updateCommentNotifySettings);
      // 互动设置：仅站主
      if (method === 'GET' && path === '/api/v1/admin/settings/interaction') return await requireSuperAdmin(request, env, getInteractionSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/interaction') return await requireSuperAdmin(request, env, updateInteractionSettings);
      // 留言墙设置：管理页可读，仅站主可改
      if (method === 'GET' && path === '/api/v1/admin/settings/message-wall') return await requireAdmin(request, env, getMessageWallSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/message-wall') return await requireSuperAdmin(request, env, updateMessageWallSettings);
      // 聊天室设置：管理页可读，仅站主可改
      if (method === 'GET' && path === '/api/v1/admin/settings/chat') return await requireAdmin(request, env, getChatSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/chat') return await requireSuperAdmin(request, env, updateChatSettings);
      // 自定义房间管理：管理员可增/改/列表/搜索成员，仅站主可删
      if (method === 'GET' && path === '/api/v1/admin/chat/rooms') return await requireAdmin(request, env, listAdminChatRooms);
      if (method === 'GET' && path === '/api/v1/admin/chat/rooms/search-users') return await requireAdmin(request, env, searchRoomUsers);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/chat\/rooms\/[^/]+\/members$/)) return await requireAdmin(request, env, getAdminChatRoomMembers);
      if (method === 'POST' && path === '/api/v1/admin/chat/rooms') return await requireAdmin(request, env, createChatRoom);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/chat\/rooms\/[^/]+$/)) return await requireAdmin(request, env, updateChatRoom);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/chat\/rooms\/[^/]+$/)) return await requireSuperAdmin(request, env, deleteChatRoom);
      // 聊天 DO 数据（存储于聊天 Worker 的 Durable Object，独立于博客媒体库）
      if (method === 'GET' && path === '/api/v1/admin/chat/do/overview') return await requireAdmin(request, env, adminChatDoOverview);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/chat\/do\/media\/[^/]+$/)) return await requireAdmin(request, env, adminListChatMedia);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/chat\/do\/media\/[^/]+\/[^/]+$/)) return await requireAdmin(request, env, adminDeleteChatMedia);
      // 留言墙管理：管理员可审阅/同意/隐藏，仅站主可删除
      if (method === 'GET' && path === '/api/v1/admin/messages') return await requireAdmin(request, env, listAdminMessages);
      if (method === 'PATCH' && path === '/api/v1/admin/messages/batch') return await requireAdmin(request, env, updateAdminMessagesBatch);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/messages\/\d+$/)) return await requireAdmin(request, env, updateAdminMessage);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/messages\/\d+$/)) return await requireSuperAdmin(request, env, deleteAdminMessage);
      // 评论管理：管理员可审核，仅站主可删除
      if (method === 'GET' && path === '/api/v1/admin/comments') return await requireAdmin(request, env, listAdminComments);
      if (method === 'PATCH' && path === '/api/v1/admin/comments/batch') return await requireAdmin(request, env, updateAdminCommentsBatch);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/comments\/\d+$/)) return await requireAdmin(request, env, updateAdminComment);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/comments\/\d+$/)) return await requireSuperAdmin(request, env, deleteAdminComment);
      // 用户管理：仅站主（列表/改角色/禁删）
      if (method === 'GET' && path === '/api/v1/admin/users') return await requireSuperAdmin(request, env, listAdminUsers);
      if (method === 'PATCH' && path.startsWith('/api/v1/admin/users/')) return await requireSuperAdmin(request, env, updateAdminUser);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/users\/\d+$/)) return await requireSuperAdmin(request, env, deleteAdminUser);

      // 友链管理：管理员可增/改，仅站主可删
      if (method === 'GET' && path === '/api/v1/admin/friends') return await requireAdmin(request, env, listAdminFriends);
      if (method === 'POST' && path === '/api/v1/admin/friends') return await requireAdmin(request, env, createFriend);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/friends\/\d+$/)) return await requireAdmin(request, env, updateFriend);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/friends\/\d+$/)) return await requireSuperAdmin(request, env, deleteFriend);
      // 友链申请：管理员可通过，仅站主可拒绝/删除
      if (method === 'GET' && path === '/api/v1/admin/friends/applications') return await requireAdmin(request, env, listFriendApplications);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/friends\/applications\/\d+$/)) return await requireAdmin(request, env, auditFriendApplication);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/friends\/applications\/\d+$/)) return await requireSuperAdmin(request, env, deleteFriendApplication);

      // 媒体：管理员可上传/改，仅站主可删
      if (method === 'GET' && path === '/api/v1/admin/media') return await requireAdmin(request, env, listAdminMedia);
      if (method === 'GET' && path === '/api/v1/admin/media/usage') return await requireAdmin(request, env, getAdminMediaUsage);
      if (method === 'GET' && path === '/api/v1/admin/media/usage/detail') return await requireAdmin(request, env, getAdminMediaUsageDetail);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireAdmin(request, env, getAdminMedia);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireAdmin(request, env, updateAdminMedia);
      if (method === 'POST' && path === '/api/v1/admin/media/upload') return await requireAdmin(request, env, uploadMedia);
      if (method === 'POST' && path === '/api/v1/admin/media/init') return await requireAdmin(request, env, initMediaUpload);
      if (method === 'POST' && path.startsWith('/api/v1/admin/media/chunk/')) return await requireAdmin(request, env, uploadMediaChunk);
      if (method === 'POST' && path.startsWith('/api/v1/admin/media/finalize/')) return await requireAdmin(request, env, finalizeMediaUpload);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/media\/\d+$/)) return await requireSuperAdmin(request, env, deleteMedia);

      // 系统/数据库管理接口（仅站主）
      if (method === 'GET' && path === '/api/v1/admin/system/databases') return await requireSuperAdmin(request, env, listDatabases);
      if (method === 'GET' && path === '/api/v1/admin/system/status') return await requireSuperAdmin(request, env, getSystemStatus);

      // AI：写作工具（模型列表/生成/润色/总结/对话）管理员可用；配置/API Key/自定义模型仅站主
      if (method === 'GET' && path === '/api/v1/admin/settings/ai') return await requireAdmin(request, env, getAiSettings);
      if (method === 'PATCH' && path === '/api/v1/admin/settings/ai') return await requireSuperAdmin(request, env, updateAiSettings);
      if (method === 'GET' && path === '/api/v1/admin/ai/models') return await requireAdmin(request, env, listAdminAiModels);
      if (method === 'POST' && path === '/api/v1/admin/ai/generate') return await requireAdmin(request, env, aiGeneratePost);
      if (method === 'POST' && path === '/api/v1/admin/ai/format') return await requireAdmin(request, env, aiFormatOptimize);
      if (method === 'POST' && path === '/api/v1/admin/ai/summary') return await requireAdmin(request, env, aiGenerateSummary);
      if (method === 'POST' && path === '/api/v1/admin/ai/chat') return await requireAdmin(request, env, aiChat);
      if (method === 'POST' && path === '/api/v1/admin/ai/agent') return await requireAdmin(request, env, aiAgent);
      // 写操作确认：唤醒挂起的 AI 轮次（同一流继续）
      if (method === 'POST' && path === '/api/v1/admin/ai/agent/confirm') return await requireAdmin(request, env, confirmWriteAction);
      // AI 写操作回滚：仅本人可回滚，24 小时内有效
      if (method === 'POST' && path === '/api/v1/admin/ai/agent/undo') return await requireAdmin(request, env, undoAgentWrite);
      // 管理后台回滚管理：查询所有记录（跨设备）、站长回滚任意记录、删除记录
      if (method === 'GET' && path === '/api/v1/admin/ai/agent/undo/list') return await requireSuperAdmin(request, env, listUndoLogs);
      if (method === 'POST' && path.match(/^\/api\/v1\/admin\/ai\/agent\/undo\/[^/]+$/)) return await requireSuperAdmin(request, env, undoAgentWriteAdmin);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/ai\/agent\/undo\/[^/]+$/)) return await requireSuperAdmin(request, env, deleteUndoLog);
      if (method === 'GET' && path === '/api/v1/admin/ai/keys') return await requireSuperAdmin(request, env, listAiApiKeys);
      if (method === 'POST' && path === '/api/v1/admin/ai/keys') return await requireSuperAdmin(request, env, createAiApiKey);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/ai\/keys\/\d+$/)) return await requireSuperAdmin(request, env, deleteAiApiKey);
      if (method === 'GET' && path === '/api/v1/admin/ai/custom-models') return await requireSuperAdmin(request, env, listAiCustomModels);
      if (method === 'POST' && path === '/api/v1/admin/ai/custom-models') return await requireSuperAdmin(request, env, createAiCustomModel);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/ai\/custom-models\/\d+$/)) return await requireSuperAdmin(request, env, updateAiCustomModel);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/ai\/custom-models\/\d+$/)) return await requireSuperAdmin(request, env, deleteAiCustomModelHandler);

      // 主题管理接口（仅站主）
      if (method === 'GET' && path === '/api/v1/admin/themes') return await requireSuperAdmin(request, env, listAdminThemes);
      if (method === 'GET' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireSuperAdmin(request, env, getAdminTheme);
      if (method === 'POST' && path === '/api/v1/admin/themes') return await requireSuperAdmin(request, env, createAdminTheme);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+\/apply$/)) return await requireSuperAdmin(request, env, applyAdminTheme);
      if (method === 'PATCH' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireSuperAdmin(request, env, updateAdminTheme);
      if (method === 'DELETE' && path.match(/^\/api\/v1\/admin\/themes\/[^/]+$/)) return await requireSuperAdmin(request, env, deleteAdminTheme);
      if (method === 'POST' && path === '/api/v1/admin/themes/clear-active') return await requireSuperAdmin(request, env, clearAdminActiveTheme);

      // OpenAI 兼容接口（供外部工具通过 API Key 调用）
      if (method === 'GET' && path === '/api/v1/ai/v1/models') return await openaiModels(request, env);
      if (method === 'POST' && path === '/api/v1/ai/v1/chat/completions') return await openaiChatCompletions(request, env);
      if (method === 'POST' && path === '/api/v1/ai/v1/embeddings') return await openaiEmbeddings(request, env);

      // 短链分享（方案 A：零数据库，短码 = base64url(slug)）：解出 slug 后 302 重定向到 /post/{slug}
      if (method === 'GET' && path.startsWith('/s/')) {
        const code = path.slice('/s/'.length).split('/')[0];
        if (code) {
          try {
            const slug = base64UrlDecode(code);
            if (/^[\w-]+$/.test(slug)) {
              return new Response(null, {
                status: 302,
                headers: {
                  Location: `/post/${slug}`,
                  'Cache-Control': 'public, max-age=300',
                },
              });
            }
          } catch {
            // 解码失败，落到下方 404
          }
        }
        return jsonResponse(404, null, '短链不存在', 404);
      }

      // 静态资源与 SPA 页面：注入站点分享 meta 后返回
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
      // 仅把真正的绑定缺失/类型错误归类为 D1 绑定异常，避免 SQL 执行错误被误报
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
