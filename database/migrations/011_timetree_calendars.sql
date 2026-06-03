-- Lịch nhiều lớp kiểu TimeTree. Chỉ bổ sung schema và giữ nguyên dữ liệu cũ.
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  color VARCHAR(32) NOT NULL DEFAULT '#6366f1',
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  type VARCHAR(32) NOT NULL DEFAULT 'other',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO calendars (id, name, color, owner_user_id, visible, type)
SELECT '00000000-0000-4000-8000-00000000ca11', 'Lịch gia đình', '#6366f1', id, TRUE, 'family'
FROM users
ORDER BY is_system DESC, created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS repeat_rule TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lunar_date TEXT;

UPDATE events
SET calendar_id = '00000000-0000-4000-8000-00000000ca11'
WHERE calendar_id IS NULL
  AND EXISTS (SELECT 1 FROM calendars WHERE id = '00000000-0000-4000-8000-00000000ca11');
UPDATE events SET start_date = COALESCE(date, event_date::date) WHERE start_date IS NULL;
UPDATE events SET end_date = COALESCE(date, event_date::date) WHERE end_date IS NULL;
UPDATE events SET start_time = COALESCE(time, event_date::time) WHERE start_time IS NULL;

CREATE TABLE IF NOT EXISTS event_members (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, member_id)
);

INSERT INTO event_members (event_id, member_id)
SELECT id, member_id FROM events WHERE member_id IS NOT NULL
ON CONFLICT DO NOTHING;
