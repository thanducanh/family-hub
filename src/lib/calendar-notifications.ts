"use client";

export type CalendarNotificationAction = "created" | "updated" | "copied" | "moved" | "deleted";
export type CalendarNotificationType = "daily_events" | "event_created" | "event_updated" | "event_deleted" | "event_moved" | "event_copied" | "account_password_changed";
export type CalendarNotificationItem = { time: string; title: string };
export type CalendarNotificationUser = { id: string; role: "full_access" | "self_only"; memberId?: string };
export type CalendarNotificationInput = {
  eventId: string;
  action: CalendarNotificationAction;
  title: string;
  actor: { id: string; name: string; avatar?: string };
  calendarId?: string;
  visibleUserIds?: string[];
  visibleMemberIds?: string[];
  movedToDate?: string;
};
export type CalendarNotification = {
  id: string;
  type?: CalendarNotificationType;
  title?: string;
  eventId?: string;
  action?: CalendarNotificationAction;
  actionType?: CalendarNotificationAction;
  targetType?: "event";
  target_type?: "event";
  targetId?: string;
  target_id?: string;
  targetTitle?: string;
  target_title?: string;
  calendarId?: string;
  calendar_id?: string;
  actorUserId?: string;
  actor_user_id?: string;
  actorName?: string;
  actor_name?: string;
  actorAvatar?: string;
  actor_avatar?: string;
  visibleUserIds?: string[];
  visible_user_ids?: string[];
  visibleMemberIds?: string[];
  visible_member_ids?: string[];
  readUserIds?: string[];
  read_user_ids?: string[];
  message: string;
  items?: CalendarNotificationItem[];
  createdAt: string;
  read: boolean;
  userId?: string;
};

const key = "family-hub:calendar-notifications";
export const notificationEvent = "family-hub:calendar-notifications";

const types = { created: "event_created", updated: "event_updated", copied: "event_copied", moved: "event_moved", deleted: "event_deleted" } as const;
const verbs = { created: "đã tạo", updated: "đã cập nhật", copied: "đã copy", moved: "đã di chuyển", deleted: "đã xóa" } as const;

function unique(values: (string | undefined)[]) {
  return [...new Set(values.filter(Boolean) as string[])];
}
function readIds(item: CalendarNotification) {
  return item.readUserIds || item.read_user_ids || (item.read && item.userId ? [item.userId] : []);
}
function canSee(item: CalendarNotification, user?: CalendarNotificationUser) {
  if (!user) return false;
  if (item.type === "daily_events") return item.userId === user.id || (user.role === "full_access" && !item.userId);
  if (user.role === "full_access") return true;
  if ((item.actorUserId || item.actor_user_id) === user.id) return true;
  if ((item.visibleUserIds || item.visible_user_ids)?.includes(user.id)) return true;
  if (user.memberId && (item.visibleMemberIds || item.visible_member_ids)?.includes(user.memberId)) return true;
  return !(item.visibleUserIds || item.visible_user_ids)?.length && !(item.visibleMemberIds || item.visible_member_ids)?.length && item.userId === user.id;
}

