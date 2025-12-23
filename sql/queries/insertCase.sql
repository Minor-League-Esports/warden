INSERT INTO Cases (creator_id, subject_id, moderator_id, status, created_at, closed_at, notes, custom_response)
VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
RETURNING *;