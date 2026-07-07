const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. activeSources filter
const t_activeSources = `  const activeSources = bankAccounts.filter(b => isPaymentSourceForCreditCard(b) && String(b.id) !== String(card.id));`;
const r_activeSources = `  const activeSources = bankAccounts.filter(b => {
    const type = String(b.cardType || "").toLowerCase().trim();
    return type !== "credit" && type !== "thẻ tín dụng" && String(b.id) !== String(card.id);
  });`;
content = content.replace(t_activeSources, r_activeSources);

// 2. Dropdown option label (no need to say "Thẻ tín dụng" because it's excluded)
const t_option = `<option key={b.id} value={b.id}>{b.displayName || b.productName || b.bankName} • {b.cardType === "credit" || b.cardType === "Thẻ tín dụng" ? "Thẻ tín dụng" : "Thẻ ghi nợ"}</option>`;
const r_option = `<option key={b.id} value={b.id}>{b.displayName || b.productName || b.bankName} • Thẻ ghi nợ/Tài khoản</option>`;
content = content.replace(t_option, r_option);

let hasError = false;
if (!content.includes(r_activeSources)) { console.log("activeSources missing"); hasError = true; }
if (!content.includes(r_option)) { console.log("option missing"); hasError = true; }
if (hasError) process.exit(1);

fs.writeFileSync(file, content);
console.log("Patched CreditPaymentForm");
