ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES comments(id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);