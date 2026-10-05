# Warden Commands

Warden exposes the following Discord slash commands. Command permissions are the default permissions declared when the
commands are registered; Discord administrators can further restrict them with their server's role settings.

## Availability and permissions

- Unless noted otherwise, commands are guild-only and must be run in the MLE Staff server. Commands that fail the
  staff-server check return an ephemeral error.
- `ModerateMembers` is required for `/manage`, `/history`, `/warn`, `/ineligible`, `/banlist`, `/mute`, and `/unmute`.
- `BanMembers` is required for `/ban`, `/unban`, `/kick`, and `/loadusers`.
- `/report` does not declare a default permission and is intended for members submitting reports. Guild replies are
  ephemeral; direct-message replies are visible to the user.
- User-facing report activity (acknowledgements, replies, closures) is delivered to the reporter by direct message.

## Quick reference

| Command                  | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `/manage case ...`       | Create, inspect, assign, annotate, close, and link records to cases |
| `/manage report ...`     | Inspect, reply to, annotate, close, and link reports                |
| `/manage warning ...`    | Inspect, annotate, and link warnings                                |
| `/manage punishment ...` | Inspect and link punishments                                        |
| `/manage user ...`       | Inspect users, fix their identifiers, and merge duplicate profiles  |
| `/warn`                  | Start the warning workflow for a user                               |
| `/history`               | View a user's cases, reports, warnings, and punishments             |
| `/ban` `/kick` `/mute`   | Direct punishments that bypass the warning workflow                 |
| `/unban` `/unmute`       | Reverse a ban or mute                                               |
| `/banlist`               | List users who are currently banned                                 |
| `/ineligible`            | List users ineligible for staff positions                           |
| `/loadusers`             | Import or update users from the data source                         |
| `/report ...`            | Submit and follow up on your own reports                            |

The former `/case` command has been replaced by `/manage case` and `/manage report`.

## `/manage`

`/manage` is the main tool for managing the full lifecycle of a case and the records connected to it. Every subcommand
belongs to one of five groups. Record IDs are the numbers shown in embeds, for example `Case #12` or `Report #40`.

Subcommands that open a form (`note` and `report reply`) show the form immediately instead of a chat response.

### `/manage case`

#### `create`

Create an open case without an attached report.

```text
/manage case create subject:<user identifier>
```

Warden posts a summary in the case channel, starts a private case thread, and pings the moderator role there. The
subject can be a Discord ID, MLE ID, or username.

#### `details`

Show a case and everything linked to it.

```text
/manage case details case_id:<case number>
```

The response is a case overview with counts of linked reports, warnings, and punishments, plus **View Reports**, **View
Warnings**, and **View Punishments** buttons. Each button opens a paginated view with **Prev**, **Next**, and **Close**
controls. Records are shown newest (highest ID) first, one per page. **Close** deletes the message so long browsing
sessions do not clutter the channel.

Punishments shown for a case include those attached to its warnings.

#### `list`

List cases.

```text
/manage case list [status:<open|closed|all>]
```

The status filter defaults to `open`. Results show the case link, subject, and status, newest first. Long lists are
truncated to fit Discord's message limit.

#### `assign`

Assign a case to a moderator.

```text
/manage case assign case_id:<case number> moderator:<Discord ID, MLE ID, or username>
```

Attached reports are reassigned along with the case, and the case summary is refreshed.

#### `close`

Close a case after confirmation.

```text
/manage case close case_id:<case number>
```

Warden asks the moderator who ran the command to confirm. Confirming closes the case, closes its open reports, notifies
reporters, renames the case thread with a `(C)` prefix, and archives it. Already-closed cases are rejected.

#### `note`

Add an internal moderator note to a case.

```text
/manage case note case_id:<case number>
```

A form opens after Warden confirms the case exists. Notes are timestamped, signed with the moderator's name, and
appended to existing notes. They are never shown to users.

#### `attach`

Attach a report, warning, or punishment to a case.

```text
/manage case attach type:<report|warning|punishment> id:<record number> case_id:<case number>
```

Warden refuses the request when:

- the record or case does not exist,
- the case is closed, or
- the record is about a different user than the case's subject.

A record already attached to another case is moved, and the previous case is refreshed too. Attaching a report also
posts it in the case thread. Case messages are refreshed afterward.

