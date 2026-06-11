const fs = require('fs');
let c = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');

c = c.replace('</div>\n    </>\n    }\n  </div>;', '</>\n    }\n  </div>;');

fs.writeFileSync('src/components/member-job-page.tsx', c);
console.log('Fixed end tags');
