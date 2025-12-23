INSERT INTO Punishments
(subject_id, moderator_id, timestamp, punishment_type, punishment_duration)
VALUES ($1, $2, $3, $4, $5)
RETURNING punishment_id;