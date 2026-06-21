import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === 'full_access';
    const where = isAdmin ? '1=1' : 'member_id = $1';
    const taskWhere = isAdmin ? '1=1' : '(member_id = $1 OR assignee = $1)';
    const params = isAdmin ? [] : [user.memberId];

    const membersRes = await pool.query("SELECT COUNT(*) as count FROM members WHERE deleted_at IS NULL");
    const totalMembers = parseInt(membersRes.rows[0].count, 10) || 0;

    const todayTasksRes = await pool.query(`SELECT COUNT(*) as count FROM tasks WHERE due_date_ui IS NOT NULL AND due_date_ui != '' AND due_date_ui::date = CURRENT_DATE AND ${taskWhere}`, params);
    const todayTasks = parseInt(todayTasksRes.rows[0].count, 10) || 0;

    const overdueTasksRes = await pool.query(`SELECT COUNT(*) as count FROM tasks WHERE due_date_ui IS NOT NULL AND due_date_ui != '' AND due_date_ui::date < CURRENT_DATE AND status != 'done' AND ${taskWhere}`, params);
    const overdueTasks = parseInt(overdueTasksRes.rows[0].count, 10) || 0;

    const incomeRes = await pool.query(`SELECT SUM(amount) as sum FROM transactions WHERE type = 'income' AND date IS NOT NULL AND date != '' AND EXTRACT(MONTH FROM date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM date::date) = EXTRACT(YEAR FROM CURRENT_DATE) AND ${where}`, params);
    const monthlyIncome = parseFloat(incomeRes.rows[0].sum) || 0;

    const expenseRes = await pool.query(`SELECT SUM(amount) as sum FROM transactions WHERE type = 'expense' AND date IS NOT NULL AND date != '' AND EXTRACT(MONTH FROM date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM date::date) = EXTRACT(YEAR FROM CURRENT_DATE) AND ${where}`, params);
    const monthlyExpense = parseFloat(expenseRes.rows[0].sum) || 0;

    const monthlyBalance = monthlyIncome - monthlyExpense;

    return NextResponse.json({
      ok: true,
      data: {
        totalMembers,
        todayTasks,
        overdueTasks,
        monthlyIncome,
        monthlyExpense,
        monthlyBalance
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    console.error("[Mobile Dashboard API] Error:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
