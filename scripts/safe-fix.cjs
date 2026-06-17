const fs = require('fs');

const replacements = {
  "ThÃ¡ng": "Tháng",
  "Lá»‹ch": "Lịch",
  "CÃ´ng viá»‡c": "Công việc",
  "Há» c táº­p": "Học tập",
  "Gia Ä‘Ã¬nh": "Gia đình",
  "CÃ¡ nhÃ¢n": "Cá nhân",
  "NgÃ y lá»…": "Ngày lễ",
  "NgÃ y lá»…": "Ngày lễ",
  "Nháº¯c nhá»Ÿ": "Nhắc nhở",
  "ThÃªm danh sÃ¡ch": "Thêm danh sách",
  "Sinh nháº­t": "Sinh nhật",
  "KhÃ¡c": "Khác",
  "Táº¿t DÆ°Æ¡ng lá»‹ch": "Tết Dương lịch",
  "Giáº£i phÃ³ng miá» n Nam": "Giải phóng miền Nam",
  "Quá»‘c táº¿ Lao Ä‘á»™ng": "Quốc tế Lao động",
  "Quá»‘c khÃ¡nh": "Quốc khánh",
  "NgÃ y lá»… cá»‘ Ä‘á»‹nh": "Ngày lễ cố định",
  "NgÃ y lá»… cá»‘ Ä‘á»‹nh": "Ngày lễ cố định",
  "Sinh nháº­t thÃ nh viÃªn": "Sinh nhật thành viên",
  "Háº±ng ngÃ y": "Hằng ngày",
  "Háº±ng ngÃ y": "Hằng ngày",
  "Háº±ng tuáº§n": "Hằng tuần",
  "Háº±ng thÃ¡ng": "Hằng tháng",
  "Háº±ng nÄƒm": "Hằng năm",
  "KhÃ´ng cÃ³ sá»± kiá»‡n": "Không có sự kiện",
  "Cáº£ ngÃ y": "Cả ngày",
  "Cáº£ ngÃ y": "Cả ngày",
  "HÃ´m nay": "Hôm nay",
  "NgÃ y mai": "Ngày mai",
  "NgÃ y mai": "Ngày mai",
  "1 giá» ": "1 giờ",
  "1 ngÃ y": "1 ngày",
  "1 ngÃ y": "1 ngày",
  "5 phÃºt": "5 phút",
  "15 phÃºt": "15 phút",
  "KhÃ´ng thá»ƒ táº£i lá»‹ch.": "Không thể tải lịch.",
  "ChÆ°a cÃ³ lá»‹ch Ä‘á»ƒ thÃªm sá»± kiá»‡n.": "Chưa có lịch để thêm sự kiện.",
  "KhÃ´ng thá»ƒ lÆ°u sá»± kiá»‡n.": "Không thể lưu sự kiện.",
  "KhÃ´ng thá»ƒ xÃ³a sá»± kiá»‡n.": "Không thể xóa sự kiện.",
  "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i.": "Không thể cập nhật trạng thái.",
  "Lá»‹ch hiá»ƒn thá»‹": "Lịch hiển thị",
  "Thu gá» n panel": "Thu gọn panel",
  "ThÃªm sá»± kiá»‡n": "Thêm sự kiện",
  "Ã‚m lá»‹ch": "Âm lịch",
  "Tuáº§n": "Tuần"
};

const file = 'src/components/timetree-calendar.tsx';
let content = fs.readFileSync(file, 'utf8');

for (const [bad, good] of Object.entries(replacements)) {
  content = content.split(bad).join(good);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Done");
