-- Create member work history and link income records to a job.

CREATE TABLE IF NOT EXISTS member_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  salary_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_jobs_member_id ON member_jobs(member_id);
CREATE INDEX IF NOT EXISTS idx_member_jobs_status ON member_jobs(status);
CREATE INDEX IF NOT EXISTS idx_member_jobs_dates ON member_jobs(start_date, end_date);

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS work_id UUID REFERENCES member_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_income_records_work_id ON income_records(work_id);
