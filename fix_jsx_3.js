const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Replace the ending correctly.
// we want to replace `</details>\n        </div>\n      )}` with `</details>\n        </div>\n        </div>\n      )}`
content = content.replace(/<\/details>[\s]*<\/div>[\s]*\)}/m, `</details>\n        </div>\n        </div>\n      )}`);

fs.writeFileSync(file, content);
console.log("Fixed JSX closing tag");
