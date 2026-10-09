import type { MapDeclaration } from "wisp/scripts/mapInfo";

export const SMASHCRAFT_MAP = {
  author: "Tompas",

  description: "Warcraft heroes in a platform fight for up to four. Credits: The Lich King model by Kwaliti (Hive Workshop).",
  suggestedPlayers: "1-4",
  players: [
    { id: 0, name: "Player 1" },
    { id: 1, name: "Player 2" },
    { id: 2, name: "Player 3" },
    { id: 3, name: "Player 4" },
  ],
  forces: [{ name: "Players", playerIds: [0, 1, 2, 3] }],
} as const satisfies MapDeclaration;
