import { readFileSync, writeFileSync } from "fs";

const file = "src/components/family-app.tsx";
let src = readFileSync(file, "utf8");
const lfSrc = src.replace(/\r\n/g, "\n");
let result = lfSrc;

// 1. Insert 3 new components before MobileHome
const newComponents = `
function MobileProfileInfoSheet({ user, data, close }: any) {
  const member = data?.members?.find((m: any) => m.id === user.memberId) || user.member;
  if (!member) return <FullScreenMobileSheet title="Thông tin cá nhân" close={close}><div className="p-8 text-center text-slate-400">Không có dữ liệu thành viên.</div></FullScreenMobileSheet>;
  return <FullScreenMobileSheet title="Thông tin cá nhân" close={close}>
    <div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[var(--app-bg)] pb-10">
      <div className="bg-[#003f3a] px-4 py-8 text-center shadow-md">
        <AccountAvatar user={{ avatar: member.avatar || user.avatar, displayName: member.name || user.displayName }} size="size-24 mx-auto border-4 border-[#064e46]" />
        <h2 className="mt-4 text-xl font-bold text-white">{member.name || user.displayName}</h2>
        {member.nickname && <p className="text-sm font-medium text-[#facc15]">{member.nickname}</p>}
      </div>
      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--app-card)] border border-slate-200 dark:border-white/5 space-y-4">
          <Field label="Tên hiển thị hệ thống"><div className="text-sm font-semibold">{user.displayName}</div></Field>
          <Field label="Email"><div className="text-sm font-semibold">{user.email || member.email || "-"}</div></Field>
          <Field label="Số điện thoại"><div className="text-sm font-semibold">{member.phone || "-"}</div></Field>
          <Field label="Ngày sinh"><div className="text-sm font-semibold">{member.birthday ? new Date(member.birthday).toLocaleDateString("vi-VN") : "-"}</div></Field>
          <Field label="Giới tính"><div className="text-sm font-semibold">{member.gender === "nam" ? "Nam" : member.gender === "nu" ? "Nữ" : "Khác"}</div></Field>
          <Field label="Quyền hệ thống"><div className="text-sm font-semibold">{user.role === "full_access" ? "Quản lý gia đình" : "Thành viên"}</div></Field>
          {member.notes && <Field label="Ghi chú"><div className="text-sm font-semibold whitespace-pre-wrap">{member.notes}</div></Field>}
        </div>
      </div>
    </div>
  </FullScreenMobileSheet>;
}

function MobileProfileAccountSheet({ user, close, openChangePassword }: any) {
  return <FullScreenMobileSheet title="Tài khoản" close={close}>
    <div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[var(--app-bg)] pb-10">
      <div className="p-4 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[var(--app-card)] border border-slate-200 dark:border-white/5 space-y-4">
          <Field label="Tên đăng nhập"><div className="text-sm font-bold">{user.username}</div></Field>
          <Field label="Mật khẩu"><div className="text-sm font-bold tracking-widest text-slate-500">••••••••</div></Field>
        </div>
        <button onClick={openChangePassword} className="w-full rounded-2xl bg-[#003f3a] py-4 text-sm font-bold text-[#facc15] shadow-sm active:opacity-80">Đổi mật khẩu</button>
      </div>
    </div>
  </FullScreenMobileSheet>;
}

function MobileProfileBusinessCardSheet({ user, data, close }: any) {
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
}

function MobileHome({`;

if (!result.includes('function MobileHome({')) { console.error("MobileHome not found!"); process.exit(1); }
result = result.replace('function MobileHome({', newComponents);

// 2. Modify MobileHome signature to include openChangePassword
const signatureOld = `  showMembers: boolean;
  setShowMembers: (show: boolean) => void;
}) {`;
const signatureNew = `  showMembers: boolean;
  setShowMembers: (show: boolean) => void;
  openChangePassword?: () => void;
}) {`;
if (!result.includes(signatureOld)) { console.error("MobileHome signature not found!"); process.exit(1); }
result = result.replace(signatureOld, signatureNew);

