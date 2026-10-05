# Moderation Workflow

This guide describes the standard workflow for handling reports in Warden. Moderators should keep the report, case,
warning, punishment, and closure records connected so the case history remains auditable.

## Workflow at a glance

1. A member submits a report. Warden files it into a case automatically.
2. Claim the case so one moderator owns the investigation.
3. Review the report, acknowledge it, and communicate with the reporter as needed.
4. Add notes as the investigation develops.
5. Create a warning when a rules violation is confirmed.
6. Review and execute the recommended punishment, or override it when appropriate.
7. Correct or reorganize records with `/manage` if anything was filed in the wrong place.
8. Close the case after all decisions and follow-up work are complete.

## 1. How a report becomes a case

There is no separate staging area for reports. When a member confirms a report, Warden immediately:

- Creates the report with status **Open**.
- Looks for open cases on the reported user. If one exists, the report is attached to the most recently created open
  case. Otherwise Warden creates a new case, with Warden itself recorded as the creator.
- Posts the report in the case's private thread, pinned, with the moderator role mentioned.
- Confirms to the reporter in the channel and by DM.

For a new case, Warden also:

- Posts a summary message in the case channel, which it keeps up to date as the case changes.
- Starts a private thread named `Case #<number> (<username>)` in the case channel.
- Posts and pins the full case message in the thread with the case controls.
- Posts the subject's moderation summary (current points, warning count, and case count) with a **View History** button.

Reporters never see the case or its thread. Everything about the investigation happens in the case thread. Cases can
also be created directly with `/manage case create` when there is no report.

## 2. What is in a case thread

The case thread has three kinds of messages:

- **The case message** with the controls **Claim Case**, **Create Warning**, **Add Note**, and **Close Case**.
- **One message per report**, each pinned, with **Acknowledge**, **Add Note**, **Reply**, and **Close Report**. Evidence
  uploads and report updates from the reporter appear as replies to the report's message.
- **The subject summary**, with **Warn User** and **View History**.

Before acting, review:

- The reported user's identity and the reporter's identity.
- The reported rule(s), the description of the violating content, and the submitted evidence.
- Any updates or evidence the reporter added later.
- Whether other open or past cases involve the same user. **View History** shows every case, including cases with no
  warnings or points.

## 3. Claim the case

Select **Claim Case**. Warden assigns the case to you, reassigns all attached reports to you, refreshes the case
summary, and disables the button. A case should have a clear owner before investigation work begins.

To transfer a case, use:

```text
/manage case assign case_id:<case number> moderator:<identifier>
```

## 4. Work the reports

### Acknowledge

Select **Acknowledge** on a report message to mark it acknowledged. Warden DMs the reporter that a moderator has begun
reviewing it. Acknowledgement is not automatic and is not required before closing.

### Communicate with the reporter

Select **Reply** (or use `/manage report reply`) to send a message to the reporter. The reply is appended to the report
as a `(MLE Moderation)` message and sent by DM. Replies are visible to the reporter, so do not use them for internal
discussion.

Reporters can respond with `/report update`, or the **Update Report** button. They can add files with
`/report evidence`. Both show up in the case thread automatically.

### Add notes

Use **Add Note** on the case or a report, or:

```text
/manage case note case_id:<case number>
/manage report note report_id:<report number>
/manage warning note warning_id:<warning number>
```

Notes are internal, timestamped, signed with the moderator's name, and appended to existing notes. Good notes record the
evidence reviewed, decisions, outreach, and follow-up needed by another moderator.

### Close a report early

A report can be closed on its own with **Close Report** or `/manage report close` while the case stays open. Warden asks
for confirmation and DMs the reporter that the investigation concluded. Closing the case closes any remaining open
reports for you.

## 5. Warn and punish

Select **Create Warning** on the case, or use:

```text
/warn user:<name, Discord ID, or MLE ID> case_id:<case number>
```

The case button targets the case's subject automatically. The command checks that the case belongs to the selected user.
Without a case, `/warn` asks you to confirm because most warnings should go through a case.

Complete the warning form:

- **Rule(s) Broken**: the rule references and a short explanation.
- **Violating Content**: the content or behavior shown to the user.
- **Points Added**: a non-negative integer.
- **Moderator Notes**: optional internal context.

Warden then shows a warning proposal with the new point total, probation status, and a recommended action. Review every
field before confirming.

### Recommended actions

Warden adds the new points to the user's current points (points decay over time) and picks an action:

| Situation                          | Recommended action                       |
| ---------------------------------- | ---------------------------------------- |
| 0 total points                     | Issue the warning only                   |
| 1 point                            | Mute for 7 days                          |
| 2 points                           | Mute for 14 days                         |
| 3 points                           | Mute for 28 days and suspend for 1 week  |
| 4 points                           | Mute for 28 days and suspend for 4 weeks |
| 5 or more points                   | Ban                                      |
| On probation with 3 or more points | Ban                                      |

