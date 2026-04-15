# Mystery Box Game - Admin Handoff

This document is the admin-focused handoff for the repository. It is intended to let another AI or developer understand the admin system, the API surface, and how the game/admin flow fits together without reading the entire repo first.

## 1) What This Repo Is
- A mobile-first Next.js + Supabase game platform.
- Players progress through Round 1 mystery boxes and Round 2 code/pair-battle logic.
- Admins manage rounds, teams, elimination, scoring, validation, and Pair Battle setup.
- The UI is styled like a premium event/game app with cinematic transitions and sound.

## 2) High-Level Admin Architecture
Admin is split into three layers:
- Admin UI: [src/app/admin/page.tsx](src/app/admin/page.tsx)
- Admin API auth helper: [src/app/api/admin/_auth.ts](src/app/api/admin/_auth.ts)
- Admin API routes: [src/app/api/admin/**](src/app/api/admin)

The admin page is a client page that:
- verifies the admin unlock cookie via `/api/admin/session`,
- redirects to `/admin-entry` if admin unlock is missing,
- optionally forwards a Supabase bearer token when a user session exists,
- calls admin routes guarded by the admin password cookie,
- refreshes views via fetch + Supabase realtime subscriptions.

## 3) Admin Authentication Model
Admin auth is currently not a full RBAC system.
- Admin API access is password-cookie based.
- Admin unlock is handled by [src/app/api/admin/session/route.ts](src/app/api/admin/session/route.ts):
	- `POST` validates admin password and sets `mb_admin_session` (httpOnly cookie)
	- `GET` returns `{ unlocked, configured }`
	- `DELETE` clears unlock cookie
- [src/app/api/admin/_auth.ts](src/app/api/admin/_auth.ts) enforces admin password configuration + valid unlock cookie on admin routes.
- Supabase browser auth can still exist in parallel, but it is no longer a hard requirement to enter `/admin`.

Important behavior:
- Do not assume a hidden role system exists unless you add it.
- Treat admin routes as privileged server mutations gated by admin password cookie.

## 4) Admin UI File Map
Primary admin page:
- [src/app/admin/page.tsx](src/app/admin/page.tsx)

Supporting admin-ish UI:
- [src/app/components/pair-battle-board.tsx](src/app/components/pair-battle-board.tsx)
- [src/app/admin-entry/page.tsx](src/app/admin-entry/page.tsx)
- [src/app/admin-entry/admin-entry-form.tsx](src/app/admin-entry/admin-entry-form.tsx) if present in older refs; the current repo has replaced parts of this flow.

Shared layout / config:
- [src/app/layout.tsx](src/app/layout.tsx)
- [src/app/nav-links.tsx](src/app/nav-links.tsx)
- [src/app/globals.css](src/app/globals.css)

## 5) Admin Page Responsibilities
[src/app/admin/page.tsx](src/app/admin/page.tsx) is the command center.
It handles:
- round control,
- team management,
- score updates,
- elimination application,
- live event logs,
- leaderboard snapshots,
- Pair Battle board mounting.

State tracked on the page includes:
- `rounds`
- `teams`
- `leaderboard`
- `membersCache`
- `statusMessage`
- `refreshing`
- `selectedRoundNumber`
- `nowTime`
- `leaderboardStatus`
- `leaderboardRefreshing`
- `actionBusy`
- `eventLogs`
- `expandedTeamLogs`

Admin page behavior:
- loads all data on mount,
- auto-refreshes from Supabase realtime channels,
- keeps live team/member caches,
- shows grouped team event logs,
- renders the Pair Battle board for the selected round.

## 6) Admin Page Flow
The admin dashboard is built around a simple control loop:
1. Verify admin unlock cookie exists via `/api/admin/session`.
2. Fetch rounds, teams, leaderboard, and event logs.
3. Subscribe to realtime updates.
4. Render controls for selected round and teams.
5. Trigger API mutations.
6. Refresh data after each mutation.

Round selection rules in the page:
- The page derives `activeRoundNumber` from round status.
- `availableRounds` depends on previous rounds ending.
- `selectedRound` is the selected active/available round.
- If a selected round becomes unavailable, the UI auto-switches to the first available round.

## 7) Admin API Route Inventory
Current admin routes:
- [src/app/api/admin/auth/link/route.ts](src/app/api/admin/auth/link/route.ts)
- [src/app/api/admin/boxes/lock/route.ts](src/app/api/admin/boxes/lock/route.ts)
- [src/app/api/admin/boxes/update/route.ts](src/app/api/admin/boxes/update/route.ts)
- [src/app/api/admin/elimination/apply/route.ts](src/app/api/admin/elimination/apply/route.ts)
- [src/app/api/admin/events/route.ts](src/app/api/admin/events/route.ts)
- [src/app/api/admin/games/health/route.ts](src/app/api/admin/games/health/route.ts)
- [src/app/api/admin/games/list/route.ts](src/app/api/admin/games/list/route.ts)
- [src/app/api/admin/games/update/route.ts](src/app/api/admin/games/update/route.ts)
- [src/app/api/admin/pair-battle/assign/route.ts](src/app/api/admin/pair-battle/assign/route.ts)
- [src/app/api/admin/pair-battle/code/route.ts](src/app/api/admin/pair-battle/code/route.ts)
- [src/app/api/admin/pair-battle/demo-seed/route.ts](src/app/api/admin/pair-battle/demo-seed/route.ts)
- [src/app/api/admin/pair-battle/qualified-teams/route.ts](src/app/api/admin/pair-battle/qualified-teams/route.ts)
- [src/app/api/admin/pair-battle/reset/route.ts](src/app/api/admin/pair-battle/reset/route.ts)
- [src/app/api/admin/pair-battle/setup/route.ts](src/app/api/admin/pair-battle/setup/route.ts)
- [src/app/api/admin/pair-battle/start/route.ts](src/app/api/admin/pair-battle/start/route.ts)
- [src/app/api/admin/pair-battle/status/route.ts](src/app/api/admin/pair-battle/status/route.ts)
- [src/app/api/admin/round2/code/route.ts](src/app/api/admin/round2/code/route.ts)
- [src/app/api/admin/rounds/list/route.ts](src/app/api/admin/rounds/list/route.ts)
- [src/app/api/admin/rounds/update/route.ts](src/app/api/admin/rounds/update/route.ts)
- [src/app/api/admin/scores/update/route.ts](src/app/api/admin/scores/update/route.ts)
- [src/app/api/admin/session/route.ts](src/app/api/admin/session/route.ts)
- [src/app/api/admin/submissions/route.ts](src/app/api/admin/submissions/route.ts)
- [src/app/api/admin/teams/remove/route.ts](src/app/api/admin/teams/remove/route.ts)
- [src/app/api/admin/teams/restore/route.ts](src/app/api/admin/teams/restore/route.ts)
- [src/app/api/admin/validate/route.ts](src/app/api/admin/validate/route.ts)

## 8) What Each Admin API Does
### Auth / access
- `auth/link`: generates rescue/auth link behavior.
- `session`: checks admin unlock status, validates admin password, and sets/clears admin unlock cookie.
- `_auth.ts`: shared access guard for admin endpoints.

### Rounds
- `rounds/list`: returns round records.
- `rounds/update`: start/end/pause/resume team actions.
- The round duration override has been removed from the admin UI and API. Rounds use the configured default timing instead.

### Scores
- `scores/update`: add, deduct, or reset points on a team.

### Teams
- `teams/remove`: soft-remove a team.
- `teams/restore`: restore from snapshot/time depending on action.

### Submissions / moderation
- `submissions`: lists or moderates submissions.
- `validate`: validates admin-side actions before applying them.

### Boxes / gameplay control
- `boxes/lock`: locks or unlocks boxes.
- `boxes/update`: updates box/game details.
- `games/list`, `games/update`, `games/health`: manage the challenge catalog.

### Elimination
- `elimination/apply`: applies Round 1 or Round 2 cutoffs.

### Pair Battle
- `pair-battle/setup`: creates up to 6 skeleton pair rows for a round.
- `pair-battle/status`: returns current pair rows with joined team details.
- `pair-battle/assign`: assigns a team to a pair slot.
- `pair-battle/code`: assigns a 4-digit code to the two teams in a pair.
- `pair-battle/start`: activates pair battle for the round and marks teams/round status.
- `pair-battle/reset`: clears pair battle state for the round.
- `pair-battle/demo-seed`: creates demo teams up to 20 active teams.
- `pair-battle/qualified-teams`: returns the top 12 active teams for pairing.

## 9) Admin Data Model
Tables used by admin code:
- `teams`
- `players`
- `rounds`
- `team_rounds`
- `mystery_boxes`
- `box_opens`
- `team_events`
- `pair_pairings`
- `pair_submissions`

How these are used:
- `teams`: core team state, score, elimination, Round 2 fields
- `players`: user-to-team membership and names
- `rounds`: global game rounds and statuses
- `team_rounds`: per-team round tracking and timers
- `mystery_boxes`: Round 1 challenge definitions
- `box_opens`: round/box open history and pending box assignment state
- `team_events`: feed used in team dashboard and admin logs
- `pair_pairings`: Pair Battle bracket/slot table
- `pair_submissions`: per-pair submission events and correctness

## 10) Round Logic in Admin
### Round 1
- Admin starts Round 1 from the round control card.
- Teams open mystery boxes from the team dashboard.
- Admin can validate and score submissions.
- When Round 1 ends, elimination is applied by cutoff.

### Round 2
- Round 2 is code-based and uses admin-assigned 4-digit codes.
- Admin can set or change the pair code for both teams in a pair.
- Teams solve; wrong attempts may trigger temporary lockouts.
- Admin may apply Round 2 elimination based on solve order / qualification rules.

### Pair Battle specifics
- Setup is intentionally non-destructive now.
- It creates missing skeleton pair rows only and preserves existing assignments.
- The board labels pairs by display order if the underlying row does not include `pair_number`.
- This was changed to avoid setup failures from schema assumptions.

## 11) Team Dashboard Relationship To Admin
Team page:
- [src/app/team/page.tsx](src/app/team/page.tsx)

The team page is tightly coupled to admin round state:
- it fetches round status via `/api/boxes?teamId=...`,
- it opens the box only when Round 1 is active,
- it uses team events for status messages,
- it reacts to elimination and Round 2 status.

Important behavior:
- Team reveal is cinematic and should not trap the dashboard.
- If Round 2 becomes active, the page now shows a prompt rather than auto-forcing redirects.
- `/round1` is a redirect alias to `/team`.
- During unlock playback prep, the rule book now renders inside the video frame area (same footprint as video), not as a separate panel below the video.

## 12) Gameplay / Audio / Cinematic Notes
Relevant files:
- `src/app/team/components/mystery-box.tsx`
- `src/app/team/components/unlock-video-overlay.tsx`
- `src/app/team/components/reward-reveal.tsx`
- `src/app/team/components/tech-background.tsx`
- `src/lib/sound-manager.ts`
- `public/unlock-sequence.mp4`

Flow:
1. Player clicks mystery box.
2. Dashboard exits via motion animation.
3. Inline unlock video container renders in the mystery-box section.
4. Rule book is shown in-frame while video is loading, then hidden once playback starts.
5. Reward reveal screen appears.
6. Player continues to the mission/game.

## 13) Env / Runtime Notes
Browser/public Supabase config:
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

Server/admin key:
- `SUPABASE_SERVICE_ROLE_KEY`
- aliases: `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY`

Server/admin password gate:
- `ADMIN_PASSWORD`
- aliases: `MYSTERY_BOX_ADMIN_PASSWORD`, `ADMIN_PASSCODE`

Other notes:
- The root layout injects browser runtime Supabase config into `window.__MYSTERY_BOX_ENV__`.
- This prevents browser boot failures when only server env vars are present.

## 14) Known Constraints / Current Reality
- Build passes.
- Lint still has repo-wide warnings/errors unrelated to build; many are pre-existing React hook lint issues.
- GitHub warns that `public/unlock-sequence.mp4` is large. It is tracked and pushed, but it is above the recommended size for GitHub normal storage.
- Some admin UI sections still have old state fields that are not yet fully cleaned up if you choose to do a lint pass.

## 15) Working Rules For Future AI
When editing this repo:
- Do not invent extra routes or DB tables.
- Do not assume role-based admin unless you implement it.
- Keep route contracts stable unless explicitly told otherwise.
- If changing scoring, round timing, elimination, or Pair Battle, update the UI and API together.
- Re-run `npm run build` after any code change.
- If a change affects auth redirects, verify `/admin`, `/admin-entry`, `/team`, `/create-team`, `/leaderboard`, and `/round2`.

## 16) Fast File Index For Admin Work
Most important admin files:
- `src/app/admin/page.tsx`
- `src/app/api/admin/_auth.ts`
- `src/app/api/admin/session/route.ts`
- `src/app/api/admin/rounds/list/route.ts`
- `src/app/api/admin/rounds/update/route.ts`
- `src/app/api/admin/scores/update/route.ts`
- `src/app/api/admin/elimination/apply/route.ts`
- `src/app/api/admin/events/route.ts`
- `src/app/api/admin/pair-battle/setup/route.ts`
- `src/app/api/admin/pair-battle/status/route.ts`
- `src/app/api/admin/pair-battle/assign/route.ts`
- `src/app/api/admin/pair-battle/code/route.ts`
- `src/app/api/admin/pair-battle/start/route.ts`
- `src/app/api/admin/pair-battle/reset/route.ts`
- `src/app/api/admin/pair-battle/demo-seed/route.ts`
- `src/app/components/pair-battle-board.tsx`

Last updated: 2026-04-15
