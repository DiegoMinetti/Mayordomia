-- 003-magic-link.sql
-- Magic-link sign-in: a single-use, short-lived token emailed to the user
-- that exchanges for a session. PR 5.

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token_hash TEXT PRIMARY KEY,                 -- sha256 hex of the opaque token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_magic_link_user ON magic_link_tokens(user_id);
