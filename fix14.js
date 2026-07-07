const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_mobileStats = `  const [loadingIncomes, setLoadingIncomes] = useState(true);

  const now = new Date();`;

const r_mobileStats = `  const [loadingIncomes, setLoadingIncomes] = useState(true);
  const [overviewData, setOverviewData] = useState<any>(null);

  const now = new Date();`;

const t_mobileStatsEffect = `  useEffect(() => {
    setLoadingIncomes(true);
    Promise.all([
      fetch(\`/api/incomes?year=\${selectedYear}\`).then(r => r.json()),
      fetch(\`/api/incomes?year=\${selectedYear - 1}\`).then(r => r.json())
    ]).then(([res1, res2]) => {`;

const r_mobileStatsEffect = `  useEffect(() => {
    setLoadingIncomes(true);
    Promise.all([
      fetch(\`/api/incomes?year=\${selectedYear}\`).then(r => r.json()),
      fetch(\`/api/incomes?year=\${selectedYear - 1}\`).then(r => r.json()),
      fetch(\`/api/finance-overview?year=\${selectedYear}\`).then(r => r.json())
    ]).then(([res1, res2, res3]) => {
      setOverviewData(res3?.data || res3 || {});`;

let hasError = false;
if (!content.includes(t_mobileStats)) { console.log("t_mobileStats missing"); hasError = true; }
if (!content.includes(t_mobileStatsEffect)) { console.log("t_mobileStatsEffect missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_mobileStats, r_mobileStats);
content = content.replace(t_mobileStatsEffect, r_mobileStatsEffect);

fs.writeFileSync(file, content);
console.log("Patched MobileStats");
