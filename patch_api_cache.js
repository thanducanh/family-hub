const fs = require('fs');

const filesToPatch = [
  'src/app/api/finance-overview/route.ts',
  'src/app/api/bank-accounts/route.ts',
  'src/app/api/card-pending-transactions/route.ts',
  'src/app/api/credit-cards/summary/route.ts',
  'src/app/api/transactions/route.ts'
];

for (const file of filesToPatch) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add dynamic exports if not present
    if (!content.includes("export const dynamic = 'force-dynamic';")) {
      content = content.replace(/(import .*;\n)+/, "$&\nexport const dynamic = 'force-dynamic';\nexport const revalidate = 0;\n");
    }

    // Add headers to NextResponse.json(...)
    // Replace: NextResponse.json({ ... })
    // With: NextResponse.json({ ... }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
    // We only need to catch the ones that return successful data or just globally.
    // It's safer to just let Next.js handle it via `force-dynamic`, but to be absolutely sure we can try replacing `return NextResponse.json({` with `return NextResponse.json({` and appending headers, but it's hard if there's already `{ status: 500 }`.
    
    // Let's use regex to add headers if missing
    content = content.replace(/NextResponse\.json\(([^,]+)\)/g, 'NextResponse.json($1, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } })');
    content = content.replace(/NextResponse\.json\(([^,]+),\s*\{([^}]*)\}\)/g, (match, data, options) => {
      if (options.includes('headers')) return match; // already has headers
      return `NextResponse.json(${data}, { ${options}, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } })`;
    });

    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', file);
  } else {
    console.log('Not found', file);
  }
}
