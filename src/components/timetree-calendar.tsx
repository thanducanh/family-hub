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

  const gridLayoutClass = ""; // Not used anymore

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
             <EventEditorInline draft={draft} calendars={calendars} members={members} user={user} setDraft={setDraft} close={() => setDraft(null)} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />
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

      <button type="button" onClick={() => openNewEvent(selectedDate)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-indigo-600 text-3xl font-semibold text-white shadow-xl transition hover:bg-indigo-700 xl:hidden" aria-label="Thêm sự kiện">+</button>

      <div className="xl:hidden">
        {daySheetDate && <DayEventsSheet date={daySheetDate} events={visibleEvents.filter(item => item.startDate === daySheetDate).sort(sortEvents)} members={members} close={() => setDaySheetDate(null)} add={() => openNewEvent(daySheetDate)} open={openEventDetail} edit={openEditEvent} remove={deleteEvent} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
        {draft && <EventEditorSheet draft={draft} calendars={calendars} members={members} user={user} setDraft={setDraft} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />}
        {detail && <EventDetailSheet item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />}
      </div>
    </div>
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

function EventEditorInline({ draft, calendars, members, user, setDraft, save, close, remove }: { draft: EventDraft; calendars: Calendar[]; members: Member[]; user?: Actor; setDraft: (draft: EventDraft | null) => void; save: (event: React.FormEvent) => void; close: () => void; remove?: () => void }) {
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const selectable = user?.role === "self_only" ? members.filter(member => member.id === user.memberId) : members;
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 relative w-full overflow-hidden">
      
      {/* Main Form Layer */}
      <div className={`absolute inset-0 flex flex-col bg-slate-50 dark:bg-slate-950 transition-transform duration-300 ease-in-out ${activePopup ? '-translate-x-[30%] opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}>
        <div className="flex items-center justify-between px-3 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 shrink-0">
          <button type="button" onClick={close} className="p-1 text-slate-400 hover:text-slate-800"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <span className="font-bold text-[13px] uppercase tracking-wider">{draft.id ? "Edit Event" : "Create Event"}</span>
          <button type="button" onClick={save as any} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700">Save</button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
           <div className="flex px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 mb-2">
              <button className="flex-1 py-2 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600">Event</button>
              <button className="flex-1 py-2 text-sm font-bold text-slate-400 hover:text-slate-600">Memo</button>
           </div>

           <div className="bg-white dark:bg-slate-900 px-4 py-3 mb-2 shadow-sm">
              <input autoFocus className="w-full text-lg font-bold placeholder:text-slate-300 outline-none bg-transparent" placeholder="Event title" value={draft.title} onChange={e => set("title", e.target.value)} />
           </div>

           <div className="bg-white dark:bg-slate-900 mb-2 shadow-sm border-y border-slate-200 dark:border-white/5">
              <Row label="Calendar" value={calendars.find(c => c.id === draft.calendarId)?.name || ""} onClick={() => setActivePopup("Calendar")} />
              <Row label="Label" value={eventTypes.find(t => t.value === draft.type)?.label || ""} onClick={() => setActivePopup("Label")} />
           </div>

           <div className="bg-white dark:bg-slate-900 mb-2 shadow-sm border-y border-slate-200 dark:border-white/5">
              <Row label="All-day" right={<input type="checkbox" checked={draft.allDay} onChange={e => setDraft({ ...draft, allDay: e.target.checked })} className="size-4" />} />
              <Row label="Starts" value={formatDateVN(draft.startDate) + (draft.allDay ? "" : ` ${draft.startTime}`)} onClick={() => setActivePopup("Starts")} />
              <Row label="Ends" value={formatDateVN(draft.endDate) + (draft.allDay ? "" : ` ${draft.endTime}`)} onClick={() => setActivePopup("Ends")} />
              <Row label="Repeat" value={repeatOptions.find(o => o.value === draft.repeatRule)?.label || "Không"} onClick={() => setActivePopup("Repeat")} />
              <Row label="Remind" value={reminderOptions.find(o => o.value === draft.reminderMinutes)?.label || "Không"} onClick={() => setActivePopup("Remind")} />
           </div>

           <div className="bg-white dark:bg-slate-900 mb-2 shadow-sm border-y border-slate-200 dark:border-white/5">
              <Row label="Members" value={draft.memberIds.length ? `${draft.memberIds.length} người` : "Không"} onClick={() => setActivePopup("Members")} />
              <Row label="Location" value={draft.location || "Thêm địa điểm"} onClick={() => setActivePopup("Location")} />
              <Row label="Note" value={draft.note ? "Có ghi chú" : "Thêm ghi chú"} onClick={() => setActivePopup("Note")} />
           </div>

           <div className="bg-white dark:bg-slate-900 shadow-sm border-y border-slate-200 dark:border-white/5">
              <Row label="Visibility" value={draft.visibility === "private" ? "Chỉ mình tôi" : "Tất cả"} onClick={() => setActivePopup("Visibility")} />
           </div>

           {remove && (
             <div className="mt-6 px-4">
                <button type="button" onClick={remove} className="w-full py-2 bg-white dark:bg-slate-900 text-rose-500 font-bold text-sm rounded shadow-sm border border-rose-100 dark:border-rose-900">Delete Event</button>
             </div>
           )}
        </div>
      </div>

      {/* Sub Panel Picker Layer */}
      <div className={`absolute inset-0 flex flex-col bg-slate-50 dark:bg-slate-950 z-20 transition-transform duration-300 ease-in-out ${activePopup ? 'translate-x-0 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.1)]' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-3 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 shrink-0 shadow-sm relative z-10">
          <button onClick={() => setActivePopup(null)} className="p-1 text-slate-500 hover:text-slate-800 flex items-center gap-0.5">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
             <span className="text-[13px] font-bold">Back</span>
          </button>
          <span className="font-bold text-[13px] uppercase tracking-wider text-slate-600 dark:text-slate-400 absolute left-1/2 -translate-x-1/2">{activePopup}</span>
          <button onClick={() => setActivePopup(null)} className="p-1 text-indigo-600 font-bold text-[13px]">Done</button>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
           {activePopup === "Calendar" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {calendars.map(c => (
                  <div key={c.id} className="py-3 px-4 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { set("calendarId", c.id); setActivePopup(null); }}>
                    <div className="size-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium text-sm flex-1">{c.name}</span>
                    {draft.calendarId === c.id && <svg width="16" height="16" className="text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
               ))}
             </div>
           )}

           {activePopup === "Label" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {eventTypes.map(c => (
                  <div key={c.value} className="py-3 px-4 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { set("type", c.value as EventType); setActivePopup(null); }}>
                    <div className="size-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium text-sm flex-1">{c.label}</span>
                    {draft.type === c.value && <svg width="16" height="16" className="text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
               ))}
             </div>
           )}

           {activePopup === "Repeat" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {repeatOptions.map(o => (
                  <div key={o.value} className="py-3 px-4 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { set("repeatRule", o.value); setActivePopup(null); }}>
                    <span className="font-medium text-sm flex-1">{o.label}</span>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center ${draft.repeatRule === o.value ? "border-indigo-600" : "border-slate-300"}`}>
                      {draft.repeatRule === o.value && <div className="size-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                  </div>
               ))}
             </div>
           )}

           {activePopup === "Remind" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {reminderOptions.map(o => (
                  <div key={o.value} className="py-3 px-4 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { set("reminderMinutes", o.value); setActivePopup(null); }}>
                    <span className="font-medium text-sm flex-1">{o.label}</span>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center ${draft.reminderMinutes === o.value ? "border-indigo-600" : "border-slate-300"}`}>
                      {draft.reminderMinutes === o.value && <div className="size-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                  </div>
               ))}
             </div>
           )}

           {(activePopup === "Starts" || activePopup === "Ends") && (
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-4 space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ngày</label>
                   <input type="date" className={input} value={activePopup === "Starts" ? draft.startDate : draft.endDate} onChange={e => {
                      const val = e.target.value;
                      if (activePopup === "Starts") {
                         setDraft({ ...draft, startDate: val, endDate: val > (draft.endDate||"") ? val : draft.endDate });
                      } else {
                         set("endDate", val);
                      }
                   }} />
                 </div>
                 {!draft.allDay && (
                   <div className="pt-2">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Giờ</label>
                     <input type="time" className={input} value={activePopup === "Starts" ? draft.startTime : draft.endTime} onChange={e => set(activePopup === "Starts" ? "startTime" : "endTime", e.target.value)} />
                   </div>
                 )}
              </div>
           )}

           {activePopup === "Location" && (
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-4">
                 <input autoFocus className={input} placeholder="Nhập địa điểm..." value={draft.location} onChange={e => set("location", e.target.value)} />
              </div>
           )}

           {activePopup === "Note" && (
              <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 p-4 flex flex-col h-[50vh]">
                 <textarea autoFocus className="w-full flex-1 rounded-xl border border-slate-200 p-3 text-sm resize-none outline-none focus:border-indigo-500 dark:bg-slate-800 dark:border-white/10 dark:text-white" placeholder="Thêm ghi chú..." value={draft.note} onChange={e => set("note", e.target.value)} />
              </div>
           )}

           {activePopup === "Members" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {selectable.map(m => (
                  <label key={m.id} className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0">
                     <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{memberName(m)[0]}</span>
                     <span className="flex-1 text-sm font-medium">{memberName(m)}</span>
                     <input type="checkbox" checked={draft.memberIds.includes(m.id)} onChange={(e) => {
                        const next = e.target.checked ? [...draft.memberIds, m.id] : draft.memberIds.filter(id => id !== m.id);
                        setDraft({ ...draft, memberIds: next, relatedMemberIds: next });
                     }} className="size-5 rounded border-slate-300" />
                  </label>
               ))}
             </div>
           )}

           {activePopup === "Visibility" && (
             <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5">
               {[
                  { value: "all", label: "Tất cả thành viên" },
                  { value: "private", label: "Chỉ mình tôi" }
               ].map(o => (
                  <div key={o.value} className="py-3 px-4 border-b border-slate-100 dark:border-white/5 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { set("visibility", o.value as "all"|"private"); setActivePopup(null); }}>
                    <span className="font-medium text-sm flex-1">{o.label}</span>
                    <div className={`size-5 rounded-full border-2 flex items-center justify-center ${draft.visibility === o.value ? "border-indigo-600" : "border-slate-300"}`}>
                      {draft.visibility === o.value && <div className="size-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                  </div>
               ))}
             </div>
           )}
        </div>
      </div>
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

function EventEditorSheet({ draft, calendars, members, user, setDraft, save, remove }: { draft: EventDraft; calendars: Calendar[]; members: Member[]; user?: Actor; setDraft: (draft: EventDraft | null) => void; save: (event: React.FormEvent) => void; remove?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950">
      <EventEditorInline draft={draft} calendars={calendars} members={members} user={user} setDraft={setDraft} save={saveEvent => { save(saveEvent); setDraft(null); }} close={() => setDraft(null)} remove={remove ? () => { remove(); setDraft(null); } : undefined} />
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
