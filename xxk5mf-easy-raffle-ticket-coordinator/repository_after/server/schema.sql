-- Raffle meta: single row (id=1), status OPEN|CLOSED, winning_ticket_id only set after draw
CREATE TABLE IF NOT EXISTS raffle_meta (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  winning_ticket_id INTEGER NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tickets: one row per ticket, user_id for per-user limit
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);

-- Seed single raffle row if not present
INSERT INTO raffle_meta (id, status) VALUES (1, 'OPEN')
ON CONFLICT (id) DO NOTHING;
