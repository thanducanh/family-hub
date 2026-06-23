const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Add localEvents state
if (!code.includes('const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])')) {
  code = code.replace(
    /const \[events, setEvents\] = useState<CalendarEvent\[\]>\(\[\]\);/,
    `const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);`
  );
}

// 2. Merge localEvents into projectedEvents calculation
code = code.replace(
  /const projectedEvents = events\.flatMap\(ev => \{/,
  `const projectedEvents = [...events, ...localEvents].flatMap(ev => {`
);

// 3. Fix saveEvent to correctly handle API failure and fallback
code = code.replace(
  /let isNew = !draft\.id;[\s\S]*?setDraft\(null\);\s*setSelectedDate\(draft\.startDate\);\s*if \(isNew\) \{\s*setMobileTab\("day"\);\s*\}/,
  `let isNew = !draft.id;
    try {
      if (typeof onSaveEvent === "function") {
        await onSaveEvent(newEvent);
        setLocalEvents(prev => {
          const filtered = prev.filter(e => e.id !== newEvent.id);
          return [...filtered, newEvent as any];
        });
      } else {
        console.log("[saveEvent] API Call: URL: /api/events, Method:", draft.id ? "PUT" : "POST");
        let response;
        try {
          response = await fetch("/api/events", {
            method: draft.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEvent)
          });
        } catch (fetchErr) {
          console.warn("[saveEvent] API Call Failed, saving locally instead:", fetchErr);
          setLocalEvents(prev => {
            const filtered = prev.filter(e => e.id !== newEvent.id);
            return [...filtered, newEvent as any];
          });
          response = null;
        }
        
        if (response) {
          const text = await response.text();
          let result;
          try { result = JSON.parse(text); } catch (e) {}

          if (!response.ok || !result?.ok || Object.keys(result).length === 0) {
            console.warn("[saveEvent] API Error or empty response, saved locally instead:", result);
            setLocalEvents(prev => {
              const filtered = prev.filter(e => e.id !== newEvent.id);
              return [...filtered, newEvent as any];
            });
          } else {
            // Success API
            setLocalEvents(prev => {
              const filtered = prev.filter(e => e.id !== newEvent.id);
              return [...filtered, newEvent as any];
            });
          }
        }
      }
    } catch (err: any) {
      console.warn("[saveEvent] Error during save, saved locally instead:", err);
      setLocalEvents(prev => {
        const filtered = prev.filter(e => e.id !== newEvent.id);
        return [...filtered, newEvent as any];
      });
    }

    setDraft(null);
    setSelectedDate(draft.startDate);
    if (isNew) {
      setMobileTab("day");
    }`
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
