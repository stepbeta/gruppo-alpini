-- Initial migration for connection verification
CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial sample record
INSERT INTO tests (message)
VALUES ('Hello from version-controlled Supabase migrations & Next.js! 🎉');
