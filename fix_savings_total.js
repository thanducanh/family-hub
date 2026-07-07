const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_savings = `<span>Tiết kiệm tháng này:</span>
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsThisMonth)}</span>`;
const r_savings = `<span>Tiết kiệm tháng này:</span>
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsTotal)}</span>`;

content = content.replace(t_savings, r_savings);

fs.writeFileSync(file, content);
console.log("Patched savingsTotal");
