SELECT
    c.case_id,
    c.status,
    c.created_at,
    c.case_link,
    subject.user_id AS subject_id,
    subject.discord_id AS subject_discord_id,
    subject.user_name AS subject_name,
    moderator.user_name AS moderator_name
FROM Cases c
JOIN Users subject ON subject.user_id = c.subject_id
LEFT JOIN Users moderator ON moderator.user_id = c.moderator_id
WHERE UPPER(c.status) = 'OPEN'
ORDER BY c.created_at ASC, c.case_id ASC;
