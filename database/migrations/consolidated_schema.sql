-- Base tables creation for clean databases (so migrations 001-018 alter/update statements run successfully)
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completed BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- MIGRATION: 001_extend_existing_schema.sql
-- ==========================================

-- Chạy migration này trên database family_management trước khi dùng API mới.
-- Chỉ bổ sung cột còn thiếu, không xóa hoặc ghi đè dữ liệu hiện có.

ALTER TABLE members ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS color VARCHAR(32) NOT NULL DEFAULT '#fb7185';

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category VARCHAR(128) NOT NULL DEFAULT 'Khác';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'todo';

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type VARCHAR(16) NOT NULL DEFAULT 'expense';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date DATE;

ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS color VARCHAR(32) NOT NULL DEFAULT '#60a5fa';

ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT '';

-- Backfill model UI từ schema NAS cũ mà không xóa dữ liệu nguồn.
UPDATE events SET date = event_date::date WHERE date IS NULL;
UPDATE events SET time = event_date::time WHERE time IS NULL;
UPDATE tasks SET due = due_date::text WHERE due = '' AND due_date IS NOT NULL;
UPDATE tasks SET status = CASE WHEN completed THEN 'done' ELSE 'todo' END WHERE status = 'todo';
UPDATE transactions SET title = note WHERE title = '' AND note IS NOT NULL;
UPDATE transactions SET date = created_at::date WHERE date IS NULL AND created_at IS NOT NULL;
UPDATE notes SET updated_at = created_at::text WHERE updated_at = '' AND created_at IS NOT NULL;


-- ==========================================
-- MIGRATION: 002_extend_members_profile.sql
-- ==========================================

-- Bổ sung nickname cho hồ sơ thành viên, không xóa dữ liệu cũ.

ALTER TABLE members ADD COLUMN IF NOT EXISTS nickname VARCHAR(128) NOT NULL DEFAULT '';


-- ==========================================
-- MIGRATION: 003_create_users.sql
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin hệ thống được seed trong migration 005 sau khi role system_admin tồn tại.


-- ==========================================
-- MIGRATION: 004_standardize_family_product.sql
-- ==========================================

-- Bổ sung liên kết thành viên và field nghiệp vụ, không xóa dữ liệu cũ.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date_ui DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'normal';

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id UUID;

ALTER TABLE events ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS type VARCHAR(32) NOT NULL DEFAULT 'family';

ALTER TABLE notes ADD COLUMN IF NOT EXISTS member_id UUID;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'general';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tag VARCHAR(64) NOT NULL DEFAULT '';


-- ==========================================
-- MIGRATION: 005_auth_users_permissions.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 006_create_password_reset_requests.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username_or_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx
  ON password_reset_requests (status, requested_at DESC);


-- ==========================================
-- MIGRATION: 007_members_permissions_profile.sql
-- ==========================================

-- Liên kết duy nhất giữa tài khoản đăng nhập và hồ sơ thành viên.

ALTER TABLE users ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_member_id_unique ON users (member_id) WHERE member_id IS NOT NULL;


-- ==========================================
-- MIGRATION: 008_system_access_roles.sql
-- ==========================================

-- Tách quyền hệ thống khỏi vai vế gia đình, không xóa dữ liệu cũ.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'full_access' WHERE role IN ('system_admin', 'parent', 'admin');
UPDATE users SET role = 'self_only' WHERE role = 'member';
UPDATE users SET role = 'self_only' WHERE role NOT IN ('full_access', 'self_only');

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('full_access', 'self_only'));

UPDATE users SET role = 'full_access', is_system = TRUE, active = TRUE WHERE username = 'admin';


-- ==========================================
-- MIGRATION: 009_change_member_avatar_to_text.sql
-- ==========================================

ALTER TABLE members ALTER COLUMN avatar TYPE TEXT;
ALTER TABLE members ALTER COLUMN notes TYPE TEXT;
ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;


-- ==========================================
-- MIGRATION: 010_soft_delete_members.sql
-- ==========================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- ==========================================
-- MIGRATION: 011_timetree_calendars.sql
-- ==========================================

-- Lịch nhiều lớp kiểu TimeTree. Chỉ bổ sung schema và giữ nguyên dữ liệu cũ.
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  color VARCHAR(32) NOT NULL DEFAULT '#6366f1',
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  type VARCHAR(32) NOT NULL DEFAULT 'other',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO calendars (id, name, color, owner_user_id, visible, type)
SELECT '00000000-0000-4000-8000-00000000ca11', 'Lịch gia đình', '#6366f1', id, TRUE, 'family'
FROM users
ORDER BY is_system DESC, created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS repeat_rule TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lunar_date TEXT;

UPDATE events
SET calendar_id = '00000000-0000-4000-8000-00000000ca11'
WHERE calendar_id IS NULL
  AND EXISTS (SELECT 1 FROM calendars WHERE id = '00000000-0000-4000-8000-00000000ca11');
