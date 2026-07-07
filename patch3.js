const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix duplicate submit
content = content.replace(
  'type="submit" form={formId} onClick={() => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit()}',
  'type="submit" form={formId}'
);

// Add new helpers
const helpers = `
function normalizeCardType(cardType: string | undefined | null) {
  const t = String(cardType || "").toLowerCase().trim();
  if (t === "credit" || t === "thẻ tín dụng") return "credit";
  if (t === "debit" || t === "thẻ ghi nợ" || t === "thẻ ghi nợ / atm") return "debit";
  return t;
}

function isActiveBankAccount(status: string | undefined | null) {
  const s = String(status || "").toLowerCase().trim();
  return s === "active" || s === "đang dùng" || s === "enabled";
}

function getCardDisplayName(card: any) {
  const bankName = String(card.bankName || card.bank_name || "").trim();
  const displayName = String(card.displayName || card.display_name || "").trim();
  const productName = String(card.productName || card.product_name || "").trim();

  if (bankName === "HSBC" && displayName === "Live+") return "HSBC Live+";
  
  if (displayName && displayName.toLowerCase().includes(bankName.toLowerCase())) return displayName;
  if (productName && productName.toLowerCase().includes(bankName.toLowerCase())) return productName;

  if (bankName && productName) return \`\${bankName} \${productName}\`.trim();
  if (bankName && displayName) return \`\${bankName} \${displayName}\`.trim();

  return bankName || "Thẻ tín dụng";
}
`;

// Replace formatCardNameForTab and pendingCardName with the new helpers, actually just inject them right before CreditPendingSheet
content = content.replace(
  'export function CreditPendingSheet(',
  helpers + '\nexport function CreditPendingSheet('
);

// Update CreditPendingSheet
content = content.replace(
  '  const activeCreditCards = bankAccounts.filter(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"));',
  '  const activeCreditCards = bankAccounts.filter(b => normalizeCardType(b.cardType) === "credit" && isActiveBankAccount(b.status));'
);

content = content.replace(
  /const cardName = bankAccount \? formatCardNameForTab\(bankAccount\) : "Thẻ chưa liên kết";/g,
  'const cardName = bankAccount ? getCardDisplayName(bankAccount) : "Thẻ chưa liên kết";'
);

content = content.replace(
  /const cardName = bankAccount \? formatCardNameForTab\(bankAccount\) : "Thẻ tín dụng";/g,
  'const cardName = bankAccount ? getCardDisplayName(bankAccount) : "Thẻ tín dụng";'
);

content = content.replace(
  /formatCardNameForTab\(b\)/g,
  'getCardDisplayName(b)'
);

fs.writeFileSync(file, content);
console.log("Patched everything!");
