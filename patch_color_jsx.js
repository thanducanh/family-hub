const fs = require('fs');
let code = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// The JSX block starting with <div className="flex items-center gap-4">
// ending with </div> after the map
const regex = /<div className="flex items-center gap-4">\s*\{colors\.map\(c => \(\s*<button[\s\S]*?<\/svg>\}[\s\S]*?<\/button>\s*\)\)\}\s*<\/div>/g;

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

if (regex.test(code)) {
    code = code.replace(regex, newJSX);
    fs.writeFileSync('src/components/timetree-calendar.tsx', code, 'utf8');
    console.log("Replaced successfully");
} else {
    console.log("Regex did not match");
}
