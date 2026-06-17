import type { Language } from "@/types";

const dictionaries = {
  vi: { dashboard: "Tổng quan", members: "Thành viên", tasks: "Công việc", finance: "Thu chi", chat: "Trò chuyện", calendar: "Lịch", notes: "Ghi chú", settings: "Cài đặt", notifications: "Thông báo", hello: "Chào buổi sáng", family: "Gia đình của bạn", seeAll: "Xem tất cả", upcoming: "Sắp tới", add: "Thêm mới", income: "Thu nhập", expense: "Chi tiêu", balance: "Số dư", language: "Ngôn ngữ", appearance: "Giao diện", light: "Sáng", dark: "Tối", system: "Theo hệ thống", storage: "Dữ liệu đang được lưu trên thiết bị này.", done: "Hoàn thành", noData: "Chưa có dữ liệu", logout: "Đăng xuất", overview: "Tổng quan", personalInfo: "Thông tin cá nhân", activityHistory: "Lịch sử hoạt động", changePassword: "Đổi mật khẩu", today: "Hôm nay", month: "Tháng", week: "Tuần", day: "Ngày", list: "Danh sách", noEvents: "Không có sự kiện nào", addEvent: "Thêm sự kiện", birthday: "Sinh nhật", holiday: "Ngày lễ", addList: "Thêm danh sách", vietnamese: "Tiếng Việt", english: "English", japanese: "日本語", allowNotifications: "Bật thông báo chung", calendarNotifications: "Thông báo sự kiện lịch", actionNotifications: "Thông báo thao tác gia đình", vibrate: "Rung khi có thông báo", playSound: "Phát âm thanh" },
  en: { dashboard: "Overview", members: "Members", tasks: "Tasks", finance: "Finance", chat: "Chat", calendar: "Calendar", notes: "Notes", settings: "Settings", notifications: "Notifications", hello: "Good morning", family: "Your family", seeAll: "See all", upcoming: "Upcoming", add: "Add new", income: "Income", expense: "Expense", balance: "Balance", language: "Language", appearance: "Appearance", light: "Light", dark: "Dark", system: "System Default", storage: "Data is stored on this device.", done: "Done", noData: "No data yet", logout: "Logout", overview: "Overview", personalInfo: "Personal Info", activityHistory: "Activity History", changePassword: "Change Password", today: "Today", month: "Month", week: "Week", day: "Day", list: "List", noEvents: "No events", addEvent: "Add event", birthday: "Birthday", holiday: "Holiday", addList: "Add list", vietnamese: "Vietnamese", english: "English", japanese: "Japanese", allowNotifications: "Allow notifications", calendarNotifications: "Calendar events notifications", actionNotifications: "Family action notifications", vibrate: "Vibrate on notification", playSound: "Play sound" },
  ja: { dashboard: "概要", members: "家族", tasks: "タスク", finance: "家計", chat: "チャット", calendar: "予定", notes: "メモ", settings: "設定", notifications: "通知", hello: "おはようございます", family: "家族", seeAll: "すべて見る", upcoming: "今後の予定", add: "追加", income: "収入", expense: "支出", balance: "残高", language: "言語", appearance: "テーマ", light: "ライト", dark: "ダーク", system: "システム", storage: "データはこの端末に保存されます。", done: "完了", noData: "データがありません", logout: "ログアウト", overview: "概要", personalInfo: "個人情報", activityHistory: "活動履歴", changePassword: "パスワード変更", today: "今日", month: "月", week: "週", day: "日", list: "リスト", noEvents: "予定なし", addEvent: "予定を追加", birthday: "誕生日", holiday: "祝日", addList: "リストを追加", vietnamese: "ベトナム語", english: "英語", japanese: "日本語", allowNotifications: "通知を許可", calendarNotifications: "カレンダー予定の通知", actionNotifications: "家族アクションの通知", vibrate: "通知時にバイブレーション", playSound: "サウンドを再生" },
} as const;

export type TranslationKey = keyof typeof dictionaries.vi;

export function translator(language: Language | string) {
  return (key: TranslationKey | string): string => {
    let actualLanguage = language;
    if (actualLanguage === "system") {
      if (typeof navigator !== "undefined" && navigator.language) {
        if (navigator.language.startsWith("ja")) actualLanguage = "ja";
        else if (navigator.language.startsWith("vi")) actualLanguage = "vi";
        else actualLanguage = "en";
      } else {
        actualLanguage = "vi";
      }
    }
    
    // Fallback to "vi" if language is invalid or undefined
    const dict = dictionaries[actualLanguage as keyof typeof dictionaries] || dictionaries.vi;
    
    // Return translation or fallback to "vi", or return key if missing completely
    return (dict as any)[key] ?? (dictionaries.vi as any)[key] ?? key;
  };
}
