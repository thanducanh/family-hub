-- Liên kết duy nhất giữa tài khoản đăng nhập và hồ sơ thành viên.

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_member_id_unique ON users (member_id) WHERE member_id IS NOT NULL;
