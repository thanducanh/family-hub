const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

content = content.replace(
  /<span className={`font-bold text-\[13px\] \${item\.ConLai >= 0 \? "text-\[#059669\]" : "text-\[#E11D48\]"}`}>\s*(?:CAn li|Còn lại):\s*\{money\(item\.ConLai\)\}<\/span>/g,
  `{item.isFuture ? (
                          <span className="font-bold text-[13px] text-[#6B5E64]">Chưa tới tháng</span>
                        ) : item.isCurrent ? (
                          <span className={\`font-bold text-[13px] \${item.ConLai >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>Hiện tại: {money(item.ConLai)}</span>
                        ) : (
                          <span className={\`font-bold text-[13px] \${item.ConLai >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>Còn lại: {money(item.ConLai)}</span>
                        )}`
);

fs.writeFileSync(file, content);
console.log("Patched MobileStats table (regex)");
