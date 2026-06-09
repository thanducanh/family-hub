const { Client } = require("pg");
const fs = require("fs");

async function test() {
  let dbUrl = "";
  try {
    const env = fs.readFileSync(".env.local", "utf8");
    const line = env.split("\n").find(l => l.startsWith("DATABASE_URL="));
    if (line) {
      dbUrl = line.slice(line.indexOf("=") + 1).replace(/"/g, "").trim();
    }
  } catch (e) {
    console.error(e);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'income_records'");
    console.log(result.rows.map(r => r.column_name));
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}
test();
