const fs = require('fs');
const file = 'src/app/api/bank-accounts/[id]/pay/route.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const client = await pool\.connect\(\);/;

const replacement = `const client = await pool.connect();
  try {
    if (paymentAccountId) {
      const sourceCheck = await client.query(\`SELECT type, card_type FROM bank_accounts WHERE id = $1\`, [paymentAccountId]);
      const source = sourceCheck.rows[0];
      if (source) {
        const typeStr = String(source.type).toLowerCase();
        const cardTypeStr = String(source.card_type).toLowerCase();
        if (typeStr === 'credit' || typeStr === 'credit_card' || cardTypeStr === 'credit' || cardTypeStr === 'thẻ tín dụng') {
          return NextResponse.json({ ok: false, error: "Không được dùng thẻ tín dụng để thanh toán dư nợ." }, { status: 400 });
        }
      }
    }
`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log("Patched pay route.ts successfully.");
} else {
  console.log("Failed to patch pay route.ts");
}
