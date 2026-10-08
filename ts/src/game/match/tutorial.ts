// The basic tutorial (#306, smashcraft:docs/design/single-player-modes.md, MVP
// item 3): lessons in training with the partner. Each lesson shows one
// instruction and passes when the sim has counted its action `goal` times,
// then the next lesson starts. The lesson, its count and the "well done"
// pause are training state, so rollback, replay and the checksum carry them.
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { GroundAction, SpecialAction } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { PartnerBehaviour, PartnerEscape, PartnerTech, type TrainingState } from "./trainingState";
import {
  type MatchState, Phase, characterFor, computerActive, cycleSlotMode, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, selectCharacter, selectStage,
  setTraining, setTutorialLesson,
} from "./rules";

/** What a lesson counts, once per occurrence. */
export const LessonAction = { dash: 0, doubleJump: 1, hit: 2, special: 3, dodge: 4, throw: 5, ledge: 6, knockout: 7 } as const;
export type LessonAction = (typeof LessonAction)[keyof typeof LessonAction];

export interface Lesson {
  readonly name: string;
  readonly instruction: string;
  /** What the count line calls one action. */
  readonly counted: string;
  readonly action: LessonAction;
  readonly goal: number;
  /** The partner's damage while the lesson runs. */
  readonly partnerDamage: number;
}

export const LESSONS: readonly Lesson[] = [
  { name: "Move and dash", instruction: "Push left or right to walk. Tap it quickly to dash.", counted: "Dashes", action: LessonAction.dash, goal: 3, partnerDamage: 0 },
  { name: "Jump and double jump", instruction: "Press jump, then press it again in the air to jump a second time. Z or left-stick click (L3) always short hops, even held.", counted: "Double jumps", action: LessonAction.doubleJump, goal: 3, partnerDamage: 0 },
  { name: "Attacks", instruction: "Walk up to your partner and press attack. Hold a direction to change the attack.", counted: "Hits", action: LessonAction.hit, goal: 5, partnerDamage: 0 },
  { name: "Specials", instruction: "Press special; hold a direction to change the move. Specials are free. Shield + Special in any direction: EX, full bar.", counted: "Specials", action: LessonAction.special, goal: 3, partnerDamage: 0 },
  { name: "Shield and dodge", instruction: "Q: full shield; T: light shield. Shield + left/right rolls; down dodges. Tap Shield before landing to tech; hold left/right to tech roll.", counted: "Dodges", action: LessonAction.dodge, goal: 3, partnerDamage: 0 },
  { name: "Grab and throw", instruction: "Stand next to your partner and press grab. Then push a direction to throw.", counted: "Throws", action: LessonAction.throw, goal: 2, partnerDamage: 0 },
  { name: "Get back to the ledge", instruction: "Jump off, then double jump and up special to the ledge. Up/toward stage climbs; Jump leaps; Shield rolls; Attack strikes; Down/away lets go.", counted: "Ledge grabs", action: LessonAction.ledge, goal: 2, partnerDamage: 0 },
  { name: "Knock out your partner", instruction: "Your partner is badly hurt. Hit it hard to knock it off the screen.", counted: "Knockouts", action: LessonAction.knockout, goal: 1, partnerDamage: 150 },
];

/** No lesson: ordinary training. */
export const NO_LESSON = -1;
/** Frames "Well done!" shows before the next lesson counts. */
export const LESSON_CHEER_FRAMES = 120;

export const tutorialOn = (state: Readonly<TrainingState>): boolean => state.lesson !== NO_LESSON;
/** Every lesson has passed. */
export const tutorialFinished = (state: Readonly<TrainingState>): boolean => state.lesson >= LESSONS.length;

/** Starts `lesson` from a count of zero, with the partner standing at the lesson's damage. */
export function beginLesson(state: TrainingState, world: Roster, computerMask: number, lesson: number): void {
  state.lesson = lesson;
  state.lessonCount = 0;
  state.lessonCheer = 0;
  state.behaviour = PartnerBehaviour.stand;
  state.escape = PartnerEscape.none;
  state.tech = PartnerTech.none;
  const info = LESSONS[lesson];
  if (info === undefined) return;
  state.damage = info.partnerDamage;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && participantActive(computerMask, slot)) fighterAt(world, slot).status.damage = f32(info.partnerDamage);
}

// Preallocated: overwritten for every slot at the start of every tutorial frame, rollback included.
const beforeGround: Slots<number> = [0, 0, 0, 0];
const beforeJump: Slots<number> = [0, 0, 0, 0];
const beforeHit: Slots<number> = [0, 0, 0, 0];
const beforeSpecial: Slots<number> = [0, 0, 0, 0];
const beforeGroundDodge: Slots<number> = [0, 0, 0, 0];
const beforeAirDodge: Slots<boolean> = [false, false, false, false];
const beforeThrow: Slots<number> = [0, 0, 0, 0];
const beforeLedge: Slots<number> = [0, 0, 0, 0];
const beforeOut: Slots<boolean> = [false, false, false, false];

export function captureTutorialBefore(world: Roster): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    beforeGround[slot] = f.ground.action;
    beforeJump[slot] = f.jump.serial;
    beforeHit[slot] = f.visuals.hit;
    beforeSpecial[slot] = f.special.action;
    beforeGroundDodge[slot] = f.dodge.groundFrame;
    beforeAirDodge[slot] = f.dodge.airDodging;
    beforeThrow[slot] = f.visuals.throw;
    beforeLedge[slot] = f.ledge.serial;
    beforeOut[slot] = f.status.out;
  }
}

