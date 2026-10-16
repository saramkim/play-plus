-- Read state shares the feedback row's existing 90-day deletion lifecycle.
ALTER TABLE feedback ADD COLUMN read_at TEXT;
