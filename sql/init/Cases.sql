CREATE TABLE IF NOT EXISTS Cases (
    case_id SERIAL PRIMARY KEY,
    creator_id INT REFERENCES Users(user_id) NOT NULL,
    subject_id INT REFERENCES Users(user_id) NOT NULL,
    moderator_id INT REFERENCES Users(user_id),
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    moderator_notes TEXT
);
