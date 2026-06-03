CREATE TABLE IF NOT EXISTS calendar_users (
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL DEFAULT 'view',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (calendar_id, user_id)
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS label_color VARCHAR(32);

INSERT INTO calendar_users (calendar_id, user_id, permission)
SELECT id, owner_user_id, 'edit' FROM calendars WHERE owner_user_id IS NOT NULL
ON CONFLICT (calendar_id, user_id) DO UPDATE SET permission = 'edit';
