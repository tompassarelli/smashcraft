import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { LICH_KING_STOCK_SCALE } from "../assets/importedModelInfo";







export const FIGHTER_MATCH_SCALE = 1.0;







export const STOCK_MODEL_SCALES: Readonly<Record<Character, { readonly unit: string; readonly scale: number }>> = {
  [Character.anubarak]: { unit: "Ucrl", scale: 1.0 },
  [Character.rifleman]: { unit: "hrif", scale: 1.0 },
  [Character.demonHunter]: { unit: "Edem", scale: 1.0 },
  [Character.chen]: { unit: "Npbm", scale: 1.0 },
  [Character.blademaster]: { unit: "Obla", scale: 1.0 },
  [Character.mountainKing]: { unit: "Hmkg", scale: 1.0 },
  [Character.warden]: { unit: "Ewar", scale: 1.0 },
  [Character.lich]: { unit: "Ulic", scale: 1.0 },
  [Character.forsakenPaladin]: { unit: "Npal", scale: f32(1.2) },
  [Character.dreadlord]: { unit: "Udre", scale: 1.0 },
  [Character.shadowHunter]: { unit: "Oshd", scale: 1.0 },
  [Character.pitLord]: { unit: "Nplh", scale: 1.0 },
  [Character.beastmaster]: { unit: "Nbst", scale: 1.0 },
  [Character.lichKing]: LICH_KING_STOCK_SCALE,
  [Character.thrall]: { unit: "Othr", scale: 1.0 },
  [Character.malfurion]: { unit: "Efur", scale: f32(1.1) },
  [Character.jaina]: { unit: "Hjai", scale: 1.0 },
  [Character.sylvanas]: { unit: "Usyl", scale: 1.0 },
  [Character.cairne]: { unit: "Otch", scale: 1.0 },
  [Character.peon]: { unit: "opeo", scale: 1.0 },
  [Character.tinker]: { unit: "Ntin", scale: 1.0 },
  [Character.kaelthas]: { unit: "Hblm", scale: 1.0 },
  [Character.kobold]: { unit: "nkob", scale: 1.0 },
  [Character.medivh]: { unit: "nmed", scale: 1.0 },
  [Character.murloc]: { unit: "nmrl", scale: 1.0 },
  [Character.grom]: { unit: "Ogrh", scale: 1.0 },
};


export function characterModelScale(character: Character): number {
  return f32((STOCK_MODEL_SCALES[character]?.scale ?? 1.0) * FIGHTER_MATCH_SCALE);
}
