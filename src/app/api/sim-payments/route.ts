import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberSimsTable } from "@/lib/member-sims";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();

    const phoneNumber = request.nextUrl.searchParams.get("phoneNumber");
    const simId = request.nextUrl.searchParams.get("simId");

    let query = "";
    let values = [];

    if (phoneNumber) {
      // Tìm bằng số điện thoại (chỉ lấy số)
      const phoneDigits = phoneNumber.replace(/\D/g, "");
      query = `SELECT * FROM sim_monthly_payments WHERE regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1 ORDER BY year DESC, month DESC`;
      values = [phoneDigits];
    } else if (simId) {
      query = `SELECT * FROM sim_monthly_payments WHERE sim_id = $1 ORDER BY year DESC, month DESC`;
      values = [simId];
    } else {
      return NextResponse.json({ ok: false, error: "Thiếu phoneNumber hoặc simId." }, { status: 400 });
    }

    if (simId) {
      // Fallback: Tự động sync từ các transaction có sim_id mà chưa vào bảng
      await pool.query(`
        INSERT INTO sim_monthly_payments (sim_id, phone_number, month, year, plan_name, amount, topup_amount, plan_fee, billing_cycle_months, coverage_start_date, coverage_end_date, paid_date, status, transaction_id, note)
        SELECT t.sim_id, s.phone_number, EXTRACT(MONTH FROM t.date)::int, EXTRACT(YEAR FROM t.date)::int, s.plan_name, t.amount, t.amount, s.monthly_fee, COALESCE(s.renewal_months, 1), t.date, (t.date + (COALESCE(s.renewal_months, 1) || ' months')::interval - interval '1 day')::date, t.date, 'paid', t.id, COALESCE(t.note, t.title, '')
        FROM transactions t
        JOIN member_sims s ON s.id = t.sim_id
        WHERE t.sim_id = $1
          AND LOWER(COALESCE(t.type, '')) = 'expense'
          AND LOWER(REPLACE(COALESCE(t.subcategory, ''), ' ', '')) IN ('sim/data', 'simdata')
        ON CONFLICT (sim_id, year, month) DO UPDATE SET
          phone_number = EXCLUDED.phone_number,
          plan_name = EXCLUDED.plan_name,
          amount = EXCLUDED.amount,
          topup_amount = EXCLUDED.topup_amount,
          plan_fee = EXCLUDED.plan_fee,
          billing_cycle_months = EXCLUDED.billing_cycle_months,
          coverage_start_date = EXCLUDED.coverage_start_date,
          coverage_end_date = EXCLUDED.coverage_end_date,
          paid_date = EXCLUDED.paid_date,
          status = EXCLUDED.status,
          transaction_id = COALESCE(sim_monthly_payments.transaction_id, EXCLUDED.transaction_id),
          note = EXCLUDED.note,
          updated_at = now()
      `, [simId]);
    }

    const result = await pool.query(query, values);
    return NextResponse.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("[api/sim-payments] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();

    const body = await request.json();
    const { simId, phoneNumber, month, year, planName, amount, planFee, paidDate, status, note, billingCycleMonths, coverageStartDate, coverageEndDate } = body;

    if (!simId || !month || !year) return NextResponse.json({ ok: false, error: "Thiếu thông tin bắt buộc" }, { status: 400 });

    const result = await pool.query(
      `INSERT INTO sim_monthly_payments (sim_id, phone_number, month, year, plan_name, amount, topup_amount, plan_fee, billing_cycle_months, coverage_start_date, coverage_end_date, paid_date, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (sim_id, year, month) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         plan_name = EXCLUDED.plan_name,
         amount = EXCLUDED.amount,
         topup_amount = EXCLUDED.topup_amount,
         plan_fee = EXCLUDED.plan_fee,
         billing_cycle_months = EXCLUDED.billing_cycle_months,
         coverage_start_date = EXCLUDED.coverage_start_date,
         coverage_end_date = EXCLUDED.coverage_end_date,
         paid_date = EXCLUDED.paid_date,
         status = EXCLUDED.status,
         note = EXCLUDED.note,
         updated_at = now()
       RETURNING *`,
      [simId, phoneNumber || "", month, year, planName || "", amount || 0, planFee || 0, Math.max(1, Number(billingCycleMonths || 1)), coverageStartDate || paidDate || null, coverageEndDate || null, paidDate || null, status || "paid", note || ""]
    );
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("[api/sim-payments] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();

    const body = await request.json();
    const { id, month, year, planName, amount, planFee, paidDate, status, note, billingCycleMonths, coverageStartDate, coverageEndDate } = body;

    if (!id) return NextResponse.json({ ok: false, error: "Thiếu ID" }, { status: 400 });

    const current = await pool.query(`SELECT transaction_id FROM sim_monthly_payments WHERE id = $1`, [id]);
    if (current.rows.length === 0) return NextResponse.json({ ok: false, error: "Không tìm thấy" }, { status: 404 });

    // Cập nhật
    const result = await pool.query(
      `UPDATE sim_monthly_payments SET
         month = $2, year = $3, plan_name = $4, amount = $5, topup_amount = $5, plan_fee = $6, paid_date = $7, status = $8, note = $9, billing_cycle_months = $10, coverage_start_date = $11, coverage_end_date = $12, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, month, year, planName || "", amount || 0, planFee || 0, paidDate || null, status || "paid", note || "", Math.max(1, Number(billingCycleMonths || 1)), coverageStartDate || paidDate || null, coverageEndDate || null]
    );

    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("[api/sim-payments] PUT failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureMemberSimsTable();

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Thiếu ID." }, { status: 400 });

    const current = await pool.query(`SELECT transaction_id FROM sim_monthly_payments WHERE id = $1`, [id]);
    if (current.rows.length === 0) return NextResponse.json({ ok: true }); // ZZZ Already deleted

    if (current.rows[0].transaction_id) {
      return NextResponse.json({ ok: false, error: "Khoản này liên kết với Thu chi. Vui lòng xóa giao dịch trong tab Thu chi để đồng bộ dữ liệu." }, { status: 400 });
    }

    await pool.query(`DELETE FROM sim_monthly_payments WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/sim-payments] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}
