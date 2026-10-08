// Classic's routes (#284, smashcraft:docs/design/classic-mode.md): each
// fighter's five themed fights, then the lore boss that ends its run, and the
// two or three lines of its ending card.
import { Character } from "../sim/codes";
import type { StageTile } from "../menu/stageCatalog";
import { BossKind } from "./runState";

export interface ClassicRivalFight {
  /** One rival, or two for the route's team fight. */
  readonly rivals: readonly Character[];
  readonly stage: StageTile;
  /** The first rival's transmission before the fight. */
  readonly line: string;
}

export interface ClassicRoute {
  readonly fighter: Character;
  /** The route's one-line story. */
  readonly story: string;
  /** Three single fights, the team fight, then the arch-rival on the fighter's home stage. */
  readonly fights: readonly ClassicRivalFight[];
  readonly boss: BossKind;
  /** The ending card's lines, spoken by the fighter. */
  readonly ending: readonly string[];
}

const C = Character;
const fight = (rivals: Character | readonly Character[], stage: StageTile, line: string): ClassicRivalFight =>
  ({ rivals: typeof rivals === "number" ? [rivals] : rivals, stage, line });

export const CLASSIC_ROUTES: readonly ClassicRoute[] = [
  {
    fighter: C.rifleman, boss: BossKind.lichKing,
    story: "An Ironforge marksman follows Muradin north and finds Frostmourne's master waiting.",
    fights: [
      fight(C.peon, 3, "Work work. Then fight fight."),
      fight(C.shadowHunter, 3, "The Hinterlands trolls remember dwarven powder, mon."),
      fight(C.dreadlord, 6, "Lordaeron's gunners died first. You will be no different."),
      fight([C.lich, C.forsakenPaladin], 4, "Northrend's dead march for their king."),
      fight(C.mountainKing, 11, "Show the Wildhammers what Ironforge powder can do, lad!"),
    ],
    ending: ["The Lich King's crown rolled across the ice, and I didn't miss.", "First round at the Aerie is on Ironforge tonight."],
  },
  {
    fighter: C.demonHunter, boss: BossKind.lichKing,
    story: "Kil'jaeden's deadline runs short: Illidan takes Outland, then races Arthas up Icecrown.",
    fights: [
      fight(C.dreadlord, 6, "The Skull of Gul'dan was never yours to drink from, betrayer."),
      fight(C.murloc, 7, "Mrglglgl! The Broken Isles are ours!"),
      fight(C.kaelthas, 14, "Prove you can feed my people's hunger, and the sin'dorei will follow."),
      fight([C.warden, C.sylvanas], 7, "Ten thousand years I guarded you. I will not lose you now."),
      fight(C.pitLord, 14, "Hellfire Citadel belongs to Magtheridon!"),
    ],
    ending: ["The Frozen Throne is shattered and Kil'jaeden's bargain kept.", "I am Illidan Stormrage, and I answer to no one. Not even this tournament."],
  },
  {
    fighter: C.blademaster, boss: BossKind.archimonde,
    story: "A Burning Blade swordsman cuts across Kalimdor to repay the demon blood of Mannoroth.",
    fights: [
      fight(C.rifleman, 11, "Hold still, greenskin, and this'll be quick."),
      fight(C.jaina, 11, "Theramore wants peace, but I will not let you burn the coast."),
      fight(C.mountainKing, 12, "A blade's no use against a hammer, lad."),
      fight([C.sylvanas, C.warden], 10, "Your blade will serve me better after death."),
      fight(C.pitLord, 3, "Mannoroth's blood still runs in your veins, orc."),
    ],
    ending: ["Archimonde fell to a thousand cuts, and the last one was mine.", "The Burning Blade is no longer the Legion's blade."],
  },
  {
    fighter: C.mountainKing, boss: BossKind.lichKing,
    story: "Muradin Bronzebeard sails to Northrend after Mal'Ganis, toward the sword that betrays him.",
    fights: [
      fight(C.shadowHunter, 3, "Wildhammer and troll, together again in the dirt, mon."),
      fight(C.blademaster, 3, "Your hammer is slow, dwarf."),
      fight(C.dreadlord, 6, "Northrend will be your tomb, Bronzebeard."),
      fight([C.lich, C.forsakenPaladin], 4, "The plague has come for the mountain too."),
      fight(C.rifleman, 12, "Ironforge always fights its friends first, sir!"),
    ],
    ending: ["Frostmourne is broken, and this time it didn't take me with it.", "Pour me a stout. Make it two: one for the lad Arthas used to be."],
  },
  {
    fighter: C.warden, boss: BossKind.kiljaeden,
    story: "Maiev hunts her prisoner from the Broken Isles into the Tomb, where his master Kil'jaeden waits.",
    fights: [
      fight(C.murloc, 7, "Mrrrgl! The tide hides us, the tide hides him!"),
      fight(C.sylvanas, 10, "Your justice means nothing to the Forsaken, Warden."),
      fight(C.kaelthas, 14, "My people chose Illidan. Choose another quarry."),
      fight([C.pitLord, C.dreadlord], 14, "The betrayer's allies guard his trail."),
      fight(C.demonHunter, 7, "You are not prepared, jailor."),
    ],
    ending: ["Kil'jaeden fled the Tomb. His servant is back in his cell.", "Justice is patient. So am I."],
  },
  {
    fighter: C.lich, boss: BossKind.archimonde,
    story: "Kel'Thuzad spreads the plague and opens Dalaran's gate for Archimonde, who has no further use for him.",
    fights: [
      fight(C.rifleman, 11, "That's no farmer, that's a necromancer! Fire!"),
      fight(C.forsakenPaladin, 6, "The Light still burns in Lordaeron, Kel'Thuzad."),
      fight(C.jaina, 11, "You will not open Dalaran to the Legion."),
      fight([C.sylvanas, C.thrall], 10, "The living and the dead both want your master gone, lich."),
      fight(C.sylvanas, 4, "You took my life, lich. I will take your citadel."),
    ],
    ending: ["Archimonde thought his summoner expendable. Naxxramas disagrees.", "The Cult of the Damned will toast my victory. Silently, of course."],
  },
  {
    fighter: C.forsakenPaladin, boss: BossKind.lichKing,
    story: "A risen paladin returns to Stratholme to judge the prince who purged it.",
    fights: [
      fight(C.peon, 3, "Me surrender! Me not like the hammer!"),
      fight(C.blademaster, 3, "Your Light did not save your internment camps, paladin."),
      fight(C.lich, 4, "Even dead, you serve the Scourge."),
      fight([C.sylvanas, C.lich], 4, "Lordaeron's dead have chosen their own king."),
      fight(C.dreadlord, 6, "Welcome back to Stratholme. You know the way to the square."),
    ],
    ending: ["The Lich King fell where the Culling began.", "The Light remembers what I was. Today, I remembered too."],
  },
  {
    fighter: C.dreadlord, boss: BossKind.kiljaeden,
    story: "Mal'Ganis plays every side of the tournament, until Kil'jaeden comes to collect.",
    fights: [
      fight(C.forsakenPaladin, 6, "I have not forgotten Stratholme, dreadlord."),
      fight(C.mountainKing, 12, "I'll knock the horns off ye!"),
      fight(C.demonHunter, 14, "Tichondrius fell to me. You are smaller."),
      fight([C.sylvanas, C.lichKing], 4, "The Forsaken and the Scourge agree on one thing: your exile."),
      fight(C.lich, 6, "The nathrezim no longer command the Scourge."),
    ],
    ending: ["Kil'jaeden retreats, and owes me a favour he will never repay.", "Every side lost the tournament except mine."],
  },
  {
    fighter: C.shadowHunter, boss: BossKind.archimonde,
    story: "A Darkspear shadow hunter carries the voodoo of the Echo Isles to the summit of Hyjal.",
    fights: [
      fight(C.murloc, 7, "Mrgl! The Echo Isles' shore is ours!"),
      fight(C.mountainKing, 12, "The Wildhammer clan owes your kind a beating."),
      fight(C.jaina, 11, "Durotar's trolls are welcome. Their hexes are not."),
      fight([C.lich, C.dreadlord], 4, "The loa cannot protect you from the plague."),
      fight(C.blademaster, 3, "Prove the Darkspear belong in Thrall's Horde."),
    ],
    ending: ["Archimonde was hexed into a frog for one second. It was enough.", "The loa be laughin' tonight, mon."],
  },
  {
    fighter: C.pitLord, boss: BossKind.kiljaeden,
    story: "Magtheridon holds Hellfire Citadel for the Legion until Kil'jaeden judges him a failure.",
    fights: [
      fight(C.peon, 3, "Me quit! Me quit! ...After this fight."),
      fight(C.cairne, 3, "The Earth Mother does not welcome the burning ones."),
      fight(C.kaelthas, 14, "Your citadel is our new home, demon."),
      fight([C.warden, C.sylvanas], 7, "This world belongs to its living and dead. The Legion gets nothing."),
      fight(C.demonHunter, 14, "Hellfire Citadel is mine, Magtheridon."),
    ],
    ending: ["Kil'jaeden came to punish his warden of Outland and left without his horns.", "Hellfire Citadel answers to me."],
  },
  {
    fighter: C.beastmaster, boss: BossKind.kiljaeden,
    story: "Rexxar wanders from Durotar to the Broken Isles, where the Legion's master meddles with the beasts.",
    fights: [
      fight(C.peon, 3, "Me not hungry. Me promise bear not hungry."),
      fight(C.chen, 3, "A brew for a traveller, then a friendly scrap!"),
      fight(C.cairne, 3, "Prove to the tauren that the wilds still trust you."),
      fight([C.jaina, C.rifleman], 11, "Admiral Proudmoore's soldiers want Durotar's coast."),
      fight(C.thrall, 3, "Champion of the Horde, show me your strength."),
    ],
    ending: ["Misha took a bite out of Kil'jaeden. She says he tasted of sulfur.", "The wilds are quiet again. I like them quiet."],
  },
  {
    fighter: C.lichKing, boss: BossKind.kiljaeden,
    story: "Arthas takes the Frozen Throne, then turns its power on the demon who forged the first Lich King.",
    fights: [
      fight(C.mountainKing, 12, "Leave this cursed blade, lad. It's not too late."),
      fight(C.jaina, 11, "Arthas, I still believe there's something left of you."),
      fight(C.sylvanas, 4, "You made me this. Now you face what you made."),
      fight([C.demonHunter, C.kaelthas], 14, "Kil'jaeden's servants race you to the Throne."),
      fight(C.forsakenPaladin, 2, "You are no son of Lordaeron, Arthas."),
    ],
    ending: ["Kil'jaeden made the Lich King to serve him. The Lich King had other plans.", "Every champion of this tournament will kneel. Eventually."],
  },
  {
    fighter: C.thrall, boss: BossKind.archimonde,
    story: "The Warchief leads the Horde to Kalimdor and makes an old enemy an ally at Hyjal.",
    fights: [
      fight(C.rifleman, 11, "No orc escapes Lordaeron's internment camps twice!"),
      fight(C.blademaster, 3, "The Warchief must still prove he can hold a blade."),
      fight(C.cairne, 3, "The tauren will follow you, young Warchief, once I see your strength."),
      fight([C.jaina, C.warden], 10, "Humans and night elves do not trust the Horde. Yet."),
      fight(C.beastmaster, 3, "Durotar's wilds answer to no Warchief."),
    ],
    ending: ["Archimonde fell, and the Horde stood beside the Alliance to see it.", "For the Horde. And this once, for everyone."],
  },
  {
    fighter: C.jaina, boss: BossKind.archimonde,
    story: "Jaina leads Lordaeron's survivors west and forges a truce at the foot of the World Tree.",
    fights: [
      fight(C.peon, 3, "Me not see human lady. Me just chopping."),
      fight(C.lich, 4, "Dalaran's magi will join the Scourge, apprentice."),
      fight(C.lichKing, 2, "Jaina. You should not have come north."),
      fight([C.thrall, C.blademaster], 3, "The Horde will not bow to a human sorceress."),
      fight(C.rifleman, 11, "Theramore's guard wants a word, Lady Proudmoore!"),
    ],
    ending: ["Archimonde is ash beneath Nordrassil. Theramore will have its peace.", "And the tournament will have its champion, if the paperwork clears."],
  },
  {
    fighter: C.sylvanas, boss: BossKind.lichKing,
    story: "The Banshee Queen wins her body back and goes north for her murderer.",
    fights: [
      fight(C.kaelthas, 14, "Ranger-General, Quel'Thalas fell on your watch."),
      fight(C.dreadlord, 6, "The Forsaken will serve the nathrezim, banshee."),
      fight(C.lich, 4, "Kel'Thuzad remembers your screams."),
      fight([C.forsakenPaladin, C.mountainKing], 6, "Lordaeron's old guard does not trust the Forsaken."),
      fight(C.warden, 4, "Your old prison cannot hold all of Lordaeron's dead."),
    ],
    ending: ["The Lich King lies on his own ice. I let him feel the cold.", "Remember who freed Lordaeron, tournament."],
  },
  {
    fighter: C.cairne, boss: BossKind.archimonde,
    story: "The chieftain of the Bloodhoof leads his tribe from Mulgore to the battle for the World Tree.",
    fights: [
      fight(C.peon, 3, "Big cow! Me run!"),
      fight(C.beastmaster, 3, "The beasts of the Barrens follow the strongest."),
      fight(C.pitLord, 14, "Mannoroth's kin will trample your plains."),
      fight([C.lich, C.dreadlord], 4, "The plague crosses the sea to Kalimdor."),
      fight(C.thrall, 3, "Spar with me, old friend. The Earth Mother is watching."),
    ],
    ending: ["Archimonde fell as the Earth Mother asked.", "The tauren walk home to Mulgore with their heads high."],
  },
  {
    fighter: C.chen, boss: BossKind.kiljaeden,
    story: "Chen Stormstout travels the world for the perfect brew, and the Legion spills his last keg.",
    fights: [
      fight(C.peon, 3, "Me want brew! Me fight for brew!"),
      fight(C.beastmaster, 3, "A wanderer's fight first, then a wanderer's drink."),
      fight(C.mountainKing, 12, "Ironforge stout beats panda brew, and I'll prove it!"),
      fight([C.murloc, C.warden], 7, "The Broken Isles keep their secrets."),
      fight(C.thrall, 3, "Durotar welcomes you, brewmaster, once you show your skill."),
    ],
    ending: ["Kil'jaeden had never tasted Thunder Ale. Now he never will.", "A toast to every fighter here. Just one more barrel, and the journey continues."],
  },
  {
    fighter: C.peon, boss: BossKind.archimonde,
    story: "One peon just wanted to chop trees and somehow ended up at the end of the world.",
    fights: [
      fight(C.tinker, 3, "Union rules, pal: goblins get the good jobs."),
      fight(C.rifleman, 11, "Look lads, a lumber thief!"),
      fight(C.warden, 10, "That tree is sacred, orc!"),
      fight([C.blademaster, C.thrall], 3, "Peon! Back to work!"),
      fight(C.shadowHunter, 3, "Even a peon must earn his place in Durotar, mon."),
    ],
    ending: ["Me beat big demon. Me... still have to chop wood?", "Zug zug."],
  },
  {
    fighter: C.tinker, boss: BossKind.archimonde,
    story: "A goblin engineer sells to every side, then tests his best invention on the Legion's master.",
    fights: [
      fight(C.peon, 3, "Me no pay for robot!"),
      fight(C.mountainKing, 12, "Ironforge engineers don't need goblin junk."),
      fight(C.rifleman, 11, "That contraption ain't up to code!"),
      fight([C.pitLord, C.dreadlord], 14, "The Legion pays in fire, goblin."),
      fight(C.chen, 3, "Your gadget leaks worse than my keg!"),
    ],
    ending: ["Archimonde: field-tested and defeated. Patent pending.", "Time is money, friend, and I just made a fortune."],
  },
  {
    fighter: C.kaelthas, boss: BossKind.lichKing,
    story: "The prince of Quel'Thalas avenges his father and his homeland on the one who burned the Sunwell.",
    fights: [
      fight(C.lich, 4, "Your Sunwell fed my master well, prince."),
      fight(C.jaina, 11, "Kael, Dalaran still has a place for you."),
      fight(C.warden, 7, "You chose the betrayer. Now you share his cell."),
      fight([C.dreadlord, C.sylvanas], 6, "Lordaeron's dead do not welcome elves."),
      fight(C.demonHunter, 14, "Show me the power you crave, Kael'thas."),
    ],
    ending: ["Arthas burned the Sunwell. Today, the sin'dorei burned his throne.", "Quel'Thalas will remember this victory."],
  },
  {
    fighter: C.murloc, boss: BossKind.kiljaeden,
    story: "A Broken Isles murloc defends its tide pools from everyone, then from the Legion itself.",
    fights: [
      fight(C.peon, 3, "Fish man scary. Me fight anyway."),
      fight(C.warden, 10, "Stay out of the moonwells, little one."),
      fight(C.kaelthas, 14, "The naga's servants should know their place."),
      fight([C.warden, C.demonHunter], 7, "Even the hunter and her prey agree: clear the shore."),
      fight(C.shadowHunter, 7, "The sea be no place for a frog to win, mon."),
    ],
    ending: ["Mrglglglgl! MRGLGLGL!", "(The murloc has claimed the Tomb of Sargeras as its tide pool.)"],
  },
];

export const CLASSIC_CHARACTERS: readonly Character[] = CLASSIC_ROUTES.map(route => route.fighter);

/** The finished route of `fighter`, or undefined while its story is pending. */
export function classicRoute(fighter: number): ClassicRoute | undefined {
  for (const route of CLASSIC_ROUTES) if (route.fighter === fighter) return route;
  return undefined;
}
