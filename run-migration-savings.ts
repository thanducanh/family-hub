import { pool } from "./src/lib/db";

async function main() {
  const sql = `
CREATE TABLE IF NOT EXISTS savings_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'monthly',
  holder TEXT NOT NULL DEFAULT 'Ngân hàng',
  description TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_savings_records_year_month ON savings_records(year, month);
CREATE INDEX IF NOT EXISTS idx_savings_records_member_id ON savings_records(member_id);
`;
  console.log("Running migration...");
  await pool.query(sql);
  console.log("Migration done");
  process.exit(0);
}

main().catch(console.error);
