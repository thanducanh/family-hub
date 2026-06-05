import type { AppData } from "@/types";

export const mockData: AppData = {
  members: [
    { id: "00000000-0000-4000-8000-000000000001", name: "Minh", nickname: "", birthday: "1988-08-18", gender: "male", phone: "090 123 4567", avatar: "", notes: "", color: "#fb7185" },
    { id: "00000000-0000-4000-8000-000000000002", name: "Hana", nickname: "", birthday: "1990-11-04", gender: "female", phone: "090 765 4321", avatar: "", notes: "", color: "#60a5fa" },
    { id: "00000000-0000-4000-8000-000000000003", name: "An", nickname: "", birthday: "2018-06-12", gender: "other", phone: "", avatar: "", notes: "Thích vẽ và đọc truyện.", color: "#fbbf24" },
  ],
  tasks: [
    { id: "00000000-0000-4000-8000-000000000011", title: "Mua đồ ăn cho tuần mới", memberId: "00000000-0000-4000-8000-000000000001", assignee: "Minh", due: "Hôm nay", dueDate: "2026-06-02", priority: "normal", status: "todo" },
    { id: "00000000-0000-4000-8000-000000000012", title: "Đóng tiền điện", memberId: "00000000-0000-4000-8000-000000000002", assignee: "Hana", due: "Ngày mai", dueDate: "2026-06-03", priority: "high", status: "doing" },
    { id: "00000000-0000-4000-8000-000000000013", title: "Dọn phòng khách", memberId: "00000000-0000-4000-8000-000000000003", assignee: "An", due: "Đã xong", dueDate: "2026-06-01", priority: "low", status: "done" },
  ],
  transactions: [
    { id: "00000000-0000-4000-8000-000000000021", title: "Lương tháng", memberId: "00000000-0000-4000-8000-000000000001", amount: 24000000, type: "income", category: "Khác", date: "01/06" },
    { id: "00000000-0000-4000-8000-000000000022", title: "Siêu thị", memberId: "00000000-0000-4000-8000-000000000002", amount: 850000, type: "expense", category: "Ăn uống", date: "31/05" },
    { id: "00000000-0000-4000-8000-000000000023", title: "Tiền điện", memberId: "00000000-0000-4000-8000-000000000001", amount: 620000, type: "expense", category: "Điện nước", date: "30/05" },
  ],
  events: [
    { id: "00000000-0000-4000-8000-000000000031", title: "Sinh nhật bà ngoại", memberId: "", type: "birthday", date: "08/06", time: "18:00", color: "#fb7185" },
    { id: "00000000-0000-4000-8000-000000000032", title: "Khám răng cho An", memberId: "00000000-0000-4000-8000-000000000003", type: "medical", date: "12/06", time: "09:30", color: "#60a5fa" },
  ],
  notes: [
    { id: "00000000-0000-4000-8000-000000000041", title: "Danh sách mua sắm", memberId: "", kind: "general", important: true, tag: "mua sắm", content: "Sữa, trứng, rau xanh, trái cây", updatedAt: "Hôm nay" },
    { id: "00000000-0000-4000-8000-000000000042", title: "Kế hoạch cuối tuần", memberId: "", kind: "general", important: false, tag: "cuối tuần", content: "Đi công viên và ăn tối cùng ông bà", updatedAt: "Hôm qua" },
  ],
};
