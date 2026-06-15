import webpush from "web-push";
import { pool } from "@/lib/db";

export async function getVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  // Check DB
  let result = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('vapid_public_key', 'vapid_private_key')");
  let keys: Record<string, string> = {};
  for (let row of result.rows) {
    keys[row.key] = row.value;
  }

  if (keys.vapid_public_key && keys.vapid_private_key) {
    return {
      publicKey: keys.vapid_public_key,
      privateKey: keys.vapid_private_key,
    };
  }

  // Generate and save
  const newKeys = webpush.generateVAPIDKeys();
  await pool.query(
    "INSERT INTO system_settings (key, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    ['vapid_public_key', newKeys.publicKey, 'vapid_private_key', newKeys.privateKey]
  );

  return newKeys;
}

export async function setupWebPush() {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(
    "mailto:admin@familyhub.local",
    keys.publicKey,
    keys.privateKey
  );
}

export default webpush;
