ALTER TABLE bank_raw_notes
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_json JSONB;
