# Mystery Box Game - Full Project Context (Anti-Hallucination Reference)

This document is the canonical source of truth for this repository. Future AI work should follow this file and avoid assumptions that are not listed here.

## 1) Project Identity
- Product: Mystery Box event game platform
- Frontend: Next.js App Router, React 19, TypeScript
- Backend: Next.js API routes + Supabase
- Database: Supabase Postgres (tables in public schema)
- Deployment: Vercel (production URL shared by owner)

## 2) Tech Stack And Scripts
- Next.js: 16.1.6
- React: 19.2.3
- TypeScript: 5.x
- Supabase SDK: @supabase/supabase-js 2.99.1
- QR utility: qrcode 1.5.4
- CSS: globals.css + Tailwind v4 utilities

Scripts from package.json:
- npm run dev
- npm run build
- npm run start
- npm run lint

## 3) Environment Variables In Use
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_ADMIN_PASSWORD

Notes:
- Admin UI and admin API currently use password-only gating.
- Service role key is required for server admin client.

## 4) Client-Side Storage Keys
- team_id
- player_name
- is_leader
- symposium_test_mode
- admin_access (sessionStorage)
- admin_password (sessionStorage)

## 5) App Route Map (Pages)
All page routes are under src/app.

Public or entry routes:
- / -> src/app/page.tsx
- /auth -> src/app/auth/page.tsx
- /auth/callback -> src/app/auth/callback/page.tsx
- /rules -> src/app/rules/page.tsx

Team/game routes:
- /create-team -> src/app/create-team/page.tsx
- /join-team -> src/app/join-team/page.tsx
- /team -> src/app/team/page.tsx
- /game/[boxId] -> src/app/game/[boxId]/page.tsx
- /round2 -> src/app/round2/page.tsx
- /leaderboard -> src/app/leaderboard/page.tsx

Admin route:
- /admin -> src/app/admin/page.tsx

Layout/navigation:
- Root layout: src/app/layout.tsx
- Guarded nav buttons: src/app/nav-links.tsx
- Global styles: src/app/globals.css

## 6) Route Access Rules (Current Behavior)
- /team: requires signed-in Supabase session; if no player/team mapping, redirects to /create-team.
- /leaderboard: requires signed-in Supabase session.
- /create-team: requires signed-in Supabase session.
- /admin: requires manual password gate in UI plus x-admin-password header in admin APIs.
- Test mode can bypass normal auth checks on some pages.

## 7) Authentication Flow
1. User signs in or signs up on /auth.
2. Signup now includes display name and confirm password checks in UI.
3. Session is obtained from Supabase browser client.
4. Client calls /api/players/me using Bearer token.
5. If user has no player/team row, they are sent to /create-team.
6. Local storage is used for team context in the gameplay pages.

Server auth helpers:
- src/lib/supabase-browser.ts
- src/lib/supabase-server.ts
- src/lib/supabase-admin.ts

## 8) Full API Route Inventory
All API routes are under src/app/api.

General/user/team:
- GET /api/leaderboard
- GET /api/players/me
- POST /api/teams/create
- POST /api/teams/join
- GET /api/teams/list
- POST /api/teams/[teamId]/penalty
- GET /api/teams/[teamId]/players
- POST /api/teams/[teamId]/players/remove

Boxes/gameplay:
- GET /api/boxes
- POST /api/boxes/open
- POST /api/boxes/start
- POST /api/boxes/submit
- POST /api/boxes/complete
- POST /api/round2/submit

Admin endpoints:
- POST /api/admin/auth/link
- POST /api/admin/boxes/lock
- POST /api/admin/boxes/update
- POST /api/admin/elimination/apply
- GET /api/admin/games/health
- GET /api/admin/games/list
- POST /api/admin/games/update
- POST /api/admin/round2/code
- GET /api/admin/rounds/list
- POST /api/admin/rounds/update
- POST /api/admin/scores/update
- GET /api/admin/submissions
- POST /api/admin/teams/remove
- POST /api/admin/teams/restore
- POST /api/admin/validate

