ALTER TABLE income_records ADD COLUMN IF NOT EXISTS income_date DATE;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Khác';
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Đã nhận';
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE income_records
SET income_date = COALESCE(income_date, received_date),
    year = COALESCE(year, EXTRACT(YEAR FROM received_date)::INTEGER),
    month = COALESCE(month, EXTRACT(MONTH FROM received_date)::INTEGER)
WHERE received_date IS NOT NULL;

UPDATE income_records r
SET name = COALESCE(NULLIF(r.name, ''), s.name, 'Khoản thu'),
    category = CASE
      WHEN LOWER(COALESCE(s.name, r.name, '')) LIKE '%thưởng%' THEN 'Thưởng'
      WHEN LOWER(COALESCE(s.name, r.name, '')) LIKE '%tồn%' THEN 'Tồn tháng trước'
      WHEN LOWER(COALESCE(s.name, r.name, '')) LIKE '%bán%' THEN 'Bán đồ'
      WHEN LOWER(COALESCE(s.name, r.name, '')) LIKE '%lương%' THEN 'Lương'
      ELSE COALESCE(NULLIF(r.category, ''), 'Khác')
    END
FROM income_sources s
WHERE r.source_id = s.id;

UPDATE income_records SET name = 'Khoản thu' WHERE name = '';
UPDATE income_records SET income_date = received_date WHERE income_date IS NULL AND received_date IS NOT NULL;
UPDATE income_records SET received_date = income_date WHERE received_date IS NULL AND income_date IS NOT NULL;
UPDATE income_records SET year = EXTRACT(YEAR FROM income_date)::INTEGER WHERE year IS NULL AND income_date IS NOT NULL;
UPDATE income_records SET month = EXTRACT(MONTH FROM income_date)::INTEGER WHERE month IS NULL AND income_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_records_year_month ON income_records(year, month);
CREATE INDEX IF NOT EXISTS idx_income_records_category ON income_records(category);
