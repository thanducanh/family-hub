import { mockData } from "@/data/mock-data";
import type { AppData, EventItem, FamilyRole, Member, Note, Preferences, Task, Transaction } from "@/types";

export interface DataService {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  exportData(): string;
  importData(content: string): AppData;
  reset(): AppData;
  loadPreferences(): Preferences;
  savePreferences(preferences: Preferences): void;
}
export interface NasCounts { members: number; tasks: number; transactions: number; events: number; notes: number; }
export interface SystemStatus { source: "nas" | "localStorage"; lastSyncedAt: string | null; message: string; counts: NasCounts | null; }

const DATA_KEY = "family-hub:data";
const PREFERENCES_KEY = "family-hub:preferences";

const emptyData: AppData = {
  members: [],
  tasks: [],
  transactions: [],
  events: [],
  notes: []
};

function getInitialData(): AppData {
  if (process.env.NODE_ENV === "development") {
    return structuredClone(mockData);
  }
  return structuredClone(emptyData);
}

export class LocalStorageDataService implements DataService {
  async load(): Promise<AppData> {
    if (typeof window === "undefined") return getInitialData();
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return getInitialData();
    try { return normalizeData(JSON.parse(raw) as AppData); } catch { return getInitialData(); }
  }
  async save(data: AppData) { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  exportData() { return JSON.stringify(loadCache(), null, 2); }
  importData(content: string) {
    const data: unknown = JSON.parse(content);
    if (!isAppData(data)) throw new Error("File JSON không đúng định dạng dữ liệu Family Hub.");
    const normalized = normalizeData(data);
    void this.save(normalized);
    return normalized;
  }
  reset() {
    const data = getInitialData();
    void this.save(data);
    return data;
  }
  loadPreferences(): Preferences {
    if (typeof window === "undefined") return { language: "vi", theme: "system" };
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { language: "vi", theme: "system" };
    try { return JSON.parse(raw) as Preferences; } catch { return { language: "vi", theme: "system" }; }
  }
  savePreferences(preferences: Preferences) { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
}

const collections = ["members", "tasks", "transactions", "events", "notes"] as const;

export class ApiDataService implements DataService {
  private current: AppData | null = null;
  private status: SystemStatus = { source: "localStorage", lastSyncedAt: null, message: "Chưa kiểm tra kết nối.", counts: null };
  constructor(private readonly fallback = new LocalStorageDataService()) {}
  loadCache() {
    const data = loadCache();
    this.current = data;
    return data;
  }
  async syncFromNas(onData?: (data: AppData) => void) {
    const startedAt = performance.now();
    try {
      const data = await this.readNas();
      const cache = await this.fallback.load();
      if (isEmpty(data) && !isEmpty(cache)) {
        await this.writeNas(cache, false);
        const synced = await this.readNas();
        await this.fallback.save(synced);
        this.current = synced;
        onData?.(synced);
        this.setStatus("nas", "Đã tự động đồng bộ localStorage lên PostgreSQL NAS.", countsOf(synced));
      } else {
        await this.fallback.save(data);
        this.current = data;
        onData?.(data);
        this.setStatus("nas", "Đang sử dụng PostgreSQL NAS.", countsOf(data));
      }
    } catch {
      this.setStatus("localStorage", "Không thể kết nối NAS. App đang dùng localStorage fallback.");
    } finally {
      console.info(`[Family Hub] Đồng bộ PostgreSQL nền: ${Math.round(performance.now() - startedAt)}ms`);
    }
  }
  async load() {
    const cache = this.loadCache();
    void this.syncFromNas();
    return cache;
  }
  async save(data: AppData) {
    try {
      await this.writeNas(data, true);
      await this.fallback.save(data);
      this.current = data;
      this.setStatus("nas", "Đã ghi PostgreSQL NAS và cập nhật cache offline.", countsOf(data));
    } catch {
      await this.fallback.save(data);
      this.current = data;
      this.setStatus("localStorage", "Không thể đồng bộ NAS. Dữ liệu vẫn được lưu trong localStorage.");
      // localStorage remains the offline fallback and cache.
    }
  }
  exportData() { return this.fallback.exportData(); }
  importData(content: string) { const data = this.fallback.importData(content); void this.save(data); return data; }
  reset() { const data = this.fallback.reset(); void this.save(data); return data; }
  loadPreferences() { return this.fallback.loadPreferences(); }
  savePreferences(preferences: Preferences) { this.fallback.savePreferences(preferences); }
  getStatus() { return this.status; }
  async checkConnection() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Database unavailable");
      const health = await response.json() as { counts: NasCounts };
      this.setStatus("nas", "Kết nối PostgreSQL NAS hoạt động bình thường.", health.counts);
    } catch {
      this.setStatus("localStorage", "Không thể kết nối PostgreSQL NAS.");
    }
    return this.status;
  }
  async syncCacheToNas() {
    const cache = await this.fallback.load();
    try {
      await this.writeNas(cache, false);
      this.current = await this.readNas();
      await this.fallback.save(this.current);
      const health = await fetch("/api/health", { cache: "no-store" });
      if (!health.ok) throw new Error("Database health unavailable");
      const result = await health.json() as { counts: NasCounts };
      this.setStatus("nas", "Đã upsert toàn bộ localStorage lên PostgreSQL NAS.", result.counts);
    } catch {
      this.setStatus("localStorage", "Không thể đồng bộ localStorage lên PostgreSQL NAS.");
    }
    return this.status;
  }
  private async readNas() {
    const responses = await Promise.all(collections.map(collection => fetch(`/api/${collection}`)));
    if (responses.some(response => !response.ok)) throw new Error("Database API unavailable");
    const values = await Promise.all(responses.map(response => response.json()));
    const extractedValues = values.map(val => (val && typeof val === "object" && val.ok !== undefined && val.data !== undefined) ? val.data : val);
    const data = Object.fromEntries(collections.map((collection, index) => [collection, extractedValues[index]])) as unknown as AppData;
    
    if (this.current?.members) {
      data.members = data.members.map(newM => {
        const existingM = this.current!.members.find(m => m.id === newM.id);
        return {
          ...newM,
          avatar: (existingM && existingM.avatar && !newM.avatar) ? existingM.avatar : newM.avatar,
          avatarPreview: newM.avatarPreview || (existingM && existingM.avatarPreview) || ""
        };
      });
    }

    return normalizeData(data);
  }
  private async writeNas(data: AppData, includeDeletes: boolean) {
    const writableCollections = collections.filter(collection => collection !== "events");
    const writes = writableCollections.flatMap(collection => data[collection].map(item => fetch(`/api/${collection}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) })));
    const deletes = includeDeletes && this.current ? writableCollections.filter(collection => collection !== "members").flatMap(collection => this.current![collection].filter(item => !data[collection].some(current => current.id === item.id)).map(item => fetch(`/api/${collection}?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }))) : [];
    const responses = await Promise.all([...writes, ...deletes]);
    if (responses.some(response => !response.ok)) throw new Error("Database API unavailable");
  }
  private setStatus(source: SystemStatus["source"], message: string, counts = this.status.counts) {
    this.status = { source, message, counts, lastSyncedAt: source === "nas" ? new Date().toISOString() : this.status.lastSyncedAt };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("family-hub:system-status"));
  }
}

