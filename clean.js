const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/family-app.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/cache:\s*['"]no-store['"],\s*cache:\s*['"]no-store['"]/g, "cache: 'no-store'");

fs.writeFileSync(file, content, 'utf8');
console.log('Cleaned double cache properties');
