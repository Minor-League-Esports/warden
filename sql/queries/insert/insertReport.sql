INSERT INTO Reports
(subject_id, reporter_id, report_timestamp, report_reason, report_evidence, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;