const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const showCreditBox = subTab === "all";
  const overviewData = overviewDataCache[year] || {};
  const currentCash = Number(overviewData.currentCash || 0);
  const currentSavings = Number(overviewData.currentSavings || 0);
  const currentInvestment = Number(overviewData.currentInvestment || 0);
  const totalMoneyOnHand = Number(overviewData.estimatedAssets ?? (currentCash + currentSavings + currentInvestment));`;

const replacement = `  const overviewData = overviewDataCache[year] || {};
  const currentCash = Number(overviewData.currentCash || 0);
  const currentSavings = Number(overviewData.currentSavings || 0);
  const currentInvestment = Number(overviewData.currentInvestment || 0);
  const totalMoneyOnHand = Number(overviewData.estimatedAssets ?? (currentCash + currentSavings + currentInvestment));

  const activeCreditCards = toArray(appData?.bankAccounts).filter(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"));
  const showCreditBox = pendingCredit > 0 || activeCreditCards.length > 0;`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log("Replaced showCreditBox logic");
