"use client";

export default function RulesPage() {
  return (
    <main className="page-shell min-h-screen space-y-8">
      <section className="space-y-3">
        <p className="section-tag">EVENT_PROTOCOL</p>
        <h1 className="font-headline text-6xl md:text-8xl font-black uppercase leading-[0.85]" style={{ letterSpacing: "-0.04em" }}>
          MYSTERY BOX INNOVATION RULES
        </h1>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3">
          <p className="label">SECTION 01</p>
          <p className="font-headline text-3xl font-black uppercase">PHASE 1</p>
        </div>
        <div className="md:col-span-9 card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="label">MYSTERY BOX</p>
          <p className="text-sm text-[var(--text-muted)]">
            Open the active box during Round 1, complete the mini-game sequence, and submit before time expires. Tab switching triggers a penalty and round exit.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3">
          <p className="label">SECTION 02</p>
          <p className="font-headline text-3xl font-black uppercase">PHASE 2</p>
        </div>
        <div className="md:col-span-9 card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <p className="label">CRACK THE CODE</p>
          <p className="text-sm text-[var(--text-muted)]">
            Enter the 4-digit code assigned by admin. Incorrect attempts consume lockout budget. Successful submissions are ranked by qualification order.
          </p>
          <div className="overflow-auto">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Attempts</th>
                  <th>Penalty</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>XXXX (4 digits)</td>
                  <td>3</td>
                  <td>Temporary lockout</td>
                </tr>
                <tr>
                  <td>Admin-set per team</td>
                  <td>Realtime tracked</td>
                  <td>Status downgrade risk</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3">
          <p className="label">SECTION 03</p>
          <p className="font-headline text-3xl font-black uppercase">TEAM CONSTRAINTS</p>
        </div>
        <div className="md:col-span-9 grid grid-cols-2 gap-4">
          <div className="card items-center justify-center py-8">
            <p className="font-headline text-6xl font-black">03</p>
            <p className="label">MIN MEMBERS</p>
          </div>
          <div className="card items-center justify-center py-8">
            <p className="font-headline text-6xl font-black">04</p>
            <p className="label">MAX MEMBERS</p>
          </div>
        </div>
      </section>
    </main>
  );
}