// 3. Add profileSheet state and render logic
const hookOld = `  const [homeFinanceStatus, setHomeFinanceStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");`;
const hookNew = `  const [homeFinanceStatus, setHomeFinanceStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [profileSheet, setProfileSheet] = useState<"info" | "account" | "card" | "bank" | "sim" | null>(null);

  if (profileSheet === "info") return <MobileProfileInfoSheet user={user} data={data} close={() => setProfileSheet(null)} />;
  if (profileSheet === "account") return <MobileProfileAccountSheet user={user} close={() => setProfileSheet(null)} openChangePassword={openChangePassword} />;
  if (profileSheet === "card") return <MobileProfileBusinessCardSheet user={user} data={data} close={() => setProfileSheet(null)} />;
  if (profileSheet === "bank") return <MobileBankSheet member={data.members?.find((m:any) => m.id === user.memberId) || user.member} user={user} close={() => setProfileSheet(null)} />;
  if (profileSheet === "sim") return <MobileSimSheet member={data.members?.find((m:any) => m.id === user.memberId) || user.member} close={() => setProfileSheet(null)} />;`;
if (!result.includes(hookOld)) { console.error("MobileHome hook not found!"); process.exit(1); }
result = result.replace(hookOld, hookNew);

// 4. Update the MobileHome call in Dashboard render (around line 413)
const callOld = `            setEditor={setEditor}
            showMembers={mobileShowMembers}
            setShowMembers={setMobileShowMembers}
          />`;
const callNew = `            setEditor={setEditor}
            showMembers={mobileShowMembers}
            setShowMembers={setMobileShowMembers}
            openChangePassword={() => setChangePasswordOpen(true)}
          />`;
if (!result.includes(callOld)) { console.error("MobileHome call not found!"); process.exit(1); }
result = result.replace(callOld, callNew);

// 5. Replace "Tiện ích" section
const utilSectionOld = `        <section className="rounded-[20px] bg-[#064e46] p-4 shadow-sm border border-white/5">
          <h2 className="text-sm font-bold text-white mb-3">Tiện ích</h2>
          <div className="grid grid-cols-3 gap-3">
            {actions.map(([label, icon, action]) => (
              <button key={label} onClick={action} className="flex h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 px-1 text-center text-[11px] font-semibold text-[#cbd5e1] active:bg-white/10">
                <span className="grid size-8 place-items-center rounded-xl bg-white/10 text-[#facc15] shadow-sm ring-1 ring-white/10">{icon}</span>
                <span className="w-full truncate">{label}</span>
              </button>
            ))}
          </div>
        </section>`;

const utilSectionNew = `        <section className="rounded-[20px] bg-[#064e46] p-4 shadow-sm border border-white/5">
          <h2 className="text-sm font-bold text-white mb-3">Thông tin cá nhân</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Thông tin", <UserIcon />, () => setProfileSheet("info")],
              ["Tài khoản", <LockIcon />, () => setProfileSheet("account")],
              ["Danh thiếp", <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><circle cx="12" cy="10" r="2"></circle><line x1="8" x2="8" y1="2" y2="4"></line><line x1="16" x2="16" y1="2" y2="4"></line></svg>, () => setProfileSheet("card")],
              ["Thẻ ngân hàng", <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>, () => setProfileSheet("bank")],
              ["SIM / Data", <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>, () => setProfileSheet("sim")]
            ].map(([label, icon, action]: any) => (
              <button key={label as string} onClick={action} className="flex h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 px-1 text-center text-[11px] font-semibold text-[#cbd5e1] active:bg-white/10">
                <span className="grid size-8 place-items-center rounded-xl bg-white/10 text-[#facc15] shadow-sm ring-1 ring-white/10">{icon}</span>
                <span className="w-full truncate">{label}</span>
              </button>
            ))}
          </div>
        </section>`;

if (!result.includes(utilSectionOld)) { console.error("Tiện ích section not found!"); process.exit(1); }
result = result.replace(utilSectionOld, utilSectionNew);

result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("Successfully patched MobileHome utility section!");
