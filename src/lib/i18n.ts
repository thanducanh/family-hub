import type { Language } from "@/types";

const dictionaries = {
  vi: { dashboard: "Tổng quan", members: "Thành viên", tasks: "Công việc", finance: "Thu chi", chat: "Trò chuyện", calendar: "Lịch", notes: "Ghi chú", settings: "Cài đặt", notifications: "Thông báo", hello: "Chào buổi sáng", family: "Gia đình của bạn", seeAll: "Xem tất cả", upcoming: "Sắp tới", add: "Thêm mới", income: "Thu nhập", expense: "Chi tiêu", balance: "Số dư", language: "Ngôn ngữ", appearance: "Giao diện", light: "Sáng", dark: "Tối", system: "Theo hệ thống", storage: "Dữ liệu đang được lưu trên thiết bị này.", done: "Hoàn thành", noData: "Chưa có dữ liệu" },
  en: { dashboard: "Overview", members: "Members", tasks: "Tasks", finance: "Finance", chat: "Chat", calendar: "Calendar", notes: "Notes", settings: "Settings", notifications: "Notifications", hello: "Good morning", family: "Your family", seeAll: "See all", upcoming: "Upcoming", add: "Add new", income: "Income", expense: "Expense", balance: "Balance", language: "Language", appearance: "Appearance", light: "Light", dark: "Dark", system: "System", storage: "Data is stored on this device.", done: "Done", noData: "No data yet" },
  ja: { dashboard: "概要", members: "家族", tasks: "タスク", finance: "家計", chat: "チャット", calendar: "予定", notes: "メモ", settings: "設定", notifications: "通知", hello: "おはようございます", family: "家族", seeAll: "すべて見る", upcoming: "今後の予定", add: "追加", income: "収入", expense: "支出", balance: "残高", language: "言語", appearance: "テーマ", light: "ライト", dark: "ダーク", system: "システム", storage: "データはこの端末に保存されます。", done: "完了", noData: "データがありません" },
} as const;

export function translator(language: Language) {
  return (key: keyof typeof dictionaries.vi) => dictionaries[language][key];
}
