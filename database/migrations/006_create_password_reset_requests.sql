CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username_or_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_reset_requests_pending_idx
  ON password_reset_requests (status, requested_at DESC);
