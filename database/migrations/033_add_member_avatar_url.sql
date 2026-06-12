ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

UPDATE members
SET avatar_url = avatar
WHERE (avatar_url IS NULL OR avatar_url = '')
  AND avatar IS NOT NULL
  AND avatar <> '';
