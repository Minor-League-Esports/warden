SELECT 
    r.report_id,
    r.reporter_id,
    r.subject_id,
    r.moderator_id,
    r.case_id,
    r.report_timestamp,
    r.acknowledge_timestamp,
    r.close_timestamp,
    r.report_reason,
    r.report_evidence,
    r.status,
    r.moderator_notes,
    r.response,
    r.report_link,
    -- Reporter
    u_rep.user_id AS u_rep_id,
    u_rep.discord_id AS u_rep_discord_id,
    u_rep.discord_avatar AS u_rep_avatar,
    u_rep.discord_username AS u_rep_discord_username,
    u_rep.alternate_identifier AS u_rep_alternate_identifier,
    u_rep.user_name AS u_rep_name,
    u_rep.mle_id AS u_rep_mle_id,
    -- Subject (reported)
    u_user.user_id AS u_user_id,
    u_user.discord_id AS u_user_discord_id,
    u_user.discord_avatar AS u_user_avatar,
    u_user.discord_username AS u_user_discord_username,
    u_user.alternate_identifier AS u_user_alternate_identifier,
    u_user.user_name AS u_user_name,
    u_user.mle_id AS u_user_mle_id,
    -- Moderator
    u_mod.user_id AS u_mod_id,
    u_mod.discord_id AS u_mod_discord_id,
    u_mod.discord_avatar AS u_mod_avatar,
    u_mod.discord_username AS u_mod_discord_username,
    u_mod.alternate_identifier AS u_mod_alternate_identifier,
    u_mod.user_name AS u_mod_name,
    u_mod.mle_id AS u_mod_mle_id
FROM Reports r
LEFT JOIN Users u_rep ON u_rep.user_id = r.reporter_id
LEFT JOIN Users u_user ON u_user.user_id = r.subject_id
LEFT JOIN Users u_mod ON u_mod.user_id = r.moderator_id
WHERE r.case_id = $1
ORDER BY r.report_timestamp ASC;
