const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const replacement = `{editingMember && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 pointer-events-auto" onClick={() => setEditingMember(null)}>
          <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] border border-[#E8DCD5] bg-white p-4 pb-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[#E8DCD5]" />
            <div className="mb-4">
              <h3 className="text-[18px] font-bold text-[#171018]">Phân quyền</h3>
              <p className="mt-1 text-[13px] font-semibold text-[#6B5E64]">{editingMember.nickname || editingMember.name}</p>
            </div>

            <div className="space-y-4 pb-4">
              <label className="flex items-center justify-between rounded-2xl bg-[#FFFFFF] border border-[#E8DCD5] p-3 shadow-sm active:opacity-80">
                <div className="min-w-0 pr-3">
                  <p className="text-[13px] font-bold text-[#171018]">Cho xem tất cả nội dung</p>
                  <p className="mt-1 text-[11px] text-[#6B5E64]">Bật tất cả module & phạm vi thành viên</p>
                </div>
                <input
                  type="checkbox"
                  className="size-5 accent-[#800020] shrink-0"
                  checked={permissionDraft.viewMode === "all" && PERMISSION_MODULES.every(m => permissionDraft.modules[m.key] !== false)}
                  onChange={e => {
                    const checked = e.target.checked;
                    if (checked) {
                      const allModules = Object.fromEntries(PERMISSION_MODULES.map(m => [m.key, true]));
                      setPermissionDraft(c => ({ ...c, viewMode: "all", modules: allModules }));
                    } else {
                      setPermissionDraft(c => ({ ...c, viewMode: "self_only" }));
                    }
                  }}
                />
              </label>

              <section className="rounded-2xl border border-[#E8DCD5] bg-[#F8F5F2] p-3">
                <p className="mb-3 text-[12px] font-bold uppercase text-[#800020]">Module được xem</p>
                <div className="space-y-[6px]">
                  {PERMISSION_MODULES.map(item => (
                    <label key={item.key} className="flex h-[38px] items-center justify-between rounded-xl bg-white px-[10px] text-[13px] font-bold text-[#171018]">
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        className="size-5 accent-[#800020]"
                        checked={permissionDraft.modules[item.key] !== false}
                        onChange={event => setPermissionDraft(current => ({ ...current, modules: { ...current.modules, [item.key]: event.target.checked } }))}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E8DCD5] bg-[#F8F5F2] p-3">
                <p className="mb-3 text-[12px] font-bold uppercase text-[#800020]">Phạm vi dữ liệu</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "self_only" as const, label: "Tự xem" },
                    { id: "all" as const, label: "Tất cả" },
                    { id: "custom" as const, label: "Tùy chỉnh" },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPermissionDraft(current => ({ ...current, viewMode: option.id }))}
                      className={\`flex h-[44px] items-center justify-center rounded-xl border px-2 text-[13px] font-bold \${permissionDraft.viewMode === option.id ? "border-[#800020] bg-[#800020] text-white" : "border-[#E8DCD5] bg-white text-[#6B5E64]"}\`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {permissionDraft.viewMode === "custom" && (
                  <div className="mt-3 space-y-[6px]">
                    {members.map(member => (
                      <label key={member.id} className="flex h-[38px] items-center justify-between rounded-xl bg-white px-[10px] text-[13px] font-semibold text-[#171018]">
                        <span className="truncate pr-2">{member.nickname || member.name}</span>
                        <input
                          type="checkbox"
                          className="size-5 accent-[#800020] shrink-0"
                          checked={permissionDraft.visibleMemberIds.includes(member.id)}
                          onChange={event => setPermissionDraft(current => ({
                            ...current,
                            visibleMemberIds: event.target.checked
                              ? Array.from(new Set([...current.visibleMemberIds, member.id]))
                              : current.visibleMemberIds.filter(id => id !== member.id),
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {permissionError && <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12px] font-bold text-[#B91C1C]">{permissionError}</p>}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setEditingMember(null)} className="flex h-[44px] items-center justify-center rounded-xl border border-[#E8DCD5] bg-white text-[14px] font-bold text-[#171018]">Hủy</button>
                <button type="button" disabled={permissionsLoading} onClick={savePermissions} className="flex h-[44px] items-center justify-center rounded-xl bg-[#800020] text-[14px] font-bold text-white disabled:opacity-50">{permissionsLoading ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </div>
          </div>
        </div>
      )}`;

const startRegex = /\{editingMember && \(\s*<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black\/50 pointer-events-auto"/;
const endMarker = `      {clearConfirmOpen && (`;

let startIndex = code.search(startRegex);
if (startIndex !== -1) {
  let endIndex = code.indexOf(endMarker, startIndex);
  if (endIndex !== -1) {
    // Cut out the old editingMember block
    const newCode = code.slice(0, startIndex) + replacement + '\n      \n' + code.slice(endIndex);
    fs.writeFileSync('src/components/family-app.tsx', newCode, 'utf8');
    console.log('Replaced modal successfully.');
  } else {
    console.log('Could not find endMarker');
  }
} else {
  console.log('Could not find startRegex');
}
