PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  access_sub TEXT UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_payload_schema_version INTEGER NOT NULL CHECK (current_payload_schema_version > 0),
  max_payload_bytes INTEGER NOT NULL DEFAULT 20971520 CHECK (max_payload_bytes > 0),
  retention_versions INTEGER NOT NULL DEFAULT 50 CHECK (retention_versions > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_memberships (
  app_id TEXT NOT NULL REFERENCES apps(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'readonly')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (app_id, user_id)
);

CREATE TABLE IF NOT EXISTS app_sync (
  app_id TEXT NOT NULL REFERENCES apps(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL CHECK (version > 0),
  base_version INTEGER NOT NULL CHECK (base_version >= 0),
  commit_id TEXT NOT NULL,
  payload_schema_version INTEGER NOT NULL CHECK (payload_schema_version > 0),
  object_key TEXT NOT NULL UNIQUE,
  object_etag TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  payload_bytes INTEGER NOT NULL CHECK (payload_bytes > 0),
  payload_encoding TEXT NOT NULL CHECK (payload_encoding IN ('identity', 'gzip')),
  payload_encryption TEXT NOT NULL CHECK (payload_encryption IN ('none', 'aes-256-gcm')),
  device_id TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (app_id, user_id, version),
  UNIQUE (app_id, user_id, commit_id)
);

CREATE INDEX IF NOT EXISTS idx_app_memberships_user
  ON app_memberships(user_id, app_id);
CREATE INDEX IF NOT EXISTS idx_app_sync_latest
  ON app_sync(app_id, user_id, deleted_at, version DESC);
CREATE INDEX IF NOT EXISTS idx_app_sync_commit
  ON app_sync(app_id, user_id, commit_id);
CREATE INDEX IF NOT EXISTS idx_app_sync_cleanup
  ON app_sync(deleted_at, created_at);
