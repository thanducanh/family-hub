"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Member } from "@/types";
import { ListIcon, ChevronRightIcon, ChevronDownIcon, ClockIcon, TypeIcon, RefreshCwIcon, PaletteIcon, Trash2Icon, MoonIcon, AlertTriangleIcon, CheckCircle2Icon, SearchIcon, FilterIcon, TagIcon, PlusIcon, BellIcon, LinkIcon, CopyIcon, LayoutGridIcon, MenuIcon } from "lucide-react";
import { getNotificationSettings, addLocalNotification, triggerSystemNotification } from "@/lib/notifications";
import { Solar } from "lunar-javascript";
import { getLunarDate } from "@/lib/vietnamese-lunar";
import { safeId } from "@/lib/safe-id";

type Actor = { id: string; role: "full_access" | "self_only"; displayName?: string; avatar?: string; memberId?: string };
type Calendar = { id: string; name: string; color: string; visible: boolean; type: string; ownerUserId: string; viewerUserIds: string[] };
type CustomList = { id: string; name: string; color: string; };
type CalendarView = "monthly" | "weekly" | "agenda";
type EventType = "family" | "personal" | "work" | "study" | "payment" | "reminder" | "birthday" | "holiday" | "other";
type EventStatus = "open" | "done";
type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  type: EventType;
  location: string;
  note: string;
  reminderMinutes: number;
  repeatRule: string;
  status: EventStatus;
  color: string;
  labelColor: string;
  memberIds: string[];
  createdByUserId?: string;
  createdAt?: string;
  visibility?: "all" | "private" | "custom";
  allowedMemberIds?: string[];
  relatedMemberIds?: string[];
};
type EventDraft = Omit<CalendarEvent, "id" | "color" | "createdAt"> & { id?: string };

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const input = "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-white/10 dark:bg-white/5";
const textarea = "w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-white/10 dark:bg-white/5";
const viDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const eventTypes: Array<{ value: EventType; label: string; color: string }> = [
  { value: "family", label: "Gia đình", color: "#3b82f6" },
  { value: "personal", label: "Cá nhân", color: "#8b5cf6" },
  { value: "work", label: "Công việc", color: "#10b981" },
  { value: "study", label: "Học tập", color: "#f97316" },
  { value: "payment", label: "Thanh toán", color: "#f43f5e" },
  { value: "reminder", label: "Nhắc nhở", color: "#ec4899" },
  { value: "birthday", label: "Sinh nhật", color: "#f59e0b" },
  { value: "holiday", label: "Ngày lễ", color: "#ef4444" },
  { value: "other", label: "Khác", color: "#64748b" }
];
const filterGroups: Array<{ value: EventType; label: string; }> = [
  { value: "family", label: "Lịch gia đình" },
  { value: "personal", label: "Lịch cá nhân" },
  { value: "birthday", label: "Sinh nhật" },
  { value: "holiday", label: "Ngày lễ" },
  { value: "work", label: "Công việc" },
  { value: "study", label: "Học tập" },
  { value: "reminder", label: "Nhắc nhở" }
];
const reminderOptions = [
  { value: 0, label: "Không" },
  { value: 5, label: "5 phút" },
  { value: 15, label: "15 phút" },
  { value: 60, label: "1 giờ" },
  { value: 1440, label: "1 ngày" }
];
const repeatOptions = [
  { value: "none", label: "Không" },
  { value: "daily", label: "Hằng ngày" },
  { value: "weekly", label: "Hằng tuần" },
  { value: "monthly", label: "Hằng tháng" },
  { value: "yearly", label: "Hằng năm" }
];

async function readJson<T>(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) as T : null; } catch { return null; }
}
function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
function formatDateVN(value: string) {
  const date = localDate(value);
  return date ? viDateFormatter.format(date) : value;
}
function todayIso() {
  return iso(new Date());
}
function getLunarText(dateString: string): { text: string, important: boolean } {
  const parsed = localDate(dateString);
  if (!parsed) return { text: "", important: false };
  const [lDay, lMonth, lYear, isLeap] = getLunarDate(parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear());
  const important = lDay === 1 || lDay === 15;
  return { text: lDay === 1 ? `${lDay}/${lMonth}` : `${lDay}`, important };
}
function addDays(value: string, days: number) {
  const date = localDate(value) || new Date();
  date.setDate(date.getDate() + days);
  return iso(date);
}

