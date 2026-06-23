const fs = require('fs');

let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Remove the bad localStorage clear logic
const badLocalEventsStorage = /const storedLocal = localStorage\.getItem\("familyhub_calendar_local_events"\);\s*if \(storedLocal\) \{ try \{ setLocalEvents\(JSON\.parse\(storedLocal\)\); \} catch\(e\)\{\} \}/g;
code = code.replace(badLocalEventsStorage, '');

// 2. Update allEvents to merge and deduplicate events + localEvents
const allEventsRegex = /const projectedEvents = \[\.\.\.events, \.\.\.localEvents\]\.flatMap\(ev => \{/g;
const newAllEvents = `const projectedEvents = (() => {
      const map = new Map();
      events.forEach(e => map.set(e.id, e));
      localEvents.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    })().flatMap(ev => {`;

code = code.replace(allEventsRegex, newAllEvents);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Patched timetree-calendar.tsx successfully.");
