const fs = require('fs');

function patchApiErrorLog(filePath, apiName) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Try to find the catch block. 
  // It usually looks like: catch (error) { console.error("...", error); ... }
  // We want to replace it with: catch (error: any) { console.error(\`[\${apiName}] \${error.message}\`, error.stack); ... }
  
  // First, ensure the catch uses `error: any` or just `error`
  content = content.replace(/catch \((error|err)\) \{/g, 'catch ($1: any) {');
  
  // Then replace console.error
  content = content.replace(/console\.error\(\s*\[?[^\]]+\]?\s*,\s*(error|err)\s*\);?/g, (match, errName) => {
    return `console.error(\`[${apiName}] \${${errName}?.message || 'Unknown error'}\`, ${errName}?.stack || ${errName});`;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
}

patchApiErrorLog('src/app/api/bank-accounts/route.ts', 'GET /api/bank-accounts');
patchApiErrorLog('src/app/api/card-pending-transactions/route.ts', 'GET /api/card-pending-transactions');
patchApiErrorLog('src/app/api/finance-overview/route.ts', 'GET /api/finance-overview');
patchApiErrorLog('src/app/api/credit-cards/pay/route.ts', 'POST /api/credit-cards/pay');

console.log('patched logs');
