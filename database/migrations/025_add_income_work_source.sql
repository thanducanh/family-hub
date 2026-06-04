-- Add work_source to income_records
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS work_source TEXT;

-- Add work_source to income_yearly_summaries
ALTER TABLE income_yearly_summaries ADD COLUMN IF NOT EXISTS work_source TEXT;
