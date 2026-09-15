# Warden Commands

Warden exposes the following Discord slash commands. Command permissions are the default permissions declared when the
commands are registered; Discord administrators can further restrict them with their server's role settings.

## Availability and permissions

- Unless noted otherwise, commands are guild-only and must be run in the MLE Staff server.
- Commands that fail the staff-server check return an ephemeral error.
- `ModerateMembers` is required for case, history, ineligible, kick, mute, unmute, warn, and banlist commands.
- `BanMembers` is required for ban, unban, and loadusers commands.
- `/report` does not declare a default permission and is intended for members submitting reports. Guild replies are
  ephemeral; direct-message replies are public to the user.

## Moderation commands

### `/ban`

Ban a user without first creating a case.

```text
/ban user:<Discord ID>
```

The command displays the user's database record and a confirmation prompt. Select **Ban User** to continue or **Cancel**
to stop. The prompt warns that most bans should be handled through a case.

### `/banlist`

List users who are currently banned.

```text
/banlist
```

The result is ephemeral and sorted by username. Long lists are split across multiple embeds.

### `/case`

Create and manage moderation cases. Each operation is a subcommand:

#### `/case create`

Create an open case without an attached report.

```text
/case create subject:<user identifier> [notes:<initial notes>]
```

The subject can be resolved using the bot's supported user identifiers. When configured, Warden also posts and pins the
case in the case channel and starts a moderator thread.

#### `/case details`

Show a case and its linked reports, warnings, and punishments.

```text
/case details case_id:<case number>
```

The response includes a case overview followed by the linked records.

#### `/case list`

List all open cases.

```text
/case list
```

The list includes the case link, subject, assigned moderator, and opening date.

#### `/case assign`

Assign a case to a moderator.

```text
/case assign case_id:<case number> moderator:<Discord ID, MLE ID, or username>
```

Attached reports are reassigned along with the case.

#### `/case close`

Request to close a case.

```text
/case close case_id:<case number>
```

Warden asks for confirmation before closing the case. Closing a case also closes its open reports.

#### `/case note`

Add a moderator note to either a case or a report.

```text
/case note case_id:<case number>
/case note report_id:<report number>
```

Provide exactly one of `case_id` or `report_id`. Warden opens a note modal after validating that the target exists.

### `/history`

View a user's moderation summary and warning history.

```text
/history user:<name, Discord ID, or MLE ID>
```

The summary includes current points, warning count, and case count. The response includes a **View History** button for
the user's detailed warning history. It also checks for cases independently of warnings, so cases are shown even when
the user has no warnings or current points. Matching case summaries are sent in additional messages when needed. The
update-user button currently displays as unimplemented.

### `/ineligible`

List users currently ineligible for staff positions because they have three or more points.

```text
/ineligible
```

The ephemeral result is evaluated from current database points, sorted by username, and split across embeds when
necessary.

### `/kick`

Kick a user from the server.

```text
/kick user:<Discord ID>
```

The command displays a confirmation prompt. Select **Kick User** to continue or **Cancel** to stop.

### `/loadusers`

Load or update users from the configured data source.

```text
/loadusers [fetchavatars:<true|false>]
```

The optional `fetchavatars` option defaults to false. Enabling it fetches Discord avatars and can take 30 minutes or
more for a large dataset. The completion summary reports created, updated, unchanged, and failed users. For avatar
loads, the summary is sent through the configured Discord logger rather than edited into the original interaction reply.

### `/mute`

Mute a user for a supported duration without first creating a case.

```text
/mute user:<Discord ID> days:<7|14|28>
```

The command displays a confirmation prompt with the selected duration. Select **Mute User** to continue or **Cancel** to
stop. Most mutes should be handled through a case.

### `/unban`

Remove a user's ban.

```text
/unban user:<Discord ID>
```

The command displays a confirmation prompt. Select **Unban User** to continue or **Cancel** to stop.

### `/unmute`

Remove a user's mute.

```text
/unmute user:<Discord ID>
```

The command displays a confirmation prompt. Select **Unmute User** to continue or **Cancel** to stop.

### `/warn`

Start the warning workflow for a user.

```text
/warn user:<name, Discord ID, or MLE ID> [case_id:<case number>]
```

When `case_id` is supplied, the case must belong to the selected user and the warning is associated with that case.
Without a case, Warden asks for confirmation and warns that most warnings should be handled through a case. The
follow-up controls allow the moderator to confirm the warning or view the user's history. Warning details are completed
in a modal. The displayed user summary includes current points, warning count, and case count.

## User report commands

### `/report submit`

Begin a report against another user.

```text
/report submit
```

Warden displays instructions and a **Report User** button. The button opens the report form, which accepts a target by
MLE username, Discord ID, or MLE ID and collects the report details. After submission, the moderator report thread also
contains the subject's moderation summary, including current points, warning count, case count, and the **View History**
button.

### `/report evidence`

Attach evidence to one of your existing reports.

```text
/report evidence report_id:<report number> evidence_file:<file> [evidence_file_2:<file>] [evidence_file_3:<file>]
```

One to three files may be attached. Each file is limited to 10 MB. Only the report's original submitter can add
evidence. Warden stores the files in the configured evidence channel and updates the report shown to moderators.

### `/report status`

View the status and details of one of your reports.

```text
/report status report_id:<report number>
```

Only the report's original submitter can view it through this command. The response includes an **Update Report**
button.

### `/report list`

List reports submitted by the current user.

```text
/report list [status:<all|open|closed>]
```

The status filter defaults to `all`. The response includes report IDs, targets, and current statuses, and may be
truncated if it exceeds Discord's message limit.

## Deployment

All command modules in `commands/` are loaded automatically. After changing a command's name, description, options, or
permissions, redeploy the command definitions with one of the existing scripts:

- `node deploy-commands-global.js` registers global commands.
- `node deploy-commands-guild.js` registers commands for the configured guild.
