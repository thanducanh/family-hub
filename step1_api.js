const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /return NextResponse\.json\(\{\s*ok: true,\s*data: \{\s*monthlyData,\s*currentCash,/;

const queryForPending = `
    const paramsPending = ['pending'];
    let wherePending = "status = $1";
    if (filter.params[0]) {
      paramsPending.push(filter.params[0]);
      wherePending += " AND member_id = $2";
    }
    const globalPendingCreditQuery = await pool.query(\`SELECT SUM(amount) as total FROM card_pending_transactions WHERE \${wherePending}\`, paramsPending);
    const pendingCreditTotal = Number(globalPendingCreditQuery.rows[0]?.total || 0);
    const availableCash = currentCash;
    const afterCreditPayment = availableCash - pendingCreditTotal;
`;

const responseReplacement = queryForPending + `
    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        availableCash,
        pendingCreditTotal,
        afterCreditPayment,`;

if (regex.test(content)) {
  content = content.replace(regex, responseReplacement);
  fs.writeFileSync(file, content);
  console.log("Patched route.ts successfully.");
} else {
  console.log("Failed to patch route.ts: Target not found.");
}
