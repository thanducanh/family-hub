const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

code = code.replace(
  /return \[\.\.\.projectedEvents, \.\.\.fixedEvents\];\s*\}, \[events, fixedEvents, anchor\]\);/g,
  `return [...projectedEvents, ...fixedEvents];
  }, [events, localEvents, fixedEvents, anchor]);`
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