/** How many times this frame a player did `action`; hits, throws and knockouts count on the partner. */
function countAction(action: LessonAction, world: Roster, playerMask: number, computerMask: number): number {
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const player = participantActive(playerMask, slot);
    const partner = participantActive(computerMask, slot);
    const byPlayer = f.hits.lastAttacker !== undefined && participantActive(playerMask, f.hits.lastAttacker);
    if (player && action === LessonAction.dash && f.ground.action === GroundAction.dash && beforeGround[slot] !== GroundAction.dash) count++;
    else if (player && action === LessonAction.doubleJump && f.jump.serial !== beforeJump[slot] && f.jump.isDouble) count++;
    else if (player && action === LessonAction.special && f.special.action !== SpecialAction.none && beforeSpecial[slot] === SpecialAction.none) count++;
    else if (player && action === LessonAction.dodge && ((f.dodge.groundFrame > 0 && beforeGroundDodge[slot] === 0) || (f.dodge.airDodging && !beforeAirDodge[slot]))) count++;
    else if (player && action === LessonAction.ledge && f.ledge.serial !== beforeLedge[slot]) count++;
    else if (partner && byPlayer && action === LessonAction.hit && f.visuals.hit !== beforeHit[slot]) count++;
    else if (partner && byPlayer && action === LessonAction.throw && f.visuals.throw !== beforeThrow[slot]) count++;
    else if (partner && action === LessonAction.knockout && f.status.out && !beforeOut[slot]) count++;
  }
  return count;
}

/** After a tutorial frame: counts the lesson's action, and moves on once the "well done" pause after a pass ends. */
export function advanceTutorial(state: TrainingState, world: Roster, playerMask: number, computerMask: number): void {
  if (state.lessonCheer > 0) {
    state.lessonCheer--;
    if (state.lessonCheer === 0) beginLesson(state, world, computerMask, state.lesson + 1);
    return;
  }
  const lesson = LESSONS[state.lesson];
  if (lesson === undefined) return;
  state.lessonCount = Math.min(lesson.goal, state.lessonCount + countAction(lesson.action, world, playerMask, computerMask));
  if (state.lessonCount >= lesson.goal) state.lessonCheer = LESSON_CHEER_FRAMES;
}

/** The tutorial's on-screen text: the lesson, its instruction and the count, or the finish. */
export function tutorialText(state: Readonly<TrainingState>): string {
  if (tutorialFinished(state)) return "Tutorial complete!\nYou know the basics. Pause and press Escape to go back to fighter selection.";
  const lesson = LESSONS[state.lesson];
  if (lesson === undefined) return "";
  const heading = `Lesson ${state.lesson + 1} of ${LESSONS.length}: ${lesson.name}`;
  if (state.lessonCheer > 0) return `${heading}\nWell done!${state.lesson + 1 < LESSONS.length ? " Next lesson coming up." : ""}`;
  return `${heading}\n${lesson.instruction}\n${lesson.counted}: ${state.lessonCount} / ${lesson.goal}`;
}

/** The lesson choice on the tutorial menu. */
export const lessonChoiceText = (lesson: number): string => {
  const info = LESSONS[lesson < 0 ? 0 : lesson];
  return info === undefined ? "" : `${(lesson < 0 ? 0 : lesson) + 1}. ${info.name}`;
};

/** The Training stage: the flat Sky Deck. */
export const TUTORIAL_STAGE = 0;

/**
 * From fighter selection: a computer partner in the first free slot when
 * there is none, the chosen lesson (the first when none is chosen), every
 * present player on the fighter they have, and stage selection on the
 * Training stage. The match starts once every client has loaded it. False
 * when the menus could not get there.
 */
export function prepareTutorial(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu || !humanPresent(game, slot)) return false;
  if (!PARTICIPANT_SLOTS.some(other => computerActive(game, other))) {
    const partner = PARTICIPANT_SLOTS.find(other => !humanFighterActive(game, other) && !computerActive(game, other));
    // An empty slot becomes a human fighter, then a computer.
    if (partner !== undefined) for (let step = 0; step < 2; step++) cycleSlotMode(game, first, partner);
  }
  setTraining(game, slot, true);
  setTutorialLesson(game, slot, game.trainer.lesson < 0 || game.trainer.lesson >= LESSONS.length ? 0 : game.trainer.lesson, LESSONS.length);
  for (const other of PARTICIPANT_SLOTS) if (humanFighterActive(game, other) && humanPresent(game, other)) selectCharacter(game, other, characterFor(game, other) ?? game.characterChoices[other]);
  if (!requestStageSelect(game, slot)) return false;
  selectStage(game, slot, TUTORIAL_STAGE);
  return true;
}

/** Steps the tutorial menu's lesson through every lesson in either direction. */
export function stepTutorialLesson(game: MatchState, slot: number, direction: number): void {
  const current = game.trainer.lesson < 0 || game.trainer.lesson >= LESSONS.length ? 0 : game.trainer.lesson;
  setTutorialLesson(game, slot, floorMod(current + direction, LESSONS.length), LESSONS.length);
}
