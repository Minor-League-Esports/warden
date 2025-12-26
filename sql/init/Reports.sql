CREATE TABLE IF NOT EXISTS Reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id INT REFERENCES Users(user_id) NOT NULL,
    subject_id INT REFERENCES Users(user_id) NOT NULL,
    moderator_id INT REFERENCES Users(user_id),
    case_id INT REFERENCES Cases(case_id),
    report_timestamp TIMESTAMPTZ NOT NULL,
    acknowledge_timestamp TIMESTAMPTZ,
    close_timestamp TIMESTAMPTZ,
    report_reason TEXT NOT NULL,
    report_evidence TEXT,
    status TEXT NOT NULL,
    moderator_notes TEXT,
    response TEXT
);
