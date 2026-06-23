const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const replacement = `        )}

        {activeSystemTab === "permissions" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-[15px] font-bold text-[#171018]">Quản lý phân quyền</h2>
              <p className="text-[12px] text-[#6B5E64] mt-0.5">Cấu hình quyền xem dữ liệu cho từng thành viên</p>
            </div>
            
            {!isAdmin ? (
              <div className="text-center py-10 bg-[#FFFFFF] rounded-2xl border border-[#E8DCD5]">
                <p className="text-[#E11D48] text-[13px] font-bold">Bạn không có quyền quản lý phân quyền</p>
              </div>
            ) : permissionsLoading && members.length === 0 ? (
              <div className="text-center py-10 bg-[#FFFFFF] rounded-2xl border border-[#E8DCD5]">
                <p className="text-[#6B5E64] text-[13px] font-medium">Đang tải thành viên...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-10 bg-[#FFFFFF] rounded-2xl border border-[#E8DCD5]">
                <p className="text-[#6B5E64] text-[13px] font-medium">Chưa có thành viên để phân quyền</p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="bg-[#FFFFFF] p-3 rounded-2xl border border-[#E8DCD5] shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 bg-[#800020] rounded-full flex items-center justify-center text-white font-bold text-[14px]">
                      {member.nickname ? member.nickname.charAt(0).toUpperCase() : member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-[#171018] truncate">{member.nickname || member.name}</h3>
                      <p className="text-[11px] text-[#6B5E64] mt-0.5 truncate">{member.title || member.relationship || "Thành viên"}</p>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F8F5F2] text-[#800020] border border-[#E8DCD5]">
                          {member.permissions?.viewMode === "all" ? "Xem tất cả" : member.permissions?.viewMode === "custom" ? "Tùy chỉnh" : "Chỉ xem chính mình"}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => openPermissionEditor(member)} className="shrink-0 h-8 px-3 bg-[#F8F5F2] text-[#800020] text-[12px] font-bold rounded-lg border border-[#E8DCD5] active:opacity-70">
                      Cấu hình
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}`;

code = code.replace(/        \)}\s*<\/div>\s*\{editingMember && \(/, replacement + '\n      </div>\n\n      {editingMember && (');

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log('Inserted permissions tab UI.');
