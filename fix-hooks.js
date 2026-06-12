const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

// Fix InvestmentSheet
appCode = appCode.replace(
  'function InvestmentSheet({ user }: { user: AuthUser }) {\n  const [data, setData] = useState<InvestmentTransaction[]>([]);',
  'function InvestmentSheet({ user }: { user: AuthUser }) {\n  const { toast, confirm } = useUI();\n  const [data, setData] = useState<InvestmentTransaction[]>([]);'
);

appCode = appCode.replace(
  'if (!confirm("Xóa giao dịch này?")) return;',
  'if (!await confirm("Xác nhận xóa", "Bạn có chắc muốn xóa giao dịch này? Hành động này không thể hoàn tác.")) return;'
);

// Fix the other confirm
appCode = appCode.replace(
  'if (!confirm(`Xóa nguồn thu "${source.name}"?`)) return;',
  'if (!await confirm("Xác nhận xóa", `Bạn có chắc muốn xóa nguồn thu "${source.name}"? Hành động này không thể hoàn tác.`)) return;'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed UI hooks in InvestmentSheet!');
