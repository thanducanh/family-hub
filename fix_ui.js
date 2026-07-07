const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

c = c.replace(/<div className="rounded-xl bg=\\[#F8F5F2\\] p-3\"><p className=\"text-\\[12px\\] font-semibold text-\\[#6B5E64\\]\">Tiền đang có hiện tại<\/p>.*?<\/div>/, '');
c = c.replace(/<div className="rounded-xl bg=\[#F8F5F2\] p-3"><p className="text-\[12px\] font-semibold text-\[#6B5E64\]">Tiền đang có hiện tại<\/p>.*?<\/div>/, '');

fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Removed text');