UPDATE events SET start_date = COALESCE(date, event_date::date) WHERE start_date IS NULL;
UPDATE events SET end_date = COALESCE(date, event_date::date) WHERE end_date IS NULL;
UPDATE events SET start_time = COALESCE(time, event_date::time) WHERE start_time IS NULL;

CREATE TABLE IF NOT EXISTS event_members (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

INSERT INTO event_members (event_id, member_id)
SELECT id, member_id FROM events WHERE member_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ==========================================
-- MIGRATION: 012_calendar_users_event_label.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS calendar_users (
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL DEFAULT 'view',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (calendar_id, user_id)
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS label_color VARCHAR(32);

INSERT INTO calendar_users (calendar_id, user_id, permission)
SELECT id, owner_user_id, 'edit' FROM calendars WHERE owner_user_id IS NOT NULL
ON CONFLICT (calendar_id, user_id) DO UPDATE SET permission = 'edit';


-- ==========================================
-- MIGRATION: 013_create_bank_accounts.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  card_number TEXT NOT NULL DEFAULT '',
  card_type TEXT NOT NULL DEFAULT 'Tài khoản nhận lương',
  branch TEXT NOT NULL DEFAULT '',
  expiry_month TEXT NOT NULL DEFAULT '',
  expiry_year TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Đang dùng',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_member_id ON bank_accounts(member_id);


-- ==========================================
-- MIGRATION: 014_extend_bank_accounts_benefits_transactions.sql
-- ==========================================

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'Tài khoản nhận lương';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS card_network TEXT NOT NULL DEFAULT 'NAPAS';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS statement_day TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS due_day TEXT NOT NULL DEFAULT '';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_waiver_type TEXT NOT NULL DEFAULT 'Không có';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_waiver_target NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_cycle TEXT NOT NULL DEFAULT 'năm';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_cycle_start DATE;

UPDATE bank_accounts SET account_type = card_type WHERE account_type = 'Tài khoản nhận lương' AND card_type <> '';

CREATE TABLE IF NOT EXISTS bank_card_benefits (
  id UUID PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Khác',
  benefit_type TEXT NOT NULL DEFAULT 'Hoàn tiền %',
  benefit_value NUMERIC NOT NULL DEFAULT 0,
  monthly_cap NUMERIC NOT NULL DEFAULT 0,
  min_transaction_amount NUMERIC NOT NULL DEFAULT 0,
  condition_note TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_card_benefits_bank_account_id ON bank_card_benefits(bank_account_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS estimated_cashback NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS actual_cashback NUMERIC NOT NULL DEFAULT 0;


-- ==========================================
-- MIGRATION: 015_make_bank_credit_fields_nullable.sql
-- ==========================================

ALTER TABLE bank_accounts
  ALTER COLUMN account_number DROP NOT NULL,
  ALTER COLUMN card_number DROP NOT NULL,
  ALTER COLUMN branch DROP NOT NULL,
  ALTER COLUMN statement_day DROP NOT NULL,
  ALTER COLUMN due_day DROP NOT NULL,
  ALTER COLUMN credit_limit DROP NOT NULL;


-- ==========================================
-- MIGRATION: 016_create_bank_raw_notes.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS bank_raw_notes (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'Khác',
  raw_text TEXT NOT NULL DEFAULT '',
  effective_date DATE,
  expiry_date DATE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_raw_notes_member_id ON bank_raw_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_bank_raw_notes_bank_account_id ON bank_raw_notes(bank_account_id);


-- ==========================================
-- MIGRATION: 017_extend_bank_raw_notes_extraction.sql
-- ==========================================

ALTER TABLE bank_raw_notes
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_json JSONB;


-- ==========================================
-- MIGRATION: 018_bank_card_rewards_manual.sql
-- ==========================================

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS annual_fee_current_spending NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bank_card_rewards (
  id UUID PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL DEFAULT 'Hoàn tiền',
  title TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  points NUMERIC NOT NULL DEFAULT 0,
  recorded_at DATE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_card_rewards_bank_account_id ON bank_card_rewards(bank_account_id);


-- ==========================================
-- MIGRATION: 019_cleanup_demo_data.sql
-- ==========================================

-- Dọn dẹp dữ liệu mẫu Minh, Hana, An
DELETE FROM event_members WHERE member_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM tasks WHERE id IN ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013') OR member_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM transactions WHERE id IN ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000023') OR member_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM events WHERE id IN ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000032') OR member_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM notes WHERE id IN ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000042') OR member_id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
DELETE FROM members WHERE id IN ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');


-- ==========================================
-- MIGRATION: 020_create_notifications.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by_name VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visible_user_ids JSONB DEFAULT '[]',
  read_user_ids JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);


-- ==========================================
-- MIGRATION: 021_add_password_plain.sql
-- ==========================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;

