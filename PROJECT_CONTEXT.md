# Mystery Box Game - Project Context

This is the compact canonical source of truth for the repo. The admin-specific deep reference lives in [HANDOFF.md](HANDOFF.md).

## Overview
- Product: mobile-first Mystery Box event game platform
- Frontend: Next.js App Router, React 19, TypeScript
- Backend: Next.js API routes + Supabase
- Database: Supabase Postgres (public schema)
- Deployment target: Vercel

## Current Stack
- Next.js 16.1.6
- React 19.2.3
- TypeScript 5.x
- Supabase SDK: `@supabase/supabase-js` 2.99.1
- QR utility: `qrcode` 1.5.4
- Animations: Framer Motion
- Styling: `globals.css` plus Tailwind v4 utilities

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Environment Variables
Browser/public config:
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

Server/admin config:
- `SUPABASE_SERVICE_ROLE_KEY`
- aliases: `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY`

Runtime note:
- The root layout injects browser-readable Supabase config into `window.__MYSTERY_BOX_ENV__` so the client bundle does not hard-fail if `NEXT_PUBLIC_*` is absent at build time.

## Client Storage Keys
- `team_id`
- `player_name`
- `is_leader`
- `symposium_test_mode`
- `symposium_test_round`
- `site-unlocked`

## Page Routes
Public / entry:
- `/` -> `src/app/page.tsx`
- `/auth` -> `src/app/auth/page.tsx`
- `/auth/callback` -> `src/app/auth/callback/page.tsx`
- `/rules` -> `src/app/rules/page.tsx`
- `/round1` -> `src/app/round1/page.tsx` (redirect alias to `/team`)

Player/game:
- `/create-team` -> `src/app/create-team/page.tsx`
- `/team` -> `src/app/team/page.tsx`
- `/game/[boxId]` -> `src/app/game/[boxId]/page.tsx`
- `/round2` -> `src/app/round2/page.tsx`
- `/leaderboard` -> `src/app/leaderboard/page.tsx`

Admin:
- `/admin` -> `src/app/admin/page.tsx`

Layout / shared UI:
- `src/app/layout.tsx`
- `src/app/nav-links.tsx`
- `src/app/globals.css`

## Access Rules
- `/team`, `/create-team`, `/leaderboard`, `/round2` require a valid Supabase session.
- `/admin` uses authenticated browser session plus admin API auth headers.
- Test mode can bypass some auth checks when enabled in local storage.

## Authentication Flow
1. User signs in at `/auth`.
2. Client gets Supabase session from the browser client.
3. Client calls `/api/players/me` with Bearer token.
4. If no team mapping exists, user goes to `/create-team`.
5. Team/player identity is then stored in local storage for gameplay pages.

