const fs = require('fs');
let c = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');

c = c.replace('return <div className="max-w-6xl space-y-5">', 'return <div className="max-w-6xl space-y-5">\n    {viewing ? <JobIncomeManager job={viewing} memberId={memberId} records={records} selectedYear={year} onBack={() => setViewing(null)} onUpdated={() => load()} /> : <>');
c = c.replace(/\{deleting && <div className="fixed inset-0.*?<\/div><\/div>\}/, '$&\n    </>');
c = c.replace(/\{viewing && <JobIncomeManager job=\{viewing\} memberId=\{memberId\} records=\{records\} selectedYear=\{year\} onBack=\{\(\) => setViewing\(null\)\} onUpdated=\{\(\) => load\(\)\} \/>\}/g, '');

fs.writeFileSync('src/components/member-job-page.tsx', c);
console.log('Fixed conditional rendering');
