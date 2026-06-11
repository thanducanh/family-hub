require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  console.log("Connected to DB");

  try {
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gross_amount NUMERIC DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
    `);
    console.log("Migration successful");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

main();