#### `detach`

Detach a record from its case.

```text
/manage case detach type:<report|warning|punishment> id:<record number>
```

The record remains in the database without a case. The case message is refreshed. A report's message in the case thread
is not deleted.

### `/manage report`

#### `details`

Show a report's moderator-facing embed, including its reason, evidence, status, case, and notes.

```text
/manage report details report_id:<report number>
```

#### `list`

List reports.

```text
/manage report list [status:<open|closed|all>]
```

Defaults to `open`. Results show the report link, subject, reporter, and status, newest first.

#### `close`

Close a report after confirmation.

```text
/manage report close report_id:<report number>
```

Closing a report DMs the reporter that the investigation has concluded. Closing a case closes its reports automatically,
so this is only needed to close one report while the case stays open.

#### `note`

Add an internal moderator note to a report.

```text
/manage report note report_id:<report number>
```

#### `reply`

Reply to the reporter.

```text
/manage report reply report_id:<report number>
```

A form opens. The reply is appended to the report as a `(MLE Moderation)` message and sent to the reporter by DM, with a
button they can use to send an update back. Unlike notes, replies are visible to the reporter.

#### `attach` and `detach`

Shortcuts for the case commands above.

```text
/manage report attach report_id:<report number> case_id:<case number>
/manage report detach report_id:<report number>
```

Acknowledging a report is done with the **Acknowledge** button on the report's message in the case thread.

### `/manage warning`

#### `details`

```text
/manage warning details warning_id:<warning number>
```

Shows the full warning, including points, rules broken, violating content, moderator notes, linked punishments, and
case.

#### `list`

```text
/manage warning list user:<name, Discord ID, or MLE ID>
```

Lists a user's warnings, newest first, with date, points, case, and the start of the rules broken.

#### `note`

```text
/manage warning note warning_id:<warning number>
```

Adds an internal moderator note to a warning.

#### `attach` and `detach`

```text
/manage warning attach warning_id:<warning number> case_id:<case number>
/manage warning detach warning_id:<warning number>
```

Same rules as `/manage case attach` and `detach`.

### `/manage punishment`

#### `details`

```text
/manage punishment details punishment_id:<punishment number>
```

#### `list`

```text
/manage punishment list user:<name, Discord ID, or MLE ID>
```

Lists every punishment issued to a user, newest first, including those not tied to a case or warning.

#### `attach` and `detach`

```text
/manage punishment attach punishment_id:<punishment number> case_id:<case number>
/manage punishment detach punishment_id:<punishment number>
```

Use these to bring a direct `/ban`, `/mute`, or `/kick` into a case after the fact.

### `/manage user`

#### `details`

```text
/manage user details user:<name, Discord ID, or MLE ID>
```

Shows the user's profile (username, MLE ID, Discord ID, and Warden ID) followed by the history card described under
`/history`.

#### `set_mle_id`

```text
/manage user set_mle_id user:<user identifier> mle_id:<MLE ID>
```

Rejected if the MLE ID already belongs to a different profile.

#### `set_discord_id`

Use this when a member switches Discord accounts.

```text
/manage user set_discord_id user:<user identifier> discord_id:<new Discord ID>
```

The ID must look like a Discord ID (17 to 20 digits). If another profile already has it, Warden refuses and suggests
`merge`.

#### `set_username`

```text
/manage user set_username user:<user identifier> username:<new username>
```

Rejected if another profile already has that username, since username lookups need to match a single profile.

#### `merge`

Combine a duplicate profile into another.

```text
/manage user merge source:<profile to delete> target:<profile to keep>
```

Warden shows both profiles and asks for confirmation. Only the moderator who ran the command can confirm. Confirming:

- moves the source profile's cases, reports, warnings, and punishments (as subject, reporter, creator, or moderator) to
  the target,
- recalculates the stored point totals on the target's warnings so the merged history is consistent,
- fills in the target's MLE ID from the source if the target has none,
- refreshes the affected case messages, and
- deletes the source profile.

The target keeps its own username, Discord ID, and avatar. The merge runs as a single transaction, so a failure leaves
both profiles untouched. It cannot be undone, so back up the database before the first real merge.

## Moderation commands

### `/warn`

Start the warning workflow for a user.

