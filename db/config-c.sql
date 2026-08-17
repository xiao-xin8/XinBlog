CREATE TABLE IF NOT EXISTS message_wall (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  nickname TEXT,
  user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_wall_status ON message_wall(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_wall_user ON message_wall(user_id);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
('message_wall', '{"enabled":false,"allowAnonymous":true,"auditEnabled":false,"defaultStyle":"danmaku"}', datetime('now'));
