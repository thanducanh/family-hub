const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// 1. Fix the isAdmin check
const adminCheckTarget = `  const checkAdmin = (u: any) => {
    if (!u) return false;
    if (u.isAdmin) return true;
    if (u.username === "admin") return true;
    const roles = [u.role, u.systemRole, u.permission, u.accessLevel, u.memberRole].filter(Boolean).map(String);
    const adminRoles = ["admin", "full_access", "system_admin", "quản lý gia đình", "toàn quyền"];
    return roles.some(r => adminRoles.includes(r.toLowerCase()));
  };
  const isAdmin = checkAdmin(user);`;

const adminCheckReplacement = `  const isPermissionAdmin = (u: any, m?: any) => {
    if (!u) return false;
    if (u.isAdmin) return true;
    if (u.username === "admin") return true;
    if (u.name === "admin") return true;
    if (u.email === "admin") return true;
    const adminRoles = ["admin", "full_access", "system_admin", "manager", "owner", "quản lý gia đình", "quan ly gia dinh", "toàn quyền", "toan quyen"];
    const uRoles = [u.role, u.systemRole, u.permission, u.accessLevel, u.memberRole].filter(Boolean).map(String);
    if (uRoles.some(r => adminRoles.includes(r.toLowerCase()))) return true;
    if (m) {
      const mRoles = [m.role, m.systemRole, m.permission, m.accessLevel, m.relationship, m.title].filter(Boolean).map(String);
      if (mRoles.some(r => adminRoles.includes(r.toLowerCase()))) return true;
    }
    return false;
  };
  const isAdmin = isPermissionAdmin(user, user?.member);`;

// We use regex to replace it independent of line endings
code = code.replace(adminCheckTarget.replace(/\\r\\n/g, '\\n'), adminCheckReplacement);
code = code.replace(adminCheckTarget.replace(/\\n/g, '\\r\\n'), adminCheckReplacement);


// 2. Fix QR 404
const qrTarget = `<img src="/images/bidv-qr.png" alt="BIDV QR" className="max-h-full max-w-full object-contain" />`;
const qrReplacement = `<span className="text-[11px] font-bold text-[#6B5E64] opacity-50 text-center">Chưa có mã<br/>thanh toán</span>`;
code = code.replace(qrTarget, qrReplacement);


// 3. Fix the tabs in MobileSystemScreen
const tabTarget = `<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white/20">
          <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("log")}>
            Nhật ký lỗi
          </button>
        </div>`;

const tabReplacement = `<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white/20">
          <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("log")}>
            Nhật ký lỗi
          </button>
          {isAdmin && (
            <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "permissions" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("permissions")}>
              Phân quyền
            </button>
          )}
        </div>`;

code = code.replace(tabTarget.replace(/\\r\\n/g, '\\n'), tabReplacement);
code = code.replace(tabTarget.replace(/\\n/g, '\\r\\n'), tabReplacement);


// Write back
fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log("All patches applied.");
