export const ROUND1_SURVIVOR_LIMIT = 24;

export type BattleColor = {
  name: string;
  hex: string;
  glow: string;
  text: string;
};

export const BATTLE_COLOR_PALETTE: BattleColor[] = [
  { name: "Light Green", hex: "#9ee6a3", glow: "rgba(158, 230, 163, 0.45)", text: "#102415" },
  { name: "Light Brown", hex: "#c9a47a", glow: "rgba(201, 164, 122, 0.45)", text: "#24180d" },
  { name: "Yellow", hex: "#ffd84d", glow: "rgba(255, 216, 77, 0.45)", text: "#2b2200" },
  { name: "Light Blue", hex: "#8ccbff", glow: "rgba(140, 203, 255, 0.45)", text: "#0c2033" },
  { name: "White", hex: "#f5f7fb", glow: "rgba(245, 247, 251, 0.42)", text: "#111827" },
  { name: "Pink", hex: "#ff93c9", glow: "rgba(255, 147, 201, 0.45)", text: "#331022" },
  { name: "Orange", hex: "#ffb26b", glow: "rgba(255, 178, 107, 0.45)", text: "#2e1804" },
  { name: "Violet", hex: "#b890ff", glow: "rgba(184, 144, 255, 0.45)", text: "#1f1333" },
];

export function getBattleColor(colorName: string) {
  const normalized = colorName.trim().toLowerCase();
  return BATTLE_COLOR_PALETTE.find((entry) => entry.name.toLowerCase() === normalized) ?? null;
}

