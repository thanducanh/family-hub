const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');
code = code.replace(/import\s*\{([^}]*)\}\s*from\s*["']@\/types["']/, (match, p1) => {
  if (p1.includes('MemberPermissions')) return match;
  return `import {${p1}, MemberPermissions } from "@/types"`;
});
fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