export function loadCalendarNotifications() {
  if (typeof window === "undefined") return [] as CalendarNotification[];
  try { return JSON.parse(localStorage.getItem(key) || "[]") as CalendarNotification[]; } catch { return []; }
}
export function loadVisibleCalendarNotifications(user?: CalendarNotificationUser) {
  return loadCalendarNotifications().filter(item => canSee(item, user));
}
export function isCalendarNotificationUnread(item: CalendarNotification, user?: CalendarNotificationUser) {
  if (!user) return !item.read;
  return !readIds(item).includes(user.id);
}
export function addCalendarNotification(input: CalendarNotificationInput) {
  if (typeof window === "undefined") return;
  const visibleUserIds = unique([input.actor.id, ...(input.visibleUserIds || [])]);
  const visibleMemberIds = unique(input.visibleMemberIds || []);
  const movedSuffix = input.action === "moved" && input.movedToDate ? ` sang ${new Date(`${input.movedToDate}T00:00:00`).toLocaleDateString("vi-VN")}` : "";
  const message = `${input.actor.name} ${verbs[input.action]} sự kiện ${input.title}${movedSuffix}`;
  const noticeId = crypto.randomUUID();
  const next = [{
    id: noticeId,
    type: types[input.action],
    eventId: input.eventId,
    action: input.action,
    actionType: input.action,
    action_type: input.action,
    targetType: "event" as const,
    target_type: "event" as const,
    targetId: input.eventId,
    target_id: input.eventId,
    targetTitle: input.title,
    target_title: input.title,
    calendarId: input.calendarId,
    calendar_id: input.calendarId,
    actorUserId: input.actor.id,
    actor_user_id: input.actor.id,
    actorName: input.actor.name,
    actor_name: input.actor.name,
    actorAvatar: input.actor.avatar || "",
    actor_avatar: input.actor.avatar || "",
    visibleUserIds,
    visible_user_ids: visibleUserIds,
    visibleMemberIds,
    visible_member_ids: visibleMemberIds,
    readUserIds: [],
    read_user_ids: [],
    title: message,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  }, ...loadCalendarNotifications()].slice(0, 100);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(notificationEvent));

  // Sync to database
  fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: noticeId,
      title: message,
      message,
      createdByName: input.actor.name,
      visibleUserIds
    })
  }).catch(console.error);
}
export function addDailyEventNotification(userId: string, date: string, count: number, items: CalendarNotificationItem[]) {
  if (typeof window === "undefined" || count < 1) return;
  const noticeKey = `familyhub_daily_event_notice_${date}_${userId}`;
  if (localStorage.getItem(noticeKey)) return;
  localStorage.setItem(noticeKey, "true");
  const title = `Bạn có ${count} sự kiện hôm nay. Chúc một ngày tốt lành!`;
  const noticeId = crypto.randomUUID();
  const next = [{ id: noticeId, type: "daily_events" as const, title, message: title, items, userId, visibleUserIds: [userId], visible_user_ids: [userId], readUserIds: [], read_user_ids: [], createdAt: new Date().toISOString(), read: false }, ...loadCalendarNotifications()].slice(0, 100);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(notificationEvent));

  // Sync to database
  fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: noticeId,
      title,
      message: title,
      createdByName: "Family Hub",
      userId,
      visibleUserIds: [userId]
    })
  }).catch(console.error);
}
export function addAccountPasswordNotification(userId: string, message: string, actor?: { id: string; name: string; avatar?: string }) {
  if (typeof window === "undefined") return;
  const noticeId = crypto.randomUUID();
  const next = [{ id: noticeId, type: "account_password_changed" as const, title: message, message, userId, actorUserId: actor?.id, actor_user_id: actor?.id, actorName: actor?.name, actor_name: actor?.name, actorAvatar: actor?.avatar || "", actor_avatar: actor?.avatar || "", visibleUserIds: [userId], visible_user_ids: [userId], readUserIds: [], read_user_ids: [], createdAt: new Date().toISOString(), read: false }, ...loadCalendarNotifications()].slice(0, 100);
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(notificationEvent));

  // Sync to database
  fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: noticeId,
      title: message,
      message,
      createdByName: actor?.name || "Family Hub",
      userId,
      visibleUserIds: [userId]
    })
  }).catch(console.error);
}
export function markCalendarNotificationsRead(user?: CalendarNotificationUser) {
  const next = loadCalendarNotifications().map(item => {
    if (!user) return { ...item, read: true };
    if (!canSee(item, user)) return item;
    const readUserIds = unique([...readIds(item), user.id]);
    return { ...item, readUserIds, read_user_ids: readUserIds, read: item.read || false };
  });
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(notificationEvent));

  // Sync to database
  fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  }).catch(console.error);
}

export function markNotificationRead(id: string, user?: CalendarNotificationUser) {
  const next = loadCalendarNotifications().map(item => {
    if (item.id !== id) return item;
    if (!user) return { ...item, read: true };
    const readUserIds = unique([...readIds(item), user.id]);
    return { ...item, readUserIds, read_user_ids: readUserIds, read: true };
  });
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(notificationEvent));

  // Sync to database
  fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  }).catch(console.error);
}

