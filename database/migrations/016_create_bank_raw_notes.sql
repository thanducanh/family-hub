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
