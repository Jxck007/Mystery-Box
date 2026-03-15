export const answerModes = ["leader_only", "all_members"] as const;

export type AnswerMode = (typeof answerModes)[number];

export function randomTeamCode(length = 6): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join("");
}

export function normalizeAnswerMode(value: string): AnswerMode {
  if (answerModes.includes(value as AnswerMode)) {
    return value as AnswerMode;
  }
  return "leader_only";
}

export function formatScore(value: number) {
  return value.toLocaleString("en-US");
}
