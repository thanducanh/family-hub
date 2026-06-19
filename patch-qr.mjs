import { readFileSync, writeFileSync } from "fs";

const file = "src/components/family-app.tsx";
let src = readFileSync(file, "utf8");
const lfSrc = src.replace(/\r\n/g, "\n");
let result = lfSrc;

// 1. Add import QRCode
if (!result.includes('import QRCode from "react-qr-code";')) {
  result = result.replace('import * as XLSX from "xlsx";', 'import * as XLSX from "xlsx";\nimport QRCode from "react-qr-code";');
}

// 2. Replace MobileProfileBusinessCardSheet
const oldFn = `function MobileProfileBusinessCardSheet({ user, data, close }: any) {
  const member = data?.members?.find((m: any) => m.id === user.memberId) || user.member;
  return <FullScreenMobileSheet title="Danh thiếp" close={close}>
    <div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[var(--app-bg)] pb-10 flex flex-col items-center pt-8 px-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-gradient-to-br from-[#003f3a] to-[#012f2d] p-6 text-white shadow-2xl ring-1 ring-white/10 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 size-40 rounded-full bg-[#facc15]/10 blur-2xl" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <AccountAvatar user={{ avatar: member?.avatar || user.avatar, displayName: member?.name || user.displayName }} size="size-24 border-4 border-white/20 shadow-xl" />
          <h2 className="mt-5 text-2xl font-bold tracking-tight">{member?.name || user.displayName}</h2>
          <p className="mt-1 text-sm font-medium text-[#facc15]">{member?.role || "Thành viên"}</p>
          <div className="mt-8 w-full space-y-4 rounded-2xl bg-black/20 p-5 text-left backdrop-blur-md ring-1 ring-white/10">
            {member?.phone && <div className="flex items-center gap-3"><svg viewBox="0 0 24 24" className="size-5 text-[#cbd5e1]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span className="text-sm font-semibold">{member.phone}</span></div>}
            {(user.email || member?.email) && <div className="flex items-center gap-3"><svg viewBox="0 0 24 24" className="size-5 text-[#cbd5e1]" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span className="text-sm font-semibold">{user.email || member?.email}</span></div>}
          </div>
          <div className="mt-8 bg-white p-3 rounded-2xl shadow-inner">
             <div className="size-32 bg-slate-100 flex items-center justify-center border-4 border-white">
                <svg viewBox="0 0 24 24" className="size-20 text-slate-300" fill="currentColor"><path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm13-2h-4v2h4zm-4 4h-2v4h2zm2 2h2v2h-2zm2-2h2v-2h-2zm0-4h2v2h-2z"/></svg>
             </div>
          </div>
        </div>
      </div>
    </div>
  </FullScreenMobileSheet>;
}`;

const newFn = `function MobileProfileBusinessCardSheet({ user, data, close }: any) {
  const member = data?.members?.find((m: any) => m.id === user.memberId) || user.member;
  
  const name = member?.name || user.displayName || "";
  const phone = member?.phone || "";
  const email = user.email || member?.email || "";
  const role = member?.role || "Thành viên";
  
  const vCard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    \`FN:\${name}\`,
    \`TITLE:\${role}\`,
    phone ? \`TEL;TYPE=cell:\${phone}\` : "",
    email ? \`EMAIL;TYPE=work:\${email}\` : "",
    \`URL:\${typeof window !== "undefined" ? window.location.origin : ""}\`,
    "END:VCARD"
  ].filter(Boolean).join("\\n");

  return <FullScreenMobileSheet title="Danh thiếp" close={close}>
    <div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[var(--app-bg)] pb-10 flex flex-col items-center pt-8 px-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-gradient-to-br from-[#003f3a] to-[#012f2d] p-6 text-white shadow-2xl ring-1 ring-white/10 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 size-40 rounded-full bg-[#facc15]/10 blur-2xl" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <AccountAvatar user={{ avatar: member?.avatar || user.avatar, displayName: name }} size="size-24 border-4 border-white/20 shadow-xl" />
          <h2 className="mt-5 text-2xl font-bold tracking-tight">{name}</h2>
          <p className="mt-1 text-sm font-medium text-[#facc15]">{role}</p>
          <div className="mt-8 w-full space-y-4 rounded-2xl bg-black/20 p-5 text-left backdrop-blur-md ring-1 ring-white/10">
            {phone && <div className="flex items-center gap-3"><svg viewBox="0 0 24 24" className="size-5 text-[#cbd5e1]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span className="text-sm font-semibold">{phone}</span></div>}
            {email && <div className="flex items-center gap-3"><svg viewBox="0 0 24 24" className="size-5 text-[#cbd5e1]" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span className="text-sm font-semibold">{email}</span></div>}
          </div>
          <div className="mt-8 bg-white p-3 rounded-2xl shadow-inner">
             <QRCode value={vCard} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
        </div>
      </div>
      <button onClick={() => {
         if (navigator.share) {
            navigator.share({
               title: name,
               text: \`Liên hệ \${name} - \${role}\`,
               url: window.location.origin
            }).catch(() => {});
         }
      }} className="mt-8 flex items-center gap-2 rounded-full bg-[#064e46] px-6 py-3 text-sm font-bold text-white shadow-lg active:scale-95 transition-transform border border-[#facc15]/30">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>
        Chia sẻ danh thiếp
      </button>
    </div>
  </FullScreenMobileSheet>;
}`;

if (!result.includes(oldFn)) { console.error("MobileProfileBusinessCardSheet not found!"); process.exit(1); }
result = result.replace(oldFn, newFn);

result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("Successfully added QRCode!");
