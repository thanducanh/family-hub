const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Replace colors array
const oldColors = `  const colors = [
    { value: "#800020", label: "Wine Red" },
    { value: "#D4AF37", label: "Gold" },
    { value: "#059669", label: "Green" },
    { value: "#E11D48", label: "Red" },
    { value: "#2563EB", label: "Blue" },
  ];`;

const newColors = `  const colors = [
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

code = code.replace(oldColors, newColors);

// 2. Replace layout
const oldLayout = `          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] p-3 shadow-sm">
            <span className="block text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide mb-3">Màu sự kiện</span>
            <div className="flex items-center gap-4">
              {colors.map(c => (
                <button 
                  key={c.value} 
                  type="button" 
                  onClick={() => setDraft({ ...draft, labelColor: c.value })}
                  className={\`size-8 rounded-full flex items-center justify-center transition-transform \${draft.labelColor === c.value ? "scale-110 ring-2 ring-offset-2 ring-[#D4AF37]" : ""}\`}
                  style={{ backgroundColor: c.value }}
                >
                  {draft.labelColor === c.value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>`;

const newLayout = `          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] p-3 shadow-sm">
            <span className="block text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide mb-2">Màu sự kiện</span>
            <div className="flex flex-wrap items-center gap-2">
              {colors.map(c => (
                <button 
                  key={c.value} 
                  type="button" 
                  onClick={() => setDraft({ ...draft, labelColor: c.value })}
                  className={\`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center transition-all \${draft.labelColor === c.value ? "scale-105 ring-2 ring-offset-1 ring-[#D4AF37]" : ""}\`}
                  style={{ backgroundColor: c.value }}
                >
                  {draft.labelColor === c.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>`;

code = code.replace(oldLayout, newLayout);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log('Done.');
