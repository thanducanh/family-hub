import { pool } from "@/lib/db";
import webpush from "@/lib/webpush";

export async function sendPushNotification(userIds: string[], payload: any) {
  if (userIds.length === 0) return;

  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(",");
  const query = `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`;
  
  try {
    const result = await pool.query(query, userIds);
    if (result.rows.length === 0) return;

    const notifications = result.rows.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      return webpush.sendNotification(pushSubscription, JSON.stringify(payload)).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          console.log("Removing expired push subscription", sub.endpoint);
          return pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [sub.endpoint]);
        }
        console.error("Error sending push notification", err);
      });
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
  }
}

export async function createSystemNotification({
  title,
  message,
  createdByName,
  userId,
  sourceType,
  sourceId,
  metadata
}: {
  title: string;
  message: string;
  createdByName: string;
  userId: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: any;
}) {
  try {
    const usersResult = await pool.query("SELECT id FROM users WHERE active = TRUE AND id != $1", [userId]);
    const targetUserIds = usersResult.rows.map(r => r.id);

    if (targetUserIds.length === 0) return;

    const visibleUserIdsStr = JSON.stringify(targetUserIds);

    await pool.query(
      `INSERT INTO notifications 
       (title, message, created_by_name, user_id, source_type, source_id, metadata, visible_user_ids, read_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]')`,
      [title, message, createdByName, userId, sourceType, sourceId, metadata ? JSON.stringify(metadata) : null, visibleUserIdsStr]
    );

    await sendPushNotification(targetUserIds, {
      title,
      body: message,
      data: { url: "/?screen=notifications" }
    });

  } catch (error) {
    console.error("Error in createSystemNotification:", error);
  }
}
