CREATE TABLE IF NOT EXISTS card_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  reward_date DATE,
  type TEXT NOT NULL DEFAULT 'cashback',
  amount NUMERIC NOT NULL DEFAULT 0,
  points NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'expected',
  title TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_rewards_member_id ON card_rewards(member_id);
CREATE INDEX IF NOT EXISTS idx_card_rewards_bank_account_id ON card_rewards(bank_account_id);
