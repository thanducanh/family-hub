import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { syncSimPaymentForTransaction } from "@/lib/api-collections";
import { ensureMemberSimsTable } from "@/lib/member-sims";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const simId = (await params).id;

  try {
    await ensureMemberSimsTable();

    const schema = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'transactions'`
    );
    const columns = new Map(schema.rows.map((row) => [row.column_name, row.data_type]));
    const hasColumn = (name: string) => columns.has(name);

    const where: string[] = [];
    if (hasColumn("type")) where.push("LOWER(COALESCE(type, '')) = 'expense'");

    const detailChecks = ["subcategory", "category_detail"]
      .filter(hasColumn)
      .map((column) => `LOWER(REPLACE(COALESCE(${column}, ''), ' ', '')) IN ('sim/data', 'simdata')`);
    if (!detailChecks.length) return NextResponse.json({ ok: true, syncedCount: 0 });
    where.push(`(${detailChecks.join(" OR ")})`);

    const linkedChecks: string[] = [];
    if (hasColumn("sim_id")) linkedChecks.push("sim_id = $1");
    if (hasColumn("linked_sim_id")) linkedChecks.push("linked_sim_id = $1");

    const metadataType = columns.get("metadata");
    if (metadataType === "json" || metadataType === "jsonb") {
      linkedChecks.push("metadata->>'simId' = $1");
      linkedChecks.push("metadata->>'linkedSimId' = $1");
      linkedChecks.push("metadata->>'sim_id' = $1");
      linkedChecks.push("metadata->>'linked_sim_id' = $1");
    }

    if (!linkedChecks.length) return NextResponse.json({ ok: true, syncedCount: 0 });
    where.push(`(${linkedChecks.join(" OR ")})`);

    const result = await pool.query(
      `SELECT * FROM transactions WHERE ${where.join(" AND ")}`,
      [simId]
    );

    for (const row of result.rows) {
      await syncSimPaymentForTransaction(row);
    }

    return NextResponse.json({ ok: true, syncedCount: result.rows.length });
  } catch (error: any) {
    console.error("[member-sims/sync] Không thể đồng bộ giao dịch SIM/Data", error);
    return NextResponse.json(
      { ok: false, error: "Không thể đồng bộ giao dịch SIM/Data", detail: String(error?.message || error) },
      { status: 500 }
    );
  }
}
