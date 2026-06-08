-- Công việc chỉ là lịch sử việc làm; thu nhập mới lưu số tiền thực tế.

ALTER TABLE member_jobs DROP COLUMN IF EXISTS monthly_salary;
ALTER TABLE member_jobs DROP COLUMN IF EXISTS salary_by_month;

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES member_jobs(id) ON DELETE SET NULL;

UPDATE income_records
SET job_id = work_id
WHERE job_id IS NULL AND work_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_records_job_id ON income_records(job_id);
