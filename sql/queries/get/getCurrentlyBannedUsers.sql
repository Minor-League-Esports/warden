WITH latest_ban AS (
    SELECT subject_id, MAX(timestamp) AS last_ban_at
    FROM Punishments
    WHERE punishment_type = 'ban'
    GROUP BY subject_id
),
latest_unban AS (
    SELECT subject_id, MAX(timestamp) AS last_unban_at
    FROM Punishments
    WHERE punishment_type = 'unban'
    GROUP BY subject_id
),
ban_status AS (
    SELECT u.user_id,
        CASE 
            WHEN lb.last_ban_at IS NOT NULL AND (lu.last_unban_at IS NULL OR lb.last_ban_at > lu.last_unban_at)
                THEN TRUE
            ELSE FALSE
        END AS is_banned
    FROM Users u
    LEFT JOIN latest_ban lb ON lb.subject_id = u.user_id
    LEFT JOIN latest_unban lu ON lu.subject_id = u.user_id
)
SELECT 
    u.user_id AS user_id,
    u.discord_id AS discord_id,
    u.discord_avatar AS discord_avatar,
    u.user_name AS user_name,
    u.mle_id AS mle_id
FROM Users u
JOIN ban_status bs ON bs.user_id = u.user_id
WHERE bs.is_banned = TRUE
ORDER BY u.user_name ASC;
