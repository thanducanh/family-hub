const fs = require('fs');
let c = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');
c = c.replace(/\{viewing && <JobDetail[\s\S]*?\/>\}/g, '');
fs.writeFileSync('src/components/member-job-page.tsx', c);
console.log('Removed JobDetail call');
