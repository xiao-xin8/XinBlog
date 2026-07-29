CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_base64 TEXT,
  author_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  views INTEGER NOT NULL DEFAULT 0,
  reading_time INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT
);
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
INSERT OR IGNORE INTO tags (id, name, slug, color) VALUES
(1, '生活', 'life', '#5b7cfa'),
(2, '设计', 'design', '#ff8fb1'),
(3, '技术', 'tech', '#10b981');
INSERT OR IGNORE INTO posts (id, title, slug, excerpt, content, cover_base64, author_id, status, views, reading_time, created_at, updated_at) VALUES
(1, '欢迎来到 XinBlog', 'welcome-to-xinblog', '这是 XinBlog 的示例文章，点击阅读更多内容。', '欢迎来到 XinBlog！这是一个开源的个人博客系统，你可以在这里记录生活、分享设计与技术感悟。祝你写作愉快！', '', 1, 'published', 0, 1, datetime('now'), datetime('now'));
INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES
(1, 1),
(1, 3);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post_status ON comments(post_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);