Admin auth middleware helper:
- src/app/api/admin/_auth.ts

## 9) Data Model Used By Code
Tables actively used in code:
- teams
- players
- rounds
- team_rounds
- mystery_boxes
- box_opens
- team_events

High-level purpose:
- teams: team identity, score, elimination flags, round2 state
- players: member identities tied to teams, optional user_id mapping
- rounds: global round state and timing
- team_rounds: per-team round timing and penalty snapshots
- mystery_boxes: challenge definitions and lock state
- box_opens: per team per box attempt status and answer
- team_events: event feed and activity log shown in team/admin views

## 10) Gameplay Model
Round 1:
- Admin starts round.
- Team opens a box.
- Team submits answer.
- Admin validates answer.
- Score updates and team events are written.

Round 2:
- Admin sets per-team 4-digit codes.
- Team submits code.
- Wrong code triggers temporary lockout.
- Solve order determines qualification/elimination status.

Elimination:
- Admin can apply elimination by cutoff rank.
- Non-qualified teams are marked inactive and eliminated metadata is set.

## 11) Realtime/Live Updates
Client realtime subscriptions (Supabase channels):
- Admin page subscribes to rounds, box_opens, teams, players changes.
- Leaderboard page subscribes to teams, players, box_opens changes.
- Team page subscribes to team-specific box_opens and team_events plus rounds.

Polling/fetch patterns:
- Team and leaderboard pages also trigger explicit fetch refreshes.

## 12) Admin Panel Capability Summary
Admin page currently supports:
- Round control (start/end/team pause/team resume, duration)
- Team management (remove/restore)
- Score controls (add/deduct/reset)
- Submission moderation (validate)
- Game/box controls (update content, lock/unlock)
- Round2 code management
- Elimination controls
- Rescue auth link generation

## 13) Security Reality (Current)
- RLS was reported disabled on all relevant public tables.
- Admin security is simple shared password only.
- Admin APIs rely on x-admin-password header matching env value.
- User APIs that require auth validate Bearer token with Supabase auth.

## 14) Non-Negotiable Guardrails For Future AI
Use these rules when editing this project:
- Do not invent extra routes, tables, or business rules.
- Do not assume role-based admin unless explicitly requested.
- Keep admin as password-only unless owner asks otherwise.
- Preserve current route contracts unless requested to change.
- If changing scoring, round timing, or elimination, update both API behavior and UI status labels.
- If changing auth redirects, verify all protected pages still redirect correctly.
- If introducing DB constraints or RLS, call out affected endpoints and expected behavior changes.
- Prefer server-side validation for critical mutations.

## 15) Prompt Template For Any AI Working On This Repo
Use this exact context style in future prompts:
- Project: Mystery Box Game (Next.js + Supabase)
- Source of truth: PROJECT_CONTEXT.md
- Do not assume features not listed in this file
- Keep admin auth as simple password-only unless explicitly told otherwise
- Preserve existing API paths and page routes
- Verify build after changes with npm run build

## 16) Quick File Index
Core app:
- src/app/layout.tsx
- src/app/globals.css
- src/app/nav-links.tsx
- src/app/page.tsx
- src/app/auth/page.tsx
- src/app/team/page.tsx
- src/app/admin/page.tsx

Auth and clients:
- src/lib/supabase-browser.ts
- src/lib/supabase-server.ts
- src/lib/supabase-admin.ts

Key APIs:
- src/app/api/players/me/route.ts
- src/app/api/teams/create/route.ts
- src/app/api/boxes/route.ts
- src/app/api/boxes/open/route.ts
- src/app/api/boxes/submit/route.ts
- src/app/api/admin/rounds/update/route.ts
- src/app/api/admin/validate/route.ts

Last updated: 2026-04-12
