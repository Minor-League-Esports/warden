CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    discord_avatar TEXT,
    user_name TEXT NOT NULL,
    mle_id TEXT
);
