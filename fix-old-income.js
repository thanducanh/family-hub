const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

appCode = appCode.replace(
  'function OldIncomeManagement() {\n  const [year, setYear] = useState(String(new Date().getFullYear()));',
  'function OldIncomeManagement() {\n  const { toast, confirm } = useUI();\n  const [year, setYear] = useState(String(new Date().getFullYear()));'
);

appCode = appCode.replace(
  'else alert(result?.error || "Không thể tải dữ liệu thu nhập.");',
  'else toast(result?.error || "Không thể tải dữ liệu thu nhập.", "error");'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed OldIncomeManagement!');
