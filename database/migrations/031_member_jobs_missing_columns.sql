ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS start_year integer;
ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS end_year integer;
ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active';
ALTER TABLE member_jobs ADD COLUMN IF NOT EXISTS note text;
