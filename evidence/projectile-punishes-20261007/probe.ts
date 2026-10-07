import { projectileRows } from "../../scripts/interactions";
import { Character } from "../../src/game/sim/codes";
for (const [character,name] of [[Character.archer,"Archer"],[Character.lich,"Lich"],[Character.lichKing,"Lich King"]] as const) {console.log(JSON.stringify({name, rows:projectileRows(character,name).filter(r=>r.distance===60)}));}
