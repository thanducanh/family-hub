const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// 1. Replace isAdmin check using regex
code = code.replace(
  /const checkAdmin = \(u: any\) => \{[\s\S]*?const isAdmin = checkAdmin\(user\);/,
  `const isPermissionAdmin = (u: any, m?: any) => {
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
  const isAdmin = isPermissionAdmin(user, user?.member);`
);

// Wait, checkAdmin was probably reverted to `const isAdmin = user?.role === "full_access";` because I did git restore!
code = code.replace(
  /const isAdmin = user\?\.role === "full_access";/,
  `const isPermissionAdmin = (u: any, m?: any) => {
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
  const isAdmin = isPermissionAdmin(user, user?.member);`
);


// 2. Fix QR 404
code = code.replace(
  /<img src="\/images\/bidv-qr\.png".*?\/>/,
  '<span className="text-[11px] font-bold text-[#6B5E64] opacity-50 text-center">Chưa có mã<br/>thanh toán</span>'
);


// 3. Fix the tabs in MobileSystemScreen using regex
code = code.replace(
  /<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white\/20">\s*<button className=\{`pb-3 border-b-2 transition-colors \$\{activeSystemTab === "log" \? "border-\[#D4AF37\] text-\[#D4AF37\]" : "border-transparent text-white\/70"\}`\} onClick=\{.*\}>\s*Nhật ký lỗi\s*<\/button>\s*<\/div>/,
  `<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white/20">
          <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("log")}>
            Nhật ký lỗi
          </button>
          {isAdmin && (
            <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "permissions" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("permissions")}>
              Phân quyền
            </button>
          )}
        </div>`
);


// Write back
fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log("All patches applied.");
