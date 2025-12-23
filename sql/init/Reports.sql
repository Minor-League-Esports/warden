CREATE TABLE IF NOT EXISTS Reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id INT REFERENCES Users(user_id) NOT NULL,
    subject_id INT REFERENCES Users(user_id),
    moderator_id INT REFERENCES Users(user_id) NOT NULL,
    case_id INT REFERENCES Cases(case_id),
    report_timestamp TIMESTAMPTZ NOT NULL,
    acknowledge_timestamp TIMESTAMPTZ NOT NULL,
    close_timestamp TIMESTAMPTZ NOT NULL,
    report_reason TEXT NOT NULL,
    report_evidence TEXT,
    report_links TEXT,
    status TEXT NOT NULL,
    moderator_notes TEXT,
    custom_response TEXT
);
