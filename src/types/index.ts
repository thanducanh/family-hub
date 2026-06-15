export type Language = "vi" | "en" | "ja";
export type Theme = "light" | "dark" | "system";
export type TaskStatus = "todo" | "doing" | "done";
export type TransactionType = "income" | "expense";
export type IncomeYearlySummaryRow = {
  id: string;
  memberId: string;
  year: number;
  category: IncomeCategory;
  name: string;
  amount: number;
  note: string;
  workSource?: string;
  createdAt: string;
  updatedAt: string;
};

export type IncomeSourceType = "fixed" | "variable";
export type IncomeFrequency = "monthly" | "weekly" | "yearly" | "one_time" | "custom";
export type IncomeCategory = string;
export type IncomeStatus = string;
export type TaskPriority = "low" | "normal" | "high";
export type EventType = "family" | "birthday" | "medical" | "school";
export type NoteKind = "general" | "member";

export type Gender = "male" | "female" | "other" | "";
export interface LinkedAccount { id: string; username: string; email: string; displayName: string; role: "full_access" | "self_only"; active: boolean; isSystem: boolean; memberId: string; createdAt: string; updatedAt: string; }
export interface Member { id: string; name: string; nickname: string; birthday: string; gender: Gender; phone: string; avatar: string; avatarUrl?: string; avatarPreview?: string; notes: string; color: string; user?: LinkedAccount | null; }
export type MemberSimCarrier = string;
export type MemberSimType = string;
export type MemberSimStatus = string;
export interface MemberSim { id: string; memberId: string; carrier: MemberSimCarrier; phoneNumber: string; simType: MemberSimType; planName: string; monthlyFee: number; dataAmount: string; billingCycleDay: number | null; renewalMonths: number; renewalDate: string; lastTopupDate: string; lastTopupAmount: number; simBalance: number; nextRenewalDate: string; lastRenewalCheckedDate?: string; lastReminderDate?: string; status: MemberSimStatus; note: string; createdAt?: string; updatedAt?: string; }
export interface Task { id: string; title: string; memberId: string; assignee: string; due: string; dueDate: string; priority: TaskPriority; status: TaskStatus; }
export type PaymentMethod = "cash" | "transfer" | "momo" | "apple_pay" | "bank_account" | "bank_card" | "card" | "credit_card" | "other";
export interface Transaction { id: string; title: string; memberId: string; amount: number; grossAmount?: number; discountAmount?: number; type: TransactionType; category: string; subcategory?: string; date: string; note?: string; bankAccountId?: string; bank_account_id?: string; paymentAccountId?: string; payment_account_id?: string; simId?: string; sim_id?: string; simTopupApplied?: boolean; sim_topup_applied?: boolean; savingsApplied?: boolean; savings_applied?: boolean; savingsHolder?: string; savings_holder?: string; linkedSavingsId?: string; linked_savings_id?: string; paymentMethod?: PaymentMethod; payment_method?: PaymentMethod; transactionTime?: string; transaction_time?: string; estimatedCashback?: number; actualCashback?: number; isReimbursable?: boolean; is_reimbursable?: boolean; reimbursementPerson?: string | null; reimbursement_person?: string | null; reimbursementStatus?: string; reimbursement_status?: string; reimbursedAmount?: number; reimbursed_amount?: number; reimbursedAt?: string | null; reimbursed_at?: string | null; countsForPersonalExpense?: boolean; counts_for_personal_expense?: boolean; countsForCardSpending?: boolean; counts_for_card_spending?: boolean; createdAt?: string; created_at?: string; year?: number; month?: number; }
export interface ExpenseItem { id: string; expenseId: string; itemName: string; quantity: number; unitPrice: number; amount: number; }
export interface IncomeSource { id: string; memberId: string; name: string; type: IncomeSourceType; amount: number; frequency: IncomeFrequency; receivedDate: string; startDate: string; note: string; active: boolean; createdAt?: string; updatedAt?: string; memberName?: string; }
export type MemberJobStatus = "active" | "ended";
export interface MemberJob { id: string; memberId: string; title: string; company: string; startYear: number | null; endYear: number | null; status: MemberJobStatus; note: string; createdAt?: string; updatedAt?: string; }
export interface IncomeRecord { id: string; sourceId?: string; memberId: string; memberName?: string; jobId?: string; jobName?: string; workId?: string; workName?: string; workSource?: string; incomeDate: string; receivedDate: string; year: number; month: number; category: IncomeCategory; name: string; amount: number; status: IncomeStatus; note: string; createdAt?: string; updatedAt?: string; sourceName?: string; sourceType?: IncomeSourceType; generated?: boolean; }
export type SavingsType = "monthly" | "extra" | "bonus" | "interest" | "withdraw" | "adjustment";
export type SavingsHolder = string;
export interface SavingsRecord { id: string; memberId: string | null; year: number; month: number; amount: number; type: SavingsType; holder: SavingsHolder; description: string; note: string; createdAt?: string; updatedAt?: string; }
export interface EventItem { id: string; title: string; memberId: string; type: EventType; date: string; time: string; color: string; calendarId?: string; description?: string; startDate?: string; endDate?: string; startTime?: string; endTime?: string; allDay?: boolean; location?: string; createdByUserId?: string; repeatRule?: string; lunarDate?: string; relatedMemberIds?: string[]; }
export interface Note { id: string; title: string; memberId: string; kind: NoteKind; important: boolean; tag: string; content: string; updatedAt: string; }

