ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_person TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_at DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_personal_expense BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_card_spending BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE transactions
SET is_reimbursable = TRUE,
    reimbursement_status = COALESCE(NULLIF(reimbursement_status, 'none'), 'pending'),
    reimbursed_amount = COALESCE(reimbursed_amount, 0),
    counts_for_personal_expense = FALSE,
    counts_for_card_spending = TRUE
WHERE category = 'Thanh toán hộ';

UPDATE transactions
SET is_reimbursable = FALSE,
    counts_for_personal_expense = FALSE,
    counts_for_card_spending = FALSE
WHERE category = 'Tiết kiệm';
