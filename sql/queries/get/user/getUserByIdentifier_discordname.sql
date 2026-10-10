SELECT *
FROM Users
WHERE UPPER(discord_username) = UPPER($1);
