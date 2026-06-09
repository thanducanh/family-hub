"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { TimeTreeCalendar } from "@/components/timetree-calendar";
import { addAccountPasswordNotification, addDailyEventNotification, isCalendarNotificationUnread, loadVisibleCalendarNotifications, markCalendarNotificationsRead, markNotificationRead, notificationEvent, type CalendarNotification } from "@/lib/calendar-notifications";
import { translator } from "@/lib/i18n";
import { dataService, type SystemStatus } from "@/services/data-service";
import type { AppData, BankAccount, BankAccountStatus, BankCardBenefit, BankCardType, BankRawNote, BankRawNoteContentType, EventItem, IncomeCategory, IncomeFrequency, IncomeRecord, IncomeSource, IncomeSourceType, IncomeStatus, Language, Member, MemberJob, MemberJobStatus, Note, Task, Theme, Transaction, IncomeYearlySummaryRow } from "@/types";
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
const icons: Record<Screen | "plus" | "check", React.ReactNode> = { dashboard: <HomeIcon />, members: <UsersIcon />, tasks: <CheckListIcon />, finance: <WalletIcon />, chat: <ChatIcon />, calendar: <CalendarIcon />, notes: <NotesIcon />, settings: <SettingsIcon />, notifications: <BellIcon />, plus: "+", check: "✓" };
const vnDateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const vnMoneyFormatter = new Intl.NumberFormat("vi-VN");
const money = (value: number) => `${vnMoneyFormatter.format(Number.isFinite(value) ? value : 0)} đ`;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
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
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  const selectClass = `${inputClass} min-h-12`;
  return <Field label="Ngày sinh"><div className="grid grid-cols-3 gap-2"><select disabled={disabled} className={selectClass} value={day && Number(day) <= maxDay ? String(Number(day)) : ""} onChange={event => select(event.target.value, month, year)}><option value="">Ngày</option>{Array.from({ length: maxDay }, (_, index) => String(index + 1)).map(value => <option key={value}>{value}</option>)}</select><select disabled={disabled} className={selectClass} value={month ? String(Number(month)) : ""} onChange={event => select(day, event.target.value, year)}><option value="">Tháng</option>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map(value => <option key={value}>{value}</option>)}</select><select disabled={disabled} className={selectClass} value={year} onChange={event => select(day, month, event.target.value)}><option value="">Năm</option>{Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) => String(new Date().getFullYear() - index)).map(value => <option key={value}>{value}</option>)}</select></div></Field>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-sm ${className}`}>{children}</div>;
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
        if (dataUrl.length > 900000) { alert("Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn."); setOpen(false); return; }
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
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [language, setLanguage] = useState<Language>("vi");
  const [theme, setTheme] = useState<Theme>("system");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<CalendarNotification[]>([]);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
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
  function deleteItem(kind: EntityKind, id: string) {
    if (!confirm("Bạn có chắc muốn xóa mục này?")) return;
    update({ ...data!, [kind]: (data![kind] as EntityItem[]).filter(item => item.id !== id) });
    setEditor(null);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
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
  const content = children ? <>{children}</> : profilePageOpen ? <ProfilePage user={headerUser} member={currentMember} data={data} update={update} openChangePassword={() => setChangePasswordOpen(true)} logout={logout} savedUser={setUser} refreshCurrentUser={refreshCurrentUser} /> :
    screen === "dashboard" ? <Dashboard data={data} go={go} notifications={notifications} user={user} /> :
    screen === "members" ? <Members data={data} user={user} update={update} /> :
    screen === "tasks" ? <Tasks data={data} update={update} open={setEditor} t={t} /> :
    screen === "finance" ? <Finance data={data} open={setEditor} t={t} user={user} /> :
    screen === "chat" ? <ComingSoonModule title={t("chat")} /> :
    screen === "calendar" ? <Calendar data={data} user={user} /> :
    screen === "notes" ? <Notes data={data} open={setEditor} t={t} /> :
    screen === "notifications" ? <NotificationsView user={user} notifications={notifications} setNotifications={setNotifications} /> :
    <Settings user={user} onLogout={logout} openProfile={() => setProfilePageOpen(true)} openChangePassword={() => setChangePasswordOpen(true)} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} updateData={setData} t={t} />;

  return <main className={`min-h-screen bg-[var(--app-background)] pb-[90px] text-[var(--app-foreground)] transition-[padding-left] duration-300 md:pb-0 ${sidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"}`}>
    <Sidebar screen={screen} go={go} t={t} collapsed={sidebarCollapsed} toggle={() => setSidebarCollapsed(collapsed => !collapsed)} />
    <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-nav)] px-4 py-3 backdrop-blur md:px-6">
      <div className={`mx-auto flex items-center gap-3 ${screen === "calendar" ? "max-w-none" : "max-w-7xl"}`}>
        <label className="relative hidden w-full max-w-md md:block"><span className="absolute inset-y-0 left-3 grid place-items-center text-slate-400"><SearchIcon /></span><input placeholder="Tìm kiếm..." className="h-11 w-full rounded-lg border border-[var(--app-border)] bg-transparent pl-10 pr-3 text-sm outline-none focus:border-indigo-400" /></label>
        <div className="min-w-0 flex-1 md:hidden"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">Family Hub</p><h1 className="truncate text-lg font-bold">{profilePageOpen ? "Hồ sơ cá nhân" : t(titleKey[screen])}</h1></div>
        <div className="relative ml-auto flex items-center gap-2">
          <button aria-label="Đổi giao diện sáng tối" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="grid size-11 place-items-center rounded-full border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"><ThemeIcon dark={theme === "dark"} /></button>
          <button aria-label="Thông báo" onClick={() => go("notifications")} className="relative grid size-11 place-items-center rounded-full border border-[var(--app-border)] text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"><BellIcon />{notifications.some(item => isCalendarNotificationUnread(item, user)) && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{notifications.filter(item => isCalendarNotificationUnread(item, user)).length}</span>}</button>
          <button aria-label="Mở menu tài khoản" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)} className="flex items-center gap-2 rounded-lg p-1 text-left hover:bg-slate-50 dark:hover:bg-white/5">
            <span className="grid size-10 overflow-hidden rounded-full bg-indigo-500 text-sm font-bold text-white shadow-sm"><AccountAvatar user={headerUser} /></span><span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{headerUser.displayName}</span><ChevronDownIcon />
          </button>
          {accountMenuOpen && <AccountMenu user={headerUser} openProfile={() => { setAccountMenuOpen(false); setProfilePageOpen(true); }} openSettings={() => { setAccountMenuOpen(false); setProfilePageOpen(false); setScreen("settings"); }} logout={logout} />}
        </div>
      </div>
    </header>
    <section className={`mx-auto px-5 py-5 md:pb-8 ${screen === "calendar" ? "max-w-none md:px-4" : "max-w-7xl md:px-8"}`}>{!children && screen !== "members" && screen !== "calendar" && <div className="mb-5 hidden md:block"><h1 className="text-2xl font-bold">{profilePageOpen ? "Hồ sơ cá nhân" : t(titleKey[screen])}</h1><p className="mt-1 text-sm text-slate-400">Family Hub / {profilePageOpen ? "Hồ sơ cá nhân" : t(titleKey[screen])}</p></div>}{content}</section>
    <Nav screen={screen} go={go} t={t} />
    {editor && <EditorSheet key={`${editor.kind}:${editor.item?.id ?? "new"}`} editor={editor} actor={user} members={data.members} close={() => setEditor(null)} save={saveItem} remove={deleteItem} />}
    {changePasswordOpen && <ChangePasswordSheet close={() => setChangePasswordOpen(false)} saved={async user => { setUser(user); await refreshCurrentUser(); }} />}
  </main>;
}
function visibleDataFor(user: AuthUser, data: AppData) {
  return user.role === "self_only" ? { ...data, members: data.members.filter(member => member.id === user.memberId) } : data;
}

