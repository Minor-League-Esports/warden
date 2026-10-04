SELECT
    r.*,
    -- Reporter
    u_rep.user_id AS u_rep_id,
    u_rep.discord_id AS u_rep_discord_id,
    u_rep.discord_avatar AS u_rep_avatar,
    u_rep.user_name AS u_rep_name,
    u_rep.mle_id AS u_rep_mle_id,
    -- Subject (reported)
    u_user.user_id AS u_user_id,
    u_user.discord_id AS u_user_discord_id,
    u_user.discord_avatar AS u_user_avatar,
    u_user.user_name AS u_user_name,
    u_user.mle_id AS u_user_mle_id,
    -- Moderator
    u_mod.user_id AS u_mod_id,
    u_mod.discord_id AS u_mod_discord_id,
    u_mod.discord_avatar AS u_mod_avatar,
    u_mod.user_name AS u_mod_name,
    u_mod.mle_id AS u_mod_mle_id,
    -- Case
    c.case_id AS c_id,
    c.creator_id AS c_creator_id,
    c.subject_id AS c_subject_id,
    c.moderator_id AS c_moderator_id,
    c.status AS c_status,
    c.created_at AS c_created_at,
    c.closed_at AS c_closed_at,
    c.moderator_notes AS c_moderator_notes,
    c.case_summary_link AS c_case_summary_link,
    c.case_link AS c_case_link,
    c.case_thread_link AS c_case_thread_link
FROM Reports r
LEFT JOIN Users u_rep ON u_rep.user_id = r.reporter_id
LEFT JOIN Users u_user ON u_user.user_id = r.subject_id
LEFT JOIN Users u_mod ON u_mod.user_id = r.moderator_id
LEFT JOIN Cases c ON c.case_id = r.case_id;