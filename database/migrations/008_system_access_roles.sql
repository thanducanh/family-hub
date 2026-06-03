-- Tách quyền hệ thống khỏi vai vế gia đình, không xóa dữ liệu cũ.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'full_access' WHERE role IN ('system_admin', 'parent', 'admin');
UPDATE users SET role = 'self_only' WHERE role = 'member';
UPDATE users SET role = 'self_only' WHERE role NOT IN ('full_access', 'self_only');

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('full_access', 'self_only'));

UPDATE users SET role = 'full_access', is_system = TRUE, active = TRUE WHERE username = 'admin';
