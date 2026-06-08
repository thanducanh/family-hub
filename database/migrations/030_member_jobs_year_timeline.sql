-- Công việc dùng timeline theo năm, không lưu chức vụ hoặc ngày/tháng.

ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS start_year INTEGER;
ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS end_year INTEGER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_jobs' AND column_name = 'start_date') THEN
    EXECUTE 'UPDATE member_jobs SET start_year = COALESCE(start_year, EXTRACT(YEAR FROM start_date)::INTEGER) WHERE start_date IS NOT NULL';
    EXECUTE 'UPDATE member_jobs SET end_year = CASE WHEN status = ''active'' THEN NULL ELSE COALESCE(end_year, EXTRACT(YEAR FROM end_date)::INTEGER) END';
    
    ALTER TABLE member_jobs DROP COLUMN start_date;
    ALTER TABLE member_jobs DROP COLUMN end_date;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'member_jobs' AND column_name = 'position') THEN
    ALTER TABLE member_jobs DROP COLUMN position;
  END IF;
END $$;

ALTER TABLE member_jobs ALTER COLUMN start_year SET NOT NULL;

DROP INDEX IF EXISTS idx_member_jobs_dates;
CREATE INDEX IF NOT EXISTS idx_member_jobs_years ON member_jobs(start_year, end_year);
