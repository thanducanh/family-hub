const fs = require('fs');

let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

const regex = /setDetail\(null\);\s*setDraft\(null\);\s*await load\(\);/g;
code = code.replace(regex, `setDetail(null);
    setDraft(null);
    setLocalEvents(prev => prev.filter(e => e.id !== item.id));
    await load();`);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Patched deleteEvent successfully.");
