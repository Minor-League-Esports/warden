SELECT case_id
FROM Cases
WHERE subject_id = $1
ORDER BY created_at DESC, case_id DESC;