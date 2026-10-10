SELECT *
FROM Users
WHERE UPPER(alternate_identifier) = UPPER($1);
