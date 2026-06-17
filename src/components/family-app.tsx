"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { TimeTreeCalendar } from "@/components/timetree-calendar";
import { MemberSimsPanel } from "@/components/member-sims-panel";
import { useUI } from "@/components/ui-context";
import { addAccountPasswordNotification, addDailyEventNotification, isCalendarNotificationUnread, loadVisibleCalendarNotifications, markCalendarNotificationsRead, markNotificationRead, notificationEvent, type CalendarNotification } from "@/lib/calendar-notifications";
import { translator } from "@/lib/i18n";
import { dataService, type SystemStatus } from "@/services/data-service";
import type { AppData, BankAccount, BankAccountStatus, BankCardBenefit, BankCardType, BankRawNote, BankRawNoteContentType, CardReward, CardRewardType, EventItem, IncomeCategory, IncomeFrequency, IncomeRecord, IncomeSource, IncomeSourceType, IncomeStatus, InvestmentTransaction, Language, Member, MemberJob, MemberJobStatus, MemberSim, Note, Task, Theme, Transaction, IncomeYearlySummaryRow } from "@/types";
import * as XLSX from "xlsx";

type Screen = "dashboard" | "members" | "tasks" | "finance" | "chat" | "calendar" | "notes" | "settings" | "notifications";
type EntityKind = "members" | "tasks" | "transactions" | "events" | "notes";
type EntityItem = Member | Task | Transaction | EventItem | Note;
type Editor = { kind: EntityKind; item?: EntityItem } | null;
type UserRole = "full_access" | "self_only";
export interface AuthUser { id: string; username: string; displayName: string; avatar: string; role: "full_access" | "self_only"; mustChangePassword?: boolean; memberId?: string; member?: Member; email?: string; passwordPlain?: string | null; }
type ManagedUser = AuthUser & { email: string; active: boolean; isSystem: boolean; createdAt: string; updatedAt: string };
type ProfileUser = ManagedUser & { member?: Member };
type PasswordResetRequest = { id: string; userId: string; usernameOrEmail: string; status: string; requestedAt: string; username: string; displayName: string; role: UserRole };
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };
const icons: Record<Screen | "plus" | "check", React.ReactNode> = { dashboard: <HomeIcon />, members: <UsersIcon />, tasks: <CheckListIcon />, finance: <WalletIcon />, chat: <ChatIcon />, calendar: <CalendarIcon />, notes: <NotesIcon />, settings: <SettingsIcon />, notifications: <BellIcon />, plus: "+", check: "✓" };
const vnDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const vnMoneyFormatter = new Intl.NumberFormat("vi-VN");
const money = (value: number) => `${vnMoneyFormatter.format(Number.isFinite(value) ? value : 0)} đ`;
const formatVndInput = (value: number | string) => `${vnMoneyFormatter.format(Number(String(value).replace(/\D/g, "")) || 0)} đ`;
const parseVndInput = (value: string) => Number(String(value).replace(/\D/g, "")) || 0;
const titleKey: Record<Screen, Parameters<ReturnType<typeof translator>>[0]> = { dashboard: "dashboard", members: "members", tasks: "tasks", finance: "finance", chat: "chat", calendar: "calendar", notes: "notes", settings: "settings", notifications: "notifications" };
const accessLabel = (role: UserRole) => role === "full_access" ? "Toàn quyền" : "Chỉ xem chính mình";
const bankCardsByMemberCache = new Map<string, BankAccount[]>();
async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; }
  catch { return null; }
}
function parseDate(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return new Date(asDate.getFullYear(), asDate.getMonth(), asDate.getDate());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) {
    const parsed = new Date(value.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  const [day, month] = value.split("/").map(Number);
  return day && month ? new Date(now.getFullYear(), month - 1, day) : null;
}
function formatDateVN(value: string | null | undefined, fallback = "") {
  const date = parseDate(value);
  return date ? vnDateFormatter.format(date) : fallback;
}
function isoDateFromVN(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : "";
}
function formatBirthday(value: string) {
  return formatDateVN(value, "Chưa cập nhật");
}
function genderLabel(value: string) {
  return value === "male" ? "Nam" : value === "female" ? "Nữ" : value === "other" ? "Khác" : "Chưa cập nhật";
}
function birthdayParts(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  const [year = "", month = "", day = ""] = normalized.split("-");
  return { day, month, year };
}
function daysInMonth(month: string, year: string) {
  if (!month || !year) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}
function BirthdaySelect({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const initial = birthdayParts(value);
  const [day, setDay] = useState(initial.day ? String(Number(initial.day)) : "");
  const [month, setMonth] = useState(initial.month ? String(Number(initial.month)) : "");
  const [year, setYear] = useState(initial.year);
  const maxDay = daysInMonth(month, year);
  const select = (nextDay: string, nextMonth: string, nextYear: string) => {
    const safeDay = nextDay && Number(nextDay) <= daysInMonth(nextMonth, nextYear) ? nextDay : "";
    setDay(safeDay); setMonth(nextMonth); setYear(nextYear);
    onChange(safeDay && nextMonth && nextYear ? `${nextYear}-${nextMonth.padStart(2, "0")}-${safeDay.padStart(2, "0")}` : "");
  };
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  const selectClass = `${inputClass} min-h-12`;
  return <Field label="Ngày sinh"><div className="grid grid-cols-3 gap-2"><select disabled={disabled} className={selectClass} value={day && Number(day) <= maxDay ? String(Number(day)) : ""} onChange={event => select(event.target.value, month, year)}><option value="">Ngày</option>{Array.from({ length: maxDay }, (_, index) => String(index + 1)).map(value => <option key={value}>{value}</option>)}</select><select disabled={disabled} className={selectClass} value={month ? String(Number(month)) : ""} onChange={event => select(day, event.target.value, year)}><option value="">Tháng</option>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map(value => <option key={value}>{value}</option>)}</select><select disabled={disabled} className={selectClass} value={year} onChange={event => select(day, month, event.target.value)}><option value="">Năm</option>{Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => String(new Date().getFullYear() - index)).map(value => <option key={value}>{value}</option>)}</select></div></Field>;
}

function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string }) {
  return <div {...props} className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-sm ${className}`}>{children}</div>;
}
function Circle({ children, color = "#fb7185" }: { children: React.ReactNode; color?: string }) {
  return <span className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }}>{children}</span>;
}
function Avatar({ member, size = "size-10" }: { member: Member; size?: string }) {
  const displayName = member.nickname || member.name;
  const src = member.avatarPreview || member.avatar;
  return src ? <Image unoptimized width={96} height={96} className={`${size} shrink-0 rounded-full object-cover`} src={src} alt={displayName} /> : <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-200`}>{displayName[0]?.toUpperCase() || "?"}</span>;
}
function AvatarEditor({ member, editable, onChange }: { member: Member; editable: boolean; onChange: (avatar: string) => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useUI();
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const max = 400;
        if (width > max || height > max) {
          if (width > height) { height = Math.round(height * max / width); width = max; }
          else { width = Math.round(width * max / height); height = max; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        if (dataUrl.length > 900000) { toast("Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn.", "error"); setOpen(false); return; }
        onChange(dataUrl); setOpen(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }
  return <div className="relative shrink-0"><button type="button" disabled={!editable} onClick={() => setOpen(current => !current)} className={`relative rounded-full transition ${editable ? "cursor-pointer hover:opacity-85" : ""}`} aria-label="Chỉnh avatar"><Avatar member={member} size="size-24" />{editable && <span className="absolute bottom-0 right-0 grid size-6 place-items-center rounded-full border-2 border-[var(--app-card)] bg-indigo-600 text-white shadow-sm"><CameraIcon /></span>}</button>{editable && open && <div className="absolute left-0 top-[108px] z-20 w-32 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl"><label className="block cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"><input hidden type="file" accept="image/*" onChange={upload} />{member.avatar ? "Đổi ảnh" : "Thêm ảnh"}</label>{member.avatar && <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa ảnh</button>}</div>}</div>;
}
function ageAtToday(birthday: string, now = new Date()) {
  const date = parseDate(birthday, now);
  if (!date) return null;
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age--;
  return age;
}
function nextBirthday(member: Member, now = new Date()) {
  const birthday = parseDate(member.birthday, now);
  if (!birthday) return null;
  const next = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(next.getFullYear() + 1);
  return next;
}
function isOverdue(task: Task, now = new Date()) { const due = parseDate(task.dueDate, now); return task.status !== "done" && Boolean(due && due < new Date(now.getFullYear(), now.getMonth(), now.getDate())); }
function isDueToday(task: Task, now = new Date()) { const due = parseDate(task.dueDate, now); return Boolean(due && due.toDateString() === now.toDateString()); }
function memberName(members: Member[], id: string) { const member = members.find(item => item.id === id); return member ? member.nickname || member.name : ""; }

export function FamilyApp({ children }: { children?: React.ReactNode } = {}) {
  const ui = useUI();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [language, setLanguage] = useState<Language>("vi");
  const [theme, setTheme] = useState<Theme>("system");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [notifications, setNotifications] = useState<CalendarNotification[]>([]);
  
  const unreadNotificationsCount = user ? notifications.filter(n => isCalendarNotificationUnread(n, user)).length : 0;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unreadNotificationsCount > 0) {
        (navigator as any).setAppBadge(unreadNotificationsCount).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [unreadNotificationsCount]);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const t = translator(language);

  useEffect(() => {
    void fetch("/api/auth/me").then(async response => {
      const result = await readJsonSafe<{ user?: AuthUser; member?: Member }>(response);
      setUser(response.ok && result?.user ? { ...result.user, member: result.member } : null);
    }).catch(() => setUser(null));
    const preferences = dataService.loadPreferences();
    queueMicrotask(() => {
      setLanguage(preferences.language); setTheme(preferences.theme);
      setPreferencesLoaded(true);
    });
    queueMicrotask(() => {
      setSidebarCollapsed(localStorage.getItem("sidebarCollapsed") === "true");
      setSidebarPreferenceLoaded(true);
    });
    
    // Parse URL params for PWA shortcuts
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const initialScreen = params.get("screen") as Screen;
      if (initialScreen) {
        setScreen(initialScreen);
      }
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    const startedAt = performance.now();
    queueMicrotask(() => {
      setData(visibleDataFor(user, dataService.loadCache()));
      console.info(`[Family Hub] Render cache localStorage: ${Math.round(performance.now() - startedAt)}ms`);
      void dataService.syncFromNas(next => setData(visibleDataFor(user, next)));
    });
  }, [user]);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => registration.update());
  }, []);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    setInstallDismissed(standalone || localStorage.getItem("pwaInstallDismissed") === "true");
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      if (!standalone && localStorage.getItem("pwaInstallDismissed") !== "true") setInstallDismissed(false);
    };
    const onInstalled = () => { setInstallPrompt(null); setInstallDismissed(true); localStorage.setItem("pwaInstallDismissed", "true"); };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    applyTheme();
    document.documentElement.lang = language;
    dataService.savePreferences({ language, theme });
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [language, preferencesLoaded, theme]);
  useEffect(() => {
    if (sidebarPreferenceLoaded) localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed, sidebarPreferenceLoaded]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => setNotifications(loadVisibleCalendarNotifications(user));
    refresh(); window.addEventListener(notificationEvent, refresh);
    return () => window.removeEventListener(notificationEvent, refresh);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const today = new Date(), date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    void Promise.all([fetch("/api/calendars", { cache: "no-store" }), fetch("/api/events", { cache: "no-store" })]).then(async ([calendarResponse, eventResponse]) => {
      const calendarResult = await readJsonSafe<{ data?: { id: string }[] }>(calendarResponse), eventResult = await readJsonSafe<{ data?: { title: string; calendarId: string; startDate: string; startTime: string; allDay: boolean }[] }>(eventResponse);
      if (!calendarResponse.ok || !eventResponse.ok) return;
      const visibleCalendarIds = new Set((calendarResult?.data || []).map(calendar => calendar.id));
      const todayEvents = (eventResult?.data || []).filter(event => visibleCalendarIds.has(event.calendarId) && event.startDate === date).sort((left, right) => Number(right.allDay) - Number(left.allDay) || left.startTime.localeCompare(right.startTime));
      addDailyEventNotification(user.id, date, todayEvents.length, todayEvents.slice(0, 3).map(event => ({ time: event.allDay ? "All-day" : event.startTime, title: event.title })));
    }).catch(() => undefined);
  }, [user]);
  function go(nextScreen: Screen) { setProfilePageOpen(false); setScreen(nextScreen); if (nextScreen === "calendar") setSidebarCollapsed(true); }
  function update(next: AppData) { setData(next); void dataService.save(next); }
  function saveItem(kind: EntityKind, item: EntityItem) {
    const items = data![kind] as EntityItem[];
    const nextItems = items.some(current => current.id === item.id) ? items.map(current => current.id === item.id ? item : current) : [...items, item];
    update({ ...data!, [kind]: nextItems });
    setEditor(null);
  }
  async function deleteItem(kind: EntityKind, id: string) {
    if (!await ui.confirm("Xóa mục này?", "Bạn có chắc muốn xóa mục này?")) return;
    update({ ...data!, [kind]: (data![kind] as EntityItem[]).filter(item => item.id !== id) });
    setEditor(null);
    ui.toast("Đã xóa thành công");
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.clear();
    sessionStorage.clear();
    setAccountMenuOpen(false);
    setUser(null);
    setData(null);
  }
  async function refreshCurrentUser() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const result = await readJsonSafe<{ user?: AuthUser; member?: Member }>(response);
    if (!response.ok || !result?.user) return null;
    const nextUser = { ...result.user, member: result.member || result.user.member };
    setUser(nextUser);
    if (result.member) setData(current => current ? { ...current, members: current.members.map(member => member.id === result.member!.id ? result.member! : member) } : current);
    return nextUser;
  }
  if (user === undefined) return <LoadingSkeleton />;
  if (!user) return <LoginScreen onLogin={setUser} />;
  if (!data) return <LoadingSkeleton />;

  const currentMember = data.members.find(member => member.id === user.memberId) || user.member;
  const headerUser = user.member ? user : currentMember ? { ...user, member: currentMember } : user;
  const content = children ? <>{children}</> : profilePageOpen ? <ProfilePage user={headerUser} member={currentMember} data={data} update={update} openChangePassword={() => setChangePasswordOpen(true)} logout={logout} savedUser={setUser} refreshCurrentUser={refreshCurrentUser} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} t={t} /> :
    screen === "dashboard" ? <Dashboard data={data} go={go} notifications={notifications} user={user} /> :
    screen === "members" ? <Members data={data} user={user} update={update} /> :
    screen === "tasks" ? <Tasks data={data} update={update} open={setEditor} t={t} /> :
    screen === "finance" ? <Finance data={data} open={setEditor} t={t} user={user} update={update} /> :
    screen === "chat" ? <ComingSoonModule title={t("chat")} /> :
    screen === "calendar" ? <Calendar data={data} user={user} /> :
    screen === "notes" ? <Notes data={data} open={setEditor} t={t} /> :
    screen === "notifications" ? <NotificationsView user={user} notifications={notifications} setNotifications={setNotifications} /> :
    <Settings user={user} onLogout={logout} openProfile={() => setProfilePageOpen(true)} openChangePassword={() => setChangePasswordOpen(true)} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} updateData={setData} t={t} />;

  return <main className={`min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] transition-[padding-left] duration-300 pb-[100px] md:pb-0 ${sidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"}`}>
    <MobileNav screen={screen} profileOpen={profilePageOpen} go={go} openProfile={() => setProfilePageOpen(true)} t={t} />
    <Sidebar screen={screen} go={go} t={t} collapsed={sidebarCollapsed} toggle={() => setSidebarCollapsed(collapsed => !collapsed)} />
    <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-nav)] px-3 py-2 backdrop-blur md:px-6 md:py-3">
      <div className={`mx-auto flex items-center gap-2 md:gap-3 ${screen === "calendar" ? "max-w-none" : "max-w-[1600px]"}`}>
        <label className="relative w-full max-w-md block"><span className="absolute inset-y-0 left-3 grid place-items-center text-slate-400"><SearchIcon /></span><input placeholder="Tìm kiếm..." className="h-10 w-full rounded-full border border-[var(--app-border)] bg-slate-50 dark:bg-white/5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 md:h-11" /></label>
        <div className="relative ml-auto flex items-center gap-1 md:gap-2">
          <button aria-label="Đổi giao diện sáng tối" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="hidden md:grid size-10 place-items-center rounded-full border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5 md:size-11"><ThemeIcon dark={theme === "dark"} /></button>
          <button aria-label="Thông báo" onClick={() => go("notifications")} className="hidden md:grid relative size-10 place-items-center rounded-full border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5 md:size-11"><BellIcon />{notifications.some(item => isCalendarNotificationUnread(item, user)) && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{notifications.filter(item => isCalendarNotificationUnread(item, user)).length}</span>}</button>
          <button aria-label="Mở menu tài khoản" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)} className="hidden md:flex items-center gap-1 rounded-full p-1 text-left hover:bg-slate-50 dark:hover:bg-white/5 md:gap-2">
            <span className="grid size-9 overflow-hidden rounded-full bg-indigo-500 text-sm font-bold text-white shadow-sm md:size-10"><AccountAvatar user={headerUser} /></span><span className="max-w-24 truncate text-sm font-medium hidden sm:block md:max-w-32">{headerUser.displayName}</span><span className="hidden sm:block"><ChevronDownIcon /></span>
          </button>
          {accountMenuOpen && <AccountMenu user={headerUser} openProfile={() => { setAccountMenuOpen(false); setProfilePageOpen(true); }} openSettings={() => { setAccountMenuOpen(false); setProfilePageOpen(false); setScreen("settings"); }} logout={logout} />}
        </div>
      </div>
    </header>
    <InstallPromptBanner promptEvent={installPrompt} dismissed={installDismissed} onDismiss={() => { setInstallDismissed(true); localStorage.setItem("pwaInstallDismissed", "true"); }} />
    <section className={`mx-auto ${profilePageOpen ? "px-0 py-0 md:px-8 md:py-8" : "px-4 py-4 md:px-8 md:py-8"} ${screen === "calendar" ? "max-w-none px-2 md:px-4" : "max-w-[1600px]"}`}>{!children && screen !== "members" && screen !== "calendar" && <div className={`mb-4 md:mb-5 ${profilePageOpen ? "hidden md:block" : "block"}`}><h1 className="text-xl md:text-2xl font-semibold">{profilePageOpen ? "Hồ sơ cá nhân" : t(titleKey[screen])}</h1><p className="mt-1 text-xs md:text-sm text-slate-400">Family Hub / {profilePageOpen ? "Hồ sơ cá nhân" : t(titleKey[screen])}</p></div>}{content}</section>
    {editor && <EditorSheet key={`${editor.kind}:${editor.item?.id ?? "new"}`} editor={editor} actor={user} members={data.members} close={() => setEditor(null)} save={saveItem} remove={deleteItem} />}
    {changePasswordOpen && <ChangePasswordSheet close={() => setChangePasswordOpen(false)} saved={async user => { setUser(user); await refreshCurrentUser(); }} />}
  </main>;
}
function visibleDataFor(user: AuthUser, data: AppData) {
  return user.role === "self_only" ? { ...data, members: data.members.filter(member => member.id === user.memberId) } : data;
}