Server auth helpers:
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`
- `src/lib/supabase-admin.ts`

## API Route Inventory
General/user/team:
- `GET /api/leaderboard`
- `GET /api/players/me`
- `POST /api/teams/create`
- `POST /api/teams/join`
- `GET /api/teams/list`
- `POST /api/teams/[teamId]/penalty`
- `GET /api/teams/[teamId]/players`
- `POST /api/teams/[teamId]/players/remove`

Round/gameplay:
- `GET /api/boxes`
- `POST /api/boxes/open`
- `POST /api/boxes/start`
- `POST /api/boxes/submit`
- `POST /api/boxes/complete`
- `POST /api/round2/submit`
- `POST /api/round2/pair-submit`

Admin:
- `POST /api/admin/auth/link`
- `POST /api/admin/boxes/lock`
- `POST /api/admin/boxes/update`
- `POST /api/admin/elimination/apply`
- `GET /api/admin/events`
- `GET /api/admin/games/health`
- `GET /api/admin/games/list`
- `POST /api/admin/games/update`
- `POST /api/admin/pair-battle/assign`
- `POST /api/admin/pair-battle/code`
- `POST /api/admin/pair-battle/demo-seed`
- `GET /api/admin/pair-battle/qualified-teams`
- `POST /api/admin/pair-battle/reset`
- `POST /api/admin/pair-battle/setup`
- `POST /api/admin/pair-battle/start`
- `GET /api/admin/pair-battle/status`
- `POST /api/admin/round2/code`
- `GET /api/admin/rounds/list`
- `POST /api/admin/rounds/update`
- `POST /api/admin/scores/update`
- `GET /api/admin/session`
- `GET /api/admin/submissions`
- `POST /api/admin/teams/remove`
- `POST /api/admin/teams/restore`
- `POST /api/admin/validate`

Admin auth helper:
- `src/app/api/admin/_auth.ts`

## Data Model Used In Code
Tables currently used:
- `teams`
- `players`
- `rounds`
- `team_rounds`
- `mystery_boxes`
- `box_opens`
- `team_events`
- `pair_pairings`
- `pair_submissions`

Purpose summary:
- `teams`: identity, score, elimination flags, Round 2 state
- `players`: member identities tied to teams, optional `user_id`
- `rounds`: global round state and timing
- `team_rounds`: per-team timing and snapshots
- `mystery_boxes`: Round 1 challenge definitions
- `box_opens`: per-team box attempts and answer state
- `team_events`: feed/log shown in admin and team views
- `pair_pairings`: Pair Battle slots and assignments
- `pair_submissions`: Pair Battle submissions and resolution

## Gameplay Model
Round 1:
- Admin starts round.
- Team opens a box.
- Team submits answer.
- Admin validates answer.
- Score and event logs update.

Round 2:
- Admin prepares pair battle slots and assigns a code.
- Teams submit code.
- Wrong attempts trigger lockouts.
- Qualification order matters.

Pair Battle:
- Setup creates 6 skeleton pair slots.
- Existing assignments are preserved when setup is re-run.
- Demo seeding targets 20 active demo teams.

Elimination:
- Admin can apply elimination by cutoff rank.
- Non-qualified teams are marked inactive and receive elimination metadata.

## Live Updates
Supabase realtime is used on:
- Admin page: rounds, box_opens, teams, players
- Leaderboard: teams, players, box_opens
- Team page: team box_opens, team_events, rounds

Polling/fetch is also used for refresh safety.

## Current UX / Flow Notes
- Team page uses a cinematic unlock sequence with fullscreen video and a reward reveal.
- Round 1 dashboard should remain accessible and not auto-loop on reveal.
- `/round1` is a redirect alias to `/team`.
- Build currently passes with `npm run build`.
- Lint currently reports repo-wide issues; they are not all addressed.

## Security / Reality Check
- Admin APIs rely on server-side auth helpers and request validation.
- User APIs validate Supabase Bearer tokens.
- Public pages still depend on local storage for some gameplay state.

## Guardrails For Future AI
- Do not invent extra routes, tables, or rules.
- Preserve route contracts unless explicitly asked to change them.
- Update UI labels and API behavior together when changing gameplay timing, scoring, or elimination.
- Re-run `npm run build` after code changes.
- If a change affects auth redirects, verify `/team`, `/create-team`, `/leaderboard`, and `/round2`.

## Fast File Index
Core app:
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/nav-links.tsx`
- `src/app/page.tsx`
- `src/app/auth/page.tsx`
- `src/app/team/page.tsx`
- `src/app/admin/page.tsx`

Auth / clients:
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`
- `src/lib/supabase-admin.ts`

Key APIs:
- `src/app/api/players/me/route.ts`
- `src/app/api/teams/create/route.ts`
- `src/app/api/boxes/route.ts`
- `src/app/api/boxes/open/route.ts`
- `src/app/api/boxes/submit/route.ts`
- `src/app/api/round2/submit/route.ts`
- `src/app/api/round2/pair-submit/route.ts`
- `src/app/api/admin/rounds/update/route.ts`
- `src/app/api/admin/pair-battle/setup/route.ts`
- `src/app/api/admin/pair-battle/start/route.ts`

Last updated: 2026-04-15
