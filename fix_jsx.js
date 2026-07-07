const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// The current code is:
/*
      </details>
        </div>
      )}
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">
*/
// It's missing a `</div>` before `</details>`? No, it's missing a `</div>` after `</details>` but BEFORE the `</div>` (which is the contents wrapper).
// Oh wait. If I just search for:
// `</details>\n        </div>\n      )}`
// And replace it with:
// `</details>\n</div>\n        </div>\n      )}`
// Let's look at the actual code in the file:
const badStr = `        </div>
      </details>
        </div>
      )}
      
      <div className="grid grid-cols-3 border-t`;

const goodStr = `        </div>
      </details>
</div>
        </div>
      )}
      
      <div className="grid grid-cols-3 border-t`;

content = content.replace(badStr, goodStr);
fs.writeFileSync(file, content);
console.log("Fixed JSX closing tag");
