const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Fix saveEvent in TimetreeCalendar
code = code.replace(
  'const id = draft.id || crypto.randomUUID();',
  'const id = draft.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);'
);

// 2. Fix EventEditorSheet save handler
code = code.replace(
  'save={saveEvent => { save(saveEvent); setDraft(null); }}',
  'save={save}'
);

// 3. Fix month view max 2 events
code = code.replace(
  '{dayEvents.slice(0, 3).map((e: any, i: number) => (',
  '{dayEvents.slice(0, 2).map((e: any, i: number) => ('
);

code = code.replace(
  '{dayEvents.length > 3 && <span className="text-[8px] font-medium px-1 text-left text-[#6B5E64]">+{dayEvents.length - 3}</span>}',
  '{dayEvents.length > 2 && <span className="text-[8px] font-medium px-1 text-left text-[#6B5E64]">+{dayEvents.length - 2}</span>}'
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log('Done.');
