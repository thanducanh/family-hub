const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// replace (!item.read && !item.isRead) with (!item.read && !(item as any).isRead)
code = code.replace(/\(!item\.read && !item\.isRead\)/g, "(!item.read && !(item as any).isRead)");
code = code.replace(/!n\.read && !n\.isRead/g, "!n.read && !(n as any).isRead");

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log("Fixed isRead error");
