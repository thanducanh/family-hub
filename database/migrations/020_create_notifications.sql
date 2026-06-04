CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by_name VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visible_user_ids JSONB DEFAULT '[]',
  read_user_ids JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
