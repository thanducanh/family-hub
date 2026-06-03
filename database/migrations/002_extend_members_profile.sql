-- Bổ sung nickname cho hồ sơ thành viên, không xóa dữ liệu cũ.

ALTER TABLE members ADD COLUMN IF NOT EXISTS nickname VARCHAR(128) NOT NULL DEFAULT '';
