CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    discord_id TEXT UNIQUE,
    discord_avatar TEXT,
    user_name TEXT NOT NULL,
    discord_username TEXT,
    alternate_identifier TEXT,
    mle_id TEXT
);
