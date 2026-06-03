export type Language = "vi" | "en" | "ja";
export type Theme = "light" | "dark" | "system";
export type TaskStatus = "todo" | "doing" | "done";
export type TransactionType = "income" | "expense";
export type TaskPriority = "low" | "normal" | "high";
export type EventType = "family" | "birthday" | "medical" | "school";
export type NoteKind = "general" | "member";

export type Gender = "male" | "female" | "other" | "";
export type FamilyRole = "Tôi" | "Bố" | "Mẹ" | "Con" | "Ông nội" | "Bà nội" | "Ông ngoại" | "Bà ngoại" | "Anh" | "Chị" | "Em" | "Khác";
export interface LinkedAccount { id: string; username: string; email: string; displayName: string; role: "full_access" | "self_only"; active: boolean; isSystem: boolean; memberId: string; createdAt: string; updatedAt: string; }
export interface Member { id: string; name: string; nickname: string; birthday: string; gender: Gender; role: FamilyRole; phone: string; avatar: string; notes: string; color: string; user?: LinkedAccount | null; }
export interface Task { id: string; title: string; memberId: string; assignee: string; due: string; dueDate: string; priority: TaskPriority; status: TaskStatus; }
export interface Transaction { id: string; title: string; memberId: string; amount: number; type: TransactionType; category: string; date: string; }
export interface EventItem { id: string; title: string; memberId: string; type: EventType; date: string; time: string; color: string; calendarId?: string; description?: string; startDate?: string; endDate?: string; startTime?: string; endTime?: string; allDay?: boolean; location?: string; createdByUserId?: string; repeatRule?: string; lunarDate?: string; relatedMemberIds?: string[]; }
export interface Note { id: string; title: string; memberId: string; kind: NoteKind; important: boolean; tag: string; content: string; updatedAt: string; }
export interface Preferences { language: Language; theme: Theme; }
export interface AppData {
  members: Member[]; tasks: Task[]; transactions: Transaction[]; events: EventItem[]; notes: Note[];
}