function AccountAvatar({ user, size = "size-10" }: { user: any; size?: string }) {
  const displayName = user.member?.name || user.displayName || "?";
  const avatar = user.member?.avatar || user.avatar || user.profileImage || user.image || user.avatarUrl;
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [avatar]);
  if (avatar && !error) return <Image unoptimized width={96} height={96} src={avatar} className={`${size} shrink-0 rounded-full object-cover`} alt={displayName} onError={() => setError(true)} />;
  return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-200`}>{displayName[0]?.toUpperCase() || "?"}</span>;
}

function AccountMenu({ user, openProfile, openSettings, logout }: { user: AuthUser; openProfile: () => void; openSettings: () => void; logout: () => void }) {
  const menuClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5";
  return <div className="absolute right-0 top-14 z-40 w-72 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-xl">
    <div className="flex items-center gap-3 border-b border-[var(--app-border)] px-2 pb-3"><AccountAvatar user={user} /><div className="min-w-0"><b className="block truncate text-sm">{user.displayName}</b><p className="mt-1 truncate text-xs text-slate-400">{user.username} · {accessLabel(user.role)}</p></div></div>
    <div className="space-y-1 border-b border-[var(--app-border)] py-3">
      <button onClick={openProfile} className={menuClass}><UserIcon /> Hồ sơ cá nhân</button>
      <button onClick={openSettings} className={menuClass}><SettingsIcon /> Cài đặt tài khoản</button>
    </div>
    <button onClick={logout} className={`${menuClass} mt-3 text-rose-500`}><LogoutIcon /> Đăng xuất</button>
    </div>;
}

function ProfilePage({ user, member, data, update, openChangePassword, logout, savedUser, refreshCurrentUser, language, setLanguage, theme, setTheme, t }: { user: AuthUser; member?: Member; data: AppData; update: (data: AppData) => void; openChangePassword: () => void; logout: () => void; savedUser: (user: AuthUser) => void; refreshCurrentUser: () => Promise<AuthUser | null>; language?: Language; setLanguage?: React.Dispatch<React.SetStateAction<Language>>; theme?: "light" | "dark" | "system"; setTheme?: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>; t?: any }) {
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const ui = useUI();

  const activeMember = member || user.member;
  const displayName = activeMember?.name || user.displayName || user.username;
  const displayAvatar = activeMember?.avatarUrl || activeMember?.avatar || user.avatar;
  const profileUser = { ...user, displayName, avatar: displayAvatar, member: activeMember };

  const syncProfile = (nextUser: AuthUser, nextMember?: Member | null) => {
    const syncedMember = nextMember || nextUser.member;
    savedUser({ ...nextUser, member: syncedMember || nextUser.member });
    if (syncedMember) update({ ...data, members: data.members.map(item => item.id === syncedMember.id ? syncedMember : item) });
  };

  async function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas error");
          
          let { width, height } = img;
          const max = 500;
          if (width > max || height > max) {
            if (width > height) { height = Math.round((height * max) / width); width = max; }
            else { width = Math.round((width * max) / height); height = max; }
          }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject("Image load error");
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject("File read error");
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return ui.toast("Vui lòng chọn file hình ảnh", "error");
    
    try {
      ui.toast("Đang xử lý ảnh...", "success");
      const base64 = await compressImage(file);
      
      const payload = {
        avatar: base64, 
        avatarUrl: base64, 
        displayName: displayName || "Quản trị viên",
        name: activeMember?.name || displayName || "Quản trị viên",
        nickname: activeMember?.nickname || "",
        phone: activeMember?.phone || "",
        birthday: activeMember?.birthday || null,
        gender: activeMember?.gender || "",
        notes: activeMember?.notes || ""
      };

      const response = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await readJsonSafe<{ user?: AuthUser; error?: string }>(response);
      
      if (response.ok && result?.user) {
        savedUser(result.user);
        await refreshCurrentUser();
        ui.toast("Đã cập nhật ảnh đại diện", "success");
      } else {
        console.error("Avatar upload error:", result?.error);
        ui.toast(result?.error || "Lỗi khi cập nhật ảnh đại diện", "error");
      }
    } catch (e) {
      console.error(e);
      ui.toast("Lỗi xử lý ảnh", "error");
    }
  }

  async function handleAvatarDelete() {
    if (!await ui.confirm("Xóa ảnh đại diện?", "Bạn có chắc chắn muốn xóa ảnh đại diện hiện tại?")) return;
    const response = await fetch("/api/auth/avatar", { method: "DELETE" });
    if (response.ok) {
      savedUser({ ...user, avatar: "", member: activeMember ? { ...activeMember, avatar: "", avatarUrl: "" } : undefined });
      await refreshCurrentUser();
      ui.toast("Đã xóa ảnh đại diện", "success");
    } else {
      ui.toast("Lỗi khi xóa ảnh đại diện", "error");
    }
  }

  return <div className="mx-auto max-w-md pb-8">
    {/* Profile Card (Header) */}
    <div className="flex flex-col items-center bg-white px-4 py-8 dark:bg-slate-900 md:rounded-b-3xl shadow-sm mb-3 md:mb-6">
      <div className="relative mb-4">
        <span className="grid size-28 overflow-hidden rounded-full bg-indigo-50 text-4xl font-bold text-indigo-500 shadow-md ring-4 ring-slate-50 dark:bg-indigo-500/20 dark:text-indigo-400 dark:ring-slate-800">
          <AccountAvatar user={profileUser} size="size-full object-cover object-center" />
        </span>
        <label className="absolute bottom-0 right-0 grid size-8 cursor-pointer place-items-center rounded-full bg-slate-100 text-slate-700 shadow-sm ring-2 ring-white hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900">
          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </label>
        {displayAvatar && <button onClick={handleAvatarDelete} className="absolute -left-1 top-0 grid size-7 cursor-pointer place-items-center rounded-full bg-slate-100 text-rose-500 shadow-sm ring-2 ring-white hover:bg-rose-50 dark:bg-slate-800 dark:ring-slate-900"><svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>}
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{displayName}</h2>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{accessLabel(user.role)}</p>
    </div>

    {/* Zalo-style Settings List */}
    <div className="space-y-4 px-4">
      {/* Group 1 */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[var(--app-card)]">
        <button onClick={() => setProfileEditorOpen(true)} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-50 dark:active:bg-white/5 border-b border-slate-100 dark:border-white/5">
          <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200"><span className="text-indigo-500"><UserIcon /></span>Thông tin cá nhân</span>
          <span className="text-slate-400">›</span>
        </button>
        <button onClick={() => setActivityOpen(true)} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-50 dark:active:bg-white/5 border-b border-slate-100 dark:border-white/5">
          <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200"><span className="text-indigo-500"><NotesIcon /></span>Lịch sử hoạt động</span>
          <span className="text-slate-400">›</span>
        </button>
        <button onClick={openChangePassword} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-50 dark:active:bg-white/5">
          <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200"><span className="text-indigo-500"><LockIcon /></span>Đổi mật khẩu</span>
          <span className="text-slate-400">›</span>
        </button>
      </div>

      {/* Group 2 */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[var(--app-card)]">
        {language && setLanguage && t && (
          <button onClick={() => setLanguageSheetOpen(true)} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-50 dark:active:bg-white/5 border-b border-slate-100 dark:border-white/5">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200"><span className="text-indigo-500">🌐</span>Ngôn ngữ</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{language === "vi" ? "Tiếng Việt" : language === "en" ? "English" : "日本語"}</span>
              <span className="text-slate-400">›</span>
            </div>
          </button>
        )}
        {theme && setTheme && t && (
          <button onClick={() => setThemeSheetOpen(true)} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-slate-50 dark:active:bg-white/5">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200"><span className="text-indigo-500"><ThemeIcon dark={theme==="dark"} /></span>Giao diện</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{theme === "light" ? "Sáng" : theme === "dark" ? "Tối" : "Theo hệ thống"}</span>
              <span className="text-slate-400">›</span>
            </div>
          </button>
        )}
      </div>

      {/* Group 3: Logout */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[var(--app-card)]">
        <button onClick={() => setLogoutConfirmOpen(true)} className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-rose-50 dark:active:bg-rose-500/10">
          <span className="flex items-center gap-3 text-sm font-medium text-rose-500"><span className="text-rose-500"><LogoutIcon /></span>Đăng xuất</span>
        </button>
      </div>
    </div>

    {profileEditorOpen && <ProfileSheet user={profileUser} close={() => setProfileEditorOpen(false)} saved={syncProfile} refreshCurrentUser={refreshCurrentUser} profileSaved={(profile, nextMember) => syncProfile(profile, nextMember)} />}
    
    {activityOpen && <Sheet close={() => setActivityOpen(false)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Nhật ký hoạt động</h2>
        <button onClick={() => setActivityOpen(false)} className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">✕</button>
      </div>
      <div className="space-y-3 text-sm text-slate-500">
        <div className="rounded-xl border border-[var(--app-border)] p-4"><b className="text-[var(--app-foreground)]">Hồ sơ đang hoạt động</b><p className="mt-1">Phiên hiện tại đã được đồng bộ với hồ sơ thành viên liên kết.</p></div>
        <div className="rounded-xl border border-[var(--app-border)] p-4"><b className="text-[var(--app-foreground)]">Tài khoản đăng nhập</b><p className="mt-1">{user.username} · {accessLabel(user.role)}</p></div>
      </div>
    </Sheet>}

    {logoutConfirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={() => setLogoutConfirmOpen(false)}>
        <div onMouseDown={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-[var(--app-card)] p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Đăng xuất</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này?</p>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setLogoutConfirmOpen(false)} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">Hủy</button>
            <button onClick={() => { setLogoutConfirmOpen(false); logout(); }} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">Đăng xuất</button>
          </div>
        </div>
      </div>
    )}

    {languageSheetOpen && setLanguage && (
      <Sheet close={() => setLanguageSheetOpen(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Ngôn ngữ</h2>
          <button onClick={() => setLanguageSheetOpen(false)} className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">✕</button>
        </div>
        <div className="space-y-2">
          {[{ id: "vi", label: "Tiếng Việt" }, { id: "en", label: "English" }, { id: "ja", label: "日本語" }].map(item => (
            <button key={item.id} onClick={() => { setLanguage(item.id as Language); setLanguageSheetOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <span className={`text-sm font-medium ${language === item.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>{item.label}</span>
              {language === item.id && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
    )}

    {themeSheetOpen && setTheme && (
      <Sheet close={() => setThemeSheetOpen(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Giao diện</h2>
          <button onClick={() => setThemeSheetOpen(false)} className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">✕</button>
        </div>
        <div className="space-y-2">
          {[{ id: "system", label: "Theo hệ thống" }, { id: "light", label: "Sáng" }, { id: "dark", label: "Tối" }].map(item => (
            <button key={item.id} onClick={() => { setTheme(item.id as "light" | "dark" | "system"); setThemeSheetOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <span className={`text-sm font-medium ${theme === item.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>{item.label}</span>
              {theme === item.id && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
    )}
  </div>;
}

function SystemAdminProfile({ user, openChangePassword, logout, savedUser, refreshCurrentUser }: { user: AuthUser; openChangePassword: () => void; logout: () => void; savedUser: (user: AuthUser) => void; refreshCurrentUser: () => Promise<AuthUser | null> }) {
  const [form, setForm] = useState({ displayName: user.displayName || "Quản trị viên", email: "", avatar: user.avatar || "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(true);
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  useEffect(() => {
    void fetch("/api/auth/profile").then(async response => {
      const result = await readJsonSafe<{ user?: ProfileUser }>(response);
      if (response.ok && result?.user) setForm({ displayName: result.user.displayName || "Quản trị viên", email: result.user.email || "", avatar: result.user.avatar || "" });
    }).catch(() => undefined);
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await readJsonSafe<{ error?: string; user?: AuthUser }>(response);
    if (!response.ok || !result?.user) return setError(result?.error || "Không thể lưu hồ sơ tài khoản.");
    savedUser(result.user); await refreshCurrentUser(); setMessage("Đã lưu hồ sơ tài khoản hệ thống.");
  }
  const actionClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5";
  return <div className="max-w-2xl space-y-5"><Card className="overflow-visible p-6"><div className="flex items-start gap-4"><AccountAvatar user={{ avatar: form.avatar, displayName: form.displayName || "Quản trị viên" }} size="size-16" /><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold">{form.displayName || "Quản trị viên"}</h2><p className="mt-1 text-sm text-slate-400">Tài khoản hệ thống</p></div><div className="relative"><button type="button" onClick={() => setMoreOpen(open => !open)} className="grid size-10 place-items-center rounded-lg border border-[var(--app-border)] text-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5" aria-label="Thao tác hồ sơ" aria-expanded={moreOpen}>⋮</button>{moreOpen && <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-2 shadow-xl"><button type="button" onClick={() => { setMoreOpen(false); setEditOpen(true); }} className={actionClass}><UserIcon /> Chỉnh sửa hồ sơ</button><button type="button" onClick={() => { setMoreOpen(false); openChangePassword(); }} className={actionClass}><LockIcon /> Đổi mật khẩu</button><button type="button" onClick={logout} className={`${actionClass} text-rose-500`}><LogoutIcon /> Đăng xuất</button></div>}</div></div><div className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><AccountDetail label="Username" value={user.username || "admin"} /><AccountDetail label="Quyền" value="Toàn quyền" /><AccountDetail label="Trạng thái" value="Đang hoạt động" /><AccountDetail label="Loại tài khoản" value="Tài khoản hệ thống" /></div></Card>{editOpen && <Card className="p-6"><h3 className="font-semibold">Hồ sơ tài khoản</h3><form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Tên hiển thị"><input required className={inputClass} value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></Field><Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field><Field label="Avatar URL"><input className={inputClass} value={form.avatar} onChange={event => setForm(current => ({ ...current, avatar: event.target.value }))} /></Field>{error && <p className="text-sm text-rose-500 md:col-span-2">{error}</p>}{message && <p className="text-sm text-emerald-500 md:col-span-2">{message}</p>}<div className="flex flex-wrap gap-2 md:col-span-2"><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Lưu hồ sơ</button><button type="button" onClick={logout} className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-500">Đăng xuất</button></div></form></Card>}</div>;
}
function AccountDetail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }

function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotAccount, setForgotAccount] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, remember }) });
      const result = await readJsonSafe<{ error?: string; user?: AuthUser }>(response);
      if (!response.ok || !result?.user) throw new Error(result?.error || "Không thể đăng nhập. Vui lòng thử lại.");
      onLogin(result.user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đăng nhập."); }
    finally { setLoading(false); }
  }
  async function requestPasswordReset(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setForgotMessage("");
    try {
      const response = await fetch("/api/auth/password-reset-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernameOrEmail: forgotAccount }) });
      const result = await readJsonSafe<{ error?: string; message?: string }>(response);
      if (!response.ok || !result?.message) throw new Error(result?.error || "Không thể gửi yêu cầu. Vui lòng thử lại.");
      setForgotMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu."); }
    finally { setLoading(false); }
  }
  return <AuthLayout>{forgot ? <form onSubmit={requestPasswordReset} className="w-full max-w-md">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-500">Family Hub</p><h1 className="mt-4 text-3xl font-semibold text-slate-800 dark:text-white">Quên mật khẩu</h1><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Nhập username hoặc email để gửi yêu cầu đặt lại mật khẩu nội bộ. Admin hoặc Cha/Mẹ sẽ xử lý yêu cầu trong ứng dụng.</p>
    <div className="mt-7"><Field label="Tài khoản hoặc email"><input required autoComplete="username" className={authInputClass} placeholder="Nhập username hoặc email" value={forgotAccount} onChange={event => setForgotAccount(event.target.value)} /></Field></div>
    {forgotMessage && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10">{forgotMessage}</p>}{error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-400/20 dark:bg-red-400/10">{error}</p>}
    <button disabled={loading} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{loading ? "Đang gửi..." : "Gửi yêu cầu"}</button><button type="button" onClick={() => { setForgot(false); setError(""); setForgotMessage(""); }} className="mt-4 w-full text-sm font-semibold text-indigo-600 hover:text-indigo-700">Quay lại đăng nhập</button>
  </form> : <form onSubmit={submit} className="w-full max-w-md">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-500">Family Hub</p><h1 className="mt-4 text-3xl font-semibold text-slate-800 dark:text-white">Đăng nhập gia đình</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Đăng nhập để truy cập dữ liệu nội bộ.</p>
    <div className="mt-7 space-y-5"><Field label="Tài khoản hoặc email"><input required autoComplete="username" className={authInputClass} placeholder="Nhập username hoặc email" value={username} onChange={event => setUsername(event.target.value)} /></Field><Field label="Mật khẩu"><div className="relative"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" className={`${authInputClass} pr-12`} placeholder="Nhập mật khẩu" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword(visible => !visible)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-indigo-500"><PasswordEyeIcon visible={showPassword} /></button></div></Field><div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} className="size-4 rounded border-slate-300 accent-indigo-600" /> Ghi nhớ đăng nhập trên thiết bị này</label><button type="button" onClick={() => { setForgot(true); setError(""); }} className="shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Quên mật khẩu?</button></div></div>
    {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-400/20 dark:bg-red-400/10">{error}</p>}<button disabled={loading} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
  </form>}</AuthLayout>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-white text-[var(--app-foreground)] dark:bg-slate-950"><div className="grid min-h-screen lg:grid-cols-2"><section className="grid place-items-center px-5 py-10 sm:px-10 lg:px-16">{children}</section><aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 lg:grid lg:place-items-center"><div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.25)_1px,transparent_1px)] [background-size:24px_24px]" /><div className="relative max-w-md px-10 text-center text-white"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-white/20">FH</div><p className="mt-7 text-sm font-bold uppercase tracking-[.3em] text-indigo-300">Family Hub</p><h2 className="mt-3 text-4xl font-semibold">Family Hub</h2><p className="mt-5 leading-7 text-slate-300">Quản lý gia đình, công việc, thu chi, lịch và ghi chú nội bộ.</p></div></aside></div></main>;
}

const authInputClass = "h-12 w-full rounded-lg border border-slate-200 bg-transparent px-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-white/[.03]";

function PasswordEyeIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
    {visible && <path strokeLinecap="round" d="m4 4 16 16" />}
  </svg>;
}

function PasswordField({ label, value, setValue, autoComplete, required = true }: { label: string; value: string; setValue: (value: string) => void; autoComplete: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  return <Field label={label}><div className="relative"><input required={required} type={visible ? "text" : "password"} autoComplete={autoComplete} className={`${inputClass} pr-12`} value={value} onChange={event => setValue(event.target.value)} /><button type="button" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setVisible(current => !current)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-rose-500"><PasswordEyeIcon visible={visible} /></button></div></Field>;
}

function ChangePasswordSheet({ close, saved }: { close: () => void; saved: (user: AuthUser) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event?: React.FormEvent | React.MouseEvent) {
    if (event) event.preventDefault(); setError(""); setSuccess("");
    if (newPassword.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (newPassword !== confirmPassword) return setError("Nhập lại mật khẩu mới chưa khớp.");
    if (newPassword === currentPassword) return setError("Mật khẩu mới không được trùng mật khẩu hiện tại.");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const result = await readJsonSafe<{ error?: string; user?: AuthUser }>(response);
      if (!response.ok || !result?.user) throw new Error(result?.error || "Không thể đổi mật khẩu. Vui lòng thử lại.");
      addAccountPasswordNotification(result.user.id, "Bạn đã đổi mật khẩu thành công.", { id: result.user.id, name: result.user.displayName, avatar: result.user.avatar });
      saved(result.user); setSuccess("Đổi mật khẩu thành công."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu."); }
    finally { setLoading(false); }
  }
  return <FullScreenMobileSheet title="Đổi mật khẩu" close={close} onSubmit={submit} loading={loading}>
    <form onSubmit={submit} className="p-4 md:p-0">
      <p className="mb-4 text-sm text-slate-400">Mật khẩu mới cần ít nhất 6 ký tự.</p>
      <div className="space-y-4">
        <PasswordField label="Mật khẩu hiện tại" value={currentPassword} setValue={setCurrentPassword} autoComplete="current-password" />
        <PasswordField label="Mật khẩu mới" value={newPassword} setValue={setNewPassword} autoComplete="new-password" />
        <PasswordField label="Nhập lại mật khẩu mới" value={confirmPassword} setValue={setConfirmPassword} autoComplete="new-password" />
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {success && <p className="mt-3 text-sm font-bold text-emerald-500">{success}</p>}
      <div className="mt-6 hidden md:flex gap-3">
        <button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Đóng</button>
        <button disabled={loading} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Đang lưu..." : "Đổi mật khẩu"}</button>
      </div>
    </form>
  </FullScreenMobileSheet>;
}

export function ProfileSheet({ user, close, saved, profileSaved, refreshCurrentUser }: { user: AuthUser; close: () => void; saved: (user: AuthUser) => void; profileSaved?: (user: AuthUser, member?: Member | null) => void; refreshCurrentUser?: () => Promise<AuthUser | null> }) {
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ displayName: user.displayName, email: "", avatar: user.avatar, memberId: user.memberId || "", name: "", nickname: "", phone: "", birthday: "", gender: "", notes: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [genderSheetOpen, setGenderSheetOpen] = useState(false);
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  useEffect(() => { 
    void fetch("/api/auth/profile").then(async response => { 
      const result = await readJsonSafe<{ error?: string; user?: ProfileUser }>(response); 
      if (!response.ok || !result?.user) throw new Error(result?.error || "Không thể tải hồ sơ."); 
      setProfile(result.user); 
      setForm({ displayName: result.user.displayName, email: result.user.email || "", avatar: result.user.avatar || "", memberId: result.user.memberId || "", name: result.user.member?.name || "", nickname: result.user.member?.nickname || "", phone: result.user.member?.phone || "", birthday: result.user.member?.birthday || "", gender: result.user.member?.gender || "", notes: result.user.member?.notes || "" }); 
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Không thể tải hồ sơ."));
    if (user.role === "full_access") {
      void fetch("/api/members").then(async response => {
        const json = await response.json();
        const members = Array.isArray(json) ? json : (json.data ?? []);
        if (response.ok) setMembers(members);
      });
    }
  }, [user.role]);
  async function submit(event?: React.FormEvent | React.MouseEvent) {
    if (event) event.preventDefault(); setLoading(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await readJsonSafe<{ error?: string; profile?: ProfileUser; user?: AuthUser }>(response);
      if (!response.ok || !result?.profile || !result.user) throw new Error(result?.error || "Không thể cập nhật hồ sơ.");
      const refreshedUser = await refreshCurrentUser?.();
      const nextMember = ((refreshedUser?.member || result.profile.member || null) as Member | null);
      const nextUser = refreshedUser || { ...result.user, displayName: result.profile.displayName, avatar: result.profile.avatar, email: result.profile.email, member: nextMember || undefined };
      setProfile(result.profile);
      if (profileSaved) profileSaved(nextUser, nextMember);
      else saved(nextUser);
      setSuccess("Đã cập nhật hồ sơ cá nhân.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ."); }
    finally { setLoading(false); }
  }
  return <FullScreenMobileSheet title="Thông tin cá nhân" close={close} onSubmit={submit} loading={loading}>
    <form onSubmit={submit} className="p-4 md:p-0">
      <div className="flex items-center gap-3">
        <AccountAvatar user={{ avatar: form.avatar, displayName: form.displayName }} size="size-16" />
        <div><b>{form.displayName || user.username}</b><p className="text-xs text-slate-400">{profile?.username ?? user.username} · {accessLabel(profile?.role ?? user.role)}</p></div>
      </div>
      <div className="mt-5 space-y-4">
        <Field label="Username"><input disabled className={inputClass} value={profile?.username ?? user.username} readOnly /></Field>
        {profile?.memberId ? <>
          <Field label="Họ tên"><input required className={inputClass} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Biệt danh"><input className={inputClass} value={form.nickname} onChange={event => setForm(current => ({ ...current, nickname: event.target.value }))} /></Field>
          <Field label="Email (Tài khoản)"><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field>
          <Field label="Số điện thoại"><input type="tel" className={inputClass} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></Field>
          <BirthdaySelect value={form.birthday} onChange={value => setForm(current => ({...current, birthday: value}))} />
          <Field label="Giới tính">
            <button type="button" onClick={() => setGenderSheetOpen(true)} className={`${inputClass} flex items-center justify-between text-left`}>
              <span>{form.gender === "male" ? "Nam" : form.gender === "female" ? "Nữ" : form.gender === "other" ? "Khác" : "Chưa chọn"}</span>
              <span className="text-slate-400">›</span>
            </button>
          </Field>
          <Field label="Avatar URL"><input className={inputClass} value={form.avatar} onChange={event => setForm(current => ({ ...current, avatar: event.target.value }))} /></Field>
          <Field label="Ghi chú"><textarea rows={3} className={inputClass} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></Field>
        </> : <>
          <Field label="Tên hiển thị"><input required className={inputClass} value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field>
          <Field label="Avatar URL"><input className={inputClass} value={form.avatar} onChange={event => setForm(current => ({ ...current, avatar: event.target.value }))} /></Field>
          {user.role === "full_access" && <Field label="Liên kết thành viên"><select className={inputClass} value={form.memberId} onChange={event => setForm(current => ({ ...current, memberId: event.target.value }))}><option value="">Chưa liên kết</option>{members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></Field>}
        </>}
        <Field label="Quyền hệ thống"><input disabled className={inputClass} value={accessLabel(profile?.role ?? user.role)} readOnly /></Field>
        <Field label="Trạng thái"><input disabled className={inputClass} value={profile?.active === false ? "Đã tắt" : "Đang hoạt động"} readOnly /></Field>
        {profile?.createdAt && <Field label="Ngày tạo tài khoản"><input disabled className={inputClass} value={new Date(profile.createdAt).toLocaleString("vi-VN")} readOnly /></Field>}
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {success && <p className="mt-3 text-sm font-bold text-emerald-500">{success}</p>}
      <div className="mt-6 hidden md:flex gap-3">
        <button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Đóng</button>
        <button disabled={loading} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Đang lưu..." : "Lưu hồ sơ"}</button>
      </div>
    </form>
    {genderSheetOpen && (
      <Sheet close={() => setGenderSheetOpen(false)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Giới tính</h2>
          <button onClick={() => setGenderSheetOpen(false)} className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">✕</button>
        </div>
        <div className="space-y-2">
          {[{ id: "male", label: "Nam" }, { id: "female", label: "Nữ" }, { id: "other", label: "Khác" }].map(item => (
            <button key={item.id} onClick={() => { setForm(current => ({ ...current, gender: item.id })); setGenderSheetOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <span className={`text-sm font-medium ${form.gender === item.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}>{item.label}</span>
              {form.gender === item.id && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </Sheet>
    )}
  </FullScreenMobileSheet>;
}

function FullScreenMobileSheet({ close, children, title, onSubmit, loading }: { close: () => void; children: React.ReactNode; title: string; onSubmit?: (e: React.FormEvent | React.MouseEvent) => void; loading?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}>
    <div onMouseDown={e => e.stopPropagation()} className="flex h-[100dvh] md:h-auto w-full flex-col overflow-hidden bg-[var(--app-background)] md:max-h-[90vh] md:max-w-lg md:rounded-3xl">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-nav)] px-4">
        <button type="button" onClick={close} className="grid size-8 place-items-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">✕</button>
        <h2 className="text-[17px] font-bold truncate px-2">{title}</h2>
        {onSubmit ? (
          <button onClick={onSubmit} disabled={loading} className="text-[15px] font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300">Lưu</button>
        ) : <div className="size-8" />}
      </div>
      <div className="flex-1 overflow-y-auto bg-[var(--app-card)] md:p-0">
        {children}
      </div>
    </div>
  </div>;
}

function Sheet({ close, children }: { close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 md:max-w-lg md:rounded-3xl">{children}</div></div>;
}

function UserEditor({ user, close, saved, presetMemberId = "" }: { user: ManagedUser | "new"; close: () => void; saved: () => void; presetMemberId?: string }) {
  const existing = user === "new" ? null : user;
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: existing?.username ?? "", email: existing?.email ?? "", displayName: existing?.displayName ?? "", avatar: existing?.avatar ?? "", role: existing?.role ?? "self_only" as UserRole, memberId: existing?.memberId ?? presetMemberId, active: existing?.active ?? true, password: "" });
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  useEffect(() => { void fetch("/api/members").then(async response => { const json = await response.json(); const members = Array.isArray(json) ? json : (json.data ?? []); if (response.ok) setMembers(members); }); }, []);
  const set = (key: string, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/users", { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: existing?.id }) });
      const result = await readJsonSafe<{ ok?: boolean; error?: string; message?: string }>(response);
      console.log("CREATE USER STATUS", response.status, result);
      if (!response.ok) return setError(result?.error || result?.message || "Không thể tạo user.");
      if (!result?.ok) return setError(result?.error || "Không thể tạo user.");
      setSuccess(existing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản.");
      setTimeout(saved, 500);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể kết nối máy chủ."); }
    finally { setLoading(false); }
  }
  const roles: UserRole[] = ["full_access", "self_only"];
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 md:max-w-lg md:rounded-3xl"><h2 className="text-lg font-bold">{existing ? "Sửa tài khoản" : "Thêm tài khoản"}</h2><div className="mt-5 space-y-4"><Field label="Username"><input required disabled={Boolean(existing)} className={inputClass} value={form.username} onChange={event => set("username", event.target.value)} /></Field><Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={event => set("email", event.target.value)} /></Field><Field label="Tên hiển thị"><input required className={inputClass} value={form.displayName} onChange={event => set("displayName", event.target.value)} /></Field><Field label="Avatar URL"><input type="url" className={inputClass} value={form.avatar} onChange={event => set("avatar", event.target.value)} /></Field><Field label="Quyền hệ thống"><select disabled={Boolean(existing?.isSystem)} className={inputClass} value={form.role} onChange={event => set("role", event.target.value)}>{roles.map(role => <option key={role} value={role}>{accessLabel(role)}</option>)}</select></Field><Field label="Liên kết thành viên"><select className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}><option value="">Chưa liên kết</option>{members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></Field>{existing?.isSystem && <p className="text-xs font-semibold text-indigo-500">Admin hệ thống có thể liên kết hồ sơ thành viên nhưng không thể bỏ liên kết khi đã có hồ sơ.</p>}{!existing && <Field label="Mật khẩu tạm"><input required minLength={6} type="password" className={inputClass} value={form.password} onChange={event => set("password", event.target.value)} /></Field>}{existing && !existing.isSystem && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /> Tài khoản đang hoạt động</label>}{existing?.isSystem && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked disabled /> Tài khoản đang hoạt động</label>}</div>{error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}{success && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{success}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Hủy</button><button disabled={loading} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Đang lưu..." : "Lưu"}</button></div></form></div>;
}

function LoginAccountTab({ account, member, actor, canManage, isCurrent, savedUser, refreshed }: { account: ManagedUser | null; member: Member; actor: AuthUser; canManage: boolean; isCurrent: boolean; savedUser: (user: AuthUser) => void; refreshed: () => void }) {
  const ui = useUI();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editType, setEditType] = useState<'none' | 'account' | 'password'>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";

  const [form, setForm] = useState({
    username: account?.username || "",
    role: account?.role || ("self_only" as UserRole),
    active: account?.active ?? true,
    newPassword: "",
    confirmPassword: "",
    currentPassword: ""
  });

  const systemLocked = Boolean(account?.isSystem);
  const set = (key: keyof typeof form, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));

  async function submitAdmin() {
    if (!canManage) return;
    if (!account) {
      if (form.newPassword.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
      if (form.newPassword !== form.confirmPassword) return setError("Nhập lại mật khẩu mới chưa khớp.");
    }
    const payload = account 
      ? { ...account, username: form.username, role: form.role, active: form.active, memberId: member.id } 
      : { username: form.username, role: form.role, active: true, memberId: member.id, password: form.newPassword, displayName: member.nickname || member.name };
    
    const response = await fetch("/api/users", { 
      method: account ? "PUT" : "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    const result = await readJsonSafe<{ error?: string; user?: ManagedUser }>(response);
    if (!response.ok || !result?.user) return setError(result?.error || "Không thể lưu tài khoản.");
    setSuccess(account ? "Đã lưu tài khoản." : "Đã tạo tài khoản.");
    setEditType('none');
    refreshed();
  }

  async function submitSelf() {
    if (!account || !isCurrent) return;
    if (form.newPassword.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (form.newPassword !== form.confirmPassword) return setError("Nhập lại mật khẩu mới chưa khớp.");
    
    const response = await fetch("/api/auth/change-password", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ newPassword: form.newPassword }) 
    });
    const result = await readJsonSafe<{ error?: string; user?: AuthUser }>(response);
    if (!response.ok || !result?.user) return setError(result?.error || "Không thể đổi mật khẩu.");
    addAccountPasswordNotification(result.user.id, "Bạn đã đổi mật khẩu thành công.", { id: result.user.id, name: result.user.displayName, avatar: result.user.avatar });
    savedUser(result.user);
    setForm(current => ({ ...current, newPassword: "", confirmPassword: "" }));
    setSuccess("Đã đổi mật khẩu.");
    setEditType('none');
  }

  async function resetPassword() {
    if (!account || !canManage) return;
    if (form.newPassword.length < 6) return setError("Mật khẩu mới cần ít nhất 6 ký tự.");
    if (form.newPassword !== form.confirmPassword) return setError("Nhập lại mật khẩu mới chưa khớp.");
    const response = await fetch("/api/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: account.id, password: form.newPassword }) });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) return setError(result?.error || "Không thể reset mật khẩu.");
    addAccountPasswordNotification(account.id, "Quản trị viên đã đổi mật khẩu tài khoản của bạn.", { id: actor.id, name: actor.displayName, avatar: actor.avatar });
    setForm(current => ({ ...current, newPassword: "", confirmPassword: "" }));
    setSuccess("Đã đổi mật khẩu.");
    setEditType('none');
    refreshed();
  }

  async function deleteAccount() {
    if (!account || !canManage || account.isSystem || !await ui.confirm("Xóa liên kết tài khoản?", `Xác nhận xóa liên kết tài khoản ${account.username}?`)) return;
    const response = await fetch(`/api/users?id=${account.id}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) return setError(result?.error || "Không thể xóa tài khoản.");
    setSuccess("Đã xóa liên kết tài khoản.");
    setEditType('none');
    refreshed();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (editType === 'password') {
      if (canManage) {
        await resetPassword();
      } else {
        await submitSelf();
      }
    } else if (editType === 'account') {
      if (canManage) {
        await submitAdmin();
      } else {
        setSuccess("Đã lưu thay đổi.");
        setEditType('none');
      }
    }
  }

  const isAdmin = actor.role === "full_access";
  const showMenuButton = editType === 'none' && (account ? (canManage || isCurrent) : canManage);
  const canSeePassword = canManage || isCurrent;
  const displayPassword = account?.passwordPlain ? account.passwordPlain : "Không có dữ liệu mật khẩu gốc";

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tài khoản đăng nhập</h3>
        
        {editType !== 'none' ? (
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => { setEditType('none'); setError(""); setSuccess(""); }} 
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              form="account-form" 
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
            >
              {editType === 'password' ? 'Lưu mật khẩu' : 'Lưu thay đổi'}
            </button>
          </div>
        ) : (
          showMenuButton && (
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setMenuOpen(!menuOpen)} 
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" 
                aria-label="Thao tác tài khoản"
              >
                ⋮
              </button>
              
              {/* Mobile Dropdown Bottom Sheet */}
              {menuOpen && (
                <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:hidden" onClick={() => setMenuOpen(false)}>
                  <div className="w-full rounded-t-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />
                    <div className="space-y-1.5">
                      <button type="button" onClick={() => { setEditType(account ? 'account' : 'account'); setMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5">
                        {account ? "Sửa tài khoản" : "Tạo tài khoản"}
                      </button>
                      {account && (
                        <button type="button" onClick={() => { setEditType('password'); setMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Đổi mật khẩu</button>
                      )}
                      {account && canManage && !account.isSystem && (
                        <button type="button" onClick={() => { deleteAccount(); setMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa liên kết tài khoản</button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PC Dropdown Menu */}
              {menuOpen && (
                <div className="hidden sm:block">
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl">
                    <button type="button" onClick={() => { setEditType(account ? 'account' : 'account'); setMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">
                      {account ? "Sửa tài khoản" : "Tạo tài khoản"}
                    </button>
                    {account && (
                      <button type="button" onClick={() => { setEditType('password'); setMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Đổi mật khẩu</button>
                    )}
                    {account && canManage && !account.isSystem && (
                      <button type="button" onClick={() => { deleteAccount(); setMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa liên kết tài khoản</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {account?.isSystem && (
        <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 dark:bg-indigo-400/10">
          Đang liên kết với tài khoản hệ thống admin
        </p>
      )}

      {editType !== 'none' ? (
        <form id="account-form" onSubmit={handleSubmit} className="mt-5 space-y-4">
          {editType === 'account' && (
            <>
              <Field label="Tên đăng nhập">
                <input 
                  required 
                  disabled={!canManage || systemLocked} 
                  className={inputClass} 
                  value={form.username} 
                  onChange={event => set("username", event.target.value)} 
                />
              </Field>

              {!account && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PasswordField 
                    label="Mật khẩu" 
                    value={form.newPassword} 
                    setValue={value => set("newPassword", value)} 
                    autoComplete="new-password" 
                    required={true} 
                  />
                  <PasswordField 
                    label="Nhập lại mật khẩu mới" 
                    value={form.confirmPassword} 
                    setValue={value => set("confirmPassword", value)} 
                    autoComplete="new-password" 
                    required={true} 
                  />
                </div>
              )}

              {isAdmin && (
                <Field label="Quyền hệ thống">
                  <select 
                    disabled={systemLocked} 
                    className={inputClass} 
                    value={form.role} 
                    onChange={event => set("role", event.target.value as UserRole)}
                  >
                    <option value="full_access">Toàn quyền</option>
                    <option value="self_only">Chỉ xem chính mình</option>
                  </select>
                </Field>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input 
                  disabled={systemLocked || !canManage} 
                  type="checkbox" 
                  checked={systemLocked || form.active} 
                  onChange={event => set("active", event.target.checked)} 
                /> 
                Tài khoản hoạt động
              </label>
            </>
          )}

          {editType === 'password' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PasswordField 
                label="Mật khẩu mới" 
                value={form.newPassword} 
                setValue={value => set("newPassword", value)} 
                autoComplete="new-password" 
                required={true} 
              />
              <PasswordField 
                label="Nhập lại mật khẩu mới" 
                value={form.confirmPassword} 
                setValue={value => set("confirmPassword", value)} 
                autoComplete="new-password" 
                required={true} 
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-500">{success}</p>}
        </form>
      ) : (
        <div className="mt-5 space-y-3">
          {account ? (
            <>
              <div>
                <p className="text-xs text-slate-400">Tên tài khoản</p>
                <p className="mt-1 font-medium">{account.username}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Mật khẩu hiện tại</p>
                <div className="mt-1 flex items-center justify-between font-medium">
                  <span>{passwordVisible && canSeePassword ? displayPassword : "********"}</span>
                  {canSeePassword && (
                    <button 
                      type="button" 
                      onClick={() => setPasswordVisible(!passwordVisible)} 
                      className="text-slate-400 hover:text-rose-500"
                      aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <PasswordEyeIcon visible={passwordVisible} />
                    </button>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div>
                  <p className="text-xs text-slate-400">Quyền hệ thống</p>
                  <p className="mt-1 font-medium">{account.role === 'full_access' ? 'Toàn quyền' : 'Chỉ xem chính mình'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400">Trạng thái</p>
                <p className={`mt-1 font-medium ${(account.active || account.isSystem) ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {(account.active || account.isSystem) ? 'Đang hoạt động' : 'Không hoạt động'}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Chưa có tài khoản đăng nhập.</p>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-500">{success}</p>}
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return <main className="min-h-screen animate-pulse bg-[var(--app-background)] px-5 py-6 text-[var(--app-foreground)] md:pl-72 md:pr-8"><div className="mx-auto max-w-7xl"><div className="h-4 w-28 rounded bg-rose-200 dark:bg-white/10" /><div className="mt-3 h-8 w-48 rounded bg-slate-200 dark:bg-white/10" /><div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_.7fr]"><div className="h-36 rounded-3xl bg-rose-200 dark:bg-white/10" /><div className="grid grid-cols-2 gap-3"><div className="rounded-3xl bg-slate-200 dark:bg-white/10" /><div className="rounded-3xl bg-slate-200 dark:bg-white/10" /></div></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 rounded-3xl bg-slate-200 dark:bg-white/10" />)}</div><div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="h-48 rounded-3xl bg-slate-200 dark:bg-white/10" /><div className="h-48 rounded-3xl bg-slate-200 dark:bg-white/10" /></div></div></main>;
}

function MobileNav({ screen, profileOpen, go, openProfile, t }: { screen: Screen; profileOpen: boolean; go: (s: Screen) => void; openProfile: () => void; t: ReturnType<typeof translator> }) {
  const navItemClass = "flex flex-1 flex-col items-center justify-center pt-2 pb-1 transition-colors";
  const inactiveColor = "text-slate-400 dark:text-slate-500";
  const activeColor = "text-[#4f46e5] dark:text-indigo-400";
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center border-t border-[var(--app-border)] bg-[var(--app-nav)] pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur-lg md:hidden">
      {/* Thành viên */}
      <button onClick={() => go("members")} className={`${navItemClass} ${screen === "members" && !profileOpen ? activeColor : inactiveColor}`}>
        <span className="mb-1 text-xl">{icons.members}</span>
        <span className="text-[10px] font-medium leading-none">Thành viên</span>
      </button>

      {/* Lịch */}
      <button onClick={() => go("calendar")} className={`${navItemClass} ${screen === "calendar" && !profileOpen ? activeColor : inactiveColor}`}>
        <span className="mb-1 text-xl">{icons.calendar}</span>
        <span className="text-[10px] font-medium leading-none">Lịch</span>
      </button>

      {/* Spacer for center button */}
      <div className="flex-[0.8]" />

      {/* Thu chi */}
      <button onClick={() => go("finance")} className={`${navItemClass} ${screen === "finance" && !profileOpen ? activeColor : inactiveColor}`}>
        <span className="mb-1 text-xl">{icons.finance}</span>
        <span className="text-[10px] font-medium leading-none">Thu chi</span>
      </button>

      {/* Cá nhân */}
      <button onClick={openProfile} className={`${navItemClass} ${profileOpen ? activeColor : inactiveColor}`}>
        <span className="mb-1 text-xl"><UserIcon /></span>
        <span className="text-[10px] font-medium leading-none">Cá nhân</span>
      </button>

      {/* Center Floating Button (Tổng quan) */}
      <div className="pointer-events-none absolute left-1/2 top-0 flex flex-col items-center -translate-x-1/2 -translate-y-[35%]">
        <button 
          onClick={() => go("dashboard")}
          className="pointer-events-auto flex size-[56px] items-center justify-center rounded-full bg-[#4f46e5] shadow-lg shadow-indigo-500/30 ring-4 ring-[var(--app-nav)] transition-transform active:scale-95"
        >
          <span className="text-white text-2xl"><HomeIcon /></span>
        </button>
        <span className={`mt-1 block text-center text-[10px] font-medium ${screen === "dashboard" && !profileOpen ? activeColor : inactiveColor}`}>
          Tổng quan
        </span>
      </div>
    </nav>
  );
}

function Sidebar({ screen, go, t, collapsed, toggle }: { screen: Screen; go: (s: Screen) => void; t: ReturnType<typeof translator>; collapsed: boolean; toggle: () => void }) {
  const items: Screen[] = ["dashboard", "members", "calendar", "finance", "chat", "notes", "notifications", "settings"];
  return <aside className={`fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-[var(--app-border)] bg-[var(--app-card)] py-4 transition-[width] duration-300 shadow-sm ${collapsed ? "w-[64px] px-2" : "w-[220px] px-4"}`}>
    <div className={`flex min-h-12 items-center ${collapsed ? "justify-center" : "justify-between gap-3 px-2"}`}>
      {!collapsed && <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-500">Family Hub</p><p className="truncate pt-1 text-xl font-bold">My Family</p></div>}
      <button type="button" onClick={toggle} aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--app-border)] text-slate-600 transition hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:text-slate-200 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-200"><MenuIcon /></button>
    </div>
    <nav className={`${collapsed ? "mt-4" : "mt-5"} space-y-1.5`}>
      {items.map(item => {
        const active = screen === item;
        return <button key={item} title={collapsed ? t(titleKey[item]) : undefined} onClick={() => go(item)} className={`flex h-12 w-full items-center rounded-xl text-left text-sm font-semibold transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-[#EEF2FF] text-[#4F46E5] dark:bg-indigo-400/15 dark:text-indigo-200" : "text-slate-600 hover:bg-[#EEF2FF] hover:text-[#4F46E5] dark:text-slate-200 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-200"}`}><span className={`grid shrink-0 place-items-center leading-none ${collapsed ? "size-10 text-xl" : "size-7 text-lg"}`}>{icons[item]}</span>{!collapsed && <span className="leading-none">{t(titleKey[item])}</span>}</button>;
      })}
    </nav>
  </aside>;
}
function Icon({ children }: { children: React.ReactNode }) { return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>; }
function HomeIcon() { return <Icon><path d="m3 11 9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></Icon>; }
function UsersIcon() { return <Icon><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" /><circle cx="12" cy="8" r="3" /><path d="M20 18c0-1.8-1.2-3.2-3-3.8M17 7.2a2.4 2.4 0 0 1 0 4.6M4 18c0-1.8 1.2-3.2 3-3.8M7 7.2a2.4 2.4 0 0 0 0 4.6" /></Icon>; }
function CheckListIcon() { return <Icon><path d="m4 7 2 2 4-4M4 15l2 2 4-4M13 8h7M13 16h7" /></Icon>; }
function WalletIcon() { return <Icon><path d="M4 7a2 2 0 0 1 2-2h14v14H6a2 2 0 0 1-2-2Z" /><path d="M4 9h17M16 14h3" /></Icon>; }
function ChatIcon() { return <Icon><path d="M4 5h16v11H8l-4 4Z" /><path d="M8 9h8M8 13h5" /></Icon>; }
function CalendarIcon() { return <Icon><rect x="4" y="5" width="16" height="17" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></Icon>; }
function NotesIcon() { return <Icon><path d="M7 4h10a2 2 0 0 1 2 2v16l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z" /><path d="M8 9h8M8 13h8" /></Icon>; }
function MenuIcon() { return <Icon><path d="M4 6h16M4 12h10M4 18h16" /></Icon>; }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>; }
function CameraIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current stroke-2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-2Z" /><circle cx="12" cy="13" r="3" /></svg>; }
function ThemeIcon({ dark }: { dark: boolean }) { return dark ? <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon> : <Icon><path d="M21 12.8A8 8 0 1 1 11.2 3 6 6 0 0 0 21 12.8Z" /></Icon>; }
function BellIcon() { return <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4" /></Icon>; }
function ChevronDownIcon() { return <Icon><path d="m7 9 5 5 5-5" /></Icon>; }
function UserIcon() { return <Icon><circle cx="12" cy="8" r="3" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></Icon>; }
function SettingsIcon() { return <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a2 2 0 0 0 .4 2.2l.1.1-2.6 2.6-.1-.1a2 2 0 0 0-2.2-.4 2 2 0 0 0-1.2 1.8V21h-3.6v-.2A2 2 0 0 0 9 19a2 2 0 0 0-2.2.4l-.1.1-2.6-2.6.1-.1A2 2 0 0 0 4.6 15 2 2 0 0 0 2.8 14H2v-4h.8a2 2 0 0 0 1.8-1 2 2 0 0 0-.4-2.2l-.1-.1 2.6-2.6.1.1A2 2 0 0 0 9 4.6 2 2 0 0 0 10.2 3V2h3.6v1A2 2 0 0 0 15 4.6a2 2 0 0 0 2.2-.4l.1-.1 2.6 2.6-.1.1a2 2 0 0 0-.4 2.2 2 2 0 0 0 1.8 1H22v4h-.8a2 2 0 0 0-1.8 1Z" /></Icon>; }
function LockIcon() { return <Icon><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>; }
function LogoutIcon() { return <Icon><path d="M10 17l5-5-5-5m5 5H3m12-9h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></Icon>; }

function SectionTitle({ label, action, onClick }: { label: string; action?: string; onClick?: () => void }) {
  return <div className="mb-3 mt-6 flex items-center justify-between"><h2 className="font-bold">{label}</h2>{action && <button onClick={onClick} className="text-xs font-bold text-rose-500">{action}</button>}</div>;
}
function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} className="mt-4 w-full rounded-2xl border border-dashed border-rose-300 py-3 text-sm font-bold text-rose-500">{icons.plus} {label}</button>;
}
const filterClass = "w-full min-w-0 max-w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-3 text-sm outline-none focus:border-rose-400";

function Dashboard({ data, go, notifications, user }: { data: AppData; go: (s: Screen) => void; notifications: CalendarNotification[]; user: AuthUser }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isThisMonth = (date: string) => {
    const parsed = parseDate(date, now);
    return parsed?.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
  };
  const sumTransactions = (items: Transaction[]) => items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  const total = (type: Transaction["type"], thisMonth = false) => sumTransactions(data.transactions.filter(item => String(item.type).toLowerCase() === type && (!thisMonth || isThisMonth(item.date))));
  const monthlyIncome = total("income", true);
  const monthlyExpense = total("expense", true);
  const upcomingEvents = data.events.filter(event => {
    const date = parseDate(event.date, now);
    return date && date >= today;
  }).sort((left, right) => (parseDate(left.date, now)?.getTime() ?? 0) - (parseDate(right.date, now)?.getTime() ?? 0));
  const upcomingBirthdays = data.members.map(member => ({ member, date: nextBirthday(member, now) })).filter(item => item.date).sort((left, right) => left.date!.getTime() - right.date!.getTime());
  const todayTasks = data.tasks.filter(task => isDueToday(task, now));
  const overdueTasks = data.tasks.filter(task => isOverdue(task, now));
  const metrics: [string, string, string, string][] = [
    ["Tổng thành viên", String(data.members.length), "text-indigo-600", "Gia đình"],
    ["Công việc hôm nay", String(todayTasks.length), "text-orange-500", "Cần xử lý"],
    ["Công việc quá hạn", String(overdueTasks.length), "text-rose-500", "Cần chú ý"],
    ["Thu tháng này", money(monthlyIncome), "text-emerald-500", "Tổng thu"],
    ["Chi tháng này", money(monthlyExpense), "text-rose-500", "Tổng chi"],
    ["Số dư tháng này", money(monthlyIncome - monthlyExpense), monthlyIncome - monthlyExpense >= 0 ? "text-emerald-500" : "text-rose-500", "Thu trừ chi"],
  ];
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const matches = (item: Transaction) => { const parsed = parseDate(item.date, now); return parsed?.getMonth() === date.getMonth() && parsed.getFullYear() === date.getFullYear(); };
    return { label: `${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`, income: sumTransactions(data.transactions.filter(item => String(item.type).toLowerCase() === "income" && matches(item))), expense: sumTransactions(data.transactions.filter(item => String(item.type).toLowerCase() === "expense" && matches(item))) };
  });
  const categoryTotals = Object.entries(
    data.transactions
      .filter((item) => String(item.type).toLowerCase() === "expense")
      .reduce<Record<string, number>>((result, item) => {
        const category = item.category || "Khác";

        return {
          ...result,
          [category]:
            (result[category] ?? 0) +
            (Number.isFinite(item.amount) ? item.amount : 0),
        };
      }, {})
  ).sort((left, right) => right[1] - left[1]);
  const doneCount = data.tasks.filter(item => item.status === "done").length;
  const completion = data.tasks.length ? Math.round(doneCount / data.tasks.length * 100) : 0;

  const unreadCount = notifications.filter(item => isCalendarNotificationUnread(item, user)).length;

  return <div className="grid grid-cols-12 gap-4 md:gap-6">
    <div className="col-span-12 grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">{metrics.map(([label, value, color, hint]) => <MetricCard key={label} label={label} value={value} color={color} hint={hint} />)}</div>
    
    <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
      <MonthlyChart data={monthly} />
      <CategoryChart data={categoryTotals} />
    </div>

    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
      <CompletionChart value={completion} done={doneCount} total={data.tasks.length} />
      <Card className="p-5 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Thông báo</h2>
          <button onClick={() => go("notifications")} className="text-xs font-semibold text-indigo-600">Xem tất cả</button>
        </div>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {notifications.length ? (
            notifications.slice(0, 5).map(item => {
              const unread = isCalendarNotificationUnread(item, user);
              return (
                <div key={item.id} className={`p-2.5 rounded-xl border border-[var(--app-border)] text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${unread ? "bg-orange-50/40 dark:bg-orange-400/5 font-semibold" : ""}`} onClick={() => go("notifications")}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] text-slate-400">{item.actorName || "Family Hub"}</span>
                    <span className="text-[9px] text-slate-400">{formatDateVN(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-1">{item.message}</p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-xs text-slate-400">Chưa có thông báo</div>
          )}
        </div>
      </Card>
    </div>
  </div>;
}
function MetricCard({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) { return <Card className="p-4 md:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-2 md:mt-3 text-lg md:text-2xl font-bold ${color}`}>{value}</p></div><span className="grid size-8 md:size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-indigo-400/10"><span className="scale-75 md:scale-100">●</span></span></div><p className="mt-3 md:mt-4 text-[10px] md:text-xs text-slate-400">{hint}</p></Card>; }
function MonthlyChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(...data.flatMap(item => [item.income, item.expense]), 1);
  const hasData = data.some(item => item.income || item.expense);
  return <Card className="p-5"><div className="flex items-center justify-between"><b>Thu chi theo tháng</b><p className="text-xs"><span className="text-emerald-500">■ Thu</span> <span className="ml-2 text-rose-500">■ Chi</span></p></div>{hasData ? <div className="mt-5 grid h-52 grid-cols-6 gap-2">{data.map(item => <div key={item.label} className="flex min-w-0 flex-col items-center justify-end"><div className="flex h-44 items-end gap-1"><span title={money(item.income)} className="w-3 rounded-t bg-emerald-400" style={{ height: `${item.income ? Math.max(item.income / max * 100, 3) : 0}%` }} /><span title={money(item.expense)} className="w-3 rounded-t bg-rose-400" style={{ height: `${item.expense ? Math.max(item.expense / max * 100, 3) : 0}%` }} /></div><span className="mt-2 text-[10px] text-slate-400">{item.label}</span></div>)}</div> : <div className="mt-5">Chưa có dữ liệu</div>}</Card>;
}
function CategoryChart({ data }: { data: [string, number][] }) {
  const total = data.reduce((sum, item) => sum + item[1], 0);
  const colors = ["bg-rose-400", "bg-orange-400", "bg-violet-400", "bg-sky-400", "bg-emerald-400"];
  return <Card className="p-5"><b>Chi tiêu theo danh mục</b>{total ? <><div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">{data.map(([label, value], index) => <span key={label} className={`h-full ${colors[index % colors.length]}`} style={{ width: `${value / total * 100}%` }} />)}</div><div className="mt-4 space-y-3">{data.slice(0, 5).map(([label, value], index) => <div key={label} className="flex justify-between text-xs"><span><i className={`mr-2 inline-block size-2 rounded-full ${colors[index % colors.length]}`} />{label}</span><b>{money(value)}</b></div>)}</div></> : <div className="mt-5">Chưa có dữ liệu</div>}</Card>; }
function CompletionChart({ value, done, total }: { value: number; done: number; total: number }) { return <Card className="p-5"><div className="flex items-center justify-between"><b>Tỷ lệ hoàn thành công việc</b><b className="text-emerald-500">{value}%</b></div><div className="mt-8 grid place-items-center"><div className="grid size-36 place-items-center rounded-full bg-emerald-50 text-3xl font-bold text-emerald-500 ring-8 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/20">{value}%</div></div><p className="mt-8 text-center text-xs text-slate-400">{total ? `${done}/${total} công việc đã hoàn thành` : "Chưa có dữ liệu công việc"}</p></Card>; }
function NotificationsView({ user, notifications, setNotifications }: { user: AuthUser; notifications: CalendarNotification[]; setNotifications: React.Dispatch<React.SetStateAction<CalendarNotification[]>> }) {
  const [selected, setSelected] = useState<CalendarNotification | null>(null);
  const [pushStatus, setPushStatus] = useState<"checking" | "subscribed" | "unsubscribed" | "denied">("checking");
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) {
        setPushStatus("unsubscribed");
        return;
      }
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setPushStatus("subscribed");
        else setPushStatus("unsubscribed");
      });
    });
  }, []);

  const handleSubscribePush = async () => {
    try {
      setIsSubscribing(true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        alert("Bạn đã từ chối quyền gửi thông báo.");
        return;
      }
      
      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();
      
      const vapidRes = await fetch("/api/vapid-public-key");
      const { publicKey } = await vapidRes.json();
      if (!publicKey) throw new Error("Không lấy được VAPID key");
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });
      
      const res = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys })
      });
      
      if (res.ok) {
        setPushStatus("subscribed");
        alert("Đăng ký nhận thông báo thành công!");
      } else {
        throw new Error("Lỗi khi lưu subscription");
      }
    } catch (e) {
      console.error(e);
      alert("Có lỗi xảy ra khi đăng ký nhận thông báo.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleMarkRead = (item: CalendarNotification) => {
    markNotificationRead(item.id, user);
    setNotifications(loadVisibleCalendarNotifications(user));
    if (selected && selected.id === item.id) {
      setSelected(prev => prev ? { ...prev, read: true, readUserIds: [...(prev.readUserIds || []), user.id] } : null);
    }
  };

  const handleMarkAllRead = () => {
    markCalendarNotificationsRead(user);
    setNotifications(loadVisibleCalendarNotifications(user));
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {pushStatus === "unsubscribed" && (
        <Card className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">Bật thông báo trên điện thoại</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Nhận thông báo push khi có sự kiện mới hoặc sắp tới.</p>
            </div>
            <button
              onClick={handleSubscribePush}
              disabled={isSubscribing}
              className="whitespace-nowrap px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {isSubscribing ? "Đang xử lý..." : "Bật thông báo"}
            </button>
          </div>
        </Card>
      )}
      
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Mobile Detail Overlay */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 md:hidden">
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300" />
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <button onClick={() => setSelected(null)} className="text-sm font-semibold text-indigo-600 flex items-center gap-1">
                  ← Quay lại
                </button>
                <span className="text-xs font-bold text-slate-400">Chi tiết thông báo</span>
              </div>
              <div className="border-t border-[var(--app-border)] pt-4 space-y-3">
                <h3 className="font-bold text-base text-slate-800 dark:text-white">{selected.title || "Thông báo"}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{selected.message}</p>
                <div className="text-xs space-y-1.5 text-slate-400 bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                  <p><b>Người tạo:</b> {selected.actorName || "Family Hub"}</p>
                  <p><b>Thời gian tạo:</b> {new Date(selected.createdAt).toLocaleString("vi-VN")}</p>
                  <p><b>Trạng thái:</b> {isCalendarNotificationUnread(selected, user) ? "Chưa đọc" : "Đã đọc"}</p>
                </div>
                {isCalendarNotificationUnread(selected, user) && (
                  <button
                    onClick={() => handleMarkRead(selected)}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PC Detail Panel */}
      {selected && (
        <div className="hidden md:block md:col-span-4 xl:col-span-4">
          <Card className="p-5 space-y-4 sticky top-24">
            <div className="flex justify-between items-center">
              <button onClick={() => setSelected(null)} className="text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:underline">
                ← Đóng chi tiết
              </button>
              <span className="text-xs font-bold text-slate-400">Chi tiết</span>
            </div>
            <div className="border-t border-[var(--app-border)] pt-4 space-y-3">
              <h3 className="font-bold text-base text-slate-800 dark:text-white leading-snug">{selected.title || "Thông báo"}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{selected.message}</p>
              <div className="text-xs space-y-1.5 text-slate-400 bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                <p><b>Người tạo:</b> {selected.actorName || "Family Hub"}</p>
                <p><b>Thời gian tạo:</b> {new Date(selected.createdAt).toLocaleString("vi-VN")}</p>
                <p><b>Trạng thái:</b> {isCalendarNotificationUnread(selected, user) ? "Chưa đọc" : "Đã đọc"}</p>
              </div>
              {isCalendarNotificationUnread(selected, user) && (
                <button
                  onClick={() => handleMarkRead(selected)}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Notifications List - 1 column layout */}
      <div className={`col-span-12 ${selected ? "md:col-span-8 xl:col-span-8" : ""}`}>
        <Card className="p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm md:text-base">Tất cả thông báo</h2>
            <button onClick={handleMarkAllRead} className="text-xs font-semibold text-indigo-600 hover:underline">
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          <div className="space-y-2">
            {notifications.length ? (
              notifications.map(item => {
                const unread = isCalendarNotificationUnread(item, user);
                
                if (item.source_type === "event" && item.metadata) {
                  const meta = item.metadata;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`p-3 md:p-4 rounded-xl border border-[var(--app-border)] cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col gap-2 ${
                        unread ? "bg-orange-50/30 dark:bg-orange-400/5 ring-1 ring-orange-200/50 dark:ring-orange-500/10" : ""
                      } ${selected?.id === item.id ? "ring-2 ring-indigo-500 bg-slate-50/50 dark:bg-white/5" : ""}`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 grid size-6 place-items-center rounded-full shrink-0 scale-75">
                            <CalendarIcon />
                          </div>
                          <h4 className={`text-xs md:text-sm text-slate-800 dark:text-white truncate ${unread ? "font-bold" : "font-semibold"}`}>
                            {item.title || "Thông báo sự kiện"}
                          </h4>
                        </div>
                        <span className="text-[9px] md:text-[10px] text-slate-400 shrink-0 mt-0.5">
                          {formatDateVN(item.createdAt)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-[var(--app-border)]">
                        <div className="text-slate-500">Sự kiện:</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{meta.eventTitle}</div>
                        
                        <div className="text-slate-500">Thời gian:</div>
                        <div>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {meta.startTime ? `${meta.startTime} ` : ""}
                          </span>
                          {new Date(meta.eventDate).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                        
                        <div className="text-slate-500">Lịch:</div>
                        <div>{meta.calendarName}</div>
                        
                        {meta.relatedMembers && (
                          <>
                            <div className="text-slate-500">Người liên quan:</div>
                            <div className="text-slate-700 dark:text-slate-300">{meta.relatedMembers}</div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] md:text-[11px] text-slate-400 pt-1">
                        <span>Tạo bởi: <span className="font-medium text-slate-600 dark:text-slate-300">{meta.creatorName || "Family Hub"}</span></span>
                        <span className={unread ? "text-orange-500 font-bold bg-orange-100 dark:bg-orange-500/20 px-2 py-0.5 rounded-full" : "text-slate-400"}>
                          {unread ? "Chưa đọc" : "Đã đọc"}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`p-3 md:p-4 rounded-xl border border-[var(--app-border)] cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col gap-1.5 ${
                      unread ? "bg-orange-50/30 dark:bg-orange-400/5 ring-1 ring-orange-200/50 dark:ring-orange-500/10" : ""
                    } ${selected?.id === item.id ? "ring-2 ring-indigo-500 bg-slate-50/50 dark:bg-white/5" : ""}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className={`text-xs md:text-sm text-slate-800 dark:text-white truncate ${unread ? "font-bold" : "font-semibold"}`}>
                        {item.title || "Thông báo"}
                      </h4>
                      <span className="text-[9px] md:text-[10px] text-slate-400 shrink-0">
                        {formatDateVN(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between text-[10px] md:text-[11px] text-slate-400 border-t border-[var(--app-border)] pt-2 mt-1">
                      <span>Người tạo: {item.actorName || "Family Hub"}</span>
                      <span className={unread ? "text-orange-500 font-bold" : "text-slate-400"}>
                        {unread ? "Chưa đọc" : "Đã đọc"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-xs md:text-sm text-slate-400">Chưa có thông báo</div>
            )}
          </div>
        </Card>
      </div>
    </div>
    </div>
  );
}

let cachedMembers: Member[] | null = null;

function Members({ data, user, update }: { data: AppData; user: AuthUser; update: (data: AppData) => void }) {
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "with_account" | "without_account">("all");
  const [detail, setDetail] = useState<Member | "new" | null>(null);
  const [initialEdit, setInitialEdit] = useState(false);
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [warning, setWarning] = useState("");
  const [localMembers, setLocalMembers] = useState<Member[]>(() => cachedMembers || []);

  useEffect(() => {
    if (cachedMembers) {
      return;
    }
    void fetch("/api/members").then(async response => {
      const json = await response.json();
      const parsedMembers = (Array.isArray(json) ? json : (json.data ?? [])) as Member[];
      setLocalMembers(current => {
        const merged = parsedMembers.map(newM => {
          const existingM = current.find(m => m.id === newM.id);
          return {
            ...newM,
            avatar: (existingM && existingM.avatar && !newM.avatar) ? existingM.avatar : newM.avatar,
            avatarPreview: newM.avatarPreview || (existingM && existingM.avatarPreview) || ""
          };
        });
        cachedMembers = merged;
        return merged;
      });
    });
  }, []);

  const canManage = user.role === "full_access";
  const visible = localMembers;
  const members = visible.filter(member => {
    const keyword = query.trim().toLocaleLowerCase();
    return (accountFilter === "all" || (accountFilter === "with_account" ? Boolean(member.user) : !member.user)) && (!keyword || [member.name, member.phone].some(value => value?.toLocaleLowerCase().includes(keyword)));
  });

  async function remove(member: Member) {
    const response = await fetch(`/api/members?id=${encodeURIComponent(member.id)}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) return setWarning(result?.error || "Không thể ẩn thành viên.");
    update({ ...data, members: data.members.filter(item => item.id !== member.id) });
    setLocalMembers(current => {
      const updated = current.filter(item => item.id !== member.id);
      cachedMembers = updated;
      return updated;
    });
    setRemoving(null); setWarning("");
  }

  if (detail) return <MemberProfile key={detail === "new" ? "new" : detail.id} member={detail} data={data} user={user} initialEdit={initialEdit} close={() => setDetail(null)} saved={member => {
    update({ ...data, members: data.members.some(item => item.id === member.id) ? data.members.map(item => item.id === member.id ? member : item) : [...data.members, member] });
    setLocalMembers(current => {
      const updated = current.some(item => item.id === member.id) ? current.map(item => item.id === member.id ? member : item) : [...current, member];
      cachedMembers = updated;
      return updated;
    });
    setDetail(member);
  }} remove={member => { setDetail(null); setRemoving(member); setWarning(""); }} />;

  return <><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">Thành viên</h2><p className="mt-1 text-sm text-slate-400">Family Hub / Thành viên</p></div>{canManage && <button onClick={() => { setInitialEdit(true); setDetail("new"); }} className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ Thêm thành viên</button>}</div>
    <Card className="p-4"><div className="grid max-w-[680px] gap-3 md:grid-cols-[minmax(0,440px)_220px]"><input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên hoặc số điện thoại" /><select className={filterClass} value={accountFilter} onChange={event => setAccountFilter(event.target.value as typeof accountFilter)}><option value="all">Tất cả</option><option value="with_account">Có tài khoản</option><option value="without_account">Chưa có tài khoản</option></select></div></Card>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{members.map(member => <Card key={member.id} className="p-4 md:p-5 relative flex flex-col justify-between"><div className="flex items-start gap-3"><Avatar member={member} size="size-12" /><div className="min-w-0 flex-1 pr-6"><h3 className="font-semibold">{member.nickname || member.name}</h3>{member.nickname && <p className="text-xs text-slate-400">{member.name}</p>}{ageAtToday(member.birthday) !== null && <p className="mt-2 text-xs text-slate-400">{ageAtToday(member.birthday)} tuổi</p>}{member.birthday && <p className="mt-1 text-xs text-slate-400">{formatBirthday(member.birthday)}</p>}{member.phone && <p className="mt-1 text-xs text-slate-400">{member.phone}</p>}</div><div className="absolute right-3 top-3"><button onClick={() => setActiveMenuMemberId(activeMenuMemberId === member.id ? null : member.id)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Menu thành viên">⋮</button>{activeMenuMemberId === member.id && <><div className="fixed inset-0 z-10" onClick={() => setActiveMenuMemberId(null)} /><div className="absolute right-0 top-9 z-20 w-32 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl"><button onClick={() => { setInitialEdit(false); setDetail(member); setActiveMenuMemberId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Xem chi tiết</button><button onClick={() => { setInitialEdit(true); setDetail(member); setActiveMenuMemberId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Sửa</button>{canManage && <button onClick={() => { setRemoving(member); setWarning(""); setActiveMenuMemberId(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa</button>}</div></>}</div></div></Card>)}</div>
    {!members.length && <div className="mt-6">Chưa có dữ liệu</div>}
  </>;
}
type MemberProfileTab = "profile" | "account" | "work" | "bank" | "sims" | "bankRaw" | "security" | "tasks" | "events" | "notes";
type ProfileSubTab = "basic" | "education" | "skills" | "experience" | "documents";
function MemberProfile({ member, data, user, close, saved, remove, personal = false, openChangePassword, logout, savedUser = () => undefined, initialEdit = false }: { member: Member | "new"; data: AppData; user: AuthUser; close: () => void; saved: (member: Member) => void; remove: (member: Member) => void; personal?: boolean; openChangePassword?: () => void; logout?: () => void; savedUser?: (user: AuthUser) => void; initialEdit?: boolean }) {
  const existing = member === "new" ? null : member;
  const pathname = usePathname();
  const [tab, setTab] = useState<MemberProfileTab>("profile");
  const [editing, setEditing] = useState(!existing || initialEdit);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [subTab, setSubTab] = useState<ProfileSubTab>("basic");
  const [error, setError] = useState("");
  const [linkedUsers, setLinkedUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<Member>(() => existing ?? { id: crypto.randomUUID(), name: "", nickname: "", birthday: "", gender: "", phone: "", avatar: "", notes: "", color: "#cbd5e1" });
  const [detailsLoaded, setDetailsLoaded] = useState(!existing);
  const canManage = user.role === "full_access";
  const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  const tasks = data.tasks.filter(task => task.memberId === form.id);
  const events = data.events.filter(event => event.memberId === form.id);
  const notes = data.notes.filter(note => note.memberId === form.id);
  useEffect(() => {
    if (!canManage || !existing) return;
    void fetch("/api/users").then(async response => { const result = await readJsonSafe<{ users?: ManagedUser[] }>(response); if (response.ok && result?.users) setLinkedUsers(result.users.filter(account => account.memberId === existing.id)); });
  }, [canManage, existing?.id]);
  useEffect(() => {
    if (!existing) return;
    void fetch(`/api/members?id=${existing.id}`).then(async response => {
      const result = await readJsonSafe<{ ok?: boolean; data?: Member }>(response);
      if (response.ok && result?.data) {
        setForm(current => ({ ...current, ...result.data }));
        saved(result.data);
      }
      setDetailsLoaded(true);
    });
  }, [existing?.id]);
  const set = <K extends keyof Member>(key: K, value: Member[K]) => setForm(current => ({ ...current, [key]: value }));
  function cancel() { if (!existing) return close(); setForm(existing); setEditing(false); setError(""); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/members", { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await readJsonSafe<{ ok?: boolean; data?: Member; error?: string }>(response);
    if (!response.ok || !result?.ok || !result.data) return setError(result?.error || "Không thể lưu hồ sơ thành viên.");
    saved(result.data); setEditing(false); setError("");
  }
  const linkedAccount = linkedUsers[0] || (form.user ? { ...form.user, avatar: "", mustChangePassword: false } as ManagedUser : personal ? { ...user, email: "", active: true, isSystem: false, createdAt: "", updatedAt: "" } : null);
  const refreshLinkedAccount = () => {
    if (!canManage) return;
    void fetch("/api/users").then(async response => { const result = await readJsonSafe<{ users?: ManagedUser[] }>(response); if (response.ok && result?.users) setLinkedUsers(result.users.filter(account => account.memberId === form.id)); });
  };
  const menu: [MemberProfileTab, string][] = [["profile", "Thông tin cá nhân"], ["account", "Tài khoản đăng nhập"], ["work", "Công việc"], ["bank", "Thẻ ngân hàng"], ["bankRaw", "Nội dung gốc ngân hàng"], ["security", "Bảo mật"], ["tasks", "Việc nhà liên quan"], ["events", "Sự kiện liên quan"], ["notes", "Ghi chú"]];
  const profileMenu = menu.flatMap(([value, label]) => value === "bank" ? [[value, label], ["sims", "SIM / Data"]] as [MemberProfileTab, string][] : [[value, label]] as [MemberProfileTab, string][]);
  return <div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div>{!personal && <button onClick={close} className="text-sm font-semibold text-indigo-600">← Danh sách thành viên</button>}<h2 className={personal ? "text-2xl font-semibold" : "mt-3 text-2xl font-semibold"}>{personal ? "Hồ sơ cá nhân" : existing ? "Hồ sơ thành viên" : "Thêm thành viên"}</h2><p className="mt-1 text-sm text-slate-400">Family Hub / {personal ? "Hồ sơ cá nhân" : `Thành viên / ${existing ? form.nickname || form.name : "Thêm mới"}`}</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]"><Card className="h-fit p-3"><nav className="space-y-1">{profileMenu.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${tab === value ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-400/15" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}>{label}</button>)}</nav></Card>
      <div>{!detailsLoaded && ["account", "bank", "sims", "bankRaw", "notes"].includes(tab) ? (
        <Card className="p-6 text-center text-slate-400">Đang tải dữ liệu chi tiết...</Card>
      ) : (
        <>
          {tab === "profile" && <form onSubmit={submit} className="space-y-5">
            <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center relative">
              <AvatarEditor member={form} editable={editing} onChange={avatar => set("avatar", avatar)} />
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-semibold">{form.nickname || form.name || "Thành viên mới"}</h3>
                {ageAtToday(form.birthday) !== null && <p className="mt-1 text-sm text-slate-400">{ageAtToday(form.birthday)} tuổi</p>}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancel} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5">Hủy</button>
                    <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Lưu thay đổi</button>
                  </div>
                ) : (
                  existing && !personal && (
                    <div className="relative">
                      <button type="button" onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Thao tác hồ sơ">⋮</button>
                      
                      {/* Mobile Dropdown Bottom Sheet */}
                      {profileMenuOpen && (
                        <div className="fixed inset-0 z-50 flex items-end bg-black/45 sm:hidden" onClick={() => setProfileMenuOpen(false)}>
                          <div className="w-full rounded-t-3xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />
                            <div className="space-y-1.5">
                              {editing && <button type="button" onClick={() => { setEditing(false); setProfileMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Xem hồ sơ</button>}
                              <button type="button" onClick={() => { setEditing(true); setProfileMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Chỉnh sửa</button>
                              {canManage && (
                                <button type="button" onClick={() => { remove(existing); setProfileMenuOpen(false); }} className="block w-full rounded-xl py-3 px-4 text-left text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa thành viên</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PC Dropdown Menu */}
                      {profileMenuOpen && (
                        <div className="hidden sm:block">
                          <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                          <div className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl">
                            {editing && <button type="button" onClick={() => { setEditing(false); setProfileMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Xem hồ sơ</button>}
                            <button type="button" onClick={() => { setEditing(true); setProfileMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5">Chỉnh sửa</button>
                            {canManage && (
                              <button type="button" onClick={() => { remove(existing); setProfileMenuOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa thành viên</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between border-b border-[var(--app-border)] pb-2 mb-4">
                <h3 className="font-semibold text-base">Thông tin cá nhân</h3>
                <div className="flex flex-wrap gap-1 mt-2 sm:mt-0">
                  {[
                    { id: "basic", label: "Thông tin cơ bản" },
                    { id: "education", label: "Trình độ / bằng cấp" },
                    { id: "skills", label: "Kỹ năng" },
                    { id: "experience", label: "Kinh nghiệm" },
                    { id: "documents", label: "Tài liệu" }
                  ].map(tabItem => (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() => setSubTab(tabItem.id as ProfileSubTab)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        subTab === tabItem.id
                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-200"
                          : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {subTab === "basic" ? (
                editing ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Field label="Họ tên">
                      <input required disabled={!canManage} className={inputClass} value={form.name} onChange={event => set("name", event.target.value)} />
                    </Field>
                    <Field label="Nickname">
                      <input className={inputClass} value={form.nickname} onChange={event => set("nickname", event.target.value)} />
                    </Field>
                    <BirthdaySelect disabled={!canManage} value={form.birthday} onChange={value => set("birthday", value)} />
                    <Field label="Tuổi hiện tại">
                      <input disabled className={inputClass} value={ageAtToday(form.birthday) !== null ? `${ageAtToday(form.birthday)} tuổi` : "Chưa đủ ngày sinh"} readOnly />
                    </Field>
                    <Field label="Giới tính">
                      <select disabled={!canManage} className={inputClass} value={form.gender} onChange={event => set("gender", event.target.value as Member["gender"])}>
                        <option value="">Chưa chọn</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select>
                    </Field>
                    <Field label="Số điện thoại">
                      <input className={inputClass} value={form.phone} onChange={event => set("phone", event.target.value)} />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                    {[
                      ["Họ tên", form.name],
                      ["Nickname", form.nickname || "Chưa cập nhật"],
                      ["Ngày sinh", formatBirthday(form.birthday)],
                      ["Tuổi hiện tại", ageAtToday(form.birthday) !== null ? `${ageAtToday(form.birthday)} tuổi` : "Chưa cập nhật"],
                      ["Giới tính", form.gender === "male" ? "Nam" : form.gender === "female" ? "Nữ" : form.gender === "other" ? "Khác" : "Chưa cập nhật"],
                      ["Số điện thoại", form.phone || "Chưa cập nhật"]
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="mt-1 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">
                  Chức năng này sẽ được bổ sung sau.
                </div>
              )}

              {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
            </Card>
          </form>}
          {tab === "work" && <MemberWorkHistory member={form} user={user} />}
          {tab === "tasks" && <Card><h3 className="mb-4 font-semibold">Việc nhà liên quan</h3>{tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} />) : <EmptyState />}</Card>}
          {tab === "events" && <Card><h3 className="mb-4 font-semibold">Sự kiện liên quan</h3>{events.length ? events.map(event => <EventRow key={event.id} event={event} />) : <EmptyState />}</Card>}
          {tab === "notes" && <Card><h3 className="mb-4 font-semibold">Ghi chú</h3>{notes.length ? notes.map(note => <div key={note.id} className="border-b border-[var(--app-border)] py-3 last:border-0"><b>{note.title}</b><p className="mt-1 text-sm text-slate-500">{note.content}</p></div>) : <EmptyState />}</Card>}
          {tab === "account" && <LoginAccountTab key={`${linkedAccount?.id || "new"}:${linkedAccount?.username || ""}:${linkedAccount?.role || ""}:${String(linkedAccount?.active ?? "")}:${linkedAccount?.memberId || form.id}`} account={linkedAccount} member={form} actor={user} canManage={canManage} isCurrent={linkedAccount?.id === user.id} savedUser={savedUser} refreshed={refreshLinkedAccount} />}
          {tab === "bank" && <MemberBankAccounts member={form} user={user} />}
          {tab === "sims" && <MemberSimsPanel member={form} members={data.members} user={user} />}
          {tab === "bankRaw" && <MemberBankRawNotes member={form} user={user} />}
          {tab === "security" && <Card><h3 className="mb-4 font-semibold">Bảo mật</h3>{linkedAccount ? <div className="space-y-3"><div className="rounded-lg border border-[var(--app-border)] px-4 py-3 text-sm"><b>Ghi nhớ đăng nhập</b><p className="mt-1 text-xs text-slate-400">Thiết lập khi đăng nhập trên thiết bị này.</p></div>{personal && <button onClick={openChangePassword} className="w-full rounded-lg border border-[var(--app-border)] px-4 py-3 text-left text-sm font-semibold">Đổi mật khẩu</button>}{personal && <button onClick={logout} className="w-full rounded-lg border border-rose-200 px-4 py-3 text-left text-sm font-semibold text-rose-500">Đăng xuất khỏi thiết bị</button>}</div> : <p className="text-sm text-slate-400">Chưa có tài khoản đăng nhập.</p>}</Card>}
        </>
      )}</div></div></div>;
}
const jobStatuses: { value: MemberJobStatus; label: string }[] = [{ value: "active", label: "Đang làm" }, { value: "ended", label: "Đã nghỉ" }];
function incomeJobId(record: IncomeRecord) { return record.jobId || record.workId || ""; }
function jobIncomeForMonth(job: MemberJob, records: IncomeRecord[], month: number) {
  return records.filter(record => incomeJobId(record) === job.id && record.month === month && isReceivedIncome(record)).reduce((sum, record) => sum + record.amount, 0);
}
function jobYearTotal(job: MemberJob, records: IncomeRecord[]) {
  return records.filter(record => incomeJobId(record) === job.id && isReceivedIncome(record)).reduce((sum, record) => sum + record.amount, 0);
}
function jobYearRange(job: MemberJob) {
  return `${job.startYear || "?"} - ${job.status === "active" ? "Nay" : job.endYear || "?"}`;
}
function MemberWorkHistory({ member, user }: { member: Member; user: AuthUser }) {
  const ui = useUI();
  const canEdit = user.role === "full_access" || user.memberId === member.id;
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<MemberJob | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [response, incomeResponse] = await Promise.all([
      fetch(`/api/member-jobs?memberId=${encodeURIComponent(member.id)}`, { cache: "no-store" }),
      fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" }),
    ]);
    const result = await readJsonSafe<{ ok?: boolean; data?: MemberJob[]; error?: string }>(response);
    const incomeResult = await readJsonSafe<{ ok?: boolean; data?: { allRecords?: IncomeRecord[] }; error?: string }>(incomeResponse);
    setLoading(false);
    if (!response.ok || !result?.ok) return setError(result?.error || "Không thể tải lịch sử công việc.");
    setJobs(result.data || []);
    if (incomeResponse.ok && incomeResult?.data) setRecords((incomeResult.data.allRecords || []).filter(record => record.memberId === member.id));
  }, [member.id, year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function remove(job: MemberJob) {
    if (!await ui.confirm("Xóa công việc?", `Xóa công việc ${job.title}?`)) return;
    const response = await fetch(`/api/member-jobs?id=${encodeURIComponent(job.id)}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) return ui.toast(result?.error || "Không thể xóa công việc.", "error");
    setJobs(current => current.filter(item => item.id !== job.id));
    if (viewing?.id === job.id) setViewing(null);
    ui.toast("Đã xóa công việc");
  }
  const yearOptions = Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() - 4 + index));
  const totalYear = jobs.reduce((sum, job) => sum + jobYearTotal(job, records), 0);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold">Công việc</h3><p className="mt-1 text-sm text-slate-400">Tổng thu nhập năm {year}: <b className="text-emerald-500">{money(totalYear)}</b> · {jobs.length} công việc · {jobs.filter(job => job.status === "active").length} đang làm</p></div>
      <div className="flex flex-wrap items-center gap-2"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{yearOptions.map(value => <option key={value}>{value}</option>)}</select>{canEdit && <button onClick={() => { window.location.href = `/members/${member.id}/jobs/new`; }} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm công việc</button>}</div>
    </div>
    {error && <p className="text-sm text-rose-500">{error}</p>}
    {loading ? <Card className="p-6 text-center text-sm text-slate-400">Đang tải công việc...</Card> : jobs.length ? <div className="space-y-3">{jobs.map(job => <div key={job.id} className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-sm"><div className="absolute bottom-5 left-8 top-5 w-px bg-slate-200 dark:bg-white/10" /><div className="relative flex gap-4"><span className="mt-1 size-3 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-500/20" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-slate-400">{jobYearRange(job)}</p><h3 className="mt-1 text-base font-bold">{job.title}</h3><p className="mt-1 text-sm text-slate-500">{job.company}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${job.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{job.status === "active" ? "Đang làm" : "Đã nghỉ"}</span><b className="text-sm text-emerald-500">{money(jobYearTotal(job, records))}</b></div></div><JobActionMenu job={job} view={() => setViewing(job)} edit={() => { window.location.href = `/members/${member.id}/jobs/${job.id}/edit`; }} remove={() => void remove(job)} canEdit={canEdit} /></div></div>)}</div> : <Card className="p-8 text-center text-sm text-slate-400">Chưa có lịch sử công việc.</Card>}
    {viewing && <MemberJobDetail job={viewing} records={records} year={year} close={() => setViewing(null)} edit={() => { window.location.href = `/members/${member.id}/jobs/${viewing.id}/edit`; }} />}
  </div>;
}
function JobActionMenu({ job, view, edit, remove, canEdit }: { job: MemberJob; view: () => void; edit: () => void; remove: () => void; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const itemClass = "block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5";
  return <div className="relative flex justify-end"><button type="button" onClick={() => setOpen(current => !current)} className="grid size-10 place-items-center rounded-xl border border-[var(--app-border)] text-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5" aria-label={`Thao tác ${job.title}`}>⋯</button>{open && <div className="absolute right-0 top-11 z-30 w-40 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl"><button className={itemClass} onClick={() => { setOpen(false); view(); }}>Xem chi tiết</button>{canEdit && <button className={itemClass} onClick={() => { setOpen(false); edit(); }}>Sửa</button>}{canEdit && <button className={`${itemClass} text-rose-500`} onClick={() => { setOpen(false); remove(); }}>Xóa</button>}</div>}</div>;
}
function MemberJobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, amount: jobIncomeForMonth(job, records, index + 1) }));
  const jobRecords = records.filter(r => r.jobId === job.id);
  const [showForm, setShowForm] = useState(false);
  
  if (showForm) return <Sheet close={close}><div className="-m-6 p-6"><IncomeRecordForm record={null} members={[{id: job.memberId, name: ""}]} templates={[]} back={() => setShowForm(false)} saved={() => { setShowForm(false); window.location.reload(); }} fixedJobId={job.id} fixedMemberId={job.memberId} /></div></Sheet>;

  return <Sheet close={close}><div className="space-y-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-400">{jobYearRange(job)}</p><h2 className="mt-1 text-lg font-bold">{job.title}</h2><p className="mt-1 text-sm text-slate-400">{job.company}</p></div><button onClick={edit} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-bold">Sửa</button></div><div className="grid gap-3 sm:grid-cols-2"><AccountDetail label="Thời gian" value={jobYearRange(job)} /><AccountDetail label="Trạng thái" value={job.status === "active" ? "Đang làm" : "Đã nghỉ"} /><AccountDetail label={`Tổng thu nhập ${year}`} value={money(jobYearTotal(job, records))} /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{months.map(item => <div key={item.month} className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-slate-400">Tháng {item.month}</p><b className="text-sm text-emerald-500">{money(item.amount)}</b></div>)}</div>{job.note && <p className="rounded-xl border border-[var(--app-border)] p-4 text-sm text-slate-500">{job.note}</p>}
  
  <div>
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-bold">Lương / Thu nhập công việc</h3>
      <button onClick={() => setShowForm(true)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">+ Thêm thu nhập</button>
    </div>
    {jobRecords.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : <div className="space-y-2">{jobRecords.map(r => <div key={r.id} className="rounded-lg border border-[var(--app-border)] p-3 flex justify-between gap-3"><div><p className="text-sm font-bold">{formatDateVN(r.incomeDate)} · {r.category}</p><p className="text-sm">{r.name}</p><p className="text-xs text-slate-400">{r.note}</p></div><b className="text-emerald-500">{money(r.amount)}</b></div>)}</div>}
  </div>
  
  </div></Sheet>;
}
function MemberJobSheet({ job, memberId, year, close, saved }: { job: MemberJob | "new"; memberId: string; year: string; close: () => void; saved: (job: MemberJob) => void }) {
  const existing = job === "new" ? null : job;
  const [form, setForm] = useState<MemberJob>(() => existing || { id: "", memberId, title: "", company: "", startYear: new Date().getFullYear(), endYear: null, status: "active", note: "" });
  const [error, setError] = useState("");
  const set = <K extends keyof MemberJob>(key: K, value: MemberJob[K]) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch(form.id ? `/api/member-jobs?id=${encodeURIComponent(form.id)}` : "/api/member-jobs", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await readJsonSafe<{ ok?: boolean; data?: MemberJob; error?: string }>(response);
    if (!response.ok || !result?.data) return setError(result?.error || "Không thể lưu công việc.");
    saved(result.data);
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}>
    <form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[var(--app-card)] shadow-2xl md:max-w-3xl md:rounded-3xl">
      <div className="shrink-0 border-b border-[var(--app-border)] px-5 py-4">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 md:hidden" />
        <h2 className="text-lg font-bold">{existing ? "Sửa công việc" : "Thêm công việc"}</h2>
        <p className="mt-1 text-sm text-slate-400">Thông tin công việc và lương theo tháng trong năm {year}.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section>
          <h3 className="text-sm font-bold text-indigo-600">Thông tin công việc</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Tên công việc"><input required className={inputClass} value={form.title} onChange={event => set("title", event.target.value)} /></Field>
            <Field label="Công ty / nơi làm"><input required className={inputClass} value={form.company} onChange={event => set("company", event.target.value)} /></Field>
            <Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={event => set("status", event.target.value as MemberJobStatus)}>{jobStatuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
            <Field label="Năm bắt đầu"><input required min="1900" max="2200" type="number" className={inputClass} value={form.startYear || ""} onChange={event => set("startYear", Number(event.target.value) || null)} /></Field>
            <Field label="Năm kết thúc"><input disabled={form.status === "active"} min="1900" max="2200" type="number" className={inputClass} value={form.status === "active" ? "" : form.endYear || ""} onChange={event => set("endYear", Number(event.target.value) || null)} /></Field>
            <Field label="Ghi chú"><textarea rows={3} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field>
          </div>
        </section>
        {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
      </div>
      <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 border-t border-[var(--app-border)] bg-[var(--app-card)] px-5 py-4 shadow-[0_-8px_20px_rgba(15,23,42,.06)]">
        <button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Hủy</button>
        <button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Lưu công việc</button>
      </div>
    </form>
  </div>;
}
void MemberJobSheet;
function ConfirmMemberDelete({ member, warning, close, remove }: { member: Member; warning: string; close: () => void; remove: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-5" onMouseDown={close}><div className="w-full max-w-md rounded-2xl bg-[var(--app-card)] p-6 shadow-2xl" onMouseDown={event => event.stopPropagation()}><h2 className="text-lg font-semibold">Ẩn thành viên?</h2><p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Thành viên <b>{member.nickname || member.name}</b> sẽ được ẩn khỏi danh sách. Dữ liệu lịch sử không bị xóa.</p>{warning && <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-600 dark:bg-orange-400/10">{warning}</p>}<div className="mt-6 flex justify-end gap-3"><button onClick={close} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-semibold">Hủy</button><button onClick={remove} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white">Xác nhận ẩn</button></div></div></div>;
}
type ListProps = { data: AppData; open: (editor: Editor) => void; t: ReturnType<typeof translator> };
type FinanceProps = ListProps & { user: AuthUser; update: (data: AppData) => void };
type TaskProps = ListProps & { update: (data: AppData) => void };
function EditButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Sửa</button>; }
function TaskRow({ task, toggle, edit }: { task: Task; toggle?: () => void; edit?: () => void }) { const overdue = isOverdue(task); return <Card className="mb-3 flex items-center gap-3"><button onClick={toggle} className={`grid size-7 shrink-0 place-items-center rounded-full border ${task.status === "done" ? "border-emerald-400 bg-emerald-400 text-white" : task.status === "doing" ? "border-orange-400 bg-orange-100 text-orange-500" : "border-slate-200"}`}>{task.status === "done" && icons.check}</button><div className="min-w-0 flex-1"><b className={task.status === "done" ? "line-through opacity-50" : ""}>{task.title}</b><p className={`text-xs ${overdue ? "text-red-500" : "text-slate-400"}`}>{task.assignee} · {task.dueDate || task.due} · {overdue ? "Quá hạn" : task.status === "todo" ? "Chờ làm" : task.status === "doing" ? "Đang làm" : "Hoàn thành"} · {task.priority === "high" ? "Cao" : task.priority === "low" ? "Thấp" : "Bình thường"}</p></div>{edit && <EditButton onClick={edit} />}</Card>; }
function Tasks({ data, update, open, t }: TaskProps) {
  const [status, setStatus] = useState<Task["status"] | "all">("all");
  const toggle = (id: string) => update({ ...data, tasks: data.tasks.map(x => x.id === id ? { ...x, status: x.status === "done" ? "todo" : "done" } : x) });
  const tasks = data.tasks.filter(task => status === "all" || task.status === status);
  return <><select className={`${filterClass} mb-4 max-w-xs`} value={status} onChange={event => setStatus(event.target.value as Task["status"] | "all")}><option value="all">Tất cả công việc</option><option value="todo">Chờ</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select><div className="grid gap-x-4 md:grid-cols-2">{tasks.map(x => <TaskRow key={x.id} task={x} toggle={() => toggle(x.id)} edit={() => open({ kind: "tasks", item: x })} />)}</div><AddButton label={t("add")} onClick={() => open({ kind: "tasks" })} /></>;
}
function FinanceOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [chartMode, setChartMode] = useState<"income" | "expense" | "compare" | "savings">("compare");
  const [settingsForm, setSettingsForm] = useState({
    trackingStartMonth: "1",
    trackingStartYear: String(new Date().getFullYear()),
    openingCashBalance: "0",
    openingSavingsBalance: "0",
    openingInvestmentBalance: "0",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [overviewTooltip, setOverviewTooltip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/finance-overview?year=${yearStr}`, { cache: "no-store" });
      const result = await readJsonSafe<any>(response);
      if (response.ok) {
        setData(result?.data || result || {});
      } else {
        setData({});
        setError(result?.error || "Không thể tải tổng quan thu chi.");
      }
    } catch {
      setData({});
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [yearStr]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const overviewPayload = data || {};
  const monthlyData: any[] = Array.isArray(data)
    ? data
    : Array.isArray(overviewPayload.monthlyData)
      ? overviewPayload.monthlyData
      : Array.isArray(overviewPayload.data)
        ? overviewPayload.data
        : Array.isArray(overviewPayload.records)
          ? overviewPayload.records
          : [];

  const currentCash = Number(overviewPayload.currentCash || 0);
  const currentSavings = Number(overviewPayload.currentSavings || 0);
  const currentInvestment = Number(overviewPayload.currentInvestment || 0);
  const estimatedAssets = Number(overviewPayload.estimatedAssets || currentCash + currentSavings + currentInvestment);
  const settings = overviewPayload.settings || null;

  useEffect(() => {
    if (!settings && !overviewPayload.trackingStartMonth) return;
    setSettingsForm({
      trackingStartMonth: String(settings?.trackingStartMonth || overviewPayload.trackingStartMonth || 1),
      trackingStartYear: String(settings?.trackingStartYear || overviewPayload.trackingStartYear || new Date().getFullYear()),
      openingCashBalance: String(settings?.openingCashBalance ?? overviewPayload.openingCashBalance ?? 0),
      openingSavingsBalance: String(settings?.openingSavingsBalance ?? overviewPayload.openingSavingsBalance ?? 0),
      openingInvestmentBalance: String(settings?.openingInvestmentBalance ?? overviewPayload.openingInvestmentBalance ?? 0),
    });
  }, [settings, overviewPayload.trackingStartMonth, overviewPayload.trackingStartYear, overviewPayload.openingCashBalance, overviewPayload.openingSavingsBalance, overviewPayload.openingInvestmentBalance]);

  async function saveFinanceSettings() {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/finance-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingStartMonth: Number(settingsForm.trackingStartMonth) || 1,
          trackingStartYear: Number(settingsForm.trackingStartYear) || new Date().getFullYear(),
          openingCashBalance: parseVndInput(settingsForm.openingCashBalance),
          openingSavingsBalance: parseVndInput(settingsForm.openingSavingsBalance),
          openingInvestmentBalance: parseVndInput(settingsForm.openingInvestmentBalance),
        }),
      });
      if (response.ok) await load();
    } finally {
      setSavingSettings(false);
    }
  }

  const totalIncome = monthlyData.reduce((sum: number, d: any) => sum + (d.income || 0), 0);
  const totalExpense = monthlyData.reduce((sum: number, d: any) => sum + (d.expense || 0), 0);
  const afterExpenseTotal = monthlyData.reduce((sum: number, d: any) => sum + (d.afterExpense ?? ((d.income || 0) - (d.expense || 0))), 0);
  const cashFlowTotal = monthlyData.reduce((sum: number, d: any) => sum + (d.monthlyCashFlow ?? 0), 0);
  const savingsRate = totalIncome > 0 ? ((afterExpenseTotal / totalIncome) * 100).toFixed(1) + "%" : "N/A";
  const startDateText = formatDateVN(overviewPayload.trackingStartDate || settings?.trackingStartDate || "");
  const cashBreakdown = overviewPayload.cashBreakdown || {};
  const savingsBreakdown = overviewPayload.savingsBreakdown || {};
  const investmentBreakdown = overviewPayload.investmentBreakdown || {};
  const totalAssetBreakdown = overviewPayload.totalAssetBreakdown || {};
  const showOverviewTooltip = (event: React.MouseEvent, title: string, lines: string[]) => setOverviewTooltip({ x: event.clientX, y: event.clientY, title, lines });
  const overviewTooltipProps = (title: string, lines: string[]) => ({
    onMouseMove: (event: React.MouseEvent) => showOverviewTooltip(event, title, lines),
    onMouseLeave: () => setOverviewTooltip(null),
  });
  const overviewCard = (title: string, value: React.ReactNode, valueClass: string, lines: string[]) => (
    <Card className="cursor-help" {...overviewTooltipProps(title, lines)}>
      <p className="text-xs text-slate-400">{title}</p>
      <b className={valueClass}>{value}</b>
    </Card>
  );
  
  const maxVal = Math.max(1, ...monthlyData.map((d: any) => {
    if (chartMode === "income") return d.income || 0;
    if (chartMode === "expense") return d.expense || 0;
    if (chartMode === "savings") return Math.abs(d.monthlyCashFlow ?? ((d.income || 0) - (d.expense || 0)));
    return Math.max(d.income || 0, d.expense || 0);
  }));

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <select className={filterClass} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-[140px_140px_repeat(3,minmax(180px,1fr))_auto] md:items-end">
          <Field label="Tháng bắt đầu"><select className={inputClass} value={settingsForm.trackingStartMonth} onChange={event => setSettingsForm(current => ({ ...current, trackingStartMonth: event.target.value }))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select></Field>
          <Field label="Năm bắt đầu"><input className={inputClass} value={settingsForm.trackingStartYear} onChange={event => setSettingsForm(current => ({ ...current, trackingStartYear: event.target.value.replace(/\D/g, "") }))} /></Field>
          <Field label="Tiền hiện tại ban đầu"><input type="text" className={`${inputClass} text-right`} value={formatVndInput(settingsForm.openingCashBalance)} onChange={event => setSettingsForm(current => ({ ...current, openingCashBalance: String(parseVndInput(event.target.value)) }))} /></Field>
          <Field label="Tiết kiệm ban đầu"><input type="text" className={`${inputClass} text-right`} value={formatVndInput(settingsForm.openingSavingsBalance)} onChange={event => setSettingsForm(current => ({ ...current, openingSavingsBalance: String(parseVndInput(event.target.value)) }))} /></Field>
          <Field label="Đầu tư ban đầu"><input type="text" className={`${inputClass} text-right`} value={formatVndInput(settingsForm.openingInvestmentBalance)} onChange={event => setSettingsForm(current => ({ ...current, openingInvestmentBalance: String(parseVndInput(event.target.value)) }))} /></Field>
          <button type="button" onClick={() => void saveFinanceSettings()} disabled={savingSettings} className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">{savingSettings ? "Đang lưu..." : "Lưu cài đặt"}</button>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-600">{error}</p>
          <button onClick={() => void load()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">Làm mới</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {overviewCard("Tiền hiện tại ước tính", money(currentCash), "text-indigo-500", [
          `Từ ${startDateText}`,
          `Ban đầu: ${money(cashBreakdown.openingCashBalance ?? overviewPayload.openingCashBalance ?? 0)}`,
          `+ Thu: ${money(cashBreakdown.incomeSinceStart || 0)}`,
          `- Chi thật: ${money(cashBreakdown.realExpenseSinceStart || 0)}`,
          `- Tiết kiệm: ${money(cashBreakdown.savingTransferSinceStart || 0)}`,
          `- Mua đầu tư: ${money(cashBreakdown.investmentBuySinceStart || 0)}`,
          `+ Bán đầu tư: ${money(cashBreakdown.investmentSellSinceStart || 0)}`,
          `= ${money(currentCash)}`,
        ])}
        {overviewCard("Tiết kiệm hiện có", money(currentSavings), "text-blue-500", [
          `Từ ${startDateText}`,
          `Ban đầu: ${money(savingsBreakdown.openingSavingsBalance ?? overviewPayload.openingSavingsBalance ?? 0)}`,
          `+ Từ Chi tiêu → Tiết kiệm: ${money(savingsBreakdown.savingFromExpensesSinceStart || 0)}`,
          `+ Nhập tay: ${money(savingsBreakdown.manualSavingsSinceStart || 0)}`,
          `= ${money(currentSavings)}`,
        ])}
        {overviewCard("Đầu tư hiện có", money(currentInvestment), "text-purple-500", [
          `Từ ${startDateText}`,
          `Ban đầu: ${money(investmentBreakdown.openingInvestmentBalance ?? overviewPayload.openingInvestmentBalance ?? 0)}`,
          `+ Mua đầu tư: ${money(investmentBreakdown.investmentBuySinceStart || 0)}`,
          `- Bán/rút đầu tư: ${money(investmentBreakdown.investmentSellSinceStart || 0)}`,
          `= ${money(currentInvestment)}`,
        ])}
        {overviewCard("Tổng tài sản ước tính", money(estimatedAssets), "text-emerald-500", [
          `Tiền hiện tại: ${money(totalAssetBreakdown.currentCash ?? currentCash)}`,
          `+ Tiết kiệm: ${money(totalAssetBreakdown.currentSavings ?? currentSavings)}`,
          `+ Đầu tư: ${money(totalAssetBreakdown.currentInvestment ?? currentInvestment)}`,
          `= ${money(estimatedAssets)}`,
        ])}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {overviewCard("Tổng thu năm", money(totalIncome), "text-emerald-500", [
          `Năm ${yearStr}`,
          `Tổng tất cả khoản thu nhập: ${money(totalIncome)}`,
        ])}
        {overviewCard("Tổng chi năm", money(totalExpense), "text-rose-500", [
          `Năm ${yearStr}`,
          `Chỉ tính chi tiêu thật: ${money(totalExpense)}`,
        ])}
        {overviewCard("Dư sau chi", money(afterExpenseTotal), afterExpenseTotal >= 0 ? "text-blue-500" : "text-rose-500", [
          `Thu nhập: ${money(totalIncome)}`,
          `- Chi tiêu thật: ${money(totalExpense)}`,
          `= ${money(afterExpenseTotal)}`,
        ])}
        <Card><p className="text-xs text-slate-400">Tỷ lệ tiết kiệm</p><b className="text-indigo-500">{savingsRate}</b></Card>
        {overviewCard("Dòng tiền thực còn", money(cashFlowTotal), cashFlowTotal >= 0 ? "text-emerald-500" : "text-rose-500", [
          `Thu nhập: ${money(totalIncome)}`,
          `- Chi tiêu thật: ${money(totalExpense)}`,
          `- Tiết kiệm: ${money(monthlyData.reduce((sum: number, d: any) => sum + (d.savingsInExpense || 0), 0))}`,
          `- Mua đầu tư: ${money(monthlyData.reduce((sum: number, d: any) => sum + (d.investmentBuy || 0), 0))}`,
          `+ Bán đầu tư: ${money(monthlyData.reduce((sum: number, d: any) => sum + (d.investmentSell || 0), 0))}`,
          `= ${money(cashFlowTotal)}`,
        ])}
      </div>

      {overviewTooltip && (
        <div
          className="pointer-events-none fixed z-[100] max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xl"
          style={{ left: overviewTooltip.x + 14, top: overviewTooltip.y + 14 }}
        >
          <p className="font-bold text-slate-900">{overviewTooltip.title}</p>
          <div className="mt-1 space-y-0.5 whitespace-pre-line">
            {overviewTooltip.lines.map((line, index) => <p key={index} className={line.startsWith("=") ? "font-bold text-slate-900" : ""}>{line}</p>)}
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <b>Biểu đồ Tổng quan</b>
            {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => setChartMode("income")} className={`rounded-full px-3 py-1 font-bold ${chartMode === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>Thu nhập</button>
            <button onClick={() => setChartMode("expense")} className={`rounded-full px-3 py-1 font-bold ${chartMode === "expense" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>Chi tiêu</button>
            <button onClick={() => setChartMode("compare")} className={`rounded-full px-3 py-1 font-bold ${chartMode === "compare" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>So sánh</button>
            <button onClick={() => setChartMode("savings")} className={`rounded-full px-3 py-1 font-bold ${chartMode === "savings" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}`}>Dòng tiền</button>
          </div>
        </div>
        <div className="flex h-64 w-full items-end justify-between gap-1 overflow-x-auto pb-2 md:justify-center md:gap-4 lg:gap-6">
          {monthlyData.map((item: any) => {
            const itemSavings = item.monthlyCashFlow ?? ((item.income || 0) - (item.expense || 0));
            return (
            <div key={item.month} className="flex min-w-[30px] flex-1 flex-col items-center gap-2 md:max-w-[60px]">
              <div className="flex h-[240px] w-full items-end justify-center gap-0.5 md:gap-1">
                {(chartMode === "income" || chartMode === "compare") && <div className="w-full rounded-t-md bg-emerald-500" style={{ height: `${Math.max(2, ((item.income || 0) / maxVal) * 100)}%` }} title={`Thu: ${money(item.income || 0)}`} />}
                {(chartMode === "expense" || chartMode === "compare") && <div className="w-full rounded-t-md bg-rose-500" style={{ height: `${Math.max(2, ((item.expense || 0) / maxVal) * 100)}%` }} title={`Chi: ${money(item.expense || 0)}`} />}
                {chartMode === "savings" && <div className={`w-full rounded-t-md ${itemSavings >= 0 ? "bg-blue-500" : "bg-orange-500"}`} style={{ height: `${Math.max(2, (Math.abs(itemSavings) / maxVal) * 100)}%` }} title={`Dòng tiền: ${money(itemSavings)}`} />}
              </div>
              <span className="text-[10px] font-bold text-slate-400 md:text-xs">T{item.month}</span>
            </div>
          )})}
          {!monthlyData.length && !loading && <div className="w-full text-center text-sm text-slate-400">Chưa có dữ liệu.</div>}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--app-border)] p-4">
          <b>Dòng tiền tháng</b>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">Tháng</th>
                <th className="px-4 py-3 text-right">Thu nhập</th>
                <th className="px-4 py-3 text-right">Chi tiêu</th>
                <th className="px-4 py-3 text-right">Dư sau chi</th>
                <th className="px-4 py-3 text-right">Tiết kiệm trong chi</th>
                <th className="px-4 py-3 text-right">Đầu tư ròng</th>
                <th className="px-4 py-3 text-right">Dòng tiền thực còn</th>
                <th className="px-4 py-3 text-right">Tiền lũy kế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {monthlyData.map((item: any) => {
                const income = item.income || 0;
                const expense = item.expense || 0;
                const savingsInExpense = item.savingsInExpense || 0;
                const netInvestment = item.netInvestment || 0;
                const duSauChi = item.afterExpense ?? (income - expense);
                const conLai = item.monthlyCashFlow ?? (duSauChi - netInvestment);
                const cumulativeCash = item.cumulativeCash ?? 0;
                return (
                  <tr key={item.month} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">Tháng {item.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{money(income)}</td>
                    <td className="px-4 py-3 text-right text-rose-500">{money(expense)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(duSauChi)}</td>
                    <td className="px-4 py-3 text-right text-blue-500">{money(savingsInExpense)}</td>
                    <td className="px-4 py-3 text-right text-purple-500">{money(netInvestment)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-200">{money(conLai)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">{money(cumulativeCash)}</td>
                  </tr>
                );
              })}
              {!monthlyData.length && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
  </div>
  );
}

const getRecordTime = (r: any) => new Date(
  r.date ||
  r.received_date ||
  r.expense_date ||
  r.trade_date ||
  r.created_at ||
  r.incomeDate ||
  r.receivedDate ||
  r.expenseDate ||
  r.tradeDate ||
  r.createdAt ||
  (r.year && r.month ? `${r.year}-${String(r.month).padStart(2, "0")}-01` : "") ||
  r.created_at ||
  0
).getTime();

const sortRecordsAsc = (a: any, b: any) => {
  const da = getRecordTime(a);
  const db = getRecordTime(b);
  if (da !== db) return da - db;
  return new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime();
};

function Finance({ data, open, t, user, update }: FinanceProps) {
  const [tab, setTab] = useState<"overview" | "income" | "expense" | "savings" | "investment">("overview");
  return (
    <>
      <div className="mb-4 flex max-w-full gap-2 overflow-x-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1 text-sm font-bold [-webkit-overflow-scrolling:touch] md:inline-flex">
        <button onClick={() => setTab("overview")} className={`shrink-0 rounded-lg px-4 py-2 ${tab === "overview" ? "bg-indigo-500 text-white" : "text-slate-500"}`}>Tổng quan</button>
        <button onClick={() => setTab("income")} className={`shrink-0 rounded-lg px-4 py-2 ${tab === "income" ? "bg-emerald-500 text-white" : "text-slate-500"}`}>Thu nhập</button>
        <button onClick={() => setTab("expense")} className={`shrink-0 rounded-lg px-4 py-2 ${tab === "expense" ? "bg-rose-500 text-white" : "text-slate-500"}`}>Chi tiêu</button>
        <button onClick={() => setTab("savings")} className={`shrink-0 rounded-lg px-4 py-2 ${tab === "savings" ? "bg-blue-500 text-white" : "text-slate-500"}`}>Tiết kiệm</button>
        <button onClick={() => setTab("investment")} className={`shrink-0 rounded-lg px-4 py-2 ${tab === "investment" ? "bg-purple-500 text-white" : "text-slate-500"}`}>Đầu tư</button>
      </div>
      {tab === "overview" && <FinanceOverview />}
      {tab === "income" && <IncomeSheetManagement user={user} />}
      {tab === "expense" && <ExpenseSheetManagement data={data} update={update} user={user} />}
      {tab === "savings" && <SavingsSheet />}
      {tab === "investment" && <InvestmentSheet />}
    </>
  );
}

function InstallPromptBanner({ promptEvent, dismissed, onDismiss }: { promptEvent: BeforeInstallPromptEvent | null; dismissed: boolean; onDismiss: () => void }) {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    setIos(/iphone|ipad|ipod/.test(ua) && !standalone);
  }, []);
  if (dismissed || (!promptEvent && !ios)) return null;
  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    onDismiss();
  }
  return <div className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-7xl rounded-2xl border border-indigo-100 bg-[#EEF2FF] px-4 py-3 text-sm font-semibold text-[#4F46E5] shadow-sm md:mt-4 md:w-[calc(100%-4rem)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span>{ios ? "Cài Family Hub: mở Chia sẻ → Thêm vào Màn hình chính." : "Cài đặt ứng dụng Family Hub để dùng nhanh trên điện thoại."}</span>
      <div className="flex shrink-0 gap-2">
        {promptEvent && <button type="button" onClick={() => void install()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">Cài đặt ứng dụng</button>}
        <button type="button" onClick={onDismiss} className="rounded-xl px-3 py-2 text-xs font-bold text-indigo-500 hover:bg-white/60">Để sau</button>
      </div>
    </div>
  </div>;
}

function InvestmentSheet() {
  const [data, setData] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/investments", { cache: "no-store" });
      const result = await readJsonSafe<any>(response);
      if (!response.ok) {
        setData([]);
        setError(result?.error || "Không thể tải dữ liệu đầu tư.");
      } else {
        const payload = result || {};
        const investmentRecords = Array.isArray(result)
          ? result
          : Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload.records)
              ? payload.records
              : [];
        setData(investmentRecords);
      }
    } catch {
      setData([]);
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const records = data.filter(record => {
    const recordYear = new Date(record.tradeDate || record.createdAt || 0).getFullYear();
    const haystack = `${record.stockCode || ""} ${record.action || ""} ${record.note || ""}`.toLocaleLowerCase();
    return String(recordYear) === yearStr && (!normalizedQuery || haystack.includes(normalizedQuery));
  }).sort(sortRecordsAsc);
  const totalBuy = records.filter(record => record.action === "buy").reduce((sum, record) => sum + Number(record.quantity || 0) * Number(record.price || 0) + Number(record.fee || 0), 0);
  const totalSell = records.filter(record => record.action === "sell").reduce((sum, record) => sum + Number(record.quantity || 0) * Number(record.price || 0) - Number(record.fee || 0), 0);
  const netInvestment = totalBuy - totalSell;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <select className={`${filterClass} md:w-[120px]`} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
        <input className={`${filterClass} flex-1`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm mã cổ phiếu..." />
        <button className="w-full whitespace-nowrap rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700 md:w-auto">+ Thêm đầu tư</button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-semibold text-slate-400">Tổng mua</p><b className="mt-1 block text-xl text-purple-500">{money(totalBuy)}</b></Card>
        <Card><p className="text-xs font-semibold text-slate-400">Tổng bán</p><b className="mt-1 block text-xl text-emerald-500">{money(totalSell)}</b></Card>
        <Card><p className="text-xs font-semibold text-slate-400">Đầu tư ròng</p><b className="mt-1 block text-xl text-slate-700 dark:text-slate-200">{money(netInvestment)}</b></Card>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-600">{error}</p>
          <button onClick={() => void load()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">Làm mới</button>
        </div>
      )}

      {!error && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4">
            <b>Danh sách đầu tư</b>
            {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Giá</th>
                  <th className="px-4 py-3 text-right">Phí</th>
                  <th className="px-4 py-3 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {records.map(record => {
                  const value = Number(record.quantity || 0) * Number(record.price || 0) + (record.action === "buy" ? Number(record.fee || 0) : -Number(record.fee || 0));
                  return (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3">{formatDateVN(record.tradeDate)}</td>
                      <td className="px-4 py-3 font-semibold">{record.stockCode}</td>
                      <td className="px-4 py-3">{record.action === "buy" ? "Mua" : "Bán"}</td>
                      <td className="px-4 py-3 text-right">{Number(record.quantity || 0).toLocaleString("vi-VN")}</td>
                      <td className="px-4 py-3 text-right">{money(Number(record.price || 0))}</td>
                      <td className="px-4 py-3 text-right">{money(Number(record.fee || 0))}</td>
                      <td className={`px-4 py-3 text-right font-bold ${record.action === "buy" ? "text-purple-500" : "text-emerald-500"}`}>{money(value)}</td>
                    </tr>
                  );
                })}
                {!loading && records.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">Chưa có giao dịch đầu tư.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SavingsSheet() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [query, setQuery] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(() => new Set());
  const [savingType, setSavingType] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/savings-records`, { cache: "no-store" });
      const result = await readJsonSafe<any>(response);
      if (!response.ok) {
        setError(result?.error || "Không thể tải dữ liệu tiết kiệm.");
        setData([]);
      } else {
        const payload = result || {};
        const savingsRecords = Array.isArray(result)
          ? result
          : Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload.records)
              ? payload.records
              : [];
        setData(savingsRecords);
      }
    } catch (err) {
      setData([]);
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const yearRecords = data.filter(r => String(r.year) === yearStr);
  const filteredRecords = yearRecords.filter(r => {
    const q = query.toLowerCase();
    if (savingType !== "all" && String(r.type || "monthly") !== savingType) return false;
    return !q || (r.description?.toLowerCase().includes(q) || r.note?.toLowerCase().includes(q) || r.holder?.toLowerCase().includes(q));
  }).sort(sortRecordsAsc);

  const totalAllTime = data.reduce((sum, r) => sum + (r.type === 'withdraw' ? -Number(r.amount || 0) : Number(r.amount || 0)), 0);
  const totalYear = yearRecords.reduce((sum, r) => sum + (r.type === 'withdraw' ? -Number(r.amount || 0) : Number(r.amount || 0)), 0);
  const totalFiltered = filteredRecords.reduce((sum, r) => sum + (r.type === 'withdraw' ? -Number(r.amount || 0) : Number(r.amount || 0)), 0);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const monthSummaryRows = months.map(month => {
    const items = filteredRecords.filter(record => Number(record.month) === month).sort(sortRecordsAsc);
    return {
      month,
      items,
      total: items.reduce((sum, record) => sum + (record.type === "withdraw" ? -Number(record.amount || 0) : Number(record.amount || 0)), 0),
      count: items.length,
    };
  });
  function toggleMonth(month: number) {
    setExpandedMonths(current => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }
  function savingsRecordDate(record: any) {
    const value = record.date || record.savingDate || record.saving_date || record.createdAt || record.created_at || "";
    if (value) return formatDateVN(value);
    return `${String(record.month || "").padStart(2, "0")}/${record.year || yearStr}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <select className={`${filterClass} md:w-[120px]`} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
        <select className={`${filterClass} md:w-[180px]`} value={savingType} onChange={event => setSavingType(event.target.value)}>
          <option value="all">Khoản tiết kiệm</option>
          <option value="monthly">Gửi tiết kiệm</option>
          <option value="withdraw">Rút tiết kiệm</option>
        </select>
        <input className={`${filterClass} flex-1`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm khoản tiết kiệm..." />
        <button className="w-full whitespace-nowrap rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 md:w-auto">+ Thêm tiết kiệm</button>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
        Tiết kiệm hằng tháng nên nhập từ Chi tiêu → Tiết kiệm để dòng tiền tổng quan chính xác.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-semibold text-slate-400">Tiết kiệm hiện có</p><b className="mt-1 block text-xl text-blue-500">{money(totalAllTime)}</b></Card>
        <Card><p className="text-xs font-semibold text-slate-400">Tiết kiệm năm {yearStr}</p><b className="mt-1 block text-xl text-emerald-500">{money(totalYear)}</b></Card>
        <Card><p className="text-xs font-semibold text-slate-400">Khoản đang lọc</p><b className="mt-1 block text-xl text-slate-700 dark:text-slate-200">{money(totalFiltered)}</b></Card>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-600">{error}</p>
          <button onClick={() => void load()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">Làm mới</button>
        </div>
      )}

      {!error && (
        <Card className="overflow-visible p-0">
          <div className="border-b border-[var(--app-border)] px-4 py-3">
            <b className="font-semibold text-slate-800 dark:text-slate-100">Danh sách theo tháng</b>
          </div>
          {loading && <div className="text-center text-sm text-slate-400 py-4">Đang tải dữ liệu...</div>}
          {!loading && (
            <div className="divide-y divide-[var(--app-border)]">
              {monthSummaryRows.map(row => {
                const expanded = expandedMonths.has(row.month);
                return (
                  <div key={row.month} className="px-4 py-2.5">
                    <button type="button" onClick={() => toggleMonth(row.month)} className="grid w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:grid-cols-[1fr_120px_100px_32px]">
                      <b className="font-semibold text-slate-800 dark:text-slate-100">Tháng {row.month}</b>
                      <span className={`font-bold sm:text-right ${row.total < 0 ? "text-rose-500" : "text-blue-500"}`}>{money(row.total)}</span>
                      <span className="text-sm font-medium text-slate-500 sm:text-right">{row.count} khoản</span>
                      <span className="grid size-8 place-items-center rounded-lg text-slate-500" aria-hidden><svg viewBox="0 0 24 24" className={`size-4 fill-none stroke-current stroke-2 transition-transform ${expanded ? "rotate-180" : ""}`} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
                    </button>
                    {expanded && (
                      <div className="mt-1 divide-y divide-[var(--app-border)]">
                        {row.items.length === 0 ? (
                          <div className="p-4 text-center text-sm font-medium text-slate-500">Chưa có khoản nào trong tháng này.</div>
                        ) : row.items.map(item => (
                          <div key={item.id} className="group relative flex flex-col gap-1 px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                            <div className="w-[90px] shrink-0 text-xs font-medium text-slate-500">{savingsRecordDate(item)}</div>
                            <div className="w-[110px] shrink-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-400">{item.type || "monthly"}</div>
                            <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100" title={item.description || item.note || "Chưa có nội dung"}>{item.description || "Chưa có nội dung"}</div>
                            <div className="w-[120px] shrink-0 truncate text-xs font-medium text-slate-400" title={item.holder || "Không rõ"}>{item.holder || "Không rõ"}</div>
                            <div className={`w-[110px] shrink-0 text-right text-sm font-bold ${item.type === "withdraw" ? "text-rose-500" : "text-blue-500"}`}>{item.type === "withdraw" ? "-" : "+"}{money(Number(item.amount || 0))}</div>
                            <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-lg font-semibold text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">...</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
type IncomeApiData = {
  members: { id: string; name: string }[];
  sources: IncomeSource[];
  jobs?: MemberJob[];
  sourceTemplates?: string[];
  records?: IncomeRecord[];
  allRecords: IncomeRecord[];
  yearlySummaries?: IncomeYearlySummaryRow[];
  yearlyComparison?: { year: number; total: number }[];
  stats?: { byCategory?: Record<string, number> };
};
const emptyIncomeApiData: IncomeApiData = { members: [], sources: [], jobs: [], sourceTemplates: [], records: [], allRecords: [], yearlySummaries: [], yearlyComparison: [], stats: { byCategory: {} } };
function normalizeIncomeApiData(value: unknown): IncomeApiData {
  if (Array.isArray(value)) return { ...emptyIncomeApiData, records: value as IncomeRecord[], allRecords: value as IncomeRecord[] };
  if (!value || typeof value !== "object") return { ...emptyIncomeApiData };
  const data = value as Partial<IncomeApiData>;
  return {
    ...emptyIncomeApiData,
    ...data,
    members: Array.isArray(data.members) ? data.members : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    sourceTemplates: Array.isArray(data.sourceTemplates) ? data.sourceTemplates : [],
    records: Array.isArray(data.records) ? data.records : Array.isArray(data.allRecords) ? data.allRecords : [],
    allRecords: Array.isArray(data.allRecords) ? data.allRecords : Array.isArray(data.records) ? data.records : [],
    yearlySummaries: Array.isArray(data.yearlySummaries) ? data.yearlySummaries : [],
    yearlyComparison: Array.isArray(data.yearlyComparison) ? data.yearlyComparison : [],
  };
}
async function fetchIncomeApiData(year: string): Promise<IncomeApiData> {
  try {
    const response = await fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" });
    const result = await readJsonSafe<unknown>(response);
    if (!response.ok) {
      if (process.env.NODE_ENV === "development") console.warn("[income] load fallback", { status: response.status, body: result });
      return { ...emptyIncomeApiData };
    }
    const payload = result && typeof result === "object" && "data" in result ? result.data : result;
    console.log("[income] GET raw", payload);
    const data = normalizeIncomeApiData(payload);
    const rows = Array.isArray(data.allRecords) ? data.allRecords : [];
    console.log("[income] rows after map", rows);
    return data;
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.warn("[income] load fallback", error);
    return { ...emptyIncomeApiData };
  }
}
const incomeCategories: IncomeCategory[] = ["Lương", "Thưởng", "Tiền lễ", "Đầu tư", "Cổ tức", "Bán chứng khoán/rút tiền về", "Khác"];
const incomeTemplates = ["Lương CB", "Lương KQCV", "Thưởng", "Tiền lễ", "Khác"];
function isReceivedIncome(record: IncomeRecord) {
  const value = String(record.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  return !value || !value.includes("chua");
}
type IncomeRecordWithJob = IncomeRecord & { jobTitle?: string | null; jobCompany?: string | null };
function shortCompanyName(value: string) {
  const text = value.trim();
  if (!text) return "";
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  if (normalized.includes("tan son nhat")) return "TSN";
  const words = text.split(/\s+/).filter(Boolean);
  return words.length > 4 ? words.map(word => word[0]).join("").toUpperCase() : text;
}
function incomeJobTitle(record: IncomeRecord) {
  const item = record as IncomeRecordWithJob;
  return String(item.jobTitle || record.jobName || record.workName || "").split(/\s+[\u00b7\ufffd]\s+/)[0] || "";
}
function incomeJobCompany(record: IncomeRecord) {
  const item = record as IncomeRecordWithJob;
  const explicitCompany = String(item.jobCompany || "").trim();
  if (explicitCompany) return explicitCompany;
  const full = String(record.jobName || record.workName || "");
  return /\s+[\u00b7\ufffd]\s+/.test(full) ? full.split(/\s+[\u00b7\ufffd]\s+/).slice(1).join(" · ").trim() : "";
}
function incomeJobShortLabel(record: IncomeRecord) {
  const title = incomeJobTitle(record);
  if (!title) return "Không gắn công việc";
  const company = shortCompanyName(incomeJobCompany(record));
  return company ? `${title} · ${company}` : title;
}
function incomeJobFullLabel(record: IncomeRecord) {
  const title = incomeJobTitle(record);
  if (!title) return "Không gắn công việc";
  const company = incomeJobCompany(record);
  return company ? `${title}\n${company}` : title;
}
const incomeTypeLabel: Record<IncomeSourceType, string> = { fixed: "Cố định", variable: "Không cố định" };
const frequencyLabel: Record<IncomeFrequency, string> = { monthly: "Hàng tháng", weekly: "Hàng tuần", yearly: "Hàng năm", one_time: "Một lần", custom: "Tùy chỉnh" };
type IncomeDraft = { id?: string; memberId: string; jobId: string; incomeDate: string; category: IncomeCategory; name: string; amount: string; status: IncomeStatus; note: string; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MonthlyTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[var(--app-card)]">
        <p className="mb-2 font-bold text-slate-700 dark:text-slate-200">{data.monthName}</p>
        {Object.entries(data.details).map(([name, val]) => (
          <div key={name} className="flex justify-between gap-4 text-xs">
            <span className="text-slate-500">{name}</span>
            <span className="font-semibold text-emerald-600">{money(val as number)}</span>
          </div>
        ))}
        <div className="mt-2 border-t border-slate-100 pt-2 text-sm font-bold text-emerald-500 dark:border-white/10">
          Tổng: {money(data.total)}
        </div>
      </div>
    );
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function YearlyTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[var(--app-card)]">
        <p className="mb-2 font-bold text-slate-700 dark:text-slate-200">Năm {data.year}</p>
        <div className="flex justify-between gap-4 text-sm font-bold text-indigo-500">
          <span>Tổng thu:</span>
          <span>{money(data.total)}</span>
        </div>
        {data.diff !== undefined && (
          <div className="mt-2 text-xs">
            <span className="text-slate-500">So với năm {data.year - 1}: </span>
            <span className={`font-semibold ${data.diff > 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {data.diff > 0 ? "↑" : "↓"} {money(Math.abs(data.diff))} ({data.percent})
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
}


function IncomeSheetManagement({ user }: { user: AuthUser }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [monthFilter, setMonthFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [incomeData, setIncomeData] = useState<IncomeApiData | null>(null);
  const [view, setView] = useState<"list" | "new" | "edit" | "yearly-new" | "yearly-edit">("list");
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [editingYearly, setEditingYearly] = useState<IncomeYearlySummaryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIncomeMenuId, setActiveIncomeMenuId] = useState<string | null>(null);
  const [expandedIncomeIds, setExpandedIncomeIds] = useState<Set<string>>(() => new Set());
  const [detailIncome, setDetailIncome] = useState<IncomeRecord | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<IncomeRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => setToast({ message, type }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setIncomeData(await fetchIncomeApiData(year)); }
    finally { setLoading(false); }
  }, [year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const allRecords = incomeData?.allRecords || [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const jobSourceMap = new Map<string, { id: string; label: string; total: number }>();
  let otherSourceTotal = 0;
  allRecords.filter(isReceivedIncome).forEach(record => {
    const jobId = record.jobId || record.workId || "";
    if (jobId) {
      const current = jobSourceMap.get(jobId) || { id: jobId, label: incomeJobShortLabel(record), total: 0 };
      current.total += record.amount;
      jobSourceMap.set(jobId, current);
    } else otherSourceTotal += record.amount;
  });
  const sourceOptions = Array.from(jobSourceMap.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));

  const sourceFilteredRecords = allRecords.filter(record => {
    const jobId = record.jobId || record.workId || "";
    if (sourceFilter === "other") return !jobId;
    if (sourceFilter.startsWith("job:")) return jobId === sourceFilter.slice(4);
    return true;
  });
  const records = sourceFilteredRecords.filter(record => {
    const jobText = incomeJobShortLabel(record) + " " + incomeJobFullLabel(record) + " " + incomeJobCompany(record);
    const haystack = (record.name + " " + record.note + " " + (record.memberName || "") + " " + jobText).toLocaleLowerCase();
    return (monthFilter === "all" || record.month === Number(monthFilter)) && (!normalizedQuery || haystack.includes(normalizedQuery));
  }).sort(sortRecordsAsc);

  const receivedRecords = sourceFilteredRecords.filter(isReceivedIncome);
  const currentYearSummaries = sourceFilter === "all" ? (incomeData?.yearlySummaries || []).filter(item => String(item.year) === year) : [];
  const yearlySummariesTotal = currentYearSummaries.reduce((sum, item) => sum + item.amount, 0);
  const totalYear = receivedRecords.reduce((sum, record) => sum + record.amount, 0) + yearlySummariesTotal;
  const selectedMonth = monthFilter === "all" ? String(new Date().getMonth() + 1) : monthFilter;
  const totalMonth = receivedRecords.filter(record => record.month === Number(selectedMonth)).reduce((sum, record) => sum + record.amount, 0);
  const totalOther = receivedRecords.filter(record => !(record.jobId || record.workId)).reduce((sum, record) => sum + record.amount, 0);
  const activeJobCount = new Set(receivedRecords.map(record => record.jobId || record.workId || "").filter(Boolean)).size;
  const monthSummaryRows = Array.from({ length: 12 }, (_, index) => {
    const itemMonth = index + 1;
    const items = records.filter(record => record.month === itemMonth);
    return { month: itemMonth, items, total: items.filter(isReceivedIncome).reduce((sum, record) => sum + record.amount, 0), count: items.length };
  });

  function toggleIncomeDetail(id: string) {
    setExpandedIncomeIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmDeleteIncome() {
    if (!deletingIncome) return;
    const response = await fetch('/api/incomes?id=' + encodeURIComponent(deletingIncome.id), { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string; details?: string }>(response);
    if (!response.ok) {
      showToast(result?.error || result?.details || "Không thể xóa khoản thu.", "error");
      return;
    }
    setDeletingIncome(null);
    setActiveIncomeMenuId(null);
    await load();
    showToast("Đã xóa khoản thu");
  }

  function edit(record: IncomeRecord) { setEditing(record); setView("edit"); setActiveIncomeMenuId(null); }
  function exportExcel() {
    const rows = [["Ngày nhận", "Tháng", "Nguồn thu", "Loại", "Nội dung", "Số tiền", "Ghi chú"]];
    records.forEach(record => rows.push([formatDateVN(record.incomeDate || record.receivedDate), String(record.month), incomeJobShortLabel(record), record.category, record.name, String(record.amount), record.note]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Thu nhập");
    XLSX.writeFile(wb, "thu-nhap-" + year + ".xlsx");
  }

  const toastNode = toast && <div className="fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm font-semibold shadow-2xl sm:right-6 sm:top-6"><span className={toast.type === "success" ? "text-emerald-600" : "text-rose-600"}>{toast.message}</span></div>;

  if (view === "new" || view === "edit") return <>{toastNode}<IncomeRecordForm record={editing} members={incomeData?.members || []} templates={incomeData?.sourceTemplates || incomeTemplates} user={user} back={() => { setView("list"); setEditing(null); }} saved={() => { const wasEditing = Boolean(editing); setView("list"); setEditing(null); void load(); showToast(wasEditing ? "Đã cập nhật khoản thu" : "Đã thêm khoản thu"); }} notify={showToast} /></>;
  if (view === "yearly-new" || view === "yearly-edit") return <>{toastNode}<YearlyIncomeForm record={editingYearly} back={() => { setView("list"); setEditingYearly(null); }} saved={() => { setView("list"); setEditingYearly(null); void load(); }} /></>;

  return <div className="space-y-5 font-sans">
    {toastNode}
    <div className="grid gap-3 md:grid-cols-[90px_120px_220px_minmax(220px,1fr)_auto_auto]">
      <select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select>
      <select className={filterClass} value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">Tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
      <select className={filterClass} value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="all" hidden>Nguồn thu</option><optgroup label="Nguồn thu"><option value="all">Tất cả</option>{sourceOptions.map(source => <option key={source.id} value={"job:" + source.id}>{source.label}</option>)}{otherSourceTotal > 0 && <option value="other">Khác</option>}</optgroup></select>
      <input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm nội dung, công việc, nơi làm, ghi chú..." />
      <button onClick={() => { setEditing(null); setView("new"); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white">Thêm thu nhập</button>
      <button onClick={exportExcel} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-600">Xuất Excel</button>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card><p className="text-xs text-slate-500">Tổng thu nhập năm</p><b className="font-semibold text-emerald-600">{money(totalYear)}</b></Card>
      <Card><p className="text-xs text-slate-500">Tổng thu tháng {selectedMonth}</p><b className="font-semibold text-slate-900 dark:text-slate-100">{money(totalMonth)}</b></Card>
      <Card><p className="text-xs text-slate-500">Tổng thu khác</p><b className="font-semibold text-slate-900 dark:text-slate-100">{money(totalOther)}</b></Card>
      <Card><p className="text-xs text-slate-500">Số công việc có thu</p><b className="font-semibold text-slate-900 dark:text-slate-100">{activeJobCount}</b></Card>
    </div>


    <Card className="overflow-visible p-0"><div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3"><b className="font-semibold text-slate-800 dark:text-slate-100">Danh sách theo tháng</b>{loading && <span className="text-xs text-slate-500">Đang tải...</span>}</div><div className="divide-y divide-[var(--app-border)]">{monthSummaryRows.map(row => { const expanded = expandedIncomeIds.has("month-" + row.month); return <div key={row.month} className="px-4 py-2.5"><button type="button" onClick={() => toggleIncomeDetail("month-" + row.month)} className="grid w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:grid-cols-[1fr_120px_100px_32px]"><b className="font-semibold text-slate-800 dark:text-slate-100">Tháng {row.month}</b><span className="font-bold text-emerald-600 sm:text-right">{money(row.total)}</span><span className="text-sm font-medium text-slate-500 sm:text-right">{row.count} khoản</span><span className="grid size-8 place-items-center rounded-lg text-slate-500" aria-hidden><svg viewBox="0 0 24 24" className={"size-4 fill-none stroke-current stroke-2 transition-transform " + (expanded ? "rotate-180" : "")} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span></button>{expanded && <div className="mt-1 divide-y divide-[var(--app-border)]">{row.items.length === 0 ? <div className="p-4 text-center text-sm font-medium text-slate-500">Chưa có khoản nào trong tháng này.</div> : row.items.map(record => { const menuOpen = activeIncomeMenuId === record.id; return <div key={record.id} className="flex items-start justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-500">{formatDateVN(record.incomeDate || record.receivedDate)} · {incomeJobShortLabel(record)} · {record.category}</p><p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{record.name || record.note || "Không có nội dung"}</p>{record.note && <p className="mt-0.5 truncate text-xs text-slate-500">{record.note}</p>}</div><div className="flex shrink-0 items-start gap-2"><b className="whitespace-nowrap text-sm font-semibold text-emerald-600 sm:text-base">{money(record.amount)}</b><div className="relative"><button type="button" onClick={() => setActiveIncomeMenuId(menuOpen ? null : record.id)} className="grid size-9 place-items-center rounded-xl border border-[var(--app-border)] text-lg font-semibold text-slate-500">...</button>{menuOpen && <div className="absolute right-0 top-10 z-30 w-36 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl"><button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { setActiveIncomeMenuId(null); setDetailIncome(record); }}>Xem chi tiết</button><button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => edit(record)}>Sửa</button><button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5" onClick={() => { setActiveIncomeMenuId(null); setDeletingIncome(record); }}>Xóa</button></div>}</div></div></div>; })}</div>}</div>; })}</div></Card>
    {detailIncome && <IncomeRecordDetailDialog record={detailIncome} close={() => setDetailIncome(null)} />}
    {deletingIncome && <IncomeDeleteDialog record={deletingIncome} close={() => setDeletingIncome(null)} confirm={() => void confirmDeleteIncome()} />}
  </div>;
}

function IncomeRecordDetailDialog({ record, close }: { record: IncomeRecord; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-0 md:p-4" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-[var(--app-card)] p-5 font-sans shadow-2xl md:rounded-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chi tiết khoản thu</h3><button onClick={close} className="grid size-9 place-items-center rounded-full border border-[var(--app-border)] text-slate-500">×</button></div><div className="mt-4 grid gap-3 text-sm"><AccountDetail label="Nguồn thu" value={incomeJobFullLabel(record)} /><AccountDetail label="Ngày nhận" value={formatDateVN(record.incomeDate || record.receivedDate)} /><AccountDetail label="Loại" value={record.category} /><AccountDetail label="Nội dung" value={record.name || "Không có nội dung"} /><AccountDetail label="Số tiền" value={money(record.amount)} /><div className="rounded-xl border border-[var(--app-border)] p-4"><p className="text-xs font-semibold uppercase text-slate-500">Ghi chú</p><p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{record.note || "Không có"}</p></div></div></div></div>;
}

function IncomeDeleteDialog({ record, close, confirm }: { record: IncomeRecord; close: () => void; confirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 font-sans" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[var(--app-card)] p-5 shadow-2xl"><h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bạn có chắc muốn xóa khoản thu này?</h3><div className="mt-4 rounded-xl border border-[var(--app-border)] p-4"><b className="font-medium text-slate-900 dark:text-slate-100">{record.name || "Khoản thu"}</b><p className="mt-1 text-sm font-semibold text-emerald-600">{money(record.amount)}</p></div><div className="mt-5 flex justify-end gap-3"><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold">Hủy</button><button onClick={confirm} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white">Xóa</button></div></div></div>;
}

function YearlyIncomeForm({ record, back, saved }: { record: IncomeYearlySummaryRow | null; back: () => void; saved: () => void }) {
  const ui = useUI();
  const currentYear = new Date().getFullYear();
  type YearlyDraft = { id?: string; year: number; category: IncomeCategory; name: string; amount: string; note: string };
  const emptyRow = (): YearlyDraft => ({ year: currentYear - 1, category: "Lương", name: "Tổng lương năm", amount: "", note: "" });
  const [draft, setDraft] = useState<YearlyDraft>(() => record ? { id: record.id, year: record.year, category: record.category, name: record.name, amount: String(record.amount), note: record.note } : emptyRow());
  
  function patch(value: Partial<YearlyDraft>) { setDraft(current => ({ ...current, ...value })); }
  
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rawAmount = String(draft.amount).replace(/\D/g, "");
    if (!rawAmount) { ui.toast("Vui lòng nhập số tiền hợp lệ.", "error"); return; }
    const payload = { ...draft, amount: Number(rawAmount) };
    const response = await fetch(record ? `/api/incomes-yearly?id=${encodeURIComponent(record.id)}` : "/api/incomes-yearly", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? payload : { rows: [payload] }) });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) { ui.toast(result?.error || "Không thể lưu thu nhập.", "error"); return; }
    saved();
  }
  
  const rawAmountStr = String(draft.amount).replace(/\D/g, "");
  const formattedAmount = rawAmountStr ? rawAmountStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " đ" : "";
  
  return <div className="space-y-5">
    <button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại bảng thu nhập</button>
    <div><h2 className="text-2xl font-bold">{record ? "Sửa tổng thu năm cũ" : "Nhập tổng thu năm cũ"}</h2><p className="mt-1 text-sm text-slate-400">Khoản thu sẽ được cộng gộp vào thống kê của năm tương ứng, bỏ qua chi tiết từng tháng.</p></div>
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Năm">
            <select required className={inputClass} value={draft.year} onChange={event => patch({ year: Number(event.target.value) })}>
              {Array.from({ length: 15 }, (_, index) => currentYear + 2 - index).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Loại khoản thu">
            <select required className={inputClass} value={draft.category} onChange={event => patch({ category: event.target.value as IncomeCategory })}>
              {incomeCategories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Nội dung">
            <input required className={inputClass} value={draft.name} onChange={event => patch({ name: event.target.value })} placeholder="VD: Lương năm 2024..." />
          </Field>
          <Field label="Tổng tiền năm">
            <input required type="text" className={inputClass} value={formattedAmount} onChange={event => patch({ amount: event.target.value.replace(/\D/g, "") })} placeholder="0 đ" />
          </Field>
          <div className="md:col-span-4">
            <Field label="Ghi chú">
              <input className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} />
            </Field>
          </div>
        </div>
      </Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button>
        <button className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-bold text-white">Lưu dữ liệu</button>
      </div>
    </form>
  </div>;
}

function LegacyIncomeSheetManagement() {
  const ui = useUI();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [monthFilter, setMonthFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [incomeData, setIncomeData] = useState<IncomeApiData | null>(null);
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" });
    const result = await readJsonSafe<{ data?: IncomeApiData; error?: string }>(response);
    if (response.ok && result?.data) setIncomeData(result.data);
    else ui.toast(result?.error || "Không thể tải dữ liệu thu nhập.", "error");
    setLoading(false);
  }, [year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const records = (incomeData?.allRecords || []).filter(record => (monthFilter === "all" || record.month === Number(monthFilter)) && (memberFilter === "all" || record.memberId === memberFilter));
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: (incomeData?.allRecords || []).filter(record => record.month === index + 1 && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0) }));
  const categoryTotals = incomeCategories.map(category => ({ category, total: records.filter(record => record.category === category && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0) }));
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));
  async function remove(record: IncomeRecord) {
    if (!await ui.confirm("Xóa dòng thu?", `Xóa dòng thu "${record.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (!response.ok) ui.toast("Không thể xóa dòng thu nhập.", "error");
    void load();
  }
  function exportExcel() {
    const byMonth = Array.from({ length: 12 }, (_, index) => (incomeData?.allRecords || []).filter(record => record.month === index + 1));
    const rows = [`<tr><th colspan="8">Thu nhập năm ${year}</th></tr>`, `<tr><th>Ngày nhận</th><th>Tháng</th><th>Năm</th><th>Thành viên</th><th>Nhóm thu</th><th>Tên khoản thu</th><th>Số tiền</th><th>Trạng thái</th><th>Ghi chú</th></tr>`];
    byMonth.forEach((items, index) => {
      rows.push(`<tr><td colspan="9"><b>Tháng ${index + 1}</b></td></tr>`);
      items.forEach(record => rows.push(`<tr><td>${formatDateVN(record.incomeDate)}</td><td>${record.month}</td><td>${record.year}</td><td>${record.memberName || ""}</td><td>${record.category}</td><td>${record.name}</td><td>${record.amount}</td><td>${record.status}</td><td>${record.note || ""}</td></tr>`));
      rows.push(`<tr><td colspan="6"><b>Tổng tháng ${index + 1}</b></td><td><b>${items.filter(record => record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0)}</b></td><td colspan="2"></td></tr>`);
    });
    rows.push(`<tr><td colspan="6"><b>Tổng năm</b></td><td><b>${totalYear}</b></td><td colspan="2"></td></tr>`);
    categoryTotals.forEach(item => rows.push(`<tr><td colspan="6">Tổng ${item.category}</td><td>${item.total}</td><td colspan="2"></td></tr>`));
    const blob = new Blob([`<html><meta charset="utf-8"><table>${rows.join("")}</table></html>`], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `thu-nhap-${year}.xls`; link.click();
    URL.revokeObjectURL(url);
  }
  if (view !== "list") return <IncomeRecordForm record={editing} members={incomeData?.members || []} templates={incomeData?.sourceTemplates || incomeTemplates} back={() => { setView("list"); setEditing(null); }} saved={() => { setView("list"); setEditing(null); void load(); }} />;
  return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-[120px_140px_1fr_auto_auto]"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select><select className={filterClass} value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">Tất cả tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Th\u00e1ng {index + 1}</option>)}</select><select className={filterClass} value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tất cả thành viên</option>{incomeData?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button onClick={() => { setEditing(null); setView("new"); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Thêm thu nhập</button><button onClick={exportExcel} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-600">Xuất Excel</button></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Tổng cả năm</p><b className="text-emerald-500">{money(totalYear)}</b></Card>{categoryTotals.slice(0, 3).map(item => <Card key={item.category}><p className="text-xs text-slate-400">{item.category}</p><b>{money(item.total)}</b></Card>)}</div><Card><div className="mb-4 flex items-center justify-between"><b>Tổng thu theo 12 tháng</b>{loading && <span className="text-xs text-slate-400">Đang tải...</span>}</div><div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">{monthlyTotals.map(item => <div key={item.month} className="flex min-w-12 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5"><div className="w-full rounded-md bg-emerald-500" style={{ height: `${Math.max(4, item.total / maxMonth * 100)}%` }} /></div><span className="text-xs font-bold text-slate-400">{`Tháng ${item.month}`}</span></div>)}</div></Card><Card className="overflow-hidden p-0"><div className="border-b border-[var(--app-border)] p-4"><b>Bảng thu nhập theo tháng</b></div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5"><tr><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Tháng</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Nhóm thu</th><th className="px-4 py-3">Tên khoản thu</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3 text-right">Hành động</th></tr></thead><tbody>{Array.from({ length: 12 }, (_, index) => index + 1).filter(month => monthFilter === "all" || month === Number(monthFilter)).map(month => { const items = records.filter(record => record.month === month); const subtotal = items.filter(record => record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0); return <><tr key={`m-${month}`} className="bg-emerald-50/70 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10"><td className="px-4 py-2" colSpan={5}>Tháng {month}</td><td className="px-4 py-2 text-right">{money(subtotal)}</td><td className="px-4 py-2" colSpan={3}>Tổng tháng</td></tr>{items.map(record => <tr key={record.id} className="border-t border-[var(--app-border)]"><td className="px-4 py-3">{formatDateVN(record.incomeDate)}</td><td className="px-4 py-3">{record.month}</td><td className="px-4 py-3">{record.memberName}</td><td className="px-4 py-3">{record.category}</td><td className="px-4 py-3 leading-tight">{record.jobId ? record.jobName : <>Thu khác<br /><span className="text-xs font-normal text-slate-500">{record.name}</span></>}</td><td className="px-4 py-3 text-right font-bold text-emerald-500">{money(record.amount)}</td><td className="px-4 py-3">{record.status}</td><td className="px-4 py-3 text-slate-500">{record.note}</td><td className="px-4 py-3 text-right"><button onClick={() => { setEditing(record); setView("edit"); }} className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-600">Sửa</button><button onClick={() => void remove(record)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500">Xóa</button></td></tr>)}</>; })}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{records.map(record => <div key={record.id} className="rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div><b>{record.jobId ? record.jobName : "Thu khác"}</b>{record.jobId ? null : <p className="text-sm font-semibold text-slate-600">{record.name}</p>}<p className="mt-0.5 text-xs text-slate-400">{formatDateVN(record.incomeDate)} · {record.memberName} · {record.category}</p></div><b className="text-emerald-500">{money(record.amount)}</b></div><p className="mt-1 text-xs text-slate-400">{record.status} · {record.note}</p><div className="mt-2 flex gap-2"><button onClick={() => { setEditing(record); setView("edit"); }} className="text-xs font-bold text-emerald-600">Sửa</button><button onClick={() => void remove(record)} className="text-xs font-bold text-rose-500">Xóa</button></div></div>)}</div></Card></div>;
}
function IncomeRecordActionMenu({ record, activeId, setActiveId, edit, remove }: { record: IncomeRecord; activeId: string | null; setActiveId: (id: string | null) => void; edit: (record: IncomeRecord) => void; remove: (record: IncomeRecord) => void }) {
  void activeId;
  void setActiveId;
  return <IncomeRecordInlineActions edit={() => edit(record)} remove={() => remove(record)} />;
}
function IncomeRecordInlineActions({ edit, remove }: { edit: () => void; remove: () => void }) {
  return <div className="inline-flex items-center justify-end gap-1">
    <button type="button" onClick={edit} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-white/5">Sửa</button>
    <button type="button" onClick={() => void remove()} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa</button>
  </div>;
}
function IncomeRecordForm({ record, members: initialMembers, templates, user, back, saved, notify, fixedJobId, fixedMemberId }: { record: IncomeRecord | null; members: { id: string; name: string }[]; templates: string[]; user?: AuthUser; back: () => void; saved: () => void; notify?: (message: string, type?: "success" | "error") => void; fixedJobId?: string; fixedMemberId?: string }) {
  const today = new Date(new Date().getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const emptyRow = (): IncomeDraft => ({ memberId: fixedMemberId || user?.memberId || initialMembers[0]?.id || "", jobId: fixedJobId || "", incomeDate: today, category: "Lương", name: "", amount: "", status: "Đã nhận", note: "" });
  const [draft, setDraft] = useState<IncomeDraft>(() => record ? { id: record.id, memberId: record.memberId || fixedMemberId || user?.memberId || initialMembers[0]?.id || "", jobId: record.jobId || record.workId || fixedJobId || "", incomeDate: record.incomeDate || record.receivedDate || today, category: record.category, name: record.name, amount: String(record.amount), status: record.status, note: record.note } : emptyRow());
  const [otherMember, setOtherMember] = useState(() => record ? record.memberId !== user?.memberId && !fixedMemberId : false);
  
  const userRole = String(user?.role || "");
  const isAdmin = userRole === "full_access" || userRole === "system_admin" || userRole === "admin";
  const currentMemberId = user?.memberId || "";
  const effectiveMemberId = fixedMemberId || ((isAdmin && otherMember) ? draft.memberId : currentMemberId);
  
  const [apiMembers, setApiMembers] = useState<{ id: string; name: string }[]>(initialMembers);
  useEffect(() => {
    let active = true;
    if (isAdmin && otherMember && !fixedMemberId) {
      fetch("/api/members").then(res => res.json()).then(data => {
        if (active && data.ok && Array.isArray(data.data)) setApiMembers(data.data);
      });
    }
    return () => { active = false; };
  }, [isAdmin, otherMember, fixedMemberId]);

  const [apiJobs, setApiJobs] = useState<MemberJob[]>([]);
  useEffect(() => {
    let active = true;
    if (effectiveMemberId) {
      fetch(`/api/member-jobs?memberId=${encodeURIComponent(effectiveMemberId)}`)
        .then(res => res.json())
        .then(data => {
          if (active && data.ok && Array.isArray(data.data)) {
            const activeJobs = data.data.filter((j: any) => j.status === "active" || (record && record.jobId === j.id));
            setApiJobs(activeJobs);
          }
        }).catch(e => console.error("[income] load jobs error", e));
    } else {
      setApiJobs([]);
    }
    return () => { active = false; };
  }, [effectiveMemberId, record]);

  function patch(value: Partial<IncomeDraft>) { setDraft(current => ({ ...current, ...value })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rawAmount = String(draft.amount).replace(/\D/g, "");
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) { notify?.("Vui l?ng nh?p s? ti?n h?p l?.", "error"); return; }
    const contentText = draft.name.trim();
    if (!contentText) { notify?.("Vui l?ng nh?p n?i dung khoản thu.", "error"); return; }
    if (!effectiveMemberId) { notify?.("Chưa xác định thành viên nhận thu nhập.", "error"); return; }
    
    const payloadJobId = fixedJobId ? fixedJobId : (draft.jobId || null);
    const payload = { memberId: effectiveMemberId, jobId: payloadJobId, category: draft.category, name: contentText, content: contentText, amount, receivedDate: draft.incomeDate, note: draft.note.trim() || null };
    
    const response = await fetch(record ? `/api/incomes?id=${encodeURIComponent(record.id)}` : "/api/incomes", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? payload : { rows: [payload] }) });
    const result = await readJsonSafe<{ error?: string; details?: string }>(response);
    if (!response.ok) {
      notify?.((result?.error || "Không thể lưu thu nhập.") + (result?.details ? ` Lỗi: ${result.details}` : ""), "error");
      return;
    }
    saved();
  }

  const allowMemberSelect = isAdmin && !fixedMemberId;
  const rawAmountStr = String(draft.amount).replace(/\D/g, "");
  const amountPreview = rawAmountStr ? money(Number(rawAmountStr)) : "";

  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại bảng thu nhập</button><div><h2 className="text-2xl font-bold">{record ? "Sửa khoản thu" : "Thêm thu nhập"}</h2><p className="mt-1 text-sm text-slate-400">Khoản thu sẽ được ghi nhận vào bảng thu nhập.</p></div><form onSubmit={submit} className="space-y-4"><Card><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
  {allowMemberSelect && (
    <div className="md:col-span-2 xl:col-span-4 mb-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={otherMember} onChange={e => { setOtherMember(e.target.checked); patch({ memberId: e.target.checked ? "" : currentMemberId }); }} className="rounded text-emerald-500 focus:ring-emerald-500" /> Nhập cho thành viên khác
      </label>
    </div>
  )}
  {allowMemberSelect && otherMember && (
    <Field label="Thành viên">
      <select required className={inputClass} value={draft.memberId} onChange={event => patch({ memberId: event.target.value })}>
        <option value="" disabled>Chọn thành viên</option>
        {apiMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </Field>
  )}
  {!fixedJobId && (
    <Field label="Nguồn thu">
      <select required className={inputClass} value={draft.jobId || "other"} onChange={event => patch({ jobId: event.target.value === "other" ? "" : event.target.value })}>
        <option value="" disabled>Chọn nguồn thu</option>
        {apiJobs.map(job => (
          <option key={job.id} value={job.id}>
            {job.title} {job.company ? `· ${job.company}` : ""}
          </option>
        ))}
        <option value="other">Thu khác</option>
      </select>
    </Field>
  )}
  <Field label="Ngày nhận"><DateVNInput required value={draft.incomeDate} onChange={value => patch({ incomeDate: value })} /></Field>
  <Field label="Loại khoản thu"><select className={inputClass} value={draft.category} onChange={event => patch({ category: event.target.value as IncomeCategory })}>{incomeCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></Field>
  <Field label="Nội dung khoản thu"><input required className={inputClass} value={draft.name} onChange={event => patch({ name: event.target.value })} placeholder={fixedJobId ? "VD: Lương CB..." : "VD: Bán đồ, được thưởng..."} /></Field>
  <Field label="Số tiền"><input required type="text" inputMode="numeric" pattern="[0-9]*" className={inputClass} value={draft.amount} onChange={e => patch({ amount: e.target.value.replace(/\D/g, "") })} placeholder="VD: 2280000" />{amountPreview && <p className="mt-1 text-xs text-slate-400">Khoảng {amountPreview}</p>}</Field>
  <div className="md:col-span-2 xl:col-span-4"><Field label="Ghi chú"><input className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} /></Field></div></div></Card><datalist id="income-template-list">{Array.from(new Set([...incomeTemplates, ...templates])).map(name => <option key={name} value={name} />)}</datalist><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}
function IncomeManagement() {
  const ui = useUI();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<IncomeSourceType | "all">("all");
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(() => new Set());
  const [incomeData, setIncomeData] = useState<IncomeApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<{ mode: "list" } | { mode: "new" } | { mode: "edit" | "view"; source: IncomeSource }>({ mode: "list" });
  const [openMenu, setOpenMenu] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" });
    const result = await readJsonSafe<{ data?: IncomeApiData; error?: string }>(response);
    if (response.ok && result?.data) setIncomeData(result.data);
    else ui.toast(result?.error || "Không thể tải dữ liệu thu nhập.", "error");
    setLoading(false);
  }, [year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const members = incomeData?.members || [];
  const visibleMemberIds = new Set(members.filter(member => !hiddenMembers.has(member.id) && (memberFilter === "all" || member.id === memberFilter)).map(member => member.id));
  const sources = (incomeData?.sources || []).filter(source => visibleMemberIds.has(source.memberId) && (typeFilter === "all" || source.type === typeFilter));
  const records = (incomeData?.allRecords || []).filter(record => visibleMemberIds.has(record.memberId) && (typeFilter === "all" || record.sourceType === typeFilter));
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: records.filter(record => Number(record.receivedDate.slice(5, 7)) === index + 1).reduce((sum, record) => sum + record.amount, 0) }));
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const fixedMonthly = sources.filter(source => source.active && source.type === "fixed" && source.frequency === "monthly").reduce((sum, source) => sum + source.amount, 0);
  const variableTotal = records.filter(record => record.sourceType === "variable").reduce((sum, record) => sum + record.amount, 0);
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));
  const manyMembers = members.length > 8;
  function toggleMember(id: string) {
    setHiddenMembers(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function remove(source: IncomeSource) {
    if (!await ui.confirm("Xóa nguồn thu?", `Xóa nguồn thu "${source.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(source.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await readJsonSafe<{ error?: string }>(response);
      ui.toast(result?.error || "Không thể xóa nguồn thu.", "error");
      return;
    }
    setOpenMenu("");
    setView({ mode: "list" });
    void load();
  }
  if (view.mode === "new") return <IncomeSourceFullPage source="new" members={members} back={() => setView({ mode: "list" })} saved={() => { setView({ mode: "list" }); void load(); }} />;
  if (view.mode === "edit") return <IncomeSourceFullPage source={view.source} members={members} back={() => setView({ mode: "list" })} saved={() => { setView({ mode: "list" }); void load(); }} />;
  if (view.mode === "view") return <IncomeSourceFullPageDetail source={view.source} back={() => setView({ mode: "list" })} edit={() => setView({ mode: "edit", source: view.source })} remove={() => void remove(view.source)} />;
  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-[120px_1fr_180px_auto]"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select><select className={filterClass} value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tất cả thành viên</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><select className={filterClass} value={typeFilter} onChange={event => setTypeFilter(event.target.value as IncomeSourceType | "all")}><option value="all">Tất cả nguồn thu</option><option value="fixed">Cố định</option><option value="variable">Không có định</option></select><button onClick={() => setView({ mode: "new" })} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Thêm nguồn thu</button></div>
    <Card className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><b>Hiển thị thành viên</b><p className="text-xs text-slate-400">{members.length - hiddenMembers.size}/{members.length} đang hiển thị</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setHiddenMembers(new Set())} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-600">Hiện tất cả</button><button onClick={() => setHiddenMembers(new Set(members.map(member => member.id)))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10">Ẩn tất cả</button></div></div>{manyMembers && <select className={filterClass} value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Dropdown chọn thành viên</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}<div className={manyMembers ? "max-h-32 overflow-auto rounded-lg border border-[var(--app-border)] p-2" : ""}><div className="flex flex-wrap gap-2">{members.map(member => <button key={member.id} onClick={() => toggleMember(member.id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${hiddenMembers.has(member.id) ? "border-slate-200 text-slate-400 opacity-60 dark:border-white/10" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"}`}>{member.name}</button>)}</div></div></Card>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Tổng thu năm</p><b className="text-emerald-500">{money(totalYear)}</b></Card><Card><p className="text-xs text-slate-400">Thu cố định/tháng</p><b>{money(fixedMonthly)}</b></Card><Card><p className="text-xs text-slate-400">Thu không cố định</p><b>{money(variableTotal)}</b></Card><Card><p className="text-xs text-slate-400">Trung bình/tháng</p><b>{money(totalYear / 12)}</b></Card></div>
    <Card><div className="mb-4 flex items-center justify-between"><b>Biểu đồ {year}</b><span className="text-xs text-slate-400">{records.length} dòng thu</span></div><div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">{monthlyTotals.map(item => <div key={item.month} className="flex min-w-12 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5"><div title={money(item.total)} className="w-full rounded-md bg-emerald-500 transition-all" style={{ height: `${Math.max(4, item.total / maxMonth * 100)}%` }} /></div><span className="text-xs font-bold text-slate-400">{`Tháng ${item.month}`}</span></div>)}</div></Card>
    <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[var(--app-border)] p-4"><b>Danh sách thu nhập</b>{loading && <span className="text-xs text-slate-400">Đang tải...</span>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5"><tr><th className="px-4 py-3">Tháng/ngày</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Nguồn thu</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3 text-right">Hành động</th></tr></thead><tbody>{records.map(record => <tr key={record.id} className="border-t border-[var(--app-border)]"><td className="px-4 py-3">{formatDateVN(record.receivedDate)}</td><td className="px-4 py-3">{record.memberName}</td><td className="px-4 py-3">{record.sourceName}{record.generated && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">tự tính</span>}</td><td className="px-4 py-3">{incomeTypeLabel[record.sourceType || "variable"]}</td><td className="px-4 py-3 text-right font-bold text-emerald-500">{money(record.amount)}</td><td className="px-4 py-3 text-slate-500">{record.note}</td><td className="px-4 py-3 text-right">{!record.generated && <span className="text-xs text-slate-400">Record</span>}</td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{records.map(record => <div key={record.id} className="rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div><b>{record.sourceName}</b><p className="text-xs text-slate-400">{formatDateVN(record.receivedDate)} · {record.memberName} · {incomeTypeLabel[record.sourceType || "variable"]}</p></div><b className="text-emerald-500">{money(record.amount)}</b></div>{record.note && <p className="mt-2 text-sm text-slate-500">{record.note}</p>}</div>)}</div>{!records.length && <div className="p-6"><EmptyState /></div>}</Card>
    <SectionTitle label="Nguồn thu" /><Card className="overflow-visible p-0"><div className="hidden overflow-visible md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5"><tr><th className="px-4 py-3">Nguồn thu</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Tần suất</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3 text-right">Menu</th></tr></thead><tbody>{sources.map(source => <tr key={source.id} className="border-t border-[var(--app-border)]"><td className="px-4 py-3"><b>{source.name}</b><p className="text-xs text-slate-400">{source.active ? "Đang dùng" : "Đã tắt"}</p></td><td className="px-4 py-3">{source.memberName}</td><td className="px-4 py-3">{incomeTypeLabel[source.type]}</td><td className="px-4 py-3">{frequencyLabel[source.frequency]}</td><td className="px-4 py-3 text-right font-bold text-emerald-500">{money(source.amount)}</td><td className="relative px-4 py-3 text-right"><button onClick={() => setOpenMenu(openMenu === source.id ? "" : source.id)} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm font-bold">...</button>{openMenu === source.id && <div className="absolute right-4 top-11 z-20 w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-1 shadow-xl"><button onClick={() => { setOpenMenu(""); setView({ mode: "view", source }); }} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5">Xem</button><button onClick={() => { setOpenMenu(""); setView({ mode: "edit", source }); }} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5">Sửa</button><button onClick={() => void remove(source)} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa</button></div>}</td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{sources.map(source => <div key={source.id} className="relative rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b>{source.name}</b><p className="text-xs text-slate-400">{source.memberName} · {incomeTypeLabel[source.type]} · {frequencyLabel[source.frequency]}</p><p className="mt-1 text-xs text-slate-400">{source.active ? "Đang dùng" : "Đã tắt"}</p></div><button onClick={() => setOpenMenu(openMenu === source.id ? "" : source.id)} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm font-bold">...</button></div><b className="mt-2 block text-emerald-500">{money(source.amount)}</b>{openMenu === source.id && <div className="absolute right-3 top-12 z-20 w-28 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-1 shadow-xl"><button onClick={() => { setOpenMenu(""); setView({ mode: "view", source }); }} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold">Xem</button><button onClick={() => { setOpenMenu(""); setView({ mode: "edit", source }); }} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold">Sửa</button><button onClick={() => void remove(source)} className="block w-full rounded-md px-3 py-2 text-left text-xs font-bold text-rose-500">Xóa</button></div>}</div>)}</div>{!sources.length && <div className="p-6"><EmptyState /></div>}</Card>
  </div>;
}
function IncomeSourceFullPage({ source, members, back, saved }: { source: IncomeSource | "new"; members: { id: string; name: string }[]; back: () => void; saved: () => void }) {
  const ui = useUI();
  const existing = source !== "new" ? source : null;
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ memberId: existing?.memberId || members[0]?.id || "", name: existing?.name || "", type: (existing?.type || "fixed") as IncomeSourceType, amount: String(existing?.amount || ""), frequency: (existing?.frequency || "monthly") as IncomeFrequency, receivedDate: existing?.receivedDate || existing?.startDate || today, note: existing?.note || "", active: existing?.active ?? true, createRecord: !existing });
  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, amount: Number(form.amount), startDate: form.receivedDate };
    const url = existing ? `/api/incomes?id=${encodeURIComponent(existing.id)}` : "/api/incomes";
    const response = await fetch(url, { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) { ui.toast(result?.error || "Không thể lưu nguồn thu.", "error"); return; }
    saved();
  }
  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại danh sách thu nhập</button><div><h2 className="text-2xl font-bold">{existing ? "Sửa nguồn thu" : "Thêm nguồn thu"}</h2><p className="mt-1 text-sm text-slate-400">Nhập nhanh và giữ liên kết với thành viên.</p></div><form onSubmit={submit} className="space-y-5"><Card><div className="grid gap-4 md:grid-cols-2"><Field label="Thành viên"><select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Tên nguồn thu"><input required className={inputClass} value={form.name} onChange={event => set("name", event.target.value)} /></Field><Field label="Loại"><select className={inputClass} value={form.type} onChange={event => set("type", event.target.value as IncomeSourceType)}><option value="fixed">Cố định</option><option value="variable">Không có định</option></select></Field><Field label="Số tiền"><input required min="0" type="number" className={inputClass} value={form.amount} onChange={event => set("amount", event.target.value)} /></Field><Field label="Tần suất"><select className={inputClass} value={form.frequency} onChange={event => set("frequency", event.target.value as IncomeFrequency)}>{Object.entries(frequencyLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Ngày nhận / ngày bắt đầu"><DateVNInput required value={form.receivedDate} onChange={value => set("receivedDate", value)} /></Field><div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={4} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /> Đang dùng</label>{!existing && form.type === "variable" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.createRecord} onChange={event => set("createRecord", event.target.checked)} /> Ghi nhận khoản thu này ngay</label>}</div></Card><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}
function IncomeSourceFullPageDetail({ source, back, edit, remove }: { source: IncomeSource; back: () => void; edit: () => void; remove: () => void }) {
  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại danh sách thu nhập</button><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">{source.name}</h2><p className="mt-1 text-sm text-slate-400">{source.memberName} · {incomeTypeLabel[source.type]} · {source.active ? "Đang dùng" : "Đã tắt"}</p></div><div className="flex gap-2"><button onClick={edit} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white">Sửa</button><button onClick={remove} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-500">Xóa</button></div></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Số tiền</p><b className="text-emerald-500">{money(source.amount)}</b></Card><Card><p className="text-xs text-slate-400">Tần suất</p><b>{frequencyLabel[source.frequency]}</b></Card><Card><p className="text-xs text-slate-400">Ngày nhận</p><b>{source.receivedDate || source.startDate || "Chưa cập nhật"}</b></Card><Card><p className="text-xs text-slate-400">Trạng thái</p><b>{source.active ? "Đang dùng" : "Đã tắt"}</b></Card></div><Card><b>Ghi chú</b><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{source.note || "Không có ghi chú."}</p></Card></div>;
}
function OldIncomeManagement() {
  const ui = useUI();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<IncomeSourceType | "all">("all");
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(() => new Set());
  const [incomeData, setIncomeData] = useState<IncomeApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<IncomeSource | "new" | null>(null);
  const visibleMemberIds = new Set((incomeData?.members || []).filter(member => !hiddenMembers.has(member.id) && (memberFilter === "all" || member.id === memberFilter)).map(member => member.id));
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" });
    const result = await readJsonSafe<{ data?: IncomeApiData; error?: string }>(response);
    if (response.ok && result?.data) setIncomeData(result.data);
    else ui.toast(result?.error || "Không thể tải dữ liệu thu nhập.", "error");
    setLoading(false);
  }, [year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const sources = (incomeData?.sources || []).filter(source => visibleMemberIds.has(source.memberId) && (typeFilter === "all" || source.type === typeFilter));
  const records = (incomeData?.allRecords || []).filter(record => visibleMemberIds.has(record.memberId) && (typeFilter === "all" || record.sourceType === typeFilter));
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: records.filter(record => Number(record.receivedDate.slice(5, 7)) === index + 1).reduce((sum, record) => sum + record.amount, 0) }));
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const fixedMonthly = sources.filter(source => source.active && source.type === "fixed" && source.frequency === "monthly").reduce((sum, source) => sum + source.amount, 0);
  const variableTotal = records.filter(record => record.sourceType === "variable").reduce((sum, record) => sum + record.amount, 0);
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));
  function toggleMember(id: string) {
    setHiddenMembers(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function remove(source: IncomeSource) {
    if (!await ui.confirm("Xóa nguồn thu?", `Xóa nguồn thu "${source.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(source.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await readJsonSafe<{ error?: string }>(response);
      ui.toast(result?.error || "Không thể xóa nguồn thu.", "error");
      return;
    }
    void load();
  }
  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-[120px_1fr_180px_auto]"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select><select className={filterClass} value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tất cả thành viên</option>{incomeData?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><select className={filterClass} value={typeFilter} onChange={event => setTypeFilter(event.target.value as IncomeSourceType | "all")}><option value="all">Tất cả nguồn thu</option><option value="fixed">Cố định</option><option value="variable">Không cố định</option></select><button onClick={() => setEditing("new")} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Thêm nguồn thu</button></div>
    <div className="flex flex-wrap gap-2">{incomeData?.members.map(member => <button key={member.id} onClick={() => toggleMember(member.id)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${hiddenMembers.has(member.id) ? "border-slate-200 text-slate-400 opacity-60 dark:border-white/10" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"}`}>{member.name}</button>)}</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Tổng thu năm</p><b className="text-emerald-500">{money(totalYear)}</b></Card><Card><p className="text-xs text-slate-400">Thu cố định/tháng</p><b>{money(fixedMonthly)}</b></Card><Card><p className="text-xs text-slate-400">Thu không cố định</p><b>{money(variableTotal)}</b></Card><Card><p className="text-xs text-slate-400">Trung bình/tháng</p><b>{money(totalYear / 12)}</b></Card></div>
    <Card><div className="mb-4 flex items-center justify-between"><b>Biểu đồ {year}</b><span className="text-xs text-slate-400">{records.length} dòng thu</span></div><div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">{monthlyTotals.map(item => <div key={item.month} className="flex min-w-12 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5"><div title={money(item.total)} className="w-full rounded-md bg-emerald-500 transition-all" style={{ height: `${Math.max(4, item.total / maxMonth * 100)}%` }} /></div><span className="text-xs font-bold text-slate-400">{`Tháng ${item.month}`}</span></div>)}</div></Card>
    <Card className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-[var(--app-border)] p-4"><b>Danh sách thu nhập</b>{loading && <span className="text-xs text-slate-400">Đang tải...</span>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5"><tr><th className="px-4 py-3">Tháng/ngày</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Nguồn thu</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3 text-right">Hành động</th></tr></thead><tbody>{records.map(record => <tr key={record.id} className="border-t border-[var(--app-border)]"><td className="px-4 py-3">{formatDateVN(record.receivedDate)}</td><td className="px-4 py-3">{record.memberName}</td><td className="px-4 py-3">{record.sourceName}{record.generated && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">tự tính</span>}</td><td className="px-4 py-3">{incomeTypeLabel[record.sourceType || "variable"]}</td><td className="px-4 py-3 text-right font-bold text-emerald-500">{money(record.amount)}</td><td className="px-4 py-3 text-slate-500">{record.note}</td><td className="px-4 py-3 text-right">{!record.generated && <span className="text-xs text-slate-400">Record</span>}</td></tr>)}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{records.map(record => <div key={record.id} className="rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div><b>{record.sourceName}</b><p className="text-xs text-slate-400">{formatDateVN(record.receivedDate)} · {record.memberName} · {incomeTypeLabel[record.sourceType || "variable"]}</p></div><b className="text-emerald-500">{money(record.amount)}</b></div>{record.note && <p className="mt-2 text-sm text-slate-500">{record.note}</p>}</div>)}</div>{!records.length && <div className="p-6"><EmptyState /></div>}</Card>
    <SectionTitle label="Nguồn thu" /><div className="grid gap-3 lg:grid-cols-2">{sources.map(source => <Card key={source.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><b>{source.name}</b><p className="text-xs text-slate-400">{source.memberName} · {incomeTypeLabel[source.type]} · {frequencyLabel[source.frequency]} · {source.active ? "Đang dùng" : "Đã tắt"}</p></div><div className="flex shrink-0 items-center gap-1"><b className="text-emerald-500">{money(source.amount)}</b><EditButton onClick={() => setEditing(source)} /><button onClick={() => remove(source)} className="rounded-xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa</button></div></Card>)}</div>{editing && incomeData && <IncomeSourceEditor source={editing} members={incomeData.members} close={() => setEditing(null)} saved={() => { setEditing(null); void load(); }} />}
  </div>;
}
function IncomeSourceEditor({ source, members, close, saved }: { source: IncomeSource | "new"; members: { id: string; name: string }[]; close: () => void; saved: () => void }) {
  const existing = source !== "new" ? source : null;
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ memberId: existing?.memberId || members[0]?.id || "", name: existing?.name || "", type: (existing?.type || "fixed") as IncomeSourceType, amount: String(existing?.amount || ""), frequency: (existing?.frequency || "monthly") as IncomeFrequency, receivedDate: existing?.receivedDate || existing?.startDate || today, note: existing?.note || "", active: existing?.active ?? true, createRecord: !existing });
  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) { setForm(current => ({ ...current, [key]: value })); }
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-0 md:p-4" onMouseDown={close}>
    <div onMouseDown={e => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-[var(--app-card)] p-6 shadow-2xl md:rounded-2xl">
      <h2 className="text-xl font-bold">{existing ? "Sửa nguồn thu" : "Thêm nguồn thu"}</h2>
      <div className="mt-4 grid gap-4">
        <Field label="Tên nguồn"><input className={inputClass} value={form.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Thành viên"><select className={inputClass} value={form.memberId} onChange={e => set("memberId", e.target.value)}>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Số tiền"><input className={inputClass} type="number" value={form.amount} onChange={e => set("amount", e.target.value)} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-3"><button onClick={close} className="px-4 py-2 font-bold">Hủy</button><button onClick={saved} className="rounded-xl bg-emerald-500 px-4 py-2 text-white font-bold">Lưu</button></div>
    </div>
  </div>;
}

const paymentMethodLabels: Record<string, string> = { cash: "Tiền mặt", transfer: "Chuyển khoản", bank_account: "Tài khoản", card: "Thẻ", bank_card: "Thẻ", credit_card: "Thẻ tín dụng", apple_pay: "Apple Pay", momo: "MoMo", other: "Khác" };
const expenseCategoryTree: Record<string, string[]> = {
  "Ăn uống": ["Ăn ngoài", "Mua đồ nấu ăn", "Cà phê / nước uống"],
  "Sinh hoạt": ["Điện", "Nước", "Internet", "Sim / Data", "Gas", "Rác"],
  "Phương tiện": ["Xăng xe", "Bảo dưỡng", "Sửa xe", "Gửi xe"],
  "Mua sắm": ["Đồ cá nhân", "Đồ gia dụng", "Điện tử"],
  "Sức khỏe": ["Thuốc", "Khám bệnh", "Nha khoa"],
  "Giải trí": ["Phim", "Game", "Đi chơi", "Du lịch"],
  "Gia đình": ["Ba mẹ", "Quà tặng", "Việc nhà"],
  "Tiết kiệm": ["Mẹ giữ", "Ngân hàng", "Tiền mặt", "Quỹ dự phòng", "Khác"],
  "Thanh toán hộ": ["Mẹ cần hoàn", "Ba cần hoàn", "Người thân cần hoàn", "Bạn bè cần hoàn", "Khác"],
  "Khác": ["Khác"]
};
const expenseCategories = Object.keys(expenseCategoryTree);
type ExpenseDraft = { id: string; memberId: string; date: string; transactionTime: string; category: string; subcategory: string; vendor: string; grossAmount: string; discountAmount: string; note: string; paymentMethod: import("../types").PaymentMethod; paymentAccountId: string; simId: string; topupSimBalance: boolean; reimbursementPerson?: string; reimbursementStatus?: string; reimbursedAmount?: string; reimbursedAt?: string; };

const currentTimeValue = () => new Date().toTimeString().slice(0, 5);
const normalizeTimeValue = (value: unknown) => String(value || "").slice(0, 5);
const timeFromTimestamp = (value: unknown) => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "" : date.toTimeString().slice(0, 5);
};
const getExpenseDateTime = (r: any) => {
  const date = r.date || r.expense_date || r.created_at || r.createdAt || "";
  const time = r.transactionTime || r.transaction_time || timeFromTimestamp(r.created_at || r.createdAt);
  const isoDate = /^\d{4}-\d{2}-\d{2}/.test(String(date)) ? String(date).slice(0, 10) : "";
  const fallback = isoDate || (r.created_at || r.createdAt ? new Date(r.created_at || r.createdAt).toISOString().slice(0, 10) : "");
  return new Date(`${fallback || "1970-01-01"}T${time || "00:00:00"}`).getTime();
};
const sortExpensesAsc = (a: any, b: any) => {
  const da = getExpenseDateTime(a);
  const db = getExpenseDateTime(b);
  if (da !== db) return da - db;
  return new Date(a.created_at || a.createdAt || 0).getTime() - new Date(b.created_at || b.createdAt || 0).getTime();
};
const formatExpenseDateTime = (record: Transaction) => {
  const time = normalizeTimeValue(record.transactionTime || record.transaction_time) || timeFromTimestamp(record.createdAt || record.created_at);
  return `${formatDateVN(record.date || record.createdAt || record.created_at || "")}${time ? ` · ${time}` : ""}`;
};

const getExpenseDate = (record: any) => parseDate(record.date || record.expense_date || record.created_at || record.createdAt || "");

function ExpenseSheetManagement({ data, update, user }: { data: AppData; update: (data: AppData) => void; user: AuthUser }) {
  const ui = useUI();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set<string>());
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/bank-accounts", { cache: "no-store" }).then(async response => {
      const json = await response.json().catch(() => null);
      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.rows)
            ? json.rows
            : [];
      setBankAccounts(rows);
    }).catch(() => setBankAccounts([]));
  }, []);

  function getPaymentAccountId(record: Transaction) {
    return record.paymentAccountId || record.payment_account_id || record.bankAccountId || record.bank_account_id || "";
  }

  function getExpensePaymentLabel(record: Transaction) {
    const paymentMethod = record.paymentMethod || record.payment_method || "";
    const accountId = getPaymentAccountId(record);
    const account = accountId ? bankAccounts.find(item => String(item.id) === String(accountId)) : null;
    if (account) {
      const bankName = account.bankName || account.bank_name || account.bank || "";
      const last4 = account.last4 || account.last_4 || String(account.accountNumber || account.account_number || account.cardNumber || account.card_number || "").slice(-4);
      return [bankName, last4 ? `****${last4}` : ""].filter(Boolean).join(" · ");
    }
    if (paymentMethod) return paymentMethodLabels[paymentMethod] || paymentMethod;
    return "Không rõ";
  }

  const yearRecords = useMemo(() => data.transactions.filter(r => {
    const parsed = getExpenseDate(r);
    return String(r.type).toLowerCase() === "expense" && parsed?.getFullYear() === Number(year);
  }), [data.transactions, year]);
  const visibleRecords = useMemo(() => yearRecords.filter(r => {
    const parsed = getExpenseDate(r);
    const m = parsed ? String(parsed.getMonth() + 1) : "";
    if (month !== "all" && m !== month) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (categoryFilter !== "all" && subcategoryFilter !== "all" && r.subcategory !== subcategoryFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (r.title?.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.subcategory?.toLowerCase().includes(q) || r.note?.toLowerCase().includes(q));
    }
    return true;
  }).sort(sortExpensesAsc), [yearRecords, month, categoryFilter, subcategoryFilter, query]);

  const selectedMonth = month === "all" ? String(new Date().getMonth() + 1) : month;
  const monthRecords = visibleRecords.filter(record => {
    const parsed = getExpenseDate(record);
    return parsed ? String(parsed.getMonth() + 1) === selectedMonth : false;
  });
  const filteredExpensesForStats = visibleRecords;
  const isReimbursableExpense = (record: Transaction) => Boolean((record as any).isReimbursable || (record as any).is_reimbursable || record.category === "Thanh toán hộ");
  const getReimbursementStatus = (record: Transaction) => String((record as any).reimbursementStatus || (record as any).reimbursement_status || (isReimbursableExpense(record) ? "pending" : "none"));
  const getReimbursementPerson = (record: Transaction) => String((record as any).reimbursementPerson || (record as any).reimbursement_person || "Người cần hoàn");
  const getReimbursedAmount = (record: Transaction) => Number((record as any).reimbursedAmount ?? (record as any).reimbursed_amount ?? 0) || 0;
  const countsAsPersonalExpense = (record: Transaction) => {
    if ((record as any).countsForPersonalExpense === false || (record as any).counts_for_personal_expense === false) return false;
    if (record.category === "Thanh toán hộ" || record.category === "Tiết kiệm") return false;
    return true;
  };
  const pendingReimbursements = yearRecords
    .filter(isReimbursableExpense)
    .filter(record => getReimbursementStatus(record) !== "reimbursed")
    .map(record => ({ record, pendingAmount: Math.max((Number(record.amount) || 0) - getReimbursedAmount(record), 0) }))
    .filter(item => item.pendingAmount > 0);
  const totalPendingReimbursement = pendingReimbursements.reduce((sum, item) => sum + item.pendingAmount, 0);
  const pendingByPerson = Object.values(pendingReimbursements.reduce<Record<string, { person: string; total: number }>>((result, item) => {
    const person = getReimbursementPerson(item.record);
    result[person] = { person, total: (result[person]?.total || 0) + item.pendingAmount };
    return result;
  }, {})).sort((a, b) => b.total - a.total);
  
  const totalMonth = monthRecords.filter(countsAsPersonalExpense).reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const totalDiscountMonth = monthRecords.reduce((sum, record) => sum + (Number(record.discountAmount) || 0), 0);
  const totalYear = yearRecords.filter(countsAsPersonalExpense).reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const totalDiscountYear = yearRecords.reduce((sum, record) => sum + (Number(record.discountAmount) || 0), 0);
  
  const realExpensesForStats = filteredExpensesForStats.filter(countsAsPersonalExpense);
  const byCategory = expenseCategories.map(category => ({ label: category, total: realExpensesForStats.filter(record => record.category === category).reduce((sum, record) => sum + (Number(record.amount) || 0), 0) })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  const largestCategory = byCategory[0];
  const allSubcategories = Array.from(new Set(filteredExpensesForStats.map(r => r.subcategory || "Khác")));
  const bySubcategory = allSubcategories.map(sub => ({ label: sub, total: filteredExpensesForStats.filter(record => (record.subcategory || "Khác") === sub).reduce((sum, record) => sum + (Number(record.amount) || 0), 0) })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  const largestSubcategory = bySubcategory[0];
  
  const monthSummaryRows = Array.from({ length: 12 }, (_, index) => {
    const itemMonth = index + 1;
    const monthItems = visibleRecords.filter(record => {
      const parsed = getExpenseDate(record);
      return parsed ? parsed.getMonth() + 1 === itemMonth : false;
    });
    return { month: itemMonth, items: monthItems, total: monthItems.reduce((sum, record) => sum + (Number(record.amount) || 0), 0), count: monthItems.length };
  });

  function toggle(id: string) {
    setExpandedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remove(record: Transaction) {
    const response = await fetch(`/api/transactions?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (!response.ok) {
      ui.toast("Không thể xóa khoản chi.", "error");
      return;
    }
    update({ ...data, transactions: data.transactions.filter(item => item.id !== record.id) });
    setDeleting(null);
    ui.toast("Đã đánh dấu khoản chờ hoàn là đã hoàn");
  }

  async function markReimbursed(record: Transaction) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const reimbursedAmount = Number(record.amount) || 0;
    const updated: Transaction = {
      ...record,
      isReimbursable: true,
      is_reimbursable: true,
      reimbursementStatus: "reimbursed",
      reimbursement_status: "reimbursed",
      reimbursedAmount,
      reimbursed_amount: reimbursedAmount,
      reimbursedAt: todayIso,
      reimbursed_at: todayIso,
      countsForPersonalExpense: false,
      counts_for_personal_expense: false,
      countsForCardSpending: true,
      counts_for_card_spending: true,
    };
    const response = await fetch("/api/transactions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
    const result = await readJsonSafe<Transaction & { error?: string }>(response);
    if (!response.ok || !result || (result as any).error) {
      ui.toast((result as any)?.error || "Không thể đánh dấu đã hoàn.", "error");
      return;
    }
    update({ ...data, transactions: [result, ...data.transactions.filter(item => item.id !== record.id)] });
    setMenuId(null);
    ui.toast("Đã xóa khoản chi");
  }

  if (editing) {
    return (
      <ExpenseForm
        record={editing === "new" ? null : editing}
        members={data.members}
        user={user}
        close={() => setEditing(null)}
        saved={(record) => {
          update({ ...data, transactions: [record, ...data.transactions.filter(item => item.id !== record.id)] });
          setEditing(null);
          ui.toast(editing === "new" ? "Đã thêm khoản chi" : "Đã cập nhật khoản chi");
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className={`grid gap-3 ${categoryFilter === "all" ? "md:grid-cols-[90px_100px_140px_minmax(180px,1fr)_auto]" : "md:grid-cols-[90px_100px_140px_140px_minmax(140px,1fr)_auto]"}`}>
        <select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select>
        <select className={filterClass} value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
        <select className={filterClass} value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setSubcategoryFilter("all"); }}><option value="all" hidden>Khoản chi</option><optgroup label="Khoản chi"><option value="all">Tất cả</option>{expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</optgroup></select>
        {categoryFilter !== "all" && <select className={filterClass} value={subcategoryFilter} onChange={event => setSubcategoryFilter(event.target.value)}><option value="all" hidden>Loại chi tiết</option><optgroup label="Loại chi tiết"><option value="all">Tất cả</option>{(expenseCategoryTree[categoryFilter] || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}</optgroup></select>}
        <input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm nội dung chi, khoản chi, ghi chú..." />
        <button onClick={() => setEditing("new")} className="rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Thêm khoản chi</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs text-slate-400">{"Tổng chi năm"}</p><b className="font-semibold text-rose-500">{money(totalYear)}</b>{totalDiscountYear > 0 && <p className="mt-0.5 text-[10px] font-semibold text-emerald-500">Tiết kiệm: {money(totalDiscountYear)}</p>}</Card>
        <Card><p className="text-xs text-slate-400">{"Tổng chi tháng"} {selectedMonth}</p><b className="font-semibold text-slate-900 dark:text-slate-100">{money(totalMonth)}</b>{totalDiscountMonth > 0 && <p className="mt-0.5 text-[10px] font-semibold text-emerald-500">Tiết kiệm: {money(totalDiscountMonth)}</p>}</Card>
        <Card><p className="text-xs text-slate-400">Khoản chi lớn nhất</p><b className="font-semibold text-slate-900 dark:text-slate-100">{largestCategory ? `${largestCategory.label} (${money(largestCategory.total)})` : "Chưa có"}</b></Card>
        <Card><p className="text-xs text-slate-400">Loại chi tiết lớn nhất</p><b className="font-semibold text-rose-500">{largestSubcategory ? `${largestSubcategory.label} (${money(largestSubcategory.total)})` : "Chưa có"}</b></Card>
        <Card><p className="text-xs text-slate-400">Đang chờ hoàn</p><b className="font-semibold text-orange-500">{money(totalPendingReimbursement)}</b>{pendingByPerson.length > 0 && <p className="mt-1 text-[10px] font-semibold text-slate-500">{pendingByPerson.map(item => `${item.person}: ${money(item.total)}`).join(" · ")}</p>}</Card>
      </div>

      <Card className="overflow-visible p-0">
          <div className="border-b border-[var(--app-border)] px-4 py-3"><b className="font-semibold text-slate-800 dark:text-slate-100">{"Danh sách theo tháng"}</b></div>
          <div className="divide-y divide-[var(--app-border)]">
          {monthSummaryRows.map(row => {
            const expanded = expandedIds.has(`month-${row.month}`);
            return <div key={row.month} className="px-4 py-2.5">
              <button type="button" onClick={() => toggle(`month-${row.month}`)} className="grid w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:grid-cols-[1fr_120px_100px_32px]">
                <b className="font-semibold text-slate-800 dark:text-slate-100">{"Tháng"} {row.month}</b>
                <span className="font-bold text-rose-500 sm:text-right">{money(row.total)}</span>
                <span className="text-sm font-medium text-slate-500 sm:text-right">{row.count} {"khoản"}</span>
                <span className="grid size-8 place-items-center rounded-lg text-slate-500" aria-hidden><svg viewBox="0 0 24 24" className={`size-4 fill-none stroke-current stroke-2 transition-transform ${expanded ? "rotate-180" : ""}`} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
              </button>
              {expanded && <div className="mt-1 divide-y divide-[var(--app-border)]">
                {row.items.length === 0 ? <div className="p-4 text-center text-sm font-medium text-slate-500">Chưa có khoản nào trong tháng này.</div> : row.items.map(record => {
                  const menuOpen = menuId === record.id;
                  const pm = getExpensePaymentLabel(record);
                  return <div key={record.id} className="group relative border-b border-[var(--app-border)] px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/5 sm:grid sm:grid-cols-[120px_180px_1fr_160px_140px_40px] sm:items-center sm:gap-0 sm:border-b-0 sm:py-2">
                    <div className="flex items-start justify-between sm:contents">
                      <div className="min-w-0 flex-1 sm:hidden">
                        <div className="truncate text-sm font-bold flex items-center text-slate-900 dark:text-slate-100" title={record.title || "Khác"}>{record.title || "Khác"}{record.category === 'Thanh toán hộ' && <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${(record as any).reimbursementStatus === 'reimbursed' || (record as any).reimbursement_status === 'reimbursed' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>{(record as any).reimbursementStatus === 'reimbursed' || (record as any).reimbursement_status === 'reimbursed' ? 'Đã hoàn' : `Chờ ${getReimbursementPerson(record)} hoàn`}</span>}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{formatExpenseDateTime(record)} · {record.category}{record.subcategory ? ` / ${record.subcategory}` : ""}</div>
                      </div>
                      <div className="hidden min-w-0 truncate pr-3 text-xs font-medium text-slate-500 sm:block">{formatExpenseDateTime(record)}</div>
                      <div className="hidden min-w-0 truncate pr-3 text-xs font-semibold text-slate-600 dark:text-slate-400 sm:block" title={`${record.category}${record.subcategory ? ` / ${record.subcategory}` : ""}`}>{record.category}{record.subcategory ? ` / ${record.subcategory}` : ""}</div>
                      <div className="hidden min-w-0 truncate pr-3 text-sm font-medium flex items-center text-slate-900 dark:text-slate-100 sm:flex" title={record.title || "Khác"}>{record.title || "Khác"}{record.category === 'Thanh toán hộ' && <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${(record as any).reimbursementStatus === 'reimbursed' || (record as any).reimbursement_status === 'reimbursed' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>{(record as any).reimbursementStatus === 'reimbursed' || (record as any).reimbursement_status === 'reimbursed' ? 'Đã hoàn' : `Chờ ${getReimbursementPerson(record)} hoàn`}</span>}</div>
                      <div className="hidden min-w-0 truncate pr-3 text-left text-xs font-medium text-slate-500 sm:block" title={pm}>{pm}</div>
                      <div className="flex shrink-0 items-center gap-2 sm:contents">
                        <div className="text-sm font-bold text-rose-500 sm:text-right">{money(record.amount)}</div>
                        <div className="relative shrink-0 sm:grid sm:w-10 sm:place-items-center">
                          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuId(menuOpen ? null : record.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100/60 hover:text-slate-800">⋮</button>
                          {menuOpen && <div className="pointer-events-auto absolute right-0 top-10 z-50 w-44 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900">
                            <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuId(null); setDetail(record); }}>Xem chi tiết</button>
                            <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuId(null); setEditing(record); }}>Sửa</button>
                            {isReimbursableExpense(record) && getReimbursementStatus(record) !== "reimbursed" && <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-white/5" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void markReimbursed(record); }}>Đánh dấu đã hoàn</button>}
                            <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuId(null); setDeleting(record); }}>Xóa</button>
                          </div>}
                        </div>
                      </div>
                    </div>
                  </div>;
                })}
              </div>}
            </div>;
          })}
        </div>
      </Card>

      {detail && <ExpenseDetail record={detail} close={() => setDetail(null)} edit={() => { setDetail(null); setEditing(detail); }} remove={() => { setDetail(null); setDeleting(detail); }} />}
      {deleting && <ExpenseDeleteDialog record={deleting} close={() => setDeleting(null)} confirm={() => void remove(deleting)} />}
    </div>
  );
}

function ExpenseForm({ record, members, user, close, saved }: { record: Transaction | null; members: Member[]; user: AuthUser; close: () => void; saved: (record: Transaction) => void }) {
  const ui = useUI();
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<ExpenseDraft>(() => {
    const cat = record?.category || expenseCategories[0];
    const subcat = record?.subcategory || expenseCategoryTree[cat]?.[0] || "Khác";
    const gross = String(record?.grossAmount || record?.amount || "");
    const discount = String(record?.discountAmount || "0");
    const paymentMethod = record?.paymentMethod || record?.payment_method || "cash";
    const paymentAccountId = record?.paymentAccountId || record?.payment_account_id || record?.bankAccountId || record?.bank_account_id || "";
    const simId = record?.simId || record?.sim_id || "";
    const transactionTime = normalizeTimeValue(record?.transactionTime || record?.transaction_time) || timeFromTimestamp(record?.createdAt || record?.created_at) || currentTimeValue();
    return { id: record?.id || crypto.randomUUID(), memberId: record?.memberId || user.memberId || user.member?.id || members[0]?.id || "", date: record?.date || today, transactionTime, category: cat, subcategory: subcat, vendor: record?.title || "", grossAmount: gross, discountAmount: discount, note: record?.note || "", paymentMethod, paymentAccountId, simId, topupSimBalance: Boolean((record as any)?.simTopupApplied || (record as any)?.sim_topup_applied), reimbursementPerson: (record as any)?.reimbursementPerson || (record as any)?.reimbursement_person || "", reimbursementStatus: (record as any)?.reimbursementStatus || (record as any)?.reimbursement_status || (cat === "Thanh toán hộ" ? "pending" : "none"), reimbursedAmount: String((record as any)?.reimbursedAmount ?? (record as any)?.reimbursed_amount ?? ""), reimbursedAt: (record as any)?.reimbursedAt || (record as any)?.reimbursed_at || "" };
  });
  const grossValue = Number(String(draft.grossAmount).replace(/\D/g, "") || 0);
  const discountValue = Number(String(draft.discountAmount).replace(/\D/g, "") || 0);
  const totalAmount = grossValue - discountValue;
  const isError = discountValue > grossValue;
  const bankAccountsState = useState<any[]>([]);
  const bankAccounts = bankAccountsState[0];
  const setBankAccounts = bankAccountsState[1];
  const [memberSims, setMemberSims] = useState<MemberSim[]>([]);
  const isSimDataExpense = draft.category === "Sinh hoạt" && draft.subcategory === "Sim / Data";

  useEffect(() => {
    if (!record) return;
    console.log("ExpenseForm edit payment debug", {
      record_payment_method: record.payment_method,
      record_payment_account_id: record.payment_account_id,
      draft_paymentMethod: draft.paymentMethod,
      draft_paymentAccountId: draft.paymentAccountId,
    });
  }, [record, draft.paymentMethod, draft.paymentAccountId]);
  
  const normalizeExpenseAccountType = (value: unknown) => {
    const text = String(value || "").trim().toLowerCase();
    if (["bank_account", "tai khoan ngan hang", "tài khoản ngân hàng"].includes(text)) return "bank_account";
    if (["debit_card", "atm", "debit", "the ghi no / atm", "thẻ ghi nợ / atm", "the ghi no", "thẻ ghi nợ"].includes(text)) return text === "atm" ? "atm" : "debit_card";
    if (["credit_card", "credit", "the tin dung", "thẻ tín dụng"].includes(text)) return "credit_card";
    if (["wallet", "momo", "vi dien tu", "ví điện tử"].includes(text)) return text === "momo" ? "momo" : "wallet";
    return text;
  };

  const normalizeBankAccount = (a: any) => {
    const rawType = a.accountType || a.account_type || a.type || a.cardType || a.card_type || "";
    const accountType = normalizeExpenseAccountType(rawType);
    const displayCardType =
      a.cardType || a.card_type ||
      (accountType === "credit_card" ? "Thẻ tín dụng" :
        accountType === "debit_card" || accountType === "atm" || accountType === "debit" ? "Thẻ ghi nợ / ATM" :
          accountType === "wallet" || accountType === "momo" ? "Ví điện tử" :
            "Tài khoản ngân hàng");
    return {
      ...a,
      id: a.id,
      memberId: a.memberId || a.member_id,
      bankName: a.bankName || a.bank_name || a.bank || "",
      accountType,
      cardType: displayCardType,
      cardNetwork: a.cardNetwork || a.card_network || "",
      last4: a.last4 || a.last_4 || "",
      accountHolderName: a.accountHolderName || a.account_holder_name || "",
      accountHolder: a.accountHolder || a.account_holder || a.accountHolderName || a.account_holder_name || "",
      productName: a.productName || a.product_name || "",
      status: a.status || "active",
    };
  };

  useEffect(() => {
    const currentMemberId = draft.memberId || user.memberId || user.member?.id || "";
    const url = currentMemberId ? `/api/bank-accounts?memberId=${encodeURIComponent(currentMemberId)}` : "/api/bank-accounts";
    fetch(url).then(async res => {
      const json = await res.json().catch(() => null);
      if ((!res.ok || !json?.ok) && currentMemberId) {
        const fallback = await fetch("/api/bank-accounts", { cache: "no-store" }).then(async fallbackRes => fallbackRes.json().catch(() => null)).catch(() => null);
        const fallbackRows = Array.isArray(fallback)
          ? fallback
          : Array.isArray(fallback?.data)
            ? fallback.data
            : Array.isArray(fallback?.rows)
              ? fallback.rows
              : [];
        setBankAccounts(fallbackRows.map(normalizeBankAccount));
        return;
      }
      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.rows)
            ? json.rows
            : [];
      setBankAccounts(rows.map(normalizeBankAccount));
    }).catch(() => {
      if (!currentMemberId) {
        setBankAccounts([]);
        return;
      }
      fetch("/api/bank-accounts", { cache: "no-store" }).then(async res => {
        const json = await res.json().catch(() => null);
        const rows = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.rows)
              ? json.rows
              : [];
        setBankAccounts(rows.map(normalizeBankAccount));
      }).catch(() => setBankAccounts([]));
    });
  }, [user.memberId, user.member?.id, draft.memberId]);

  useEffect(() => {
    const currentMemberId = draft.memberId || user.memberId || user.member?.id || "";
    if (!currentMemberId) {
      setMemberSims([]);
      return;
    }
    fetch(`/api/member-sims?memberId=${encodeURIComponent(currentMemberId)}`, { cache: "no-store" }).then(async response => {
      const json = await response.json().catch(() => null);
      const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.rows) ? json.rows : [];
      setMemberSims(rows);
    }).catch(() => setMemberSims([]));
  }, [user.memberId, user.member?.id, draft.memberId]);

  function patch(value: Partial<ExpenseDraft>) { setDraft(current => ({ ...current, ...value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isError || totalAmount < 0) {
      ui.toast("Giảm giá không được lớn hơn giá gốc.", "error");
      return;
    }
    const existingPaymentAccountId = record?.paymentAccountId || record?.payment_account_id || record?.bankAccountId || record?.bank_account_id || "";
    const finalPaymentAccountId = ["cash", "other"].includes(draft.paymentMethod) ? "" : (draft.paymentAccountId || existingPaymentAccountId || "");
    const finalSimId = isSimDataExpense ? draft.simId : "";
    const shouldTopupSim = Boolean(finalSimId && draft.topupSimBalance && ["transfer", "bank_account", "bank_card", "card", "credit_card", "momo", "apple_pay"].includes(draft.paymentMethod));
    const isReimbursement = draft.category === "Thanh toán hộ";
    const isSavingExpense = draft.category === "Tiết kiệm";
    const reimbursementStatus = isReimbursement ? (draft.reimbursementStatus || "pending") : "none";
    const reimbursementAmount = isReimbursement ? Number(draft.reimbursedAmount || 0) : 0;
    const expense: Transaction = { id: draft.id, memberId: draft.memberId, date: draft.date, transactionTime: draft.transactionTime, transaction_time: draft.transactionTime, category: draft.category, subcategory: draft.subcategory, title: draft.vendor.trim() || "Khác", amount: totalAmount, grossAmount: grossValue, discountAmount: discountValue, type: "expense", note: draft.note, paymentMethod: draft.paymentMethod, payment_method: draft.paymentMethod, paymentAccountId: finalPaymentAccountId || undefined, payment_account_id: finalPaymentAccountId || undefined, bankAccountId: finalPaymentAccountId || undefined, bank_account_id: finalPaymentAccountId || undefined, simId: finalSimId || undefined, sim_id: finalSimId || undefined, simTopupApplied: shouldTopupSim, sim_topup_applied: shouldTopupSim, isReimbursable: isReimbursement, is_reimbursable: isReimbursement, reimbursementPerson: isReimbursement ? draft.reimbursementPerson || "Mẹ" : null, reimbursement_person: isReimbursement ? draft.reimbursementPerson || "Mẹ" : null, reimbursementStatus, reimbursement_status: reimbursementStatus, reimbursedAmount: reimbursementAmount, reimbursed_amount: reimbursementAmount, reimbursedAt: isReimbursement ? draft.reimbursedAt || null : null, reimbursed_at: isReimbursement ? draft.reimbursedAt || null : null, countsForPersonalExpense: !isReimbursement && !isSavingExpense, counts_for_personal_expense: !isReimbursement && !isSavingExpense, countsForCardSpending: isReimbursement || !isSavingExpense, counts_for_card_spending: isReimbursement || !isSavingExpense } as Transaction & { simTopupApplied: boolean; sim_topup_applied: boolean; reimbursementPerson?: string | null; reimbursementStatus?: string; reimbursedAmount?: number };
    const response = await fetch("/api/transactions", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expense) });
    if (!response.ok) {
      const result = await readJsonSafe<{ error?: string }>(response);
      ui.toast(result?.error || "Không thể lưu khoản chi.", "error");
      return;
    }
    const savedRecord = await response.json();
    savedRecord.amount = Number(savedRecord.amount);
    saved(savedRecord);
  }
  
  const paymentMethods = [
    { value: "cash", label: "Tiền mặt" },
    { value: "transfer", label: "Chuyển khoản" },
    { value: "momo", label: "MoMo" },
    { value: "apple_pay", label: "Apple Pay" },
    { value: "bank_account", label: "Tài khoản ngân hàng" },
    { value: "card", label: "Thẻ" },
    { value: "credit_card", label: "Thẻ tín dụng" },
    { value: "other", label: "Khác" },
  ];

  return <div className="space-y-5">
    <button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">{"← Quay lại bảng chi tiêu"}</button>
    <div><h2 className="text-2xl font-bold">{record ? "Sửa khoản chi" : "Thêm khoản chi"}</h2><p className="mt-1 text-sm text-slate-400">{"Mỗi khoản chi là một phiếu chi. Nhập nhanh chi tiết vào ghi chú nếu cần."}</p></div>
    <form onSubmit={submit} className="space-y-4">
      <Card><div className="grid gap-3 md:grid-cols-2">
        <Field label="Ngày chi"><DateVNInput required value={draft.date} onChange={value => patch({ date: value })} /></Field>
        <Field label="Giờ chi"><input required type="time" className={inputClass} value={draft.transactionTime} onChange={event => patch({ transactionTime: event.target.value })} /></Field>
        <Field label="Khoản chi"><select className={inputClass} value={draft.category} onChange={event => {
          const category = event.target.value;
          patch({ category, subcategory: expenseCategoryTree[category]?.[0] || "Khác", simId: "", topupSimBalance: false, reimbursementStatus: category === "Thanh toán hộ" ? "pending" : "none", reimbursedAmount: category === "Thanh toán hộ" ? "0" : "", reimbursedAt: "" });
        }}>{expenseCategories.map(category => <option key={category}>{category}</option>)}</select></Field>
        <Field label="Loại chi tiết"><select className={inputClass} value={draft.subcategory} onChange={event => patch({ subcategory: event.target.value, simId: event.target.value === "Sim / Data" ? draft.simId : "", topupSimBalance: event.target.value === "Sim / Data" ? draft.topupSimBalance : false })}>{(expenseCategoryTree[draft.category] || ["Khác"]).map(sub => <option key={sub}>{sub}</option>)}</select></Field>
        {isSimDataExpense && <Field label="SIM liên kết"><select className={inputClass} value={draft.simId} onChange={event => patch({ simId: event.target.value, topupSimBalance: event.target.value ? draft.topupSimBalance : false })}><option value="">Không liên kết</option>{memberSims.map(sim => <option key={sim.id} value={sim.id}>{[sim.planName || sim.phoneNumber || "SIM/Data", sim.carrier].filter(Boolean).join(" / ")}</option>)}</select></Field>}
        {isSimDataExpense && draft.simId && ["transfer", "bank_account", "bank_card", "card", "credit_card", "momo", "apple_pay"].includes(draft.paymentMethod) && <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={draft.topupSimBalance} onChange={event => patch({ topupSimBalance: event.target.checked })} /> Cộng vào số dư SIM</label>}
        {draft.category === 'Thanh toán hộ' && (
          <>
            <Field label="Người cần hoàn lại"><input className={inputClass} value={draft.reimbursementPerson || ''} onChange={event => patch({ reimbursementPerson: event.target.value })} placeholder="Mẹ" /></Field>
            <Field label="Trạng thái hoàn"><select className={inputClass} value={draft.reimbursementStatus || 'pending'} onChange={event => patch({ reimbursementStatus: event.target.value })}><option value="pending">Chưa hoàn</option><option value="partial">Đã hoàn một phần</option><option value="reimbursed">Đã hoàn đủ</option></select></Field>
            {draft.reimbursementStatus !== 'pending' && <Field label="Số tiền đã hoàn"><input type="number" className={inputClass} value={draft.reimbursedAmount || ''} onChange={event => patch({ reimbursedAmount: event.target.value })} placeholder="0" /></Field>}
            {draft.reimbursementStatus !== 'pending' && <Field label="Ngày hoàn nếu có"><DateVNInput value={draft.reimbursedAt || ''} onChange={value => patch({ reimbursedAt: value })} /></Field>}
          </>
        )}
        <Field label="Nội dung chi"><input required className={inputClass} value={draft.vendor} onChange={event => patch({ vendor: event.target.value })} placeholder="Ví dụ: Đi chợ, Thanh toán tiền điện..." /></Field>
        <Field label="Giá gốc"><input required className={inputClass} value={draft.grossAmount} onChange={event => patch({ grossAmount: event.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Giảm giá"><input className={inputClass} value={draft.discountAmount} onChange={event => patch({ discountAmount: event.target.value.replace(/\D/g, "") })} placeholder="0" /></Field>
        <Field label="Thực trả"><div className={`flex h-11 w-full items-center rounded-xl bg-slate-50 px-3 font-semibold ${isError || totalAmount < 0 ? "text-rose-500" : "text-emerald-600"} dark:bg-white/5`}>{money(totalAmount)}{isError && " (Lỗi: Giảm giá > Giá gốc)"}</div></Field>
        <Field label="Phương thức thanh toán"><select className={inputClass} value={draft.paymentMethod} onChange={event => {
          const paymentMethod = event.target.value as import("../types").PaymentMethod;
          if (!["transfer", "bank_account", "bank_card", "card", "credit_card", "momo", "apple_pay"].includes(paymentMethod)) {
            patch({ paymentMethod, paymentAccountId: "" });
          } else {
            patch({ paymentMethod });
          }
        }}>{paymentMethods.map(pm => <option key={pm.value} value={pm.value}>{pm.label}</option>)}</select></Field>
        {["transfer", "bank_account", "bank_card", "card", "credit_card", "momo", "apple_pay"].includes(draft.paymentMethod) && (() => {
          let safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
          if (draft.paymentMethod === "transfer" || draft.paymentMethod === "bank_account") {
            safeBankAccounts = safeBankAccounts.filter(b => {
              const accountType = normalizeExpenseAccountType((b as any).accountType);
              return ["bank_account", "debit_card", "atm", "debit"].includes(accountType);
            });
          } else if (draft.paymentMethod === "bank_card" || draft.paymentMethod === "card" || draft.paymentMethod === "credit_card") {
            safeBankAccounts = safeBankAccounts.filter(b => {
              const accountType = normalizeExpenseAccountType((b as any).accountType);
              return ["debit_card", "credit_card", "atm", "debit", "credit"].includes(accountType);
            });
          } else if (draft.paymentMethod === "momo") {
            safeBankAccounts = safeBankAccounts.filter(b => {
              const accountType = normalizeExpenseAccountType((b as any).accountType);
              const bankNameText = String(b.bankName || "");
              return ["wallet", "momo", ""].includes(accountType) || ["MoMo", "Momo"].includes(bankNameText);
            });
          } else if (draft.paymentMethod === "apple_pay") {
            safeBankAccounts = safeBankAccounts.filter(b => {
              const accountType = normalizeExpenseAccountType((b as any).accountType);
              return ["debit_card", "credit_card", "atm", "debit", "credit"].includes(accountType);
            });
          }
          return <Field label="Tài khoản / Thẻ liên kết">
            {safeBankAccounts.length === 0 ? <select className={inputClass} disabled><option>Chưa có thẻ/tài khoản phù hợp. Vào Hồ sơ thành viên → Thẻ ngân hàng để thêm.</option></select> : <select className={inputClass} value={draft.paymentAccountId} onChange={event => patch({ paymentAccountId: event.target.value })}><option value="">Không liên kết</option>{safeBankAccounts.map(b => <option key={b.id} value={b.id}>{getCardDisplayName(b)}</option>)}</select>}
          </Field>
        })()}
        <div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={3} className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} placeholder="Coopmart: rau 30k, thịt 120k, sữa 70k" /></Field></div>
      </div></Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white">Lưu phiếu chi</button></div>
    </form>
  </div>;
}

function ExpenseDetail({ record, close, edit, remove }: { record: Transaction; close: () => void; edit: () => void; remove: () => void }) {
  const [showId, setShowId] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [linkedSim, setLinkedSim] = useState<MemberSim | null>(null);
  const simId = record.simId || record.sim_id || "";
  const paymentAccountId = record.paymentAccountId || record.payment_account_id || record.bankAccountId || record.bank_account_id || "";
  
  useEffect(() => {
    if (paymentAccountId) {
      fetch(`/api/bank-accounts?memberId=${record.memberId}`).then(r => r.json()).then(data => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
        const acc = rows.find((b: any) => String(b.id) === String(paymentAccountId));
        if (acc) setBankAccount(acc);
      }).catch(() => {});
    }
  }, [paymentAccountId, record.memberId]);

  useEffect(() => {
    if (!simId) { setLinkedSim(null); return; }
    fetch(`/api/member-sims?memberId=${record.memberId}`).then(r => r.json()).then(data => {
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
      const found = rows.find((sim: MemberSim) => String(sim.id) === String(simId));
      setLinkedSim(found || null);
    }).catch(() => setLinkedSim(null));
  }, [simId, record.memberId]);

  const paymentMethodLabels: Record<string, string> = { cash: "Tiền mặt", transfer: "Chuyển khoản", bank_account: "Tài khoản", card: "Thẻ", bank_card: "Thẻ", credit_card: "Thẻ tín dụng", apple_pay: "Apple Pay", momo: "MoMo", other: "Khác" };

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-0 md:p-4" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-[var(--app-card)] shadow-2xl md:rounded-2xl"><div className="flex shrink-0 items-center justify-between p-5 pb-4"><h3 className="text-lg font-bold">Chi tiết phiếu chi</h3><button onClick={close} className="grid size-9 place-items-center rounded-full border border-[var(--app-border)]">×</button></div><div className="flex-1 overflow-y-auto p-5 pt-0"><div className="grid gap-3 text-sm"><AccountDetail label="Ngày chi" value={formatDateVN(record.date)} /><AccountDetail label="Khoản chi" value={record.category} /><AccountDetail label="Loại chi tiết" value={record.subcategory || "Khác"} /><AccountDetail label="Nội dung chi" value={record.title || "Khác"} /><AccountDetail label="Phương thức" value={paymentMethodLabels[record.paymentMethod || record.payment_method || "cash"] || "Tiền mặt"} />{bankAccount && <AccountDetail label="Tài khoản / Thẻ" value={`${bankAccount.bankName} - ${bankAccount.accountHolder || bankAccount.productName}`} />}{linkedSim && <AccountDetail label="SIM/Data" value={[linkedSim.planName || linkedSim.phoneNumber || "SIM/Data", linkedSim.carrier].filter(Boolean).join(" / ")} />}<AccountDetail label="Giá gốc" value={money(record.grossAmount || record.amount)} />{Number(record.discountAmount) > 0 && <AccountDetail label="Giảm giá" value={money(record.discountAmount || 0)} />}<AccountDetail label="Thực trả" value={money(record.amount)} /><div className="rounded-xl border border-[var(--app-border)] p-4"><p className="text-xs font-bold uppercase text-slate-400">Ghi chú</p><p className="mt-1 font-semibold whitespace-pre-wrap">{record.note || "Không có"}</p></div><button onClick={() => setShowId(!showId)} className="mt-2 text-left text-xs font-semibold text-slate-400">ID giao dịch (Nhấn để {showId ? "ẩn" : "hiện"})</button>{showId && <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5"><code className="break-all text-xs text-slate-500">{record.id}</code></div>}</div></div><div className="flex shrink-0 gap-3 border-t border-[var(--app-border)] p-5"><button onClick={remove} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5">Xóa</button><div className="flex-1"></div><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5">Đóng</button><button onClick={edit} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700">Sửa</button></div></div></div>;
}

function ExpenseDeleteDialog({ record, close, confirm }: { record: Transaction; close: () => void; confirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[var(--app-card)] p-5 shadow-2xl"><h3 className="text-lg font-bold">Xóa phiếu chi này?</h3><div className="mt-4 rounded-xl border border-[var(--app-border)] p-4"><b>{record.title}</b><p className="mt-1 text-sm font-bold text-rose-500">{money(record.amount)}</p></div><div className="mt-5 flex justify-end gap-3"><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Hủy</button><button onClick={confirm} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">Xóa</button></div></div></div>;
}

const bankNames = ["BIDV", "Vietcombank", "Techcombank", "MB", "VPBank", "ACB", "TPBank", "Sacombank", "VIB", "VietinBank", "Agribank", "UOB", "MoMo", "Apple Pay", "ZaloPay", "Khác"];
const bankCardTypes: import("../types").BankCardType[] = ["Tài khoản ngân hàng", "Thẻ ghi nợ / ATM", "Thẻ tín dụng", "Ví điện tử"];
const bankNetworks: import("../types").BankCardNetwork[] = ["Không áp dụng", "Visa", "Mastercard", "Napas", "JCB", "Amex"];
const bankStatuses: BankAccountStatus[] = ["Đang dùng", "Tạm khóa", "Đã hủy"];
const waiverTypes = ["Không có", "Theo tổng chi tiêu năm", "Theo tổng chi tiêu tháng", "Theo số giao dịch"] as const;
const benefitCategories = ["Siêu thị", "Y tế", "Giáo dục", "Ăn uống", "Xăng xe", "Mua sắm online", "Thanh toán hóa đơn", "Khác"] as const;
const benefitTypes = ["Hoàn tiền %", "Giảm tiền cố định", "Điểm thưởng"] as const;
const bankRawContentTypes: BankRawNoteContentType[] = ["Ưu đãi", "Phí thường niên", "Điều khoản thẻ", "Sao kê", "Email ngân hàng", "Khác"];
const emptyBenefit = (): BankCardBenefit => ({ id: crypto.randomUUID(), bankAccountId: "", name: "", category: "Khác", benefitType: "Hoàn tiền %", benefitValue: 0, monthlyCap: 0, minTransactionAmount: 0, conditionNote: "", active: true });
const emptyBankForm = (memberId = ""): BankAccount => ({ id: "", memberId, bankName: "BIDV", accountHolder: "", accountNumber: "", cardNumber: "", accountType: "Tài khoản ngân hàng", cardType: "Tài khoản ngân hàng", cardNetwork: "Không áp dụng", productName: "", branch: "", statementDay: "", dueDay: "", creditLimit: 0, expiryMonth: "", expiryYear: "", status: "Đang dùng", annualFeeEnabled: false, annualFeeAmount: 0, annualFeeWaiverType: "Không có", annualFeeWaiverTarget: 0, annualFeeCycle: "năm", annualFeeCycleStart: "", annualFeeCurrentSpending: 0, note: "", benefits: [], rewards: [] });
function maskLast(value: string, prefix = "******") { const digits = value.replace(/\s+/g, ""); return digits ? `${prefix}${digits.slice(-4)}` : "Chưa cập nhật"; }
function maskCard(value: string) { const digits = value.replace(/\D/g, ""); return digits ? `**** **** **** ${digits.slice(-4)}` : "Không có số thẻ"; }
function getCardDisplayName(b: BankAccount) {
  const last4 = b.last4 || (b.cardNumber ? b.cardNumber.replace(/\D/g, "").slice(-4) : b.accountNumber ? b.accountNumber.replace(/\s+/g, "").slice(-4) : "???");
  if (b.cardType === "Tài khoản ngân hàng") return `${b.bankName} · Tài khoản · ****${last4}`;
  if (b.cardType === "Thẻ ghi nợ / ATM") return `${b.bankName} · Thẻ ghi nợ · ****${last4}`;
  if (b.cardType === "Thẻ tín dụng") return `${b.bankName} · ${b.cardNetwork && b.cardNetwork !== "Không áp dụng" ? b.cardNetwork : "Thẻ tín dụng"} · ****${last4}`;
  return `${b.bankName} · ${b.cardType} · ****${last4}`;
}
function bankProgress(account: BankAccount) { const spent = 0, target = account.annualFeeWaiverTarget || 0, missing = Math.max(0, target - spent); return { spent, target, missing, label: target ? `Đã chi ${money(spent)} / ${money(target)} để miễn phí thường niên` : "Không có điều kiện miễn phí" }; }
type CardYearStats = {
  cardId: string;
  year: number;
  eligibleSpending: number;
  annualFeeWaiverTarget: number;
  annualFeeAmount: number;
  remainingToWaive: number;
  waiverProgress: number;
  isAnnualFeeWaived: boolean;
  rewardAmount: number;
  rewardPoints: number;
  rewardsCount: number;
};
type CardRewardFormState = {
  id?: string;
  rewardDate: string;
  type: CardRewardType;
  amount: string;
  points: string;
  title: string;
  note: string;
};
const cardRewardTypeOptions: Array<{ value: CardRewardType; label: string }> = [
  { value: "cashback", label: "Cashback" },
  { value: "redeem_points", label: "Đổi điểm" },
  { value: "voucher", label: "Voucher" },
  { value: "gift", label: "Quà tặng" },
  { value: "other", label: "Khác" }
];
const emptyCardRewardForm = (): CardRewardFormState => ({
  rewardDate: new Date().toISOString().slice(0, 10),
  type: "cashback",
  amount: "0",
  points: "0",
  title: "",
  note: ""
});
function isCreditBankCard(account: BankAccount) {
  const text = `${account.cardType || ""} ${account.accountType || ""}`.toLowerCase();
  return text.includes("tín dụng") || text.includes("credit");
}
function rewardTypeLabel(type: CardRewardType) {
  return cardRewardTypeOptions.find(option => option.value === type)?.label || "Khác";
}
function MemberBankAccounts({ member, user }: { member: Member; user: AuthUser }) {
  const ui = useUI();
  const canEdit = user.role === "full_access" || user.memberId === member.id;
  const [accounts, setAccounts] = useState<BankAccount[]>(() => bankCardsByMemberCache.get(member.id) || []);
  const [view, setView] = useState<"list" | "card">("list");
  const [loading, setLoading] = useState(!bankCardsByMemberCache.has(member.id));
  const [error, setError] = useState("");

  const [subView, setSubView] = useState<"list" | "detail" | "edit" | "new">("list");
  const [selectedCard, setSelectedCard] = useState<BankAccount | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, BankAccount>>({});
  const [editFromDetail, setEditFromDetail] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!force && bankCardsByMemberCache.has(member.id)) {
      setAccounts(bankCardsByMemberCache.get(member.id) || []);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch(`/api/bank-accounts?memberId=${encodeURIComponent(member.id)}`, { cache: "no-store" });
    const result = await readJsonSafe<{ ok?: boolean; data?: BankAccount[]; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok) return setError(result?.error || "Không thể tải thẻ ngân hàng. Vui lòng thử lại.");
    bankCardsByMemberCache.set(member.id, result.data || []);
    setAccounts(result.data || []);
  }, [member.id]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const filtered = accounts;

  const fetchFullCardDetails = async (account: BankAccount) => {
    if (detailCache[account.id]) {
      setSelectedCard(detailCache[account.id]);
      return;
    }
    setRewardsLoading(true);
    try {
      const [accountRes, rewardsRes] = await Promise.all([
        fetch(`/api/bank-accounts?id=${account.id}`),
        fetch(`/api/bank-card-rewards?bankAccountId=${account.id}`)
      ]);
      const accountJson = await accountRes.json();
      const rewardsJson = await rewardsRes.json();
      if (accountRes.ok && accountJson.data) {
        const fullCard = {
          ...accountJson.data,
          rewards: (rewardsRes.ok && rewardsJson.data) ? rewardsJson.data : []
        };
        setSelectedCard(fullCard);
        setDetailCache(prev => ({ ...prev, [account.id]: fullCard }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRewardsLoading(false);
    }
  };

  const openCreate = () => {
    setSelectedCard(emptyBankForm(member.id));
    setSubView("new");
    setEditFromDetail(false);
  };

  const openDetail = (account: BankAccount) => {
    setSelectedCard(account);
    setSubView("detail");
    setEditFromDetail(false);
    void fetchFullCardDetails(account);
  };

  const openEdit = (account: BankAccount, fromDetail = false) => {
    setSelectedCard(account);
    setSubView("edit");
    setEditFromDetail(fromDetail);
    void fetchFullCardDetails(account);
  };

  const onCardSaved = (savedCard: BankAccount) => {
    setAccounts(current => {
      const updated = current.some(c => c.id === savedCard.id)
        ? current.map(c => c.id === savedCard.id ? savedCard : c)
        : [...current, savedCard];
      bankCardsByMemberCache.set(member.id, updated);
      return updated;
    });
    setDetailCache(prev => ({ ...prev, [savedCard.id]: savedCard }));
    
    if (editFromDetail) {
      setSelectedCard(savedCard);
      setSubView("detail");
      setEditFromDetail(false);
    } else {
      setSubView("list");
      setSelectedCard(null);
    }
    ui.toast("Đã lưu thẻ ngân hàng");
  };

  async function remove(account: BankAccount) {
    if (!await ui.confirm("Xóa thẻ/tài khoản?", `Xóa thẻ/tài khoản ${account.bankName}?`)) return false;
    const response = await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) {
      ui.toast(result?.error || "Không thể xóa thẻ ngân hàng.", "error");
      return false;
    }
    setAccounts(current => {
      const next = current.filter(item => item.id !== account.id);
      bankCardsByMemberCache.set(member.id, next);
      return next;
    });
    setDetailCache(prev => {
      const copy = { ...prev };
      delete copy[account.id];
      return copy;
    });
    ui.toast("Đã xóa thẻ ngân hàng");
    return true;
  }

  const handleUpdateAccount = (updatedCard: BankAccount) => {
    setAccounts(current => current.map(c => c.id === updatedCard.id ? updatedCard : c));
    setDetailCache(prev => ({ ...prev, [updatedCard.id]: updatedCard }));
    setSelectedCard(updatedCard);
  };

  if (subView === "detail" && selectedCard) {
    return (
      <BankAccountDetail
        account={selectedCard}
        memberName={member.nickname || member.name}
        close={() => { setSubView("list"); setSelectedCard(null); }}
        loading={rewardsLoading}
        inline={true}
        edit={() => openEdit(selectedCard, true)}
        remove={async () => {
          if (await remove(selectedCard)) {
            setSubView("list");
            setSelectedCard(null);
          }
        }}
        onUpdateAccount={handleUpdateAccount}
      />
    );
  }

  if (["edit", "new"].includes(subView) && selectedCard) {
    return (
      <BankAccountSheet
        account={selectedCard}
        members={[member]}
        close={() => {
          if (editFromDetail) {
            setSubView("detail");
            setEditFromDetail(false);
          } else {
            setSubView("list");
            setSelectedCard(null);
          }
        }}
        saved={onCardSaved}
        inline={true}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Thẻ ngân hàng</h3>
          <p className="mt-1 text-sm text-slate-400">{member.nickname || member.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load(true)} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-bold text-slate-500">Làm mới</button>
          {canEdit && <button onClick={openCreate} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm thẻ</button>}
        </div>
      </div>
      <div className="flex w-fit rounded-xl border border-[var(--app-border)] p-1">
        <button onClick={() => setView("list")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "list" ? "bg-[#EEF2FF] text-[#4F46E5]" : "text-slate-500"}`}>Danh sách</button>
        <button onClick={() => setView("card")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === "card" ? "bg-[#EEF2FF] text-[#4F46E5]" : "text-slate-500"}`}>Dạng thẻ</button>
      </div>
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-400/20 dark:bg-rose-400/10"><p className="font-semibold text-rose-600">{error}</p><button onClick={() => void load(true)} className="mt-4 rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-400/30 dark:hover:bg-rose-400/20">Làm mới</button></div> : loading ? <BankCardsSkeleton view={view} /> : filtered.length ? view === "list" ? <BankAccountList accounts={filtered} detail={openDetail} edit={openEdit} remove={remove} canEdit={canEdit} /> : <BankCardGrid accounts={filtered} detail={openDetail} edit={openEdit} remove={remove} canEdit={canEdit} /> : <Card className="p-8 text-center"><p className="font-semibold">Thành viên này chưa có thẻ ngân hàng.</p>{canEdit && <button onClick={openCreate} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm thẻ</button>}</Card>}
  </div>
  );
}
function MemberBankRawNotes({ member, user }: { member: Member; user: AuthUser }) {
  const ui = useUI();
  const canEdit = user.role === "full_access" || user.memberId === member.id;
  const emptyNote = (): BankRawNote => ({ id: "", memberId: member.id, bankAccountId: "", title: "", bankName: "BIDV", contentType: "Ưu đãi", rawText: "", effectiveDate: "", expiryDate: "", note: "" });
  const [notes, setNotes] = useState<BankRawNote[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editing, setEditing] = useState<BankRawNote | null>(null);
  const [viewing, setViewing] = useState<BankRawNote | null>(null);
  const [extracting, setExtracting] = useState<BankRawNote | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [noteResponse, accountResponse] = await Promise.all([fetch("/api/bank-raw-notes", { cache: "no-store" }), fetch("/api/bank-accounts", { cache: "no-store" })]);
    const noteResult = await readJsonSafe<{ ok?: boolean; data?: BankRawNote[]; error?: string }>(noteResponse);
    const accountResult = await readJsonSafe<{ ok?: boolean; data?: BankAccount[] }>(accountResponse);
    if (!noteResponse.ok || !noteResult?.ok) return setError(noteResult?.error || "Không thể tải nội dung gốc ngân hàng.");
    setNotes((noteResult.data || []).filter(note => note.memberId === member.id));
    setAccounts((accountResult?.data || []).filter(account => account.memberId === member.id));
  }, [member.id]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function save(note: BankRawNote) {
    const response = await fetch(note.id ? `/api/bank-raw-notes/${note.id}` : "/api/bank-raw-notes", { method: note.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note) });
    const result = await readJsonSafe<{ error?: string; data?: BankRawNote }>(response);
    if (!response.ok || !result?.data) return ui.toast(result?.error || "Không thể lưu nội dung gốc.", "error");
    setNotes(current => current.some(item => item.id === result.data!.id) ? current.map(item => item.id === result.data!.id ? result.data! : item) : [result.data!, ...current]);
    setEditing(null);
    ui.toast("Đã lưu nội dung gốc");
  }
  async function remove(note: BankRawNote) {
    if (!await ui.confirm("Xóa nội dung gốc?", `Xóa nội dung "${note.title}"?`)) return;
    const response = await fetch(`/api/bank-raw-notes/${note.id}`, { method: "DELETE" });
    if (!response.ok) return ui.toast("Không thể xóa nội dung gốc.", "error");
    setNotes(current => current.filter(item => item.id !== note.id));
    ui.toast("Đã xóa nội dung gốc");
  }
  const accountLabel = (id: string) => { const account = accounts.find(item => item.id === id); return account ? account.productName || account.bankName : "Không gắn thẻ"; };
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Nội dung gốc ngân hàng</h3><p className="mt-1 text-sm text-slate-400">Lưu điều khoản, email, nội dung PDF hoặc website ngân hàng.</p></div>{canEdit && <button onClick={() => setEditing(emptyNote())} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm nội dung</button>}</div>{error && <p className="text-sm text-rose-500">{error}</p>}{notes.length ? <div className="grid gap-3">{notes.map(note => <Card key={note.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{note.title}</b><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-xs font-bold text-[#4F46E5]">{note.contentType}</span></div><p className="mt-1 text-sm font-semibold text-slate-500">{note.bankName || "Chưa chọn ngân hàng"} · {accountLabel(note.bankAccountId)}</p><p className="mt-2 line-clamp-2 text-sm text-slate-400">{note.rawText}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setViewing(note)} className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600">Xem</button>{canEdit && <button onClick={() => setEditing(note)} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-bold">Sửa</button>}{canEdit && <button onClick={() => remove(note)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Xóa</button>}</div></div></Card>)}</div> : <Card className="p-8 text-center"><p className="font-semibold">Chưa có nội dung gốc ngân hàng.</p>{canEdit && <button onClick={() => setEditing(emptyNote())} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm nội dung</button>}</Card>}{editing && <BankRawNoteSheet note={editing} accounts={accounts} close={() => setEditing(null)} save={save} />}{viewing && <BankRawNoteViewer note={viewing} close={() => setViewing(null)} extract={() => { setViewing(null); setExtracting(viewing); }} />}{extracting && <BankManualExtractSheet note={extracting} close={() => setExtracting(null)} />}</div>;
}
function BankRawNoteSheet({ note, accounts, close, save }: { note: BankRawNote; accounts: BankAccount[]; close: () => void; save: (note: BankRawNote) => void }) {
  const [form, setForm] = useState(note);
  const set = <K extends keyof BankRawNote>(key: K, value: BankRawNote[K]) => setForm(current => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><form onSubmit={event => { event.preventDefault(); save(form); }} onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl"><h2 className="text-lg font-bold">{note.id ? "Sửa nội dung gốc" : "Thêm nội dung gốc"}</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Tiêu đề"><input required className={inputClass} value={form.title} onChange={event => set("title", event.target.value)} /></Field><Field label="Ngân hàng liên quan"><select className={inputClass} value={form.bankName} onChange={event => set("bankName", event.target.value)}>{bankNames.map(name => <option key={name}>{name}</option>)}</select></Field><Field label="Thẻ liên quan nếu có"><select className={inputClass} value={form.bankAccountId} onChange={event => set("bankAccountId", event.target.value)}><option value="">Không gắn thẻ</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.productName || account.bankName}</option>)}</select></Field><Field label="Loại nội dung"><select className={inputClass} value={form.contentType} onChange={event => set("contentType", event.target.value as BankRawNoteContentType)}>{bankRawContentTypes.map(type => <option key={type}>{type}</option>)}</select></Field><Field label="Ngày hiệu lực"><DateVNInput value={form.effectiveDate} onChange={value => set("effectiveDate", value)} /></Field><Field label="Ngày hết hạn"><DateVNInput value={form.expiryDate} onChange={value => set("expiryDate", value)} /></Field><div className="md:col-span-2"><Field label="Nội dung text lớn"><textarea required rows={10} className={inputClass} value={form.rawText} onChange={event => set("rawText", event.target.value)} /></Field></div><div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={3} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Lưu nội dung</button></div></form></div>;
}
function BankRawNoteViewer({ note, close, extract }: { note: BankRawNote; close: () => void; extract: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl"><h2 className="text-lg font-bold">{note.title}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{note.bankName} · {note.contentType}</p><pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-white/5 dark:text-slate-100">{note.rawText}</pre>{note.note && <p className="mt-4 rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm text-slate-500">{note.note}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={extract} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Trích xuất thủ công</button><button onClick={extract} className="rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-600">Tạo ưu đãi từ nội dung này</button><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Đóng</button></div></div></div>;
}
function BankManualExtractSheet({ note, close }: { note: BankRawNote; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="w-full rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-2xl md:rounded-3xl"><h2 className="text-lg font-bold">Trích xuất thủ công</h2><p className="mt-1 text-sm text-slate-400">{note.title}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Phí thường niên"><input className={inputClass} type="number" min="0" /></Field><Field label="Điều kiện miễn phí"><input className={inputClass} /></Field><Field label="Cashback %"><input className={inputClass} type="number" min="0" /></Field><Field label="Danh mục áp dụng"><select className={inputClass}>{benefitCategories.map(category => <option key={category}>{category}</option>)}</select></Field><Field label="Hạn mức hoàn tiền"><input className={inputClass} type="number" min="0" /></Field></div><div className="mt-6 flex justify-end gap-3"><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Đóng</button><button onClick={close} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Lưu nháp trích xuất</button></div></div></div>;
}
function BankCardsSkeleton({ view }: { view: "list" | "card" }) {
  const block = "animate-pulse rounded-xl bg-slate-100 dark:bg-white/10";
  if (view === "card") return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-sm"><div className={`${block} h-5 w-24`} /><div className={`${block} mt-5 h-7 w-44`} /><div className={`${block} mt-6 h-12`} /><div className="mt-5 grid grid-cols-2 gap-3"><div className={`${block} h-12`} /><div className={`${block} h-12`} /></div></div>)}</div>;
  return <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-sm">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="grid gap-4 border-b border-[var(--app-border)] px-5 py-4 last:border-0 xl:grid-cols-[1fr_1.55fr_1fr_1fr_.8fr_48px]"><div className={`${block} h-10`} /><div className={`${block} h-10`} /><div className={`${block} h-10`} /><div className={`${block} h-10`} /><div className={`${block} h-10`} /><div className={`${block} h-10`} /></div>)}</div>;
}
function BankAccountList({ accounts, detail, edit, remove, canEdit = true }: { accounts: BankAccount[]; detail: (account: BankAccount) => void; edit: (account: BankAccount) => void; remove: (account: BankAccount) => void; canEdit?: boolean }) {
  return <div className="overflow-visible rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-sm"><div className="hidden grid-cols-[1fr_1.55fr_1fr_1fr_.8fr_48px] gap-4 border-b border-[var(--app-border)] bg-slate-50/70 px-5 py-3 text-xs font-bold uppercase text-slate-400 dark:bg-white/5 xl:grid"><span>Ngân hàng</span><span>Sản phẩm / Tài khoản</span><span>Chủ thẻ</span><span>Loại</span><span>Trạng thái</span><span className="text-center">⋯</span></div>{accounts.map(account => <div key={account.id} className="grid gap-4 border-b border-[var(--app-border)] px-5 py-4 text-sm last:border-0 xl:grid-cols-[1fr_1.55fr_1fr_1fr_.8fr_48px] xl:items-center"><div><b className="text-slate-800 dark:text-slate-100">{account.bankName}</b><p className="mt-1 w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-white/10">{account.cardNetwork}</p></div><div className="min-w-0"><b className="block truncate">{getCardDisplayName(account)}</b>{account.productName && <p className="mt-1 text-xs text-slate-500">{account.productName}</p>}</div><span className="font-semibold text-slate-600 dark:text-slate-200">{account.accountHolder}</span><span className="text-slate-500">{account.cardType}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${account.status === "Đang dùng" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200"}`}>{account.status}</span><BankActionMenu account={account} detail={detail} edit={edit} remove={remove} canEdit={canEdit} /></div>)}</div>;
}
function BankCardGrid({ accounts, detail, edit, remove, canEdit = true }: { accounts: BankAccount[]; detail: (account: BankAccount) => void; edit: (account: BankAccount) => void; remove: (account: BankAccount) => void; canEdit?: boolean }) {
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{accounts.map(account => <div key={account.id} className="relative rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#4F46E5] via-indigo-700 to-slate-950 p-5 text-white shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-100">{account.bankName}</p><h3 className="mt-3 text-base font-bold">{getCardDisplayName(account)}</h3><p className="mt-1 text-xs font-semibold text-indigo-100">{account.productName || account.cardType}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{account.cardNetwork}</span><BankActionMenu account={account} detail={detail} edit={edit} remove={remove} canEdit={canEdit} dark /></div></div><div className="mt-5 flex items-end justify-between gap-3 text-sm"><div><p className="text-xs text-indigo-100">Chủ thẻ</p><b>{account.accountHolder}</b></div><div className="text-right"><p className="text-xs text-indigo-100">Trạng thái</p><b>{account.status}</b></div></div></div>)}</div>;
}
function BankActionMenu({ account, detail, edit, remove, canEdit = true, dark = false }: { account: BankAccount; detail: (account: BankAccount) => void; edit: (account: BankAccount) => void; remove: (account: BankAccount) => void; canEdit?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const itemClass = "block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5";
  return <div ref={ref} className="relative flex justify-end"><button type="button" onClick={() => setOpen(current => !current)} className={`grid size-10 place-items-center rounded-xl text-xl font-bold ${dark ? "bg-white/15 text-white hover:bg-white/20" : "border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`} aria-label="Thao tác thẻ">⋯</button>{open && <div className="absolute right-0 top-11 z-30 w-40 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 text-slate-700 shadow-xl dark:text-slate-100"><button className={itemClass} onClick={() => { setOpen(false); detail(account); }}>Xem chi tiết</button>{canEdit && <button className={itemClass} onClick={() => { setOpen(false); edit(account); }}>Sửa</button>}{canEdit && <button className={`${itemClass} text-rose-500`} onClick={() => { setOpen(false); remove(account); }}>Xóa</button>}</div>}</div>;
}
interface CampaignBenefit {
  id: string;
  name: string;
  condition: string;
  expectedValue: string;
  expectedDate: string;
  status: "Chưa nhận" | "Đã nhận";
  receivedDate: string;
  note: string;
}

interface CardFees {
  interestRate: string;
  foreignFee: string;
  cashFee: string;
  feeNote: string;
  firstYearFree: boolean;
  openYear: string;
  checkYear: string;
  campaigns?: CampaignBenefit[];
}

export function parseFees(note: string, productName: string): CardFees {
  const currentYear = String(new Date().getFullYear());
  const defaultFees: CardFees = {
    interestRate: "",
    foreignFee: "",
    cashFee: "",
    feeNote: "",
    firstYearFree: false,
    openYear: "",
    checkYear: currentYear,
    campaigns: []
  };

  if (productName && productName.trim().toLowerCase().includes("bidv visa platinum cashback 360")) {
    defaultFees.firstYearFree = true;
    defaultFees.feeNote = "Mốc miễn phí có thể thay đổi theo nhóm khách hàng và địa bàn của BIDV từng thời kỳ.";
    defaultFees.interestRate = "15.5% - 16.5%/năm";
    defaultFees.foreignFee = "2.1%";
    defaultFees.cashFee = "3%, tối thiểu 50.000 đ";
  }

  if (note && note.startsWith("FEES_JSON:")) {
    try {
      const parsed = JSON.parse(note.substring("FEES_JSON:".length));
      return { ...defaultFees, ...parsed };
    } catch {
      // ignore
    }
  }

  if (note && !note.startsWith("FEES_JSON:")) {
    defaultFees.feeNote = note;
  }

  return defaultFees;
}

export function serializeFees(fees: CardFees): string {
  return "FEES_JSON:" + JSON.stringify(fees);
}

export function BankAccountSheet({ account, members, close, saved, inline = false }: { account: BankAccount; members: Member[]; close: () => void; saved: (account: BankAccount) => void; inline?: boolean }) {
  const ui = useUI();
  const [form, setForm] = useState<BankAccount>({ ...emptyBankForm(account.memberId), ...account, benefits: account.benefits || [] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fees, setFees] = useState<CardFees>(() => parseFees(account.note || "", account.productName || ""));

  const set = (key: keyof BankAccount, value: string | number | boolean) => setForm(current => ({ ...current, [key]: value }));

  const updateFee = <K extends keyof CardFees>(key: K, value: CardFees[K]) => {
    setFees(prev => {
      const updated = { ...prev, [key]: value };
      setForm(current => ({ ...current, note: serializeFees(updated) }));
      return updated;
    });
  };

  const handleProductNameChange = (value: string) => {
    setForm(current => {
      const updated = { ...current, productName: value };
      if (value.trim().toLowerCase().includes("bidv visa platinum cashback 360")) {
        updated.annualFeeAmount = 1000000;
        updated.annualFeeWaiverTarget = 10000000;
        updated.annualFeeCycle = "năm";
        updated.annualFeeWaiverType = "Theo tổng chi tiêu năm";
        
        const bidvFees = parseFees("", value);
        updated.note = serializeFees(bidvFees);
        setFees(bidvFees);
      }
      return updated;
    });
  };

  const setBenefit = (id: string, key: keyof BankCardBenefit, value: string | number | boolean) => setForm(current => ({ ...current, benefits: current.benefits.map(benefit => benefit.id === id ? { ...benefit, [key]: value } : benefit) }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); 
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      const response = await fetch(account.id ? `/api/bank-accounts/${account.id}` : "/api/bank-accounts", { method: account.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await readJsonSafe<{ ok?: boolean; data?: BankAccount; error?: string }>(response);
      if (!response.ok || !result?.data) {
        const message = result?.error || "Không thể lưu thẻ ngân hàng.";
        setError(message);
        ui.toast(message, "error");
        return;
      }
      saved(result.data);
    } finally {
      setSaving(false);
    }
  }

  const formContent = (
    <>
      {inline && (
        <div className="mb-4">
          <button type="button" onClick={close} className="flex items-center gap-1 text-sm font-semibold text-indigo-600"><ArrowLeft className="h-4 w-4" /><span>Quay lại danh sách thẻ</span></button>
        </div>
      )}
      <h2 className="text-lg font-bold">{account.id ? "Sửa thẻ ngân hàng" : "Thêm thẻ ngân hàng"}</h2>
      <div className="mt-5 space-y-6">
        {(() => {
          const isBank = form.cardType === "Tài khoản ngân hàng";
          const isDebit = form.cardType === "Thẻ ghi nợ / ATM";
          const isCredit = form.cardType === "Thẻ tín dụng";
          const isWallet = form.cardType === "Ví điện tử";
          return <>
        <div>
          <h3 className="text-sm font-bold text-indigo-600">A. Thông tin cơ bản</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Thành viên sở hữu">
              <select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>
                {members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}
              </select>
            </Field>
            <Field label={isWallet ? "Tên ví" : "Ngân hàng"}>
              <select required className={inputClass} value={form.bankName} onChange={event => set("bankName", event.target.value)}>
                {bankNames.map(name => <option key={name}>{name}</option>)}
              </select>
            </Field>
            <Field label="Loại thẻ/tài khoản">
              <select className={inputClass} value={form.cardType} onChange={event => { 
                const value = event.target.value as import("../types").BankCardType;
                let defaultNetwork = form.cardNetwork;
                if (value === "Thẻ tín dụng" && defaultNetwork === "Không áp dụng") defaultNetwork = "Visa";
                if (value === "Thẻ ghi nợ / ATM" && defaultNetwork === "Không áp dụng") defaultNetwork = "Napas";
                if (value === "Tài khoản ngân hàng" || value === "Ví điện tử") defaultNetwork = "Không áp dụng";
                setForm(current => ({ ...current, cardType: value, accountType: value, cardNetwork: defaultNetwork }));
              }}>
                {bankCardTypes.map(type => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Tên chủ tài khoản">
              <input required className={inputClass} value={form.accountHolder} onChange={event => set("accountHolder", event.target.value)} />
            </Field>
            <Field label={isBank ? "4 số cuối tài khoản" : isDebit ? "4 số cuối thẻ/tài khoản" : isCredit ? "4 số cuối thẻ tín dụng" : "Số điện thoại hoặc 4 số cuối"}>
              <input maxLength={isWallet ? 15 : 4} className={inputClass} value={form.last4 || ""} onChange={event => set("last4", event.target.value.replace(/[^\d+]/g, ""))} placeholder={isWallet ? "Ví dụ: 0912345678" : "Ví dụ: 1234"} />
            </Field>
            
            {(isDebit || isCredit) && (
            <Field label="Tổ chức thẻ">
              <select className={inputClass} value={form.cardNetwork} onChange={event => set("cardNetwork", event.target.value)}>
                {bankNetworks.map(value => <option key={value}>{value}</option>)}
              </select>
            </Field>
            )}

            {(isDebit || isCredit) && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tháng hết hạn">
                <input className={inputClass} inputMode="numeric" maxLength={2} value={form.expiryMonth} onChange={event => set("expiryMonth", event.target.value)} />
              </Field>
              <Field label="Năm hết hạn">
                <input className={inputClass} inputMode="numeric" maxLength={4} value={form.expiryYear} onChange={event => set("expiryYear", event.target.value)} />
              </Field>
            </div>
            )}

            <Field label="Trạng thái">
              <select className={inputClass} value={form.status} onChange={event => set("status", event.target.value)}>
                {bankStatuses.map(status => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Ghi chú">
                <textarea rows={3} className={inputClass} value={form.note && form.note.startsWith("FEES_JSON:") ? (parseFees(form.note, form.productName || "").feeNote || "") : form.note} onChange={event => set("note", event.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        {isCredit && (
        <div>
          <h3 className="text-sm font-bold text-indigo-600">B. Thông tin thẻ tín dụng</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Tên sản phẩm thẻ">
              <input className={inputClass} value={form.productName} onChange={event => handleProductNameChange(event.target.value)} placeholder="BIDV Visa Platinum Cashback 360" />
            </Field>
            <Field label="Hạn mức tín dụng">
              <input className={inputClass} type="number" min="0" value={form.creditLimit} onChange={event => set("creditLimit", Number(event.target.value))} />
            </Field>
            <Field label="Ngày sao kê">
              <input className={inputClass} inputMode="numeric" value={form.statementDay} onChange={event => set("statementDay", event.target.value)} />
            </Field>
            <Field label="Ngày đến hạn thanh toán">
              <input className={inputClass} inputMode="numeric" value={form.dueDay} onChange={event => set("dueDay", event.target.value)} />
            </Field>
          </div>
        </div>
        )}

        {isCredit && (
        <div>
          <h3 className="text-sm font-bold text-indigo-600">C. Biểu phí & điều kiện miễn phí</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phí thường niên">
                <input className={inputClass} type="number" min="0" value={form.annualFeeAmount} onChange={event => set("annualFeeAmount", Number(event.target.value))} />
              </Field>
              <Field label="Chu kỳ tính">
                <select className={inputClass} value={form.annualFeeCycle} onChange={event => set("annualFeeCycle", event.target.value)}>
                  <option value="tháng">tháng</option>
                  <option value="năm">năm</option>
                </select>
              </Field>
            </div>
            
            <Field label="Miễn phí năm đầu">
              <select className={inputClass} value={fees.firstYearFree ? "yes" : "no"} onChange={event => updateFee("firstYearFree", event.target.value === "yes")}>
                <option value="no">Không</option>
                <option value="yes">Có</option>
              </select>
            </Field>

            <Field label="Điều kiện miễn phí năm kế tiếp (Mức chi tiêu/năm)">
              <input className={inputClass} type="number" min="0" value={form.annualFeeWaiverTarget} onChange={event => set("annualFeeWaiverTarget", Number(event.target.value))} />
            </Field>

            <Field label="Lãi suất (/năm)">
              <input className={inputClass} value={fees.interestRate} onChange={event => updateFee("interestRate", event.target.value)} placeholder="15.5% - 16.5%/năm" />
            </Field>

            <Field label="Phí giao dịch nước ngoài">
              <input className={inputClass} value={fees.foreignFee} onChange={event => updateFee("foreignFee", event.target.value)} placeholder="2.1%" />
            </Field>

            <Field label="Phí rút tiền mặt">
              <input className={inputClass} value={fees.cashFee} onChange={event => updateFee("cashFee", event.target.value)} placeholder="3%, tối thiểu 50.000 đ" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Năm mở thẻ">
                <input className={inputClass} maxLength={4} placeholder="e.g. 2025" value={fees.openYear} onChange={event => updateFee("openYear", event.target.value)} />
              </Field>
            </div>

            {fees.firstYearFree && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 md:col-span-2">
                Năm đầu được miễn phí thường niên. Từ năm tiếp theo, hệ thống sẽ tự kiểm tra điều kiện miễn phí dựa trên chi tiêu năm trước.
              </p>
            )}

            <p className="rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-600 md:col-span-2">💡 Dù trả đúng hạn, vẫn cần theo dõi phí thường niên, lãi suất, phí giao dịch nước ngoài và phí rút tiền mặt.</p>

            <div className="md:col-span-2">
              <Field label="Ghi chú">
                <textarea rows={2} className={inputClass} value={fees.feeNote} onChange={event => updateFee("feeNote", event.target.value)} placeholder="Mốc miễn phí có thể thay đổi..." />
              </Field>
            </div>
          </div>
        </div>
        )}

        {isCredit && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-indigo-600">D. Ưu đãi / Cashback</h3>
            <button type="button" onClick={() => setForm(current => ({ ...current, benefits: [...current.benefits, emptyBenefit()] }))} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-600">+ Thêm ưu đãi</button>
          </div>
          <div className="mt-3 space-y-3">
            {form.benefits.length ? form.benefits.map(benefit => (
              <div key={benefit.id} className="rounded-xl border border-[var(--app-border)] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Tên ưu đãi">
                    <input className={inputClass} value={benefit.name} onChange={event => setBenefit(benefit.id, "name", event.target.value)} />
                  </Field>
                  <Field label="Nhóm chi tiêu áp dụng">
                    <select className={inputClass} value={benefit.category} onChange={event => setBenefit(benefit.id, "category", event.target.value)}>
                      {benefitCategories.map(category => <option key={category}>{category}</option>)}
                    </select>
                  </Field>
                  <Field label="Loại ưu đãi">
                    <select className={inputClass} value={benefit.benefitType} onChange={event => setBenefit(benefit.id, "benefitType", event.target.value)}>
                      {benefitTypes.map(type => <option key={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Giá trị">
                    <input className={inputClass} type="number" value={benefit.benefitValue} onChange={event => setBenefit(benefit.id, "benefitValue", Number(event.target.value))} />
                  </Field>
                  <Field label="Mức hoàn tối đa/tháng">
                    <input className={inputClass} type="number" value={benefit.monthlyCap} onChange={event => setBenefit(benefit.id, "monthlyCap", Number(event.target.value))} />
                  </Field>
                  <Field label="Chi tiêu tối thiểu/giao dịch">
                    <input className={inputClass} type="number" value={benefit.minTransactionAmount} onChange={event => setBenefit(benefit.id, "minTransactionAmount", Number(event.target.value))} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Ghi chú">
                      <textarea rows={2} className={inputClass} value={benefit.conditionNote} onChange={event => setBenefit(benefit.id, "conditionNote", event.target.value)} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={benefit.active} onChange={event => setBenefit(benefit.id, "active", event.target.checked)} />
                    Ưu đãi đang hoạt động
                  </label>
                  <button type="button" onClick={() => setForm(current => ({ ...current, benefits: current.benefits.filter(item => item.id !== benefit.id) }))} className="w-fit rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Xóa ưu đãi</button>
                </div>
              </div>
            )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-6 text-center text-sm text-slate-400">Chưa có rule ưu đãi.</p>}
          </div>
        </div>
        )}

        {isCredit && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-indigo-600">E. Ưu đãi mở thẻ / ưu đãi theo đợt</h3>
            <button 
              type="button" 
              onClick={() => {
                const newCampaigns = [...(fees.campaigns || []), {
                  id: crypto.randomUUID(),
                  name: "",
                  condition: "",
                  expectedValue: "",
                  expectedDate: "",
                  status: "Chưa nhận" as const,
                  receivedDate: "",
                  note: ""
                }];
                updateFee("campaigns", newCampaigns);
              }} 
              className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-600"
            >
              + Thêm ưu đãi đợt
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {(fees.campaigns && fees.campaigns.length) ? fees.campaigns.map(camp => (
              <div key={camp.id} className="rounded-xl border border-[var(--app-border)] p-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Tên ưu đãi">
                    <input 
                      className={inputClass} 
                      value={camp.name} 
                      onChange={e => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, name: e.target.value } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      placeholder="Ví dụ: Hoàn tiền mở thẻ mới"
                    />
                  </Field>
                  <Field label="Mô tả / điều kiện">
                    <input 
                      className={inputClass} 
                      value={camp.condition} 
                      onChange={e => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, condition: e.target.value } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      placeholder="Ví dụ: Chi tiêu 2 triệu trong 30 ngày"
                    />
                  </Field>
                  <Field label="Giá trị dự kiến">
                    <input 
                      className={inputClass} 
                      value={camp.expectedValue} 
                      onChange={e => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, expectedValue: e.target.value } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      placeholder="Ví dụ: 500.000 đ"
                    />
                  </Field>
                  <Field label="Ngày dự kiến nhận">
                    <input 
                      className={inputClass} 
                      value={camp.expectedDate} 
                      onChange={e => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, expectedDate: e.target.value } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      placeholder="Ví dụ: 30/06/2026"
                    />
                  </Field>
                  <Field label="Trạng thái">
                    <select 
                      className={inputClass} 
                      value={camp.status} 
                      onChange={e => {
                        const newStatus = e.target.value as "Chưa nhận" | "Đã nhận";
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { 
                          ...c, 
                          status: newStatus,
                          receivedDate: newStatus === "Đã nhận" ? formatDateVN(new Date().toISOString()) : c.receivedDate
                        } : c) || [];
                        updateFee("campaigns", updated);
                      }}
                    >
                      <option value="Chưa nhận">Chưa nhận</option>
                      <option value="Đã nhận">Đã nhận</option>
                    </select>
                  </Field>
                  <Field label="Ngày đã nhận">
                    <input 
                      className={inputClass} 
                      value={camp.receivedDate} 
                      onChange={e => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, receivedDate: e.target.value } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      placeholder="Ví dụ: 05/06/2026"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Ghi chú">
                      <input 
                        className={inputClass} 
                        value={camp.note} 
                        onChange={e => {
                          const updated = fees.campaigns?.map(c => c.id === camp.id ? { ...c, note: e.target.value } : c) || [];
                          updateFee("campaigns", updated);
                        }} 
                        placeholder="Ví dụ: Đã gọi tổng đài xác nhận"
                      />
                    </Field>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  {camp.status === "Chưa nhận" && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const updated = fees.campaigns?.map(c => c.id === camp.id ? { 
                          ...c, 
                          status: "Đã nhận" as const,
                          receivedDate: formatDateVN(new Date().toISOString())
                        } : c) || [];
                        updateFee("campaigns", updated);
                      }} 
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                    >
                      Đã nhận
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => {
                      const updated = fees.campaigns?.filter(c => c.id !== camp.id) || [];
                      updateFee("campaigns", updated);
                    }} 
                    className="w-fit rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-500"
                  >
                    Xóa ưu đãi
                  </button>
                </div>
              </div>
            )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] px-4 py-6 text-center text-sm text-slate-400">Chưa có ưu đãi mở thẻ.</p>}
          </div>
        </div>
        )}
        </>;
        })()}
      </div>
      {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Hủy</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu"}</button>
      </div>
    </>
  );

  if (inline) {
    return (
      <Card className="p-6 w-full max-w-[1280px]">
        <form onSubmit={submit} className="w-full space-y-6">
          {formContent}
        </form>
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}>
      <form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl">
        {formContent}
      </form>
  </div>
  );
}
export function BankAccountDetail({ account, memberName: owner, close, loading = false, inline = false, edit, remove, onUpdateAccount }: { account: BankAccount; memberName: string; close: () => void; loading?: boolean; inline?: boolean; edit?: () => void; remove?: () => void; onUpdateAccount?: (acc: BankAccount) => void }) {
  const ui = useUI();
  const [showFull, setShowFull] = useState(false);
  const progress = bankProgress(account);
  const fees = parseFees(account.note || "", account.productName || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCreditCard = isCreditBankCard(account);
  const currentYear = new Date().getFullYear();
  const [statsYear, setStatsYear] = useState(currentYear);
  const [cardStats, setCardStats] = useState<CardYearStats | null>(null);
  const [cardRewards, setCardRewards] = useState<CardReward[]>([]);
  const [cardStatsLoading, setCardStatsLoading] = useState(false);
  const [rewardEditor, setRewardEditor] = useState<CardRewardFormState | null>(null);
  const [rewardMenuId, setRewardMenuId] = useState<string | null>(null);
  const rewardMenuRef = useRef<HTMLDivElement>(null);

  const loadCardYearData = useCallback(async () => {
    if (!isCreditCard || !account.id) return;
    setCardStatsLoading(true);
    try {
      const [statsResponse, rewardsResponse] = await Promise.all([
        fetch(`/api/bank-accounts/${encodeURIComponent(account.id)}/stats?year=${statsYear}`, { cache: "no-store" }),
        fetch(`/api/card-rewards?bank_account_id=${encodeURIComponent(account.id)}&year=${statsYear}`, { cache: "no-store" })
      ]);
      const statsResult = await readJsonSafe<{ ok?: boolean; data?: CardYearStats; error?: string }>(statsResponse);
      const rewardsResult = await readJsonSafe<{ ok?: boolean; data?: CardReward[]; error?: string }>(rewardsResponse);
      setCardStats(statsResponse.ok && statsResult?.data ? statsResult.data : null);
      setCardRewards(rewardsResponse.ok && rewardsResult?.data ? rewardsResult.data : []);
    } finally {
      setCardStatsLoading(false);
    }
  }, [account.id, isCreditCard, statsYear]);

  useEffect(() => {
    void loadCardYearData();
  }, [loadCardYearData]);

  useEffect(() => {
    if (!menuOpen) return;
    const clickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!rewardMenuId) return;
    const clickOutside = (e: MouseEvent) => {
      if (rewardMenuRef.current && !rewardMenuRef.current.contains(e.target as Node)) {
        setRewardMenuId(null);
      }
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [rewardMenuId]);

  async function saveCardReward(event: React.FormEvent) {
    event.preventDefault();
    if (!rewardEditor) return;
    const payload = {
      bankAccountId: account.id,
      rewardDate: rewardEditor.rewardDate,
      type: rewardEditor.type,
      amount: parseVndInput(rewardEditor.amount),
      points: Number(rewardEditor.points || 0),
      status: "received",
      title: rewardEditor.title,
      note: rewardEditor.note
    };
    const response = await fetch(rewardEditor.id ? `/api/card-rewards/${rewardEditor.id}` : "/api/card-rewards", {
      method: rewardEditor.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await readJsonSafe<{ ok?: boolean; error?: string }>(response);
    if (!response.ok || result?.ok === false) {
      ui.toast(result?.error || "Không thể lưu hoàn tiền/điểm thưởng.", "error");
      return;
    }
    ui.toast(rewardEditor.id ? "Đã cập nhật hoàn tiền/điểm thưởng." : "Đã thêm hoàn tiền/điểm thưởng.", "success");
    setRewardEditor(null);
    await loadCardYearData();
  }

  async function deleteCardReward(reward: CardReward) {
    if (!window.confirm("Bạn có chắc muốn xóa khoản hoàn tiền/điểm thưởng này không?")) return;
    const response = await fetch(`/api/card-rewards/${reward.id}`, { method: "DELETE" });
    const result = await readJsonSafe<{ ok?: boolean; error?: string }>(response);
    if (!response.ok || result?.ok === false) {
      ui.toast(result?.error || "Không thể xóa hoàn tiền/điểm thưởng.", "error");
      return;
    }
    ui.toast("Đã xóa hoàn tiền/điểm thưởng.", "success");
    await loadCardYearData();
  }

  function editCardReward(reward: CardReward) {
    setRewardEditor({
      id: reward.id,
      rewardDate: reward.rewardDate || new Date().toISOString().slice(0, 10),
      type: reward.type,
      amount: String(reward.amount || 0),
      points: String(reward.points || 0),
      title: reward.title || "",
      note: reward.note || ""
    });
  }

  const content = (
    <>
      {inline && (
        <div className="mb-4">
          <button type="button" onClick={close} className="flex items-center gap-1 text-sm font-semibold text-indigo-600"><ArrowLeft className="h-4 w-4" /><span>Quay lại danh sách thẻ</span></button>
        </div>
      )}
      <div className="flex items-center justify-between relative">
        <h2 className="text-lg font-bold">Chi tiết thẻ ngân hàng</h2>
        {(edit || remove) && (
          <div ref={menuRef} className="relative">
            <button 
              type="button" 
              onClick={() => setMenuOpen(!menuOpen)} 
              className="grid size-9 place-items-center rounded-xl border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 text-lg font-bold"
              aria-label="Thao tác"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-36 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl">
                {edit && (
                  <button 
                    onClick={() => { setMenuOpen(false); edit(); }} 
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    Chỉnh sửa
                  </button>
                )}
                {remove && (
                  <button 
                    onClick={() => { setMenuOpen(false); remove(); }} 
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 text-rose-500"
                  >
                    Xóa thẻ
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 space-y-5">
        <section>
          <h3 className="font-semibold">Thông tin thẻ</h3>
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            {[["Ngân hàng", account.bankName], ["Sản phẩm", account.productName || "Chưa cập nhật"], ["Tên nhận diện", getCardDisplayName(account)], ["Thành viên", owner], ["Chủ thẻ", account.accountHolder], ["Loại", account.cardType], ["Tổ chức thẻ", account.cardNetwork], ["Trạng thái", account.status], ["Hạn mức tín dụng", money(account.creditLimit)], ["Ngày sao kê", account.statementDay || "Không có"], ["Ngày đến hạn", account.dueDay || "Không có"], ["4 số cuối", account.last4 || (showFull ? account.accountNumber || "Không có" : maskLast(account.accountNumber))], ["Hết hạn", account.expiryMonth || account.expiryYear ? `${account.expiryMonth}/${account.expiryYear}` : "Không áp dụng"], ["Ghi chú", account.note && account.note.startsWith("FEES_JSON:") ? (parseFees(account.note, account.productName || "").feeNote || "Không có") : (account.note || "Không có")]].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 font-medium">{value}</p>
              </div>
            ))}
          </div>
        </section>
        
        <section>
          <h3 className="font-semibold">Biểu phí & điều kiện miễn phí</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm space-y-2 bg-[var(--app-card)]">
              <div>
                <p className="text-xs text-slate-400">Phí thường niên</p>
                <p className="font-medium mt-0.5">{account.annualFeeAmount ? `${money(account.annualFeeAmount)}/năm` : "Miễn phí"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Miễn phí năm đầu</p>
                <p className="font-medium mt-0.5">{fees.firstYearFree ? "Có" : "Không"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Điều kiện miễn phí năm kế tiếp</p>
                <p className="font-medium mt-0.5">{account.annualFeeWaiverTarget ? `Chi tiêu từ ${money(account.annualFeeWaiverTarget)}/năm` : "Không có điều kiện"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Lãi suất</p>
                <p className="font-medium mt-0.5">{fees.interestRate || "Chưa cập nhật"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Phí giao dịch nước ngoài</p>
                <p className="font-medium mt-0.5">{fees.foreignFee || "Chưa cập nhật"}</p>
                {fees.foreignFee && <p className="text-[11px] text-slate-400 mt-0.5">Bao gồm phí xử lý giao dịch tại ĐVCNT nước ngoài và phí chuyển đổi ngoại tệ.</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400">Phí rút tiền mặt</p>
                <p className="font-medium mt-0.5">{fees.cashFee || "Chưa cập nhật"}</p>
              </div>
              {fees.feeNote && (
                <div className="pt-1 border-t border-[var(--app-border)]">
                  <p className="text-xs text-slate-400">Ghi chú biểu phí</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium italic">{fees.feeNote}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm space-y-3 bg-[var(--app-card)] flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2">Tự động kiểm tra phí thường niên</h4>
                {(() => {
                  const openYr = parseInt(fees.openYear);
                  if (!isNaN(openYr)) {
                    return (
                      <div className="space-y-2 mt-3">
                        {fees.firstYearFree && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-700 w-10">{openYr}:</span>
                            <span className="text-emerald-600 font-medium">Miễn phí năm đầu</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700 w-10">{fees.firstYearFree ? openYr + 1 : openYr}:</span>
                          <span className="text-orange-600 font-medium">Cần kiểm tra chi tiêu năm {fees.firstYearFree ? openYr : openYr - 1}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700 w-10">{fees.firstYearFree ? openYr + 2 : openYr + 1}:</span>
                          <span className="text-orange-600 font-medium">Cần kiểm tra chi tiêu năm {fees.firstYearFree ? openYr + 1 : openYr}</span>
                        </div>
                      </div>
                    );
                  }
                  return <p className="text-xs text-slate-400 mt-2">Vui lòng cập nhật "Năm mở thẻ" trong khi chỉnh sửa thẻ để xem lịch kiểm tra tự động.</p>;
                })()}
              </div>

              <div className="space-y-2 mt-4">
                {fees.firstYearFree && (
                  <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                    Năm đầu được miễn phí thường niên. Từ năm tiếp theo, hệ thống sẽ tự kiểm tra điều kiện miễn phí dựa trên chi tiêu năm trước.
                  </p>
                )}
                
                <p className="text-[11px] font-semibold text-indigo-600 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                  💡 Dù trả đúng hạn, vẫn cần theo dõi phí thường niên, lãi suất, phí giao dịch nước ngoài và phí rút tiền mặt.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {isCreditCard && (
          <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold">Thống kê & Hoàn tiền năm</h3>
              <div className="flex items-center gap-2">
                <select value={statsYear} onChange={event => setStatsYear(Number(event.target.value))} className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm font-semibold outline-none focus:border-indigo-400">
                  {Array.from({ length: 6 }, (_, index) => currentYear - 3 + index).map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <button type="button" onClick={() => setRewardEditor(emptyCardRewardForm())} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">+ Thêm hoàn tiền</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Chi tiêu hợp lệ", money(cardStats?.eligibleSpending || 0)],
                ["Mức cần đạt miễn phí thường niên", cardStats?.annualFeeWaiverTarget ? money(cardStats.annualFeeWaiverTarget) : "Không yêu cầu"],
                ["Còn thiếu", money(cardStats?.remainingToWaive || 0)],
                ["Trạng thái", !cardStats?.annualFeeWaiverTarget ? "Không yêu cầu" : cardStats.isAnnualFeeWaived ? "Đã đủ" : "Chưa đủ"],
                ["Hoàn tiền năm", money(cardStats?.rewardAmount || 0)],
                ["Điểm đã đổi", vnMoneyFormatter.format(cardStats?.rewardPoints || 0)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--app-border)] p-3">
                  <p className="text-xs text-slate-400">{label}</p>
                  <b className="mt-1 block text-sm">{value}</b>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500"><span>Tiến độ chi tiêu</span><span>{Math.round(cardStats?.waiverProgress || 0)}%</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.min(cardStats?.waiverProgress || 0, 100)}%` }} /></div>
            </div>

            {rewardEditor && (
              <form onSubmit={saveCardReward} className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-400/20 dark:bg-indigo-400/10">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ngày nhận"><input type="date" value={rewardEditor.rewardDate} onChange={event => setRewardEditor(prev => prev ? { ...prev, rewardDate: event.target.value } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400" /></Field>
                  <Field label="Loại"><select value={rewardEditor.type} onChange={event => setRewardEditor(prev => prev ? { ...prev, type: event.target.value as CardRewardType } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400">{cardRewardTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Số tiền quy đổi"><input type="text" value={formatVndInput(rewardEditor.amount)} onChange={event => setRewardEditor(prev => prev ? { ...prev, amount: String(parseVndInput(event.target.value)) } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-right text-sm outline-none focus:border-indigo-400" /></Field>
                  <Field label="Điểm nếu có"><input type="number" min="0" value={rewardEditor.points} onChange={event => setRewardEditor(prev => prev ? { ...prev, points: event.target.value } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-right text-sm outline-none focus:border-indigo-400" /></Field>
                  <Field label="Nội dung"><input value={rewardEditor.title} onChange={event => setRewardEditor(prev => prev ? { ...prev, title: event.target.value } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400" /></Field>
                  <Field label="Ghi chú"><input value={rewardEditor.note} onChange={event => setRewardEditor(prev => prev ? { ...prev, note: event.target.value } : prev)} className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400" /></Field>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setRewardEditor(null)} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Hủy</button>
                  <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Lưu</button>
                </div>
              </form>
            )}

            <div className="mt-4 space-y-3">
              {cardStatsLoading ? (
                <div className="animate-pulse space-y-2"><div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-white/10"></div><div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-white/10"></div></div>
              ) : cardRewards.length ? cardRewards.map(reward => (
                <div key={reward.id} className="relative rounded-xl border border-[var(--app-border)] p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <b>{reward.title || rewardTypeLabel(reward.type)}</b>
                      <p className="mt-1 text-slate-500">{rewardTypeLabel(reward.type)} · {money(reward.amount)} · {reward.points ? `${vnMoneyFormatter.format(reward.points)} điểm` : "Không có điểm"}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateVN(reward.rewardDate, "Chưa có ngày")} · {reward.note || "Không có ghi chú"}</p>
                    </div>
                    <div ref={rewardMenuId === reward.id ? rewardMenuRef : undefined} className="relative shrink-0">
                      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setRewardMenuId(current => current === reward.id ? null : reward.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100/60 hover:text-slate-800">⋮</button>
                      {rewardMenuId === reward.id && (
                        <div className="pointer-events-auto absolute right-0 top-full z-50 mt-2 w-32 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-900">
                          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setRewardMenuId(null); editCardReward(reward); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5">Sửa</button>
                          <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setRewardMenuId(null); void deleteCardReward(reward); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-400/10">Xóa</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-slate-400">Chưa có hoàn tiền/điểm thưởng ghi nhận.</p>}
            </div>
          </section>
        )}

        <section>
          <h3 className="font-semibold">Ưu đãi đang áp dụng</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {account.benefits.length ? account.benefits.map(benefit => (
              <div key={benefit.id} className="rounded-xl border border-[var(--app-border)] p-4 text-sm">
                <b>{benefit.name || benefit.category}</b>
                <p className="mt-2 text-slate-500">{benefit.category} · {benefit.benefitType} · {benefit.benefitValue}{benefit.benefitType === "Hoàn tiền %" ? "%" : ""}</p>
                <p className="mt-1 text-xs text-slate-400">Tối đa/tháng: {money(benefit.monthlyCap)} · Tối thiểu GD: {money(benefit.minTransactionAmount)}</p>
                {benefit.conditionNote && <p className="mt-2 text-xs text-slate-400">{benefit.conditionNote}</p>}
              </div>
            )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-slate-400">Chưa có ưu đãi.</p>}
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Thống kê tháng này</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[["Tổng chi tiêu qua thẻ", money(0)], ["Đã hoàn tiền", money(0)], ["Đã tiết kiệm", money(0)], ["Còn thiếu để miễn phí", money(progress.missing)]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[var(--app-border)] p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <b className="mt-2 block">{value}</b>
              </div>
            ))}
          </div>
        </section>
        
        <section>
          <h3 className="font-semibold">Giao dịch liên quan</h3>
          <p className="mt-3 rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-slate-400">Sẽ hiển thị khi form Thu chi liên kết nguồn thanh toán/thẻ.</p>
        </section>

        <section>
          <h3 className="font-semibold text-indigo-600">Ưu đãi mở thẻ / ưu đãi theo đợt</h3>
          <div className="mt-3 space-y-3">
            {(fees.campaigns && fees.campaigns.length) ? (
              <div className="grid gap-3 md:grid-cols-2">
                {fees.campaigns.map(camp => (
                  <div key={camp.id} className="rounded-xl border border-[var(--app-border)] p-4 text-sm space-y-2 bg-[var(--app-card)] flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <b className="text-base text-slate-800 dark:text-slate-100">{camp.name || "Ưu đãi chưa đặt tên"}</b>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${camp.status === "Đã nhận" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-300"}`}>
                          {camp.status}
                        </span>
                      </div>
                      {camp.condition && <p className="mt-2 text-slate-500 text-xs"><b>Điều kiện:</b> {camp.condition}</p>}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div>
                          <p>Giá trị dự kiến</p>
                          <b className="text-slate-600 dark:text-slate-300">{camp.expectedValue || "Chưa rõ"}</b>
                        </div>
                        <div>
                          <p>Dự kiến nhận</p>
                          <b className="text-slate-600 dark:text-slate-300">{camp.expectedDate || "Chưa rõ"}</b>
                        </div>
                      </div>
                      {camp.status === "Đã nhận" && camp.receivedDate && (
                        <p className="mt-2 text-xs text-emerald-600 font-semibold">Ngày nhận: {camp.receivedDate}</p>
                      )}
                      {camp.note && <p className="mt-2 text-xs italic text-slate-400">Ghi chú: {camp.note}</p>}
                    </div>
                    {camp.status === "Chưa nhận" && onUpdateAccount && (
                      <button
                        type="button"
                        onClick={async () => {
                          const updatedCampaigns = fees.campaigns?.map(c => c.id === camp.id ? {
                            ...c,
                            status: "Đã nhận" as const,
                            receivedDate: formatDateVN(new Date().toISOString())
                          } : c) || [];
                          const updatedFees = { ...fees, campaigns: updatedCampaigns };
                          const updatedNote = serializeFees(updatedFees);
                          const updatedForm = { ...account, note: updatedNote };
                          
                          // Save to DB immediately
                          const response = await fetch(`/api/bank-accounts/${account.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updatedForm)
                          });
                          if (response.ok) {
                            const result = await response.json();
                            if (result?.data) {
                              onUpdateAccount(result.data);
                            }
                          } else {
                            ui.toast("Không thể cập nhật trạng thái ưu đãi.", "error");
                          }
                        }}
                        className="mt-3 w-full rounded-lg bg-emerald-500 py-1.5 text-center text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
                      >
                        Đã nhận
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-slate-400">
                Chưa có ưu đãi mở thẻ.
              </p>
            )}
          </div>
        </section>
      </div>
      
      <div className="mt-6 flex gap-3">
        <button onClick={() => setShowFull(current => !current)} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">
          {showFull ? "Ẩn số đầy đủ" : "Hiện số đầy đủ"}
        </button>
        <button onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">
          Đóng
        </button>
      </div>
    </>
  );

  if (inline) {
    return (
      <Card className="p-6 w-full max-w-[1280px] animate-fade-in">
        <div className="w-full space-y-6">
          {content}
        </div>
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}>
      <div onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-3xl md:rounded-3xl">
        {content}
      </div>
  </div>
  );
}
function EventRow({ event, edit }: { event: EventItem; edit?: () => void }) { const date = parseDate(event.date); return <Card className="mb-3 flex items-center gap-3"><Circle color={event.color}>{date ? String(date.getDate()).padStart(2, "0") : event.date}</Circle><div className="min-w-0 flex-1"><b>{event.title}</b><p className="text-xs text-slate-400">{formatDateVN(event.date)} · {event.time} · {event.type === "birthday" ? "Sinh nhật" : event.type === "medical" ? "Khám bệnh" : event.type === "school" ? "Học tập" : "Gia đình"}</p></div>{edit && <EditButton onClick={edit} />}</Card>; }
function Calendar({ data, user }: { data: AppData; user: AuthUser }) { return <TimeTreeCalendar members={data.members} user={user} />; }
function ComingSoonModule({ title }: { title: string }) { return <Card className="flex min-h-[220px] items-center justify-center p-8 text-center"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm font-medium text-slate-400">Sẽ bổ sung sau</p></div></Card>; }
function Notes({ data, open, t }: ListProps) { const [query, setQuery] = useState(""); const notes = data.notes.filter(note => note.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); return <><input className={`${filterClass} mb-4`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tiêu đề ghi chú" /><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{notes.map(x => <Card key={x.id}><b>{x.important ? "★ " : ""}{x.title}</b>{x.tag && <p className="mt-1 text-xs text-rose-400">#{x.tag}</p>}<p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{x.content}</p><div className="mt-3 flex items-center justify-between"><p className="text-[10px] text-slate-400">{x.updatedAt}</p><EditButton onClick={() => open({ kind: "notes", item: x })} /></div></Card>)}</div><AddButton label={t("add")} onClick={() => open({ kind: "notes" })} /></>; }

const formLabels: Record<EntityKind, string> = { members: "thành viên", tasks: "công việc", transactions: "giao dịch", events: "sự kiện", notes: "ghi chú" };
const inputClass = "w-full min-w-0 max-w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-3 text-sm outline-none focus:border-rose-400";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (label === "Avatar URL" || label === "Avatar (URL ảnh)") return null;
  return <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">{label}</span>{children}</label>;
}
function DateVNInput({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  return <input
    key={value}
    required={required}
    inputMode="numeric"
    placeholder="DD/MM/YYYY"
    className={inputClass}
    defaultValue={formatDateVN(value)}
    onChange={event => {
      const next = event.target.value;
      const iso = isoDateFromVN(next);
      if (iso) onChange(iso);
      if (!next.trim()) onChange("");
    }}
    onBlur={event => { event.currentTarget.value = formatDateVN(value); }}
  />;
}
function MemberSelect({ members, value, set, required = false }: { members: Member[]; value: string; set: (value: string) => void; required?: boolean }) { return <Field label={required ? "Thành viên phụ trách" : "Thành viên liên quan"}><select required={required} className={inputClass} value={value} onChange={event => set(event.target.value)}><option value="">{required ? "Chọn thành viên" : "Không gán thành viên"}</option>{members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></Field>; }
function EditorSheet({ editor, actor, members, close, save, remove }: { editor: NonNullable<Editor>; actor: AuthUser; members: Member[]; close: () => void; save: (kind: EntityKind, item: EntityItem) => void; remove: (kind: EntityKind, id: string) => void }) {
  const existing = editor.item;
  const initial = existing ? { ...existing } : editor.kind === "members" ? { name: "", nickname: "", birthday: "", gender: "", role: "Khác", phone: "", avatar: "", notes: "", color: "#cbd5e1" } : editor.kind === "tasks" ? { title: "", memberId: members[0]?.id ?? "", assignee: members[0]?.name ?? "", due: "", dueDate: "", priority: "normal", status: "todo" } : editor.kind === "transactions" ? { title: "", memberId: "", amount: "", type: "expense", category: "Khác", date: "" } : editor.kind === "events" ? { title: "", memberId: "", type: "family", date: "", time: "", color: "#60a5fa" } : { title: "", memberId: "", kind: "general", important: "false", tag: "", content: "", updatedAt: "Hôm nay" };
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, String(value)])));
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = existing?.id ?? crypto.randomUUID();
    const item = editor.kind === "members" ? { id, name: form.name, nickname: form.nickname, birthday: form.birthday, gender: form.gender as Member["gender"], phone: form.phone, avatar: form.avatar, notes: form.notes, color: form.color } :
      editor.kind === "tasks" ? { id, title: form.title, memberId: form.memberId, assignee: memberName(members, form.memberId), due: form.dueDate, dueDate: form.dueDate, priority: form.priority as Task["priority"], status: form.status as Task["status"] } :
      editor.kind === "transactions" ? { id, title: form.title, memberId: form.memberId, amount: Number(form.amount), type: form.type as Transaction["type"], category: form.category, date: form.date } :
      editor.kind === "events" ? { id, title: form.title, memberId: form.memberId, type: form.type as EventItem["type"], date: form.date, time: form.time, color: form.color } :
      { id, title: form.title, memberId: form.memberId, kind: form.kind as Note["kind"], important: form.important === "true", tag: form.tag, content: form.content, updatedAt: "Hôm nay" };
    save(editor.kind, item);
  }
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 md:items-center md:p-6" onMouseDown={close}>
    <form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-lg md:rounded-3xl">
      <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300 md:hidden" /><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{existing ? "Sửa" : "Thêm"} {formLabels[editor.kind]}</h2><button type="button" onClick={close} className="rounded-full px-3 py-1 text-xl text-slate-400">×</button></div>
      <div className="space-y-4">
        {editor.kind === "members" && <><Field label="Họ tên"><input required disabled={actor.role === "self_only"} className={inputClass} value={form.name} onChange={e => set("name", e.target.value)} /></Field><Field label="Biệt danh / nickname"><input className={inputClass} value={form.nickname} onChange={e => set("nickname", e.target.value)} /></Field><BirthdaySelect disabled={actor.role === "self_only"} value={form.birthday} onChange={value => set("birthday", value)} /><Field label="Giới tính"><select disabled={actor.role === "self_only"} className={inputClass} value={form.gender} onChange={e => set("gender", e.target.value)}><option value="">Chưa chọn</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></Field><Field label="Số điện thoại"><input type="tel" className={inputClass} value={form.phone} onChange={e => set("phone", e.target.value)} /></Field><Field label="Avatar (URL ảnh)"><input className={inputClass} value={form.avatar} onChange={e => set("avatar", e.target.value)} placeholder="https://... hoặc data:image/..." /></Field><Field label="Ghi chú"><textarea rows={3} className={inputClass} value={form.notes} onChange={e => set("notes", e.target.value)} /></Field></>}
        {editor.kind === "tasks" && <><Field label="Tên công việc"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} required /><Field label="Hạn chót"><DateVNInput required value={form.dueDate} onChange={value => set("dueDate", value)} /></Field><Field label="Mức ưu tiên"><select className={inputClass} value={form.priority} onChange={e => set("priority", e.target.value)}><option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option></select></Field><Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={e => set("status", e.target.value)}><option value="todo">Chờ làm</option><option value="doing">Đang làm</option><option value="done">Hoàn thành</option></select></Field></>}
        {editor.kind === "transactions" && <><Field label="Nội dung"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Số tiền"><input required min="0" type="number" className={inputClass} value={form.amount} onChange={e => set("amount", e.target.value)} /></Field><Field label="Loại"><select className={inputClass} value={form.type} onChange={e => set("type", e.target.value)}><option value="expense">Chi</option><option value="income">Thu</option></select></Field><Field label="Khoản chi"><select className={inputClass} value={form.category} onChange={e => set("category", e.target.value)}>{expenseCategories.map(category => <option key={category}>{category}</option>)}</select></Field><MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} /><Field label="Ngày chi"><DateVNInput required value={form.date} onChange={value => set("date", value)} /></Field></>}
        {editor.kind === "events" && <><Field label="Tên sự kiện"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Loại sự kiện"><select className={inputClass} value={form.type} onChange={e => set("type", e.target.value)}><option value="family">Gia đình</option><option value="birthday">Sinh nhật</option><option value="medical">Khám bệnh</option><option value="school">Học tập / họp phụ huynh</option></select></Field><MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} /><Field label="Ngày"><DateVNInput required value={form.date} onChange={value => set("date", value)} /></Field><Field label="Giờ"><input required type="time" className={inputClass} value={form.time} onChange={e => set("time", e.target.value)} /></Field><Field label="Màu"><input type="color" className={`${inputClass} h-12`} value={form.color} onChange={e => set("color", e.target.value)} /></Field></>}
        {editor.kind === "notes" && <><Field label="Tiêu đề"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Loại ghi chú"><select className={inputClass} value={form.kind} onChange={e => set("kind", e.target.value)}><option value="general">Ghi chú chung</option><option value="member">Theo thành viên</option></select></Field>{form.kind === "member" && <MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} required />}<Field label="Tag"><input className={inputClass} value={form.tag} onChange={e => set("tag", e.target.value)} placeholder="Ví dụ: sức khỏe" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.important === "true"} onChange={e => set("important", String(e.target.checked))} /> Ghi chú quan trọng</label><Field label="Nội dung"><textarea required rows={5} className={inputClass} value={form.content} onChange={e => set("content", e.target.value)} /></Field></>}
      </div>
      <div className="mt-6 flex gap-3">{existing && actor.role === "full_access" && editor.kind !== "members" && <button type="button" onClick={() => remove(editor.kind, existing.id)} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Xóa</button>}<button className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Lưu</button></div>
    </form>
  </div>;
}

function Settings({ user, onLogout, openProfile, openChangePassword, language, setLanguage, theme, setTheme, updateData, t }: { user: AuthUser; onLogout: () => void; openProfile: () => void; openChangePassword: () => void; language: Language; setLanguage: (x: Language) => void; theme: Theme; setTheme: (x: Theme) => void; updateData: (data: AppData) => void; t: ReturnType<typeof translator> }) {
  const ui = useUI();
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(dataService.getStatus());
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | "new" | null>(null);
  useEffect(() => {
    const refresh = () => setSystemStatus(dataService.getStatus());
    window.addEventListener("family-hub:system-status", refresh);
    return () => window.removeEventListener("family-hub:system-status", refresh);
  }, []);
  useEffect(() => { if (user.role === "full_access") { void loadUsers(); void loadResetRequests(); } }, [user.role]);
  async function loadUsers() { const response = await fetch("/api/users"); const result = await readJsonSafe<{ users?: ManagedUser[] }>(response); if (response.ok && result?.users) setUsers(result.users); }
  async function loadResetRequests() { const response = await fetch("/api/users/password-reset-requests"); const result = await readJsonSafe<{ requests?: PasswordResetRequest[] }>(response); if (response.ok && result?.requests) setResetRequests(result.requests); }
  async function checkConnection() {
    setChecking(true); setSystemStatus(await dataService.checkConnection()); setChecking(false);
  }
  async function syncToNas() {
    setSyncing(true); setSystemStatus(await dataService.syncCacheToNas()); setSyncing(false);
  }
  function exportData() {
    const blob = new Blob([dataService.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `family-hub-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    URL.revokeObjectURL(url);
  }
  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !await ui.confirm("Import dữ liệu?", "Import sẽ ghi đè toàn bộ dữ liệu hiện tại. Bạn có muốn tiếp tục?")) return;
    try { updateData(dataService.importData(await file.text())); ui.toast("Đã import dữ liệu thành công."); }
    catch (error) { ui.toast(error instanceof Error ? error.message : "Không thể đọc file JSON.", "error"); }
  }
  async function resetData() {
    if (!await ui.confirm("Reset dữ liệu?", "Reset sẽ xóa dữ liệu hiện tại và khôi phục dữ liệu mặc định. Bạn có muốn tiếp tục?")) return;
    updateData(dataService.reset());
    ui.toast("Đã reset dữ liệu.");
  }
  async function resetPassword(target: ManagedUser) { const password = prompt(`Nhập mật khẩu mới cho ${target.username} (ít nhất 6 ký tự):`); if (!password || !await ui.confirm("Reset mật khẩu?", `Reset mật khẩu cho ${target.username}?`)) return; const response = await fetch("/api/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id, password }) }); const result = await readJsonSafe<{ error?: string }>(response); ui.toast(response.ok ? "Đã reset mật khẩu." : result?.error || "Không thể reset mật khẩu.", response.ok ? "success" : "error"); void loadUsers(); }
  async function handleResetRequest(request: PasswordResetRequest) { const password = prompt(`Nhập mật khẩu tạm mới cho ${request.username} (ít nhất 6 ký tự):`); if (!password || !await ui.confirm("Đặt mật khẩu tạm?", `Đặt mật khẩu tạm cho ${request.username}?`)) return; const response = await fetch("/api/users/password-reset-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.id, password }) }); const result = await readJsonSafe<{ error?: string }>(response); ui.toast(response.ok ? "Đã đặt mật khẩu tạm. User phải đổi mật khẩu sau khi đăng nhập." : result?.error || "Không thể đặt mật khẩu tạm.", response.ok ? "success" : "error"); void loadResetRequests(); void loadUsers(); }
  async function deleteUser(target: ManagedUser) { if (!await ui.confirm("Xóa tài khoản?", `Xóa tài khoản ${target.username}?`)) return; const response = await fetch(`/api/users?id=${target.id}`, { method: "DELETE" }); const result = await readJsonSafe<{ error?: string }>(response); ui.toast(response.ok ? "Đã xóa tài khoản." : result?.error || "Không thể xóa tài khoản.", response.ok ? "success" : "error"); void loadUsers(); }
  return <div className="max-w-2xl">{user.mustChangePassword && <Card className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-400/10"><b className="text-orange-600">Bạn đang dùng mật khẩu mặc định hoặc mật khẩu vừa được reset.</b><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Hãy đổi mật khẩu để bảo vệ tài khoản.</p><button onClick={openChangePassword} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">Đổi mật khẩu</button></Card>}<SectionTitle label="Tài khoản" /><Card className="flex items-center gap-3"><div className="min-w-0 flex-1"><b>{user.displayName}</b><p className="text-xs text-slate-400">{accessLabel(user.role)}</p></div><button onClick={openProfile} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Hồ sơ cá nhân</button><button onClick={onLogout} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Đăng xuất</button></Card>{user.role === "full_access" && <><SectionTitle label="Yêu cầu đặt lại mật khẩu" /><div className="space-y-3">{resetRequests.length ? resetRequests.map(request => <Card key={request.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><b>{request.displayName}</b><p className="text-xs text-slate-400">{request.username} · {accessLabel(request.role)}</p><p className="mt-1 text-xs text-slate-400">{new Date(request.requestedAt).toLocaleString("vi-VN")}</p></div><button onClick={() => handleResetRequest(request)} className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white">Đặt mật khẩu tạm</button></Card>) : <Card className="text-sm text-slate-400">Không có yêu cầu đang chờ.</Card>}</div><SectionTitle label="Quản lý tài khoản" action="Thêm user" onClick={() => setEditingUser("new")} /><div className="space-y-3">{users.map(account => <Card key={account.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><b>{account.displayName}</b><p className="text-xs text-slate-400">{account.username} · {accessLabel(account.role)} · {account.active ? "Đang hoạt động" : "Đã tắt"}</p></div><div className="flex gap-1"><EditButton onClick={() => setEditingUser(account)} /><button onClick={() => resetPassword(account)} className="rounded-xl px-2 py-2 text-xs font-bold text-orange-500">Reset</button>{!account.isSystem && <button onClick={() => deleteUser(account)} className="rounded-xl px-2 py-2 text-xs font-bold text-red-500">Xóa</button>}</div></Card>)}</div>{editingUser && <UserEditor user={editingUser} close={() => setEditingUser(null)} saved={() => { setEditingUser(null); void loadUsers(); }} />}</>}<SectionTitle label={t("language")} /><Card><select className="w-full bg-transparent outline-none" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="ja">日本語</option></select></Card><SectionTitle label={t("appearance")} /><Card className="flex gap-2">{(["light","dark","system"] as Theme[]).map(x => <button key={x} onClick={() => setTheme(x)} className={`flex-1 rounded-xl px-2 py-3 text-xs font-bold ${theme===x ? "bg-rose-400 text-white" : "bg-rose-50 text-slate-500 dark:bg-white/10 dark:text-slate-200"}`}>{t(x)}</button>)}</Card>
  <SectionTitle label="Sao lưu dữ liệu" /><Card className="space-y-3"><p className="text-sm text-slate-500 dark:text-slate-300">Xuất file JSON để lưu trữ hoặc import để khôi phục dữ liệu trên thiết bị này.</p><button onClick={exportData} className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Export file JSON</button><label className="block w-full cursor-pointer rounded-xl border border-rose-300 px-4 py-3 text-center text-sm font-bold text-rose-500">Import file JSON<input type="file" accept="application/json,.json" className="hidden" onChange={importData} /></label><button onClick={resetData} className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-500">Reset về dữ liệu mặc định</button></Card>
  <SectionTitle label="Trạng thái hệ thống" /><Card className="space-y-3"><div className="flex items-center justify-between gap-3"><div><b>{systemStatus.source === "nas" ? "PostgreSQL NAS" : "localStorage fallback"}</b><p className="mt-1 text-xs text-slate-400">{systemStatus.message}</p></div><span className={`size-3 shrink-0 rounded-full ${systemStatus.source === "nas" ? "bg-emerald-400" : "bg-orange-400"}`} /></div><p className="text-xs text-slate-400">Đồng bộ cuối: {systemStatus.lastSyncedAt ? new Date(systemStatus.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có"}</p>{systemStatus.counts && <div className="grid grid-cols-2 gap-2 rounded-xl bg-rose-50 p-3 text-xs dark:bg-white/5"><span>Thành viên: <b>{systemStatus.counts.members}</b></span><span>Công việc: <b>{systemStatus.counts.tasks}</b></span><span>Thu chi: <b>{systemStatus.counts.transactions}</b></span><span>Sự kiện: <b>{systemStatus.counts.events}</b></span><span>Ghi chú: <b>{systemStatus.counts.notes}</b></span></div>}<button disabled={checking} onClick={checkConnection} className="w-full rounded-xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-500 disabled:opacity-50">{checking ? "Đang kiểm tra..." : "Kiểm tra kết nối database"}</button><button disabled={syncing} onClick={syncToNas} className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{syncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu localStorage lên NAS"}</button></Card>
  <SectionTitle label="Cài đặt ứng dụng" /><Card className="space-y-3 text-sm text-slate-500 dark:text-slate-300"><p><b className="text-[var(--app-foreground)]">Android / Chrome:</b> mở menu trình duyệt và chọn Thêm vào màn hình chính hoặc Cài đặt ứng dụng.</p><p><b className="text-[var(--app-foreground)]">iPhone / Safari:</b> nhấn nút Chia sẻ, sau đó chọn Thêm vào MH chính.</p><p>Sau khi cài đặt, Family Hub mở ở chế độ standalone như một ứng dụng và hỗ trợ mở lại dữ liệu đã dùng khi mất mạng.</p></Card>
  <p className="mt-5 text-center text-xs text-slate-400">{t("storage")}</p></div>;
}

function EmptyState() { return <div className="p-8 text-center text-sm text-slate-500">Không có dữ liệu</div>; }
