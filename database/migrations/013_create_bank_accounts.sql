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
