-- Add computed grade field and backfill from legacy grade values.
ALTER TABLE "submissions" ADD COLUMN "computed_grade" REAL;

UPDATE "submissions"
SET "computed_grade" = COALESCE("computed_grade", "grade");

CREATE TRIGGER IF NOT EXISTS protect_computed_grade_on_approval
BEFORE UPDATE OF computed_grade ON submissions
FOR EACH ROW
WHEN NEW.status = 'approved' AND NEW.computed_grade IS NOT OLD.computed_grade
BEGIN
  SELECT RAISE(ABORT, 'computed_grade cannot be modified during approval');
END;
