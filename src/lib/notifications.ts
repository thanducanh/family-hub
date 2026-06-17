export interface NotificationSettings {
  general: boolean;
  calendar: boolean;
  familyActions: boolean;
  vibrate: boolean;
  sound: boolean;
}

export const defaultNotificationSettings: NotificationSettings = {
  general: true,
  calendar: true,
  familyActions: true,
  vibrate: true,
  sound: true,
};

export interface LocalNotification {
  id: string;
  title: string;
  message: string;
  createdByName: string;
  createdAt: string;
  isRead: boolean;
  sourceType?: string;
  sourceId?: string;
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") return defaultNotificationSettings;
  try {
    const raw = localStorage.getItem("familyhub_notification_settings");
    if (raw) return { ...defaultNotificationSettings, ...JSON.parse(raw) };
  } catch (e) { }
  return defaultNotificationSettings;
}

export function saveNotificationSettings(settings: NotificationSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("familyhub_notification_settings", JSON.stringify(settings));
}

export function getLocalNotifications(): LocalNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("familyhub_notifications");
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return [];
}

export function saveLocalNotifications(notifications: LocalNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("familyhub_notifications", JSON.stringify(notifications));
  
  // Try to update app badge
  updateAppBadge(notifications.filter(n => !n.isRead).length);
}

export function updateAppBadge(unreadCount: number) {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    try {
      if (unreadCount > 0) {
        (navigator as any).setAppBadge(unreadCount);
      } else {
        (navigator as any).clearAppBadge();
      }
    } catch (e) { }
  }
}

export function addLocalNotification(notif: Omit<LocalNotification, "id" | "createdAt" | "isRead">) {
  const current = getLocalNotifications();
  const newNotif: LocalNotification = {
    ...notif,
    id: Date.now().toString() + Math.random().toString(36).substring(2),
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  saveLocalNotifications([newNotif, ...current]);
  return newNotif;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  
  let granted = Notification.permission === "granted";
  if (!granted && Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    granted = permission === "granted";
  }
  
  if (granted && "serviceWorker" in navigator && "PushManager" in window) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const response = await fetch("/api/vapid-public-key");
      const { publicKey } = await response.json();
      
      if (publicKey) {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        
        await fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription)
        });
      }
    } catch (e) {
      console.error("Failed to subscribe to push", e);
    }
  }

  return granted;
}

export function triggerSystemNotification(title: string, options?: NotificationOptions) {
  if (typeof Notification === "undefined") return;
  const settings = getNotificationSettings();
  if (!settings.general) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        ...options,
      });

      if (settings.vibrate && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (e) {}
  }
}
