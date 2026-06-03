import bcrypt from "bcryptjs";
import pg from "pg";
import { loadDatabaseUrl } from "./env.mjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: await loadDatabaseUrl() });
const passwordHash = await bcrypt.hash("admin123", 12);

try {
  const result = await pool.query(
    `INSERT INTO users (username, display_name, password_hash, role, active, must_change_password, is_system)
     VALUES ('admin', 'Quản trị hệ thống', $1, 'full_access', TRUE, TRUE, TRUE)
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'full_access',
       active = TRUE,
       must_change_password = TRUE,
       is_system = TRUE,
       updated_at = CURRENT_TIMESTAMP
     RETURNING username, role, active, is_system, must_change_password`,
    [passwordHash],
  );
  console.table(result.rows);
  console.log("Admin mặc định đã sẵn sàng. Hãy đăng nhập bằng admin / admin123 và đổi mật khẩu ngay.");
} finally {
  await pool.end();
}
