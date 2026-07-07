const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const s1 = `      </div>

    </div>

    <div className="min-h-[300px] pb-4">`;

const r1 = `      </div>

    <div className="min-h-[300px] pb-4">`;

content = content.replace(s1, r1);
content = content.replace(s1.replace(/\n/g, '\r\n'), r1.replace(/\n/g, '\r\n'));

fs.writeFileSync(file, content);
console.log("Fixed");
