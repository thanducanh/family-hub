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
