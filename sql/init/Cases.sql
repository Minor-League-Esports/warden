CREATE TABLE IF NOT EXISTS Cases (
    case_id SERIAL PRIMARY KEY,
    creator_id INT REFERENCES Users(user_id),
    subject_id INT REFERENCES Users(user_id),
    moderator_id INT REFERENCES Users(user_id),
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    notes TEXT,
    custom_response TEXT
);
