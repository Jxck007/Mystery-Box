# Admin Control README

This document explains the admin module behavior, API routes, and the elimination-to-round2 flow.

## Purpose

The admin panel at `/admin` controls:
- Round lifecycle (start/end)
- Scores and elimination cuts
- Round 2 pair-battle setup
- Live logs and leaderboard updates

---

## Admin UI Sections

Main file:
- `src/app/admin/page.tsx`

Primary tabs:
- Round 1
- Round 2

### Round 1 Tab

Features:
- Start/End Round 1
- Bulk start teams
- Demo team seed
- Live team feed
- Elimination sync

Actions call:
- `/api/admin/rounds/update`
- `/api/admin/elimination/apply`
- `/api/admin/pair-battle/demo-seed`

### Round 2 Tab

Features:
- Start/End Round 2
- Unlock pair setup
- Auto pair / shuffle
- Assign team colors and codes
- Start pair battle
- Live pair leaderboard (admin view)

Actions call:
- `/api/admin/pair-battle/setup`
- `/api/admin/pair-battle/qualified-teams`
- `/api/admin/pair-battle/assign`
- `/api/admin/pair-battle/code`
- `/api/admin/pair-battle/start`
- `/api/admin/pair-battle/reset`

---

## API Functionality (Admin)

### 1) Apply elimination

Route:
- `POST /api/admin/elimination/apply`

File:
- `src/app/api/admin/elimination/apply/route.ts`

Behavior:
- Accepts `{ roundNumber: 1 }`
- Computes top `ROUND1_SURVIVOR_LIMIT` active teams by score
- Marks survivors as active and clears elimination fields
- Marks others as eliminated for round 1
- Ends round 1 in `rounds` table
- Ensures round 2 record exists (creates it if missing)

Expected success response shape:

```json
{
  "success": true,
  "roundNumber": 1,
  "survivorLimit": 16,
  "qualifyLimit": 16,
  "survivors": [],
  "eliminated": []
}
```

### 2) Start/End round

Route:
- `POST /api/admin/rounds/update`

File:
- `src/app/api/admin/rounds/update/route.ts`

Behavior:
- `action=start|end|pause_team|resume_team`
- For `roundNumber=1`, end action applies round 1 elimination logic
- Ensures round 2 record exists after round 1 end

### 3) Pair setup unlock

Route:
- `POST /api/admin/pair-battle/setup`

File:
- `src/app/api/admin/pair-battle/setup/route.ts`

Behavior:
- Ensures 8 pair rows exist for the provided round
- Reuses/repairs pair rows if strict constraints block insert
- Returns pairings for UI setup mode

### 4) Fetch selected teams for round 2

Route:
- `GET /api/admin/pair-battle/qualified-teams`

File:
- `src/app/api/admin/pair-battle/qualified-teams/route.ts`

Behavior:
- Returns top 16 active non-eliminated teams by score
- Used by pair setup drag/drop pool

### 5) Pair status (admin live board)

Route:
- `GET /api/admin/pair-battle/status?roundId=<id>`

File:
- `src/app/api/admin/pair-battle/status/route.ts`

Behavior:
- Returns pair rows + team details + submissions
- Computes latest attempts and battle state

---

## Realtime Data Path

Leaderboard page:
- `src/app/leaderboard/page.tsx`

Data source:
- `GET /api/leaderboard?includeBattle=1`

Realtime subscriptions:
- `teams`
- `players`
- `pair_pairings`
- `pair_submissions`
- `rounds`

If realtime is delayed, periodic refresh still runs every 4s in leaderboard page.

---

## Elimination Sync Troubleshooting

If `POST /api/admin/elimination/apply` returns 500:

1. Verify request payload

```json
{ "roundNumber": 1 }
```

2. Check API response body in browser Network tab
- Missing table/column errors
- Constraint violations
- RLS or permission issues

3. Confirm required tables exist
- `teams`
- `rounds`
- `team_events`
- `pair_pairings`

4. Confirm admin auth token is attached
- The admin panel uses `Authorization: Bearer <access_token>`

5. Verify round 1 exists in DB
- `rounds.round_number = 1`

6. Verify active teams exist
- `teams.is_active = true`

7. Confirm round 2 row exists after sync
- `rounds.round_number = 2`
- If missing, route should auto-create it

---

## Demo Data Notes

Route:
- `POST /api/admin/pair-battle/demo-seed`

Behavior:
- Adds demo teams up to target count
- Uses unique team names
- Inserts demo players for each demo team

This allows leaderboard and member counts to render meaningful rows.

---

## Quick Manual Test Script

1. Load demo teams
- Click `Load Demo Teams`

2. Start Round 1
- Click `Start Round`

3. Apply Round 1 Cut
- Click `Apply Round 1 Cut`

4. Open Round 2 tab
- Confirm Round 2 control visible
- Click `Unlock Pair Setup`

5. Assign pairs and colors
- Save pairings
- Save colors/codes

6. Start Round 2
- Click `Start Round 2`

7. Confirm team keypad
- Team page should show round2 keypad phase

---

## Key Files

Admin page:
- `src/app/admin/page.tsx`

Round APIs:
- `src/app/api/admin/rounds/list/route.ts`
- `src/app/api/admin/rounds/update/route.ts`

Elimination API:
- `src/app/api/admin/elimination/apply/route.ts`

Pair battle APIs:
- `src/app/api/admin/pair-battle/setup/route.ts`
- `src/app/api/admin/pair-battle/qualified-teams/route.ts`
- `src/app/api/admin/pair-battle/status/route.ts`
- `src/app/api/admin/pair-battle/start/route.ts`
- `src/app/api/admin/pair-battle/code/route.ts`
- `src/app/api/admin/pair-battle/reset/route.ts`

Leaderboard:
- `src/app/leaderboard/page.tsx`
- `src/app/api/leaderboard/route.ts`

---

## Current Limitation

If elimination sync still fails after this flow, capture and share:
- Request payload
- Full JSON response body
- Console/server log line for the failing request

With that, the exact failing SQL path can be patched immediately.
