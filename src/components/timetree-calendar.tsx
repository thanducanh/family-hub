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
};
type EventDraft = Omit<CalendarEvent, "id" | "color" | "createdAt"> & { id?: string };

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const input = "h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none transition focus:border-indigo-500";
const textarea = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500";
const viDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const eventTypes: Array<{ value: EventType; label: string; color: string }> = [
  { value: "family", label: "Gia đình", color: "#2563eb" },
  { value: "personal", label: "Cá nhân", color: "#7c3aed" },
  { value: "work", label: "Công việc", color: "#16a34a" },
  { value: "study", label: "Học tập", color: "#f97316" },
  { value: "payment", label: "Thanh toán", color: "#dc2626" },
  { value: "reminder", label: "Nhắc nhở", color: "#ec4899" },
  { value: "birthday", label: "Sinh nhật", color: "#d97706" },
  { value: "holiday", label: "Ngày lễ", color: "#e11d48" },
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
    createdByUserId: user?.id
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

  useEffect(() => {
    const val = localStorage.getItem("calendar-show-lunar");
    if (val !== null) setShowLunar(val === "true");
  }, []);

  function toggleLunar() {
    const next = !showLunar;
    setShowLunar(next);
    localStorage.setItem("calendar-show-lunar", String(next));
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

  return (
    <section className="relative mx-auto max-w-[1500px] pb-20 md:pb-0">
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
      />
      {error && <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-sm xl:block">
          <FilterContent calendars={calendars} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} />
        </aside>

        {filterOpenMobile && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/45 xl:hidden" onMouseDown={() => setFilterOpenMobile(false)}>
            <div onMouseDown={e => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl">
               <div className="mb-4 flex items-center justify-between">
                 <h3 className="text-lg font-bold">Lịch hiển thị</h3>
                 <button type="button" onClick={() => setFilterOpenMobile(false)} className="flex size-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500">×</button>
               </div>
               <FilterContent calendars={calendars} enabled={enabled} setEnabled={setEnabled} enabledTypes={enabledTypes} setEnabledTypes={setEnabledTypes} />
            </div>
          </div>
        )}

        <div className="min-w-0">
          {view === "monthly" && (
            <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-sm">
              <div className="grid grid-cols-7 border-b border-[var(--app-border)] bg-slate-50/70 dark:bg-white/5">
                {weekdays.map(day => <b key={day} className="py-3 text-center text-xs text-slate-500">{day}</b>)}
              </div>
              <div className="grid grid-cols-7">
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

          {view !== "agenda" && (
            <div className="mt-4">
              <AgendaView
                title={`Sự kiện ${dayGroupTitle(selectedDate)}`}
                events={selectedEvents}
                members={members}
                open={openEventDetail}
                edit={openEditEvent}
                remove={deleteEvent}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                emptyText="Chưa có sự kiện trong ngày này."
              />
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={() => openNewEvent(selectedDate)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-indigo-600 text-3xl font-semibold text-white shadow-xl transition hover:bg-indigo-700 md:hidden" aria-label="Thêm sự kiện">+</button>

      {daySheetDate && <DayEventsSheet date={daySheetDate} events={visibleEvents.filter(item => item.startDate === daySheetDate).sort(sortEvents)} members={members} close={() => setDaySheetDate(null)} add={() => openNewEvent(daySheetDate)} open={openEventDetail} edit={openEditEvent} remove={deleteEvent} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
      {draft && <EventEditor draft={draft} calendars={calendars} members={members} user={user} setDraft={setDraft} save={saveEvent} remove={draft.id ? () => deleteEvent(draft as CalendarEvent) : undefined} />}
      {detail && <EventDetail item={detail} calendars={calendars} members={members} close={() => setDetail(null)} edit={() => openEditEvent(detail)} remove={() => deleteEvent(detail)} markDone={() => markDone(detail)} />}
    </section>
  );
}

function CalendarToolbar({ anchor, view, setView, today, prev, next, add, quickPickerOpen, setQuickPickerOpen, setAnchor, setSelectedDate, showLunar, toggleLunar, filterOpenMobile, setFilterOpenMobile }: {
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
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={today} className="h-11 rounded-xl border border-[var(--app-border)] px-4 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5">Hôm nay</button>
          <button type="button" onClick={prev} className="grid size-11 place-items-center rounded-xl border border-[var(--app-border)] text-xl hover:bg-slate-50 dark:hover:bg-white/5" aria-label="Tháng trước">‹</button>
          <button type="button" onClick={next} className="grid size-11 place-items-center rounded-xl border border-[var(--app-border)] text-xl hover:bg-slate-50 dark:hover:bg-white/5" aria-label="Tháng sau">›</button>
          <h2 className="min-w-[160px] text-lg font-bold md:text-2xl">{monthLabel(anchor)}</h2>
          <div className="relative">
            <button type="button" onClick={() => setQuickPickerOpen(!quickPickerOpen)} className="h-11 rounded-xl border border-[var(--app-border)] px-4 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5">Chọn tháng/năm</button>
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
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
             <input type="checkbox" checked={showLunar} onChange={toggleLunar} className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
             Âm lịch
          </label>
          <button type="button" onClick={() => setFilterOpenMobile(!filterOpenMobile)} className="h-11 rounded-xl border border-[var(--app-border)] px-4 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 xl:hidden">Lịch hiển thị</button>
          <div className="grid grid-cols-3 rounded-xl border border-[var(--app-border)] p-1">
            {[
              ["monthly", "Tháng"],
              ["weekly", "Tuần"],
              ["agenda", "Danh sách"]
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setView(value as CalendarView)} className={`h-9 rounded-lg px-3 text-sm font-bold ${view === value ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}>{label}</button>
            ))}
          </div>
          <button type="button" onClick={add} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">+ Thêm sự kiện</button>
        </div>
      </div>
    </div>
  );
}

function DayCell({ date, anchor, selected, events, select, add, open, showLunar }: { date: Date; anchor: Date; selected: boolean; events: CalendarEvent[]; select: () => void; add: () => void; open: (event: CalendarEvent) => void; showLunar?: boolean }) {
  const dateIso = iso(date);
  const isToday = dateIso === todayIso();
  const inMonth = date.getMonth() === anchor.getMonth();
  const visible = events.slice(0, 3);
  
  let lunarText = "";
  let isLunarImportant = false;
  if (showLunar) {
    const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const lunar = solar.getLunar();
    const lDay = lunar.getDay();
    const lMonth = lunar.getMonth();
    isLunarImportant = lDay === 1 || lDay === 15;
    if (lDay === 1) {
      lunarText = `${lDay}/${lMonth}`;
    } else {
      lunarText = `${lDay}`;
    }
  }

  return (
    <button type="button" onClick={add} onFocus={select} className={`calendar-day-cell min-h-[112px] p-1.5 text-left transition md:min-h-[132px] md:p-2.5 ${inMonth ? "bg-white/60 dark:bg-white/[0.02]" : "bg-slate-50/70 text-slate-400 dark:bg-white/[0.01]"} ${selected ? "selected-day ring-2 ring-inset ring-indigo-300" : ""} ${isToday ? "bg-indigo-50/70 dark:bg-indigo-400/10" : ""}`}>
      <div className="mb-1 flex items-start justify-between">
        <div className="flex flex-col items-center">
          <span className={`grid size-8 place-items-center rounded-full text-base font-bold md:text-lg ${isToday ? "bg-indigo-600 text-white" : ""}`}>{date.getDate()}</span>
          {showLunar && (
             <span className={`mt-0.5 text-[10px] ${isLunarImportant ? "font-bold text-rose-500" : "font-medium text-slate-400"} ${isToday && !isLunarImportant ? "text-indigo-300" : ""}`}>{lunarText}</span>
          )}
        </div>
        {events.length > 0 && <span className="mt-1.5 text-[11px] font-semibold text-slate-400">{events.length}</span>}
      </div>
      <div className="space-y-1">
        {visible.map(item => (
          <span
            key={item.id}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); open(item); }}
            className="block h-6 truncate rounded-md px-1.5 py-1 text-left text-[11px] font-bold leading-4 shadow-sm md:text-xs"
            style={{ background: `${eventColor(item)}1f`, color: eventColor(item), borderLeft: `3px solid ${eventColor(item)}` }}
          >
            {!item.allDay && <span className="mr-1 tabular-nums">{eventTimeLabel(item)}</span>}
            <span>{item.title}</span>
          </span>
        ))}
        {events.length > visible.length && <span className="block rounded-md px-1.5 py-1 text-left text-[11px] font-bold text-indigo-600">+ {events.length - visible.length} sự kiện</span>}
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

function AgendaView({ events, members, open, edit, remove, openMenuId, setOpenMenuId, title = "Danh sách sự kiện", emptyText = "Chưa có sự kiện trong tháng này." }: { events: CalendarEvent[]; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void; title?: string; emptyText?: string }) {
  const groups = events.reduce<Record<string, CalendarEvent[]>>((acc, item) => {
    acc[item.startDate] = [...(acc[item.startDate] || []), item];
    return acc;
  }, {});
  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-sm">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-3 space-y-4">
        {Object.keys(groups).length ? Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => (
          <div key={date}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{dayGroupTitle(date)}</h4>
            <div className="space-y-2">
              {items.sort(sortEvents).map(item => <AgendaItem key={item.id} item={item} members={members} open={open} edit={edit} remove={remove} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />)}
            </div>
          </div>
        )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-slate-400">{emptyText}</p>}
      </div>
    </section>
  );
}

function AgendaItem({ item, members, open, edit, remove, openMenuId, setOpenMenuId }: { item: CalendarEvent; members: Member[]; open: (event: CalendarEvent) => void; edit: (event: CalendarEvent) => void; remove: (event: CalendarEvent) => void; openMenuId: string | null; setOpenMenuId: (id: string | null) => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const related = members.filter(member => item.memberIds.includes(member.id)).map(memberName).join(", ");
  const meta = eventTypeMeta(item.type);
  useEffect(() => {
    if (openMenuId !== item.id) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [item.id, openMenuId, setOpenMenuId]);
  return (
    <div className="relative flex min-h-16 items-center gap-3 rounded-xl border border-[var(--app-border)] bg-white/70 p-3 dark:bg-white/5">
      <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-14 shrink-0 text-sm font-bold text-slate-500">{eventTimeLabel(item)}</span>
        <i className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: eventColor(item) }} />
        <span className="min-w-0 flex-1">
          <b className={`block truncate text-sm ${item.status === "done" ? "text-slate-400 line-through" : ""}`}>{item.title}</b>
          <small className="mt-1 block truncate text-xs text-slate-400">{meta.label}{related ? ` · ${related}` : ""}{item.location ? ` · ${item.location}` : ""}</small>
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
      <div onMouseDown={event => event.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-2xl md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">Sự kiện ngày này</p>
            <h3 className="mt-1 text-xl font-bold">{dayGroupTitle(date)} · {formatDateVN(date)}</h3>
          </div>
          <button type="button" onClick={close} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">×</button>
        </div>
        <button type="button" onClick={add} className="mt-4 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-700">+ Thêm sự kiện ngày này</button>
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
      <form onSubmit={save} onMouseDown={event => event.stopPropagation()} className="max-h-[96vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">{draft.id ? "Sửa sự kiện" : "Thêm sự kiện"}</p>
            <h3 className="mt-1 text-xl font-bold">{draft.title || "Sự kiện mới"}</h3>
          </div>
          <button type="button" onClick={() => setDraft(null)} className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">×</button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Tiêu đề"><input required autoFocus className={input} value={draft.title} onChange={event => set("title", event.target.value)} /></Field>
          <Field label="Loại"><select className={input} value={draft.type} onChange={event => set("type", event.target.value as EventType)}>{eventTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
          <Field label="Ngày bắt đầu"><input required type="date" className={input} value={draft.startDate} onChange={event => { setDraft({ ...draft, startDate: event.target.value, endDate: draft.endDate || event.target.value }); }} /></Field>
          <Field label="Giờ bắt đầu"><input type="time" disabled={draft.allDay} className={input} value={draft.startTime} onChange={event => set("startTime", event.target.value)} /></Field>
          <Field label="Ngày kết thúc"><input type="date" className={input} value={draft.endDate} onChange={event => set("endDate", event.target.value)} /></Field>
          <Field label="Giờ kết thúc"><input type="time" disabled={draft.allDay} className={input} value={draft.endTime} onChange={event => set("endTime", event.target.value)} /></Field>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 text-sm font-semibold"><input type="checkbox" checked={draft.allDay} onChange={event => setDraft({ ...draft, allDay: event.target.checked, startTime: event.target.checked ? "" : draft.startTime || "08:00", endTime: event.target.checked ? "" : draft.endTime })} />Cả ngày / Không có giờ</label>
          <Field label="Lịch"><select className={input} value={draft.calendarId} onChange={event => set("calendarId", event.target.value)}>{calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></Field>
          <Field label="Địa điểm"><input className={input} value={draft.location} onChange={event => set("location", event.target.value)} /></Field>
          <Field label="Nhắc trước"><select className={input} value={draft.reminderMinutes} onChange={event => set("reminderMinutes", Number(event.target.value))}>{reminderOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Lặp lại"><select className={input} value={draft.repeatRule} onChange={event => set("repeatRule", event.target.value)}>{repeatOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="Trạng thái"><select className={input} value={draft.status} onChange={event => set("status", event.target.value as EventStatus)}><option value="open">Đang mở</option><option value="done">Hoàn thành</option></select></Field>
        </div>

        <Field label="Người liên quan">
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {selectable.map(member => (
              <label key={member.id} className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">{memberName(member)[0]}</span>
                <span className="min-w-0 flex-1 truncate">{memberName(member)}</span>
                <input type="checkbox" checked={draft.memberIds.includes(member.id)} onChange={() => set("memberIds", draft.memberIds.includes(member.id) ? draft.memberIds.filter(id => id !== member.id) : [...draft.memberIds, member.id])} />
              </label>
            ))}
          </div>
        </Field>

        <Field label="Ghi chú"><textarea rows={4} className={textarea} value={draft.note} onChange={event => set("note", event.target.value)} /></Field>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {remove && <button type="button" onClick={remove} className="mr-auto rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-500 hover:bg-rose-50">Xóa</button>}
          <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-[var(--app-border)] px-4 py-2.5 text-sm font-bold">Hủy</button>
          <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Lưu nhanh</button>
        </div>
      </form>
    </div>
  );
}

function EventDetail({ item, calendars, members, close, edit, remove, markDone }: { item: CalendarEvent; calendars: Calendar[]; members: Member[]; close: () => void; edit: () => void; remove: () => void; markDone: () => void }) {
  const calendar = calendars.find(calendar => calendar.id === item.calendarId);
  const related = members.filter(member => item.memberIds.includes(member.id)).map(memberName).join(", ");
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
          {related && <Info label="Người liên quan" value={related} />}
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

function FilterContent({ calendars, enabled, setEnabled, enabledTypes, setEnabledTypes }: { calendars: Calendar[]; enabled: string[]; setEnabled: React.Dispatch<React.SetStateAction<string[]>>; enabledTypes: EventType[]; setEnabledTypes: React.Dispatch<React.SetStateAction<EventType[]>> }) {
  return (
    <>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Nhóm sự kiện</h3>
      <div className="mb-6 space-y-2">
        {filterGroups.map(group => (
          <label key={group.value} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
            <input type="checkbox" checked={enabledTypes.includes(group.value)} onChange={() => setEnabledTypes(current => current.includes(group.value) ? current.filter(id => id !== group.value) : [...current, group.value])} />
            <i className="size-3 rounded-full" style={{ background: eventTypeMeta(group.value).color }} />
            <span className="truncate">{group.label}</span>
          </label>
        ))}
      </div>
      
      {calendars.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Lịch người dùng</h3>
          <div className="space-y-2">
            {calendars.map(calendar => (
              <label key={calendar.id} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                <input type="checkbox" checked={enabled.includes(calendar.id)} onChange={() => setEnabled(current => current.includes(calendar.id) ? current.filter(id => id !== calendar.id) : [...current, calendar.id])} />
                <i className="size-3 rounded-full" style={{ background: calendar.color }} />
                <span className="truncate">{calendar.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </>
  );
}
