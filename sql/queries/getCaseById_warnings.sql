SELECT 
    w.warning_id,
    w.subject_id,
    w.moderator_id,
    w.reporter_id,
    w.timestamp,
    w.rules_broken,
    w.violating_content,
    w.points_added,
    w.new_point_total,
    w.moderator_notes,
    -- Target user (warned)
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
    -- Reporter (nullable)
    u_rep.user_id AS u_rep_id,
    u_rep.discord_id AS u_rep_discord_id,
    u_rep.discord_avatar AS u_rep_avatar,
    u_rep.user_name AS u_rep_name,
    u_rep.mle_id AS u_rep_mle_id
FROM Warnings w
LEFT JOIN Users u_user ON u_user.user_id = w.subject_id
LEFT JOIN Users u_mod ON u_mod.user_id = w.moderator_id
LEFT JOIN Users u_rep ON u_rep.user_id = w.reporter_id
WHERE w.case_id = $1
ORDER BY w.timestamp DESC;
