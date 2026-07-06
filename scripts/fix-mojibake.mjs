import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env.local manually
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/family_hub'
});

function decodeMojibake(text) {
  if (!text) return text;
  // If it contains typical mojibake characters like Ã, Ä, á, », we try to decode it
  if (/[ÃÄá»]/.test(text)) {
    try {
      const decoded = Buffer.from(text, 'latin1').toString('utf8');
      // Simple heuristic: if decoded string has replacement characters (), it might not be a valid utf8 decode
      if (!decoded.includes('')) {
        return decoded;
      }
    } catch (e) {
      // ignore
    }
  }
  return text;
}

async function run() {
  console.log("=== FIX MOJIBAKE SCRIPT ===");
  const apply = process.env.FIX_MOJIBAKE_APPLY === 'YES';

  if (!apply) {
    console.log(">> CHẾ ĐỘ PREVIEW (FIX_MOJIBAKE_APPLY=NO) - Không có thay đổi nào được lưu <<");
    console.log("Để áp dụng thay đổi, chạy: FIX_MOJIBAKE_APPLY=YES node scripts/fix-mojibake.mjs\n");
  } else {
    console.log(">> CHẾ ĐỘ APPLY - Đang lưu các thay đổi vào DB <<\n");
  }

  try {
    const memRes = await pool.query('SELECT id, name, nickname FROM members');
    let memFixed = 0;
    
    for (const row of memRes.rows) {
      const newName = decodeMojibake(row.name);
      const newNick = decodeMojibake(row.nickname);
      
      const changed = newName !== row.name || newNick !== row.nickname;
      
      if (changed) {
        console.log(`[members] ID ${row.id}:`);
        if (newName !== row.name) console.log(`  - name: "${row.name}" -> "${newName}"`);
        if (newNick !== row.nickname) console.log(`  - nickname: "${row.nickname}" -> "${newNick}"`);
        
        if (apply) {
          await pool.query('UPDATE members SET name = $1, nickname = $2 WHERE id = $3', [newName, newNick, row.id]);
        }
        memFixed++;
      }
    }

    console.log(`\nTổng số members có thể sửa: ${memFixed}`);

    // Fix users table display_name
    const usersRes = await pool.query('SELECT id, display_name FROM users');
    let usersFixed = 0;
    for (const row of usersRes.rows) {
      const newName = decodeMojibake(row.display_name);
      if (newName !== row.display_name) {
        console.log(`[users] ID ${row.id}: display_name "${row.display_name}" -> "${newName}"`);
        if (apply) {
          await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [newName, row.id]);
        }
        usersFixed++;
      }
    }
    console.log(`Tổng số users có thể sửa: ${usersFixed}`);
  } catch (error) {
    console.error("LỖI:", error);
  } finally {
    pool.end();
  }
}

run();
