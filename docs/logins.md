# Logins — local development and trial

**Local/trial credentials only.** These accounts are created by
`supabase/seed.sql` against the LOCAL database. Production accounts will be
created individually by an admin at deployment with real passwords — this
file never applies to the office server.

Password for every account below: **`planner-dev`**

| Person | Email | Role | Notes |
|---|---|---|---|
| Andrew Turner | andrew@tic-direct.com | admin | full access incl. corrections + Clockings |
| Liam Chisholm | liam@tic-direct.com | admin | full access incl. corrections + Clockings |
| Sophie Clark | sophie@tic-direct.com | commercial | registers, board, reports — no user mgmt or corrections |
| Workshop Kiosk | kiosk@tic-direct.com | workshop | the shared shopfloor PC — sign in once at `/shopfloor`; worker identity comes from the on-screen name tap, never this login |
| Richard Whalley | richard@tic-direct.com | viewer | read-only everything |

Workers without logins (clock via the kiosk): Kai Truscott, Dave Atkinson,
Lewis Cuthbert.

Public signup is disabled — new users are admin-created. To add a trial
user locally, add them to `supabase/seed.sql` (or insert via Studio) and
give them a profile row with the right role.
