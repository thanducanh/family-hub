const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// Target 1: MobileHome wrapper and Hero
let s = code.indexOf('function MobileHome(');
let end = code.indexOf('function DesktopHome', s);
let mobileHomeCode = code.substring(s, end);

mobileHomeCode = mobileHomeCode.replace(
  /<div className="min-h-\[100dvh\] overflow-x-hidden bg-\[#003f3a\] pb-24 font-\[Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif\] text-white">/g,
  '<div className="min-h-[100dvh] overflow-x-hidden bg-[#F8F5F2] pb-24 font-[Inter,system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif] text-[#171018]">'
);

mobileHomeCode = mobileHomeCode.replace(
  /<div className="absolute inset-0 bg-black\/55 pointer-events-none z-0" \/>/g,
  '<div className="absolute inset-0 bg-black/30 pointer-events-none z-0" />'
);

mobileHomeCode = mobileHomeCode.replace(
  /<div className="absolute inset-0 bg-black\/40 pointer-events-none z-0" \/>/g,
  '<div className="absolute inset-0 bg-black/30 pointer-events-none z-0" />'
);

mobileHomeCode = mobileHomeCode.replace(
  /bg-gradient-to-br from-\[#003f3a\] to-\[#012f2d\]/g,
  'bg-gradient-to-br from-[#800020]/90 to-[#4A0012]/95 backdrop-blur-sm'
);

// Target 2: Account area and buttons
mobileHomeCode = mobileHomeCode.replace(
  /<button type="button" onClick={openProfile} className="flex h-16 w-full items-center gap-3 rounded-\[20px\] bg-black\/25 px-3 text-left text-white ring-1 ring-white\/15 backdrop-blur-md active:bg-black\/40">[\s\S]*?<b className="block truncate text-sm text-white">{user\.displayName \|\| user\.username}<\/b>[\s\S]*?<span className="text-xl font-light text-white">›<\/span>\s*<\/button>/,
  `<button type="button" onClick={openProfile} className="flex w-full items-center justify-between text-left active:opacity-70 px-1 mb-2 pointer-events-auto">
              <div>
                <span className="block text-[11px] font-semibold text-white/80 uppercase tracking-wider mb-0.5">TÀI KHOẢN</span>
                <b className="block truncate text-[15px] font-bold text-white drop-shadow-md">{user.displayName || user.username}</b>
              </div>
              <span className="text-xl font-light text-white opacity-80">›</span>
            </button>`
);

mobileHomeCode = mobileHomeCode.replace(
  /<div className="grid grid-cols-2 gap-3 pointer-events-auto">\s*<button type="button" onClick={\(\) => setShowMembers\(true\)} className="h-11 min-w-0 rounded-full bg-\[#facc15\] px-3 text-\[13px\] font-bold text-\[#003f3a\] shadow-sm active:scale-\[\.99\]">Thành viên<\/button>\s*<button type="button" onClick={\(\) => go\("finance"\)} className="h-11 min-w-0 rounded-full bg-\[#064e46\]\/80 px-3 text-\[13px\] font-bold text-white shadow-sm ring-1 ring-white\/50 backdrop-blur-sm active:scale-\[\.99\]">Quản lý thu chi<\/button>\s*<\/div>/,
  `<div className="grid grid-cols-2 gap-3 pointer-events-auto">
              <button type="button" onClick={() => setShowMembers(true)} className="h-11 min-w-0 rounded-full bg-[#800020] px-3 text-[13px] font-bold text-white shadow-sm active:scale-[.99]">Thành viên</button>
              <button type="button" onClick={() => go("settings")} className="h-11 min-w-0 rounded-full border border-[#800020] bg-white px-3 text-[13px] font-bold text-[#800020] shadow-sm active:scale-[.99]">Hệ thống</button>
            </div>`
);

// Target 3: Thông tin cá nhân section
const infoSectionRe = /<section className="rounded-\[20px\] bg-\[#064e46\] p-4 shadow-sm border border-white\/5">\s*<h2 className="text-\[14px\] font-semibold text-white mb-3">Thông tin cá nhân<\/h2>\s*<div className="grid grid-cols-3 gap-y-4 gap-x-2">\s*\{\[[\s\S]*?\]\.map\(\(\[label, icon, action\]: any\) => \([\s\S]*?<\/button>\s*\)\)\}\s*<\/div>\s*<\/section>/;

mobileHomeCode = mobileHomeCode.replace(infoSectionRe,
`<section className="rounded-[20px] bg-white p-4 shadow-sm border border-[#E8DCD5]">
          <h2 className="text-[14px] font-bold text-[#171018] mb-4">Thông tin cá nhân</h2>
          <div className="flex flex-wrap items-start justify-between gap-y-4">
            {[
              ["Thông tin", <UserIcon />, () => setProfileSheet("info")],
              ["Tài khoản", <LockIcon />, () => setProfileSheet("account")],
              ["Danh thiếp", <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><circle cx="12" cy="10" r="2"></circle><line x1="8" x2="8" y1="2" y2="4"></line><line x1="16" x2="16" y1="2" y2="4"></line></svg>, () => setProfileSheet("card")],
              ["SIM", <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>, () => setProfileSheet("sim")],
              ["Thu chi", <WalletIcon />, () => go("finance")]
            ].map(([label, icon, action]: any) => (
              <button key={label as string} onClick={action} className="flex min-w-[64px] flex-col items-center justify-start gap-2 rounded-2xl text-center text-[11px] font-semibold text-[#171018] active:opacity-70 transition-opacity">
                <div className="flex size-[42px] items-center justify-center rounded-[14px] bg-[#F8E7EC] text-[#800020] ring-1 ring-[#D4AF37]/50 drop-shadow-sm [&>svg]:size-[20px]">
                  {icon}
                </div>
                <span className="truncate w-full leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </section>`);

// Also change the header text to white because we changed the wrapper text to #171018
mobileHomeCode = mobileHomeCode.replace(
  /<p className="text-\[12px\] font-medium text-cyan-100\/90">\{greeting\}!<\/p>/,
  '<p className="text-[12px] font-medium text-white/90">{greeting}!</p>'
);

code = code.substring(0, s) + mobileHomeCode + code.substring(end);

// Target 4: Bottom nav
code = code.replace(
  /bg-\[#012f2d\]\/92/g,
  'bg-[#800020]'
);

code = code.replace(
  /const activeColor = "text-\[#facc15\]";/g,
  'const activeColor = "text-[#D4AF37]";'
);

code = code.replace(
  /const inactiveColor = "text-\[#cbd5e1\]";/g,
  'const inactiveColor = "text-[#FFFFFF]";'
);

// Guest Bottom nav active colors
code = code.replace(
  /active \? "text-\[#facc15\]" : "text-\[#cbd5e1\]"/g,
  'active ? "text-[#D4AF37]" : "text-[#FFFFFF]"'
);

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log('MobileHome patched successfully!');
