const fs = require('fs');

let ttCal = fs.readFileSync('src/components/timetree-calendar.tsx', 'utf8');

// 1. calLabel fix
const oldCalLabel = /const calLabel = isTodo \? "To-do" : \(e\.calendarId === "fixed-birthday" \|\| e\.calendarId === "birthday"\s*\?\s*"Sinh nhật"\s*:\s*e\.calendarId === "fixed-holiday" \|\| e\.calendarId === "holiday"\s*\?\s*"Ngày lễ"\s*:\s*calendars\.find\(\(c: any\) => c\.id === e\.calendarId\)\?\.name \|\| eventTypeMeta\(e\.type\)\?\.label \|\| "Sự kiện"\);/;
const newCalLabel = `let calLabel = isTodo ? "To-do" : (e.calendarId === "fixed-birthday" || e.calendarId === "birthday"
                   ? "Sinh nhật"
                   : e.calendarId === "fixed-holiday" || e.calendarId === "holiday"
                   ? "Ngày lễ"
                   : calendars.find((c: any) => c.id === e.calendarId)?.name || eventTypeMeta(e.type)?.label || "Sự kiện");
                 if (calLabel === "Khác") {
                   const r = e.reminderMinutes ?? e.reminder;
                   const rep = e.repeatRule ?? e.repeat;
                   if (r === 0 || r > 0) {
                     calLabel = r === 0 ? "Nhắc đúng giờ" : r === 60 ? "Nhắc trước 1 giờ" : r === 1440 ? "Nhắc trước 1 ngày" : \`Nhắc trước \${r} phút\`;
                   } else if (rep && rep !== "none") {
                     calLabel = rep === "weekly" ? "Lặp hàng tuần" : rep === "monthly" ? "Lặp hàng tháng" : rep === "yearly" ? "Lặp hàng năm" : "Lặp lại";
                   } else {
                     calLabel = "Sự kiện";
                   }
                 }`;
ttCal = ttCal.replace(oldCalLabel, newCalLabel);

// 2. Add pushAppNotification helper
// Since we want to use the API and fallback, let's inject it into timetree-calendar.tsx
const notifHelper = `
export async function pushAppNotification(notif: any, user: any) {
  const finalNotif = { ...notif, createdAt: new Date().toISOString(), read: false, id: notif.id || crypto.randomUUID() };
  try {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalNotif)
    });
    if (!res.ok) throw new Error("API fail");
  } catch(e) {
    // Fallback to local
    const uid = user?.id || user?.memberId || "guest";
    const key = \`familyHubNotifications:\${uid}\`;
    let items = [];
    try { items = JSON.parse(localStorage.getItem(key) || "[]"); } catch(err){}
    items.unshift(finalNotif);
    localStorage.setItem(key, JSON.stringify(items));
  }
  // Dispatch custom event so family-app can update UI immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app_notification_created", { detail: finalNotif }));
  }
}
`;

ttCal = ttCal.replace(/function generateUUID\(\) \{/, notifHelper + "\n  function generateUUID() {");

// 3. Update saveEvent notification logic
const saveEventNotifRegex = /\/\/ Notification[\s\S]*?triggerSystemNotification\("Cập nhật lịch", \{ body: msg \}\);\s*\}/;
const newSaveEventNotif = `// Notification
    const msg = \`\${user?.displayName || "Ai đó"} đã \${isNew ? "tạo" : "sửa"} sự kiện lịch "\${draft.title}"\`;
    const notifObj = {
      title: "Cập nhật lịch",
      message: msg,
      module: "Lịch",
      type: isNew ? "calendar_event_created" : "calendar_event_updated",
      createdByName: user?.displayName || "Ai đó",
      userId: user?.id,
      relatedId: eventToSave.id,
      relatedType: "event"
    };
    pushAppNotification(notifObj, user);
    
    // System notification fallback if settings allow
    const settings = getNotificationSettings();
    if (settings.calendar) {
      triggerSystemNotification("Cập nhật lịch", { body: msg });
    }`;

ttCal = ttCal.replace(saveEventNotifRegex, newSaveEventNotif);

// 4. Update deleteEvent notification logic
const deleteEventNotifRegex = /\/\/ Notification\s*const settings = getNotificationSettings\(\);\s*if \(settings\.calendar\) \{[\s\S]*?triggerSystemNotification\("Xóa sự kiện lịch", \{ body: msg \}\);\s*\}/;
const newDeleteEventNotif = `// Notification
    const msg = \`\${user?.displayName || "Ai đó"} đã xóa sự kiện lịch "\${item.title}"\`;
    pushAppNotification({
      title: "Xóa sự kiện",
      message: msg,
      module: "Lịch",
      type: "calendar_event_deleted",
      createdByName: user?.displayName || "Ai đó",
      userId: user?.id,
      relatedId: item.id,
      relatedType: "event"
    }, user);
    const settings = getNotificationSettings();
    if (settings.calendar) {
      triggerSystemNotification("Xóa sự kiện lịch", { body: msg });
    }`;
ttCal = ttCal.replace(deleteEventNotifRegex, newDeleteEventNotif);

fs.writeFileSync('src/components/timetree-calendar.tsx', ttCal, 'utf8');

