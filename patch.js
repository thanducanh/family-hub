const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Insert robust generateUUID function and update saveEvent
code = code.replace(
  /async function saveEvent\(event: React\.FormEvent\) \{[\s\S]*?if \(\!response\.ok \|\| \!result\?\.ok\) \{\s*setError\(result\?\.error \|\| "Không thể lưu sự kiện\."\);\s*return;\s*\}[\s\S]*?const isNew = \!draft\.id;\s*setDraft\(null\);\s*await load\(\);\s*setSelectedDate\(draft\.startDate\);/,
  `function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
      const random = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(1))[0] : Math.random() * 256;
      return (c ^ random & 15 >> c / 4).toString(16);
    });
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const id = draft.id || generateUUID();
    
    let response;
    let result;
    try {
      response = await fetch("/api/events", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id })
      });
      result = await readJson(response);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Lỗi API");
      }
    } catch (err) {
      console.error("[saveEvent] Error:", err);
      throw err;
    }

    const isNew = !draft.id;
    setDraft(null);
    await load();
    setSelectedDate(draft.startDate);
    if (isNew) {
      setMobileTab("day");
    }`
);

// 2. Fix EventEditorSheet save prop
code = code.replace(
  `save={saveEvent => { save(saveEvent); setDraft(null); }}`,
  `save={save}`
);

// 3. Fix EventEditorInline (replace alert with inline error)
code = code.replace(
  /const \[isSaving, setIsSaving\] = useState\(false\);/,
  `const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");`
);

code = code.replace(
  /const handleSave = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsSaving\(true\);\s*try \{\s*await save\(e\);\s*\} catch \(err\) \{\s*console\.error\("Save event failed", err\);\s*alert\("Không lưu được sự kiện"\);\s*\} finally \{\s*setIsSaving\(false\);\s*\}\s*\};/,
  `const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!draft.title.trim()) {
      setFormError("Vui lòng nhập nội dung sự kiện");
      return;
    }
    const startObj = new Date(\`\${draft.startDate}T\${draft.allDay ? "00:00" : draft.startTime}\`);
    const endObj = new Date(\`\${draft.endDate}T\${draft.allDay ? "23:59" : draft.endTime}\`);
    if (!draft.allDay && endObj <= startObj) {
      setFormError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }
    setIsSaving(true);
    try {
      if (typeof save === "function") {
        const promise = save(e);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    } catch (err) {
      console.error("Save event failed", err);
      setFormError("Không lưu được sự kiện");
    } finally {
      setIsSaving(false);
    }
  };`
);

code = code.replace(
  /const handleSave = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsSaving\(true\);\s*await save\(e\);\s*setIsSaving\(false\);\s*\};/,
  `const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!draft.title.trim()) {
      setFormError("Vui lòng nhập nội dung sự kiện");
      return;
    }
    const startObj = new Date(\`\${draft.startDate}T\${draft.allDay ? "00:00" : draft.startTime}\`);
    const endObj = new Date(\`\${draft.endDate}T\${draft.allDay ? "23:59" : draft.endTime}\`);
    if (!draft.allDay && endObj <= startObj) {
      setFormError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }
    setIsSaving(true);
    try {
      if (typeof save === "function") {
        const promise = save(e);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    } catch (err) {
      console.error("Save event failed", err);
      setFormError("Không lưu được sự kiện");
    } finally {
      setIsSaving(false);
    }
  };`
);

// Add formError display
code = code.replace(
  /<div className="flex flex-col gap-4">/,
  `<div className="flex flex-col gap-4">
          {formError && (
            <div className="bg-[#FFF1F2] border border-[#E8DCD5] rounded-xl p-3 shadow-sm">
              <p className="text-[#E11D48] text-[13px] font-medium">{formError}</p>
            </div>
          )}`
);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
