"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Member } from "@/types";

import { Solar } from "lunar-javascript";

type Actor = { id: string; role: "full_access" | "self_only"; displayName?: string; avatar?: string; memberId?: string };
type Calendar = { id: string; name: string; color: string; visible: boolean; type: string; ownerUserId: string; viewerUserIds: string[] };
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
  const solar = Solar.fromYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  const lunar = solar.getLunar();
  const lDay = lunar.getDay();
  const lMonth = lunar.getMonth();
  const important = lDay === 1 || lDay === 15;
  return { text: lDay === 1 ? `${lDay}/${lMonth}` : `${lDay}`, important };
}
function addDays(value: string, days: number) {
  const date = localDate(value) || new Date();
  date.setDate(date.getDate() + days);
  return iso(date);
}
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

export function TimeTreeCalendar({ members, user }: { members: Member[]; user?: Actor }) {
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [view, setView] = useState<CalendarView>("monthly");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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
  }, []);

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

  const allEvents = useMemo(() => [...events, ...fixedEvents], [events, fixedEvents]);

  const visibleEvents = useMemo(() => allEvents.filter(item => {
    if (item.calendarId !== "fixed-birthday" && item.calendarId !== "fixed-holiday") {
      if (enabled.length && !enabled.includes(item.calendarId)) return false;
    }
    if (enabledTypes.length && !enabledTypes.includes(item.type)) return false;
    return true;
  }), [enabled, enabledTypes, allEvents]);
  
  const selectedEvents = useMemo(() => visibleEvents.filter(item => item.startDate === selectedDate).sort(sortEvents), [selectedDate, visibleEvents]);
  const agendaEvents = useMemo(() => visibleEvents.filter(item => item.startDate >= iso(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) && item.startDate <= iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))).sort(sortEvents), [anchor, visibleEvents]);

  const load = useCallback(async () => {
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
    setCalendars(nextCalendars);
    setEvents(eventResult?.data || []);
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
  function openNewEvent(date = selectedDate) {
    const calendarId = enabled[0] || calendars[0]?.id;
    if (!calendarId) {
      setError("Chưa có lịch để thêm sự kiện.");
      return;
    }
    setDetail(null);
    setDaySheetDate(null);
    setDraft(draftFor(date, calendarId, user));
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
  async function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const id = draft.id || crypto.randomUUID();
    const response = await fetch("/api/events", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, id })
    });
    const result = await readJson<{ ok: boolean; data?: { id: string }; error?: string }>(response);
    if (!response.ok || !result?.ok) {
      setError(result?.error || "Không thể lưu sự kiện.");
      return;
    }
    setDraft(null);
    await load();
    setSelectedDate(draft.startDate);
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
    await load();
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
    await load();
  }

  const gridLayoutClass = (leftCollapsed && rightCollapsed) ? "xl:grid-cols-[60px_minmax(0,1fr)_56px]" :
                          (leftCollapsed && !rightCollapsed) ? "xl:grid-cols-[60px_minmax(0,1fr)_300px] 2xl:grid-cols-[60px_minmax(0,1fr)_320px]" :
                          (!leftCollapsed && rightCollapsed) ? "xl:grid-cols-[240px_minmax(0,1fr)_56px]" :
                          "xl:grid-cols-[240px_minmax(0,1fr)_300px] 2xl:grid-cols-[240px_minmax(0,1fr)_320px]";

  return (
    <section className="relative mx-auto min-h-[calc(100vh-80px)] max-w-[1800px] bg-slate-50 p-2 pb-24 dark:bg-slate-950 md:p-4 lg:p-5">
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 overflow-hidden">
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
        density={density}
        toggleDensity={toggleDensity}
      />
      {error && <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

      <div className={`grid transition-all duration-300 divide-x divide-slate-200 dark:divide-white/10 gap-px bg-slate-200 dark:bg-white/10 ${gridLayoutClass}`}>
        <aside className={`hidden h-fit xl:block transition-all duration-300 overflow-hidden bg-slate-50 dark:bg-white/[0.02] ${leftCollapsed ? "px-2 py-2" : "p-4"}`}>
          <FilterContent calendars={calendars} events={allEvents} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} collapsed={leftCollapsed} toggle={toggleLeft} />
        </aside>

        {filterOpenMobile && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/45 xl:hidden" onMouseDown={() => setFilterOpenMobile(false)}>
            <div onMouseDown={e => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl">
               <div className="mb-4 flex items-center justify-between">
                 <h3 className="text-lg font-bold">Lịch hiển thị</h3>
                 <button type="button" onClick={() => setFilterOpenMobile(false)} className="flex size-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500">×</button>
               </div>
               <FilterContent calendars={calendars} events={allEvents} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} collapsed={false} />
            </div>
          </div>
        )}

        <div className="min-w-0 bg-white dark:bg-slate-900">
          {view === "monthly" && (
            <div className="h-full flex flex-col">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                {weekdays.map(day => <b key={day} className="py-3 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{day}</b>)}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-white/10 flex-1">
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
                      add={() => openDaySheet(dateIso)}
                      open={openEventDetail}
                      showLunar={showLunar}
                      density={density}
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
            <AgendaView
              events={agendaEvents}
              members={members}
              open={openEventDetail}
              edit={openEditEvent}
              remove={deleteEvent}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          )}
        </div>

        {view !== "agenda" && (
          <aside className="hidden xl:flex flex-col transition-all duration-300 w-full bg-slate-50 dark:bg-white/[0.02]">
            {rightCollapsed ? (
              <div className="flex h-full flex-col overflow-hidden">
                <button type="button" onClick={toggleRight} className="flex h-12 w-full items-center justify-center bg-transparent text-slate-400 hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-white/10" title="Mở rộng Agenda">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line><path d="m10 15-3-3 3-3"></path></svg>
                </button>
                <div className="flex-1 flex justify-center pt-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>Agenda</span>
                </div>
              </div>
            ) : (
              <div className="relative flex h-full flex-col p-4">
                <button type="button" onClick={toggleRight} className="absolute right-3 top-4 z-10 text-slate-400 hover:text-indigo-600" title="Thu gọn Agenda">
                  <span className="text-lg font-bold">⇥</span>
                </button>
                <AgendaView
                  title={`${dayGroupTitle(selectedDate)}`}
                  date={selectedDate}
                  events={selectedEvents}
                  members={members}
                  open={openEventDetail}
                  edit={openEditEvent}
                  remove={deleteEvent}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  emptyText="Chưa có sự kiện trong ngày này."
                  addEmpty={() => openNewEvent(selectedDate)}
                />
                <button type="button" onClick={() => openNewEvent(selectedDate)} className="h-11 w-full rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600 hover:bg-indigo-100">+ Thêm sự kiện ngày này</button>
              </div>
            )}
          </aside>
        )}
      </div>

      <button type="button" onClick={() => openNewEvent(selectedDate)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-indigo-600 text-3xl font-semibold text-white shadow-xl transition hover:bg-indigo-700 md:hidden" aria-label="Thêm sự kiện">+</button>

      {daySheetDate && <DayEventsSheet date={daySheetDate} events={visibleEvents.filter(item => item.startDate === daySheetDate).sort(sortEvents)} members={members} close={() => setDaySheetDate(null)} add={() => openNewEvent(daySheetDate)} open={openEventDetail} edit={openEditEvent} remove={deleteEvent} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
      {draft && <EventEditor draft={draft} calendars={calendars} members={members} user={user} setDraft={setDraft} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />}
      {detail && <EventDetail item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />}
      </div>
    </section>
  );
}

function CalendarToolbar({ anchor, view, setView, today, prev, next, add, quickPickerOpen, setQuickPickerOpen, setAnchor, setSelectedDate, showLunar, toggleLunar, filterOpenMobile, setFilterOpenMobile, leftCollapsed, toggleLeft, rightCollapsed, toggleRight, density, toggleDensity }: {
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
  density?: "compact" | "comfortable";
  toggleDensity?: () => void;
}) {
  const [month, setMonth] = useState(anchor.getMonth() + 1);
  const [year, setYear] = useState(anchor.getFullYear());
  useEffect(() => { setMonth(anchor.getMonth() + 1); setYear(anchor.getFullYear()); }, [anchor]);
  function applyQuickPick() {
    const date = new Date(year, month - 1, 1);
    setAnchor(date);
    setSelectedDate(iso(date));
    setQuickPickerOpen(false);
  }
  return (
    <div className="border-b border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={today} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Hôm nay</button>
          <button type="button" onClick={prev} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5" aria-label="Tháng trước">‹</button>
          <button type="button" onClick={next} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5" aria-label="Tháng sau">›</button>
          <h2 className="min-w-[170px] text-xl font-black tracking-tight text-slate-900 md:text-3xl dark:text-white">{monthLabel(anchor)}</h2>
          <div className="relative">
            <button type="button" onClick={() => setQuickPickerOpen(!quickPickerOpen)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5">Chọn tháng/năm</button>
            {quickPickerOpen && (
              <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-xl">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tháng"><select className={input} value={month} onChange={event => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></Field>
                  <Field label="Năm"><input className={input} type="number" value={year} onChange={event => setYear(Number(event.target.value))} /></Field>
                </div>
                <button type="button" onClick={applyQuickPick} className="mt-3 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white">Áp dụng</button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 mr-2 border-r border-slate-200 pr-4 dark:border-white/10">
            {toggleLeft && (
              <button type="button" onClick={toggleLeft} className={`h-9 rounded-xl border px-3 text-xs font-bold shadow-sm transition ${leftCollapsed ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`} title="Ẩn/hiện bộ lọc">
                Bộ lọc
              </button>
            )}
            {toggleRight && (
              <button type="button" onClick={toggleRight} className={`h-9 rounded-xl border px-3 text-xs font-bold shadow-sm transition ${rightCollapsed ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`} title="Ẩn/hiện agenda">
                Agenda
              </button>
            )}
            {toggleDensity && (
              <button type="button" onClick={toggleDensity} className={`h-9 rounded-xl border px-3 text-xs font-bold shadow-sm transition ${density === "compact" ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5"}`} title="Chuyển chế độ Gọn/Đầy đủ">
                {density === "compact" ? "Gọn" : "Đầy đủ"}
              </button>
            )}
          </div>
          <label className={`mr-1 flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold shadow-sm transition ${showLunar ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"} dark:border-white/10 dark:bg-white/5 dark:text-slate-300`}>
             <input type="checkbox" checked={showLunar} onChange={toggleLunar} className="sr-only" />
             <span className={`relative h-6 w-10 rounded-full transition ${showLunar ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${showLunar ? "left-5" : "left-1"}`} /></span>
             Âm lịch
          </label>
          <button type="button" onClick={() => setFilterOpenMobile(!filterOpenMobile)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 xl:hidden">Lịch hiển thị</button>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner dark:border-white/10 dark:bg-white/5">
            {[
              ["monthly", "Tháng"],
              ["weekly", "Tuần"],
              ["agenda", "Danh sách"]
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setView(value as CalendarView)} className={`h-9 rounded-xl px-3 text-sm font-extrabold transition ${view === value ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-500 hover:bg-white dark:hover:bg-white/10"}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={add} className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-extrabold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700">+ Thêm sự kiện</button>
        </div>
      </div>
    </div>
  );
}

function DayCell({ date, anchor, selected, events, select, add, open, showLunar, density = "comfortable" }: { date: Date; anchor: Date; selected: boolean; events: CalendarEvent[]; select: () => void; add: () => void; open: (event: CalendarEvent) => void; showLunar?: boolean; density?: "compact" | "comfortable" }) {
  const dateIso = iso(date);
  const isToday = dateIso === todayIso();
  const inMonth = date.getMonth() === anchor.getMonth();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const visible = events.slice(0, density === "compact" ? 5 : 3);
  
  const lunarInfo = showLunar ? getLunarText(dateIso) : { text: "", important: false };
  const lunarText = lunarInfo.text;
  const isLunarImportant = lunarInfo.important;

  return (
    <button type="button" onClick={add} onFocus={select} className={`calendar-day-cell relative min-h-[124px] p-2 text-left outline-none transition-all md:min-h-[160px] md:p-3 2xl:min-h-[176px] ${!inMonth ? "bg-slate-50/80 text-slate-400 dark:bg-white/[0.02]" : isWeekend ? "bg-slate-50/70 dark:bg-white/[0.04]" : "bg-white dark:bg-white/[0.03]"} ${selected ? "selected-day z-10 bg-indigo-50/70 ring-2 ring-inset ring-indigo-500" : ""} ${isToday ? "bg-indigo-50/60 dark:bg-indigo-400/10" : ""} hover:z-10 hover:bg-indigo-50/50 hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.22)]`}>
      <div className="mb-1 flex h-6 w-full items-start justify-between">
        <div className="flex items-center gap-1">
          {isToday && <span className="size-1.5 shrink-0 rounded-full bg-indigo-600" />}
          <span className={`text-sm md:text-base font-bold leading-none ${isToday ? "text-indigo-600" : inMonth ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>{date.getDate()}</span>
        </div>
        {showLunar && (
           <span className={`text-[10px] ${isLunarImportant ? "font-extrabold text-rose-500" : "font-semibold text-slate-400"} ${isToday && !isLunarImportant ? "text-indigo-400" : ""}`}>{lunarText}</span>
        )}
      </div>
      <div className={`space-y-[2px] ${density === "compact" ? "md:space-y-[2px]" : "md:space-y-1"}`}>
        {visible.map(item => {
          const tone = eventTone(item.type);
          return (
            <span
              key={item.id}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); open(item); }}
              className={`group flex min-w-0 items-center justify-between gap-1.5 truncate rounded px-1 py-[2px] text-left text-[11px] font-semibold leading-tight transition-colors hover:bg-slate-100 dark:hover:bg-white/10 md:text-xs ${tone.text}`}
            >
              <div className="flex flex-1 min-w-0 items-center gap-1.5 truncate">
                {item.type === "birthday" ? <span className="shrink-0 text-[10px]">🎂</span> : item.type === "holiday" ? <span className="shrink-0 text-[10px]">🇻🇳</span> : <i className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />}
                <span className="truncate">{item.title}</span>
              </div>
              {!item.allDay && <span className="shrink-0 tabular-nums opacity-60 text-[10px] md:text-[11px]">{eventTimeLabel(item)}</span>}
            </span>
          );
        })}
        {events.length > visible.length && <span className="block px-1 py-[2px] text-left text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50">+ {events.length - visible.length} sự kiện</span>}
      </div>
    </button>
  );
}

function WeeklyView({ days, events, selectedDate, selectDate, add, open }: { days: Date[]; events: CalendarEvent[]; selectedDate: string; selectDate: (date: string) => void; add: (date: string) => void; open: (event: CalendarEvent) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-sm">
      <div className="grid grid-cols-7 border-b border-[var(--app-border)]">
        {days.map(date => {
          const dateIso = iso(date);
          return (
            <button key={dateIso} type="button" onClick={() => selectDate(dateIso)} className={`p-3 text-center ${selectedDate === dateIso ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200" : ""}`}>
              <b className="block text-xs text-slate-400">{weekdays[(date.getDay() + 6) % 7]}</b>
              <span className="mt-1 block text-lg font-bold">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="grid min-h-[420px] grid-cols-7">
        {days.map(date => {
          const dateIso = iso(date);
          const dayEvents = events.filter(item => item.startDate === dateIso).sort(sortEvents);
          return (
            <div key={dateIso} className="border-r border-[var(--app-border)] p-2 last:border-r-0">
              <button type="button" onClick={() => add(dateIso)} className="mb-2 h-9 w-full rounded-lg border border-dashed border-[var(--app-border)] text-xs font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-600">+ Thêm</button>
              <div className="space-y-2">
                {dayEvents.map(item => (
                  <button key={item.id} type="button" onClick={() => open(item)} className="w-full rounded-xl border border-[var(--app-border)] p-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="font-bold" style={{ color: eventColor(item) }}>{eventTimeLabel(item)}</span>
                    <b className="mt-1 block truncate">{item.title}</b>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ events, members, open, edit, remove, openMenuId, setOpenMenuId, title = "Danh sách sự kiện", date, emptyText = "Chưa có sự kiện trong tháng này.", addEmpty }: { events: CalendarEvent[]; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void; title?: string; date?: string; emptyText?: string; addEmpty?: () => void }) {
  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, item) => {
    acc[item.startDate] = [...(acc[item.startDate] || []), item];
    return acc;
  }, {});
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="rounded-xl bg-slate-50/80 p-3 dark:bg-white/5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-indigo-500">Agenda</p>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
        {date && <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateVN(date)} · Âm lịch {getLunarText(date).text}</p>}
      </div>
      <div className="mt-4 space-y-4">
        {Object.keys(groups).length ? Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => (
          <div key={date}>
            <h4 className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">{dayGroupTitle(date)}</h4>
            <div className="space-y-2">
              {items.sort(sortEvents).map(item => <AgendaItem key={item.id} item={item} members={members} open={open} edit={edit} remove={remove} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />)}
            </div>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5">
            <span className="mb-2 text-3xl">📅</span>
            <p className="text-sm font-bold text-slate-600">{emptyText}</p>
            {addEmpty && <button type="button" onClick={addEmpty} className="mt-4 h-10 rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700">+ Thêm sự kiện ngày này</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function AgendaItem({ item, members, open, edit, remove, openMenuId, setOpenMenuId }: { item: CalendarEvent; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const related = members.filter(member => item.relatedMemberIds?.includes(member.id) || item.memberIds.includes(member.id)).map(memberName).join(", ");
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
    <div className={`relative flex min-h-16 items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-white/5 ${tone.border}`}>
      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`grid h-10 w-14 shrink-0 place-items-center rounded-xl text-xs font-black tabular-nums ${tone.bg} ${tone.text}`}>{eventTimeLabel(item)}</span>
        <i className={`h-10 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <span className="min-w-0 flex-1">
          <b className={`block truncate text-sm font-extrabold ${item.status === "done" ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>
            {item.visibility === "private" && <span className="mr-1 inline-flex items-center justify-center rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500">🔒 Riêng tư</span>}
            {item.visibility === "custom" && <span className="mr-1 inline-flex items-center justify-center rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500">👁️ Tùy chọn</span>}
            {item.title}
          </b>
          <small className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-400"><span className={`rounded-full px-2 py-0.5 font-bold ${tone.bg} ${tone.text}`}>{meta.label}</span>{related && <span className="truncate">{related}</span>}{item.location && <span className="truncate">· {item.location}</span>}</small>
        </span>
      </button>
      <div ref={menuRef} className="relative shrink-0">
        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100/60 hover:text-slate-800">⋮</button>
        {openMenuId === item.id && (
          <div className="pointer-events-auto absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900">
            <button type="button" onClick={() => { setOpenMenuId(null); open(item); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5">Xem</button>
            {item.calendarId !== "fixed-birthday" && item.calendarId !== "fixed-holiday" && (
              <>
                <button type="button" onClick={() => { setOpenMenuId(null); edit(item); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5">Sửa</button>
                <button type="button" onClick={() => { setOpenMenuId(null); void remove(item); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-400/10">Xóa</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DayEventsSheet({ date, events, members, close, add, open, edit, remove, openMenuId, setOpenMenuId }: { date: string; events: CalendarEvent[]; members: Member[]; close: () => void; add: () => void; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 md:items-center md:justify-center md:p-6" onMouseDown={close}>
      <div onMouseDown={event => event.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-white/70 bg-white p-4 shadow-2xl md:max-w-2xl md:rounded-2xl">
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">Sự kiện ngày này</p>
            <h3 className="mt-1 text-xl font-bold">{dayGroupTitle(date)} · {formatDateVN(date)}</h3>
            <p className="mt-1 text-sm text-slate-500">Âm lịch: {getLunarText(date).text}</p>
          </div>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">×</button>
        </div>
        <button type="button" onClick={add} className="mt-4 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700">+ Thêm sự kiện ngày này</button>
        <div className="mt-4">
          <AgendaView
            title="Danh sách trong ngày"
            events={events}
            members={members}
            open={open}
            edit={edit}
            remove={remove}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            emptyText="Chưa có sự kiện trong ngày này."
          />
        </div>
      </div>
    </div>
  );
}

function EventEditor({ draft, calendars, members, user, setDraft, save, remove }: { draft: EventDraft; calendars: Calendar[]; members: Member[]; user?: Actor; setDraft: (draft: EventDraft | null) => void; save: (event: React.FormEvent) => void; remove?: () => void }) {
  const selectable = user?.role === "self_only" ? members.filter(member => member.id === user.memberId) : members;
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft({ ...draft, [key]: value });
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 md:items-center md:justify-center md:p-6" onMouseDown={() => setDraft(null)}>
      <form onSubmit={save} onMouseDown={event => event.stopPropagation()} className="max-h-[96vh] w-full overflow-y-auto rounded-t-3xl border border-white/70 bg-slate-50 p-4 shadow-2xl md:max-w-3xl md:rounded-3xl md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">{draft.id ? "Sửa sự kiện" : "Thêm sự kiện"}</p>
            <h3 className="mt-1 text-xl font-bold">{draft.title || "Sự kiện mới"}</h3>
          </div>
          <button type="button" onClick={() => setDraft(null)} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">×</button>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-black tracking-wide text-slate-600">Thông tin chính</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tiêu đề"><input required autoFocus className={input} value={draft.title} onChange={event => set("title", event.target.value)} /></Field>
              <Field label="Lịch"><select className={input} value={draft.calendarId} onChange={event => set("calendarId", event.target.value)}>{calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></Field>
              <Field label="Loại sự kiện"><select className={input} value={draft.type} onChange={event => set("type", event.target.value as EventType)}>{eventTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
              <Field label="Trạng thái"><select className={input} value={draft.status} onChange={event => set("status", event.target.value as EventStatus)}><option value="open">Đang mở</option><option value="done">Hoàn thành</option></select></Field>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-black tracking-wide text-slate-600">Thời gian</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={`col-span-full flex min-h-11 w-max cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-bold shadow-sm transition ${draft.allDay ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}><input type="checkbox" checked={draft.allDay} onChange={event => setDraft({ ...draft, allDay: event.target.checked, startTime: event.target.checked ? "" : draft.startTime || "08:00", endTime: event.target.checked ? "" : draft.endTime })} className="sr-only" /><span className={`relative h-6 w-10 rounded-full transition ${draft.allDay ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition ${draft.allDay ? "left-5" : "left-1"}`} /></span>Sự kiện cả ngày / Không có giờ cụ thể</label>
              <Field label="Ngày bắt đầu"><input required type="date" className={input} value={draft.startDate} onChange={event => { setDraft({ ...draft, startDate: event.target.value, endDate: draft.endDate || event.target.value }); }} /></Field>
              <Field label="Giờ bắt đầu"><input type="time" disabled={draft.allDay} className={`${input} ${draft.allDay ? 'opacity-50' : ''}`} value={draft.startTime} onChange={event => set("startTime", event.target.value)} /></Field>
              <Field label="Ngày kết thúc"><input type="date" className={input} value={draft.endDate} onChange={event => set("endDate", event.target.value)} /></Field>
              <Field label="Giờ kết thúc"><input type="time" disabled={draft.allDay} className={`${input} ${draft.allDay ? 'opacity-50' : ''}`} value={draft.endTime} onChange={event => set("endTime", event.target.value)} /></Field>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-black tracking-wide text-slate-600">Người liên quan & Quyền xem</h4>
            <div className="space-y-4">
              <Field label="Thành viên được phép xem">
                <select className={input} value={draft.visibility || "all"} onChange={event => set("visibility", event.target.value as "all" | "private" | "custom")}>
                  <option value="all">Tất cả thành viên</option>
                  <option value="private">Chỉ mình tôi</option>
                  <option value="custom">Chọn thành viên cụ thể</option>
                </select>
              </Field>

              {draft.visibility === "custom" && (
                <Field label="Chọn người được xem">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectable.map(member => (
                      <label key={member.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 ${draft.allowedMemberIds?.includes(member.id) ? "border-indigo-100 bg-indigo-50/70" : "border-slate-200 bg-white"}`}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{memberName(member)[0]}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{memberName(member)}</span>
                        <input type="checkbox" checked={draft.allowedMemberIds?.includes(member.id)} onChange={() => set("allowedMemberIds", draft.allowedMemberIds?.includes(member.id) ? draft.allowedMemberIds.filter(id => id !== member.id) : [...(draft.allowedMemberIds || []), member.id])} className="sr-only" />
                        <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${draft.allowedMemberIds?.includes(member.id) ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Thành viên liên quan (Tag)">
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectable.map(member => {
                    const isChecked = (draft.relatedMemberIds || draft.memberIds || []).includes(member.id);
                    return (
                      <label key={member.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 ${isChecked ? "border-indigo-100 bg-indigo-50/70" : "border-slate-200 bg-white"}`}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{memberName(member)[0]}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{memberName(member)}</span>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const current = draft.relatedMemberIds || draft.memberIds || [];
                          const next = current.includes(member.id) ? current.filter(id => id !== member.id) : [...current, member.id];
                          setDraft({ ...draft, relatedMemberIds: next, memberIds: next });
                        }} className="sr-only" />
                        <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${isChecked ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-black tracking-wide text-slate-600">Nhắc nhở / lặp lại / ghi chú</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Địa điểm"><input className={input} value={draft.location} placeholder="Nhập địa điểm..." onChange={event => set("location", event.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nhắc trước"><select className={input} value={draft.reminderMinutes} onChange={event => set("reminderMinutes", Number(event.target.value))}>{reminderOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Lặp lại"><select className={input} value={draft.repeatRule} onChange={event => set("repeatRule", event.target.value)}>{repeatOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              </div>
              <div className="col-span-full">
                <Field label="Ghi chú"><textarea rows={4} className={textarea} placeholder="Thêm mô tả chi tiết..." value={draft.note} onChange={event => set("note", event.target.value)} /></Field>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3 rounded-3xl bg-white p-4 shadow-sm">
          {remove && <button type="button" onClick={remove} className="mr-auto rounded-xl bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20">Xóa sự kiện</button>}
          <button type="button" onClick={() => setDraft(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">Hủy</button>
          <button className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg">Lưu sự kiện</button>
        </div>
      </form>
    </div>
  );
}

function EventDetail({ item, calendars, members, close, edit, remove, markDone }: { item: CalendarEvent; calendars: Calendar[]; members: Member[]; close: () => void; edit: () => void; remove: () => void; markDone: () => void }) {
  const calendar = calendars.find(calendar => calendar.id === item.calendarId);
  const related = members.filter(member => item.relatedMemberIds?.includes(member.id) || item.memberIds.includes(member.id)).map(memberName).join(", ");
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 md:items-center md:justify-center md:p-6" onMouseDown={close}>
      <div onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-lg md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded-full px-2 py-1 text-xs font-bold text-white" style={{ background: eventColor(item) }}>{eventTypeMeta(item.type).label}</span>
            <h3 className={`mt-3 text-2xl font-bold ${item.status === "done" ? "text-slate-400 line-through" : ""}`}>{item.title}</h3>
          </div>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">×</button>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <Info label="Thời gian" value={`${formatDateVN(item.startDate)} ${item.allDay ? "· Cả ngày" : `· ${item.startTime || "08:00"}${item.endTime ? ` - ${item.endTime}` : ""}`}`} />
          {item.endDate && item.endDate !== item.startDate && <Info label="Kết thúc" value={`${formatDateVN(item.endDate)} ${item.endTime || ""}`} />}
          <Info label="Lịch" value={calendar?.name || "Lịch"} />
          {related && <Info label="Thành viên liên quan" value={related} />}
          {item.location && <Info label="Địa điểm" value={item.location} />}
          <Info label="Nhắc trước" value={reminderOptions.find(option => option.value === item.reminderMinutes)?.label || "Không"} />
          <Info label="Lặp lại" value={repeatOptions.find(option => option.value === item.repeatRule)?.label || "Không"} />
          <Info label="Ghi chú" value={item.note || "Không có ghi chú."} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {item.calendarId !== "fixed-birthday" && item.calendarId !== "fixed-holiday" && (
            <>
              <button type="button" onClick={markDone} className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50">{item.status === "done" ? "Mở lại" : "Đánh dấu hoàn thành"}</button>
              <button type="button" onClick={edit} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">Sửa</button>
              <button type="button" onClick={remove} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50">Xóa</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold">{label}<div className="mt-1">{children}</div></label>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function FilterContent({ calendars, events, enabled, setEnabled, enabledTypes, setEnabledTypes, collapsed, toggle }: { calendars: Calendar[]; events: CalendarEvent[]; enabled: string[]; setEnabled: React.Dispatch<React.SetStateAction<string[]>>; enabledTypes: EventType[]; setEnabledTypes: React.Dispatch<React.SetStateAction<EventType[]>>; collapsed?: boolean; toggle?: () => void; }) {
  const allTypes = filterGroups.map(g => g.value);
  const allCals = calendars.map(c => c.id);
  const countByType = events.reduce((acc, ev) => { acc[ev.type] = (acc[ev.type] || 0) + 1; return acc; }, {} as Record<string, number>);
  const countByCal = events.reduce((acc, ev) => { acc[ev.calendarId] = (acc[ev.calendarId] || 0) + 1; return acc; }, {} as Record<string, number>);
  
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 space-y-4">
        <button type="button" onClick={toggle} className="mb-2 text-slate-400 hover:text-indigo-600" title="Mở rộng bộ lọc">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
        </button>
        <div className="w-full border-b border-slate-200 dark:border-white/10" />
        <div className="flex flex-col items-center space-y-3">
          {filterGroups.map(group => (
            <label key={group.value} className="cursor-pointer" title={group.label}>
              <input type="checkbox" checked={enabledTypes.includes(group.value)} onChange={() => setEnabledTypes(current => current.includes(group.value) ? current.filter(id => id !== group.value) : [...current, group.value])} className="sr-only" />
              <i className={`block size-3 rounded-full shadow-sm transition-all ${enabledTypes.includes(group.value) ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : "opacity-40 hover:opacity-100"}`} style={{ background: eventTypeMeta(group.value).color }} />
            </label>
          ))}
        </div>
        {calendars.length > 0 && (
          <>
            <div className="w-full border-b border-slate-200 dark:border-white/10" />
            <div className="flex flex-col items-center space-y-3">
              {calendars.map(calendar => (
                <label key={calendar.id} className="cursor-pointer" title={calendar.name}>
                  <input type="checkbox" checked={enabled.includes(calendar.id)} onChange={() => setEnabled(current => current.includes(calendar.id) ? current.filter(id => id !== calendar.id) : [...current, calendar.id])} className="sr-only" />
                  <i className={`block size-3 rounded-full shadow-sm transition-all ${enabled.includes(calendar.id) ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : "opacity-40 hover:opacity-100"}`} style={{ background: calendar.color }} />
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 rounded-xl bg-slate-50/80 p-3 dark:bg-white/5 relative group">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-indigo-500">Bộ lọc</p>
          {toggle && (
            <button type="button" onClick={toggle} className="text-slate-400 hover:text-indigo-600" title="Thu gọn bộ lọc">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="m15 15-3-3 3-3"></path></svg>
            </button>
          )}
        </div>
        <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">Lịch hiển thị</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setEnabledTypes(allTypes); setEnabled(allCals); }} className="h-8 rounded-full bg-indigo-600 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700">Bật tất cả</button>
          <button type="button" onClick={() => { setEnabledTypes([]); setEnabled([]); }} className="h-8 rounded-full border border-slate-200 bg-white text-xs font-extrabold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5">Tắt tất cả</button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">Sự kiện</h3>
        <button type="button" onClick={() => setEnabledTypes(enabledTypes.length === allTypes.length ? [] : allTypes)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600">
          {enabledTypes.length === allTypes.length ? "Bỏ chọn" : "Chọn tất cả"}
        </button>
      </div>
      <div className="mb-6 space-y-1">
        {filterGroups.map(group => (
          <label key={group.value} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm shadow-sm transition hover:bg-slate-50 ${enabledTypes.includes(group.value) ? "border-indigo-100 bg-indigo-50/70" : "border-transparent bg-white/60"} dark:border-white/10 dark:bg-white/5`}>
            <input type="checkbox" checked={enabledTypes.includes(group.value)} onChange={() => setEnabledTypes(current => current.includes(group.value) ? current.filter(id => id !== group.value) : [...current, group.value])} className="sr-only" />
            <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${enabledTypes.includes(group.value) ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
            <i className="size-3.5 shrink-0 rounded-full shadow-sm" style={{ background: eventTypeMeta(group.value).color }} />
            <span className="min-w-0 flex-1 truncate font-bold text-slate-700 dark:text-slate-200">{group.label}</span>
            {countByType[group.value] > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{countByType[group.value]}</span>}
          </label>
        ))}
      </div>
      
      {calendars.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">Lịch người dùng</h3>
            <button type="button" onClick={() => setEnabled(enabled.length === allCals.length ? [] : allCals)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600">
              {enabled.length === allCals.length ? "Bỏ chọn" : "Chọn tất cả"}
            </button>
          </div>
          <div className="space-y-1">
            {calendars.map(calendar => (
              <label key={calendar.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm shadow-sm transition hover:bg-slate-50 ${enabled.includes(calendar.id) ? "border-indigo-100 bg-indigo-50/70" : "border-transparent bg-white/60"} dark:border-white/10 dark:bg-white/5`}>
                <input type="checkbox" checked={enabled.includes(calendar.id)} onChange={() => setEnabled(current => current.includes(calendar.id) ? current.filter(id => id !== calendar.id) : [...current, calendar.id])} className="sr-only" />
                <span className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${enabled.includes(calendar.id) ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                <i className="size-3.5 shrink-0 rounded-full shadow-sm" style={{ background: calendar.color }} />
                <span className="min-w-0 flex-1 truncate font-bold text-slate-700 dark:text-slate-200">{calendar.name}</span>
                {countByCal[calendar.id] > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{countByCal[calendar.id]}</span>}
              </label>
            ))}
          </div>
        </>
      )}
    </>
  );
}
