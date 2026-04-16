"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BATTLE_COLOR_PALETTE,
  DEFAULT_BATTLE_COLOR_CODES,
  getBattleColor,
  ROUND2_PAIR_COUNT,
  ROUND2_QUALIFIED_TEAM_LIMIT,
  ROUND1_SURVIVOR_LIMIT,
} from "@/lib/pair-battle";

interface QualifiedTeam {
  id: string;
  name: string;
  leader_name: string;
  score: number;
}

type PairSubmission = {
  pair_id: string;
  team_id: string;
  is_correct: boolean;
  submitted_at: string;
};

interface PairPairing {
  id: string;
  created_at?: string | null;
  pair_number?: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  status: "waiting" | "ready" | "in_progress" | "completed";
  winner_id: string | null;
  started_at: string | null;
  team_a?: QualifiedTeam;
  team_b?: QualifiedTeam;
  submissions?: PairSubmission[];
  battle_state?: "waiting" | "ready" | "pending" | "solving" | "winner_found";
  team_a_attempts?: number;
  team_b_attempts?: number;
  has_activity?: boolean;
  correct_at?: string | null;
  elapsed_seconds?: number;
  solved_elapsed_seconds?: number | null;
  team_a_color?: string | null;
  team_b_color?: string | null;
  team_a_code?: string | null;
  team_b_code?: string | null;
  team_a_latest_attempt?: string | null;
  team_b_latest_attempt?: string | null;
}

type DragPayload = {
  teamId: string;
  sourcePairingId?: string;
  sourceSlot?: "a" | "b";
};

interface PairBattleBoardProps {
  roundId: string;
  onStatusChange?: (message: string) => void;
  getAdminHeaders: () => Promise<Record<string, string> | null>;
  onRoundAction?: (action: "start" | "end", roundNumber: number, teamId?: string, busyKey?: string) => Promise<void>;
  roundStatus?: string;
  actionBusy?: Record<string, boolean>;
}

const formatElapsed = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const random4Digits = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

