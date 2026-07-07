const fs = require('fs');
const file = 'src/app/api/finance-adjustments/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_ensure = `async function ensureAdjustmentsTable() {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS finance_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`);
}`;
const r_ensure = `async function ensureAdjustmentsTable() {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS finance_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`);
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE");
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'cash'");
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS member_id UUID");
}`;
content = content.replace(t_ensure, r_ensure);

const t_insert = `    const result = await pool.query(
      \`INSERT INTO finance_adjustments (month, year, amount, note, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
      [body.month, body.year, amount, String(body.note || ""), String((user as any).name || (user as any).email || "")]
    );`;
const r_insert = `    const date = body.date || new Date().toISOString().split('T')[0];
    const sourceType = body.sourceType || body.source_type || 'cash';
    const memberId = body.memberId || body.member_id || (user as any).id || null;

    const result = await pool.query(
      \`INSERT INTO finance_adjustments (month, year, amount, note, created_by, date, source_type, member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *\`,
      [body.month, body.year, amount, String(body.note || ""), String((user as any).name || (user as any).email || ""), date, sourceType, memberId]
    );`;
content = content.replace(t_insert, r_insert);

fs.writeFileSync(file, content);
console.log("Patched api/finance-adjustments/route.ts");
