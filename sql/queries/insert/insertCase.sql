INSERT INTO Cases 
(creator_id, subject_id, moderator_id, status, created_at, moderator_notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;