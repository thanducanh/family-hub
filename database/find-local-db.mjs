import pg from "pg";
const { Client } = pg;

const URIS = [
  "postgresql://family_user:family_password@192.168.1.109:5433/family_management",
  "postgresql://family_user:family_password@localhost:5433/family_management",
  "postgresql://postgres:postgres@localhost:5432/family_management",
  "postgresql://postgres@localhost:5432/family_management",
  "postgresql://postgres:postgres@localhost:5432/postgres",
];

async function tryConnect(uri) {
  const client = new Client({ connectionString: uri, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM members");
    if (res.rows.length > 0) {
      console.log(`SUCCESS connection to: ${uri}`);
      console.table(res.rows);
      return { uri, rows: res.rows };
    }
    console.log(`Connected to ${uri} but no members found.`);
    await client.end();
  } catch (err) {
    console.log(`Failed for ${uri}: ${err.message}`);
  }
  return null;
}

async function main() {
  for (const uri of URIS) {
    const result = await tryConnect(uri);
    if (result) {
      break;
    }
  }
}

main();
