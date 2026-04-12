export const TEST_MODE_KEY = "symposium_test_mode";

export function isTestModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TEST_MODE_KEY) === "true";
}

export function enableTestMode() {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEST_MODE_KEY, "true");
  localStorage.setItem("team_id", "test-team");
  localStorage.setItem("player_name", "TEST_OPERATOR");
  localStorage.setItem("is_leader", "true");
}

export function disableTestMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TEST_MODE_KEY);
}

