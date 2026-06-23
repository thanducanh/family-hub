const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// 1. Pass user
code = code.replace(/<MobileSystemScreen go=\{go\} \/>/, '<MobileSystemScreen go={go} user={user} />');
code = code.replace(/function MobileSystemScreen\(\{ go \}: \{ go: \(s: Screen\) => void \}\) \{/, 'function MobileSystemScreen({ go, user }: { go: (s: Screen) => void; user: any }) {');

// 2. Add state
const stateToAdd = `
  const [activeSystemTab, setActiveSystemTab] = useState<"log" | "permissions">("log");
  const [members, setMembers] = useState<Member[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<Required<MemberPermissions>>({
    modules: { finance: true, calendar: true, tasks: true, notes: true, members: true, stats: true, settings: true },
    viewMode: "self_only",
    visibleMemberIds: []
  });
  const isAdmin = user?.role === "full_access";

  const loadMembersForPermissions = async () => {
    if (!isAdmin) return;
    setPermissionsLoading(true);
    setPermissionError("");
    try {
      const res = await fetch("/api/members");
      const result = await readJsonSafe<{ ok?: boolean; data?: Member[] }>(res);
      if (res.ok && result?.ok && result.data) setMembers(result.data);
    } catch {
      setPermissionError("Không thể tải danh sách.");
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSystemTab === "permissions") loadMembersForPermissions();
  }, [activeSystemTab]);

  const openPermissionEditor = (member: Member) => {
    setEditingMember(member);
    setPermissionDraft(normalizeMemberPermissions(member.permissions));
    setPermissionError("");
  };

  const savePermissions = async () => {
    if (!editingMember) return;
    setPermissionsLoading(true);
    setPermissionError("");
    try {
      const response = await fetch(\`/api/member-permissions/\${encodeURIComponent(editingMember.id)}\`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissionDraft),
      });
      const result = await readJsonSafe<{ ok?: boolean; error?: string; member?: { permissions?: MemberPermissions } }>(response);
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Không thể lưu phân quyền.");
      setMembers(current => current.map(item => item.id === editingMember.id ? { ...item, permissions: result.member?.permissions || permissionDraft } : item));
      addAppLog("ACTION", \`Admin đã cập nhật phân quyền cho \${editingMember.name}\`, { screen: "system" });
      setEditingMember(null);
      loadLogs();
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : "Không thể lưu phân quyền.");
    } finally {
      setPermissionsLoading(false);
    }
  };
`;
code = code.replace(/const \[activeSystemTab, setActiveSystemTab\] = useState<"log">.*?;/, stateToAdd);

// 3. Fix tabs UI
const tabsSearch = `<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white/20">
          <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("log")}>
            Nhật ký lỗi
          </button>
        </div>`;

const tabsReplace = `<div className="flex px-4 gap-6 text-sm font-semibold border-b border-white/20">
          <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "log" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("log")}>
            Nhật ký lỗi
          </button>
          {isAdmin && (
            <button className={\`pb-3 border-b-2 transition-colors \${activeSystemTab === "permissions" ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-white/70"}\`} onClick={() => setActiveSystemTab("permissions")}>
              Phân quyền
            </button>
          )}
        </div>`;
code = code.replace(tabsSearch, tabsReplace);

// 4. Add Permissions View
const logViewEndSearch = `          </div>
        )}
      </div>`;

const permissionsView = `
        {activeSystemTab === "permissions" && (
          <div className="space-y-4">
            {!isAdmin ? (
              <div className="rounded-2xl border border-[#E8DCD5] bg-white p-6 text-center shadow-sm">
                <p className="text-[15px] font-bold text-[#171018]">Chỉ admin mới được cấu hình phân quyền.</p>
              </div>
            ) : permissionsLoading && members.length === 0 ? (
              <div className="rounded-2xl border border-[#E8DCD5] bg-white p-6 text-center text-[13px] font-bold text-[#800020] shadow-sm">Đang tải...</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[13px] font-bold text-[#171018]">Thành viên ({members.length})</h2>
                  <button onClick={loadMembersForPermissions} className="h-[36px] rounded-lg border border-[#E8DCD5] bg-white px-3 text-[12px] font-bold text-[#800020] shadow-sm">Làm mới</button>
                </div>
                {permissionError && <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12px] font-bold text-[#B91C1C]">{permissionError}</p>}
                <div className="space-y-3">
                  {members.map(member => {
                    const permissions = normalizeMemberPermissions(member.permissions);
                    const enabledCount = PERMISSION_MODULES.filter(item => permissions.modules[item.key]).length;
                    const viewLabel = permissions.viewMode === "all" ? "Tất cả" : permissions.viewMode === "custom" ? "Tùy chỉnh" : "Chỉ mình";
                    return (
                      <button key={member.id} onClick={() => openPermissionEditor(member)} className="w-full rounded-2xl border border-[#E8DCD5] bg-white p-4 text-left shadow-sm active:opacity-80">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-[#171018]">{member.nickname || member.name}</p>
                            <p className="mt-1 text-[12px] font-semibold text-[#6B5E64]">{viewLabel} - {enabledCount}/{PERMISSION_MODULES.length} module</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#F8E7EC] px-3 py-1 text-[12px] font-bold text-[#800020]">Sửa</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}`;

code = code.replace(logViewEndSearch, logViewEndSearch + permissionsView);

// 5. Add Editor Modal
const clearConfirmSearch = `{clearConfirmOpen && (`;
const editorModal = `{editingMember && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 pointer-events-auto" onClick={() => setEditingMember(null)}>
          <div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] border border-[#E8DCD5] bg-white p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[#E8DCD5]" />
            <div className="mb-4">
              <h3 className="text-lg font-bold text-[#171018]">Phân quyền</h3>
              <p className="mt-1 text-[13px] font-semibold text-[#6B5E64]">{editingMember.nickname || editingMember.name}</p>
            </div>

            <div className="space-y-4 pb-4">
              <label className="flex items-center justify-between rounded-2xl bg-[#FFFFFF] border border-[#E8DCD5] p-4 shadow-sm active:opacity-80">
                <div className="min-w-0 pr-3">
                  <p className="text-[14px] font-bold text-[#171018]">Cho xem tất cả nội dung</p>
                  <p className="mt-1 text-[12px] text-[#6B5E64]">Bật tất cả module & phạm vi thành viên</p>
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
                <div className="space-y-2">
                  {PERMISSION_MODULES.map(item => (
                    <label key={item.key} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-[13px] font-bold text-[#171018]">
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
                      className={\`rounded-xl border px-2 py-3 text-[12px] font-bold \${permissionDraft.viewMode === option.id ? "border-[#800020] bg-[#800020] text-white" : "border-[#E8DCD5] bg-white text-[#6B5E64]"}\`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {permissionDraft.viewMode === "custom" && (
                  <div className="mt-3 space-y-2">
                    {members.map(member => (
                      <label key={member.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-[13px] font-semibold text-[#171018]">
                        <span className="truncate">{member.nickname || member.name}</span>
                        <input
                          type="checkbox"
                          className="size-5 accent-[#800020]"
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
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setEditingMember(null)} className="rounded-xl border border-[#E8DCD5] px-4 py-3 text-sm font-bold text-[#171018]">Hủy</button>
                <button type="button" disabled={permissionsLoading} onClick={savePermissions} className="rounded-xl bg-[#800020] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{permissionsLoading ? "Đang lưu..." : "Lưu"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      `;
code = code.replace(clearConfirmSearch, editorModal + clearConfirmSearch);

// 6. Ensure normalizeMemberPermissions and PERMISSION_MODULES exist
if (!code.includes("function normalizeMemberPermissions")) {
  const helpers = `
const PERMISSION_MODULES = [
  { key: "finance", label: "Thu chi" },
  { key: "stats", label: "Thống kê" },
  { key: "calendar", label: "Lịch" },
  { key: "tasks", label: "Công việc" },
  { key: "banks", label: "Thẻ ngân hàng" },
  { key: "sim", label: "SIM" },
  { key: "notes", label: "Ghi chú / Nhật ký" },
];

function normalizeMemberPermissions(value?: MemberPermissions): Required<MemberPermissions> {
  return {
    modules: Object.fromEntries(PERMISSION_MODULES.map(item => [item.key, value?.modules?.[item.key] !== false])),
    viewMode: value?.viewMode === "all" || value?.viewMode === "custom" || value?.viewMode === "self_only" ? value.viewMode : "self_only",
    visibleMemberIds: Array.isArray(value?.visibleMemberIds) ? value.visibleMemberIds : [],
  };
}
`;
  code = code.replace(/function MobileSystemScreen/, helpers + 'function MobileSystemScreen');
}

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log('Patched');
