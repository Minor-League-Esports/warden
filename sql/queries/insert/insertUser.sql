INSERT INTO Users 
(discord_id, discord_avatar, user_name, mle_id)
VALUES ($1, $2, $3, $4)
RETURNING *;