import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const baseTablesSql = `-- Base tables creation for clean databases (so migrations 001-018 alter/update statements run successfully)
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completed BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
\n`;

async function main() {
  const migrationsDir = join(__dirname, "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql") && file !== "consolidated_schema.sql")
    .sort();

  let consolidatedSql = baseTablesSql;

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const content = await readFile(filePath, "utf8");
    consolidatedSql += `\n-- ==========================================\n`;
    consolidatedSql += `-- MIGRATION: ${file}\n`;
    consolidatedSql += `-- ==========================================\n\n`;
    consolidatedSql += content;
    consolidatedSql += "\n";
  }

  const outputPath = join(migrationsDir, "consolidated_schema.sql");
  await writeFile(outputPath, consolidatedSql, "utf8");
  console.log(`Consolidated schema written to ${outputPath}`);
}

main().catch(console.error);
