SELECT 
    u.user_id AS user_id,
    u.discord_id AS discord_id,
    u.discord_avatar AS discord_avatar,
    u.user_name AS user_name,
    u.mle_id AS mle_id
FROM Users u
WHERE UPPER(u.user_name) = UPPER($1);