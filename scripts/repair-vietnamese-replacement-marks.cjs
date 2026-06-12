const fs = require("node:fs");
const path = require("node:path");

const textExtensions = new Set([".ts", ".tsx", ".css", ".json", ".sql"]);

function collectFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  const stat = fs.statSync(startPath);
  if (stat.isFile()) return textExtensions.has(path.extname(startPath)) ? [startPath] : [];
  return fs.readdirSync(startPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".next" || entry.name === ".git" || entry.name === "node_modules") return [];
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return textExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const files = ["src", "database", "public"].flatMap((root) => collectFiles(path.join(process.cwd(), root)));

const replacements = [
  ["Ng\ufffdn h\ufffdng", "Ngân hàng"],
  ["ng\ufffdn h\ufffdng", "ngân hàng"],
  ["Th\ufffdng tin", "Thông tin"],
  ["th\ufffdng tin", "thông tin"],
  ["c\ufffd nh\ufffdn", "cá nhân"],
  ["C\ufffd nh\ufffdn", "Cá nhân"],
  ["Ghi ch\ufffd c\ufffd nh\ufffdn", "Ghi chú cá nhân"],
  ["Ghi ch\ufffd cá nhân", "Ghi chú cá nhân"],
  ["tr\ufffdi c\ufffdy", "trái cây"],
  ["Tr\ufffdi c\ufffdy", "Trái cây"],
  ["T\ufffdi khoản", "Tài khoản"],
  ["danh s\ufffdch", "danh sách"],
  ["li\ufffdn quan", "liên quan"],
  ["Th\ufffdm", "Thêm"],
  ["th\ufffdm", "thêm"],
  ["H\ufffdm", "Hôm"],
  ["Th\ufffdng", "Tháng"],
  ["T\ufffdi", "Tài"],
  ["qu\ufffd l\ufffdu", "quá lâu"],
  ["vui l\ufffdng", "vui lòng"],
  ["l\ufffd dữ", "là dữ"],
  ["l\ufffd ", "là "],
  ["c\ufffdy", "cây"],
  ["Kh\ufffdng c\ufffd", "Không có"],
  ["Kh\ufffdng t\ufffdm", "Không tìm"],
  ["Kh\ufffdng", "Không"],
  ["kh\ufffdng", "không"],
  ["Kh\ufffdc", "Khác"],
  ["Sao k\ufffd", "Sao kê"],
  ["Ch\ufffd\u008dn", "Chọn"],
  ["ch\ufffd\u008dn", "chọn"],
  ["ch\ufffdn", "chọn"],
  ["Ch\ufffdn", "Chọn"],
  ["kh\ufffd\u008fi", "khỏi"],
  ["H\ufffdm nay", "Hôm nay"],
  ["Th\ufffdng ", "Tháng "],
  ["th\ufffdng ", "tháng "],
  ["\ufffdm lịch", "Âm lịch"],
  ["\ufffdm", "Âm"],
  [" \ufffdm", " âm"],
  ["Ch\ufffd\u009d", "Chờ"],
  ["Mở r\ufffd\u2122ng", "Mở rộng"],
  ["Thu g\ufffd\u008dn", "Thu gọn"],
  ["Ngư\ufffd\u009di", "Người"],
  ["Th\ufffd\u009di", "Thời"],
  ["L\ufffd\u2014i", "Lỗi"],
  ["Tá»•ng thÃ¡ng", "Tổng tháng"],
  ["Dá»± kiáº¿n", "Dự kiến"],
  ["danh s\ufffdch", "danh sách"],
  ["Thẻ li\ufffdn quan", "Thẻ liên quan"],
  ["ngân hàng li\ufffdn quan", "ngân hàng liên quan"],
  ["Tiếng Việt</option><option value=\"en\">English</option><option value=\"ja\">×\ufffd本語</option>", "Tiếng Việt</option><option value=\"en\">English</option><option value=\"ja\">日本語</option>"],
  ["\ufffd\u2014\u008f", "↗"],
  ["\ufffd\u2013\ufffd Thu", "● Thu"],
  ["\ufffd\u2013\ufffd Chi", "● Chi"],
  ["\ufffd\u2014", "×"],
  ["\ufffd\u2013\u00bc", "▾"],
  ["\ufffd\u02dc\ufffd", "⭐"],
  ["\ufffd\u0090", "Đ"],
  ["\ufffd\u0081", "ề"],
  ["\ufffd\u008d", "ọ"],
  ["\ufffd\u008f", "ỏ"],
  ["\ufffd\u009d", "ờ"],
  ["\ufffd\u2122", "ộ"],
];

let changed = [];
for (const relativePath of files) {
  const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) continue;
  let content = fs.readFileSync(fullPath, "utf8");
  const before = content;
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  content = content
    .replace(/>\ufffd<\/button>/g, ">›</button>")
    .replace(/>\ufffd<\/span>/g, ">›</span>")
    .replace(/ \ufffd \{accountLabel/g, " · {accountLabel")
    .replace(/"\ufffd˜\ufffd "/g, "\"⭐ \"")
    .replace(/>\ufffd<\/h2>/g, ">?</h2>");
  if (content !== before) {
    fs.writeFileSync(fullPath, content, "utf8");
    changed.push(path.relative(process.cwd(), fullPath));
  }
}

console.log(changed.length ? changed.join("\n") : "No replacement marks repaired.");
