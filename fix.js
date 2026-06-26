const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

c = c.replace(/Ä Ã£ Ä‘á»•i gÃ³i SIM\/Data/g, 'Đã đổi gói SIM/Data');
c = c.replace(/title="Ä á»•i gÃ³i"/g, 'title="Đổi gói"');

fs.writeFileSync('src/components/family-app.tsx', c, 'utf8');
