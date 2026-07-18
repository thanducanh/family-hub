const fs = require('fs');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: 'postgresql://family_user:FamilyHubDB2026_local@192.168.1.107:5432/family_hub' });
  try {
    const res = await pool.query("SELECT * FROM bank_accounts WHERE bank_name = 'BIDV'");
    const rawRow = res.rows[0];
    
    const text = String(rawRow.account_type || rawRow.card_type || "").trim().toLowerCase();
    let type = "debit";
    if (["credit_card", "credit", "the tin dung", "thẻ tín dụng"].includes(text)) type = "credit";
    else if (["debit_card", "debit", "atm", "the ghi no", "thẻ ghi nợ", "the ghi no / atm", "thẻ ghi nợ / atm"].includes(text)) type = "debit";
    else if (["wallet", "momo", "vi dien tu", "ví điện tử"].includes(text)) type = "wallet";
    else if (["bank_account", "tai khoan ngan hang", "tài khoản ngân hàng"].includes(text)) type = "bank_account";

    const apiOutput = {
      id: rawRow.id,
      bankName: rawRow.bank_name,
      accountType: type,
      cardType: type,
      status: "Đang dùng"
    };

    fs.writeFileSync('db-trace.json', JSON.stringify({
      database_raw: rawRow,
      api_response: apiOutput
    }, null, 2));

  } finally {
    await pool.end();
  }
}
run();
