import type { FighterRig } from '../canonical-rig';
import * as rifleman from './rifleman';
import * as illidan from './illidan';
import * as blademaster from './blademaster';
import * as mountainking from './mountainking';
import * as warden from './warden';
import * as lich from './lich';
import * as forsakenpaladin from './forsakenpaladin';
import * as dreadlord from './dreadlord';
import * as shadowhunter from './shadowhunter';
import * as pitlord from './pitlord';
import * as beastmaster from './beastmaster';
import * as lichking from './lichking';
import * as thrall from './thrall';
import * as jaina from './jaina';
import * as sylvanas from './sylvanas';
import * as cairne from './cairne';
import * as chen from './chen';
import * as peon from './peon';
import * as tinker from './tinker';
import * as kaelthas from './kaelthas';
import * as murloc from './murloc';
import * as grom from './grom';
import * as anubarak from './anubarak';
import * as malfurion from './malfurion';
import * as medivh from './medivh';
import * as kobold from './kobold';

/** Every fighter's Classic and Definitive mappings onto the canonical rig, by character (#366). */
export const FIGHTER_RIGS: ReadonlyMap<number, FighterRig> = new Map([
    rifleman, illidan, blademaster, mountainking, warden, lich, forsakenpaladin, dreadlord, shadowhunter, pitlord, beastmaster, lichking, thrall,
    jaina, sylvanas, cairne, chen, peon, tinker, kaelthas, murloc, grom, anubarak, malfurion, medivh, kobold,
].map(rig => [rig.character, rig as FighterRig]));
