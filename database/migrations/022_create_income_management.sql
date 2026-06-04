CREATE TABLE IF NOT EXISTS income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'fixed' CHECK (type IN ('fixed', 'variable')),
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'weekly', 'yearly', 'one_time', 'custom')),
  received_date DATE,
  start_date DATE,
  note TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_income_sources_member_id ON income_sources(member_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_type ON income_sources(type);

CREATE TABLE IF NOT EXISTS income_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES income_sources(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  received_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_income_records_source_id ON income_records(source_id);
CREATE INDEX IF NOT EXISTS idx_income_records_member_id ON income_records(member_id);
CREATE INDEX IF NOT EXISTS idx_income_records_received_date ON income_records(received_date);
