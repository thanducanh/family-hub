const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_settings = `            openingCashBalance: settings.totalOpeningCash,`;
const r_settings = `            openingCashBalance: (settings as any).totalOpeningCash,`;

content = content.replace(t_settings, r_settings);

fs.writeFileSync(file, content);
console.log("Patched API types again 2");
