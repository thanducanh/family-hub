const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// 1. AppContent logic: Hide header and breadcrumb for notifications
const headerRegex = /screen === "calendar" \|\| screen === "members" \|\| screen === "finance" \|\| screen === "settings" \|\| screen === "system" \|\| screen === "dashboard" \? "hidden md:block" : "block"/;
code = code.replace(headerRegex, 'screen === "calendar" || screen === "members" || screen === "finance" || screen === "settings" || screen === "system" || screen === "dashboard" || screen === "notifications" ? "hidden md:block" : "block"');

const sectionPaddingRegex = /profilePageOpen \|\| screen === "finance" \|\| screen === "members" \|\| screen === "calendar" \|\| screen === "settings" \|\| screen === "system" \|\| screen === "dashboard" \? "px-0 py-0 md:px-8 md:py-8"/;
code = code.replace(sectionPaddingRegex, 'profilePageOpen || screen === "finance" || screen === "members" || screen === "calendar" || screen === "settings" || screen === "system" || screen === "dashboard" || screen === "notifications" ? "px-0 py-0 md:px-8 md:py-8"');

const breadcrumbRegex = /!children && screen !== "members" && screen !== "calendar" && screen !== "system" && screen !== "dashboard" && <div/;
code = code.replace(breadcrumbRegex, '!children && screen !== "members" && screen !== "calendar" && screen !== "system" && screen !== "dashboard" && screen !== "notifications" && <div');

// 2. NotificationsView replacement
const notifViewRegex = /function NotificationsView\(\{ user, notifications, setNotifications \}: \{ user: AuthUser; notifications: any\[\]; setNotifications: React\.Dispatch<React\.SetStateAction<any\[\]>> \}\) \{[\s\S]*?\n\}/;

const newNotifView = `function NotificationsView({ user, notifications, setNotifications }: { user: AuthUser; notifications: any[]; setNotifications: React.Dispatch<React.SetStateAction<any[]>> }) {
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true, isRead: true }));
    setNotifications(updated);
    
    // Save to local storage
    const uid = user?.id || user?.memberId || "guest";
    const key = \`familyHubNotifications:\${uid}\`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F5F2]">
      <div className="flex items-center justify-between px-4 py-3 bg-[#FFFFFF] border-b border-[#E8DCD5] shrink-0 sticky top-0 z-10 shadow-sm">
        <h2 className="text-[16px] md:text-lg font-bold text-[#800020] tracking-tight">Thông báo</h2>
        {notifications.some(n => !n.read && !(n as any).isRead) && (
          <button onClick={markAllAsRead} className="px-3 py-1.5 text-[11px] font-bold text-[#800020] border border-[#D4AF37] rounded-full hover:bg-[#D4AF37] hover:text-white transition-colors">
            Đánh dấu đã đọc
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-24">
        {notifications.length ? (
          notifications.map(item => {
            const unread = !item.read && !(item as any).isRead;
            return (
              <div key={item.id} className={\`p-3 rounded-[12px] border \${unread ? 'bg-[#F8E7EC] border-[#E8DCD5]' : 'bg-[#FFFFFF] border-[#E8DCD5]'} shadow-sm flex gap-3 transition-colors\`}>
                <div className="size-9 rounded-full bg-[#800020] shrink-0 flex items-center justify-center shadow-inner">
                  <svg className="size-4 stroke-[#D4AF37] stroke-2 fill-none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-[#800020] text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">{item.module || "Hệ thống"}</span>
                    {unread && <span className="size-2 rounded-full bg-[#E11D48] shrink-0" />}
                  </div>
                  <h3 className="font-semibold text-[13px] md:text-[14px] text-[#171018] leading-snug mb-1">{item.title}</h3>
                  <p className="text-[#6B5E64] text-[12px] leading-relaxed line-clamp-2">{item.message}</p>
                  <p className="text-[11px] text-[#6B5E64]/70 mt-1 font-medium">{new Date(item.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-[#6B5E64] bg-[#FFFFFF] rounded-[12px] border border-[#E8DCD5] shadow-sm">
            <div className="size-12 rounded-full bg-[#E8DCD5]/50 flex items-center justify-center mb-3">
              <svg className="size-6 stroke-[#800020] stroke-[1.5] fill-none opacity-50" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <p className="text-[14px] font-bold text-[#171018]">Chưa có thông báo</p>
          </div>
        )}
      </div>
    </div>
  );
}`;

code = code.replace(notifViewRegex, newNotifView);

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log("Patch complete");