A member is on probation if they joined the main server fewer than 90 days ago. If Warden cannot find the member there,
probation shows as unknown and is treated as not on probation, so check manually.

These recommendations are a starting point, not a substitute for moderator judgment.

### Proposal controls

- **Confirm Recommended Action** creates the warning and linked punishment records, DMs the user, and executes the
  punishments.
- **Override Action** opens a form where you enter one or more actions separated by semicolons.
- **Cancel** abandons the proposal without creating anything.

Valid override values:

```text
warning
mute=<days>
suspension=<weeks>
ban
```

For example, `mute=28;suspension=1`. The warning and punishments are linked to the case when the warning was started
from a case.

### What execution does

- The warning is created first, then the linked punishment records, then execution is attempted.
- Mutes are applied as Discord timeouts across the configured MLE servers.
- **Suspensions are recorded but not executed by Warden.** Handle them manually through League Operations. Warden
  reminds you when a suspension is part of the action.
- Warden DMs the user and logs the result to the case log channel. A failed DM does not mean the punishment failed.

### Bans need approval

A recommended or overridden ban is not executed immediately:

1. Warden posts the proposal with the director role mentioned and **Approve Ban** and **Deny Ban** buttons.
2. Before approving, the director should confirm that League Operations has moved the user to FP.
3. **Approve Ban** requires the `BanMembers` permission and executes the ban. **Deny Ban** discards the request.

### Direct punishments

`/ban`, `/kick`, `/mute`, `/unban`, and `/unmute` act directly without a warning, points, or a case. Normal disciplinary
decisions should go through a case and warning so the history stays complete. If you did use a direct punishment, link
it afterward:

```text
/manage punishment attach punishment_id:<number> case_id:<case number>
```

## 6. Inspect the history

```text
/history user:<name, Discord ID, or MLE ID>
/manage case details case_id:<case number>
```

`/history` shows a summary card with buttons for the user's cases, reports, warnings, and punishments.
`/manage case details` shows a case's own reports, warnings, and punishments. Both open paginated views, newest first,
one record per page. Use **Prev** and **Next** to move and **Close** to delete the message when you are done.

## 7. Fix and reorganize records

Mistakes happen, such as a report filed under the wrong case or a member who switched accounts. Use `/manage`:

| Situation                            | Command                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| Record is on the wrong case          | `/manage case attach` to move it, or `/manage <record> attach` |
| Record should not belong to any case | `/manage case detach` or `/manage <record> detach`             |
| Member switched Discord accounts     | `/manage user set_discord_id`                                  |
| Username changed                     | `/manage user set_username`                                    |
| Missing or wrong MLE ID              | `/manage user set_mle_id`                                      |
| Same person has two profiles         | `/manage user merge`                                           |

Attaching refuses to cross users or touch closed cases: the record and case must have the same subject, and the case
must be open. If you move a record, both cases are refreshed.

A merge moves everything from one profile to another and deletes the old profile. It cannot be undone, and Warden asks
for confirmation first. If two profiles exist because someone switched accounts, prefer `set_discord_id` on the original
profile when the new ID is not already in use, and merge only when both profiles already exist.

## 8. Close the case

Before closing, confirm that:

- The investigation notes explain the decision.
- Any warning and punishment records are complete.
- Required manual actions, especially suspensions, are finished or clearly handed off.
- All relevant reports are attached to the case.

Select **Close Case** or run:

```text
/manage case close case_id:<case number>
```

Warden asks the moderator who started the request to confirm. After confirmation, Warden:

- Marks the case closed.
- Closes open reports attached to the case and DMs each reporter that the investigation concluded.
- Updates the case and report messages and disables the case buttons.
- Posts a closing message in the case thread, renames it with a `(C)` prefix, and archives it.

Closing is a final workflow state. A closed case cannot receive new attachments. If new information arrives later, a new
report will open a fresh case, since only open cases are reused. Add other follow-up to the appropriate record, or
create a new case, and follow the team's escalation process rather than treating a closed case as open.

## Configuration this workflow depends on

These values come from `config.json` (see `example/config_example.json`):

- `opsGuild`: the staff server where moderation commands may be used.
- `moderatorRoleId` and `directorRoleId`: mentioned on new cases and ban approvals.
- `caseChannelId`: where case summaries and private case threads are created.
- `caseLogChannelId`: where warnings and punishments are logged.
- `opsLogChannelId`: where operational errors and startup messages are logged.
- `mainGuild`: the server used to determine probation.
- `guildList`: the servers where mutes, bans, and kicks are applied.

## Useful commands

```text
/manage case list
/manage case details case_id:<case number>
/manage report list
/history user:<name, Discord ID, or MLE ID>
/warn user:<name, Discord ID, or MLE ID> case_id:<case number>
```