export function PairBattleBoard({
  roundId,
  onStatusChange,
  getAdminHeaders,
  onRoundAction,
  roundStatus = "waiting",
  actionBusy = {},
}: PairBattleBoardProps) {
  const [qualifiedTeams, setQualifiedTeams] = useState<QualifiedTeam[]>([]);
  const [pairings, setPairings] = useState<PairPairing[]>([]);
  const [draftPairings, setDraftPairings] = useState<PairPairing[]>([]);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [draggedTeam, setDraggedTeam] = useState<DragPayload | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [pairingStarted, setPairingStarted] = useState(false);
  const [pairCodeInputs, setPairCodeInputs] = useState<Record<string, string>>({});
  const [pairColorDraft, setPairColorDraft] = useState<Record<string, { a: string; b: string }>>({});
  const [masterColorCodes, setMasterColorCodes] = useState<Record<string, string>>(() => ({
    ...DEFAULT_BATTLE_COLOR_CODES,
  }));
  const [lockedMasterColors, setLockedMasterColors] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BATTLE_COLOR_PALETTE.map((entry) => [entry.name, false])),
  );
  const [allowColorRepeat, setAllowColorRepeat] = useState(false);
  const [codeBusy, setCodeBusy] = useState<Record<string, boolean>>({});
  const [liveBusy, setLiveBusy] = useState<Record<string, boolean>>({});

  const fetchQualifiedTeams = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    const response = await fetch("/api/admin/pair-battle/qualified-teams", { headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      onStatusChange?.((data as { error?: string } | null)?.error ?? "Unable to load selected Round 2 teams.");
      setQualifiedTeams([]);
      return;
    }
    if (Array.isArray(data)) {
      setQualifiedTeams(data);
    } else {
      setQualifiedTeams([]);
    }
  }, [getAdminHeaders, onStatusChange]);

  const fetchPairingStatus = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    const response = await fetch(`/api/admin/pair-battle/status?roundId=${roundId}`, { headers, cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data?.pairings)) return;
    const nextPairings = data.pairings as PairPairing[];
    setPairings(nextPairings);
    setDraftPairings(nextPairings);
    setHasDraftChanges(false);
    setPairColorDraft(() => {
      const next: Record<string, { a: string; b: string }> = {};
      nextPairings.forEach((pairing) => {
        next[pairing.id] = {
          a: pairing.team_a_color ?? "",
          b: pairing.team_b_color ?? "",
        };
      });
      return next;
    });
    setPairCodeInputs((prev) => {
      const next = { ...prev };
      nextPairings.forEach((pairing) => {
        if (pairing.team_a_color && pairing.team_a_code && !masterColorCodes[pairing.team_a_color]) {
          setMasterColorCodes((current) => ({ ...current, [pairing.team_a_color!]: pairing.team_a_code! }));
        }
        if (pairing.team_b_color && pairing.team_b_code && !masterColorCodes[pairing.team_b_color]) {
          setMasterColorCodes((current) => ({ ...current, [pairing.team_b_color!]: pairing.team_b_code! }));
        }
      });
      return next;
    });
    setSetupDone(nextPairings.length > 0);
    setPairingStarted(nextPairings.some((pairing) => pairing.status === "in_progress"));
  }, [getAdminHeaders, masterColorCodes, roundId]);

  const autoPair = useCallback(async () => {
    const orderedTeams = [...qualifiedTeams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const orderedPairs = [...draftPairings].sort((a, b) => {
      const aNum = a.pair_number ?? 999;
      const bNum = b.pair_number ?? 999;
      if (aNum !== bNum) return aNum - bNum;
      return a.created_at && b.created_at ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : 0;
    });
    if (orderedPairs.length === 0 || orderedTeams.length === 0) {
      onStatusChange?.("Reviewing pool for seeding...");
      return;
    }
    // Tournament seeding: 1 vs 24, 2 vs 23, 3 vs 22, etc. (works for any even number)
    const next = orderedPairs.map((pairing) => ({ ...pairing }));
    const totalTeams = orderedTeams.length;
    for (let i = 0; i < Math.min(ROUND2_PAIR_COUNT, orderedPairs.length); i += 1) {
      const pair = next[i];
      const teamA = orderedTeams[i];
      const teamB = orderedTeams[totalTeams - 1 - i];
      pair.team_a_id = teamA?.id ?? null;
      // Ensure teamB is not same as teamA (for odd team counts)
      pair.team_b_id = (teamB && teamB.id !== teamA?.id) ? teamB.id : null;
      pair.status = (pair.team_a_id && pair.team_b_id) ? "ready" : "waiting";
    }

    setDraftPairings((prev) =>
      prev.map((pairing) => {
        const replacement = next.find((entry) => entry.id === pairing.id);
        return replacement ?? pairing;
      })
    );
    setHasDraftChanges(true);
    onStatusChange?.("Teams seeded (1 vs 24, 2 vs 23...). Review and click Save Pairings.");
  }, [draftPairings, onStatusChange, qualifiedTeams]);

  useEffect(() => {
    if (setupDone && qualifiedTeams.length >= ROUND1_SURVIVOR_LIMIT && draftPairings.length >= ROUND2_PAIR_COUNT && !pairingStarted) {
      const allEmpty = draftPairings.every(p => !p.team_a_id && !p.team_b_id);
      if (allEmpty) {
        autoPair();
      }
    }
  }, [setupDone, qualifiedTeams, draftPairings, pairingStarted, autoPair]);

  const setupPairings = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLoading(true);
    onStatusChange?.("Preparing Round 2 pair arena...");
    try {
      const response = await fetch("/api/admin/pair-battle/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ roundId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        onStatusChange?.(data.error ?? "Unable to prepare pairs");
        return;
      }

      await fetchQualifiedTeams();
      await fetchPairingStatus();

      const nextPairings = Array.isArray(data.pairings) ? data.pairings : [];
      if (nextPairings.length === 0) {
        onStatusChange?.("Pair setup unlocked. Waiting for round rows...");
        return;
      }

      onStatusChange?.("Pair battle setup unlocked. Auto-seeding Top 24...");
      // Auto-pair will be triggered by state updates from fetchQualifiedTeams/fetchPairingStatus
      // but we can force a logic check here or use a useEffect
    } finally {
      setLoading(false);
    }
  }, [fetchPairingStatus, fetchQualifiedTeams, getAdminHeaders, onStatusChange, roundId]);

  const assignTeam = useCallback(async (pairingId: string, teamId: string | null, slot: "a" | "b") => {
    const headers = await getAdminHeaders();
    if (!headers) return false;
    const response = await fetch("/api/admin/pair-battle/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ pairingId, teamId, slot }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to assign team");
      return false;
    }
    onStatusChange?.(data.message ?? "Pair updated");
    return true;
  }, [getAdminHeaders, onStatusChange]);

  const handleDropOnSlot = useCallback(async (pairingId: string, slot: "a" | "b") => {
    if (!draggedTeam) return;
    setDragOverSlot(null);
    setDraftPairings((prev) => {
      const next = prev.map((pairing) => ({ ...pairing }));
      const target = next.find((pairing) => pairing.id === pairingId);
      if (!target) return prev;

      const targetKey = slot === "a" ? "team_a_id" : "team_b_id";
      const sourcePairing = next.find((pairing) => pairing.team_a_id === draggedTeam.teamId || pairing.team_b_id === draggedTeam.teamId);
      const sourceKey = sourcePairing?.team_a_id === draggedTeam.teamId ? "team_a_id" : sourcePairing?.team_b_id === draggedTeam.teamId ? "team_b_id" : null;
      const occupiedTeamId = target[targetKey] as string | null;

      if (sourcePairing && sourceKey) {
        sourcePairing[sourceKey] = occupiedTeamId;
        const sourceTeamA = sourcePairing.team_a_id;
        const sourceTeamB = sourcePairing.team_b_id;
        sourcePairing.status = sourceTeamA && sourceTeamB ? "ready" : "waiting";
      }

      target[targetKey] = draggedTeam.teamId;
      const targetTeamA = target.team_a_id;
      const targetTeamB = target.team_b_id;
      target.status = targetTeamA && targetTeamB ? "ready" : "waiting";

      return next;
    });
    setHasDraftChanges(true);
    setDraggedTeam(null);
  }, [draggedTeam]);

  const savePairings = useCallback(async () => {
    const fullPairs = draftPairings.filter((pairing) => pairing.team_a_id && pairing.team_b_id).length;
    if (fullPairs === 0 && !hasDraftChanges) {
      onStatusChange?.("No pairings ready to save yet.");
      return;
    }

    const changed = draftPairings
      .map((draft) => {
        const current = pairings.find((pairing) => pairing.id === draft.id);
        if (!current) return null;
        return {
          id: draft.id,
          teamAChanged: draft.team_a_id !== current.team_a_id,
          teamBChanged: draft.team_b_id !== current.team_b_id,
          teamA: draft.team_a_id,
          teamB: draft.team_b_id,
        };
      })
      .filter((entry) => entry && (entry.teamAChanged || entry.teamBChanged));

    if (changed.length === 0) {
      setHasDraftChanges(false);
      onStatusChange?.(`Pairings confirmed. ${fullPairs}/${ROUND2_PAIR_COUNT} battle rows are ready.`);
      return;
    }

    setLoading(true);
    for (const change of changed) {
      if (!change) continue;
      if (change.teamAChanged) {
        const ok = await assignTeam(change.id, change.teamA, "a");
        if (!ok) {
          setLoading(false);
          return;
        }
      }
      if (change.teamBChanged) {
        const ok = await assignTeam(change.id, change.teamB, "b");
        if (!ok) {
          setLoading(false);
          return;
        }
      }
    }

    await fetchPairingStatus();
    setLoading(false);
    onStatusChange?.(`Pairings saved. ${fullPairs}/${ROUND2_PAIR_COUNT} battle rows are ready.`);
  }, [assignTeam, draftPairings, fetchPairingStatus, hasDraftChanges, onStatusChange, pairings]);

  const saveMasterColorCodes = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    const entries = Object.entries(masterColorCodes)
      .map(([color, code]) => ({ color, code: code.trim() }))
      .filter((entry) => /^\d{4}$/.test(entry.code));

    if (entries.length === 0) {
      onStatusChange?.("Enter at least one valid 4-digit master color code.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/admin/pair-battle/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ mode: "save_color_codes", entries }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to save color master codes");
      return;
    }
    onStatusChange?.("Master color code panel saved.");
  }, [getAdminHeaders, masterColorCodes, onStatusChange]);

  const savePairColors = useCallback(async (pairingId: string) => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    const draft = pairColorDraft[pairingId];
    if (!draft || !draft.a || !draft.b) {
      onStatusChange?.("Select both team colors before saving.");
      return;
    }

    setCodeBusy((prev) => ({ ...prev, [pairingId]: true }));
    const response = await fetch("/api/admin/pair-battle/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        mode: "assign_pair_colors",
        pairingId,
        teamAColor: draft.a,
        teamBColor: draft.b,
        allowRepeat: allowColorRepeat,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setCodeBusy((prev) => ({ ...prev, [pairingId]: false }));
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to assign colors");
      return;
    }
    onStatusChange?.("Pair colors assigned and synced to team codes.");
    await fetchPairingStatus();
  }, [allowColorRepeat, fetchPairingStatus, getAdminHeaders, onStatusChange, pairColorDraft]);

  const autoAssignColors = useCallback(() => {
    const next: Record<string, { a: string; b: string }> = {};
    draftPairings.forEach((pairing, index) => {
      const colorA = BATTLE_COLOR_PALETTE[(index * 2) % BATTLE_COLOR_PALETTE.length]?.name ?? "";
      const colorB = BATTLE_COLOR_PALETTE[(index * 2 + 1) % BATTLE_COLOR_PALETTE.length]?.name ?? "";
      next[pairing.id] = { a: colorA, b: colorB };
    });
    setPairColorDraft(next);
    onStatusChange?.("Color notes auto-assigned. Review and save each pair.");
  }, [draftPairings, onStatusChange]);

  const shufflePairings = useCallback(() => {
    const orderedPairs = [...draftPairings].sort((a, b) => {
      const aNum = a.pair_number ?? 999;
      const bNum = b.pair_number ?? 999;
      if (aNum !== bNum) return aNum - bNum;
      return 0;
    });
    const teamPool = [...qualifiedTeams].sort(() => Math.random() - 0.5);
    if (orderedPairs.length === 0 || teamPool.length === 0) {
      onStatusChange?.("Setup pairs and qualified teams first");
      return;
    }

    const next = orderedPairs.map((pairing) => ({ ...pairing }));
    for (let i = 0; i < Math.min(ROUND2_PAIR_COUNT, orderedPairs.length); i += 1) {
      const pair = next[i];
      const teamA = teamPool[i * 2];
      const teamB = teamPool[i * 2 + 1];
      pair.team_a_id = teamA?.id ?? null;
      pair.team_b_id = teamB?.id ?? null;
      pair.status = pair.team_a_id && pair.team_b_id ? "ready" : "waiting";
    }

    setDraftPairings((prev) =>
      prev.map((pairing) => {
        const replacement = next.find((entry) => entry.id === pairing.id);
        return replacement ?? pairing;
      }),
    );
    setHasDraftChanges(true);
    onStatusChange?.("Pairings shuffled. Review and click Save Pairings.");
  }, [draftPairings, onStatusChange, qualifiedTeams]);

  const randomGenerateMasterCodes = useCallback(() => {
    setMasterColorCodes((prev) => {
      const next = { ...prev };
      BATTLE_COLOR_PALETTE.forEach((entry) => {
        if (lockedMasterColors[entry.name]) return;
        next[entry.name] = random4Digits();
      });
      return next;
    });
    onStatusChange?.("Master color codes randomized (locked colors kept).");
  }, [lockedMasterColors, onStatusChange]);

  const resetMasterCodes = useCallback(() => {
    setMasterColorCodes((prev) => {
      return {
        ...prev,
        ...DEFAULT_BATTLE_COLOR_CODES,
      };
    });
    onStatusChange?.("Master color codes reset to the fixed Round 2 mapping.");
  }, [lockedMasterColors, onStatusChange]);

  const postPairAction = useCallback(async (
    pairingId: string,
    action: "force_winner" | "simulate_attempt" | "replay_pair",
    payload: Record<string, unknown> = {},
  ) => {
    const headers = await getAdminHeaders();
    if (!headers) return false;
    setLiveBusy((prev) => ({ ...prev, [`${action}-${pairingId}`]: true }));
    const response = await fetch("/api/admin/pair-battle/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ roundId, pairingId, action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    setLiveBusy((prev) => ({ ...prev, [`${action}-${pairingId}`]: false }));
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to run pair action");
      return false;
    }
    onStatusChange?.(data.message ?? "Pair action complete");
    await fetchPairingStatus();
    return true;
  }, [fetchPairingStatus, getAdminHeaders, onStatusChange, roundId]);

  const forceWinner = useCallback(async (pairing: PairPairing, winnerTeamId: string | null) => {
    if (!winnerTeamId) {
      onStatusChange?.("Select a valid winner team first.");
      return;
    }
    await postPairAction(pairing.id, "force_winner", { winnerTeamId, codeAttempt: "FORCED" });
  }, [onStatusChange, postPairAction]);

  const simulateAttempt = useCallback(async (pairing: PairPairing, teamId: string | null, isCorrect: boolean) => {
    if (!teamId) {
      onStatusChange?.("Select a valid team for simulation.");
      return;
    }
    await postPairAction(pairing.id, "simulate_attempt", {
      teamId,
      isCorrect,
      codeAttempt: isCorrect ? (teamId === pairing.team_a_id ? (pairing.team_a_code ?? random4Digits()) : (pairing.team_b_code ?? random4Digits())) : random4Digits(),
    });
  }, [onStatusChange, postPairAction]);

  const replayPair = useCallback(async (pairingId: string) => {
    await postPairAction(pairingId, "replay_pair");
  }, [postPairAction]);

  const seedDemoTeams = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLoading(true);
    const response = await fetch("/api/admin/pair-battle/demo-seed", {
      method: "POST",
      headers,
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to seed demo teams");
      return;
    }
    onStatusChange?.(data.message ?? "Demo teams seeded.");
    await fetchQualifiedTeams();
  }, [fetchQualifiedTeams, getAdminHeaders, onStatusChange]);

  const setPairCode = useCallback(async (pairingId: string) => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    const code = (pairCodeInputs[pairingId] ?? "").trim();
    if (!/^\d{4}$/.test(code)) {
      onStatusChange?.("Pair code must be exactly 4 digits");
      return;
    }
    setCodeBusy((prev) => ({ ...prev, [pairingId]: true }));
    const response = await fetch("/api/admin/pair-battle/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ pairingId, code }),
    });
    const data = await response.json().catch(() => ({}));
    setCodeBusy((prev) => ({ ...prev, [pairingId]: false }));
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to set code");
      return;
    }
    onStatusChange?.("Battle code saved");
    await fetchPairingStatus();
  }, [fetchPairingStatus, getAdminHeaders, onStatusChange, pairCodeInputs]);

  const autoGenerateCodes = useCallback(async () => {
    if (hasDraftChanges) {
      onStatusChange?.("Save Pairings first before generating codes.");
      return;
    }
    const readyPairs = pairings.filter((pairing) => pairing.team_a_id && pairing.team_b_id);
    if (readyPairs.length === 0) {
      onStatusChange?.("Assign teams before generating codes");
      return;
    }
    const generated = new Map<string, string>();
    readyPairs.forEach((pairing) => {
      generated.set(pairing.id, random4Digits());
    });
    setPairCodeInputs((prev) => {
      const next = { ...prev };
      generated.forEach((code, pairingId) => {
        next[pairingId] = code;
      });
      return next;
    });
    onStatusChange?.("Codes generated. Save each pair or use Save All Codes.");
  }, [hasDraftChanges, onStatusChange, pairings]);

  const saveAllCodes = useCallback(async () => {
    if (hasDraftChanges) {
      onStatusChange?.("Save Pairings first before saving codes.");
      return;
    }
    const targetPairs = pairings.filter((pairing) => pairing.team_a_id && pairing.team_b_id);
    if (targetPairs.length === 0) {
      onStatusChange?.("No full pairs available for code assignment");
      return;
    }
    setLoading(true);
    for (const pairing of targetPairs) {
      const code = (pairCodeInputs[pairing.id] ?? "").trim();
      if (!/^\d{4}$/.test(code)) continue;
      await setPairCode(pairing.id);
    }
    setLoading(false);
    onStatusChange?.("All valid pair codes saved.");
  }, [hasDraftChanges, onStatusChange, pairCodeInputs, pairings, setPairCode]);

  const startPairingBattle = useCallback(async () => {
    if (hasDraftChanges) {
      onStatusChange?.("Save Pairings before starting Round 2.");
      return;
    }
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLoading(true);
    const response = await fetch("/api/admin/pair-battle/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ roundId }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to start pair battle");
      return;
    }
    onStatusChange?.("Round 2 pair battle started.");
    setPairingStarted(true);
    await fetchPairingStatus();
  }, [fetchPairingStatus, getAdminHeaders, hasDraftChanges, onStatusChange, roundId]);

  const resetPairings = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLoading(true);
    const response = await fetch("/api/admin/pair-battle/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ roundId }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to reset pairings");
      return;
    }
    setPairings([]);
    setDraftPairings([]);
    setHasDraftChanges(false);
    setSetupDone(false);
    setPairingStarted(false);
    onStatusChange?.(data.message ?? "Pairings reset");
  }, [getAdminHeaders, onStatusChange, roundId]);

  const resetSinglePair = useCallback(async (pairingId: string) => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLiveBusy((prev) => ({ ...prev, [`reset-${pairingId}`]: true }));
    const response = await fetch("/api/admin/pair-battle/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ roundId, pairingId }),
    });
    const data = await response.json().catch(() => ({}));
    setLiveBusy((prev) => ({ ...prev, [`reset-${pairingId}`]: false }));
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to reset pair");
      return;
    }
    onStatusChange?.(data.message ?? "Pair reset");
    await fetchPairingStatus();
  }, [fetchPairingStatus, getAdminHeaders, onStatusChange, roundId]);

  const endRoundManually = useCallback(async () => {
    const headers = await getAdminHeaders();
    if (!headers) return;
    setLoading(true);
    const response = await fetch("/api/admin/rounds/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ action: "end", roundNumber: 2 }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      onStatusChange?.(data.error ?? "Unable to end round 2");
      return;
    }
    onStatusChange?.("Round 2 ended manually.");
  }, [getAdminHeaders, onStatusChange]);

  const unassignedTeams = useMemo(() => {
    const assigned = new Set<string>();
    draftPairings.forEach((pairing) => {
      if (pairing.team_a_id) assigned.add(pairing.team_a_id);
      if (pairing.team_b_id) assigned.add(pairing.team_b_id);
    });
    return qualifiedTeams.filter((team) => !assigned.has(team.id));
  }, [draftPairings, qualifiedTeams]);

  const completedPairs = useMemo(
    () => draftPairings.filter((pairing) => pairing.status === "completed").length,
    [draftPairings],
  );

  useEffect(() => {
    void fetchQualifiedTeams();
    void fetchPairingStatus();
  }, [fetchPairingStatus, fetchQualifiedTeams]);

  useEffect(() => {
    if (!setupDone) return;
    const interval = window.setInterval(() => {
      void fetchPairingStatus();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [fetchPairingStatus, setupDone]);

  return (
    <div className="pair-battle-section">
      <h3 className="section-title">☠️ ROUND 2 PAIR BATTLE ARENA</h3>

      {!setupDone ? (
        <div className="pair-setup-card">
          <p className="subtitle">Round 2 Pair Battle is locked and ready.</p>
          <p className="description">
            Top {ROUND2_QUALIFIED_TEAM_LIMIT} survivors enter {ROUND2_PAIR_COUNT} head-to-head duels. Assign pairs, set color notes, and launch battle.
          </p>
          <button className="button-action" onClick={setupPairings} disabled={loading}>
            {loading ? "Setting up..." : "Unlock Pair Setup"}
          </button>
        </div>
      ) : (
        <div className="pair-battle-content">
          <div className="pair-controls">
            <div className="pair-info">
              <span className="info-item">Qualified: {qualifiedTeams.length}/{ROUND2_QUALIFIED_TEAM_LIMIT}</span>
              <span className="info-item">Assigned: {qualifiedTeams.length - unassignedTeams.length}/{ROUND2_QUALIFIED_TEAM_LIMIT}</span>
              <span className="info-item">Completed: {completedPairs}/{ROUND2_PAIR_COUNT}</span>
              {hasDraftChanges && <span className="info-item">Draft changes not saved</span>}
              <span className="info-item status-badge" data-status={pairingStarted ? "active" : "ready"}>
                {pairingStarted ? "LIVE BATTLE" : "SETUP MODE"}
              </span>
            </div>
            <div className="pair-actions">
              {onRoundAction && (
                <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 shadow-lg">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mr-2 pl-2">Mission Control</span>
                  <button
                    className="admin-action-button button-success scale-110"
                    onClick={() => {
                       onRoundAction("start", 2, undefined, "r2-arena-start");
                    }}
                    disabled={roundStatus === "active" || roundStatus === "ended" || actionBusy["r2-arena-start"]}
                  >
                    {actionBusy["r2-arena-start"] ? "Starting..." : "▶ Start Round 2"}
                  </button>
                  <button
                    className="admin-action-button button-danger scale-110"
                    onClick={() => onRoundAction("end", 2, undefined, "r2-arena-end")}
                    disabled={roundStatus !== "active" || actionBusy["r2-arena-end"]}
                  >
                    {actionBusy["r2-arena-end"] ? "Ending..." : "⏹ End Round 2"}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center ml-auto">
                {!pairingStarted && roundStatus !== "active" && (
                  <div className="flex gap-2 items-center opacity-70 hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-slate-500 uppercase font-bold mr-2">Seeding Tools</span>
                    <button className="button-neutral text-xs" onClick={autoPair} disabled={loading}>Auto Pair</button>
                    <button className="button-neutral text-xs" onClick={savePairings} disabled={loading || !hasDraftChanges}>Save Pairings</button>
                    <button className="button-neutral text-xs" onClick={autoAssignColors} disabled={loading}>Auto Colors</button>
                    <button className="button-neutral text-xs" onClick={saveMasterColorCodes} disabled={loading}>Save Codes</button>
                    <button className="button-neutral text-xs" onClick={resetPairings} disabled={loading}>Reset Board</button>
                  </div>
                )}
                {pairingStarted && (
                  <button className="button-danger text-xs" onClick={() => void endRoundManually()} disabled={loading}>
                    Emergency Stop
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pair-board-layout">
            <section className="team-pool-section">
              <h4>Round 1 Top 24 Pool ({unassignedTeams.length} unassigned)</h4>
              <div className="team-pool">
                {unassignedTeams.map((team, index) => (
                  <button
                    key={team.id}
                    type="button"
                    className="team-chip"
                    data-rank-group={index < 24 ? "top24" : "other"}
                    draggable
                    onDragStart={() => setDraggedTeam({ teamId: team.id })}
                    title={`#${index + 1} - ${team.leader_name}`}
                  >
                    <div className="team-chip-name">#{index + 1} {team.name}</div>
                    <div className="team-chip-score">SCORE {team.score}</div>
                  </button>
                ))}
                {unassignedTeams.length === 0 && <p className="no-teams">All teams assigned</p>}
              </div>
            </section>

            <section className="pairs-grid">
              {draftPairings.map((pairing, index) => {
                const pairLabel = pairing.pair_number ?? index + 1;
                const pairState = pairing.battle_state ?? pairing.status;
                return (
                  <article key={pairing.id} className={`pair-container pair-status-${pairState}`}>
                    <header className="pair-header">
                      <h5>Pair {pairLabel}</h5>
                      <span className="pair-status-badge">{pairState.replaceAll("_", " ").toUpperCase()}</span>
                    </header>

                    <div
                      className="pair-slot"
                      data-filled={Boolean(pairing.team_a_id)}
                      data-drag-over={dragOverSlot === `${pairing.id}:a`}
                      onDragOver={(event) => event.preventDefault()}
                      onDragEnter={() => setDragOverSlot(`${pairing.id}:a`)}
                      onDragLeave={() => setDragOverSlot((prev) => (prev === `${pairing.id}:a` ? null : prev))}
                      onDrop={() => void handleDropOnSlot(pairing.id, "a")}
                    >
                      {pairing.team_a ? (
                        <div
                          className={`slot-team ${pairing.winner_id === pairing.team_a_id ? "winner" : pairing.status === "completed" ? "loser" : ""}`}
                          draggable
                          onDragStart={() =>
                            pairing.team_a_id && setDraggedTeam({ teamId: pairing.team_a_id, sourcePairingId: pairing.id, sourceSlot: "a" })
                          }
                        >
                          <div className="slot-team-name">{pairing.team_a.name}</div>
                          <div className="slot-team-leader">{pairing.team_a.leader_name}</div>
                          <div className="slot-team-attempts">Attempts: {pairing.team_a_attempts ?? 0}</div>
                        </div>
                      ) : (
                        <div className="slot-empty">Drop Team A</div>
                      )}
                    </div>

                    <div className="pair-divider">⚔️ VS ⚔️</div>

                    <div
                      className="pair-slot"
                      data-filled={Boolean(pairing.team_b_id)}
                      data-drag-over={dragOverSlot === `${pairing.id}:b`}
                      onDragOver={(event) => event.preventDefault()}
                      onDragEnter={() => setDragOverSlot(`${pairing.id}:b`)}
                      onDragLeave={() => setDragOverSlot((prev) => (prev === `${pairing.id}:b` ? null : prev))}
                      onDrop={() => void handleDropOnSlot(pairing.id, "b")}
                    >
                      {pairing.team_b ? (
                        <div
                          className={`slot-team ${pairing.winner_id === pairing.team_b_id ? "winner" : pairing.status === "completed" ? "loser" : ""}`}
                          draggable
                          onDragStart={() =>
                            pairing.team_b_id && setDraggedTeam({ teamId: pairing.team_b_id, sourcePairingId: pairing.id, sourceSlot: "b" })
                          }
                        >
                          <div className="slot-team-name">{pairing.team_b.name}</div>
                          <div className="slot-team-leader">{pairing.team_b.leader_name}</div>
                          <div className="slot-team-attempts">Attempts: {pairing.team_b_attempts ?? 0}</div>
                        </div>
                      ) : (
                        <div className="slot-empty">Drop Team B</div>
                      )}
                    </div>

                    {pairing.team_a_id && pairing.team_b_id && (
                      <div className="pair-code-controls">
                        <select
                          className="input-field"
                          value={pairColorDraft[pairing.id]?.a ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPairColorDraft((prev) => ({
                              ...prev,
                              [pairing.id]: { a: value, b: prev[pairing.id]?.b ?? "" },
                            }));
                          }}
                        >
                          <option value="">Team A Color</option>
                          {BATTLE_COLOR_PALETTE.map((entry) => (
                            <option key={entry.name} value={entry.name}>{entry.name}</option>
                          ))}
                        </select>
                        <select
                          className="input-field"
                          value={pairColorDraft[pairing.id]?.b ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPairColorDraft((prev) => ({
                              ...prev,
                              [pairing.id]: { a: prev[pairing.id]?.a ?? "", b: value },
                            }));
                          }}
                        >
                          <option value="">Team B Color</option>
                          {BATTLE_COLOR_PALETTE.map((entry) => (
                            <option key={entry.name} value={entry.name}>{entry.name}</option>
                          ))}
                        </select>
                        <button
                          className="button-primary"
                          onClick={() => void savePairColors(pairing.id)}
                          disabled={hasDraftChanges || codeBusy[pairing.id]}
                        >
                          {codeBusy[pairing.id] ? "Saving..." : "Save Colors"}
                        </button>
                      </div>
                    )}

                    <div className="pair-meta">
                      <span>Colors: {pairing.team_a_color ?? "--"} vs {pairing.team_b_color ?? "--"}</span>
                      <span>Codes: {pairing.team_a_code ?? "----"} / {pairing.team_b_code ?? "----"}</span>
                      <span>Latest: {pairing.team_a_latest_attempt ?? "----"} / {pairing.team_b_latest_attempt ?? "----"}</span>
                      <span>Status: {pairing.status}</span>
                      <span>Time: {formatElapsed(pairing.elapsed_seconds)}</span>
                      <span>Correct Time: {formatElapsed(pairing.solved_elapsed_seconds)}</span>
                      <span>Winner: {pairing.winner_id ? (pairing.team_a_id === pairing.winner_id ? pairing.team_a?.name : pairing.team_b?.name) : "Pending"}</span>
                    </div>

                    <div className="pair-live-actions">
                      <button
                        className="button-neutral"
                        onClick={() => void resetSinglePair(pairing.id)}
                        disabled={Boolean(liveBusy[`reset-${pairing.id}`])}
                      >
                        {liveBusy[`reset-${pairing.id}`] ? "Resetting..." : "Force Reset Pair"}
                      </button>
                      <button
                        className="button-neutral"
                        onClick={() => void replayPair(pairing.id)}
                        disabled={Boolean(liveBusy[`replay_pair-${pairing.id}`])}
                      >
                        {liveBusy[`replay_pair-${pairing.id}`] ? "Syncing..." : "Replay Test"}
                      </button>
                      <button
                        className="button-neutral"
                        onClick={() => void simulateAttempt(pairing, pairing.team_a_id ?? null, false)}
                        disabled={Boolean(liveBusy[`simulate_attempt-${pairing.id}`])}
                      >
                        Sim A Miss
                      </button>
                      <button
                        className="button-neutral"
                        onClick={() => void simulateAttempt(pairing, pairing.team_b_id ?? null, false)}
                        disabled={Boolean(liveBusy[`simulate_attempt-${pairing.id}`])}
                      >
                        Sim B Miss
                      </button>
                      <button
                        className="button-neutral"
                        onClick={() => void forceWinner(pairing, pairing.team_a_id ?? null)}
                        disabled={Boolean(liveBusy[`force_winner-${pairing.id}`])}
                      >
                        Force Winner A
                      </button>
                      <button
                        className="button-neutral"
                        onClick={() => void forceWinner(pairing, pairing.team_b_id ?? null)}
                        disabled={Boolean(liveBusy[`force_winner-${pairing.id}`])}
                      >
                        Force Winner B
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>

          <div className="pair-admin-live">
            <p className="label">ADMIN LIVE CONTROL PANEL</p>
            <p className="text-sm text-slate-300">
              Monitor submissions in real time. Pair outcomes auto-resolve on first correct solve.
            </p>
            <label className="text-xs text-slate-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowColorRepeat}
                onChange={(event) => setAllowColorRepeat(event.target.checked)}
              />
              Repeat mode (allow duplicate colors in same pair)
            </label>
            <button className="button-danger" onClick={() => void endRoundManually()} disabled={loading}>
              {loading ? "Syncing..." : "End Round Manually"}
            </button>
          </div>

          <section className="pair-admin-live admin-live-leaderboard">
            <div className="admin-live-header">
              <p className="label">ADMIN LIVE LEADERBOARD</p>
              <p className="text-sm text-slate-300">Shows the live pair board with colors, codes, latest guesses, and attempt counts.</p>
            </div>
            <div className="admin-live-list">
              {pairings.map((pairing, index) => {
                const pairLabel = pairing.pair_number ?? index + 1;
                const teamAState = pairing.winner_id && pairing.team_a_id === pairing.winner_id ? "winner" : pairing.status === "completed" ? "loser" : "pending";
                const teamBState = pairing.winner_id && pairing.team_b_id === pairing.winner_id ? "winner" : pairing.status === "completed" ? "loser" : "pending";
                return (
                  <article key={pairing.id} className="admin-live-row">
                    <div className="admin-live-pair">Pair {pairLabel}</div>
                    <div className={`admin-live-team ${teamAState}`}>
                      <strong>{pairing.team_a?.name ?? "Awaiting Team"}</strong>
                      <span>Color: {pairing.team_a_color ?? "--"}</span>
                      <span>Code: {pairing.team_a_code ?? "----"}</span>
                      <span>Latest: {pairing.team_a_latest_attempt ?? "--"}</span>
                      <span>Attempts: {pairing.team_a_attempts ?? 0}</span>
                    </div>
                    <div className="admin-live-vs">VS</div>
                    <div className={`admin-live-team ${teamBState}`}>
                      <strong>{pairing.team_b?.name ?? "Awaiting Team"}</strong>
                      <span>Color: {pairing.team_b_color ?? "--"}</span>
                      <span>Code: {pairing.team_b_code ?? "----"}</span>
                      <span>Latest: {pairing.team_b_latest_attempt ?? "--"}</span>
                      <span>Attempts: {pairing.team_b_attempts ?? 0}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="pair-admin-live">
            <div>
              <p className="label">COLOR MASTER CODE PANEL</p>
              <p className="text-sm text-slate-300">Set hidden 4-digit code per official color.</p>
            </div>
            <div className="pairs-grid" style={{ width: "100%" }}>
              {BATTLE_COLOR_PALETTE.map((entry) => {
                const badge = getBattleColor(entry.name);
                return (
                  <div key={entry.name} className="pair-container">
                    <p className="text-xs font-semibold" style={{ color: badge?.hex ?? "#fff" }}>{entry.name}</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      className="input-field"
                      placeholder="0000"
                      value={masterColorCodes[entry.name] ?? ""}
                      disabled={lockedMasterColors[entry.name]}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                        setMasterColorCodes((prev) => ({ ...prev, [entry.name]: digits }));
                      }}
                    />
                    <button
                      type="button"
                      className="button-neutral"
                      style={{ marginTop: "0.5rem", width: "100%" }}
                      onClick={() => {
                        setLockedMasterColors((prev) => ({ ...prev, [entry.name]: !prev[entry.name] }));
                      }}
                    >
                      {lockedMasterColors[entry.name] ? "Unlock Code" : "Lock Code"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .pair-battle-section {
          padding: 1.5rem;
          background: radial-gradient(circle at 20% 0%, rgba(7, 26, 44, 0.7), #171724 55%, #11111a 100%);
          border-radius: 0.75rem;
          margin-bottom: 2rem;
          border: 1px solid rgba(57, 198, 255, 0.35);
          box-shadow: 0 0 40px rgba(41, 168, 255, 0.12), inset 0 0 30px rgba(17, 77, 130, 0.15);
        }
        .section-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: #70d8ff; }
        .pair-setup-card { background: rgba(14, 21, 35, 0.7); padding: 1.25rem; border-radius: 0.5rem; }
        .subtitle { color: #f8fdff; margin-bottom: 0.35rem; }
        .description { color: #a7b4ca; font-size: 0.9rem; margin-bottom: 1rem; }
        .pair-battle-content { display: flex; flex-direction: column; gap: 1rem; }
        .pair-controls { display: flex; flex-direction: column; gap: 0.75rem; background: rgba(15, 18, 33, 0.8); border: 1px solid rgba(121, 220, 255, 0.15); padding: 1rem; border-radius: 0.5rem; }
        .pair-info { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
        .info-item { color: #9cb2d5; font-size: 0.82rem; font-family: var(--font-mono); letter-spacing: 0.06em; }
        .status-badge { border-radius: 9999px; padding: 0.2rem 0.7rem; font-weight: 700; }
        .status-badge[data-status="ready"] { background: rgba(255, 170, 21, 0.18); color: #ffd27d; }
        .status-badge[data-status="active"] { background: rgba(48, 182, 255, 0.18); color: #67d7ff; }
        .pair-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .button-action, .button-neutral, .button-danger { padding: 0.45rem 0.85rem; border-radius: 0.35rem; border: none; font-weight: 700; cursor: pointer; }
        .button-action { background: linear-gradient(135deg, #51ddff 0%, #0ac2ff 100%); color: #041018; }
        .button-neutral { background: #334158; color: #ecf7ff; }
        .button-danger { background: #8a2733; color: #ffe9eb; }
        .button-primary { background: #0ec8ff; color: #021016; border: none; border-radius: 0.35rem; padding: 0.45rem 0.7rem; font-weight: 700; cursor: pointer; }
        .pair-board-layout { display: grid; grid-template-columns: minmax(220px, 280px) 1fr; gap: 1rem; }
        @media (max-width: 1024px) {
          .pair-board-layout { grid-template-columns: 1fr; }
        }
        .team-pool-section { background: rgba(16, 20, 36, 0.76); border: 1px solid rgba(127, 173, 211, 0.2); border-radius: 0.5rem; padding: 0.9rem; }
        .team-pool-section h4 { margin: 0 0 0.75rem; color: #dff3ff; font-size: 0.9rem; }
        .team-pool { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .team-chip { background: #334158; color: #ecf7ff; border-radius: 0.35rem; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.1); min-width: 110px; cursor: grab; text-align: left; transition: all 0.2s; }
        .team-chip[data-rank-group="top24"] { background: linear-gradient(135deg, #34d399 0%, #059669 100%); color: #062016; border-color: rgba(52, 211, 153, 0.4); }
        .team-chip[data-rank-group="other"] { background: linear-gradient(135deg, #f87171 0%, #b91c1c 100%); color: #3b0707; border-color: rgba(248, 113, 113, 0.4); }
        .team-chip-name { font-weight: 800; font-size: 0.78rem; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .team-chip-score { font-size: 0.7rem; opacity: 0.85; margin-top: 0.15rem; font-family: var(--font-mono); }
        .no-teams { color: #6c809e; font-size: 0.8rem; padding: 0.45rem 0; }
        .pairs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem; }
        .pair-container { border: 1px solid rgba(100, 161, 220, 0.26); background: linear-gradient(180deg, rgba(14, 18, 31, 0.95), rgba(11, 15, 25, 0.95)); border-radius: 0.6rem; padding: 0.75rem; box-shadow: inset 0 0 16px rgba(38, 69, 114, 0.2); }
        .pair-container.pair-status-pending { border-color: rgba(255, 208, 91, 0.45); }
        .pair-container.pair-status-solving { border-color: rgba(0, 195, 255, 0.55); box-shadow: 0 0 16px rgba(22, 170, 255, 0.28); }
        .pair-container.pair-status-winner_found { border-color: rgba(47, 224, 114, 0.55); box-shadow: 0 0 16px rgba(68, 231, 128, 0.22); }
        .pair-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
        .pair-header h5 { margin: 0; color: #eef8ff; font-size: 0.9rem; }
        .pair-status-badge { background: rgba(133, 160, 196, 0.25); color: #c9def2; border-radius: 0.25rem; padding: 0.2rem 0.45rem; font-size: 0.65rem; letter-spacing: 0.08em; }
        .pair-slot { border: 1px dashed rgba(124, 167, 210, 0.4); border-radius: 0.35rem; min-height: 66px; display: flex; align-items: center; justify-content: center; background: rgba(6, 10, 20, 0.5); }
        .pair-slot[data-drag-over="true"] { border-color: rgba(57, 223, 255, 0.9); background: rgba(29, 73, 102, 0.3); }
        .slot-empty { color: #6f81a0; font-size: 0.8rem; }
        .slot-team { width: 100%; text-align: center; padding: 0.45rem; border-radius: 0.2rem; }
        .slot-team { cursor: grab; }
        .slot-team.winner { background: rgba(34, 121, 68, 0.25); border: 1px solid rgba(98, 252, 163, 0.45); }
        .slot-team.loser { background: rgba(131, 39, 39, 0.2); border: 1px solid rgba(246, 103, 103, 0.35); }
        .slot-team-name { color: #ecf8ff; font-size: 0.82rem; font-weight: 700; }
        .slot-team-leader, .slot-team-attempts { color: #95a9c7; font-size: 0.68rem; margin-top: 0.15rem; }
        .pair-divider { text-align: center; margin: 0.4rem 0; color: #7e93b6; font-size: 0.78rem; letter-spacing: 0.1em; }
        .pair-code-controls { display: grid; grid-template-columns: 1fr auto; gap: 0.45rem; margin-top: 0.6rem; }
        .input-field { background: rgba(9, 13, 23, 0.8); border: 1px solid rgba(102, 162, 212, 0.4); border-radius: 0.35rem; color: #e6f2ff; padding: 0.45rem 0.6rem; font-family: var(--font-mono); letter-spacing: 0.2em; }
        .pair-meta { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.45rem 0.7rem; color: #84a0c6; font-size: 0.68rem; font-family: var(--font-mono); }
        .pair-live-actions { margin-top: 0.6rem; display: flex; gap: 0.45rem; }
        .pair-admin-live { background: rgba(14, 20, 34, 0.8); border: 1px solid rgba(98, 151, 204, 0.28); border-radius: 0.5rem; padding: 0.9rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem; justify-content: space-between; }
        .admin-live-leaderboard { display: flex; flex-direction: column; align-items: stretch; gap: 0.8rem; }
        .admin-live-header { display: flex; flex-direction: column; gap: 0.15rem; }
        .admin-live-list { display: grid; gap: 0.7rem; width: 100%; }
        .admin-live-row { display: grid; grid-template-columns: 90px 1fr 48px 1fr; gap: 0.65rem; align-items: stretch; padding: 0.7rem; border-radius: 0.45rem; background: rgba(8, 12, 24, 0.82); border: 1px solid rgba(90, 139, 190, 0.25); }
        .admin-live-pair { font-family: var(--font-mono); font-size: 0.72rem; color: #8bc8ff; display: flex; align-items: center; justify-content: center; text-transform: uppercase; letter-spacing: 0.08em; }
        .admin-live-vs { display: flex; align-items: center; justify-content: center; color: #7cd6ff; font-family: var(--font-headline); }
        .admin-live-team { display: flex; flex-direction: column; gap: 0.15rem; border-radius: 0.35rem; padding: 0.55rem 0.65rem; background: rgba(12, 18, 30, 0.78); border: 1px solid rgba(93, 132, 182, 0.25); color: #dfefff; font-size: 0.72rem; }
        .admin-live-team strong { font-size: 0.78rem; color: #fff; }
        .admin-live-team.winner { border-color: rgba(74, 220, 151, 0.7); background: rgba(11, 43, 25, 0.78); box-shadow: 0 0 16px rgba(74, 220, 151, 0.15); }
        .admin-live-team.loser { border-color: rgba(245, 103, 103, 0.55); background: rgba(45, 16, 20, 0.78); }
        .admin-live-team.pending { border-color: rgba(106, 140, 188, 0.28); }
        @media (max-width: 900px) {
          .admin-live-row { grid-template-columns: 1fr; }
          .admin-live-pair, .admin-live-vs { justify-content: flex-start; }
          .admin-live-vs { padding: 0.2rem 0; }
        }
      `}</style>
    </div>
  );
}
