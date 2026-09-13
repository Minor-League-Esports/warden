CREATE INDEX IF NOT EXISTS idx_reports_case_id ON Reports(case_id);
CREATE INDEX IF NOT EXISTS idx_warnings_case_id ON Warnings(case_id);
CREATE INDEX IF NOT EXISTS idx_punishments_case_id ON Punishments(case_id);
