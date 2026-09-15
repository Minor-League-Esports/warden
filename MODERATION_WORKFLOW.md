# Moderation Workflow

This guide describes the standard workflow for handling a new report in Warden. Moderators should keep the report, case,
warning, punishment, and closure records connected so the case history remains auditable.

## Workflow at a glance

1. Review the new report in the report channel.
2. Create a new case or attach the report to an existing case.
3. Claim the case so one moderator owns the investigation.
4. Add notes as the investigation develops.
5. Create a warning when a rules violation is confirmed.
6. Review and execute the recommended punishment, or override it when appropriate.
7. Close the case after all decisions and follow-up work are complete.

## 1. Receive and review a report

New reports appear in the configured report channel with a moderator-facing embed and a discussion thread. The thread
mentions the moderator role and includes the reported subject's moderation summary. The summary shows current points,
warning count, case count, and buttons for opening the subject's detailed history.

Review the following before taking action:

- The reported user's identity and the reporter's identity.
- The reported rule(s), description of the violating content, and submitted evidence.
- Any later updates or evidence added by the reporter.
- Whether the report belongs to an existing investigation for the same user.
- The subject's existing cases, including cases that have no warnings or points associated with them.

The report message provides these moderator controls:

- **Create New Case** starts a new case for the report's subject.
- **Add to Case** opens a form for an existing case number.
- **Add Note** adds an internal note directly to the report.

Attaching a report to a case acknowledges it automatically. Warden updates the report status and sends the reporter an
acknowledgement message. The report message is refreshed with its case link, and the report's original action buttons
are removed.

## 2. Create or attach a case

### Create a new case from a report

Select **Create New Case** on the report message. Warden will:

- Create an open case for the report's subject.
- Attach the report to the case.
- Post and pin a private case summary in the case channel.
- Start a case discussion thread and mention the moderator role.
- Post the report link in the case thread.
- Acknowledge the report and notify the reporter.

The case thread contains the main case controls. If the case channel is not available, the database case may still be
created, but the normal channel thread and links cannot be produced.

The subject summary in the report thread is not limited to warning history. Its case count includes every case matching
the subject, including cases without warnings or punishments.

### Attach a report to an existing case

Select **Add to Case**, enter the case number, and submit the form. Warden checks that both records exist and that the
report and case have the same subject. Reports for a different subject cannot be attached.

The existing case thread is notified, the report is acknowledged, and the report message is updated with the case link.

### Create a case directly

Use the moderator command when there is no report to attach:

```text
/case create subject:<user identifier> [notes:<initial notes>]
```

Use `/case details case_id:<case number>` to inspect the case and `/case list` to find open cases.

## 3. Claim the case

In the case thread, select **Claim Case**. Warden assigns the case to the moderator who clicked the button and reassigns
all attached reports to that moderator. The case summary is refreshed and the button becomes disabled.

A case should have a clear owner before investigation work begins. If work is transferred, claim ownership again through
the supported case-management process rather than relying only on a thread message.

## 4. Add investigation notes

Use **Add Note** in the case thread, or run one of these commands:

```text
/case note case_id:<case number>
/case note report_id:<report number>
```

Provide exactly one target. Notes are internal, required, limited to 4,000 characters per entry, timestamped, and
appended to the existing notes with the moderator's name.

Good notes should record the relevant evidence, decisions, outreach, and follow-up needed by another moderator. Do not
use a user-facing report update for internal deliberation.

## 5. Create a warning

Select **Create Warning** in the case thread, or use:

```text
/warn user:<name, Discord ID, or MLE ID> case_id:<case number>
```

The case warning flow targets the case subject automatically. The standalone command verifies that the supplied case
belongs to the selected user.

The user summary shown before the warning form includes current points, warning count, and case count. Use **View
History** to inspect warning details and matching cases; case lookup is independent of whether the subject has warnings or
current points.

Complete the warning form with:

- **Rule(s) Broken**: the rule references and short explanation.
- **Violating Content**: the content or behavior shown to the user.
- **Points Added**: a non-negative integer.
- **Moderator Notes**: optional internal context.

After submission, Warden calculates the user's current points and displays a warning proposal containing the new total,
probation status, and recommended action. Review every field before confirming.

Current recommendation rules are:

| Situation                                  | Recommended action                       |
| ------------------------------------------ | ---------------------------------------- |
| 0 points added to the current total        | Issue the warning only                   |
| 1 current point                            | Mute for 7 days                          |
| 2 current points                           | Mute for 14 days                         |
| 3 current points                           | Mute for 28 days and suspend for 1 week  |
| 4 current points                           | Mute for 28 days and suspend for 4 weeks |
| 5 or more current points                   | Ban                                      |
| On probation with 3 or more current points | Ban                                      |

These recommendations are generated from the current warning history. Review the case facts and policy before executing
them; the proposal is not a substitute for moderator judgment.

## 6. Create and execute punishments

The warning proposal has three controls:

- **Confirm Recommended Action** creates the warning and all linked punishment records, sends the warning, and executes
  supported punishments.
- **Override Action** lets the moderator enter one or more actions separated by semicolons.
- **Cancel** abandons the proposal without creating the warning.

Valid override values are:

```text
warning
mute=<days>
suspension=<weeks>
ban
```

Multiple actions are separated with semicolons, for example:

```text
mute=28;suspension=1
```

When a warning is confirmed, Warden creates the warning first, then creates the linked punishment records, then attempts
execution. The warning and punishments are linked to the case when the warning was started from a case.

### Punishment safeguards and follow-up

- Ban proposals require a moderator with `BanMembers` permission to approve.
- Ban approval is posted for director review. The director should confirm that League Operations has moved the user to
  FP before selecting **Approve Ban**.
- **Deny Ban** removes the approval request without executing the ban.
- Mutes are executed as Discord timeouts across configured MLE servers.
- Suspensions are recorded but are not automatically executed by Warden; handle them manually through League Operations.
- Warden attempts to DM the user and logs execution results. A failed DM does not necessarily mean the Discord
  punishment failed.

Standalone `/mute`, `/ban`, `/kick`, `/unmute`, and `/unban` commands exist for direct actions, but normal disciplinary
decisions should be recorded through a case and warning whenever possible.

## 7. Close the case

Before closing, confirm that:

- The investigation notes explain the decision.
- Any warning and punishment records are complete.
- Required manual actions, especially suspensions, are finished or clearly handed off.
- All relevant reports are attached to the case.

Select **Close Case** in the case thread or run:

```text
/case close case_id:<case number>
```

Warden asks the moderator who initiated the close request to confirm it. After confirmation, Warden:

- Marks the case closed.
- Closes open reports attached to the case.
- Updates the case and report summaries.
- Notifies the case thread.
- Notifies reporters that the investigation concluded.
- Archives the case and report threads when possible.
- Disables the case action buttons.

Closing is a final workflow state. If additional information arrives later, add it to the appropriate record and follow
the team's escalation process instead of silently treating a closed case as open.

## Useful commands

```text
/case list
/case details case_id:<case number>
/history user:<name, Discord ID, or MLE ID>
/report status report_id:<report number>
/report evidence report_id:<report number> evidence_file:<file>
```