let __timetreeCalendarCache: {
  calendars?: Calendar[];
  eventsByMonth: Record<string, CalendarEvent[]>;
} = { eventsByMonth: {} };
function monthCells(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
function weekCells(selectedDate: string) {
  const anchor = localDate(selectedDate) || new Date();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}
function timeFromMinutes(value: number) {
  const hour = Math.max(0, Math.min(23, Math.floor(value / 60)));
  const minute = Math.max(0, Math.min(59, value % 60));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function defaultStartTime() {
  const now = new Date();
  return timeFromMinutes(now.getHours() * 60 + (now.getMinutes() >= 30 ? 30 : 0)) || "08:00";
}
function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}
function eventTypeMeta(type: string) {
  return eventTypes.find(item => item.value === type) || eventTypes[eventTypes.length - 1];
}
function sortEvents(left: CalendarEvent, right: CalendarEvent) {
  return Number(right.allDay) - Number(left.allDay) || left.startTime.localeCompare(right.startTime) || left.title.localeCompare(right.title);
}
function eventTimeLabel(item: Pick<CalendarEvent, "allDay" | "startTime">) {
  return item.allDay ? "Cả ngày" : item.startTime || "08:00";
}
function dayGroupTitle(date: string) {
  const today = todayIso();
  if (date === today) return "Hôm nay";
  if (date === addDays(today, 1)) return "Ngày mai";
  return formatDateVN(date);
}
function monthLabel(anchor: Date) {
  return `Tháng ${anchor.getMonth() + 1} / ${anchor.getFullYear()}`;
}
function eventColor(item: Pick<CalendarEvent, "type" | "color" | "labelColor">) {
  return item.labelColor || eventTypeMeta(item.type).color || item.color || "#6366f1";
}
function eventTone(type: string) {
  const tones: Record<string, { bg: string; text: string; border: string; dot: string; ring: string }> = {
    family: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500", ring: "hover:ring-blue-100" },
    personal: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500", ring: "hover:ring-violet-100" },
    work: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", ring: "hover:ring-emerald-100" },
    study: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", ring: "hover:ring-orange-100" },
    payment: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", ring: "hover:ring-rose-100" },
    reminder: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", dot: "bg-pink-500", ring: "hover:ring-pink-100" },
    birthday: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500", ring: "hover:ring-amber-100" },
    holiday: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", ring: "hover:ring-red-100" },
    other: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500", ring: "hover:ring-slate-100" }
  };
  return tones[type] || tones.other;
}
function memberName(member?: Member) {
  return member ? member.nickname || member.name : "";
}
function draftFor(date: string, calendarId: string, user?: Actor): EventDraft {
  const startTime = defaultStartTime();
  return {
    calendarId,
    title: "",
    startDate: date,
    startTime,
    endDate: date,
    endTime: timeFromMinutes(timeMinutes(startTime) + 60),
    allDay: false,
    type: "family",
    location: "",
    note: "",
    reminderMinutes: 0,
    repeatRule: "none",
    status: "open",
    labelColor: "",
    memberIds: user?.memberId ? [user.memberId] : [],
    createdByUserId: user?.id,
    visibility: "all",
    allowedMemberIds: [],
    relatedMemberIds: []
  };
}

function generateFixedEvents(year: number, members: Member[]): CalendarEvent[] {
  const fixed: CalendarEvent[] = [];
  
  // Holidays
  const holidays = [
    { date: "01-01", title: "Tết Dương lịch" },
    { date: "04-30", title: "Giải phóng miền Nam" },
    { date: "05-01", title: "Quốc tế Lao động" },
    { date: "09-02", title: "Quốc khánh" }
  ];
  holidays.forEach((h) => {
    fixed.push({
      id: `holiday-${year}-${h.date}`,
      calendarId: "fixed-holiday",
      title: h.title,
      startDate: `${year}-${h.date}`,
      startTime: "",
      endDate: `${year}-${h.date}`,
      endTime: "",
      allDay: true,
      type: "holiday",
      location: "",
      note: "Ngày lễ cố định",
      reminderMinutes: 0,
      repeatRule: "yearly",
      status: "open",
      color: "#e11d48",
      labelColor: "#e11d48",
      memberIds: [],
      visibility: "all",
      allowedMemberIds: [],
      relatedMemberIds: []
    });
  });

  // Birthdays
  members.forEach(member => {
    if (member.birthday) {
      const parts = member.birthday.split("-");
      if (parts.length === 3) {
        const mmdd = `${parts[1]}-${parts[2]}`;
        fixed.push({
          id: `birthday-${member.id}-${year}`,
          calendarId: "fixed-birthday",
          title: `Sinh nhật ${memberName(member)}`,
          startDate: `${year}-${mmdd}`,
          startTime: "",
          endDate: `${year}-${mmdd}`,
          endTime: "",
          allDay: true,
          type: "birthday",
          location: "",
          note: "Sinh nhật thành viên",
          reminderMinutes: 0,
          repeatRule: "yearly",
          status: "open",
          color: "#d97706",
          labelColor: "#d97706",
          memberIds: [member.id],
          visibility: "all",
          allowedMemberIds: [],
          relatedMemberIds: []
        });
      }
    }
  });

  return fixed;
}

export function TimeTreeCalendar({ members, user, t, onSaveEvent }: { members: Member[]; user?: Actor; t?: any; onSaveEvent?: (event: any) => Promise<any> | any }) {
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [view, setView] = useState<CalendarView>("monthly");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [hiddenLists, setHiddenLists] = useState<string[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const uid = user?.id || user?.memberId || "guest";
        const saved = localStorage.getItem(`familyHubCalendarEvents:${uid}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const uid = user?.id || user?.memberId || "guest";
      localStorage.setItem(`familyHubCalendarEvents:${uid}`, JSON.stringify(localEvents));
    }
  }, [localEvents, user]);

  const persistLocalEvent = (event: any) => {
    setLocalEvents(prev => {
      const exists = prev.some(item => item.id === event.id);
      if (exists) return prev.map(item => item.id === event.id ? event : item);
      return [...prev, event];
    });
  };

  const [enabled, setEnabled] = useState<string[]>([]);
  const [enabledTypes, setEnabledTypes] = useState<EventType[]>(["family", "personal", "birthday", "holiday", "work", "study", "reminder", "payment", "other"]);
  const [showLunar, setShowLunar] = useState(true);
  const [filterOpenMobile, setFilterOpenMobile] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null);
  const [quickPickerOpen, setQuickPickerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mobileTab, setMobileTab] = useState<"month" | "week" | "day" | "list">("month");

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");

  useEffect(() => {
    const val = localStorage.getItem("calendar-show-lunar");
    if (val !== null) setShowLunar(val === "true");

    const leftVal = localStorage.getItem("calendar_left_collapsed");
    if (leftVal !== null) setLeftCollapsed(leftVal === "true");

    const rightVal = localStorage.getItem("calendar_right_collapsed");
    if (rightVal !== null) setRightCollapsed(rightVal === "true");

    const densityVal = localStorage.getItem("calendar_density");
    if (densityVal === "compact" || densityVal === "comfortable") setDensity(densityVal);

    const storedCustomLists = localStorage.getItem("familyhub_calendar_lists");
    if (storedCustomLists) { try { setCustomLists(JSON.parse(storedCustomLists)); } catch(e){} }
    const storedHidden = localStorage.getItem("familyhub_calendar_visibility");
    if (storedHidden) { try { setHiddenLists(JSON.parse(storedHidden)); } catch(e){} }

    

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const actionParam = params.get("action");
      if (actionParam === "create") {
        setRightCollapsed(false);
        setDraft(draftFor(todayIso(), "", user));
        setDetail(null);
      }
      const viewParam = params.get("view");
      if (viewParam === "today") {
        const today = todayIso();
        setSelectedDate(today);
        setAnchor(new Date());
        setDaySheetDate(today);
      }
    }
  }, [user]);

  function toggleLunar() {
    const next = !showLunar;
    setShowLunar(next);
    localStorage.setItem("calendar-show-lunar", String(next));
  }

  function toggleLeft() {
    const next = !leftCollapsed;
    setLeftCollapsed(next);
    localStorage.setItem("calendar_left_collapsed", String(next));
  }

  function toggleRight() {
    const next = !rightCollapsed;
    setRightCollapsed(next);
    localStorage.setItem("calendar_right_collapsed", String(next));
  }

  function toggleDensity() {
    const next = density === "comfortable" ? "compact" : "comfortable";
    setDensity(next);
    localStorage.setItem("calendar_density", next);
  }

  function toggleListVisibility(id: string) {
    setHiddenLists(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("familyhub_calendar_visibility", JSON.stringify(next));
      return next;
    });
  }

  function saveCustomLists(next: CustomList[]) {
    setCustomLists(next);
    localStorage.setItem("familyhub_calendar_lists", JSON.stringify(next));
  }

  const days = useMemo(() => monthCells(anchor), [anchor]);
  const weekDays = useMemo(() => weekCells(selectedDate), [selectedDate]);
  
  const fixedEvents = useMemo(() => {
    const y = anchor.getFullYear();
    return [
      ...generateFixedEvents(y - 1, members),
      ...generateFixedEvents(y, members),
      ...generateFixedEvents(y + 1, members)
    ];
  }, [anchor, members]);

  const allEvents = useMemo(() => {
    const projectedEvents = (() => {
      const map = new Map();
      events.forEach(e => map.set(e.id, e));
      localEvents.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    })().flatMap(ev => {
      if (ev.repeatRule === "yearly") {
        const y = anchor.getFullYear();
        const m = ev.startDate.substring(5);
        const em = ev.endDate ? ev.endDate.substring(5) : m;
        return [
          { ...ev, startDate: `${y-1}-${m}`, endDate: `${y-1}-${em}`, id: `${ev.id}-${y-1}` },
          { ...ev, startDate: `${y}-${m}`, endDate: `${y}-${em}`, id: `${ev.id}-${y}` },
          { ...ev, startDate: `${y+1}-${m}`, endDate: `${y+1}-${em}`, id: `${ev.id}-${y+1}` }
        ];
      }
      return ev;
    });
    return [...projectedEvents, ...fixedEvents];
  }, [events, localEvents, fixedEvents, anchor]);

  const visibleEvents = useMemo(() => allEvents.filter(item => {
    if (item.calendarId === "fixed-birthday" || item.calendarId === "fixed-holiday") return true;
    const isCustom = customLists.some(c => c.id === item.calendarId);
    if (isCustom) {
      if (hiddenLists.includes(item.calendarId)) return false;
    } else {
      if (hiddenLists.includes(item.type)) return false;
    }
    return true;
  }), [hiddenLists, allEvents, customLists]);
  
  const selectedEvents = useMemo(() => visibleEvents.filter(item => item.startDate === selectedDate).sort(sortEvents), [selectedDate, visibleEvents]);
  const agendaEvents = useMemo(() => visibleEvents.filter(item => item.startDate >= iso(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) && item.startDate <= iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))).sort(sortEvents), [anchor, visibleEvents]);

  const load = useCallback(async (force = false) => {
    const monthKey = `${anchor.getMonth() + 1}-${anchor.getFullYear()}`;
    if (!force && __timetreeCalendarCache.calendars && __timetreeCalendarCache.eventsByMonth[monthKey]) {
      const nextCalendars = __timetreeCalendarCache.calendars;
      const nextEvents = __timetreeCalendarCache.eventsByMonth[monthKey];
      setCalendars(nextCalendars);
      setEvents(nextEvents);
      setEnabled(current => current.length ? current.filter(id => nextCalendars.some(calendar => calendar.id === id)) : nextCalendars.map(calendar => calendar.id));
      setError("");
      return;
    }

    const [calendarResponse, eventResponse] = await Promise.all([
      fetch("/api/calendars", { cache: "no-store" }),
      fetch(`/api/events?month=${anchor.getMonth() + 1}&year=${anchor.getFullYear()}`, { cache: "no-store" })
    ]);
    const calendarResult = await readJson<{ ok: boolean; data?: Calendar[]; error?: string }>(calendarResponse);
    const eventResult = await readJson<{ ok: boolean; data?: CalendarEvent[]; error?: string }>(eventResponse);
    if (!calendarResponse.ok || !eventResponse.ok) {
      setError(calendarResult?.error || eventResult?.error || "Không thể tải lịch.");
      return;
    }
    const nextCalendars = calendarResult?.data || [];
    const nextEvents = eventResult?.data || [];
    
    __timetreeCalendarCache.calendars = nextCalendars;
    __timetreeCalendarCache.eventsByMonth[monthKey] = nextEvents;

    setCalendars(nextCalendars);
    setEvents(nextEvents);
    setEnabled(current => current.length ? current.filter(id => nextCalendars.some(calendar => calendar.id === id)) : nextCalendars.map(calendar => calendar.id));
    setError("");
  }, [anchor]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) setView("agenda");
  }, []);

  function pickDate(date: string, openForm = false) {
    const parsed = localDate(date);
    setSelectedDate(date);
    if (parsed) setAnchor(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    if (openForm) openNewEvent(date);
  }
  function openDaySheet(date: string) {
    const parsed = localDate(date);
    setSelectedDate(date);
    if (parsed) setAnchor(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    setDetail(null);
    setDraft(null);
    setDaySheetDate(date);
  }
  function openNewEvent(date = selectedDate, initList?: any) {
    const calendarId = enabled[0] || calendars[0]?.id;
    if (!calendarId) {
      setError("Chưa có lịch để thêm sự kiện.");
      return;
    }
    setDetail(null);
    setDaySheetDate(null);
    const d = draftFor(date, calendarId, user);
    if (initList) {
      if (initList.id === "birthday") {
        d.calendarId = "birthday";
        d.type = "birthday";
        d.repeatRule = "yearly";
      } else if (initList.id === "holiday") {
        d.calendarId = "holiday";
        d.type = "holiday";
      } else {
        d.calendarId = initList.id;
        d.type = "other";
      }
      // Pre-fill memberIds from list assignment
      if (initList.memberId && initList.memberId !== "all") {
        d.memberIds = [initList.memberId];
      }
    } else {
      d.calendarId = "uncategorized";
      d.type = "other";
    }
    setDraft(d);
  }
  function openEditEvent(item: CalendarEvent) {
    setDetail(null);
    setDaySheetDate(null);
    setDraft({ ...item });
  }
  function openEventDetail(item: CalendarEvent) {
    setDaySheetDate(null);
    setDraft(null);
    setDetail(item);
  }
  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelectedDate(iso(now));
  }
  function goMonth(delta: number) {
    setAnchor(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }
  
async function pushAppNotification(notif: any, user: any) {
  const finalNotif = { ...notif, createdAt: new Date().toISOString(), read: false, id: notif.id || safeId() };
  try {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalNotif)
    });
    if (!res.ok) throw new Error("API fail");
  } catch(e) {
    // Fallback to local
    const uid = user?.id || user?.memberId || "guest";
    const key = `familyHubNotifications:${uid}`;
    let items = [];
    try { items = JSON.parse(localStorage.getItem(key) || "[]"); } catch(err){}
    items.unshift(finalNotif);
    localStorage.setItem(key, JSON.stringify(items));
  }
  // Dispatch custom event so family-app can update UI immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app_notification_created", { detail: finalNotif }));
  }
}

  function generateUUID() {
    return safeId();
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const id = draft.id || generateUUID();
    
    const startObj = new Date(`${draft.startDate}T${draft.allDay ? "00:00" : draft.startTime}`);
    const endObj = new Date(`${draft.endDate}T${draft.allDay ? "23:59" : draft.endTime}`);
    const startIso = startObj.toISOString();
    const endIso = endObj.toISOString();

    const eventToSave = {
      ...draft,
      id,
      title: draft.title.trim(),
      content: draft.title.trim(),
      date: draft.startDate,
      start: startIso,
      end: endIso,
      startAt: startIso,
      endAt: endIso,
      startsAt: startIso,
      endsAt: endIso,
      allDay: draft.allDay,
      repeat: draft.repeatRule,
      reminder: draft.reminderMinutes,
      labelColor: draft.labelColor,
      color: draft.labelColor,
      note: draft.note || "",
      source: "local"
    };

    let isNew = !draft.id;

    try {
      if (typeof onSaveEvent === "function") {
        const result = await onSaveEvent(eventToSave);
        if (result && typeof result === "object" && Object.keys(result).length > 0) {
          persistLocalEvent(result);
        } else {
          console.warn("[saveEvent] API returned empty result, saving local fallback", result);
          persistLocalEvent(eventToSave);
        }
      } else {
        const response = await fetch("/api/events", {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventToSave)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result?.ok && Object.keys(result).length > 0) {
          persistLocalEvent(eventToSave); // Should ideally be result data, but falling back
        } else {
          console.warn("[saveEvent] API returned empty result or error, saving local fallback", result);
          persistLocalEvent(eventToSave);
        }
      }
    } catch (error) {
      console.warn("[saveEvent] API unavailable, saving local fallback", error);
      persistLocalEvent(eventToSave);
    }
    
    // Clear cache to force refetch next time
    __timetreeCalendarCache.eventsByMonth = {};

    setDraft(null);
    setSelectedDate(draft.startDate);
    if (isNew) {
      setMobileTab("day");
    }

    // Notification
    const msg = `${user?.displayName || "Ai đó"} đã ${isNew ? "tạo" : "sửa"} sự kiện lịch "${draft.title}"`;
    const notifObj = {
      title: "Cập nhật lịch",
      message: msg,
      module: "Lịch",
      type: isNew ? "calendar_event_created" : "calendar_event_updated",
      createdByName: user?.displayName || "Ai đó",
      userId: user?.id,
      relatedId: eventToSave.id,
      relatedType: "event",
      dedupeKey: isNew 
        ? `calendar:event-created:${eventToSave.id}`
        : `calendar:event-updated:${eventToSave.id}:${(eventToSave as any).updatedAt || new Date().getTime()}`
    };
    pushAppNotification(notifObj, user);
    
    // System notification fallback if settings allow
    const settings = getNotificationSettings();
    if (settings.calendar) {
      triggerSystemNotification("Cập nhật lịch", { body: msg });
    }
  }
  async function deleteEvent(item: CalendarEvent) {
    const response = await fetch(`/api/events?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const result = await readJson<{ ok: boolean; error?: string }>(response);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Không thể xóa sự kiện.");
      return;
    }
    setDetail(null);
    setDraft(null);
    setLocalEvents(prev => prev.filter(e => e.id !== item.id));
    __timetreeCalendarCache.eventsByMonth = {};
    await load(true);
    
    // Notification
    const msg = `${user?.displayName || "Ai đó"} đã xóa sự kiện lịch "${item.title}"`;
    pushAppNotification({
      title: "Xóa sự kiện",
      message: msg,
      module: "Lịch",
      type: "calendar_event_deleted",
      createdByName: user?.displayName || "Ai đó",
      userId: user?.id,
      relatedId: item.id,
      relatedType: "event",
      dedupeKey: `calendar:event-deleted:${item.id}`
    }, user);
    const settings = getNotificationSettings();
    if (settings.calendar) {
      triggerSystemNotification("Xóa sự kiện lịch", { body: msg });
    }
  }
  async function markDone(item: CalendarEvent) {
    const response = await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, status: item.status === "done" ? "open" : "done" })
    });
    const result = await readJson<{ ok: boolean; error?: string }>(response);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Không thể cập nhật trạng thái.");
      return;
    }
    setDetail(null);
    __timetreeCalendarCache.eventsByMonth = {};
    await load(true);
  }

  const gridLayoutClass = ""; // Not used anymore

  return (
    <>
    <div className="hidden md:flex h-[calc(100vh-64px)] w-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <CalendarToolbar
        anchor={anchor}
        view={view}
        setView={setView}
        today={goToday}
        prev={() => goMonth(-1)}
        next={() => goMonth(1)}
        add={() => openNewEvent(selectedDate)}
        quickPickerOpen={quickPickerOpen}
        setQuickPickerOpen={setQuickPickerOpen}
        setAnchor={setAnchor}
        setSelectedDate={setSelectedDate}
        showLunar={showLunar}
        toggleLunar={toggleLunar}
        filterOpenMobile={filterOpenMobile}
        setFilterOpenMobile={setFilterOpenMobile}
        leftCollapsed={leftCollapsed}
        toggleLeft={toggleLeft}
        rightCollapsed={rightCollapsed}
        toggleRight={toggleRight}
        enabledTypes={enabledTypes}
        setEnabledTypes={setEnabledTypes}
      />
      {error && <div className="bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</div>}

      <div className="flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <aside className={`hidden xl:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-white/10 dark:bg-slate-900 ${leftCollapsed ? "w-[60px]" : "w-[260px]"}`}>
          <FilterContent calendars={calendars} events={allEvents} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} collapsed={leftCollapsed} toggle={toggleLeft} />
        </aside>

        {filterOpenMobile && (
          <div className="fixed inset-0 z-50 flex bg-black/45 xl:hidden" onMouseDown={() => setFilterOpenMobile(false)}>
             <div onMouseDown={e => e.stopPropagation()} className="h-full w-[280px] overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Lịch hiển thị</h3>
                  <button type="button" onClick={() => setFilterOpenMobile(false)} className="flex size-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500">×</button>
                </div>
                <FilterContent calendars={calendars} events={allEvents} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} collapsed={false} />
             </div>
          </div>
        )}

        <main className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
          {view === "monthly" && (
            <div className="flex flex-1 flex-col">
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">
                {weekdays.map((day, idx) => (
                  <div key={day} className={`py-1.5 text-center text-[10px] font-medium uppercase tracking-wider ${idx === 6 ? "text-rose-500" : "text-slate-400"}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-7 grid-rows-6">
                {days.map(date => {
                  const dateIso = iso(date);
                  return (
                    <DayCell
                      key={dateIso}
                      date={date}
                      anchor={anchor}
                      selected={selectedDate === dateIso}
                      events={visibleEvents.filter(item => item.startDate === dateIso).sort(sortEvents)}
                      select={() => pickDate(dateIso)}
                      add={() => pickDate(dateIso, true)}
                      open={openEventDetail}
                      showLunar={showLunar}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {view === "weekly" && (
            <WeeklyView
              days={weekDays}
              events={visibleEvents}
              selectedDate={selectedDate}
              selectDate={date => pickDate(date)}
              add={date => pickDate(date, true)}
              open={openEventDetail}
            />
          )}

          {view === "agenda" && (
            <div className="overflow-y-auto p-4 flex-1">
              <AgendaView
                events={agendaEvents}
                members={members}
                open={openEventDetail}
                edit={openEditEvent}
                remove={deleteEvent}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            </div>
          )}
        </main>

        <aside className={`hidden xl:flex flex-col border-l border-slate-200 bg-slate-50 transition-all duration-300 dark:border-white/10 dark:bg-slate-950 ${rightCollapsed ? "w-[60px]" : "w-[360px] relative"}`}>
          {rightCollapsed ? (
            <button onClick={toggleRight} className="flex flex-1 flex-col items-center py-4 text-slate-400 hover:text-indigo-600">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
               <span className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>Agenda</span>
            </button>
          ) : detail ? (
             <EventDetailInline item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />
          ) : draft ? (
             <EventEditorInline draft={draft} calendars={calendars} customLists={customLists} members={members} user={user} setDraft={setDraft} close={() => setDraft(null)} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />
          ) : (
            <div className="relative flex flex-1 flex-col overflow-y-auto bg-white dark:bg-slate-900">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 p-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
                <h3 className="text-sm font-bold tracking-wide">Agenda</h3>
                <button onClick={toggleRight} className="grid size-8 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/5" title="Thu gọn panel"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
              </div>
              <div className="flex-1 p-3">
                 <AgendaView title={dayGroupTitle(selectedDate)} date={selectedDate} events={selectedEvents} members={members} open={openEventDetail} edit={openEditEvent} remove={deleteEvent} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} emptyText="Không có sự kiện" addEmpty={() => openNewEvent(selectedDate)} />
              </div>
            </div>
          )}
        </aside>
      </div>

      {mobileTab !== "list" && <button type="button" onClick={() => openNewEvent(selectedDate)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-indigo-600 text-3xl font-semibold text-white shadow-xl transition hover:bg-indigo-700 xl:hidden" aria-label={t ? t("addEvent") : "Thêm sự kiện"}>+</button>}

      <div className="xl:hidden">
        {daySheetDate && <DayEventsSheet date={daySheetDate} events={visibleEvents.filter(item => item.startDate === daySheetDate).sort(sortEvents)} members={members} close={() => setDaySheetDate(null)} add={() => openNewEvent(daySheetDate)} open={openEventDetail} edit={openEditEvent} remove={deleteEvent} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
        {draft && <EventEditorSheet draft={draft} calendars={calendars} customLists={customLists} members={members} user={user} setDraft={setDraft} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />}
        {detail && <EventDetailSheet item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />}
      </div>
    </div>

    <div className="block md:hidden h-[calc(100dvh-64px-env(safe-area-inset-bottom,0px))] w-full overflow-hidden bg-[var(--app-background)]">
      <MobileCalendarView 
        mobileTab={mobileTab} setMobileTab={setMobileTab}
        anchor={anchor} setAnchor={setAnchor}
        selectedDate={selectedDate} pickDate={pickDate}
        events={allEvents} visibleEvents={visibleEvents} selectedEvents={selectedEvents} agendaEvents={agendaEvents}
        calendars={calendars} members={members}
        enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes}
        openEventDetail={openEventDetail} openNewEvent={(initList?: any) => openNewEvent(selectedDate, initList)}
        showLunar={showLunar} user={user}
        customLists={customLists} saveCustomLists={saveCustomLists}
        hiddenLists={hiddenLists} toggleListVisibility={toggleListVisibility}
        setEvents={setEvents} goToday={goToday}
        openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
      />
      {draft && <EventEditorSheet draft={draft} calendars={calendars} customLists={customLists} members={members} user={user} setDraft={setDraft} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />}
      {detail && <EventDetailSheet item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />}
    </div>
    </>
  );
}

function CalendarToolbar({ anchor, view, setView, today, prev, next, add, quickPickerOpen, setQuickPickerOpen, setAnchor, setSelectedDate, showLunar, toggleLunar, filterOpenMobile, setFilterOpenMobile, leftCollapsed, toggleLeft, rightCollapsed, toggleRight, enabledTypes, setEnabledTypes }: {
  anchor: Date;
  view: CalendarView;
  setView: (view: CalendarView) => void;
  today: () => void;
  prev: () => void;
  next: () => void;
  add: () => void;
  quickPickerOpen: boolean;
  setQuickPickerOpen: (open: boolean) => void;
  setAnchor: (date: Date) => void;
  setSelectedDate: (date: string) => void;
  showLunar: boolean;
  toggleLunar: () => void;
  filterOpenMobile: boolean;
  setFilterOpenMobile: (open: boolean) => void;
  leftCollapsed?: boolean;
  toggleLeft?: () => void;
  rightCollapsed?: boolean;
  toggleRight?: () => void;
  enabledTypes: EventType[];
  setEnabledTypes: React.Dispatch<React.SetStateAction<EventType[]>>;
}) {
  const [month, setMonth] = useState(anchor.getMonth() + 1);
  const [year, setYear] = useState(anchor.getFullYear());
  useEffect(() => { setMonth(anchor.getMonth() + 1); setYear(anchor.getFullYear()); }, [anchor]);
  
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center sm:gap-4">
        {toggleLeft && (
          <button type="button" onClick={toggleLeft} className="hidden sm:grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200 xl:grid" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        )}
        <button type="button" onClick={() => setFilterOpenMobile(!filterOpenMobile)} className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200 xl:hidden" aria-label="Menu Mobile">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        
        <div className="hidden lg:flex items-center gap-4">
          <span className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Family Calendar</span>
          <button type="button" onClick={today} className="px-3 py-1 text-sm font-medium rounded hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10">Today</button>
          <div className="flex items-center text-slate-400">
            <button type="button" onClick={prev} className="p-1 hover:text-slate-800 dark:hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
            <button type="button" onClick={next} className="p-1 hover:text-slate-800 dark:hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">{anchor.getFullYear()} Tháng {anchor.getMonth() + 1}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <div className="hidden lg:flex items-center gap-2">
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${showLunar ? "bg-slate-100 text-indigo-700 dark:bg-white/10 dark:text-indigo-300" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"}`}>
             <input type="checkbox" checked={showLunar} onChange={toggleLunar} className="sr-only" />
             Âm lịch
          </label>
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${enabledTypes.includes("birthday") ? "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"}`}>
             <input type="checkbox" checked={enabledTypes.includes("birthday")} onChange={() => setEnabledTypes(curr => curr.includes("birthday") ? curr.filter(t => t !== "birthday") : [...curr, "birthday"])} className="sr-only" />
             <i className="size-2 rounded-full bg-amber-500" /> Sinh nhật
          </label>
          <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${enabledTypes.includes("holiday") ? "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"}`}>
             <input type="checkbox" checked={enabledTypes.includes("holiday")} onChange={() => setEnabledTypes(curr => curr.includes("holiday") ? curr.filter(t => t !== "holiday") : [...curr, "holiday"])} className="sr-only" />
             <i className="size-2 rounded-full bg-red-500" /> Ngày lễ
          </label>
        </div>

        <div className="hidden rounded bg-slate-100 p-0.5 dark:bg-white/5 md:flex mx-2">
          {["monthly", "weekly", "agenda"].map(val => (
            <button key={val} onClick={() => setView(val as CalendarView)} className={`px-3 py-1 text-[11px] font-semibold rounded ${view === val ? "bg-white shadow-sm text-slate-900 dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}>{val === "monthly" ? "Tháng" : val === "weekly" ? "Tuần" : "DS"}</button>
          ))}
        </div>
        
        <button type="button" className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hidden sm:block"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
        <button type="button" onClick={add} className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <div className="size-7 sm:size-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-bold ml-1">U</div>
      </div>
    </div>
  );
}

function DayCell({ date, anchor, selected, events, select, add, open, showLunar }: { date: Date; anchor: Date; selected: boolean; events: CalendarEvent[]; select: () => void; add: () => void; open: (event: CalendarEvent) => void; showLunar?: boolean; density?: "compact" | "comfortable" }) {
  const dateIso = iso(date);
  const isToday = dateIso === todayIso();
  const inMonth = date.getMonth() === anchor.getMonth();
  const visible = events.slice(0, 5); 
  const lunarInfo = showLunar ? getLunarText(dateIso) : { text: "", important: false };

  return (
    <div onClick={select} onDoubleClick={add} className={`group relative flex flex-col min-w-0 bg-white dark:bg-slate-900 border-b border-r border-slate-100 dark:border-white/5 outline-none transition-colors ${!inMonth ? "bg-slate-50/30 text-slate-400 dark:bg-white/[0.01]" : ""} ${selected ? "bg-indigo-50/20" : ""} hover:bg-slate-50/50 dark:hover:bg-white/[0.03]`}>
      <div className="flex items-center justify-center pt-1 pb-0.5 relative">
         {isToday ? (
           <span className="flex size-[22px] items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{date.getDate()}</span>
         ) : (
           <span className={`text-[12px] font-semibold leading-none pt-[1px] ${date.getDay() === 0 ? "text-rose-500" : inMonth ? "text-slate-700 dark:text-slate-300" : "text-slate-400"} ${selected ? "text-indigo-600 font-bold" : ""}`}>{date.getDate()}</span>
         )}
         {showLunar && <span className={`absolute right-1 text-[9px] leading-none pt-[1px] ${lunarInfo.important ? "text-rose-500 font-bold" : "text-slate-400"}`}>{lunarInfo.text}</span>}
      </div>
      <div className="flex-1 space-y-[1px] px-0.5 pb-0.5 overflow-hidden">
        {visible.map(item => {
          const tone = eventTone(item.type);
          if (item.allDay) {
             return (
               <div key={item.id} onClick={(e) => { e.stopPropagation(); open(item); }} className={`cursor-pointer rounded-sm px-1 py-0.5 text-[10px] font-semibold truncate leading-none ${tone.bg} ${tone.text}`}>
                 {item.title}
               </div>
             );
          }
          return (
            <div key={item.id} onClick={(e) => { e.stopPropagation(); open(item); }} className="flex cursor-pointer items-center gap-1 px-1 py-0.5 text-[11px] font-medium leading-none hover:bg-slate-100 dark:hover:bg-white/5">
               <i className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
               <span className={`flex-1 truncate ${tone.text}`}>{item.title}</span>
               <span className="shrink-0 text-[9px] text-slate-500 tabular-nums">{item.startTime}</span>
            </div>
          );
        })}
        {events.length > visible.length && <span className="block px-1 text-[10px] font-medium text-slate-400">+{events.length - visible.length} more</span>}
      </div>
    </div>
  );
}

function WeeklyView({ days, events, selectedDate, selectDate, add, open }: { days: Date[]; events: CalendarEvent[]; selectedDate: string; selectDate: (date: string) => void; add: (date: string) => void; open: (event: CalendarEvent) => void }) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">
        {days.map((date, idx) => {
          const dateIso = iso(date);
          return (
            <button key={dateIso} type="button" onClick={() => selectDate(dateIso)} onDoubleClick={() => add(dateIso)} className={`p-2 text-center ${selectedDate === dateIso ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
              <b className={`block text-[11px] uppercase tracking-wider ${idx === 6 ? "text-rose-500" : "text-slate-500"}`}>{weekdays[(date.getDay() + 6) % 7]}</b>
              <span className="mt-0.5 block text-lg font-bold">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="grid flex-1 grid-cols-7 overflow-y-auto">
        {days.map(date => {
          const dateIso = iso(date);
          const dayEvents = events.filter(item => item.startDate === dateIso).sort(sortEvents);
          return (
            <div key={dateIso} onClick={() => selectDate(dateIso)} onDoubleClick={() => add(dateIso)} className={`border-r border-slate-200 p-1 last:border-r-0 dark:border-white/10 ${selectedDate === dateIso ? "bg-indigo-50/20" : ""}`}>
              <div className="space-y-1">
                {dayEvents.map(item => {
                  const tone = eventTone(item.type);
                  return (
                    <div key={item.id} onClick={(e) => { e.stopPropagation(); open(item); }} className={`cursor-pointer rounded border p-1.5 text-left hover:opacity-80 ${tone.bg} ${tone.border} ${tone.text}`}>
                      <span className="block text-[10px] font-bold tabular-nums opacity-70">{eventTimeLabel(item)}</span>
                      <b className="block truncate text-xs">{item.title}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ events, members, open, edit, remove, openMenuId, setOpenMenuId, title, date, emptyText = "Chưa có sự kiện", addEmpty }: { events: CalendarEvent[]; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void; title?: string; date?: string; emptyText?: string; addEmpty?: () => void }) {
  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, item) => {
    acc[item.startDate] = [...(acc[item.startDate] || []), item];
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.keys(groups).length ? Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)).map(([dateKey, items]) => (
        <div key={dateKey}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`text-sm font-bold ${localDate(dateKey)?.getDay() === 0 ? "text-rose-500" : "text-slate-800 dark:text-slate-200"}`}>{dateKey === todayIso() ? "Hôm nay" : formatDateVN(dateKey)}</span>
            <span className="text-[10px] font-semibold text-slate-400">{getLunarText(dateKey).text}</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/5"></div>
          </div>
          <div className="space-y-1.5">
            {items.sort(sortEvents).map(item => <AgendaItem key={item.id} item={item} members={members} open={open} edit={edit} remove={remove} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />)}
          </div>
        </div>
      )) : (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <span className="mb-1 text-xl">📅</span>
          <p className="text-xs font-bold text-slate-500">{emptyText}</p>
          {addEmpty && <button type="button" onClick={addEmpty} className="mt-2 h-7 rounded-md bg-indigo-50 px-3 text-xs font-bold text-indigo-600 hover:bg-indigo-100">+ Tạo sự kiện</button>}
        </div>
      )}
    </div>
  );
}

function AgendaItem({ item, members, open, edit, remove, openMenuId, setOpenMenuId }: { item: CalendarEvent; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = eventTypeMeta(item.type);
  const tone = eventTone(item.type);
  useEffect(() => {
    if (openMenuId !== item.id) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [item.id, openMenuId, setOpenMenuId]);
  return (
    <div className="group relative flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => open(item)}>
      <div className="w-9 shrink-0 text-right">
        <span className={`text-[10px] font-bold tabular-nums ${item.allDay ? "text-slate-400" : tone.text}`}>{eventTimeLabel(item)}</span>
      </div>
      <i className={`h-6 w-1 shrink-0 rounded-full ${tone.dot}`} />
      <div className="min-w-0 flex-1">
        <b className={`block truncate text-xs ${item.status === "done" ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>
          {item.title}
        </b>
        {item.location && <small className="block truncate text-[10px] text-slate-400">{item.location}</small>}
      </div>
    </div>
  );
}

function FilterContent({ calendars, events, enabled, setEnabled, enabledTypes, setEnabledTypes, collapsed, toggle }: { calendars: Calendar[]; events: CalendarEvent[]; enabled: string[]; setEnabled: React.Dispatch<React.SetStateAction<string[]>>; enabledTypes: EventType[]; setEnabledTypes: React.Dispatch<React.SetStateAction<EventType[]>>; collapsed?: boolean; toggle?: () => void; }) {
  const allTypes = filterGroups.map(g => g.value);
  const allCals = calendars.map(c => c.id);
  const countByType = events.reduce((acc, ev) => { acc[ev.type] = (acc[ev.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  const countByCal = events.reduce((acc, ev) => { acc[ev.calendarId] = (acc[ev.calendarId] || 0) + 1; return acc; }, {} as Record<string, number>);
  
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 space-y-4 h-full">
        <div className="flex flex-col items-center space-y-3">
          {calendars.map(calendar => (
            <div key={calendar.id} className="cursor-pointer" title={calendar.name} onClick={() => setEnabled(current => current.includes(calendar.id) ? current.filter(id => id !== calendar.id) : [...current, calendar.id])}>
              <div className={`block size-6 rounded flex items-center justify-center shadow-sm transition-all ${enabled.includes(calendar.id) ? "opacity-100" : "opacity-40 hover:opacity-80"}`} style={{ background: calendar.color }}>
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
       <div className="px-4 pb-2 pt-2">
         <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lịch người dùng</h2>
       </div>
       <div className="space-y-0.5 px-2">
          {calendars.map(calendar => (
             <div key={calendar.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => setEnabled(current => current.includes(calendar.id) ? current.filter(id => id !== calendar.id) : [...current, calendar.id])}>
                <div className={`size-6 rounded flex items-center justify-center shrink-0 transition-opacity ${enabled.includes(calendar.id) ? "opacity-100" : "opacity-30"}`} style={{ backgroundColor: calendar.color }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{calendar.name}</p>
                </div>
                <div className="shrink-0 size-5 rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 flex items-center justify-center">O</div>
                <button className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-400" onClick={e => e.stopPropagation()}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></button>
             </div>
          ))}
          <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/5 w-full text-slate-500 hover:text-slate-800">
             <div className="size-6 rounded border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             </div>
             <span className="text-sm font-medium">Thêm lịch</span>
          </button>
       </div>

       <div className="px-4 pb-2 pt-6">
         <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bộ lọc sự kiện</h2>
       </div>
       <div className="space-y-0.5 px-2">
          {filterGroups.filter(g => g.value !== "birthday" && g.value !== "holiday").map(group => (
             <div key={group.value} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => setEnabledTypes(current => current.includes(group.value) ? current.filter(id => id !== group.value) : [...current, group.value])}>
                <div className={`size-6 rounded-full flex items-center justify-center shrink-0 transition-opacity ${enabledTypes.includes(group.value) ? "opacity-100" : "opacity-30"}`} style={{ backgroundColor: eventTypeMeta(group.value).color }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{group.label}</span>
                {countByType[group.value] > 0 && <span className="text-xs text-slate-400">{countByType[group.value]}</span>}
             </div>
          ))}
       </div>
    </div>
  );
}

function EventEditorInline({ draft, calendars, customLists = [], members, user, setDraft, save, close, remove }: { draft: EventDraft; calendars: Calendar[]; customLists?: CustomList[]; members: Member[]; user?: Actor; setDraft: (draft: EventDraft | null) => void; save: (event: React.FormEvent) => void; close: () => void; remove?: () => void }) {
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [repeatSheetOpen, setRepeatSheetOpen] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);

  const repeatSheetOptions = [
    { value: "none", label: "Không lặp lại" },
    { value: "daily", label: "Hàng ngày" },
    { value: "weekly", label: "Hàng tuần" },
    { value: "monthly", label: "Hàng tháng" },
    { value: "yearly", label: "Hàng năm" }
  ];

  const reminderSheetOptions = [
    { value: -1, label: "Không nhắc" },
    { value: 0, label: "Đúng giờ" },
    { value: 5, label: "Trước 5 phút" },
    { value: 15, label: "Trước 15 phút" },
    { value: 60, label: "Trước 1 giờ" },
    { value: 1440, label: "Trước 1 ngày" }
  ];

  const colors = [
    { value: "#800020", label: "Wine Red" },
    { value: "#D4AF37", label: "Gold" },
    { value: "#059669", label: "Green" },
    { value: "#E11D48", label: "Red" },
    { value: "#2563EB", label: "Blue" },
    { value: "#7C3AED", label: "Purple" },
    { value: "#F97316", label: "Orange" },
    { value: "#DB2777", label: "Pink" },
    { value: "#0891B2", label: "Cyan" },
    { value: "#475569", label: "Slate" },
    { value: "#92400E", label: "Brown" },
    { value: "#171018", label: "Black" },
  ];

  useEffect(() => {
    if (!draft.labelColor) {
      setDraft({ ...draft, labelColor: "#800020" });
    }
  }, [draft, setDraft]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!draft.title.trim()) {
      setFormError("Vui lòng nhập nội dung sự kiện");
      return;
    }
    const startObj = new Date(`${draft.startDate}T${draft.allDay ? "00:00" : draft.startTime}`);
    const endObj = new Date(`${draft.endDate}T${draft.allDay ? "23:59" : draft.endTime}`);
    if (endObj < startObj) {
      setFormError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }
    setIsSaving(true);
    try {
      await save(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#F8F5F2] w-full overflow-hidden absolute inset-0 z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-[#F8F5F2] border-b border-[#E8DCD5] shrink-0">
        <button type="button" onClick={close} className="p-1 text-[#6B5E64] hover:text-[#171018]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span className="font-bold text-[15px] text-[#171018]">{draft.id ? "Sửa sự kiện" : "Tạo sự kiện"}</span>
        <button type="button" onClick={handleSave} disabled={isSaving} className="px-4 py-1.5 bg-[#800020] text-white rounded-full text-[13px] font-bold shadow-sm disabled:opacity-50 min-w-[70px]">
          {isSaving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-[100px] px-4 pt-4">
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="bg-[#FFF1F2] border border-[#E8DCD5] rounded-xl p-3 shadow-sm">
              <p className="text-[#E11D48] text-[13px] font-medium">{formError}</p>
            </div>
          )}
          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] p-3 shadow-sm focus-within:border-[#800020] focus-within:ring-1 focus-within:ring-[#800020]">
            <input 
              autoFocus 
              className="w-full text-[15px] font-medium placeholder:text-[#6B5E64]/60 outline-none bg-transparent text-[#171018]" 
              placeholder="Nhập nội dung sự kiện" 
              value={draft.title} 
              onChange={e => setDraft({ ...draft, title: e.target.value })} 
            />
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] shadow-sm flex flex-col overflow-hidden">
            <label className="flex items-center justify-between p-3 border-b border-[#E8DCD5] cursor-pointer">
              <span className="text-[14px] text-[#171018] font-medium">Cả ngày</span>
              <input type="checkbox" checked={draft.allDay} onChange={e => setDraft({ ...draft, allDay: e.target.checked })} className="size-5 rounded border-[#E8DCD5] text-[#800020] focus:ring-[#800020] cursor-pointer" />
            </label>

            <div className="flex flex-col p-3 border-b border-[#E8DCD5] gap-2">
              <span className="text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide">Bắt đầu</span>
              <div className="flex items-center gap-2">
                <input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value, endDate: e.target.value > draft.endDate ? e.target.value : draft.endDate })} className="flex-1 h-10 rounded-lg border border-[#E8DCD5] bg-[#F8F5F2] px-3 text-[14px] font-medium outline-none text-[#171018] focus:border-[#800020]" />
                {!draft.allDay && (
                  <input type="time" value={draft.startTime} onChange={e => setDraft({ ...draft, startTime: e.target.value })} className="w-24 h-10 rounded-lg border border-[#E8DCD5] bg-[#F8F5F2] px-2 text-[14px] font-medium outline-none text-[#171018] focus:border-[#800020]" />
                )}
              </div>
            </div>

            <div className="flex flex-col p-3 gap-2">
              <span className="text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide">Kết thúc</span>
              <div className="flex items-center gap-2">
                <input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} className="flex-1 h-10 rounded-lg border border-[#E8DCD5] bg-[#F8F5F2] px-3 text-[14px] font-medium outline-none text-[#171018] focus:border-[#800020]" />
                {!draft.allDay && (
                  <input type="time" value={draft.endTime} onChange={e => setDraft({ ...draft, endTime: e.target.value })} className="w-24 h-10 rounded-lg border border-[#E8DCD5] bg-[#F8F5F2] px-2 text-[14px] font-medium outline-none text-[#171018] focus:border-[#800020]" />
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] shadow-sm flex flex-col overflow-hidden">
            <button type="button" onClick={() => setRepeatSheetOpen(true)} className="flex items-center justify-between p-3 border-b border-[#E8DCD5]">
              <span className="text-[14px] text-[#171018] font-medium">Lặp lại</span>
              <div className="flex items-center gap-1 text-[14px] font-medium text-[#800020]">
                <span>{repeatSheetOptions.find(o => o.value === draft.repeatRule)?.label || "Không"}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
            
            <button type="button" onClick={() => setReminderSheetOpen(true)} className="flex items-center justify-between p-3">
              <span className="text-[14px] text-[#171018] font-medium">Thông báo</span>
              <div className="flex items-center gap-1 text-[14px] font-medium text-[#800020]">
                <span>{reminderSheetOptions.find(o => o.value === draft.reminderMinutes)?.label || "Không"}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] p-3 shadow-sm">
            <span className="block text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide mb-3">Màu sự kiện</span>
            <div className="flex flex-wrap items-center gap-2">
              {colors.map(c => (
                <button 
                  key={c.value} 
                  type="button" 
                  onClick={() => setDraft({ ...draft, labelColor: c.value })}
                  className={`size-[30px] shrink-0 rounded-full flex items-center justify-center transition-transform ${draft.labelColor === c.value ? "scale-105 ring-2 ring-offset-2 ring-[#D4AF37]" : ""}`}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.label}
                >
                  {draft.labelColor === c.value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFFFF] rounded-xl border border-[#E8DCD5] shadow-sm flex flex-col p-3">
            <span className="block text-[12px] text-[#6B5E64] font-medium uppercase tracking-wide mb-2">Ghi chú</span>
            <textarea 
              className="w-full h-24 text-[14px] text-[#171018] placeholder:text-[#6B5E64]/60 outline-none bg-transparent resize-none" 
              placeholder="Thêm ghi chú..." 
              value={draft.note} 
              onChange={e => setDraft({ ...draft, note: e.target.value })} 
            />
          </div>

          {remove && draft.id && (
            <button type="button" onClick={remove} className="w-full py-3 bg-[#FFFFFF] text-[#E11D48] font-bold text-[14px] rounded-xl shadow-sm border border-[#E8DCD5] mt-2 active:scale-95 transition-transform">
              Xóa sự kiện
            </button>
          )}
          
        </div>
      </div>

      {repeatSheetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40" onMouseDown={() => setRepeatSheetOpen(false)}>
          <div onMouseDown={e => e.stopPropagation()} className="bg-[#FFFFFF] rounded-t-2xl pb-8 pt-4 px-4 flex flex-col animate-in slide-in-from-bottom-10">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1.5 rounded-full bg-[#E8DCD5]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#171018] mb-4 text-center">Lặp lại</h3>
            <div className="flex flex-col gap-1">
              {repeatSheetOptions.map(o => (
                <button 
                  key={o.value} 
                  type="button"
                  onClick={() => { setDraft({ ...draft, repeatRule: o.value }); setRepeatSheetOpen(false); }}
                  className={`flex items-center justify-between p-3 rounded-xl ${draft.repeatRule === o.value ? "bg-[#F8E7EC] text-[#800020] font-bold" : "text-[#171018] hover:bg-[#F8F5F2]"}`}
                >
                  <span className="text-[15px]">{o.label}</span>
                  {draft.repeatRule === o.value && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reminderSheetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40" onMouseDown={() => setReminderSheetOpen(false)}>
          <div onMouseDown={e => e.stopPropagation()} className="bg-[#FFFFFF] rounded-t-2xl pb-8 pt-4 px-4 flex flex-col animate-in slide-in-from-bottom-10">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1.5 rounded-full bg-[#E8DCD5]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#171018] mb-4 text-center">Thông báo</h3>
            <div className="flex flex-col gap-1">
              {reminderSheetOptions.map(o => (
                <button 
                  key={o.value} 
                  type="button"
                  onClick={() => { setDraft({ ...draft, reminderMinutes: o.value }); setReminderSheetOpen(false); }}
                  className={`flex items-center justify-between p-3 rounded-xl ${draft.reminderMinutes === o.value ? "bg-[#F8E7EC] text-[#800020] font-bold" : "text-[#171018] hover:bg-[#F8F5F2]"}`}
                >
                  <span className="text-[15px]">{o.label}</span>
                  {draft.reminderMinutes === o.value && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventDetailInline({ item, calendars, members, edit, remove, markDone, close }: { item: CalendarEvent; calendars: Calendar[]; members: Member[]; edit: () => void; remove: () => void; markDone: () => void; close: () => void }) {
  const calendar = calendars.find(calendar => calendar.id === item.calendarId);
  const tone = eventTone(item.type);
  const isFixed = item.calendarId === "fixed-birthday" || item.calendarId === "fixed-holiday";

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 relative w-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 shrink-0">
        <button type="button" onClick={close} className="p-1 text-slate-400 hover:text-slate-800"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <span className="font-bold text-[13px] uppercase tracking-wider text-slate-600 dark:text-slate-400">Event Details</span>
        {!isFixed ? (
           <button type="button" onClick={edit} className="p-1 text-indigo-600 font-bold hover:bg-indigo-50 dark:hover:bg-white/5 rounded"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
        ) : <div className="size-7" />}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
         <div className="bg-white dark:bg-slate-900 px-5 py-6 mb-2 shadow-sm border-b border-slate-200 dark:border-white/10">
            <h2 className={`text-2xl font-bold mb-2 ${item.status === "done" ? "text-slate-400 line-through" : "text-slate-800 dark:text-white"}`}>{item.title}</h2>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4">
               <span>{formatDateVN(item.startDate)} {item.allDay ? "" : item.startTime}</span>
               {item.endDate && item.endDate !== item.startDate && (
                  <>
                    <span>→</span>
                    <span>{formatDateVN(item.endDate)} {item.endTime}</span>
                  </>
               )}
            </div>
            <div className="flex items-center gap-2">
               <div className={`size-3 rounded-full ${tone.dot}`} />
               <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{calendar?.name || eventTypeMeta(item.type).label}</span>
            </div>
         </div>

         <div className="bg-white dark:bg-slate-900 mb-2 shadow-sm border-y border-slate-200 dark:border-white/5 px-2">
            {item.location && <Row label="Location" value={item.location} />}
            {item.reminderMinutes > 0 && <Row label="Remind" value={reminderOptions.find(option => option.value === item.reminderMinutes)?.label} />}
            {item.repeatRule !== "none" && <Row label="Repeat" value={repeatOptions.find(option => option.value === item.repeatRule)?.label} />}
            {item.memberIds?.length > 0 && <Row label="Members" value={`${item.memberIds.length} người`} />}
         </div>

         {item.note && (
            <div className="bg-white dark:bg-slate-900 mb-2 shadow-sm border-y border-slate-200 dark:border-white/5 p-4">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Note</h4>
               <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{item.note}</p>
            </div>
         )}
      </div>

      {!isFixed && (
         <div className="flex items-center border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 shrink-0 gap-3">
            <button onClick={markDone} className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 py-2.5 rounded text-sm font-bold text-slate-700 dark:text-slate-300">
               {item.status === "done" ? "Mở lại" : "Hoàn thành"}
            </button>
            <button onClick={remove} className="flex-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 py-2.5 rounded text-sm font-bold text-rose-600">
               Xóa sự kiện
            </button>
         </div>
      )}
    </div>
  );
}

function EventEditorSheet({ draft, calendars, customLists, members, user, setDraft, save, remove }: { draft: EventDraft; calendars: Calendar[]; customLists?: CustomList[]; members: Member[]; user?: Actor; setDraft: (draft: EventDraft | null) => void; save: (event: React.FormEvent) => void; remove?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      <EventEditorInline draft={draft} calendars={calendars} customLists={customLists} members={members} user={user} setDraft={setDraft} save={save} close={() => setDraft(null)} remove={remove ? () => { remove(); setDraft(null); } : undefined} />
    </div>
  );
}

function EventDetailSheet({ item, calendars, members, close, edit, remove, markDone }: { item: CalendarEvent; calendars: Calendar[]; members: Member[]; close: () => void; edit: () => void; remove: () => void; markDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      <EventDetailInline item={item} calendars={calendars} members={members} close={close} edit={edit} remove={remove} markDone={markDone} />
    </div>
  );
}

function DayEventsSheet({ date, events, members, close, add, open, edit, remove, openMenuId, setOpenMenuId }: { date: string; events: CalendarEvent[]; members: Member[]; close: () => void; add: () => void; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45" onMouseDown={close}>
      <div onMouseDown={e => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{formatDateVN(date)}</h3>
          <button type="button" onClick={close} className="grid size-8 place-items-center rounded-full bg-slate-100 font-bold text-slate-500">×</button>
        </div>
        <button type="button" onClick={add} className="mb-4 h-10 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700">+ Tạo sự kiện</button>
        <AgendaView events={events} members={members} open={open} edit={edit} remove={remove} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} emptyText="Trống" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="mb-2"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div>;
}

function Row({ label, value, onClick, right }: { label: string; value?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 last:border-0 ${onClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]" : ""}`} onClick={onClick}>
       <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
       <div className="flex items-center gap-2 text-sm text-slate-500">
          {value && <span className="truncate max-w-[150px] text-right">{value}</span>}
          {right}
          {onClick && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
       </div>
    </div>
  );
}
function MobileCalendarView({
  mobileTab, setMobileTab, anchor, setAnchor, selectedDate, pickDate, events, visibleEvents, selectedEvents, agendaEvents, calendars, members, enabledTypes, setEnabledTypes, openEventDetail, openNewEvent, showLunar, user,
  customLists, saveCustomLists, hiddenLists, toggleListVisibility, setEvents, goToday, openMenuId, setOpenMenuId, setDaySheetDate, setDetail, setDraft, t
}: any) {
  const [todos, setTodos] = useState<any[]>([]);
  const [todoFilter, setTodoFilter] = useState("Ngày chọn");
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const key = `familyHubTodos:${user?.id || user?.memberId || "guest"}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          setTodos(JSON.parse(saved));
        }
      } catch(e) {}
    }
  }, [user]);

  const saveTodos = (newTodos: any[]) => {
    setTodos(newTodos);
    if (typeof window !== "undefined") {
      try {
        const key = `familyHubTodos:${user?.id || user?.memberId || "guest"}`;
        localStorage.setItem(key, JSON.stringify(newTodos));
      } catch(e) {}
    }
  };

  const getLunarSafe = (dIso: string) => {
    try {
      if (typeof getLunarText !== "undefined") return getLunarText(dIso);
    } catch(e) {}
    return { text: "", important: false };
  };

  const tabs = [
    { id: "month", label: "Tháng", icon: <svg viewBox="0 0 24 24" className="size-[18px] stroke-current stroke-2 fill-none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: "day", label: "Chi tiết ngày", icon: <svg viewBox="0 0 24 24" className="size-[18px] stroke-current stroke-2 fill-none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><rect x="8" y="14" width="8" height="4" rx="1"/></svg> },
    { id: "todo", label: "To-do list", icon: <svg viewBox="0 0 24 24" className="size-[18px] stroke-current stroke-2 fill-none"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> }
  ];

  const now = new Date();
  const todayIso = iso(now);

  const todoEvents = todos.map(t => ({
    ...t,
    startDate: t.date,
    endDate: t.date,
    type: "todo",
    allDay: !t.startTime && !t.endTime,
    calendarId: "todo",
    color: t.status === "done" ? "#059669" : t.status === "overdue" ? "#E11D48" : "#800020"
  }));

  const allVisibleEvents = [...visibleEvents, ...todoEvents];
  const selectedDayEvents = [...selectedEvents, ...todoEvents.filter(t => t.startDate === selectedDate)];

  const handleToggleTodoDone = (e: any, todoId: string) => {
    e.stopPropagation();
    const next = todos.map(t => {
      if (t.id === todoId) {
        return { ...t, status: t.status === "done" ? "pending" : "done" };
      }
      return t;
    });
    saveTodos(next);
  };

  const handleMobileFabClick = () => {
    if (mobileTab === "todo") {
      setIsAddingTodo(true);
      return;
    }
    openNewEvent();
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F5F2]">
      <div className="flex items-center justify-between bg-[#FFFFFF] border-b border-[#E8DCD5] sticky top-0 z-10">
        {tabs.map(tab => {
          const isActive = mobileTab === tab.id;
          return (
            <button 
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1 transition-all relative ${isActive ? "text-[#800020]" : "text-[#6B5E64]"}`}
            >
              <div className={`flex flex-col items-center justify-center h-[34px] ${isActive ? "mt-0" : "mt-1"}`}>
                <div className="flex items-center justify-center h-[20px]">{tab.icon}</div>
                {isActive && <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>}
              </div>
              {isActive && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#D4AF37] rounded-t" />}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {mobileTab === "month" && (
          <div className="flex flex-col flex-1 min-h-0 bg-[#F8F5F2]">
            <div className="flex flex-col flex-1 min-h-0 bg-[#FFFFFF]">
              <div className="flex items-center px-3 py-1.5 bg-[#F8F5F2] border-b border-[#E8DCD5] h-10">
                <h2 className="text-sm font-bold text-[#171018] flex-1 flex items-center gap-2">
                  Tháng {anchor.getMonth() + 1} {anchor.getFullYear()}
                  <button onClick={goToday} className="flex size-5 items-center justify-center rounded-full bg-[#F8E7EC] text-[#800020] border border-[#E8DCD5] active:scale-95" title="Hôm nay">
                    <svg viewBox="0 0 24 24" className="size-3 stroke-current stroke-2 fill-none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="12" cy="15" r="1" /></svg>
                  </button>
                </h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="p-1.5 text-[#800020] active:scale-95 bg-[#FFFFFF] rounded-lg border border-[#E8DCD5]">
                    <svg viewBox="0 0 24 24" className="size-3.5 stroke-current stroke-2 fill-none"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="p-1.5 text-[#800020] active:scale-95 bg-[#FFFFFF] rounded-lg border border-[#E8DCD5]">
                    <svg viewBox="0 0 24 24" className="size-3.5 stroke-current stroke-2 fill-none"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-[#E8DCD5] shrink-0 bg-[#FFFFFF]">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day, i) => (
                  <div key={day} className={`text-center text-[9px] py-1 font-bold uppercase tracking-wider ${i === 0 ? "text-[#E11D48]" : "text-[#6B5E64]"}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 bg-[#FFFFFF]">
                {monthCells(anchor).map((date, index) => {
                  const dateIso = iso(date);
                  const isSelected = selectedDate === dateIso;
                  const isToday = todayIso === dateIso;
                  const dayEvents = allVisibleEvents.filter((e: any) => e.startDate === dateIso).sort((a: any, b: any) => a.title.localeCompare(b.title));
                  const isCurrentMonth = date.getMonth() === anchor.getMonth();
                  const isSunday = date.getDay() === 0;
                  const isLastCol = index % 7 === 6;
                  const lunarInfo = getLunarSafe(dateIso);
                  
                  return (
                    <div 
                      key={dateIso} 
                      onClick={() => { pickDate(dateIso); setMobileTab("day"); }}
                      className={`flex flex-col border-b border-[#E8DCD5] overflow-hidden cursor-pointer ${!isLastCol ? "border-r" : ""} ${!isCurrentMonth ? "bg-[#F8F5F2]" : "bg-[#FFFFFF]"} ${isSelected ? "!bg-[#FFF7F9] border border-[#800020]" : ""}`}
                    >
                      <div className="flex items-center justify-between px-0.5 pt-0.5">
                        <span className={[`text-[11px] font-semibold flex items-center justify-center size-[24px] rounded-full`,
                          isSelected ? "bg-[#800020] text-white" : isToday ? "border border-[#D4AF37] text-[#800020]" : isSunday ? "text-[#E11D48]" : "text-[#171018]"
                        ].join(" ")}>
                          {date.getDate()}
                        </span>
                        {lunarInfo.text && (
                          <span className={`text-[8px] -mt-0.5 leading-none ${lunarInfo.important ? "text-[#E11D48] font-bold" : "text-[#6B5E64]"}`}>{lunarInfo.text}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-[1px] mt-[1px] px-[1px] w-full">
                        {dayEvents.slice(0, 3).map((e: any, i: number) => (
                          <div key={i} className="h-3 px-1 rounded-[2px] border border-[#E8DCD5] text-[8px] font-bold truncate leading-snug flex items-center" style={{ backgroundColor: e.color === "#E11D48" ? "#FFF1F2" : e.color === "#D4AF37" ? "#FFFBEB" : "#F8E7EC", color: e.color === "#E11D48" ? "#E11D48" : e.color === "#D4AF37" ? "#8A6A00" : "#800020" }}>
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <span className="text-[8px] font-medium px-1 text-left text-[#6B5E64]">+{dayEvents.length - 3}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {mobileTab === "day" && (
          <div className="flex flex-col flex-1 min-h-0 bg-[#F8F5F2]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#FFFFFF] border-b border-[#E8DCD5] h-[52px] shrink-0">
              <h2 className="text-sm font-bold text-[#171018] flex items-center gap-2">
                {formatDateVN(selectedDate)}
                <button onClick={goToday} className="flex size-6 items-center justify-center rounded-full bg-[#F8E7EC] text-[#800020] border border-[#E8DCD5] active:scale-95" title="Hôm nay">
                  <svg viewBox="0 0 24 24" className="size-3.5 stroke-current stroke-2 fill-none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><circle cx="12" cy="15" r="1" /></svg>
                </button>
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); pickDate(iso(d)); }} className="p-2 text-[#800020] active:scale-95 bg-[#FFFFFF] rounded-lg border border-[#E8DCD5]">
                  <svg viewBox="0 0 24 24" className="size-4 stroke-current stroke-2 fill-none"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); pickDate(iso(d)); }} className="p-2 text-[#800020] active:scale-95 bg-[#FFFFFF] rounded-lg border border-[#E8DCD5]">
                  <svg viewBox="0 0 24 24" className="size-4 stroke-current stroke-2 fill-none"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
               {selectedDayEvents.length > 0 ? selectedDayEvents.map((e: any) => {
                 const isTodo = e.type === "todo";
                 const evColor = e.color || eventTypeMeta(e.type)?.color || "#800020";
                 const evMemberIds: string[] = isTodo ? (e.assignedMemberIds || []) : (e.memberIds || e.assignedMemberIds || e.relatedMemberIds || e.participants || e.assignees || []);
                 const evMembers: Member[] = evMemberIds.map((id: string) => members.find((m: Member) => m.id === id)).filter(Boolean) as Member[];
                 let calLabel = isTodo ? "To-do" : (e.calendarId === "fixed-birthday" || e.calendarId === "birthday"
                   ? "Sinh nhật"
                   : e.calendarId === "fixed-holiday" || e.calendarId === "holiday"
                   ? "Ngày lễ"
                   : calendars.find((c: any) => c.id === e.calendarId)?.name || eventTypeMeta(e.type)?.label || "Sự kiện");
                 if (calLabel === "Khác") {
                   const r = e.reminderMinutes ?? e.reminder;
                   const rep = e.repeatRule ?? e.repeat;
                   if (r === 0 || r > 0) {
                     calLabel = r === 0 ? "Nhắc đúng giờ" : r === 60 ? "Nhắc trước 1 giờ" : r === 1440 ? "Nhắc trước 1 ngày" : `Nhắc trước ${r} phút`;
                   } else if (rep && rep !== "none") {
                     calLabel = rep === "weekly" ? "Lặp hàng tuần" : rep === "monthly" ? "Lặp hàng tháng" : rep === "yearly" ? "Lặp hàng năm" : "Lặp lại";
                   } else {
                     calLabel = "Sự kiện";
                   }
                 }
                 const timeLabel = e.allDay
                   ? "Cả ngày"
                   : e.startTime && e.endTime
                   ? `${e.startTime} – ${e.endTime}`
                   : e.startTime || "";
                 const note = e.note || e.description || "";
                 return (
                   <div key={e.id} onClick={() => isTodo ? setEditingTodo(todos.find(t => t.id === e.id)) : openEventDetail(e)} className="bg-[#FFFFFF] rounded-xl shadow-[0_4px_12px_rgba(128,0,32,0.04)] border border-[#E8DCD5] relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer">
                     <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: evColor }} />
                     <div className="pl-4 pr-3 py-3 flex gap-2">
                       <div className="flex-1 min-w-0">
                         <p className="text-[14px] font-bold text-[#171018] leading-snug mb-1">{e.title}</p>
                         <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                           {timeLabel && <span className="text-[11px] text-[#6B5E64] font-medium">{timeLabel}</span>}
                           {timeLabel && <span className="text-[#6B5E64]">•</span>}
                           <span className="text-[11px] text-[#6B5E64] font-medium">{calLabel}</span>
                           {isTodo && e.status === "done" && (
                             <span className="text-[10px] bg-[#059669] text-white rounded-full px-1.5 py-0.5 font-semibold shrink-0">Hoàn thành</span>
                           )}
                           {isTodo && e.status === "overdue" && (
                             <span className="text-[10px] bg-[#E11D48] text-white rounded-full px-1.5 py-0.5 font-semibold shrink-0">Quá hạn</span>
                           )}
                         </div>
                         {evMembers.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-1.5">
                             {evMembers.map((m: Member) => (
                               <span key={m.id} className="inline-flex items-center gap-1 text-[10px] bg-[#F8F5F2] text-[#800020] border border-[#E8DCD5] rounded-full px-1.5 py-0.5 font-semibold">
                                 {m.nickname || m.name}
                               </span>
                             ))}
                           </div>
                         )}
                         {note && (
                           <p className="text-[11px] text-[#6B5E64] line-clamp-2 mt-1.5">{note}</p>
                         )}
                       </div>
                       {isTodo && (
                         <div className="shrink-0 flex items-center justify-center px-1">
                           <button onClick={(ev) => handleToggleTodoDone(ev, e.id)} className={`size-6 rounded border flex items-center justify-center ${e.status === 'done' ? 'bg-[#059669] border-[#059669]' : 'bg-[#F8F5F2] border-[#E8DCD5]'}`}>
                             {e.status === "done" && <svg viewBox="0 0 24 24" className="size-4 stroke-white stroke-2 fill-none"><polyline points="20 6 9 17 4 12"/></svg>}
                           </button>
                         </div>
                       )}
                     </div>
                   </div>
                 );
               }) : (
                 <div className="py-12 flex flex-col items-center justify-center text-[#6B5E64]">
                    <svg viewBox="0 0 24 24" className="size-12 stroke-current stroke-[1.5] fill-none mb-4 opacity-20"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <p className="text-sm font-medium">Chưa có lịch trong ngày này</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {mobileTab === "todo" && (
          <div className="flex flex-col flex-1 min-h-0 bg-[#F8F5F2]">
            <div className="flex px-4 py-3 gap-2 overflow-x-auto bg-[#FFFFFF] border-b border-[#E8DCD5] shrink-0 no-scrollbar">
              {["Ngày chọn", "Sắp tới", "Quá hạn", "Hoàn thành"].map(f => (
                <button 
                  key={f} 
                  onClick={() => setTodoFilter(f)} 
                  className={`px-3 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${todoFilter === f ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64] border border-[#E8DCD5]"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
              {(() => {
                const nowIso = iso(now);
                let filtered = todos.filter(t => {
                  if (t.status === "done") return todoFilter === "Hoàn thành";
                  if (todoFilter === "Hoàn thành") return false;
                  
                  const isOverdue = t.status === "overdue" || (t.date < nowIso) || (t.date === nowIso && t.endTime && t.endTime < now.toTimeString().slice(0,5));
                  
                  if (todoFilter === "Quá hạn") return isOverdue;
                  if (todoFilter === "Ngày chọn") return t.date === selectedDate;
                  if (todoFilter === "Sắp tới") return t.date > nowIso && !isOverdue;
                  return false;
                });
                
                filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center justify-center text-[#6B5E64]">
                      <svg viewBox="0 0 24 24" className="size-12 stroke-current stroke-[1.5] fill-none mb-4 opacity-20"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      <p className="text-sm font-medium">Không có to-do nào.</p>
                    </div>
                  );
                }

                return filtered.map(t => {
                  const evMemberIds: string[] = t.assignedMemberIds || [];
                  const evMembers: Member[] = evMemberIds.map((id: string) => members.find((m: Member) => m.id === id)).filter(Boolean) as Member[];
                  const timeLabel = t.startTime && t.endTime ? `${t.startTime} - ${t.endTime}` : t.startTime || "";
                  const doneCount = (t.checklist || []).filter((c:any) => c.done).length;
                  const totalCount = (t.checklist || []).length;
                  
                  return (
                    <div key={t.id} onClick={() => setEditingTodo(t)} className="bg-[#FFFFFF] rounded-xl shadow-[0_4px_12px_rgba(128,0,32,0.04)] border border-[#E8DCD5] p-3 flex gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-[14px] font-bold leading-snug ${t.status === 'done' ? 'text-[#6B5E64] line-through' : 'text-[#171018]'}`}>{t.title}</p>
                          {t.priority === "high" && <span className="shrink-0 text-[10px] bg-[#D4AF37] text-white rounded-full px-1.5 py-0.5 font-bold">Quan trọng</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-[#6B5E64] font-medium">{formatDateVN(t.date)}</span>
                          {timeLabel && <span className="text-[#6B5E64]">•</span>}
                          {timeLabel && <span className="text-[11px] text-[#6B5E64] font-medium">{timeLabel}</span>}
                          {totalCount > 0 && <span className="text-[#6B5E64]">•</span>}
                          {totalCount > 0 && <span className="text-[11px] text-[#6B5E64] font-medium">{doneCount}/{totalCount}</span>}
                        </div>
                        {evMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {evMembers.map((m: Member) => (
                              <span key={m.id} className="inline-flex items-center gap-1 text-[10px] bg-[#F8F5F2] text-[#800020] border border-[#E8DCD5] rounded-full px-1.5 py-0.5 font-semibold">
                                {m.nickname || m.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center justify-center">
                        <button onClick={(ev) => handleToggleTodoDone(ev, t.id)} className={`size-8 rounded-full border flex items-center justify-center transition-colors ${t.status === 'done' ? 'bg-[#059669] border-[#059669]' : 'bg-[#F8F5F2] border-[#E8DCD5]'}`}>
                          {t.status === "done" && <svg viewBox="0 0 24 24" className="size-5 stroke-white stroke-2 fill-none"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleMobileFabClick}
        className="fixed bottom-[calc(96px+env(safe-area-inset-bottom,0px))] right-[18px] z-40 flex size-11 items-center justify-center rounded-full bg-[#800020] text-white shadow-[0_8px_18px_rgba(128,0,32,0.24)] transition-transform active:scale-95"
        aria-label={mobileTab === "todo" ? "Thêm to-do" : "Thêm sự kiện"}
      >
        <svg viewBox="0 0 24 24" className="size-5 stroke-current stroke-2 fill-none"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
      </button>

      {(isAddingTodo || editingTodo) && (
        <TodoEditorSheet 
          todo={editingTodo}
          selectedDate={selectedDate}
          close={() => { setIsAddingTodo(false); setEditingTodo(null); }}
          todos={todos}
          saveTodos={saveTodos}
          members={members}
        />
      )}
    </div>
  );
}

function TodoEditorSheet({ todo, selectedDate, close, todos, saveTodos, members }: any) {
  const [form, setForm] = useState({
    title: todo?.title || "",
    description: todo?.description || "",
    date: todo?.date || selectedDate || new Date().toISOString().slice(0,10),
    startTime: todo?.startTime || "",
    endTime: todo?.endTime || "",
    assignedMemberIds: todo?.assignedMemberIds || [],
    checklist: todo?.checklist || [],
    priority: todo?.priority || "normal",
    status: todo?.status || "pending"
  });
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!form.title.trim()) {
      setError("Tên việc không được để trống");
      return;
    }
    if (form.startTime && form.endTime && form.endTime < form.startTime) {
      setError("Giờ kết thúc không được nhỏ hơn giờ bắt đầu");
      return;
    }

    const payload = {
      ...form,
      id: todo?.id || "todo-" + Date.now(),
      createdAt: todo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let next;
    if (todo) {
      next = todos.map((t: any) => t.id === todo.id ? payload : t);
    } else {
      next = [...todos, payload];
    }
    saveTodos(next);
    close();
  };

  const remove = () => {
    if (window.confirm("Bạn có chắc muốn xóa to-do này?")) {
      saveTodos(todos.filter((t: any) => t.id !== todo.id));
      close();
    }
  };

  const inputClass = "w-full h-12 rounded-xl border border-[#E8DCD5] bg-[#FFFFFF] px-4 text-[14px] text-[#171018] outline-none focus:border-[#800020] transition-colors";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F8F5F2] animate-in slide-in-from-bottom-full duration-300">
      <div className="flex items-center justify-between px-4 py-3 bg-[#FFFFFF] border-b border-[#E8DCD5] shrink-0">
        <button onClick={close} className="text-[#6B5E64] font-medium text-sm px-2 py-1">Hủy</button>
        <h3 className="text-[15px] font-bold text-[#171018]">{todo ? "Sửa To-do" : "Thêm To-do"}</h3>
        <button onClick={handleSave} className="text-[#800020] font-bold text-sm px-2 py-1">Lưu</button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-[calc(104px+env(safe-area-inset-bottom))]">
        {error && <p className="text-[13px] text-[#E11D48] font-medium">{error}</p>}
        
        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Tên việc *</label>
          <input autoFocus value={form.title} onChange={e => {setForm({...form, title: e.target.value}); setError("");}} placeholder="Ví dụ: Mua đồ siêu thị" className={inputClass} />
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Ngày *</label>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Giờ bắt đầu</label>
            <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Giờ kết thúc</label>
            <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Mức độ</label>
          <div className="flex gap-2">
            {[ { id: "low", label: "Thấp" }, { id: "normal", label: "Bình thường" }, { id: "high", label: "Cao" } ].map(p => (
              <button 
                key={p.id} 
                onClick={() => setForm({...form, priority: p.id})} 
                className={`flex-1 h-10 rounded-xl text-[13px] font-bold transition-all border ${form.priority === p.id ? "bg-[#800020] text-white border-[#800020]" : "bg-[#FFFFFF] text-[#6B5E64] border-[#E8DCD5]"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Thành viên phụ trách</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m: any) => {
              const isSel = form.assignedMemberIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (isSel) setForm({...form, assignedMemberIds: form.assignedMemberIds.filter((id: string) => id !== m.id)});
                    else setForm({...form, assignedMemberIds: [...form.assignedMemberIds, m.id]});
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold border transition-all ${isSel ? "bg-[#800020] text-white border-[#800020]" : "bg-[#FFFFFF] text-[#6B5E64] border-[#E8DCD5]"}`}
                >
                  {m.nickname || m.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Checklist</label>
          <div className="space-y-2">
            {form.checklist.map((item: any, idx: number) => (
              <div key={item.id} className="flex gap-2 items-center">
                <button onClick={() => {
                  const cl = [...form.checklist];
                  cl[idx].done = !cl[idx].done;
                  setForm({...form, checklist: cl});
                }} className={`size-6 rounded border flex items-center justify-center shrink-0 ${item.done ? 'bg-[#059669] border-[#059669]' : 'bg-[#FFFFFF] border-[#E8DCD5]'}`}>
                  {item.done && <svg viewBox="0 0 24 24" className="size-4 stroke-white stroke-2 fill-none"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                <input 
                  value={item.title} 
                  onChange={e => {
                    const cl = [...form.checklist];
                    cl[idx].title = e.target.value;
                    setForm({...form, checklist: cl});
                  }} 
                  className={`flex-1 h-10 rounded-lg border border-[#E8DCD5] bg-[#FFFFFF] px-3 text-[13px] outline-none focus:border-[#800020] ${item.done ? 'line-through text-[#6B5E64]' : 'text-[#171018]'}`} 
                  placeholder="Tên việc con..." 
                />
                <button onClick={() => {
                  const cl = [...form.checklist];
                  cl.splice(idx, 1);
                  setForm({...form, checklist: cl});
                }} className="p-2 text-[#E11D48]">
                  <svg viewBox="0 0 24 24" className="size-4 stroke-current stroke-2 fill-none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
            <button onClick={() => setForm({...form, checklist: [...form.checklist, { id: Date.now().toString(), title: "", done: false }]})} className="text-[13px] font-bold text-[#800020] px-1 mt-1">+ Thêm việc con</button>
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-[#6B5E64] mb-1.5">Ghi chú</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-24 rounded-xl border border-[#E8DCD5] bg-[#FFFFFF] p-3 text-[14px] text-[#171018] outline-none focus:border-[#800020] transition-colors resize-none" placeholder="Ghi chú chi tiết..." />
        </div>

        {todo && (
          <div className="pt-4">
            <button onClick={remove} className="w-full h-12 rounded-xl bg-[#F8E7EC] text-[#E11D48] font-bold text-[14px]">
              Xóa To-do này
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
