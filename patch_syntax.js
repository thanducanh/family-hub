const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/family-app.tsx');
let content = fs.readFileSync(file, 'utf8');

const t1 = `                ) : (
                  <p className="mt-2 text-[12px] italic text-[#6B5E64]">Chưa có khoản tạm tính.</p>
                  <button onClick={() => window.location.href = \`/members/\${user?.memberId || user?.id}/bank-cards/\${c.id}\`} className="mt-3 w-full rounded-xl bg-[#F8E7EC] border border-[#800020] py-2.5 text-[13px] font-bold text-[#800020] shadow-sm active:scale-[0.98] transition-transform">Chi tiết</button>
                )}`;

const r1 = `                ) : (
                  <>
                    <p className="mt-2 text-[12px] italic text-[#6B5E64]">Chưa có khoản tạm tính.</p>
                    <button onClick={() => window.location.href = \`/members/\${user?.memberId || user?.id}/bank-cards/\${c.id}\`} className="mt-3 w-full rounded-xl bg-[#F8E7EC] border border-[#800020] py-2.5 text-[13px] font-bold text-[#800020] shadow-sm active:scale-[0.98] transition-transform">Chi tiết</button>
                  </>
                )}`;

const t2 = `                ) : (
                  <p className="pt-8 pb-4 text-center text-[12px] italic text-[#6B5E64]">Chưa có khoản tạm tính.</p>
                  <button onClick={() => window.location.href = \`/members/\${user?.memberId || user?.id}/bank-cards/\${c.id}\`} className="w-full rounded-xl bg-[#F8E7EC] border border-[#800020] py-2.5 text-[13px] font-bold text-[#800020] shadow-sm active:scale-[0.98] transition-transform">Chi tiết</button>
                )}`;

const r2 = `                ) : (
                  <>
                    <p className="pt-8 pb-4 text-center text-[12px] italic text-[#6B5E64]">Chưa có khoản tạm tính.</p>
                    <button onClick={() => window.location.href = \`/members/\${user?.memberId || user?.id}/bank-cards/\${c.id}\`} className="w-full rounded-xl bg-[#F8E7EC] border border-[#800020] py-2.5 text-[13px] font-bold text-[#800020] shadow-sm active:scale-[0.98] transition-transform">Chi tiết</button>
                  </>
                )}`;

content = content.replace(t1, r1);
content = content.replace(t2, r2);

fs.writeFileSync(file, content, 'utf8');
console.log('patched family-app syntax error');
