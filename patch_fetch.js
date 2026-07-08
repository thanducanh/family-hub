const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/family-app.tsx');
let content = fs.readFileSync(file, 'utf8');

// We want to add { cache: 'no-store' } to all fetch('/api/...') calls
// For ones without options: fetch('/api/xyz') -> fetch('/api/xyz', { cache: 'no-store' })
content = content.replace(/fetch\(([`'"]\/api\/[^`'"]+[`'"])\)/g, "fetch($1, { cache: 'no-store' })");

// For ones with options: fetch('/api/xyz', { method: ... }) -> fetch('/api/xyz', { cache: 'no-store', method: ... })
// We only want to inject if it doesn't already have 'cache'
content = content.replace(/fetch\(([`'"]\/api\/[^`'"]+[`'"]),\s*\{/g, (match, url) => {
  return `fetch(${url}, { cache: 'no-store', `;
});

// Fix double cache injects just in case
content = content.replace(/cache:\s*'no-store',\s*cache:\s*'no-store'/g, "cache: 'no-store'");

fs.writeFileSync(file, content, 'utf8');
console.log('patched fetch calls cleanly');
