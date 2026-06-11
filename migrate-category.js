require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
});

async function main() {
  await client.connect();
  console.log("Connected to DB");

  try {
    const res = await client.query(`
      UPDATE transactions
      SET category = 'Sinh hoạt'
      WHERE category = 'Nhà cửa & sinh hoạt'
    `);
    console.log(`Migration successful. Updated ${res.rowCount} rows.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

main();
