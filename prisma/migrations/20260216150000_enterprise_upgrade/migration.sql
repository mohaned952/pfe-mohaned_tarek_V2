-- Status hardening (kept string for SQLite compatibility)
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE TABLE IF NOT EXISTS test_suites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  year TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default Suite',
  definition_json TEXT NOT NULL,
  teacher_id INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_name, year)
);

CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL,
  language TEXT,
  function_name TEXT,
  passed BOOLEAN NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 1,
  score_earned REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_results_submission_id ON test_results(submission_id);
