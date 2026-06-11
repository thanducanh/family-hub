const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

c = c.replace('function MemberJobDetail', 'function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-slate-400">{label}</p><b className="mt-1 block text-sm">{value}</b></div>; }\nfunction MemberJobDetail');

fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Added Info component cleanly');