```text
/warn user:<name, Discord ID, or MLE ID> [case_id:<case number>]
```

When `case_id` is supplied, the case must belong to the selected user and the warning is linked to that case. Without a
case, Warden asks whether you are sure and notes that most warnings should go through a case.

The response is the user's summary (current points, warning count, and case count) with **Warn User** and **View
History**. **Warn User** opens the warning form. See the [moderation workflow](MODERATION_WORKFLOW.md#5-warn-and-punish)
for what happens next.

### `/history`

View a user's complete record.

```text
/history user:<name, Discord ID, or MLE ID>
```

The response is a summary card with current points, warning count, case count, report count, and punishment count. Four
buttons open paginated views: **View Cases**, **View Reports**, **View Warnings**, and **View Punishments**. Each page
shows one record, newest first, with **Prev**, **Next**, and **Close** buttons.

The same card is shown by the **View History** button on user summaries in case threads and `/warn`.

### `/ban`, `/kick`, `/mute`, `/unban`, `/unmute`

Direct punishments that skip the warning workflow.

```text
/ban user:<Discord ID>
/kick user:<Discord ID>
/mute user:<Discord ID> days:<7|14|28>
/unban user:<Discord ID>
/unmute user:<Discord ID>
```

Each command shows the user's record and a confirmation prompt. Confirming records a punishment, applies it across the
configured MLE servers, DMs the user, and logs the result. No warning or points are created, and the punishment is not
attached to a case. `/ban` and `/mute` warn that most actions should go through a case; use `/manage punishment attach`
to link one afterward.

### `/banlist`

List users who are currently banned.

```text
/banlist
```

The result is ephemeral and sorted by username. Long lists are split across multiple embeds.

### `/ineligible`

List users with three or more current points, who are ineligible for staff positions.

```text
/ineligible
```

The ephemeral result is evaluated from current database points, sorted by username, and split across embeds when
necessary.

### `/loadusers`

Load or update users from the configured data source.

```text
/loadusers [fetchavatars:<true|false>]
```

`fetchavatars` defaults to false. Enabling it fetches Discord avatars and can take 30 minutes or more for a large
dataset. The completion summary reports created, updated, unchanged, and failed users. For avatar loads, the summary is
sent through the configured Discord logger instead of the original reply.

## User report commands

Reports are tracked in the same case system moderators use, so there is no separate report queue. See the
[moderation workflow](MODERATION_WORKFLOW.md#1-how-a-report-becomes-a-case) for what happens after submission.

### `/report submit`

Begin a report against another user.

```text
/report submit
```

Warden shows instructions and a **Report User** button that opens the report form. The form takes the person being
reported (MLE username, Discord ID, or MLE ID), the reason, and the evidence. After the form, Warden shows a
confirmation of the report details. Confirming creates the report and files it into a case automatically: a new case, or
the subject's most recent open case. The reporter then receives a confirmation, both in the channel and by DM, with an
**Update Report** button.

### `/report evidence`

Attach evidence files to one of your reports.

```text
/report evidence report_id:<report number> evidence_file:<file> [evidence_file_2:<file>] [evidence_file_3:<file>]
```

One to three files may be attached, each up to 10 MB. Only the report's original submitter can add evidence. The files
are posted as a reply to the report's message in the case thread, so moderators see them next to the case, and the
report records the links.

### `/report update`

Add details to one of your reports.

```text
/report update report_id:<report number>
```

A form opens. The update is added to the report and moderators are notified in the case thread. The **Update Report**
button on report messages does the same thing.

### `/report status`

View the status and details of one of your reports.

```text
/report status report_id:<report number>
```

Only the report's original submitter can view it. The response includes an **Update Report** button. A report's status
moves from open to acknowledged to closed as moderators work it.

### `/report list`

List reports you have submitted.

```text
/report list [status:<all|open|closed>]
```

The status filter defaults to `open`. The list shows report IDs, targets, and statuses, and may be truncated if it
exceeds Discord's message limit.

## Deployment

All command modules in `commands/` are loaded automatically. After changing a command's name, description, options, or
permissions, redeploy the command definitions with one of the existing scripts:

- `node deploy-commands-global.js` registers global commands.
- `node deploy-commands-guild.js` registers commands for the configured guild.

Redeploying replaces the full command set, which also removes commands whose files have been deleted.
