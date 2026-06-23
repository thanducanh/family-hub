const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const targetStr = '<button className={`pb-3 border-b-2 transition-colors ${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}`} onClick={() => setActiveSystemTab("log")}>\n            Nhật ký lỗi\n          </button>\n        </div>';
const replacementStr = '<button className={`pb-3 border-b-2 transition-colors ${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}`} onClick={() => setActiveSystemTab("log")}>\n            Nhật ký lỗi\n          </button>\n          {isAdmin && (\n            <button className={`pb-3 border-b-2 transition-colors ${activeSystemTab === "permissions" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}`} onClick={() => setActiveSystemTab("permissions")}>\n              Phân quyền\n            </button>\n          )}\n        </div>';

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log('Tab patched');
