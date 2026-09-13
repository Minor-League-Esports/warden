SELECT *
FROM Users
WHERE UPPER(user_name) = UPPER($1);