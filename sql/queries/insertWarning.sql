INSERT INTO Warnings 
(subject_id, moderator_id, reporter_id, timestamp, rules_broken, violating_content, points_added, new_point_total, moderator_notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;