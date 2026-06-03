-- Mở rộng auth nội bộ, không xóa user cũ.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE users SET role = 'system_admin', is_system = TRUE, active = TRUE, must_change_password = TRUE WHERE username = 'admin';
UPDATE users SET role = 'member' WHERE role NOT IN ('system_admin', 'parent', 'member');

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('system_admin', 'parent', 'member'));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

INSERT INTO users (username, display_name, password_hash, role, active, must_change_password, is_system)
VALUES ('admin', 'Quản trị hệ thống', '$2b$12$VfnfJqt/SaUpO1al7Q/0ROkbgdHFkvp5syBY7g3uXsXFmX/fXUy6m', 'system_admin', TRUE, TRUE, TRUE)
ON CONFLICT (username) DO UPDATE SET role = 'system_admin', active = TRUE, is_system = TRUE;