export type BankCardType = string;
export type BankCardNetwork = string;
export type BankAccountStatus = string;
export type AnnualFeeWaiverType = string;
export type AnnualFeeCycle = string;
export type BankBenefitCategory = string;
export type BankBenefitType = string;
export interface BankCardBenefit { id: string; bankAccountId: string; name: string; category: BankBenefitCategory; benefitType: BankBenefitType; benefitValue: number; monthlyCap: number; minTransactionAmount: number; conditionNote: string; active: boolean; createdAt?: string; updatedAt?: string; }
export type BankCardRewardType = string;
export interface BankCardReward { id: string; bankAccountId: string; rewardType: BankCardRewardType; title: string; amount: number; points: number; recordedAt: string; note: string; createdAt?: string; updatedAt?: string; }
export type CardRewardType = "cashback" | "points" | "redeem_points" | "voucher" | "annual_fee_refund" | "other";
export type CardRewardStatus = "expected" | "received" | "used" | "expired";
export interface CardReward { id: string; memberId: string; bankAccountId: string | null; rewardDate: string; type: CardRewardType; amount: number; points: number; status: CardRewardStatus; title: string; note: string; createdAt?: string; updatedAt?: string; }
export interface BankAccount {
  id: string; memberId: string; bankName: string; accountHolder: string; accountNumber: string; cardNumber: string;
  cardType: BankCardType; accountType?: BankCardType; cardNetwork: BankCardNetwork; productName: string; branch: string;
  statementDay: string; dueDay: string; creditLimit: number; expiryMonth: string; expiryYear: string; status: BankAccountStatus;
  annualFeeEnabled: boolean; annualFeeAmount: number; annualFeeWaiverType: AnnualFeeWaiverType; annualFeeWaiverTarget: number;
  annualFeeCycle: AnnualFeeCycle; annualFeeCycleStart: string; annualFeeCurrentSpending: number; note: string; benefits: BankCardBenefit[]; rewards: BankCardReward[]; cardRewards?: CardReward[]; createdAt?: string; updatedAt?: string;
  displayName?: string; last4?: string;
}
export type BankRawNoteContentType = string;
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
export type InvestmentAction = "buy" | "sell";
export interface InvestmentTransaction {
  id: string;
  memberId: string | null;
  tradeDate: string;
  stockCode: string;
  action: InvestmentAction;
  quantity: number;
  price: number;
  fee: number;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}
