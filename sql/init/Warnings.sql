CREATE TABLE IF NOT EXISTS Warnings (
    warning_id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES Users(user_id) NOT NULL,
    moderator_id INT REFERENCES Users(user_id) NOT NULL,
    case_id INT REFERENCES Cases(case_id),
    timestamp TIMESTAMPTZ NOT NULL,
    rules_broken TEXT NOT NULL,
    violating_content TEXT NOT NULL,
    points_added INT NOT NULL,
    new_point_total INT NOT NULL,
    moderator_notes TEXT
);
