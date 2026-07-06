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

async function run() {
  console.log("=== RESET BANK CARDS ONLY SCRIPT ===");
  
  if (process.env.RESET_BANK_CARDS_ONLY !== 'YES') {
    console.error("LỖI: Bạn phải thiết lập biến môi trường RESET_BANK_CARDS_ONLY=YES để chạy script này.");
    console.error("Cách chạy: RESET_BANK_CARDS_ONLY=YES DRY_RUN=YES node scripts/reset-bank-cards-only.mjs");
    process.exit(1);
  }

  const isDryRun = process.env.DRY_RUN !== 'NO' && process.env.DRY_RUN !== 'false';
  console.log(isDryRun ? ">> CHẾ ĐỘ XEM TRƯỚC (DRY_RUN=YES) - KHÔNG CÓ THAY ĐỔI NÀO ĐƯỢC LƯU <<" : ">> CHẾ ĐỘ CHẠY THẬT (DRY_RUN=NO) - ĐANG XÓA DỮ LIỆU <<");

  try {
    // Check tables existence
    const getCount = async (table) => {
      try {
        const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        return parseInt(res.rows[0].count, 10);
      } catch (e) {
        return 0; // Table might not exist
      }
    };

    const counts = {
      card_pending_transactions: await getCount('card_pending_transactions'),
      card_payments: await getCount('card_payments'),
      bank_card_rewards: await getCount('bank_card_rewards'),
      bank_raw_notes: await getCount('bank_raw_notes'),
      bank_accounts: await getCount('bank_accounts'),
    };

    console.log("Sẽ xóa số lượng bản ghi sau:");
    console.log(`- bank_accounts: ${counts.bank_accounts}`);
    console.log(`- card_pending_transactions: ${counts.card_pending_transactions}`);
    console.log(`- card_payments: ${counts.card_payments}`);
    console.log(`- bank_card_rewards: ${counts.bank_card_rewards}`);
    console.log(`- bank_raw_notes: ${counts.bank_raw_notes}`);

    if (isDryRun) {
      console.log("\n[DRY RUN] Đã xem trước xong. Để xóa thật, hãy chạy với DRY_RUN=NO.");
      process.exit(0);
    }

    console.log("\nĐang xử lý khóa ngoại trong transactions...");
    await pool.query("BEGIN");

    // Prevent foreign key constraint errors and preserve transactions
    const txUpdate = await pool.query(`
      UPDATE transactions 
      SET bank_account_id = NULL, payment_account_id = NULL 
      WHERE bank_account_id IS NOT NULL OR payment_account_id IS NOT NULL
    `);
    console.log(`Đã ngắt liên kết thẻ ngân hàng khỏi ${txUpdate.rowCount} giao dịch thu chi.`);

    // Drop tables or delete records
    const tablesToClear = [
      'card_pending_transactions',
      'card_payments',
      'bank_card_rewards',
      'bank_raw_notes'
    ];

    for (const table of tablesToClear) {
      try {
        await pool.query(`DELETE FROM ${table}`);
        console.log(`Đã dọn sạch bảng ${table}.`);
      } catch (e) {
        // Table might not exist, ignore
      }
    }

    // Delete bank_accounts
    await pool.query(`DELETE FROM bank_accounts`);
    console.log(`Đã dọn sạch bảng bank_accounts.`);

    await pool.query("COMMIT");
    console.log("\n>> HOÀN TẤT. Module thẻ ngân hàng đã được làm sạch an toàn.");

  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("LỖI:", error);
  } finally {
    pool.end();
  }
}

run();
