const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Add loading from localStorage
code = code.replace(
  /const storedHidden = localStorage\.getItem\("familyhub_calendar_visibility"\);\s*if \(storedHidden\) \{ try \{ setHiddenLists\(JSON\.parse\(storedHidden\)\); \} catch\(e\)\{\} \}/,
  `const storedHidden = localStorage.getItem("familyhub_calendar_visibility");
    if (storedHidden) { try { setHiddenLists(JSON.parse(storedHidden)); } catch(e){} }

    const storedLocal = localStorage.getItem("familyhub_calendar_local_events");
    if (storedLocal) { try { setLocalEvents(JSON.parse(storedLocal)); } catch(e){} }`
);

// 2. Add saving to localStorage
code = code.replace(
  /const \[localEvents, setLocalEvents\] = useState<CalendarEvent\[\]>\(\[\]\);/,
  `const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("familyhub_calendar_local_events", JSON.stringify(localEvents));
    }
  }, [localEvents]);`
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
