const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 2. Add adjForm state to MobileTransactionList
const r_MobileTransactionListState = `    const [editor, setEditor] = useState<any>(null);
    const [adjForm, setAdjForm] = useState<any>(null);
    const [adjusting, setAdjusting] = useState(false);
    
    async function submitAdjustment(e: React.FormEvent) {
      e.preventDefault();
      const amount = String(adjForm.amount).trim().startsWith("-") ? -parseVndInput(String(adjForm.amount)) : parseVndInput(String(adjForm.amount));
      if (!amount) return;
      setAdjusting(true);
      try {
        const response = await fetch("/api/finance-adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...adjForm, amount }) });
        if (!response.ok) throw new Error("add failed");
        setAdjForm(null);
        refresh();
      } catch {
      } finally {
        setAdjusting(false);
      }
    }`;
content = content.replace(
  /const \[editor, setEditor\] = useState<any>\(null\);\n    const \[detail, setDetail\] = useState<any>\(null\);\n\n    const \[pendingCredit, setPendingCredit\]/,
  r_MobileTransactionListState + '\n    const [detail, setDetail] = useState<any>(null);\n\n    const [pendingCredit, setPendingCredit]'
);

fs.writeFileSync(file, content);
console.log("Patched Mobile UI box state");
