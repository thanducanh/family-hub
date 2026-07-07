const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `allowTypeChange={editor.isNew && subTab === "all"} close={() => setEditor(null)} onSaved={() => { refresh(); }} user={user} data={appData} update={update} />}`;
if (content.includes(targetStr)) {
  const parts = content.split(targetStr);
  if (parts.length === 2) {
    const newContent = parts[0] + targetStr + '\n    {showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} bankAccounts={appData?.bankAccounts || []} />}' + parts[1];
    fs.writeFileSync(file, newContent);
    console.log("Successfully injected CreditPendingSheet render");
  } else {
    console.log("Found multiple matches, skipping");
  }
} else {
  console.log("Target string not found in file");
}
