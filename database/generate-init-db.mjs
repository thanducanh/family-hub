import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const sqlPath = join(__dirname, "migrations", "consolidated_schema.sql");
  const sqlContent = await readFile(sqlPath, "utf8");

  const codeContent = `import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

const globalForInit = globalThis as unknown as { familyDbInitPromise?: Promise<void> };

export function initDatabase() {
  globalForInit.familyDbInitPromise ??= doInitDatabase().catch(error => {
    delete globalForInit.familyDbInitPromise;
    throw error;
  });
  return globalForInit.familyDbInitPromise;
}

const CONSOLIDATED_SCHEMA = ${JSON.stringify(sqlContent)};

async function doInitDatabase() {
  // Check if users table already exists
  const checkResult = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')"
  );
  const dbInitialized = checkResult.rows[0]?.exists;

  if (!dbInitialized) {
    console.log("Database not initialized. Executing consolidated schema...");
    await pool.query(CONSOLIDATED_SCHEMA);
    console.log("Database schema initialized successfully.");
  } else {
    console.log("Database already initialized.");
  }

  // Seed default admin if users table is empty
  await seedAdminUser();
}

async function seedAdminUser() {
  const result = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (Number(result.rows[0]?.count || 0) > 0) return;

  const password = process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (username, email, display_name, avatar, password_hash, password_plain, role, active, must_change_password, is_system) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,TRUE,TRUE)",
    ["admin", process.env.DEFAULT_ADMIN_EMAIL || null, "Quản trị viên", "", hash, password, "full_access"],
  );
  console.log("Default admin user seeded.");
}
`;

  const outputPath = join(__dirname, "..", "src", "lib", "init-database.ts");
  await writeFile(outputPath, codeContent, "utf8");
  console.log(`Generated ${outputPath} successfully.`);
}

main().catch(console.error);
