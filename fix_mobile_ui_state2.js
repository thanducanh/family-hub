const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_state = `    const [editor, setEditor] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);`;
const r_state = `    const [editor, setEditor] = useState<any>(null);
    const [detail, setDetail] = useState<any>(null);
    const [adjForm, setAdjForm] = useState<any>(null);
    const [adjusting, setAdjusting] = useState(false);
    
    async function submitAdjustment(e: React.FormEvent) {
      e.preventDefault();
      const amount = String(adjForm.amount).trim().startsWith("-") ? -Number(String(adjForm.amount).replace(/\\D/g, "")) : Number(String(adjForm.amount).replace(/\\D/g, ""));
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

content = content.replace(t_state, r_state);

fs.writeFileSync(file, content);
console.log("Patched Mobile UI box state for realsies");
