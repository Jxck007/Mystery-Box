# 📊 Deep Technical + Product Audit: Mystery Box Event

## 1. Project Overview
The application is a live event coordination platform designed for 3-round competitive team challenges.
- **What it does:** It allows users to form teams, solve digital mini-games (Round 1), enter physical task codes (Round 2), and track standings on a live leaderboard.
- **Core Features:**
  - **Auth:** Magic link sign-in and admin-generated "Rescue Links".
  - **Team Management:** Leader-based team creation with member rosters.
  - **Round 1 (Mystery Boxes):** 10 types of digital mini-games (Quiz, Trivia, Math, Scramble, etc.) with auto-scoring.
  - **Round 2 (Physical):** A keypad-entry system for teams to input a 4-digit code provided by admins after a physical task.
  - **Admin Control:** Global and per-team round management (start/pause/resume/end), score adjustments, and team elimination.
  - **Anti-Cheat:** A "Penalty" system that triggers if a user leaves the game tab (Visibility API).

## 2. Architecture Breakdown
- **Frontend Stack:** Next.js 15 (App Router), Tailwind CSS v4, TypeScript.
- **Backend Stack:** Supabase (PostgreSQL, Auth, Real-time).
- **Data Flow:**
  - **Auth:** Supabase Auth handles sessions.
  - **Operations:** Next.js API Routes act as a proxy, using the Supabase `service_role` key via a server-side "Admin Client" to bypass RLS for most logic.
  - **Real-time:** The client subscribes directly to Supabase `postgres_changes` for `teams`, `rounds`, and `box_opens` to update the UI without polling.
  - **State:** Local state in pages handles timers and UI transitions, with `localStorage` used for session persistence across refreshes.

## 3. UI/UX Analysis
### Strengths:
- **Atmospheric Design:** Consistent "Command Center" dark aesthetic using a custom color palette in `globals.css`.
- **Real-time Feedback:** Use of toasts and live leaderboard updates creates a high-stakes environment.
- **Mobile Responsive:** Layouts use `page-shell` and `card` classes that adapt well to smaller screens.

### Major UX Problems:
- **Navigation Vacuum:** No global navigation bar. Users rely on "Back" buttons or are trapped in specific flows.
- **Brutal Penalties:** Switching tabs or blurring the window instantly ends a team's round and resets their score to 0. This is extremely high-risk for accidental triggers (e.g., system notifications).
- **Inconsistent Round Transitions:** The logic for moving between Round 1, 2, and 3 is fragmented across different page `useEffect` hooks.

### Missing UI States:
- **Global Loading:** Many actions (like opening a box) lack a persistent global loading overlay, leading to potential double-clicks.
- **Empty States:** The leaderboard and team hub have minimal handling for "no data" or "waiting for start" states.

## 4. Code Quality Issues
- **Monolithic Pages:** `admin/page.tsx` is 1000+ lines of code. There is **zero component reusability** (no `src/components` directory).
- **Logic Duplication:** Fetching logic, Supabase channel setup, and timer calculations are copy-pasted across `team/page.tsx`, `game/[boxId]/page.tsx`, and `round2/page.tsx`.
- **Hardcoded Content:** All 500+ game questions (Quiz, Trivia, etc.) are hardcoded in a single file (`game-panels.tsx`).
- **Public Secrets:** The admin password check uses a `NEXT_PUBLIC_` environment variable, making it visible to anyone who inspects the client-side JS bundle.

## 5. Supabase / Backend Issues
- **Security Vulnerability:** API routes frequently use the `service_role` key even for user-level actions. Because the `admin-password` is leaked via the `NEXT_PUBLIC_` prefix, the entire administrative API is effectively public.
- **RLS Bypass:** There is no evidence of Row Level Security (RLS) being used to protect data; the app relies on the API layer being "secure" despite the leaked password.
- **Race Conditions:** Team score updates (`score + points`) are performed via read-then-write on the client/API rather than using PostgreSQL atomic increments (e.g., `set score = score + 1`).

## 6. Game / Feature Logic Analysis
- **Round 1:** High-variety but low-depth mini-games. The "Mystery" is just a random pick from a hardcoded list.
- **Round 2:** purely a gate. If the admin hasn't manually set a code for a team, they are stuck.
- **Engagement:** Gamification relies heavily on the "Streak Bonus" (consecutive correct answers).
- **Anti-Cheat:** The `visibilitychange` penalty is the only anti-cheat mechanism, which is easily bypassed by sophisticated users but punishes casual users for accidents.

## 7. Critical Bugs or Risks
- **Admin Password Leak:** `NEXT_PUBLIC_ADMIN_PASSWORD` is a **P0 Security Risk**.
- **Session Desync:** The app uses `localStorage` for `team_id` and `is_leader`. If a user clears their cache or uses a different device, they can lose access to their team even if signed in via Supabase.
- **Round ID Mismatches:** The `GLOBAL_START_ROUNDS` constant is inconsistently defined as `Set([1])` in some files and `Set([3])` in others, which will break global timer synchronization.

## 8. Improvement Plan
- **P0 (Immediate):**
  - Remove `NEXT_PUBLIC_` from `ADMIN_PASSWORD` and move the check entirely to the server.
  - Implement atomic increments for scores (`rpc` or raw SQL).
  - Componentize the `MiniGame` logic.
- **P1 (Stability):**
  - Centralize state management (use a shared hook or provider).
  - Add a "Confirm" step for the tab-exit penalty.
  - Implement proper Supabase RLS.
- **P2 (Polish):**
  - Move game data (questions) to a database table.
  - Add Framer Motion for "Box Opening" animations.

## 9. UI/UX Redesign Direction
- **Landing Page:** Simplify to a clear "Join Mission" vs "Command Center" (Admin) split.
- **Dashboard:** Transition from a list view to a "Mission Progress" map or status board.
- **Admin Panel:** Tabbed interface to separate "Global Controls", "Team Monitoring", and "Manual Overrides".

## 10. Final Verdict
- **Is this production-ready?** **NO.**
- **Why?** The leaked admin password and lack of RLS mean a single semi-technical player could reset every team's score or eliminate the entire field via a simple `fetch` command in the console.
- **Project Level:** **Prototype / Early Semi-Prod.** It has the visual polish of a production app, but the underlying architecture and security are at a "Proof of Concept" level.
