export const TEST_MODE_KEY = "symposium_test_mode";
export const TEST_MODE_COOKIE = "symposium_test_mode";
export const TEST_ROUND_KEY = "symposium_test_round";

export function isTestModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TEST_MODE_KEY) === "true";
}

export function enableTestMode() {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEST_MODE_KEY, "true");
  localStorage.setItem(TEST_ROUND_KEY, "1");
  localStorage.setItem("team_id", "test-team");
  localStorage.setItem("player_name", "TEST_OPERATOR");
  localStorage.setItem("is_leader", "true");
  document.cookie = `${TEST_MODE_COOKIE}=true; path=/; max-age=31536000; samesite=lax`;
}

export function disableTestMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TEST_MODE_KEY);
  localStorage.removeItem(TEST_ROUND_KEY);
  document.cookie = `${TEST_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function getTestRoundNumber(): number {
  if (typeof window === "undefined") return 1;
  const value = Number(localStorage.getItem(TEST_ROUND_KEY) ?? "1");
  if (value === 2 || value === 3) return value;
  return 1;
}

export function setTestRoundNumber(round: number) {
  if (typeof window === "undefined") return;
  const next = round === 2 || round === 3 ? round : 1;
  localStorage.setItem(TEST_ROUND_KEY, String(next));
}

