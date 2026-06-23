const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Setup localEvents state and persistLocalEvent helper
const eventsStateRegex = /const \[events, setEvents\] = useState<CalendarEvent\[\]>\(\[\]\);/;
const newEventsState = `  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const uid = user?.id || user?.memberId || "guest";
        const saved = localStorage.getItem(\`familyHubCalendarEvents:\${uid}\`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const uid = user?.id || user?.memberId || "guest";
      localStorage.setItem(\`familyHubCalendarEvents:\${uid}\`, JSON.stringify(localEvents));
    }
  }, [localEvents, user]);

  const persistLocalEvent = (event: any) => {
    setLocalEvents(prev => {
      const exists = prev.some(item => item.id === event.id);
      if (exists) return prev.map(item => item.id === event.id ? event : item);
      return [...prev, event];
    });
  };`;
code = code.replace(eventsStateRegex, newEventsState);

// 2. allEvents useMemo
const allEventsRegex = /const projectedEvents = events\.flatMap\(ev => \{([\s\S]*?)return \[\.\.\.projectedEvents, \.\.\.fixedEvents\];\s*\}, \[events, fixedEvents, anchor\]\);/;
const newAllEvents = `const projectedEvents = [...events, ...localEvents].flatMap(ev => {$1return [...projectedEvents, ...fixedEvents];
  }, [events, localEvents, fixedEvents, anchor]);`;
code = code.replace(allEventsRegex, newAllEvents);

// 3. saveEvent
const saveEventRegex = /async function saveEvent\(event: React\.FormEvent\) \{[\s\S]*?triggerSystemNotification\("Cập nhật lịch", \{ body: msg \}\);\s*\}\s*\}/;
const newSaveEvent = `async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const id = draft.id || generateUUID();
    
    const startObj = new Date(\`\${draft.startDate}T\${draft.allDay ? "00:00" : draft.startTime}\`);
    const endObj = new Date(\`\${draft.endDate}T\${draft.allDay ? "23:59" : draft.endTime}\`);
    const startIso = startObj.toISOString();
    const endIso = endObj.toISOString();

    const eventToSave = {
      ...draft,
      id,
      title: draft.title.trim(),
      content: draft.title.trim(),
      date: draft.startDate,
      start: startIso,
      end: endIso,
      startAt: startIso,
      endAt: endIso,
      startsAt: startIso,
      endsAt: endIso,
      allDay: draft.allDay,
      repeat: draft.repeatRule,
      reminder: draft.reminderMinutes,
      labelColor: draft.labelColor,
      color: draft.labelColor,
      note: draft.note || "",
      source: "local"
    };

    let isNew = !draft.id;

    try {
      if (typeof onSaveEvent === "function") {
        const result = await onSaveEvent(eventToSave);
        if (result && typeof result === "object" && Object.keys(result).length > 0) {
          persistLocalEvent(result);
        } else {
          console.warn("[saveEvent] API returned empty result, saving local fallback", result);
          persistLocalEvent(eventToSave);
        }
      } else {
        const response = await fetch("/api/events", {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventToSave)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result?.ok && Object.keys(result).length > 0) {
          persistLocalEvent(eventToSave); // Should ideally be result data, but falling back
        } else {
          console.warn("[saveEvent] API returned empty result or error, saving local fallback", result);
          persistLocalEvent(eventToSave);
        }
      }
    } catch (error) {
      console.warn("[saveEvent] API unavailable, saving local fallback", error);
      persistLocalEvent(eventToSave);
    }

    setDraft(null);
    setSelectedDate(draft.startDate);
    if (isNew) {
      setMobileTab("day");
    }

    // Notification
    const settings = getNotificationSettings();
    if (settings.calendar) {
      const msg = \`\${user?.displayName || "Ai đó"} đã \${isNew ? "tạo" : "cập nhật"} sự kiện lịch "\${draft.title}"\`;
      addLocalNotification({ title: "Lịch", message: msg, createdByName: user?.displayName || "Ai đó", sourceType: "calendar_events", sourceId: id });
      triggerSystemNotification("Cập nhật lịch", { body: msg });
    }
  }`;
code = code.replace(saveEventRegex, newSaveEvent);

// 4. Update colors array in EventEditorInline
const colorsRegex = /const colors = \[\s*\{ value: "#800020", label: "Wine Red" \},[\s\S]*?\{ value: "#2563EB", label: "Blue" \},\s*\];/;
const newColors = `const colors = [
    { value: "#800020", label: "Wine Red" },
    { value: "#D4AF37", label: "Gold" },
    { value: "#059669", label: "Green" },
    { value: "#E11D48", label: "Red" },
    { value: "#2563EB", label: "Blue" },
    { value: "#7C3AED", label: "Purple" },
    { value: "#F97316", label: "Orange" },
    { value: "#DB2777", label: "Pink" },
    { value: "#0891B2", label: "Cyan" },
    { value: "#475569", label: "Slate" },
    { value: "#92400E", label: "Brown" },
    { value: "#171018", label: "Black" },
  ];`;
code = code.replace(colorsRegex, newColors);

// 5. Update JSX in EventEditorInline
const handleSaveRegex = /const handleSave = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsSaving\(false\);\s*\}\s*\};/;
const newHandleSave = `const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!draft.title.trim()) {
      setFormError("Vui lòng nhập nội dung sự kiện");
      return;
    }
    const startObj = new Date(\`\${draft.startDate}T\${draft.allDay ? "00:00" : draft.startTime}\`);
    const endObj = new Date(\`\${draft.endDate}T\${draft.allDay ? "23:59" : draft.endTime}\`);
    if (endObj < startObj) {
      setFormError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }
    setIsSaving(true);
    try {
      await save(e);
    } finally {
      setIsSaving(false);
    }
  };`;
code = code.replace(handleSaveRegex, newHandleSave);

// And the formError rendering in JSX (EventEditorInline)
// Wait, the previous code had formError rendering? No it had `alert("Vui lòng nhập nội dung sự kiện")`.
// Let's replace the top of the form with formError UI.
const formTopRegex = /<div className="flex-1 overflow-y-auto pb-\[100px\] px-4 pt-4">\s*<div className="flex flex-col gap-4">/;
const newFormTop = `<div className="flex-1 overflow-y-auto pb-[100px] px-4 pt-4">
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="bg-[#FFF1F2] border border-[#E8DCD5] rounded-xl p-3 shadow-sm">
              <p className="text-[#E11D48] text-[13px] font-medium">{formError}</p>
            </div>
          )}`;
if(!code.includes('formError && (')) {
  code = code.replace(formTopRegex, newFormTop);
}

// 6. Color layout
const colorLayoutRegex = /<div className="flex items-center gap-4">\s*\{colors\.map\(c => \(\s*<button[\s\S]*?<\/svg>\}[\s\S]*?<\/button>\s*\)\)\}\s*<\/div>/;
const newColorLayout = `<div className="flex flex-wrap items-center gap-2">
              {colors.map(c => (
                <button 
                  key={c.value} 
                  type="button" 
                  onClick={() => setDraft({ ...draft, labelColor: c.value })}
                  className={\`size-[30px] shrink-0 rounded-full flex items-center justify-center transition-transform \${draft.labelColor === c.value ? "scale-105 ring-2 ring-offset-2 ring-[#D4AF37]" : ""}\`}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                >
                  {draft.labelColor === c.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>`;
code = code.replace(colorLayoutRegex, newColorLayout);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Script generation Done");
