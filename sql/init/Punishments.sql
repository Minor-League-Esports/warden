CREATE TABLE IF NOT EXISTS Punishments (
    punishment_id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES Users(user_id) NOT NULL,
    moderator_id INT REFERENCES Users(user_id) NOT NULL,
    case_id INT REFERENCES Cases(case_id),
    warning_id INT REFERENCES Warnings(warning_id),
    timestamp TIMESTAMPTZ NOT NULL,
    punishment_type TEXT NOT NULL,
    punishment_duration INT
);
