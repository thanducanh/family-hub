const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// Fix TS error 1: Cast c to Number
code = code.replace(
  /return \(c \^ random & 15 >> c \/ 4\)\.toString\(16\);/g,
  'return (Number(c) ^ random & 15 >> Number(c) / 4).toString(16);'
);

// Fix TS error 2: Add generic to readJson
code = code.replace(
  /result = await readJson\(response\);/g,
  'result = await readJson<{ ok: boolean; data?: { id: string }; error?: string }>(response);'
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
