const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the duplicate definition name (make sure it only replaces the newly injected one)
content = content.replace(
  'function getCardDisplayName(card: any) {',
  'function getPendingCardDisplayName(card: any) {'
);

// Replace usages around CreditPendingSheet
content = content.replace(
  /const cardName = bankAccount \? getCardDisplayName\(bankAccount\) : "Thẻ chưa liên kết";/g,
  'const cardName = bankAccount ? getPendingCardDisplayName(bankAccount) : "Thẻ chưa liên kết";'
);

content = content.replace(
  /const cardName = bankAccount \? getCardDisplayName\(bankAccount\) : "Thẻ tín dụng";/g,
  'const cardName = bankAccount ? getPendingCardDisplayName(bankAccount) : "Thẻ tín dụng";'
);

content = content.replace(
  /getCardDisplayName\(b\)/g,
  'getPendingCardDisplayName(b)'
);

fs.writeFileSync(file, content);
console.log("Renamed to getPendingCardDisplayName");
