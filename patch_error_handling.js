const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// Update handleSave in EventEditorInline
code = code.replace(
  /const handleSave = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsSaving\(true\);\s*try \{\s*await save\(e\);\s*\} finally \{\s*setIsSaving\(false\);\s*\}\s*\};/,
  `const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      alert("Vui lòng nhập nội dung sự kiện");
      return;
    }
    const startObj = new Date(\`\${draft.startDate}T\${draft.allDay ? "00:00" : draft.startTime}\`);
    const endObj = new Date(\`\${draft.endDate}T\${draft.allDay ? "23:59" : draft.endTime}\`);
    if (!draft.allDay && endObj < startObj) {
      alert("Thời gian kết thúc không được nhỏ hơn bắt đầu");
      return;
    }
    setIsSaving(true);
    try {
      await save(e);
    } catch (err) {
      console.error("Save event failed", err);
      alert("Không lưu được sự kiện");
    } finally {
      setIsSaving(false);
    }
  };`
);

// Update saveEvent in TimetreeCalendar to properly throw on error
code = code.replace(
  /async function saveEvent\(event: React\.FormEvent\) \{[\s\S]*?const id = draft\.id \|\| \(typeof crypto \!== "undefined" \&\& crypto\.randomUUID \? crypto\.randomUUID\(\) : \`\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2, 10\)\}\`\);[\s\S]*?if \(\!response\.ok \|\| \!result\?\.ok\) \{\s*setError\(result\?\.error \|\| "Không thể lưu sự kiện\."\);\s*return;\s*\}/,
  `async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const id = draft.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : \`\${Date.now()}-\${Math.random().toString(36).slice(2, 10)}\`);
    
    let isSuccess = false;
    try {
      const response = await fetch("/api/events", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id })
      });
      const result = await readJson<{ ok: boolean; data?: { id: string }; error?: string }>(response);
      if (!response.ok || !result?.ok) {
        setError(result?.error || "Không thể lưu sự kiện.");
        throw new Error(result?.error || "Lỗi API");
      }
      isSuccess = true;
    } catch (err) {
      console.error("[saveEvent] Error:", err);
      throw err;
    }`
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log('Done.');
