const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldPart = `</details>
          </div>
        )}`;

const newPart = `</details>
        </div>
          </div>
        )}`;

if (content.includes(oldPart)) {
  content = content.replace(oldPart, newPart);
  fs.writeFileSync(file, content);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find the target string!");
}
