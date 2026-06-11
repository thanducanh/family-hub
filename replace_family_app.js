const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

if (!c.includes('import { JobIncomeManager }')) {
  c = 'import { JobIncomeManager } from "./job-income-manager";\n' + c;
}

const detailStart = c.indexOf('function MemberJobDetail(');
const detailEnd = c.indexOf('function MemberJobSheet(', detailStart);

const newDetail = `function MemberJobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {
  return (
    <Sheet close={close}>
      <div className="-m-6 bg-[var(--app-bg)] min-h-full p-6">
        <JobIncomeManager 
          job={job} 
          memberId={job.memberId} 
          records={records} 
          selectedYear={year} 
          onBack={close} 
          onUpdated={() => window.location.reload()} 
        />
      </div>
    </Sheet>
  );
}
`;

c = c.substring(0, detailStart) + newDetail + c.substring(detailEnd);
fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Replaced MemberJobDetail in family-app.tsx');
