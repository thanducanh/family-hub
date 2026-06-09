const fs = require('fs');
let content = fs.readFileSync('src/components/family-app.tsx', 'utf8');
content = content.replace(
  'const allRecords = incomeData?.allRecords || [];',
  'const allRecords = incomeData?.allRecords || [];\n  console.log("[income] rows after map", allRecords);'
);
fs.writeFileSync('src/components/family-app.tsx', content);
