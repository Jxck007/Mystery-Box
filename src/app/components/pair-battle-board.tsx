"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface QualifiedTeam {
  id: string;
  name: string;
  leader_name: string;
  score: number;
}

interface PairPairing {
  id: string;
  pair_number?: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: "waiting" | "ready" | "in_progress" | "completed";
  winner_id: string | null;
  started_at: string | null;
  team_a?: QualifiedTeam;
  team_b?: QualifiedTeam;
  submissions?: any[];
}

interface PairBattleBoardProps {
  roundId: string;
  onStatusChange?: (message: string) => void;
  adminHeaders?: Record<string, string> | null;
  getAdminHeaders: () => Promise<Record<string, string> | null>;
}

export function PairBattleBoard({
  roundId,
  onStatusChange,
  adminHeaders: initialHeaders,
  getAdminHeaders,
}: PairBattleBoardProps) {
  const [qualifiedTeams, setQualifiedTeams] = useState<QualifiedTeam[]>([]);
  const [pairings, setPairings] = useState<PairPairing[]>([]);
  const [draggedTeam, setDraggedTeam] = useState<QualifiedTeam | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [paringStarted, setPairingStarted] = useState(false);
  const [pairCodeInputs, setPairCodeInputs] = useState<Record<string, string>>({});
  const [codeBusy, setCodeBusy] = useState<Record<string, boolean>>({});

  const fetchQualifiedTeams = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    try {
      const response = await fetch("/api/admin/pair-battle/qualified-teams", {
        headers,
      });
      const data = await response.json();
      if (response.ok) {
        setQualifiedTeams(data);
      }
    } catch (err) {
      console.error("Error fetching qualified teams:", err);
    }
  }, [getAdminHeaders]);

  const fetchPairingStatus = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    try {
      const response = await fetch(
        `/api/admin/pair-battle/status?roundId=${roundId}`,
        { headers }
      );
      const data = await response.json();
      if (response.ok && data.pairings) {
        setPairings(data.pairings);
        setSetupDone(data.pairings.length > 0);
        setPairingStarted(data.pairings.some((p: PairPairing) => p.status === "in_progress"));
      }
    } catch (err) {
      console.error("Error fetching pairing status:", err);
    }
  }, [getAdminHeaders, roundId]);

  const setupPairings = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    setLoading(true);
    onStatusChange?.("Setting up 6 empty pairs...");

    try {
      const response = await fetch("/api/admin/pair-battle/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ roundId }),
      });

      const data = await response.json();
      if (response.ok) {
        setPairings(data.pairings);
        setSetupDone(true);
        onStatusChange?.("Pairing board ready. Drag teams to pairs.");
      } else {
        onStatusChange?.(data.error || "Setup failed");
      }
    } catch (err) {
      onStatusChange?.(String(err));
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders, roundId, onStatusChange]);

  const seedDemoTeams = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    setLoading(true);
    onStatusChange?.("Seeding demo teams...");

    try {
      const response = await fetch("/api/admin/pair-battle/demo-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await response.json();
      if (!response.ok) {
        onStatusChange?.(data.error || "Unable to seed demo teams");
        return;
      }
      onStatusChange?.(data.message || "Demo teams ready");
      await fetchQualifiedTeams();
    } catch (err) {
      onStatusChange?.(String(err));
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders, fetchQualifiedTeams, onStatusChange]);

  const setPairCode = useCallback(async (pairingId: string) => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    const code = (pairCodeInputs[pairingId] ?? "").trim();
    if (!/^\d{4}$/.test(code)) {
      onStatusChange?.("Pair code must be 4 digits");
      return;
    }

    setCodeBusy((prev) => ({ ...prev, [pairingId]: true }));
    try {
      const response = await fetch("/api/admin/pair-battle/code", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ pairingId, code }),
      });
      const data = await response.json();
      if (!response.ok) {
        onStatusChange?.(data.error || "Unable to set pair code");
        return;
      }
      onStatusChange?.("Code set for the selected pair");
      await fetchPairingStatus();
    } catch (err) {
      onStatusChange?.(String(err));
    } finally {
      setCodeBusy((prev) => ({ ...prev, [pairingId]: false }));
    }
  }, [getAdminHeaders, pairCodeInputs, fetchPairingStatus, onStatusChange]);

  const assignTeam = useCallback(
    async (pairingId: string, teamId: string, slot: "a" | "b") => {
      const headers = await getAdminHeaders();
      if (!headers) return;

      try {
        const response = await fetch("/api/admin/pair-battle/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ pairingId, teamId, slot }),
        });

        const data = await response.json();
        if (response.ok) {
          await fetchPairingStatus();
          onStatusChange?.(`Team assigned to pair slot ${slot}`);
        } else {
          onStatusChange?.(data.error || "Assignment failed");
        }
      } catch (err) {
        onStatusChange?.(String(err));
      }
    },
    [getAdminHeaders, fetchPairingStatus, onStatusChange]
  );

  const handleDragStart = (team: QualifiedTeam) => {
    setDraggedTeam(team);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = async (pairingId: string, slot: "a" | "b") => {
    if (!draggedTeam) return;

    const pairing = pairings.find((p) => p.id === pairingId);
    if (!pairing) return;

    // Check if slot is already occupied
    if (slot === "a" && pairing.team_a_id) {
      onStatusChange?.("Slot A is already occupied");
      return;
    }
    if (slot === "b" && pairing.team_b_id) {
      onStatusChange?.("Slot B is already occupied");
      return;
    }

    await assignTeam(pairingId, draggedTeam.id, slot);
    setDraggedTeam(null);
  };

  const startPairingBattle = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    setLoading(true);
    onStatusChange?.("Starting pair battle...");

    try {
      const response = await fetch("/api/admin/pair-battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ roundId }),
      });

      const data = await response.json();
      if (response.ok) {
        setPairingStarted(true);
        await fetchPairingStatus();
        onStatusChange?.("Pair battle started! Pairs are live.");
      } else {
        onStatusChange?.(data.error || "Start failed");
      }
    } catch (err) {
      onStatusChange?.(String(err));
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders, roundId, fetchPairingStatus, onStatusChange]);

  const resetPairings = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;

    setLoading(true);
    onStatusChange?.("Resetting pairings...");

    try {
      const response = await fetch("/api/admin/pair-battle/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ roundId }),
      });

      const data = await response.json();
      if (response.ok) {
        setPairings([]);
        setSetupDone(false);
        setPairingStarted(false);
        setDraggedTeam(null);
        onStatusChange?.(data.message || "Pairings reset");
      } else {
        onStatusChange?.(data.error || "Reset failed");
      }
    } catch (err) {
      onStatusChange?.(String(err));
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders, roundId, onStatusChange]);

  const unassignedTeams = useMemo(() => {
    const assignedIds = new Set<string>();
    pairings.forEach((p) => {
      if (p.team_a_id) assignedIds.add(p.team_a_id);
      if (p.team_b_id) assignedIds.add(p.team_b_id);
    });
    return qualifiedTeams.filter((t) => !assignedIds.has(t.id));
  }, [qualifiedTeams, pairings]);

  const completedPairs = useMemo(() => {
    return pairings.filter((p) => p.status === "completed").length;
  }, [pairings]);

  // Initial setup
  useEffect(() => {
    fetchQualifiedTeams();
    fetchPairingStatus();
  }, [fetchQualifiedTeams, fetchPairingStatus]);

  // Poll for pairing status updates
  useEffect(() => {
    if (setupDone) {
      const interval = setInterval(fetchPairingStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [setupDone, fetchPairingStatus]);

  return (
    <div className="pair-battle-section">
      <h3 className="section-title">⚔️ Pair Battle Mode</h3>

      {!setupDone ? (
        <div className="pair-setup-card">
          <p className="subtitle">Ready to set up pair pairings?</p>
          <p className="description">
            This will create 6 pairs from the top 12 qualifying teams. Teams
            will compete head-to-head to solve the same code.
          </p>
          <button
            className="button-action"
            onClick={setupPairings}
            disabled={loading}
          >
            {loading ? "Setting up..." : `Setup 6 Pairs (${qualifiedTeams.length} teams available)`}
          </button>
          <button
            className="button-neutral"
            onClick={seedDemoTeams}
            disabled={loading}
          >
            {loading ? "Seeding..." : "Seed Demo Teams To 20"}
          </button>
          {qualifiedTeams.length < 12 && (
            <p className="warning-text">
              You can still setup skeleton pairs now and assign teams as they arrive.
            </p>
          )}
        </div>
      ) : (
        <div className="pair-battle-content">
          {/* Control Bar */}
          <div className="pair-controls">
            <div className="pair-info">
              <span className="info-item">
                Assigned: {qualifiedTeams.length - unassignedTeams.length}/12
              </span>
              <span className="info-item">
                Completed: {completedPairs}/6
              </span>
              <span className="info-item status-badge" data-status={paringStarted ? "active" : "ready"}>
                {paringStarted ? "🔴 LIVE" : "🟡 READY"}
              </span>
            </div>
            <div className="pair-actions">
              {!paringStarted && (
                <button
                  className="button-action"
                  onClick={startPairingBattle}
                  disabled={loading || unassignedTeams.length > 0}
                >
                  {loading ? "Starting..." : "Start Pair Battle"}
                </button>
              )}
              <button
                className="button-neutral"
                onClick={resetPairings}
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Pairings"}
              </button>
            </div>
          </div>

          {/* Team Pool */}
          <div className="team-pool-section">
            <h4>Available Teams ({unassignedTeams.length})</h4>
            <div className="team-pool">
              {unassignedTeams.map((team) => (
                <div
                  key={team.id}
                  className="team-chip"
                  draggable
                  onDragStart={() => handleDragStart(team)}
                  title={team.leader_name}
                >
                  <div className="team-chip-name">{team.name}</div>
                  <div className="team-chip-score">{team.score}</div>
                </div>
              ))}
              {unassignedTeams.length === 0 && (
                <p className="no-teams">All teams assigned!</p>
              )}
            </div>
          </div>

          {/* Pair Grid */}
          <div className="pairs-grid">
              {pairings.map((pairing, index) => (
              <div
                key={pairing.id}
                className={`pair-container pair-status-${pairing.status}`}
                data-winner={pairing.winner_id}
              >
                <div className="pair-header">
                  <h5>Pair {pairing.pair_number ?? index + 1}</h5>
                  <span className="pair-status-badge">{pairing.status}</span>
                </div>

                {/* Team A Slot */}
                <div
                  className="pair-slot slot-a"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnSlot(pairing.id, "a")}
                  data-filled={!!pairing.team_a_id}
                >
                  {pairing.team_a ? (
                    <div className={`slot-team ${pairing.winner_id === pairing.team_a_id ? 'winner' : pairing.status === 'completed' ? 'loser' : ''}`}>
                      <div className="slot-team-name">{pairing.team_a.name}</div>
                      <div className="slot-team-leader">{pairing.team_a.leader_name}</div>
                      {pairing.winner_id === pairing.team_a_id && (
                        <div className="winner-label">🏆 WINNER</div>
                      )}
                    </div>
                  ) : (
                    <div className="slot-empty">
                      <div className="slot-label">Drag team here</div>
                    </div>
                  )}
                </div>

                {/* VS Divider */}
                <div className="pair-divider">vs</div>

                {/* Team B Slot */}
                <div
                  className="pair-slot slot-b"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnSlot(pairing.id, "b")}
                  data-filled={!!pairing.team_b_id}
                >
                  {pairing.team_b ? (
                    <div className={`slot-team ${pairing.winner_id === pairing.team_b_id ? 'winner' : pairing.status === 'completed' ? 'loser' : ''}`}>
                      <div className="slot-team-name">{pairing.team_b.name}</div>
                      <div className="slot-team-leader">{pairing.team_b.leader_name}</div>
                      {pairing.winner_id === pairing.team_b_id && (
                        <div className="winner-label">🏆 WINNER</div>
                      )}
                    </div>
                  ) : (
                    <div className="slot-empty">
                      <div className="slot-label">Drag team here</div>
                    </div>
                  )}
                </div>

                {/* Submission Count */}
                {pairing.submissions && pairing.submissions.length > 0 && (
                  <div className="pair-submissions">
                    {pairing.submissions.length} submission
                    {pairing.submissions.length !== 1 ? "s" : ""}
                  </div>
                )}

                {pairing.team_a_id && pairing.team_b_id && (
                  <div className="pair-code-controls">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      className="input-field"
                      placeholder="0000"
                      value={pairCodeInputs[pairing.id] ?? ""}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                        setPairCodeInputs((prev) => ({ ...prev, [pairing.id]: digits }));
                      }}
                    />
                    <button
                      className="button-primary"
                      onClick={() => setPairCode(pairing.id)}
                      disabled={(pairCodeInputs[pairing.id] ?? "").length !== 4 || codeBusy[pairing.id]}
                    >
                      {codeBusy[pairing.id] ? "Saving..." : "Set Pair Code"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .pair-battle-section {
          padding: 1.5rem;
          background: #1e1e2e;
          border-radius: 0.5rem;
          margin-bottom: 2rem;
          border-left: 4px solid #00d4ff;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #00d4ff;
        }

        .pair-setup-card {
          background: #2a2a3e;
          padding: 1.5rem;
          border-radius: 0.5rem;
          text-align: center;
        }

        .subtitle {
          font-size: 1rem;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .description {
          color: #aaaaaa;
          font-size: 0.9rem;
          margin-bottom: 1rem;
          line-height: 1.5;
        }

        .warning-text {
          color: #ff6b6b;
          font-size: 0.85rem;
          margin-top: 1rem;
        }

        .pair-battle-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .pair-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #2a2a3e;
          padding: 1rem;
          border-radius: 0.5rem;
          gap: 1rem;
        }

        .pair-info {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .info-item {
          color: #aaaaaa;
          font-size: 0.9rem;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-badge[data-status="ready"] {
          background: #1e4d6b;
          color: #4da6ff;
        }

        .status-badge[data-status="active"] {
          background: #4d1e1e;
          color: #ff6b6b;
        }

        .pair-actions {
          display: flex;
          gap: 0.5rem;
        }

        .button-action,
        .button-neutral {
          padding: 0.5rem 1rem;
          border-radius: 0.3rem;
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-action {
          background: #00d4ff;
          color: #000000;
        }

        .button-action:hover:not(:disabled) {
          background: #00e6ff;
        }

        .button-action:disabled {
          background: #006b8f;
          color: #666666;
          cursor: not-allowed;
        }

        .button-neutral {
          background: #4a4a5a;
          color: #ffffff;
        }

        .button-neutral:hover:not(:disabled) {
          background: #5a5a6a;
        }

        .button-neutral:disabled {
          background: #3a3a4a;
          color: #666666;
          cursor: not-allowed;
        }

        .team-pool-section {
          background: #2a2a3e;
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .team-pool-section h4 {
          margin-bottom: 0.75rem;
          color: #ffffff;
          font-size: 0.95rem;
        }

        .team-pool {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          min-height: 3rem;
        }

        .team-chip {
          background: #00d4ff;
          color: #000000;
          padding: 0.5rem 0.75rem;
          border-radius: 0.3rem;
          cursor: move;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          user-select: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .team-chip:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
        }

        .team-chip-name {
          font-weight: 700;
        }

        .team-chip-score {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .no-teams {
          color: #666666;
          font-style: italic;
          padding: 0.5rem;
        }

        .pairs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }

        .pair-container {
          background: #2a2a3e;
          border: 2px solid #4a4a5a;
          border-radius: 0.5rem;
          padding: 1rem;
          transition: all 0.3s;
        }

        .pair-container.pair-status-ready {
          border-color: #4da6ff;
          box-shadow: 0 0 8px rgba(77, 166, 255, 0.2);
        }

        .pair-container.pair-status-in_progress {
          border-color: #00d4ff;
          box-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
        }

        .pair-container.pair-status-completed {
          border-color: #4d8f4d;
          background: #1e2e1e;
        }

        .pair-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .pair-header h5 {
          margin: 0;
          color: #ffffff;
          font-size: 0.95rem;
        }

        .pair-status-badge {
          font-size: 0.75rem;
          background: #4a4a5a;
          color: #aaaaaa;
          padding: 0.25rem 0.5rem;
          border-radius: 0.2rem;
          text-transform: uppercase;
        }

        .pair-slot {
          background: #1a1a2e;
          border: 2px dashed #4a4a5a;
          border-radius: 0.3rem;
          padding: 0.75rem;
          min-height: 4.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          transition: all 0.2s;
          margin-bottom: 0.5rem;
        }

        .pair-slot[data-filled="true"] {
          cursor: default;
          border-style: solid;
        }

        .pair-slot:hover {
          border-color: #00d4ff;
          background: #252540;
        }

        .slot-empty {
          text-align: center;
          color: #666666;
          font-size: 0.85rem;
        }

        .slot-label {
          font-style: italic;
        }

        .slot-team {
          width: 100%;
          text-align: center;
          padding: 0.25rem 0;
          transition: all 0.3s;
        }

        .slot-team.winner {
          background: linear-gradient(135deg, #1e4d2e 0%, #1a2e1a 100%);
          border-radius: 0.2rem;
          padding: 0.5rem;
          border: 1px solid #4da65a;
        }

        .slot-team.loser {
          opacity: 0.5;
          color: #888888;
        }

        .slot-team-name {
          font-weight: 700;
          color: #ffffff;
          font-size: 0.9rem;
        }

        .slot-team-leader {
          font-size: 0.75rem;
          color: #aaaaaa;
          margin-top: 0.25rem;
        }

        .winner-label {
          margin-top: 0.25rem;
          color: #4da65a;
          font-weight: 700;
          font-size: 0.8rem;
        }

        .pair-divider {
          text-align: center;
          color: #666666;
          font-size: 0.85rem;
          margin: 0.5rem 0;
          font-weight: 600;
        }

        .pair-submissions {
          text-align: center;
          font-size: 0.75rem;
          color: #aaaaaa;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid #4a4a5a;
        }

        .pair-code-controls {
          margin-top: 0.75rem;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.5rem;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
