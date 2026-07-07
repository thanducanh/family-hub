const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `<button onClick={() => setShowCreditPendingSheet(true)} className="text-[12px] font-semibold text-[#800020] bg-[#F8E7EC] px-2 py-1 rounded-full active:opacity-70">Xem chi tiết</button>`;
const replacement1 = `<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCreditPendingSheet(true); }} className="relative z-10 cursor-pointer text-[12px] font-semibold text-[#800020] bg-[#F8E7EC] px-2 py-1 rounded-full active:opacity-70">Xem chi tiết</button>`;

const target2 = `    {detail && <MobileTransactionDetail item={detail} close={() => setDetail(null)} onEdit={() => editItem(detail)} onDeleted={() => { refresh(); setDetail(null); }} data={appData} update={update} />}
    {editor && <MobileTransactionEditor item={editor.isNew ? null : editor} defaultType={editor.type} allowTypeChange={editor.isNew && subTab === "all"} close={() => setEditor(null)} onSaved={() => { refresh(); }} user={user} data={appData} update={update} />}
  </div>;`;
const replacement2 = `    {detail && <MobileTransactionDetail item={detail} close={() => setDetail(null)} onEdit={() => editItem(detail)} onDeleted={() => { refresh(); setDetail(null); }} data={appData} update={update} />}
    {editor && <MobileTransactionEditor item={editor.isNew ? null : editor} defaultType={editor.type} allowTypeChange={editor.isNew && subTab === "all"} close={() => setEditor(null)} onSaved={() => { refresh(); }} user={user} data={appData} update={update} />}
    {showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} bankAccounts={appData?.bankAccounts || []} />}
  </div>;`;

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync(file, content);
console.log("Replaced button and added sheet.");
