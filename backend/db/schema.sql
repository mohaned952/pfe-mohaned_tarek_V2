-- Database Schema for PFE Platform

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    year TEXT NOT NULL,
    password TEXT NOT NULL,
    teacher_id INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

-- Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    teacher_id INTEGER,
    repo_url TEXT NOT NULL,
    submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending, waiting_instructions, processing, completed, approved
    computed_grade REAL,
    evaluation_notes TEXT,
    teacher_feedback TEXT,
    correction_context TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Grading Criteria (Barem) Table
CREATE TABLE IF NOT EXISTS grading_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    year TEXT NOT NULL,
    criteria_json TEXT NOT NULL, -- JSON string containing the barem
    teacher_id INTEGER,
    UNIQUE(group_name, year),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Test Suites per group/year
CREATE TABLE IF NOT EXISTS test_suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    year TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default Suite',
    definition_json TEXT NOT NULL,
    teacher_id INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_name, year),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Test execution results per submission
CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    test_name TEXT NOT NULL,
    test_type TEXT NOT NULL,
    language TEXT,
    function_name TEXT,
    passed INTEGER NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 1,
    score_earned REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_results_submission_id ON test_results(submission_id);

-- Prevent manual grade override during approval transitions.
CREATE TRIGGER IF NOT EXISTS protect_computed_grade_on_approval
BEFORE UPDATE OF computed_grade ON submissions
FOR EACH ROW
WHEN NEW.status = 'approved' AND NEW.computed_grade IS NOT OLD.computed_grade
BEGIN
  SELECT RAISE(ABORT, 'computed_grade cannot be modified during approval');
END;
