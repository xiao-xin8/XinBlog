CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('site', '{"title":"我的个人博客","subtitle":"在时光中相遇，传递温暖话语","author":"星语","siteName":"XinBlog","shareDescription":"一个记录生活、设计与技术感悟的个人博客","themeColor":"#5b7cfa","language":"zh-CN","postLayout":"grid","footerText":"在时光中相遇，传递温暖话语","paginationMode":"load-more","pageSize":9,"theme":{"presetId":"default","useCustomColors":false,"customColors":{"primary":"#5b7cfa","primaryLight":"#8aa4ff","primaryDark":"#3d5bd9","secondary":"#ff8fb1","secondaryLight":"#ffc1d6","secondaryDark":"#c75b82"},"borderRadius":16},"cardTheme":{"variant":"default","layout":"clean","showExcerpt":true,"showTags":true,"showMeta":true},"sceneTheme":{"variant":"default"}}', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('hero', '{"enabled":true,"title":"我的个人博客","subtitle":"在时光中相遇，传递温暖话语","badge":"欢迎来访"}', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('about', '{"subtitle":"关于我","bio":"热爱生活，喜欢设计与技术，在这里记录点滴感悟。","tags":["生活","设计","技术"]}', datetime('now'));
INSERT OR IGNORE INTO system (key, value, updated_at) VALUES
('version', '1.0.0', datetime('now')),
('initialized', '0', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('interaction', '{"commentsEnabled":true,"likesEnabled":true,"commentAudit":true}', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('email_subject', '您的注册验证码', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('email_html', '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>注册验证码</title></head><body style="margin:0;padding:0;background-color:#f5f7ff;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7ff;padding:40px 0;"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(91,124,250,0.12);"><tr><td style="padding:40px 32px 32px;text-align:center;"><h1 style="margin:0 0 8px;font-size:22px;color:#1a1a2e;font-weight:700;">{{siteName}}</h1><p style="margin:0;font-size:14px;color:#6b7280;">{{siteTitle}}</p></td></tr><tr><td style="padding:0 32px 32px;"><p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">您好，<strong>{{username}}</strong>：</p><p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">感谢您注册 {{siteName}}，请在 {{expireMinutes}} 分钟内使用以下验证码完成注册：</p><div style="text-align:center;padding:24px 0;"><table cellpadding="0" cellspacing="0" border="0" bgcolor="#5b7cfa" style="background-color:#5b7cfa;border-radius:12px;display:inline-block;"><tr><td style="padding:16px 32px;text-align:center;"><span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#ffffff;line-height:1;">{{code}}</span></td></tr></table></div><p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">如果这不是您本人的操作，请忽略此邮件。验证码仅用于注册验证，请勿泄露给他人。</p></td></tr><tr><td style="padding:20px 32px;background-color:#f8fafc;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;">本邮件由 {{siteName}} 自动发送</p></td></tr></table></td></tr></table></body></html>', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('email_text', '您好，{{username}}：感谢您注册 {{siteName}}，验证码是 {{code}}，{{expireMinutes}} 分钟内有效。如非本人操作请忽略。', datetime('now'));
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_friends_sort ON friends(sort_order DESC, created_at DESC);
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_hash ON ai_api_keys(key_hash);
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('friends', '{"enabled":false,"title":"友链","subtitle":"在时光中相遇，结识志同道合的朋友","cardStyle":"standard","cardColor":"","avatarShape":"rounded","showDescription":true}', datetime('now'));
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('ai', '{"enabled":false,"model":"llama-3.3-70b","imageModel":"flux-1-schnell","temperature":0.7,"maxTokens":2048}', datetime('now'));
CREATE TABLE IF NOT EXISTS ai_custom_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_custom_models_enabled ON ai_custom_models(enabled);
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_hash ON ai_api_keys(key_hash);
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('active_theme', '""', datetime('now'));