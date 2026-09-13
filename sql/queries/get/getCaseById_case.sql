SELECT 
    c.case_id,
    c.creator_id,
    c.subject_id,
    c.moderator_id,
    c.status,
    c.created_at,
    c.closed_at,
    c.moderator_notes AS notes,
    c.case_link,
    -- Creator
    u_cre.user_id AS cre_id,
    u_cre.discord_id AS cre_discord_id,
    u_cre.discord_avatar AS cre_avatar,
    u_cre.user_name AS cre_name,
    u_cre.mle_id AS cre_mle_id,
    -- Subject
    u_sub.user_id AS sub_id,
    u_sub.discord_id AS sub_discord_id,
    u_sub.discord_avatar AS sub_avatar,
    u_sub.user_name AS sub_name,
    u_sub.mle_id AS sub_mle_id,
    -- Moderator
    u_mod.user_id AS mod_id,
    u_mod.discord_id AS mod_discord_id,
    u_mod.discord_avatar AS mod_avatar,
    u_mod.user_name AS mod_name,
    u_mod.mle_id AS mod_mle_id
FROM Cases c
LEFT JOIN Users u_cre ON u_cre.user_id = c.creator_id
LEFT JOIN Users u_sub ON u_sub.user_id = c.subject_id
LEFT JOIN Users u_mod ON u_mod.user_id = c.moderator_id
WHERE c.case_id = $1
LIMIT 1;
