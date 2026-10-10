INSERT INTO Users 
(discord_id, discord_avatar, user_name, mle_id, discord_username, alternate_identifier)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;