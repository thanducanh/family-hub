const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

app = app.replace(
  'const [editing, setEditing] = useState<SavingsRecord | "new" | null>(null);',
  'const [editing, setEditing] = useState<any | "new" | null>(null);'
);

app = app.replace(
  'const savingsRecords: SavingsRecord[] = Array.isArray(data)',
  'const savingsRecords: any[] = Array.isArray(data)'
);

app = app.replace(
  'const getAmount = (r: SavingsRecord) => r.type === "withdraw" ? -r.amount : r.amount;',
  'const getAmount = (r: any) => r.type === "withdraw" ? -r.amount : r.amount;'
);

app = app.replace(
  'function SavingsEditor({ item, close, saved }: { item: SavingsRecord | "new"; close: () => void; saved: () => void }) {',
  'function SavingsEditor({ item, close, saved }: { item: any | "new"; close: () => void; saved: () => void }) {'
);

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Fixed SavingsRecord type');
