const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// The injected code is:
/*
  const payload = data || {};
  const savingsRecords = Array.isArray(data)
    ? data
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.records)
        ? payload.records
        : Array.isArray(payload.monthlyData)
          ? payload.monthlyData
          : [];
              {savingsRecords.map(item => {
*/

app = app.replace(
  /const payload = data \|\| \{\};\s*const savingsRecords = Array\.isArray\(data\)\s*\?\s*data\s*:\s*Array\.isArray\(payload\.data\)\s*\?\s*payload\.data\s*:\s*Array\.isArray\(payload\.records\)\s*\?\s*payload\.records\s*:\s*Array\.isArray\(payload\.monthlyData\)\s*\?\s*payload\.monthlyData\s*:\s*\[\];/g,
  ''
);

// Now inject it before "return (" inside SavingsSheet
const target = 'function SavingsSheet() {';
const startIdx = app.indexOf(target);
if (startIdx !== -1) {
  const returnIdx = app.indexOf('return (', startIdx);
  const fixStr = `
  const payload = data || {};
  const savingsRecords = Array.isArray(data)
    ? data
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.records)
        ? payload.records
        : Array.isArray(payload.monthlyData)
          ? payload.monthlyData
          : [];
  `;
  app = app.substring(0, returnIdx) + fixStr + '\\n  ' + app.substring(returnIdx);
}

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Fixed SavingsSheet JSX syntax error');
