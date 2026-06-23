const fs = require('fs');
let code = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const qrImg = '<img src="/images/bidv-qr.png" alt="BIDV QR" className="max-h-full max-w-full object-contain" />';
const fallback = '<span className="text-[11px] font-bold text-[#6B5E64] opacity-50 text-center">Chưa có mã<br/>thanh toán</span>';
code = code.replace(qrImg, fallback);

fs.writeFileSync('src/components/family-app.tsx', code, 'utf8');
console.log('Fixed QR image 404');