function AccountAvatar({ user, size = "size-10" }: { user: { avatar?: string; displayName: string; member?: Member }; size?: string }) {
  const displayName = user.member?.name || user.displayName;
  const avatar = user.member?.avatar || user.avatar;
  if (avatar) return <Image unoptimized width={96} height={96} src={avatar} className={`${size} shrink-0 rounded-full object-cover`} alt={displayName} />;
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

function ProfilePage({ user, member, data, update, openChangePassword, logout, savedUser, refreshCurrentUser }: { user: AuthUser; member?: Member; data: AppData; update: (data: AppData) => void; openChangePassword: () => void; logout: () => void; savedUser: (user: AuthUser) => void; refreshCurrentUser: () => Promise<AuthUser | null> }) {
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  if (!member && user.role === "full_access") return <SystemAdminProfile user={user} openChangePassword={openChangePassword} logout={logout} savedUser={savedUser} refreshCurrentUser={refreshCurrentUser} />;
  if (!member) return <Card className="p-6 text-sm text-slate-500">Tài khoản chưa được liên kết với hồ sơ thành viên. Quản trị viên có thể gán thành viên trong phần quản lý tài khoản.</Card>;
  const activeMember = member || user.member;
  const displayName = activeMember?.name || user.displayName || user.username;
  const displayAvatar = activeMember?.avatar || user.avatar;
  const profileUser = { ...user, displayName, avatar: displayAvatar, member: activeMember };
  const details = [
    ["Họ tên", activeMember?.name || "Chưa cập nhật"],
    ["Ngày sinh", formatBirthday(activeMember?.birthday || "")],
    ["Giới tính", genderLabel(activeMember?.gender || "")],
    ["Điện thoại", activeMember?.phone || "Chưa cập nhật"],
    ["Email", (user as ManagedUser).email || "Chưa cập nhật"],
    ["Vai trò", accessLabel(user.role)],
    ["Trạng thái", "Đang hoạt động"],
  ];
  const actionClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5";
  const syncProfile = (nextUser: AuthUser, nextMember?: Member | null) => {
    const syncedMember = nextMember || nextUser.member;
    savedUser({ ...nextUser, member: syncedMember || nextUser.member });
    if (syncedMember) update({ ...data, members: data.members.map(item => item.id === syncedMember.id ? syncedMember : item) });
  };
  return <div className="max-w-3xl space-y-5">
    <Card className="overflow-visible p-0">
      <div className="flex flex-col gap-5 border-b border-[var(--app-border)] p-6 sm:flex-row sm:items-start">
        <AccountAvatar user={profileUser} size="size-24" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">Hồ sơ cá nhân</p>
          <h2 className="mt-2 truncate text-2xl font-semibold">{displayName}</h2>
          <p className="mt-1 text-sm text-slate-400">{user.username} · {accessLabel(user.role)}</p>
        </div>
        <div className="relative self-start">
          <button type="button" onClick={() => setMoreOpen(open => !open)} className="grid size-10 place-items-center rounded-lg border border-[var(--app-border)] text-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5" aria-label="Thao tác hồ sơ" aria-expanded={moreOpen}>⋮</button>
          {moreOpen && <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-2 shadow-xl">
            <button type="button" onClick={() => { setMoreOpen(false); setProfileEditorOpen(true); }} className={actionClass}><UserIcon /> Chỉnh sửa hồ sơ</button>
            <button type="button" onClick={() => { setMoreOpen(false); openChangePassword(); }} className={actionClass}><LockIcon /> Đổi mật khẩu</button>
            <button type="button" onClick={() => { setMoreOpen(false); setActivityOpen(true); }} className={actionClass}><NotesIcon /> Nhật ký hoạt động</button>
            <button type="button" onClick={logout} className={`${actionClass} text-rose-500`}><LogoutIcon /> Đăng xuất</button>
          </div>}
        </div>
      </div>
      <div className="grid gap-0 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="border-b border-[var(--app-border)] px-6 py-4 last:border-b-0 sm:odd:border-r"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}
      </div>
    </Card>
    {profileEditorOpen && <ProfileSheet user={profileUser} close={() => setProfileEditorOpen(false)} saved={syncProfile} refreshCurrentUser={refreshCurrentUser} profileSaved={(profile, nextMember) => syncProfile(profile, nextMember)} />}
    {activityOpen && <Sheet close={() => setActivityOpen(false)}><h2 className="text-lg font-bold">Nhật ký hoạt động</h2><div className="mt-5 space-y-3 text-sm text-slate-500"><div className="rounded-xl border border-[var(--app-border)] p-4"><b className="text-[var(--app-foreground)]">Hồ sơ đang hoạt động</b><p className="mt-1">Phiên hiện tại đã được đồng bộ với hồ sơ thành viên liên kết.</p></div><div className="rounded-xl border border-[var(--app-border)] p-4"><b className="text-[var(--app-foreground)]">Tài khoản đăng nhập</b><p className="mt-1">{user.username} · {accessLabel(user.role)}</p></div></div></Sheet>}
  </div>;
}

function SystemAdminProfile({ user, openChangePassword, logout, savedUser, refreshCurrentUser }: { user: AuthUser; openChangePassword: () => void; logout: () => void; savedUser: (user: AuthUser) => void; refreshCurrentUser: () => Promise<AuthUser | null> }) {
  const [form, setForm] = useState({ displayName: user.displayName || "Quản trị viên", email: "", avatar: user.avatar || "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(true);
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
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
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
  return <Field label={label}><div className="relative"><input required={required} type={visible ? "text" : "password"} autoComplete={autoComplete} className={`${inputClass} pr-12`} value={value} onChange={event => setValue(event.target.value)} /><button type="button" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setVisible(current => !current)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-rose-500"><PasswordEyeIcon visible={visible} /></button></div></Field>;
}

function ChangePasswordSheet({ close, saved }: { close: () => void; saved: (user: AuthUser) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
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
  return <Sheet close={close}><form onSubmit={submit}><h2 className="text-lg font-bold">Đổi mật khẩu</h2><p className="mt-1 text-sm text-slate-400">Mật khẩu mới cần ít nhất 6 ký tự.</p><div className="mt-5 space-y-4"><PasswordField label="Mật khẩu hiện tại" value={currentPassword} setValue={setCurrentPassword} autoComplete="current-password" /><PasswordField label="Mật khẩu mới" value={newPassword} setValue={setNewPassword} autoComplete="new-password" /><PasswordField label="Nhập lại mật khẩu mới" value={confirmPassword} setValue={setConfirmPassword} autoComplete="new-password" /></div>{error && <p className="mt-3 text-sm text-red-500">{error}</p>}{success && <p className="mt-3 text-sm font-bold text-emerald-500">{success}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Đóng</button><button disabled={loading} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Đang lưu..." : "Đổi mật khẩu"}</button></div></form></Sheet>;
}

export function ProfileSheet({ user, close, saved, profileSaved, refreshCurrentUser }: { user: AuthUser; close: () => void; saved: (user: AuthUser) => void; profileSaved?: (user: AuthUser, member?: Member | null) => void; refreshCurrentUser?: () => Promise<AuthUser | null> }) {
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ displayName: user.displayName, email: "", avatar: user.avatar, memberId: user.memberId || "", name: "", nickname: "", phone: "", birthday: "", gender: "", notes: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
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
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setSuccess("");
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
  return <Sheet close={close}><form onSubmit={submit}><h2 className="text-lg font-bold">Hồ sơ cá nhân</h2><div className="mt-5 flex items-center gap-3"><AccountAvatar user={{ avatar: form.avatar, displayName: form.displayName }} size="size-16" /><div><b>{form.displayName || user.username}</b><p className="text-xs text-slate-400">{profile?.username ?? user.username} · {accessLabel(profile?.role ?? user.role)}</p></div></div><div className="mt-5 space-y-4"><Field label="Username"><input disabled className={inputClass} value={profile?.username ?? user.username} readOnly /></Field>{profile?.memberId ? <><Field label="Họ tên"><input required className={inputClass} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></Field><Field label="Biệt danh"><input className={inputClass} value={form.nickname} onChange={event => setForm(current => ({ ...current, nickname: event.target.value }))} /></Field><Field label="Email (Tài khoản)"><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field><Field label="Số điện thoại"><input type="tel" className={inputClass} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></Field><BirthdaySelect value={form.birthday} onChange={value => setForm(current => ({...current, birthday: value}))} /><Field label="Giới tính"><select className={inputClass} value={form.gender} onChange={event => setForm(current => ({ ...current, gender: event.target.value }))}><option value="">Chưa chọn</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></Field><Field label="Avatar URL"><input className={inputClass} value={form.avatar} onChange={event => setForm(current => ({ ...current, avatar: event.target.value }))} /></Field><Field label="Ghi chú cá nhân"><textarea rows={3} className={inputClass} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} /></Field></> : <><Field label="Tên hiển thị"><input required className={inputClass} value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.target.value }))} /></Field><Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></Field><Field label="Avatar URL"><input className={inputClass} value={form.avatar} onChange={event => setForm(current => ({ ...current, avatar: event.target.value }))} /></Field>{user.role === "full_access" && <Field label="Liên kết thành viên"><select className={inputClass} value={form.memberId} onChange={event => setForm(current => ({ ...current, memberId: event.target.value }))}><option value="">Chưa liên kết</option>{members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></Field>}</>}<Field label="Quyền hệ thống"><input disabled className={inputClass} value={accessLabel(profile?.role ?? user.role)} readOnly /></Field><Field label="Trạng thái"><input disabled className={inputClass} value={profile?.active === false ? "Đã tắt" : "Đang hoạt động"} readOnly /></Field>{profile?.createdAt && <Field label="Ngày tạo tài khoản"><input disabled className={inputClass} value={new Date(profile.createdAt).toLocaleString("vi-VN")} readOnly /></Field>}</div>{error && <p className="mt-3 text-sm text-red-500">{error}</p>}{success && <p className="mt-3 text-sm font-bold text-emerald-500">{success}</p>}<div className="mt-6 flex gap-3"><button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Đóng</button><button disabled={loading} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Đang lưu..." : "Lưu hồ sơ"}</button></div></form></Sheet>;
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
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editType, setEditType] = useState<'none' | 'account' | 'password'>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";

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
    if (!account || !canManage || account.isSystem || !confirm(`Xác nhận xóa liên kết tài khoản ${account.username}?`)) return;
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

function Nav({ screen, go, t }: { screen: Screen; go: (s: Screen) => void; t: ReturnType<typeof translator> }) {
  const items: Screen[] = ["dashboard", "members", "calendar", "finance", "notifications"];
  return <nav className="fixed bottom-0 left-0 z-20 flex w-full justify-around border-t border-[var(--app-border)] bg-[var(--app-nav)] px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
    {items.map(item => <button key={item} onClick={() => go(item)} className={`min-w-14 rounded-xl px-1 py-1 text-center ${screen === item ? "text-rose-500" : "text-slate-400"}`}><span className="block text-xl">{icons[item]}</span><span className="text-[10px] font-bold">{t(titleKey[item])}</span></button>)}
  </nav>;
}

function Sidebar({ screen, go, t, collapsed, toggle }: { screen: Screen; go: (s: Screen) => void; t: ReturnType<typeof translator>; collapsed: boolean; toggle: () => void }) {
  const items: Screen[] = ["dashboard", "members", "calendar", "finance", "chat", "notes", "notifications", "settings"];
  return <aside className={`fixed inset-y-0 left-0 hidden border-r border-[var(--app-border)] bg-[var(--app-sidebar)] py-5 transition-[width] duration-300 md:flex md:flex-col ${collapsed ? "w-[64px] px-2" : "w-[220px] px-4"}`}>
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
const filterClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-3 text-sm outline-none focus:border-rose-400";

function Dashboard({ data, go, notifications, user }: { data: AppData; go: (s: Screen) => void; notifications: CalendarNotification[]; user: AuthUser }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isThisMonth = (date: string) => {
    const parsed = parseDate(date, now);
    return parsed?.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
  };
  const sumTransactions = (items: Transaction[]) => items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
  const total = (type: Transaction["type"], thisMonth = false) => sumTransactions(data.transactions.filter(item => item.type === type && (!thisMonth || isThisMonth(item.date))));
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
    return { label: `${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`, income: sumTransactions(data.transactions.filter(item => item.type === "income" && matches(item))), expense: sumTransactions(data.transactions.filter(item => item.type === "expense" && matches(item))) };
  });
  const categoryTotals = Object.entries(
    data.transactions
      .filter((item) => item.type === "expense")
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
    <div className="col-span-12 md:hidden">
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800 dark:text-white">Thông báo</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadCount} tin chưa đọc
            </span>
          )}
        </div>
        <button onClick={() => go("notifications")} className="text-xs font-semibold text-indigo-600">
          Xem tất cả
        </button>
      </Card>
    </div>

    <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, color, hint]) => <MetricCard key={label} label={label} value={value} color={color} hint={hint} />)}</div>
    <div className="col-span-12 xl:col-span-8"><MonthlyChart data={monthly} /></div>
    <div className="col-span-12 xl:col-span-4 flex flex-col gap-4">
      <CompletionChart value={completion} done={doneCount} total={data.tasks.length} />
      <div className="hidden md:block">
        <Card className="p-5 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Thông báo</h2>
            <button onClick={() => go("notifications")} className="text-xs font-semibold text-indigo-600">Xem tất cả</button>
          </div>
          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
            {notifications.length ? (
              notifications.slice(0, 3).map(item => {
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
    </div>
    <div className="col-span-12 xl:col-span-5"><CategoryChart data={categoryTotals} /></div>
  </div>;
}
function MetricCard({ label, value, color, hint }: { label: string; value: string; color: string; hint: string }) { return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p><p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-indigo-400/10">●</span></div><p className="mt-4 text-xs text-slate-400">{hint}</p></Card>; }
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
type MemberProfileTab = "profile" | "account" | "work" | "bank" | "bankRaw" | "security" | "tasks" | "events" | "notes";
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
  const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";
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
  return <div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div>{!personal && <button onClick={close} className="text-sm font-semibold text-indigo-600">← Danh sách thành viên</button>}<h2 className={personal ? "text-2xl font-semibold" : "mt-3 text-2xl font-semibold"}>{personal ? "Hồ sơ cá nhân" : existing ? "Hồ sơ thành viên" : "Thêm thành viên"}</h2><p className="mt-1 text-sm text-slate-400">Family Hub / {personal ? "Hồ sơ cá nhân" : `Thành viên / ${existing ? form.nickname || form.name : "Thêm mới"}`}</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]"><Card className="h-fit p-3"><nav className="space-y-1">{menu.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${tab === value ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-400/15" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}>{label}</button>)}</nav></Card>
      <div>{!detailsLoaded && ["account", "bank", "bankRaw", "notes"].includes(tab) ? (
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
    if (!confirm(`Xóa công việc ${job.title}?`)) return;
    const response = await fetch(`/api/member-jobs?id=${encodeURIComponent(job.id)}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) return alert(result?.error || "Không thể xóa công việc.");
    setJobs(current => current.filter(item => item.id !== job.id));
    if (viewing?.id === job.id) setViewing(null);
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
type FinanceProps = ListProps & { user: AuthUser };
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
  const [data, setData] = useState<{ year: number; income: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [showComparison, setShowComparison] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/finance-overview', { cache: "no-store" });
    const result = await readJsonSafe<{ data?: { year: number; income: number; expense: number }[] }>(response);
    if (response.ok && result?.data) setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const year = Number(yearStr);
  const currentYearData = data.find(d => d.year === year) || { year, income: 0, expense: 0 };
  const prevYearData = data.find(d => d.year === year - 1);
  const diff = currentYearData.income - currentYearData.expense;
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
  const prevDiff = prevYearData ? prevYearData.income - prevYearData.expense : undefined;

  function renderCompare(current: number, prev: number | undefined) {
    if (!showComparison) return null;
    if (prev === undefined) return <p className="mt-1 text-[10px] text-slate-400">Chưa có dữ liệu so sánh</p>;
    const d = current - prev;
    if (d === 0) return <p className="mt-1 text-[10px] text-slate-400">Không đổi so với năm trước</p>;
    const percent = prev === 0 ? "100%" : (Math.abs(d) / Math.abs(prev) * 100).toFixed(1) + "%";
    return <p className={`mt-1 text-[10px] font-bold ${d > 0 ? "text-emerald-500" : "text-rose-500"}`}>{d > 0 ? "↑" : "↓"} {money(Math.abs(d))} ({percent})</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <select className={filterClass} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
        <button onClick={() => setShowComparison(!showComparison)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">{showComparison ? "Ẩn so sánh" : "Hiện so sánh"}</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><p className="text-xs text-slate-400">Tổng thu năm</p><b className="text-emerald-500">{money(currentYearData.income)}</b>{renderCompare(currentYearData.income, prevYearData?.income)}</Card>
        <Card><p className="text-xs text-slate-400">Tổng chi năm</p><b className="text-rose-500">{money(currentYearData.expense)}</b>{renderCompare(currentYearData.expense, prevYearData?.expense)}</Card>
        <Card><p className="text-xs text-slate-400">Chênh lệch</p><b className={diff >= 0 ? "text-indigo-500" : "text-rose-500"}>{money(diff)}</b>{renderCompare(diff, prevDiff)}</Card>
        <Card><p className="text-xs text-slate-400">Trung bình/tháng</p><b className="text-emerald-500">{money(currentYearData.income / 12)}</b>{renderCompare(currentYearData.income / 12, prevYearData ? prevYearData.income / 12 : undefined)}</Card>
        <Card><p className="text-xs text-slate-400">Trung bình/tháng</p><b className="text-rose-500">{money(currentYearData.expense / 12)}</b>{renderCompare(currentYearData.expense / 12, prevYearData ? prevYearData.expense / 12 : undefined)}</Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <b>So sánh Thu và Chi theo năm</b>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>
        <div className="flex h-64 w-full items-end justify-between gap-2 overflow-x-auto pb-2 md:justify-center md:gap-6">
          {data.slice().sort((a,b) => a.year - b.year).map(item => (
            <div key={item.year} className="flex min-w-[60px] max-w-[120px] flex-1 flex-col items-center gap-2">
              <div className="flex h-[240px] w-full items-end justify-center gap-1">
                <div className="w-1/2 rounded-t-md bg-emerald-500" style={{ height: `${Math.max(2, (item.income / maxVal) * 100)}%` }} title={`Thu: ${money(item.income)}`} />
                <div className="w-1/2 rounded-t-md bg-rose-500" style={{ height: `${Math.max(2, (item.expense / maxVal) * 100)}%` }} title={`Chi: ${money(item.expense)}`} />
              </div>
              <span className="text-xs font-bold text-slate-400">{item.year}</span>
            </div>
          ))}
          {!data.length && !loading && <div className="w-full text-center text-sm text-slate-400">Chưa có dữ liệu.</div>}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-emerald-500"/> Thu nhập</div>
          <div className="flex items-center gap-2"><div className="size-3 rounded-full bg-rose-500"/> Chi tiêu</div>
        </div>
      </Card>
    </div>
  );
}

function Finance({ data, open, t, user }: FinanceProps) {
  const [tab, setTab] = useState<"overview" | "income" | "expense">("overview");
  return (
    <>
      <div className="mb-4 inline-flex flex-wrap gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1 text-sm font-bold">
        <button onClick={() => setTab("overview")} className={`rounded-lg px-4 py-2 ${tab === "overview" ? "bg-indigo-500 text-white" : "text-slate-500"}`}>Tổng quan</button>
        <button onClick={() => setTab("income")} className={`rounded-lg px-4 py-2 ${tab === "income" ? "bg-emerald-500 text-white" : "text-slate-500"}`}>Thu nhập</button>
        <button onClick={() => setTab("expense")} className={`rounded-lg px-4 py-2 ${tab === "expense" ? "bg-rose-500 text-white" : "text-slate-500"}`}>Chi tiêu</button>
      </div>
      {tab === "overview" && <FinanceOverview />}
      {tab === "income" && <IncomeSheetManagement user={user} />}
      {tab === "expense" && <ExpensePreview data={data} open={open} t={t} />}
    </>
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
const incomeCategories: IncomeCategory[] = ["Lương", "Thưởng", "Khác"];
const incomeTemplates = ["Lương CB", "Lương KQCV", "Thưởng", "Tiền tồn tháng trước", "Khác"];
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
  const [categoryFilter, setCategoryFilter] = useState<IncomeCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [incomeData, setIncomeData] = useState<IncomeApiData | null>(null);
  const [view, setView] = useState<"list" | "new" | "edit" | "yearly-new" | "yearly-edit">("list");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [showComparison, setShowComparison] = useState(true);
  const [editing, setEditing] = useState<IncomeRecord | null>(null);
  const [editingYearly, setEditingYearly] = useState<IncomeYearlySummaryRow | null>(null);
  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [activeIncomeMenuId, setActiveIncomeMenuId] = useState<string | null>(null);
  const [expandedIncomeIds, setExpandedIncomeIds] = useState<Set<string>>(() => new Set());
  
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIncomeData(await fetchIncomeApiData(year));
    } finally {
      setLoading(false);
    }
  }, [year]);
  
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  function toggleIncomeDetail(id: string) {
    setExpandedIncomeIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  
  const allRecords = incomeData?.allRecords || [];
  console.log("[income] rows after map", allRecords);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const records = allRecords.filter(record => (monthFilter === "all" || record.month === Number(monthFilter)) && (categoryFilter === "all" || record.category === categoryFilter) && (!normalizedQuery || `${record.name} ${record.note} ${record.memberName || ""}`.toLocaleLowerCase().includes(normalizedQuery)));
  console.log("[income] rows after filter", records);
  records.sort((a, b) => {
    const dateA = new Date(a.incomeDate).getTime();
    const dateB = new Date(b.incomeDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
  
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const monthRecords = allRecords.filter(record => record.month === index + 1 && isReceivedIncome(record));
    const total = monthRecords.reduce((sum, record) => sum + record.amount, 0);
    const details = monthRecords.reduce((acc, record) => {
      acc[record.name] = (acc[record.name] || 0) + record.amount;
      return acc;
    }, {} as Record<string, number>);
    return { month: index + 1, monthName: `Tháng ${index + 1}`, total, details };
  });
  const visibleMonthTotal = allRecords.filter(record => (monthFilter === "all" || record.month === Number(monthFilter)) && isReceivedIncome(record)).reduce((sum, record) => sum + record.amount, 0);
  
  // Tổng năm = tổng records + tổng yearlySummaries
  const currentYearSummaries = (incomeData?.yearlySummaries || []).filter(s => String(s.year) === year);
  const yearlySummariesTotal = currentYearSummaries.reduce((sum, s) => sum + s.amount, 0);
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0) + yearlySummariesTotal;
  
  // Category totals bao gồm cả yearlySummaries
  const categoryTotals = incomeCategories.map(category => {
    const recordTotal = allRecords.filter(record => record.category === category && isReceivedIncome(record)).reduce((sum, record) => sum + record.amount, 0);
    const summaryTotal = currentYearSummaries.filter(s => s.category === category).reduce((sum, s) => sum + s.amount, 0);
    return { category, total: recordTotal + summaryTotal };
  });
  const selectedCategoryTotal = categoryFilter === "all" ? allRecords.filter(isReceivedIncome).reduce((sum, record) => sum + record.amount, 0) + yearlySummariesTotal : categoryTotals.find(item => item.category === categoryFilter)?.total || 0;
  
  const renderedMonths = Array.from(new Set(records.map(record => record.month))).sort((left, right) => left - right);
  
  const yearlyChartData = incomeData?.yearlyComparison || [];
  const processedYearlyChartData = yearlyChartData.slice().sort((a,b) => a.year - b.year).map((item, index, array) => {
    const prevTotal = array[index - 1]?.total;
    let diff = undefined;
    let percent = undefined;
    if (prevTotal !== undefined) {
      diff = item.total - prevTotal;
      percent = prevTotal === 0 ? "100%" : (Math.abs(diff) / prevTotal * 100).toFixed(1) + "%";
    }
    return { ...item, diff, percent, prevTotal };
  });
  const prevYearTotal = processedYearlyChartData.find(d => d.year === Number(year))?.prevTotal;

  function renderCompare(current: number, prev: number | undefined) {
    if (!showComparison) return null;
    if (prev === undefined) return <p className="mt-1 text-[10px] text-slate-400">Chưa có dữ liệu so sánh</p>;
    const d = current - prev;
    if (d === 0) return <p className="mt-1 text-[10px] text-slate-400">Không đổi so với năm trước</p>;
    const percent = prev === 0 ? "100%" : (Math.abs(d) / Math.abs(prev) * 100).toFixed(1) + "%";
    return <p className={`mt-1 text-[10px] font-bold ${d > 0 ? "text-emerald-500" : "text-rose-500"}`}>{d > 0 ? "↑" : "↓"} {money(Math.abs(d))} ({percent})</p>;
  }
  
  async function remove(record: IncomeRecord) {
    if (!confirm(`Xóa dòng thu "${record.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (!response.ok) alert("Không thể xóa dòng thu nhập.");
    setActiveIncomeMenuId(null);
    void load();
  }
  
  async function removeYearly(summary: IncomeYearlySummaryRow) {
    if (!confirm(`Xóa dòng thu nhập tổng năm "${summary.name}"?`)) return;
    const response = await fetch(`/api/incomes-yearly?id=${encodeURIComponent(summary.id)}`, { method: "DELETE" });
    if (!response.ok) alert("Không thể xóa dòng thu nhập tổng năm.");
    setActiveIncomeMenuId(null);
    void load();
  }
  
  function edit(record: IncomeRecord) {
    setEditing(record);
    setView("edit");
    setActiveIncomeMenuId(null);
  }
  
  function editYearly(summary: IncomeYearlySummaryRow) {
    setEditingYearly(summary);
    setView("yearly-edit");
    setActiveIncomeMenuId(null);
  }
  
  function exportExcel() {
    if (!XLSX) { alert("Không tải được thư viện Excel."); return; }
    
    // Sheet 1: Thu nhập chi tiết
    const detailedData = [["Ngày nhận", "Tháng", "Năm", "Loại khoản thu", "Nội dung", "Số tiền", "Ghi chú"]];
    renderedMonths.forEach(month => {
      const items = records.filter(record => record.month === month);
      items.forEach(record => {
        detailedData.push([formatDateVN(record.incomeDate), String(record.month), String(record.year), record.category, record.name, String(record.amount), record.note]);
      });
      const subtotal = items.filter(record => isReceivedIncome(record)).reduce((sum, record) => sum + record.amount, 0);
      detailedData.push([`Tổng tháng ${month}`, "", "", "", "", String(subtotal), ""]);
    });
    
    // Sheet 2: Tổng năm cũ
    const summaryData = [["Năm", "Loại khoản thu", "Nội dung", "Số tiền", "Ghi chú"]];
    (incomeData?.yearlySummaries || []).forEach(s => {
      summaryData.push([String(s.year), s.category, s.name, String(s.amount), s.note]);
    });
    
    // Sheet 3: Thống kê
    const statsData = [["Thống kê", "Giá trị"]];
    statsData.push(["Tổng thu nhập năm " + year, String(totalYear)]);
    categoryTotals.forEach(item => {
      statsData.push([`Tổng ${item.category}`, String(item.total)]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(detailedData);
    const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws3 = XLSX.utils.aoa_to_sheet(statsData);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Thu nhập chi tiết");
    XLSX.utils.book_append_sheet(wb, ws2, "Tổng năm cũ");
    XLSX.utils.book_append_sheet(wb, ws3, "Thống kê năm");
    
    XLSX.writeFile(wb, `thu-nhap-${year}.xlsx`);
  }
  
  if (view === "new" || view === "edit") return <IncomeRecordForm record={editing} members={incomeData?.members || []} templates={incomeData?.sourceTemplates || incomeTemplates} user={user} back={() => { setView("list"); setEditing(null); }} saved={() => { setView("list"); setEditing(null); void load(); }} />;
  if (view === "yearly-new" || view === "yearly-edit") return <YearlyIncomeForm record={editingYearly} back={() => { setView("list"); setEditingYearly(null); }} saved={() => { setView("list"); setEditingYearly(null); void load(); }} />;
  
  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-[90px_100px_120px_1fr_auto_auto_auto_auto]">
      <select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select>
      <select className={filterClass} value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">Tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
      <select className={filterClass} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as IncomeCategory | "all")}><option value="all">Khoản thu</option>{incomeCategories.map(category => <option key={category} value={category}>{category}</option>)}</select>
      <input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm khoản thu..." />
      <button onClick={() => setShowComparison(!showComparison)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">{showComparison ? "Ẩn so sánh" : "Hiện so sánh"}</button>
      <button onClick={() => { setEditing(null); setView("new"); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Thêm thu nhập</button>
      <button onClick={() => { setEditingYearly(null); setView("yearly-new"); }} className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white">Nhập tổng năm cũ</button>
      <button onClick={exportExcel} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-600">Xuất Excel</button>
    </div>
    
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card><p className="text-xs text-slate-400">Tổng thu nhập năm</p><b className="text-emerald-500">{money(totalYear)}</b>{renderCompare(totalYear, prevYearTotal)}</Card>
      <Card><p className="text-xs text-slate-400">Tổng thu tháng</p><b>{money(visibleMonthTotal)}</b>{renderCompare(visibleMonthTotal, undefined)}</Card>
      <Card><p className="text-xs text-slate-400">Thu theo loại</p><b>{money(selectedCategoryTotal)}</b>{renderCompare(selectedCategoryTotal, undefined)}</Card>
      <Card><p className="text-xs text-slate-400">Trung bình/tháng</p><b>{money(totalYear / 12)}</b>{renderCompare(totalYear / 12, prevYearTotal ? prevYearTotal / 12 : undefined)}</Card>
    </div>

    <div className="flex gap-2 border-b border-[var(--app-border)] pb-2">
      <button onClick={() => setViewMode("list")} className={`px-4 py-2 text-sm font-bold rounded-lg ${viewMode === "list" ? "bg-slate-200 dark:bg-white/10" : "text-slate-400"}`}>Danh sách</button>
      <button onClick={() => setViewMode("chart")} className={`px-4 py-2 text-sm font-bold rounded-lg ${viewMode === "chart" ? "bg-slate-200 dark:bg-white/10" : "text-slate-400"}`}>Biểu đồ</button>
    </div>
    
    {viewMode === "chart" && (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center justify-between"><b>Tổng thu theo 12 tháng</b>{loading && <span className="text-xs text-slate-400">Đang tải...</span>}</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTotals} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} dy={10} />
              <YAxis hide />
              <RechartsTooltip content={<MonthlyTooltip />} cursor={{ fill: "transparent" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {monthlyTotals.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#10b981" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <div className="mb-4 flex items-center justify-between"><b>So sánh thu nhập theo năm</b></div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedYearlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} dy={10} />
              <YAxis hide />
              <RechartsTooltip content={<YearlyTooltip />} cursor={{ fill: "transparent" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={120}>
                {processedYearlyChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="#6366f1" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
    )}
    
    {viewMode === "list" && (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-4 border-b border-[var(--app-border)] px-4 pt-4">
        <button onClick={() => setActiveTab("monthly")} className={`border-b-2 px-2 pb-3 text-sm font-bold ${activeTab === "monthly" ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-400"}`}>Chi tiết tháng</button>
        <button onClick={() => setActiveTab("yearly")} className={`border-b-2 px-2 pb-3 text-sm font-bold ${activeTab === "yearly" ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-400"}`}>Tổng năm cũ</button>
      </div>
      
      {activeTab === "monthly" && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5">
              <tr><th className="w-10 px-4 py-3"></th><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Tháng</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Công việc</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3 text-right">Hành động</th></tr>
            </thead>
            <tbody>
              {records.map(record => {
                const expanded = expandedIncomeIds.has(record.id);
                return <Fragment key={record.id}>
                  <tr className="border-t border-[var(--app-border)] bg-white dark:bg-[var(--app-card)]">
                    <td className="px-4 py-3"><button type="button" onClick={() => toggleIncomeDetail(record.id)} aria-label={expanded ? "Thu gon chi tiet" : "Xem chi tiet"} className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">{expanded ? "^" : "v"}</button></td>
                    <td className="px-4 py-3">{formatDateVN(record.incomeDate || record.receivedDate)}</td>
                    <td className="px-4 py-3">{record.month}</td>
                    <td className="px-4 py-3">{record.category}</td>
                    <td className="px-4 py-3">{incomeJobShortLabel(record)}</td>
                    <td className="px-4 py-3 leading-tight">{record.jobId ? record.jobName : <>Thu khác<br /><span className="text-xs font-normal text-slate-500">{record.name}</span></>}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-500">{money(record.amount)}</td>
                    <td className="px-4 py-3 text-right"><IncomeRecordInlineActions edit={() => edit(record)} remove={() => remove(record)} /></td>
                  </tr>
                  {expanded && <tr className="border-t border-[var(--app-border)] bg-slate-50/70 dark:bg-white/5">
                    <td className="px-4 py-4" colSpan={8}>
                      <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-2 lg:grid-cols-4">
                        <div><p className="text-xs font-bold uppercase text-slate-400">Ngày nhận đầy đủ</p><p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{formatDateVN(record.incomeDate || record.receivedDate)}</p></div>
                        <div><p className="text-xs font-bold uppercase text-slate-400">Công việc đầy đủ</p><p className="mt-1 whitespace-pre-line font-semibold text-slate-700 dark:text-slate-200">{incomeJobFullLabel(record)}</p></div>
                        <div><p className="text-xs font-bold uppercase text-slate-400">Nơi làm</p><p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{incomeJobCompany(record) || "Không có"}</p></div>
                        <div><p className="text-xs font-bold uppercase text-slate-400">Ghi chú</p><p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{record.note || "Không có"}</p></div>
                        {process.env.NODE_ENV === "development" && <div className="lg:col-span-4"><p className="text-xs font-bold uppercase text-slate-400">ID</p><p className="mt-1 font-mono text-xs text-slate-500">{record.id}</p></div>}
                      </div>
                    </td>
                  </tr>}
                </Fragment>;
              })}
            </tbody>
          </table>
          {!records.length && <div className="p-6 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu thu nhập.</div>}
        </div>
      )}
      
      {activeTab === "yearly" && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-3">Năm</th><th className="px-4 py-3">Loại khoản thu</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3 text-right">Hành động</th></tr>
            </thead>
            <tbody>
              {(incomeData?.yearlySummaries || []).map(summary => (
                <tr key={summary.id} className="border-t border-[var(--app-border)]">
                  <td className="px-4 py-3">{summary.year}</td>
                  <td className="px-4 py-3">{summary.category}</td>
                  <td className="px-4 py-3">{summary.name}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-500">{money(summary.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{summary.note}</td>
                  <td className="px-4 py-3 text-right">
                    <IncomeRecordActionMenu record={{ id: summary.id } as unknown as IncomeRecord} activeId={activeIncomeMenuId} setActiveId={setActiveIncomeMenuId} edit={() => editYearly(summary)} remove={() => removeYearly(summary)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(incomeData?.yearlySummaries || []).length && <div className="p-6 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu tổng năm.</div>}
        </div>
      )}
      
      {/* Mobile view logic */}
      <div className="space-y-3 p-3 md:hidden">
        {activeTab === "monthly" && records.map(record => {
          const expanded = expandedIncomeIds.has(record.id);
          return <div key={record.id} className="rounded-lg border border-[var(--app-border)] p-3">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => toggleIncomeDetail(record.id)} className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">{expanded ? "^" : "v"}</button>
              <div className="min-w-0 flex-1"><b>{record.name}</b><p className="text-xs text-slate-400">{formatDateVN(record.incomeDate || record.receivedDate)} / {record.category} / {incomeJobShortLabel(record)}</p></div>
              <b className="shrink-0 text-emerald-500">{money(record.amount)}</b>
            </div>
            {expanded && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-white/5">
              <p><b>Ngày nhận:</b> {formatDateVN(record.incomeDate || record.receivedDate)}</p>
              <p className="mt-1 whitespace-pre-line"><b>Công việc:</b> {incomeJobFullLabel(record)}</p>
              <p className="mt-1"><b>Nơi làm:</b> {incomeJobCompany(record) || "Không có"}</p>
              <p className="mt-1"><b>Ghi chú:</b> {record.note || "Không có"}</p>
              {process.env.NODE_ENV === "development" && <p className="mt-1 font-mono text-xs"><b>ID:</b> {record.id}</p>}
            </div>}
            <div className="mt-3 flex justify-end"><IncomeRecordInlineActions edit={() => edit(record)} remove={() => remove(record)} /></div>
          </div>;
        })}
        {activeTab === "yearly" && (incomeData?.yearlySummaries || []).map(summary => <div key={summary.id} className="rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div><b>{summary.name}</b><p className="text-xs text-slate-400">Năm {summary.year} · {summary.category}</p></div><div className="flex items-start gap-2"><b className="text-indigo-500">{money(summary.amount)}</b><IncomeRecordActionMenu record={{ id: summary.id } as unknown as IncomeRecord} activeId={activeIncomeMenuId} setActiveId={setActiveIncomeMenuId} edit={() => editYearly(summary)} remove={() => removeYearly(summary)} /></div></div><p className="mt-1 text-xs text-slate-400">{summary.note}</p></div>)}
        {(activeTab === "monthly" && !records.length || activeTab === "yearly" && !(incomeData?.yearlySummaries || []).length) && <div className="p-6 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu.</div>}
      </div>
    </Card>
    )}
  </div>;
}

function YearlyIncomeForm({ record, back, saved }: { record: IncomeYearlySummaryRow | null; back: () => void; saved: () => void }) {
  const currentYear = new Date().getFullYear();
  type YearlyDraft = { id?: string; year: number; category: IncomeCategory; name: string; amount: string; note: string };
  const emptyRow = (): YearlyDraft => ({ year: currentYear - 1, category: "Lương", name: "Tổng lương năm", amount: "", note: "" });
  const [draft, setDraft] = useState<YearlyDraft>(() => record ? { id: record.id, year: record.year, category: record.category, name: record.name, amount: String(record.amount), note: record.note } : emptyRow());
  
  function patch(value: Partial<YearlyDraft>) { setDraft(current => ({ ...current, ...value })); }
  
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rawAmount = String(draft.amount).replace(/\D/g, "");
    if (!rawAmount) { alert("Vui lòng nhập số tiền hợp lệ."); return; }
    const payload = { ...draft, amount: Number(rawAmount) };
    const response = await fetch(record ? `/api/incomes-yearly?id=${encodeURIComponent(record.id)}` : "/api/incomes-yearly", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? payload : { rows: [payload] }) });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) { alert(result?.error || "Kh?ng th? l?u thu nh?p."); return; }
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
    else alert(result?.error || "Không thể tải dữ liệu thu nhập.");
    setLoading(false);
  }, [year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const records = (incomeData?.allRecords || []).filter(record => (monthFilter === "all" || record.month === Number(monthFilter)) && (memberFilter === "all" || record.memberId === memberFilter));
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: (incomeData?.allRecords || []).filter(record => record.month === index + 1 && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0) }));
  const categoryTotals = incomeCategories.map(category => ({ category, total: records.filter(record => record.category === category && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0) }));
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));
  async function remove(record: IncomeRecord) {
    if (!confirm(`Xóa dòng thu "${record.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (!response.ok) alert("Không thể xóa dòng thu nhập.");
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
  return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-[120px_140px_1fr_auto_auto]"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select><select className={filterClass} value={monthFilter} onChange={event => setMonthFilter(event.target.value)}><option value="all">Tất cả tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select><select className={filterClass} value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tất cả thành viên</option>{incomeData?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button onClick={() => { setEditing(null); setView("new"); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Thêm thu nhập</button><button onClick={exportExcel} className="rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-600">Xuất Excel</button></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Tổng cả năm</p><b className="text-emerald-500">{money(totalYear)}</b></Card>{categoryTotals.slice(0, 3).map(item => <Card key={item.category}><p className="text-xs text-slate-400">{item.category}</p><b>{money(item.total)}</b></Card>)}</div><Card><div className="mb-4 flex items-center justify-between"><b>Tổng thu theo 12 tháng</b>{loading && <span className="text-xs text-slate-400">Đang tải...</span>}</div><div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">{monthlyTotals.map(item => <div key={item.month} className="flex min-w-12 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5"><div className="w-full rounded-md bg-emerald-500" style={{ height: `${Math.max(4, item.total / maxMonth * 100)}%` }} /></div><span className="text-xs font-bold text-slate-400">{`Tháng ${item.month}`}</span></div>)}</div></Card><Card className="overflow-hidden p-0"><div className="border-b border-[var(--app-border)] p-4"><b>Bảng thu nhập theo tháng</b></div><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5"><tr><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Tháng</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Nhóm thu</th><th className="px-4 py-3">Tên khoản thu</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3 text-right">Hành động</th></tr></thead><tbody>{Array.from({ length: 12 }, (_, index) => index + 1).filter(month => monthFilter === "all" || month === Number(monthFilter)).map(month => { const items = records.filter(record => record.month === month); const subtotal = items.filter(record => record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0); return <><tr key={`m-${month}`} className="bg-emerald-50/70 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10"><td className="px-4 py-2" colSpan={5}>Tháng {month}</td><td className="px-4 py-2 text-right">{money(subtotal)}</td><td className="px-4 py-2" colSpan={3}>Tổng tháng</td></tr>{items.map(record => <tr key={record.id} className="border-t border-[var(--app-border)]"><td className="px-4 py-3">{formatDateVN(record.incomeDate)}</td><td className="px-4 py-3">{record.month}</td><td className="px-4 py-3">{record.memberName}</td><td className="px-4 py-3">{record.category}</td><td className="px-4 py-3 leading-tight">{record.jobId ? record.jobName : <>Thu khác<br /><span className="text-xs font-normal text-slate-500">{record.name}</span></>}</td><td className="px-4 py-3 text-right font-bold text-emerald-500">{money(record.amount)}</td><td className="px-4 py-3">{record.status}</td><td className="px-4 py-3 text-slate-500">{record.note}</td><td className="px-4 py-3 text-right"><button onClick={() => { setEditing(record); setView("edit"); }} className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-600">Sửa</button><button onClick={() => void remove(record)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500">Xóa</button></td></tr>)}</>; })}</tbody></table></div><div className="space-y-3 p-3 md:hidden">{records.map(record => <div key={record.id} className="rounded-lg border border-[var(--app-border)] p-3"><div className="flex items-start justify-between gap-3"><div><b>{record.jobId ? record.jobName : "Thu khác"}</b>{record.jobId ? null : <p className="text-sm font-semibold text-slate-600">{record.name}</p>}<p className="mt-0.5 text-xs text-slate-400">{formatDateVN(record.incomeDate)} · {record.memberName} · {record.category}</p></div><b className="text-emerald-500">{money(record.amount)}</b></div><p className="mt-1 text-xs text-slate-400">{record.status} · {record.note}</p><div className="mt-2 flex gap-2"><button onClick={() => { setEditing(record); setView("edit"); }} className="text-xs font-bold text-emerald-600">Sửa</button><button onClick={() => void remove(record)} className="text-xs font-bold text-rose-500">Xóa</button></div></div>)}</div></Card></div>;
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
function IncomeRecordForm({ record, members: initialMembers, templates, user, back, saved, fixedJobId, fixedMemberId }: { record: IncomeRecord | null; members: { id: string; name: string }[]; templates: string[]; user?: AuthUser; back: () => void; saved: () => void; fixedJobId?: string; fixedMemberId?: string }) {
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

  function patch(value: Partial<IncomeDraft>) { setDraft(current => ({ ...current, ...value })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rawAmount = String(draft.amount).replace(/\D/g, "");
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Vui lòng nhập số tiền hợp lệ."); return; }
    const contentText = draft.name.trim();
    if (!contentText) { alert("Vui lòng nhập nội dung khoản thu."); return; }
    if (!effectiveMemberId) { alert("Chưa xác định thành viên nhận thu nhập."); return; }
    
    // Nếu dùng từ màn hình JobDetail thì giữ nguyên fixedJobId, ngược lại set null
    const payloadJobId = fixedJobId ? fixedJobId : null;
    const payload = { memberId: effectiveMemberId, jobId: payloadJobId, category: draft.category, name: contentText, content: contentText, amount, receivedDate: draft.incomeDate, note: draft.note.trim() || null };
    
    const response = await fetch(record ? `/api/incomes?id=${encodeURIComponent(record.id)}` : "/api/incomes", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? payload : { rows: [payload] }) });
    const result = await readJsonSafe<{ error?: string; details?: string }>(response);
    if (!response.ok) {
      alert((result?.error || "Không thể lưu thu nhập.") + (result?.details ? `\nLỗi: ${result.details}` : ""));
      return;
    }
    alert("Đã lưu thu nhập");
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
  <Field label="Ngày nhận"><DateVNInput required value={draft.incomeDate} onChange={value => patch({ incomeDate: value })} /></Field><Field label="Loại khoản thu"><select className={inputClass} value={draft.category} onChange={event => patch({ category: event.target.value as IncomeCategory })}>{incomeCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></Field><Field label="Nội dung khoản thu"><input required className={inputClass} value={draft.name} onChange={event => patch({ name: event.target.value })} placeholder={fixedJobId ? "VD: Lương CB..." : "VD: Bán đồ, được thưởng..."} /></Field><Field label="Số tiền"><input required type="text" inputMode="numeric" pattern="[0-9]*" className={inputClass} value={draft.amount} onChange={e => patch({ amount: e.target.value.replace(/\D/g, "") })} placeholder="VD: 2280000" />{amountPreview && <p className="mt-1 text-xs text-slate-400">? {amountPreview}</p>}</Field><div className="md:col-span-2"><Field label="Ghi chú"><input className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} /></Field></div></div></Card><datalist id="income-template-list">{Array.from(new Set([...incomeTemplates, ...templates])).map(name => <option key={name} value={name} />)}</datalist><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}
function IncomeManagement() {
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
    else alert(result?.error || "Không thể tải dữ liệu thu nhập.");
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
    if (!confirm(`Xóa nguồn thu "${source.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(source.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await readJsonSafe<{ error?: string }>(response);
      alert(result?.error || "Không thể xóa nguồn thu.");
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
    if (!response.ok) { alert(result?.error || "Không thể lưu nguồn thu."); return; }
    saved();
  }
  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại danh sách thu nhập</button><div><h2 className="text-2xl font-bold">{existing ? "Sửa nguồn thu" : "Thêm nguồn thu"}</h2><p className="mt-1 text-sm text-slate-400">Nhập nhanh và giữ liên kết với thành viên.</p></div><form onSubmit={submit} className="space-y-5"><Card><div className="grid gap-4 md:grid-cols-2"><Field label="Thành viên"><select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Tên nguồn thu"><input required className={inputClass} value={form.name} onChange={event => set("name", event.target.value)} /></Field><Field label="Loại"><select className={inputClass} value={form.type} onChange={event => set("type", event.target.value as IncomeSourceType)}><option value="fixed">Cố định</option><option value="variable">Không có định</option></select></Field><Field label="Số tiền"><input required min="0" type="number" className={inputClass} value={form.amount} onChange={event => set("amount", event.target.value)} /></Field><Field label="Tần suất"><select className={inputClass} value={form.frequency} onChange={event => set("frequency", event.target.value as IncomeFrequency)}>{Object.entries(frequencyLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Ngày nhận / ngày bắt đầu"><DateVNInput required value={form.receivedDate} onChange={value => set("receivedDate", value)} /></Field><div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={4} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /> Đang dùng</label>{!existing && form.type === "variable" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.createRecord} onChange={event => set("createRecord", event.target.checked)} /> Ghi nhận khoản thu này ngay</label>}</div></Card><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}
function IncomeSourceFullPageDetail({ source, back, edit, remove }: { source: IncomeSource; back: () => void; edit: () => void; remove: () => void }) {
  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại danh sách thu nhập</button><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">{source.name}</h2><p className="mt-1 text-sm text-slate-400">{source.memberName} · {incomeTypeLabel[source.type]} · {source.active ? "Đang dùng" : "Đã tắt"}</p></div><div className="flex gap-2"><button onClick={edit} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white">Sửa</button><button onClick={remove} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-500">Xóa</button></div></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Card><p className="text-xs text-slate-400">Số tiền</p><b className="text-emerald-500">{money(source.amount)}</b></Card><Card><p className="text-xs text-slate-400">Tần suất</p><b>{frequencyLabel[source.frequency]}</b></Card><Card><p className="text-xs text-slate-400">Ngày nhận</p><b>{source.receivedDate || source.startDate || "Chưa cập nhật"}</b></Card><Card><p className="text-xs text-slate-400">Trạng thái</p><b>{source.active ? "Đang dùng" : "Đã tắt"}</b></Card></div><Card><b>Ghi chú</b><p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{source.note || "Không có ghi chú."}</p></Card></div>;
}
function OldIncomeManagement() {
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
    else alert(result?.error || "Không thể tải dữ liệu thu nhập.");
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
    if (!confirm(`Xóa nguồn thu "${source.name}"?`)) return;
    const response = await fetch(`/api/incomes?id=${encodeURIComponent(source.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await readJsonSafe<{ error?: string }>(response);
      alert(result?.error || "Không thể xóa nguồn thu.");
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, amount: Number(form.amount), startDate: form.receivedDate };
    const url = existing ? `/api/incomes?id=${encodeURIComponent(existing.id)}` : "/api/incomes";
    const response = await fetch(url, { method: existing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) { alert(result?.error || "Không thể lưu nguồn thu."); return; }
    saved();
  }
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 md:items-center md:p-6" onMouseDown={close}><form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--app-card)] p-5 shadow-2xl md:max-w-lg md:rounded-3xl"><div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300 md:hidden" /><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{existing ? "Sửa" : "Thêm"} nguồn thu</h2><button type="button" onClick={close} className="rounded-full px-3 py-1 text-xl text-slate-400">×</button></div><div className="space-y-4"><Field label="Thành viên"><select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field><Field label="Tên nguồn thu"><input required className={inputClass} value={form.name} onChange={event => set("name", event.target.value)} /></Field><Field label="Loại"><select className={inputClass} value={form.type} onChange={event => set("type", event.target.value as IncomeSourceType)}><option value="fixed">Cố định</option><option value="variable">Không cố định</option></select></Field><Field label="Số tiền"><input required min="0" type="number" className={inputClass} value={form.amount} onChange={event => set("amount", event.target.value)} /></Field><Field label="Tần suất"><select className={inputClass} value={form.frequency} onChange={event => set("frequency", event.target.value as IncomeFrequency)}>{Object.entries(frequencyLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Ngày nhận / ngày bắt đầu"><DateVNInput required value={form.receivedDate} onChange={value => set("receivedDate", value)} /></Field><Field label="Ghi chú"><textarea rows={3} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} /> Đang dùng</label>{!existing && form.type === "variable" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.createRecord} onChange={event => set("createRecord", event.target.checked)} /> Ghi nhận khoản thu này ngay</label>}</div><div className="mt-6 flex gap-3"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Hủy</button><button className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}
void IncomeManagement;
void LegacyIncomeSheetManagement;
void OldIncomeManagement;
void LegacyExpensePreview;
function ExpensePreview({ data, open, t }: ListProps) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const expenseItems = data.transactions.filter(item => item.type === "expense");
  const categories = [...new Set(expenseItems.map(item => item.category || "Khác"))].sort();
  const transactions = expenseItems.filter(item => {
    const parsed = parseDate(item.date);
    const itemYear = parsed ? String(parsed.getFullYear()) : "";
    const itemMonth = parsed ? String(parsed.getMonth() + 1) : "";
    const text = `${item.title} ${item.category}`.toLocaleLowerCase();
    return (!itemYear || itemYear === year) && (month === "all" || itemMonth === month) && (category === "all" || item.category === category) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase()));
  });
  const totalExpense = transactions.reduce((sum, item) => sum + item.amount, 0);

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const total = expenseItems.filter(item => {
      const parsed = parseDate(item.date);
      return parsed && String(parsed.getFullYear()) === year && parsed.getMonth() === index;
    }).reduce((sum, item) => sum + item.amount, 0);
    return { month: index + 1, total };
  });
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));

  return <div className="space-y-5">
    <div className="mb-4 grid gap-3 md:grid-cols-[110px_140px_180px_1fr]">
      <select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select>
      <select className={filterClass} value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
      <select className={filterClass} value={category} onChange={event => setCategory(event.target.value)}><option value="all">Khoản chi</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm chi tiêu..." />
    </div>

    <div className="grid grid-cols-2 gap-3 lg:max-w-xl">
      <Card><p className="text-xs text-slate-400">Tổng chi theo lọc</p><b className="text-rose-500">{money(totalExpense)}</b></Card>
      <Card><p className="text-xs text-slate-400">{t("income")}</p><b className="text-emerald-500">{money(data.transactions.filter(x => x.type === "income").reduce((sum, item) => sum + item.amount, 0))}</b></Card>
    </div>

    <div className="flex gap-2 border-b border-[var(--app-border)] pb-2">
      <button onClick={() => setViewMode("list")} className={`px-4 py-2 text-sm font-bold rounded-lg ${viewMode === "list" ? "bg-slate-200 dark:bg-white/10" : "text-slate-400"}`}>Danh sách</button>
      <button onClick={() => setViewMode("chart")} className={`px-4 py-2 text-sm font-bold rounded-lg ${viewMode === "chart" ? "bg-slate-200 dark:bg-white/10" : "text-slate-400"}`}>Biểu đồ</button>
    </div>

    {viewMode === "chart" && (
      <Card>
        <div className="mb-4 flex items-center justify-between"><b>Tổng chi theo 12 tháng</b></div>
        <div className="flex h-64 w-full items-end justify-between gap-1 overflow-x-auto pb-2 md:gap-2">
          {monthlyTotals.map(item => <div key={item.month} className="flex min-w-[30px] max-w-[60px] flex-1 flex-col items-center gap-2">
            <div className="flex h-[240px] w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5">
              <div className="w-full rounded-md bg-rose-500" style={{ height: `${Math.max(4, item.total / maxMonth * 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-400">{`T${item.month}`}</span>
          </div>)}
        </div>
      </Card>
    )}

    {viewMode === "list" && (
      <>
        <div className="grid gap-x-4 lg:grid-cols-2">
          {transactions.map(x => <Card key={x.id} className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <b>{x.title}</b>
              <p className="text-xs text-slate-400">{formatDateVN(x.date)} · {x.category}</p>
            </div>
            <b className="text-rose-500">-{money(x.amount)}</b>
            <EditButton onClick={() => open({ kind: "transactions", item: x })} />
          </Card>)}
        </div>
        {!transactions.length && <div className="p-6 text-center text-sm font-semibold text-slate-400">Chưa có dữ liệu.</div>}
        <AddButton label={t("add")} onClick={() => open({ kind: "transactions" })} />
      </>
    )}
  </div>;
}
function LegacyExpensePreview({ data, open, t }: ListProps) {
  const [month, setMonth] = useState("all");
  const [type, setType] = useState<Transaction["type"] | "all">("all");
  const total = (type: "income" | "expense") => data.transactions.filter(x => x.type === type).reduce((a,x) => a+x.amount, 0);
  const monthKey = (date: string) => { const parsed = parseDate(date); return parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}` : date; };
  const months = [...new Set(data.transactions.map(item => monthKey(item.date)))].sort().reverse();
  const transactions = data.transactions.filter(item => (month === "all" || monthKey(item.date) === month) && (type === "all" || item.type === type));
  return <><div className="grid grid-cols-2 gap-3 lg:max-w-xl"><Card><p className="text-xs text-slate-400">{t("income")}</p><b className="text-emerald-500">{money(total("income"))}</b></Card><Card><p className="text-xs text-slate-400">{t("expense")}</p><b className="text-rose-500">{money(total("expense"))}</b></Card></div><SectionTitle label={t("finance")} /><div className="mb-4 grid grid-cols-2 gap-3 md:max-w-xl"><select className={filterClass} value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tất cả tháng</option>{months.map(value => <option key={value} value={value}>{value}</option>)}</select><select className={filterClass} value={type} onChange={event => setType(event.target.value as Transaction["type"] | "all")}><option value="all">Tất cả loại</option><option value="income">Thu nhập</option><option value="expense">Chi tiêu</option></select></div><div className="grid gap-x-4 lg:grid-cols-2">{transactions.map(x => <Card key={x.id} className="mb-3 flex items-center justify-between gap-2"><div className="min-w-0 flex-1"><b>{x.title}</b><p className="text-xs text-slate-400">{formatDateVN(x.date)}</p></div><b className={x.type === "income" ? "text-emerald-500" : "text-rose-500"}>{x.type === "income" ? "+" : "-"}{money(x.amount)}</b><EditButton onClick={() => open({ kind: "transactions", item: x })} /></Card>)}</div><AddButton label={t("add")} onClick={() => open({ kind: "transactions" })} /></>;
}
const bankNames = ["BIDV", "Vietcombank", "Techcombank", "MB", "VPBank", "ACB", "TPBank", "Sacombank", "VIB", "VietinBank", "Agribank", "MoMo", "ZaloPay", "Khác"];
const bankCardTypes: BankCardType[] = ["Tài khoản nhận lương", "Tài khoản ngân hàng", "ATM nội địa", "Debit", "Credit Visa", "Credit Mastercard", "Credit JCB", "Ví điện tử"];
const bankNetworks = ["NAPAS", "Visa", "Mastercard", "JCB", "Khác"] as const;
const bankStatuses: BankAccountStatus[] = ["Đang dùng", "Tạm khóa", "Đã hủy"];
const waiverTypes = ["Không có", "Theo tổng chi tiêu năm", "Theo tổng chi tiêu tháng", "Theo số giao dịch"] as const;
const benefitCategories = ["Siêu thị", "Y tế", "Giáo dục", "Ăn uống", "Xăng xe", "Mua sắm online", "Thanh toán hóa đơn", "Khác"] as const;
const benefitTypes = ["Hoàn tiền %", "Giảm tiền cố định", "Điểm thưởng"] as const;
const bankRawContentTypes: BankRawNoteContentType[] = ["Ưu đãi", "Phí thường niên", "Điều khoản thẻ", "Sao kê", "Email ngân hàng", "Khác"];
const emptyBenefit = (): BankCardBenefit => ({ id: crypto.randomUUID(), bankAccountId: "", name: "", category: "Khác", benefitType: "Hoàn tiền %", benefitValue: 0, monthlyCap: 0, minTransactionAmount: 0, conditionNote: "", active: true });
const emptyBankForm = (memberId = ""): BankAccount => ({ id: "", memberId, bankName: "BIDV", accountHolder: "", accountNumber: "", cardNumber: "", accountType: "Tài khoản nhận lương", cardType: "Tài khoản nhận lương", cardNetwork: "NAPAS", productName: "", branch: "", statementDay: "", dueDay: "", creditLimit: 0, expiryMonth: "", expiryYear: "", status: "Đang dùng", annualFeeEnabled: false, annualFeeAmount: 0, annualFeeWaiverType: "Không có", annualFeeWaiverTarget: 0, annualFeeCycle: "năm", annualFeeCycleStart: "", annualFeeCurrentSpending: 0, note: "", benefits: [], rewards: [] });
function maskLast(value: string, prefix = "******") { const digits = value.replace(/\s+/g, ""); return digits ? `${prefix}${digits.slice(-4)}` : "Chưa cập nhật"; }
function maskCard(value: string) { const digits = value.replace(/\D/g, ""); return digits ? `**** **** **** ${digits.slice(-4)}` : "Không có số thẻ"; }
function bankProgress(account: BankAccount) { const spent = 0, target = account.annualFeeWaiverTarget || 0, missing = Math.max(0, target - spent); return { spent, target, missing, label: target ? `Đã chi ${money(spent)} / ${money(target)} để miễn phí thường niên` : "Không có điều kiện miễn phí" }; }
function MemberBankAccounts({ member, user }: { member: Member; user: AuthUser }) {
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
    if (!response.ok || !result?.ok) return setError(result?.error || "Không thể tải danh sách ngân hàng.");
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
  };

  async function remove(account: BankAccount) {
    if (!confirm(`Xóa thẻ/tài khoản ${account.bankName}?`)) return false;
    const response = await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
    const result = await readJsonSafe<{ error?: string }>(response);
    if (!response.ok) {
      alert(result?.error || "Không thể xóa thẻ ngân hàng.");
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
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {loading ? <BankCardsSkeleton view={view} /> : filtered.length ? view === "list" ? <BankAccountList accounts={filtered} detail={openDetail} edit={openEdit} remove={remove} canEdit={canEdit} /> : <BankCardGrid accounts={filtered} detail={openDetail} edit={openEdit} remove={remove} canEdit={canEdit} /> : <Card className="p-8 text-center"><p className="font-semibold">Thành viên này chưa có thẻ ngân hàng.</p>{canEdit && <button onClick={openCreate} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm thẻ</button>}</Card>}
    </div>
  );
}
function MemberBankRawNotes({ member, user }: { member: Member; user: AuthUser }) {
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
    if (!response.ok || !result?.data) return alert(result?.error || "Không thể lưu nội dung gốc.");
    setNotes(current => current.some(item => item.id === result.data!.id) ? current.map(item => item.id === result.data!.id ? result.data! : item) : [result.data!, ...current]);
    setEditing(null);
  }
  async function remove(note: BankRawNote) {
    if (!confirm(`Xóa nội dung "${note.title}"?`)) return;
    const response = await fetch(`/api/bank-raw-notes/${note.id}`, { method: "DELETE" });
    if (!response.ok) return alert("Không thể xóa nội dung gốc.");
    setNotes(current => current.filter(item => item.id !== note.id));
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
  return <div className="overflow-visible rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-sm"><div className="hidden grid-cols-[1fr_1.55fr_1fr_1fr_.8fr_48px] gap-4 border-b border-[var(--app-border)] bg-slate-50/70 px-5 py-3 text-xs font-bold uppercase text-slate-400 dark:bg-white/5 xl:grid"><span>Ngân hàng</span><span>Sản phẩm / Số thẻ</span><span>Chủ thẻ</span><span>Loại</span><span>Trạng thái</span><span className="text-center">⋯</span></div>{accounts.map(account => <div key={account.id} className="grid gap-4 border-b border-[var(--app-border)] px-5 py-4 text-sm last:border-0 xl:grid-cols-[1fr_1.55fr_1fr_1fr_.8fr_48px] xl:items-center"><div><b className="text-slate-800 dark:text-slate-100">{account.bankName}</b><p className="mt-1 w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-white/10">{account.cardNetwork}</p></div><div className="min-w-0"><b className="block truncate">{account.productName || "Chưa cập nhật sản phẩm"}</b><p className="mt-2 w-fit rounded-lg bg-slate-100 px-2 py-1 font-mono text-sm font-bold tracking-wider text-slate-700 dark:bg-white/10 dark:text-slate-100">{account.cardNumber ? maskCard(account.cardNumber) : maskLast(account.accountNumber)}</p></div><span className="font-semibold text-slate-600 dark:text-slate-200">{account.accountHolder}</span><span className="text-slate-500">{account.cardType}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${account.status === "Đang dùng" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200"}`}>{account.status}</span><BankActionMenu account={account} detail={detail} edit={edit} remove={remove} canEdit={canEdit} /></div>)}</div>;
}
function BankCardGrid({ accounts, detail, edit, remove, canEdit = true }: { accounts: BankAccount[]; detail: (account: BankAccount) => void; edit: (account: BankAccount) => void; remove: (account: BankAccount) => void; canEdit?: boolean }) {
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{accounts.map(account => <div key={account.id} className="relative rounded-2xl border border-indigo-100 bg-gradient-to-br from-[#4F46E5] via-indigo-700 to-slate-950 p-5 text-white shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-100">{account.bankName}</p><h3 className="mt-3 text-base font-bold">{account.productName || "Chưa cập nhật sản phẩm"}</h3><p className="mt-1 text-xs font-semibold text-indigo-100">{account.cardType}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{account.cardNetwork}</span><BankActionMenu account={account} detail={detail} edit={edit} remove={remove} canEdit={canEdit} dark /></div></div><p className="mt-6 rounded-xl bg-white/10 px-3 py-3 font-mono text-lg font-bold tracking-widest">{account.cardNumber ? maskCard(account.cardNumber) : maskLast(account.accountNumber)}</p><div className="mt-5 flex items-end justify-between gap-3 text-sm"><div><p className="text-xs text-indigo-100">Chủ thẻ</p><b>{account.accountHolder}</b></div><div className="text-right"><p className="text-xs text-indigo-100">Trạng thái</p><b>{account.status}</b></div></div></div>)}</div>;
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
  const [form, setForm] = useState<BankAccount>({ ...emptyBankForm(account.memberId), ...account, benefits: account.benefits || [] });
  const [error, setError] = useState("");
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
    event.preventDefault(); setError("");
    const response = await fetch(account.id ? `/api/bank-accounts/${account.id}` : "/api/bank-accounts", { method: account.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await readJsonSafe<{ ok?: boolean; data?: BankAccount; error?: string }>(response);
    if (!response.ok || !result?.data) return setError(result?.error || "Không thể lưu thẻ ngân hàng.");
    saved(result.data);
  }

  const formContent = (
    <>
      {inline && (
        <div className="mb-4">
          <button type="button" onClick={close} className="text-sm font-semibold text-indigo-600">← Quay lại danh sách thẻ</button>
        </div>
      )}
      <h2 className="text-lg font-bold">{account.id ? "Sửa thẻ ngân hàng" : "Thêm thẻ ngân hàng"}</h2>
      <div className="mt-5 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-indigo-600">A. Thông tin cơ bản</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Thành viên sở hữu">
              <select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>
                {members.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}
              </select>
            </Field>
            <Field label="Ngân hàng">
              <select required className={inputClass} value={form.bankName} onChange={event => set("bankName", event.target.value)}>
                {bankNames.map(name => <option key={name}>{name}</option>)}
              </select>
            </Field>
            <Field label="Tên chủ tài khoản">
              <input required className={inputClass} value={form.accountHolder} onChange={event => set("accountHolder", event.target.value)} />
            </Field>
            <Field label="Số tài khoản">
              <input className={inputClass} value={form.accountNumber} onChange={event => set("accountNumber", event.target.value)} />
            </Field>
            <Field label="Số thẻ">
              <input className={inputClass} value={form.cardNumber} onChange={event => set("cardNumber", event.target.value)} />
            </Field>
            <Field label="Loại thẻ">
              <select className={inputClass} value={form.cardType} onChange={event => { set("cardType", event.target.value); set("accountType", event.target.value); }}>
                {bankCardTypes.map(type => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Tổ chức thẻ">
              <select className={inputClass} value={form.cardNetwork} onChange={event => set("cardNetwork", event.target.value)}>
                {bankNetworks.map(value => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Tên sản phẩm thẻ">
              <input className={inputClass} value={form.productName} onChange={event => handleProductNameChange(event.target.value)} placeholder="BIDV Visa Platinum Cashback 360" />
            </Field>
            <Field label="Ngày sao kê">
              <input className={inputClass} inputMode="numeric" value={form.statementDay} onChange={event => set("statementDay", event.target.value)} />
            </Field>
            <Field label="Ngày đến hạn thanh toán">
              <input className={inputClass} inputMode="numeric" value={form.dueDay} onChange={event => set("dueDay", event.target.value)} />
            </Field>
            <Field label="Hạn mức tín dụng">
              <input className={inputClass} type="number" min="0" value={form.creditLimit} onChange={event => set("creditLimit", Number(event.target.value))} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tháng hết hạn">
                <input className={inputClass} inputMode="numeric" maxLength={2} value={form.expiryMonth} onChange={event => set("expiryMonth", event.target.value)} />
              </Field>
              <Field label="Năm hết hạn">
                <input className={inputClass} inputMode="numeric" maxLength={4} value={form.expiryYear} onChange={event => set("expiryYear", event.target.value)} />
              </Field>
            </div>
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

        <div>
          <h3 className="text-sm font-bold text-indigo-600">B. Biểu phí & điều kiện miễn phí</h3>
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

            <div className="grid grid-cols-2 gap-2">
              <Field label="Năm mở thẻ">
                <input className={inputClass} maxLength={4} placeholder="e.g. 2025" value={fees.openYear} onChange={event => updateFee("openYear", event.target.value)} />
              </Field>
              <Field label="Năm cần kiểm tra">
                <input className={inputClass} maxLength={4} placeholder="e.g. 2026" value={fees.checkYear} onChange={event => updateFee("checkYear", event.target.value)} />
              </Field>
            </div>

            {(() => {
              const openYr = parseInt(fees.openYear);
              const checkYr = parseInt(fees.checkYear);
              if (!isNaN(openYr) && !isNaN(checkYr)) {
                if (checkYr === openYr) {
                  return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 md:col-span-2">Miễn phí thường niên năm đầu</p>;
                } else if (checkYr > openYr) {
                  return <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 md:col-span-2">Cần chi tiêu đủ {money(form.annualFeeWaiverTarget)}/năm để miễn phí, nếu không có thể bị thu {money(form.annualFeeAmount)}.</p>;
                }
              }
              return null;
            })()}

            <p className="rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-600 md:col-span-2">💡 Dù trả đúng hạn, vẫn cần theo dõi phí thường niên, lãi suất, phí giao dịch nước ngoài và phí rút tiền mặt.</p>

            <div className="md:col-span-2">
              <Field label="Ghi chú biểu phí">
                <textarea rows={2} className={inputClass} value={fees.feeNote} onChange={event => updateFee("feeNote", event.target.value)} placeholder="Mốc miễn phí có thể thay đổi..." />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-indigo-600">C. Ưu đãi / Cashback</h3>
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
                    <Field label="Ghi chú điều kiện">
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

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-indigo-600">D. Ưu đãi mở thẻ / ưu đãi theo đợt</h3>
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
      </div>
      {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={close} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Hủy</button>
        <button className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Lưu</button>
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
  const [showFull, setShowFull] = useState(false);
  const progress = bankProgress(account);
  const fees = parseFees(account.note || "", account.productName || "");
  const [openYear, setOpenYear] = useState(fees.openYear || "");
  const [checkYear, setCheckYear] = useState(fees.checkYear || String(new Date().getFullYear()));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const content = (
    <>
      {inline && (
        <div className="mb-4">
          <button type="button" onClick={close} className="text-sm font-semibold text-indigo-600">← Quay lại danh sách thẻ</button>
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
            {[["Ngân hàng", account.bankName], ["Sản phẩm", account.productName || "Chưa cập nhật"], ["Thành viên", owner], ["Chủ thẻ", account.accountHolder], ["Loại", account.cardType], ["Tổ chức thẻ", account.cardNetwork], ["Trạng thái", account.status], ["Hạn mức tín dụng", money(account.creditLimit)], ["Ngày sao kê", account.statementDay || "Không có"], ["Ngày đến hạn", account.dueDay || "Không có"], ["Số tài khoản", showFull ? account.accountNumber || "Không có" : maskLast(account.accountNumber)], ["Số thẻ", showFull ? account.cardNumber || "Không có" : maskCard(account.cardNumber)], ["Hết hạn", account.expiryMonth || account.expiryYear ? `${account.expiryMonth}/${account.expiryYear}` : "Không áp dụng"], ["Ghi chú", account.note && account.note.startsWith("FEES_JSON:") ? (parseFees(account.note, account.productName || "").feeNote || "Không có") : (account.note || "Không có")]].map(([label, value]) => (
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
                <h4 className="text-xs font-bold text-slate-500 mb-2">Tra cứu phí theo năm</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Năm mở thẻ</label>
                    <input 
                      type="number" 
                      className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-2 py-1.5 text-xs outline-none" 
                      value={openYear} 
                      onChange={e => setOpenYear(e.target.value)} 
                      placeholder="Ví dụ: 2025"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Năm kiểm tra</label>
                    <input 
                      type="number" 
                      className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-background)] px-2 py-1.5 text-xs outline-none" 
                      value={checkYear} 
                      onChange={e => setCheckYear(e.target.value)} 
                      placeholder="Ví dụ: 2026"
                    />
                  </div>
                </div>
                
                {(() => {
                  const openYr = parseInt(openYear);
                  const checkYr = parseInt(checkYear);
                  if (!isNaN(openYr) && !isNaN(checkYr)) {
                    if (checkYr === openYr) {
                      return <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600 text-center">Miễn phí thường niên năm đầu</p>;
                    } else if (checkYr > openYr) {
                      return <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 text-center">Cần chi tiêu đủ {money(account.annualFeeWaiverTarget)}/năm để miễn phí, nếu không có thể bị thu {money(account.annualFeeAmount)}.</p>;
                    }
                  }
                  return null;
                })()}
              </div>

              <p className="text-[11px] font-semibold text-indigo-600 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                💡 Dù trả đúng hạn, vẫn cần theo dõi phí thường niên, lãi suất, phí giao dịch nước ngoài và phí rút tiền mặt.
              </p>
            </div>
          </div>
        </section>
        
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
          <h3 className="font-semibold">Hoàn tiền / điểm thưởng đã ghi nhận</h3>
          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-3/4"></div>
                <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-1/2"></div>
              </div>
            ) : account.rewards?.length ? account.rewards.map(reward => (
              <div key={reward.id} className="rounded-xl border border-[var(--app-border)] p-4 text-sm">
                <b>{reward.title || reward.rewardType}</b>
                <p className="mt-2 text-slate-500">{reward.rewardType} · {money(reward.amount)} · {reward.points ? `${reward.points} điểm` : "Không có điểm"}</p>
                <p className="mt-1 text-xs text-slate-400">{reward.recordedAt || "Chưa có ngày"} · {reward.note || "Không có ghi chú"}</p>
              </div>
            )) : <p className="rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-slate-400">Chưa có hoàn tiền/điểm thưởng ghi nhận.</p>}
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
                            alert("Không thể cập nhật trạng thái ưu đãi.");
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
const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-3 text-sm outline-none focus:border-rose-400";
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
        {editor.kind === "transactions" && <><Field label="Nội dung"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Số tiền"><input required min="0" type="number" className={inputClass} value={form.amount} onChange={e => set("amount", e.target.value)} /></Field><Field label="Loại"><select className={inputClass} value={form.type} onChange={e => set("type", e.target.value)}><option value="expense">Chi</option><option value="income">Thu</option></select></Field><Field label="Danh mục"><select className={inputClass} value={form.category} onChange={e => set("category", e.target.value)}>{["Ăn uống","Điện nước","Học tập","Y tế","Mua sắm","Di chuyển","Khác"].map(category => <option key={category}>{category}</option>)}</select></Field><MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} /><Field label="Ngày chi"><DateVNInput required value={form.date} onChange={value => set("date", value)} /></Field></>}
        {editor.kind === "events" && <><Field label="Tên sự kiện"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Loại sự kiện"><select className={inputClass} value={form.type} onChange={e => set("type", e.target.value)}><option value="family">Gia đình</option><option value="birthday">Sinh nhật</option><option value="medical">Khám bệnh</option><option value="school">Học tập / họp phụ huynh</option></select></Field><MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} /><Field label="Ngày"><DateVNInput required value={form.date} onChange={value => set("date", value)} /></Field><Field label="Giờ"><input required type="time" className={inputClass} value={form.time} onChange={e => set("time", e.target.value)} /></Field><Field label="Màu"><input type="color" className={`${inputClass} h-12`} value={form.color} onChange={e => set("color", e.target.value)} /></Field></>}
        {editor.kind === "notes" && <><Field label="Tiêu đề"><input required className={inputClass} value={form.title} onChange={e => set("title", e.target.value)} /></Field><Field label="Loại ghi chú"><select className={inputClass} value={form.kind} onChange={e => set("kind", e.target.value)}><option value="general">Ghi chú chung</option><option value="member">Theo thành viên</option></select></Field>{form.kind === "member" && <MemberSelect members={members} value={form.memberId} set={value => set("memberId", value)} required />}<Field label="Tag"><input className={inputClass} value={form.tag} onChange={e => set("tag", e.target.value)} placeholder="Ví dụ: sức khỏe" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.important === "true"} onChange={e => set("important", String(e.target.checked))} /> Ghi chú quan trọng</label><Field label="Nội dung"><textarea required rows={5} className={inputClass} value={form.content} onChange={e => set("content", e.target.value)} /></Field></>}
      </div>
      <div className="mt-6 flex gap-3">{existing && actor.role === "full_access" && editor.kind !== "members" && <button type="button" onClick={() => remove(editor.kind, existing.id)} className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-500">Xóa</button>}<button className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Lưu</button></div>
    </form>
  </div>;
}

function Settings({ user, onLogout, openProfile, openChangePassword, language, setLanguage, theme, setTheme, updateData, t }: { user: AuthUser; onLogout: () => void; openProfile: () => void; openChangePassword: () => void; language: Language; setLanguage: (x: Language) => void; theme: Theme; setTheme: (x: Theme) => void; updateData: (data: AppData) => void; t: ReturnType<typeof translator> }) {
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
    if (!file || !confirm("Import sẽ ghi đè toàn bộ dữ liệu hiện tại. Bạn có muốn tiếp tục?")) return;
    try { updateData(dataService.importData(await file.text())); alert("Đã import dữ liệu thành công."); }
    catch (error) { alert(error instanceof Error ? error.message : "Không thể đọc file JSON."); }
  }
  function resetData() {
    if (!confirm("Reset sẽ xóa dữ liệu hiện tại và khôi phục dữ liệu mặc định. Bạn có muốn tiếp tục?")) return;
    updateData(dataService.reset());
  }
  async function resetPassword(target: ManagedUser) { const password = prompt(`Nhập mật khẩu mới cho ${target.username} (ít nhất 6 ký tự):`); if (!password || !confirm(`Reset mật khẩu cho ${target.username}?`)) return; const response = await fetch("/api/users/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id, password }) }); const result = await readJsonSafe<{ error?: string }>(response); alert(response.ok ? "Đã reset mật khẩu." : result?.error || "Không thể reset mật khẩu."); void loadUsers(); }
  async function handleResetRequest(request: PasswordResetRequest) { const password = prompt(`Nhập mật khẩu tạm mới cho ${request.username} (ít nhất 6 ký tự):`); if (!password || !confirm(`Đặt mật khẩu tạm cho ${request.username}?`)) return; const response = await fetch("/api/users/password-reset-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.id, password }) }); const result = await readJsonSafe<{ error?: string }>(response); alert(response.ok ? "Đã đặt mật khẩu tạm. User phải đổi mật khẩu sau khi đăng nhập." : result?.error || "Không thể đặt mật khẩu tạm."); void loadResetRequests(); void loadUsers(); }
  async function deleteUser(target: ManagedUser) { if (!confirm(`Xóa tài khoản ${target.username}?`)) return; const response = await fetch(`/api/users?id=${target.id}`, { method: "DELETE" }); const result = await readJsonSafe<{ error?: string }>(response); alert(response.ok ? "Đã xóa tài khoản." : result?.error || "Không thể xóa tài khoản."); void loadUsers(); }
  return <div className="max-w-2xl">{user.mustChangePassword && <Card className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-400/10"><b className="text-orange-600">Bạn đang dùng mật khẩu mặc định hoặc mật khẩu vừa được reset.</b><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Hãy đổi mật khẩu để bảo vệ tài khoản.</p><button onClick={openChangePassword} className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">Đổi mật khẩu</button></Card>}<SectionTitle label="Tài khoản" /><Card className="flex items-center gap-3"><div className="min-w-0 flex-1"><b>{user.displayName}</b><p className="text-xs text-slate-400">{accessLabel(user.role)}</p></div><button onClick={openProfile} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Hồ sơ cá nhân</button><button onClick={onLogout} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-500">Đăng xuất</button></Card>{user.role === "full_access" && <><SectionTitle label="Yêu cầu đặt lại mật khẩu" /><div className="space-y-3">{resetRequests.length ? resetRequests.map(request => <Card key={request.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><b>{request.displayName}</b><p className="text-xs text-slate-400">{request.username} · {accessLabel(request.role)}</p><p className="mt-1 text-xs text-slate-400">{new Date(request.requestedAt).toLocaleString("vi-VN")}</p></div><button onClick={() => handleResetRequest(request)} className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white">Đặt mật khẩu tạm</button></Card>) : <Card className="text-sm text-slate-400">Không có yêu cầu đang chờ.</Card>}</div><SectionTitle label="Quản lý tài khoản" action="Thêm user" onClick={() => setEditingUser("new")} /><div className="space-y-3">{users.map(account => <Card key={account.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><b>{account.displayName}</b><p className="text-xs text-slate-400">{account.username} · {accessLabel(account.role)} · {account.active ? "Đang hoạt động" : "Đã tắt"}</p></div><div className="flex gap-1"><EditButton onClick={() => setEditingUser(account)} /><button onClick={() => resetPassword(account)} className="rounded-xl px-2 py-2 text-xs font-bold text-orange-500">Reset</button>{!account.isSystem && <button onClick={() => deleteUser(account)} className="rounded-xl px-2 py-2 text-xs font-bold text-red-500">Xóa</button>}</div></Card>)}</div>{editingUser && <UserEditor user={editingUser} close={() => setEditingUser(null)} saved={() => { setEditingUser(null); void loadUsers(); }} />}</>}<SectionTitle label={t("language")} /><Card><select className="w-full bg-transparent outline-none" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="ja">日本語</option></select></Card><SectionTitle label={t("appearance")} /><Card className="flex gap-2">{(["light","dark","system"] as Theme[]).map(x => <button key={x} onClick={() => setTheme(x)} className={`flex-1 rounded-xl px-2 py-3 text-xs font-bold ${theme===x ? "bg-rose-400 text-white" : "bg-rose-50 text-slate-500 dark:bg-white/10 dark:text-slate-200"}`}>{t(x)}</button>)}</Card>
  <SectionTitle label="Sao lưu dữ liệu" /><Card className="space-y-3"><p className="text-sm text-slate-500 dark:text-slate-300">Xuất file JSON để lưu trữ hoặc import để khôi phục dữ liệu trên thiết bị này.</p><button onClick={exportData} className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Export file JSON</button><label className="block w-full cursor-pointer rounded-xl border border-rose-300 px-4 py-3 text-center text-sm font-bold text-rose-500">Import file JSON<input type="file" accept="application/json,.json" className="hidden" onChange={importData} /></label><button onClick={resetData} className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-500">Reset về dữ liệu mặc định</button></Card>
  <SectionTitle label="Trạng thái hệ thống" /><Card className="space-y-3"><div className="flex items-center justify-between gap-3"><div><b>{systemStatus.source === "nas" ? "PostgreSQL NAS" : "localStorage fallback"}</b><p className="mt-1 text-xs text-slate-400">{systemStatus.message}</p></div><span className={`size-3 shrink-0 rounded-full ${systemStatus.source === "nas" ? "bg-emerald-400" : "bg-orange-400"}`} /></div><p className="text-xs text-slate-400">Đồng bộ cuối: {systemStatus.lastSyncedAt ? new Date(systemStatus.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có"}</p>{systemStatus.counts && <div className="grid grid-cols-2 gap-2 rounded-xl bg-rose-50 p-3 text-xs dark:bg-white/5"><span>Thành viên: <b>{systemStatus.counts.members}</b></span><span>Công việc: <b>{systemStatus.counts.tasks}</b></span><span>Thu chi: <b>{systemStatus.counts.transactions}</b></span><span>Sự kiện: <b>{systemStatus.counts.events}</b></span><span>Ghi chú: <b>{systemStatus.counts.notes}</b></span></div>}<button disabled={checking} onClick={checkConnection} className="w-full rounded-xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-500 disabled:opacity-50">{checking ? "Đang kiểm tra..." : "Kiểm tra kết nối database"}</button><button disabled={syncing} onClick={syncToNas} className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{syncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu localStorage lên NAS"}</button></Card>
  <SectionTitle label="Cài đặt ứng dụng" /><Card className="space-y-3 text-sm text-slate-500 dark:text-slate-300"><p><b className="text-[var(--app-foreground)]">Android / Chrome:</b> mở menu trình duyệt và chọn Thêm vào màn hình chính hoặc Cài đặt ứng dụng.</p><p><b className="text-[var(--app-foreground)]">iPhone / Safari:</b> nhấn nút Chia sẻ, sau đó chọn Thêm vào MH chính.</p><p>Sau khi cài đặt, Family Hub mở ở chế độ standalone như một ứng dụng và hỗ trợ mở lại dữ liệu đã dùng khi mất mạng.</p></Card>
  <p className="mt-5 text-center text-xs text-slate-400">{t("storage")}</p></div>;
}

function EmptyState() { return <div className="p-8 text-center text-sm text-slate-500">Không có dữ liệu</div>; }
