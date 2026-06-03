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
