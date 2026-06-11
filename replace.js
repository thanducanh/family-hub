const fs = require('fs');
let c = fs.readFileSync('src/app/api/incomes/route.ts', 'utf8');

c = c.replace(
  /export async function GET\(request: NextRequest\) \{[\s\S]*?return NextResponse.json\(\{ ok: true, data \}\);\n\}/,
  `export async function GET(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
    const year = normalizeYear(new URL(request.url).searchParams.get("year"));
    const data = await fetchIncomeData(year);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/incomes] ERROR:", error);
    return NextResponse.json({ ok: true, data: { members: [], sources: [], records: [], allRecords: [], yearlySummaries: [], yearlyComparison: [], jobs: [] } });
  }
}`
);

fs.writeFileSync('src/app/api/incomes/route.ts', c);
console.log('done');
