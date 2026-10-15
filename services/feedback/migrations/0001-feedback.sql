CREATE TABLE feedback (
  request_id TEXT PRIMARY KEY NOT NULL,
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
  extension_version TEXT NOT NULL CHECK(length(extension_version) BETWEEN 1 AND 32),
  received_at TEXT NOT NULL
);
CREATE INDEX feedback_received_at ON feedback(received_at);
