const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_settings = `    settings.totalOpeningCash = totalOpeningCash;`;
const r_settings = `    (settings as any).totalOpeningCash = totalOpeningCash;`;

content = content.replace(t_settings, r_settings);

fs.writeFileSync(file, content);
console.log("Patched API types again");
