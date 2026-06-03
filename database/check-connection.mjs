import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const version = await pool.query("SELECT current_database() AS database, version() AS version");
  const columns = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('members', 'tasks', 'transactions', 'events', 'notes')
    ORDER BY table_name, ordinal_position
  `);
  console.log(JSON.stringify({ ...version.rows[0], columns: columns.rows }, null, 2));
} finally {
  await pool.end();
}