// ============================================
// 5. Update family-app.tsx
// ============================================
let appCode = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// Change Notifications state and load from new key and API
const notifStateRegex = /const \[notifications, setNotifications\] = useState<CalendarNotification\[\]>\(\[\]\);/;
const newNotifState = `const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function loadNotifs() {
      if (typeof window === "undefined") return;
      const uid = user?.id || user?.memberId || "guest";
      const key = \`familyHubNotifications:\${uid}\`;
      let localItems = [];
      try { localItems = JSON.parse(localStorage.getItem(key) || "[]"); } catch(e){}
      
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.notifications) {
            // merge local items not in API yet, or just use API + local?
            // User requested fallback, let's prefer API
            const apiItems = data.notifications;
            const apiIds = new Set(apiItems.map((x:any) => x.id));
            const uniqueLocal = localItems.filter((x:any) => !apiIds.has(x.id));
            setNotifications([...uniqueLocal, ...apiItems].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            return;
          }
        }
      } catch(e) {}
      setNotifications(localItems);
    }
    loadNotifs();

    const handleNewNotif = (e: any) => {
      setNotifications(prev => [e.detail, ...prev]);
    };
    window.addEventListener("app_notification_created", handleNewNotif);
    return () => window.removeEventListener("app_notification_created", handleNewNotif);
  }, [user]);`;

appCode = appCode.replace(notifStateRegex, newNotifState);

// Replace the bell unread logic
// Old unread logic: notifications.some(item => isCalendarNotificationUnread(item, user))
const unreadLogic = /const unreadNotificationsCount = user \? notifications\.filter\(n => isCalendarNotificationUnread\(n, user\)\)\.length : 0;/;
const newUnreadLogic = `const unreadNotificationsCount = notifications.filter(n => !n.read && !n.isRead).length;`;
appCode = appCode.replace(unreadLogic, newUnreadLogic);

// Replace any occurrence of `isCalendarNotificationUnread(item, user)` with `(!item.read && !item.isRead)`
appCode = appCode.replace(/isCalendarNotificationUnread\(item, user\)/g, "(!item.read && !item.isRead)");

// Replace NotificationsView component
// Find the component boundaries.
const notifViewRegex = /function NotificationsView\(\{ user, notifications, setNotifications \}: \{ user: AuthUser; notifications: CalendarNotification\[\]; setNotifications: React\.Dispatch<React\.SetStateAction<CalendarNotification\[\]>> \}\) \{[\s\S]*?\n\}/;

const newNotifView = `function NotificationsView({ user, notifications, setNotifications }: { user: AuthUser; notifications: any[]; setNotifications: React.Dispatch<React.SetStateAction<any[]>> }) {
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true, isRead: true }));
    setNotifications(updated);
    
    // Save to local storage
    const uid = user?.id || user?.memberId || "guest";
    const key = \`familyHubNotifications:\${uid}\`;
    localStorage.setItem(key, JSON.stringify(updated));
    // Optionally fire to API if needed, but for now just local is fine for the fallback
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F5F2]">
      <div className="flex items-center justify-between p-4 bg-[#FFFFFF] border-b border-[#E8DCD5] shrink-0 sticky top-0 z-10 shadow-sm">
        <h2 className="text-xl font-bold text-[#800020] tracking-tight">Thông báo</h2>
        {notifications.some(n => !n.read && !n.isRead) && (
          <button onClick={markAllAsRead} className="px-3 py-1.5 text-xs font-bold text-[#D4AF37] border border-[#D4AF37] rounded-full hover:bg-[#D4AF37] hover:text-white transition-colors">
            Đánh dấu đã đọc
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {notifications.length ? (
          notifications.map(item => {
            const unread = !item.read && !item.isRead;
            return (
              <div key={item.id} className={\`p-3.5 rounded-xl border \${unread ? 'bg-[#F8E7EC] border-[#E8DCD5]' : 'bg-[#FFFFFF] border-[#E8DCD5]'} shadow-sm flex gap-3 transition-colors\`}>
                <div className="size-10 rounded-full bg-[#800020] shrink-0 flex items-center justify-center shadow-inner">
                  <svg className="size-5 stroke-[#D4AF37] stroke-2 fill-none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-[#800020] text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">{item.module || "Hệ thống"}</span>
                    {unread && <span className="size-2 rounded-full bg-[#E11D48] shrink-0" />}
                  </div>
                  <h3 className="font-bold text-[14px] text-[#171018] leading-snug mb-1">{item.title}</h3>
                  <p className="text-[#6B5E64] text-[13px] leading-relaxed line-clamp-2">{item.message}</p>
                  <p className="text-[11px] text-[#6B5E64]/70 mt-1.5 font-medium">{new Date(item.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-[#6B5E64]">
            <div className="size-16 rounded-full bg-[#E8DCD5]/50 flex items-center justify-center mb-4">
              <svg className="size-8 stroke-[#800020] stroke-[1.5] fill-none opacity-50" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <p className="text-[15px] font-bold text-[#171018] mb-1">Chưa có thông báo</p>
            <p className="text-[13px] text-center max-w-[200px]">Bạn sẽ nhận được thông báo khi có cập nhật mới.</p>
          </div>
        )}
      </div>
    </div>
  );
}`;

appCode = appCode.replace(notifViewRegex, newNotifView);

fs.writeFileSync('src/components/family-app.tsx', appCode, 'utf8');

console.log("Patch complete");
