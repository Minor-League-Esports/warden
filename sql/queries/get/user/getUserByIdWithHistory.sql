SELECT 
    u.user_id AS user_id,
    u.discord_id AS discord_id,
    u.discord_avatar AS discord_avatar,
    u.user_name AS user_name,
    u.mle_id AS mle_id,
    w.warning_id AS warning_id,
    w.subject_id AS w_subject_id,
    w.timestamp AS timestamp,
    w.points_added AS points_added
FROM Users u
LEFT JOIN Warnings w ON w.subject_id = u.user_id
WHERE u.user_id = $1
ORDER BY w.timestamp DESC NULLS LAST;
