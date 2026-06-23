const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. Update colors array
const oldColorsArray = `  const colors = [
    { value: "#800020", label: "Wine Red" },
    { value: "#D4AF37", label: "Gold" },
    { value: "#059669", label: "Green" },
    { value: "#E11D48", label: "Red" },
    { value: "#2563EB", label: "Blue" },
  ];`;

const newColorsArray = `  const colors = [
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

code = code.replace(oldColorsArray, newColorsArray);

// 2. Update JSX layout
const oldJSX = `<div className="flex items-center gap-4">
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
            </div>`;

const newJSX = `<div className="flex flex-wrap items-center gap-2">
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

code = code.replace(oldJSX, newJSX);

fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
console.log("Done");
