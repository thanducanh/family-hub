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
export interface Transaction { id: string; title: string; memberId: string; amount: number; type: TransactionType; category: string; date: string; bankAccountId?: string; estimatedCashback?: number; actualCashback?: number; }
export interface EventItem { id: string; title: string; memberId: string; type: EventType; date: string; time: string; color: string; calendarId?: string; description?: string; startDate?: string; endDate?: string; startTime?: string; endTime?: string; allDay?: boolean; location?: string; createdByUserId?: string; repeatRule?: string; lunarDate?: string; relatedMemberIds?: string[]; }
export interface Note { id: string; title: string; memberId: string; kind: NoteKind; important: boolean; tag: string; content: string; updatedAt: string; }

export type BankCardType = "Tài khoản nhận lương" | "Tài khoản ngân hàng" | "ATM nội địa" | "Debit" | "Credit Visa" | "Credit Mastercard" | "Credit JCB" | "Ví điện tử";
export type BankCardNetwork = "NAPAS" | "Visa" | "Mastercard" | "JCB" | "Khác";
export type BankAccountStatus = "Đang dùng" | "Tạm khóa" | "Đã hủy";
export type AnnualFeeWaiverType = "Không có" | "Theo tổng chi tiêu năm" | "Theo tổng chi tiêu tháng" | "Theo số giao dịch";
export type AnnualFeeCycle = "tháng" | "năm";
export type BankBenefitCategory = "Siêu thị" | "Y tế" | "Giáo dục" | "Ăn uống" | "Xăng xe" | "Mua sắm online" | "Thanh toán hóa đơn" | "Khác";
export type BankBenefitType = "Hoàn tiền %" | "Giảm tiền cố định" | "Điểm thưởng";
export interface BankCardBenefit { id: string; bankAccountId: string; name: string; category: BankBenefitCategory; benefitType: BankBenefitType; benefitValue: number; monthlyCap: number; minTransactionAmount: number; conditionNote: string; active: boolean; createdAt?: string; updatedAt?: string; }
export type BankCardRewardType = "Hoàn tiền" | "Đổi điểm thành tiền" | "Quà tặng" | "Miễn/giảm phí";
export interface BankCardReward { id: string; bankAccountId: string; rewardType: BankCardRewardType; title: string; amount: number; points: number; recordedAt: string; note: string; createdAt?: string; updatedAt?: string; }
export interface BankAccount {
  id: string; memberId: string; bankName: string; accountHolder: string; accountNumber: string; cardNumber: string;
  cardType: BankCardType; accountType?: BankCardType; cardNetwork: BankCardNetwork; productName: string; branch: string;
  statementDay: string; dueDay: string; creditLimit: number; expiryMonth: string; expiryYear: string; status: BankAccountStatus;
  annualFeeEnabled: boolean; annualFeeAmount: number; annualFeeWaiverType: AnnualFeeWaiverType; annualFeeWaiverTarget: number;
  annualFeeCycle: AnnualFeeCycle; annualFeeCycleStart: string; annualFeeCurrentSpending: number; note: string; benefits: BankCardBenefit[]; rewards: BankCardReward[]; createdAt?: string; updatedAt?: string;
}
export type BankRawNoteContentType = "Ưu đãi" | "Phí thường niên" | "Điều khoản thẻ" | "Sao kê" | "Email ngân hàng" | "Khác";
export interface BankRawNote {
  id: string; memberId: string; bankAccountId: string; title: string; bankName: string; contentType: BankRawNoteContentType;
  rawText: string; imageUrl?: string; extractedJson?: BankExtractedPayload | null; effectiveDate: string; expiryDate: string; note: string; createdAt?: string; updatedAt?: string;
}
export type BankExtractedBenefitType = "cashback_percent" | "fixed_discount" | "points";
export interface BankExtractedCashbackRule { category: string; benefit_type: BankExtractedBenefitType; benefit_value: number; monthly_cap: number | null; condition_note: string; }
export interface BankExtractedCard {
  product_name: string; card_network: BankCardNetwork; card_type: BankCardType; annual_fee_amount: number; annual_fee_waiver_target: number;
  interest_rate: string; foreign_transaction_fee: string; cashback_rules: BankExtractedCashbackRule[]; raw_note: string;
}
export interface BankExtractedPayload { bank_name: string; cards: BankExtractedCard[]; }
export interface Preferences { language: Language; theme: Theme; }
export interface AppData {
  members: Member[]; tasks: Task[]; transactions: Transaction[]; events: EventItem[]; notes: Note[];
}
