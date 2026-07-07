const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_state = `const [adjForm, setAdjForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), amount: "", note: "" });`;
const r_state = `const [adjForm, setAdjForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), amount: "", note: "", sourceType: "cash" });`;

content = content.replace(t_state, r_state);

fs.writeFileSync(file, content);
console.log("Patched FinanceDashboard adjForm init");