function isAppData(data: unknown): data is AppData {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  return ["members", "tasks", "transactions", "events", "notes"].every(key => Array.isArray(value[key]));
}

function normalizeData(data: AppData): AppData {
  return {
    ...data,
    members: data.members.map(member => ({ ...normalizeMember(member), id: normalizeId(member.id) })),
    tasks: data.tasks.map(task => ({ ...normalizeTask(task), id: normalizeId(task.id) })),
    transactions: data.transactions.map(transaction => ({ ...normalizeTransaction(transaction), id: normalizeId(transaction.id) })),
    events: data.events.map(event => ({ ...normalizeEvent(event), id: normalizeId(event.id) })),
    notes: data.notes.map(note => ({ ...normalizeNote(note), id: normalizeId(note.id) })),
  };
}

function normalizeMember(member: Partial<Member> & Pick<Member, "id" | "name" | "role" | "color">): Member {
  return { nickname: "", gender: "", phone: "", avatar: "", notes: "", ...member, birthday: normalizeBirthday(member.birthday), role: normalizeRole(member.role) };
}
function normalizeBirthday(value: unknown) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const familyRoles: FamilyRole[] = ["Tôi", "Bố", "Mẹ", "Con", "Ông nội", "Bà nội", "Ông ngoại", "Bà ngoại", "Anh", "Chị", "Em", "Khác"];
function normalizeRole(role: string): FamilyRole {
  if (role === "Ba") return "Bố";
  return familyRoles.includes(role as FamilyRole) ? role as FamilyRole : "Khác";
}

function normalizeTransaction(transaction: Partial<Transaction> & Omit<Transaction, "category">): Transaction {
  const amount = Number(transaction.amount);
  return { ...transaction, amount: Number.isFinite(amount) ? amount : 0, memberId: transaction.memberId || "", category: transaction.category || "Khác" };
}
function normalizeTask(task: Partial<Task> & Pick<Task, "id" | "title" | "assignee" | "due" | "status">): Task {
  return { ...task, memberId: task.memberId || "", dueDate: task.dueDate || "", priority: task.priority || "normal" };
}
function normalizeEvent(event: Partial<EventItem> & Pick<EventItem, "id" | "title" | "date" | "time" | "color">): EventItem {
  return { ...event, memberId: event.memberId || "", type: event.type || "family" };
}
function normalizeNote(note: Partial<Note> & Pick<Note, "id" | "title" | "content" | "updatedAt">): Note {
  return { ...note, memberId: note.memberId || "", kind: note.kind || "general", important: note.important || false, tag: note.tag || "" };
}

function normalizeId(id: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return id;
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `00000000-0000-4000-8000-${(hash >>> 0).toString(16).padStart(12, "0")}`;
}

function loadCache(): AppData {
  if (typeof window === "undefined") return getInitialData();
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return getInitialData();
  try { return normalizeData(JSON.parse(raw) as AppData); } catch { return getInitialData(); }
}

function isEmpty(data: AppData) {
  return collections.every(collection => data[collection].length === 0);
}

function countsOf(data: AppData): NasCounts {
  return Object.fromEntries(collections.map(collection => [collection, data[collection].length])) as unknown as NasCounts;
}

export const dataService = new ApiDataService();
