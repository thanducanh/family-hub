const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    console.log("Adding subcategory column to transactions table...");
    await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';`);
    console.log("Migration successful.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
