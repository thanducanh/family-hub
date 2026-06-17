import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { sendPushNotification } from "@/lib/server-notifications";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        delivery_type TEXT NOT NULL,
        delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, delivery_type)
      )
    `);

    // We will check events for "today"
    // For a real production app, timezones matter. We'll assume the server is running in the same timezone as users.
    const now = new Date();
    
    // YYYY-MM-DD
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // HH:MM
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    
    // 10 minutes from now
    const future = new Date(now.getTime() + 10 * 60000);
    const futureTimeStr = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;

    // 1. All-day events for today. Remind if it's past 08:00 AM
    if (currentHour >= 8) {
      const allDayResult = await pool.query(
        `SELECT e.id, e.title 
         FROM events e
         LEFT JOIN notification_deliveries nd ON nd.event_id = e.id AND nd.delivery_type = $1
         WHERE COALESCE(e.all_day, e.is_all_day, FALSE) = TRUE 
           AND COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date) = $2
           AND e.status != 'done'
           AND nd.id IS NULL`,
        [`allday-${todayStr}`, todayStr]
      );

      for (const row of allDayResult.rows) {
        await pool.query(`INSERT INTO notification_deliveries (event_id, delivery_type) VALUES ($1, $2)`, [row.id, `allday-${todayStr}`]);
        await notifyEventMembers(row.id, "Sự kiện hôm nay", row.title);
      }
    }

    // 2. Events within the next 10 minutes
    const upcomingResult = await pool.query(
      `SELECT e.id, e.title, COALESCE(e.start_time, e.time, e.event_date::time) as start_time
       FROM events e
       LEFT JOIN notification_deliveries nd ON nd.event_id = e.id AND nd.delivery_type = 'upcoming'
       WHERE COALESCE(e.all_day, e.is_all_day, FALSE) = FALSE
         AND COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date) = $1
         AND COALESCE(e.start_time, e.time, e.event_date::time)::text >= $2
         AND COALESCE(e.start_time, e.time, e.event_date::time)::text <= $3
         AND e.status != 'done'
         AND nd.id IS NULL`,
      [todayStr, timeStr, futureTimeStr]
    );

    for (const row of upcomingResult.rows) {
      await pool.query(`INSERT INTO notification_deliveries (event_id, delivery_type) VALUES ($1, 'upcoming')`, [row.id]);
      await notifyEventMembers(row.id, "Sắp diễn ra", `${row.title} lúc ${String(row.start_time).substring(0,5)}`);
    }

    // 3. Yearly repeats (Birthdays, Holidays)
    // We extract Month and Day from the start_date and compare with today's Month and Day.
    if (currentHour >= 8) {
      const yearlyResult = await pool.query(
        `SELECT e.id, e.title 
         FROM events e
         LEFT JOIN notification_deliveries nd ON nd.event_id = e.id AND nd.delivery_type = $1
         WHERE e.repeat_rule = 'yearly' 
           AND EXTRACT(MONTH FROM COALESCE(e.start_date, e.date, e.event_date::date)) = $2
           AND EXTRACT(DAY FROM COALESCE(e.start_date, e.date, e.event_date::date)) = $3
           AND nd.id IS NULL`,
        [`yearly-${todayStr}`, now.getMonth() + 1, now.getDate()]
      );

      for (const row of yearlyResult.rows) {
        await pool.query(`INSERT INTO notification_deliveries (event_id, delivery_type) VALUES ($1, $2)`, [row.id, `yearly-${todayStr}`]);
        await notifyEventMembers(row.id, "Sự kiện hằng năm", row.title);
      }
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error in check-events cron:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function notifyEventMembers(eventId: string, title: string, body: string) {
  try {
    // To simplify, we'll notify all active users. 
    // Ideally, we only notify members involved in the event.
    const usersResult = await pool.query("SELECT id FROM users WHERE active = TRUE");
    const targetUserIds = usersResult.rows.map(r => r.id);

    if (targetUserIds.length > 0) {
      await sendPushNotification(targetUserIds, {
        title,
        body,
        data: { url: "/?screen=notifications", eventId }
      });
    }
  } catch (error) {
    console.error("Error notifying event members:", error);
  }
}
