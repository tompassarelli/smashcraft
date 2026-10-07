# Authored fighter animation work

Public references for this work (sources, timestamps, rights) are indexed in
[the animation reference library](design/animation-reference.md).

## Archer ground-attack readability — 2026-10-01

Real inputs select jab (style 0, frame 1026), forward tilt (6, 1086), down
tilt (8, 1145), and up tilt (7, 1199) in grab-pose-passive-r1, with zero
dropped trace records. In that baseline the raised leg was difficult to
distinguish from the head and cape.
Evidence: smashcraft:build/archer-ground-attacks-native.mp4,
smashcraft:build/archer-ground-attacks-trace.txt, and
smashcraft:build/archer-up-tilt-every-frame.png.

The earlier interpretation that Warcraft failed to display the exported
rotation was incorrect. An enlarged native comparison with a held contact
pose in both facings clearly exposes the raised boot beside the head:
smashcraft:build/contact-both-facings-native.png. The low visible boot is the
supporting leg. This establishes the contact pose, not exact live
active-frame alignment or good readability at normal gameplay size.

The existing war3-model evaluator independently places the foot at approximately
(8,-10,106) and the head at z=84.6033, matching the source and reimported model.
Evidence: smashcraft:build/measure-mdx-runtime.js,
smashcraft:build/animation-assets/measure-ground-contact.log, and
smashcraft:build/animation-assets/archer-export-Up-Tilt-contact.png.
The repair separates the torso, free hand and cloth from the striking limb.
Up Tilt moves the foot target from (8,-10,106) to (20,-10,102), opening a
visible gap beside the head. Other contact targets, durations, gameplay root
motion and combat data are unchanged. Source checks preserve all 54 unrelated
Archer actions, including every grab/throw; 10,608 unrelated exported tracks
and Rifleman MDX are unchanged. Evidence:
smashcraft:build/animation-assets/check-silhouette-preservation.log and
smashcraft:build/animation-assets/check-silhouette-package.log.

Native build archer-silhouette-passive-r1 was exercised through jab,
forward/down/up tilt in both facings. The overhead leg now separates from the
head, and down tilt visibly lowers the torso. Right-facing dispatch frames:
247/307/361/415; left-facing: 643/703/757/811. Both traces have zero dropped
records. Evidence: smashcraft:build/archer-silhouette-attacks-native.mp4,
smashcraft:build/archer-silhouette-attacks-trace.txt,
smashcraft:build/archer-silhouette-reverse-native.mp4, and
smashcraft:build/archer-silhouette-reverse-trace.txt. Angled forward tilts have
source previews but were not separately exercised natively in this pass.
The normal and passive maps build with zero errors and six warnings in
unchanged Wurst files. These are single-client visual checks, not multiplayer
or exact per-frame collision-volume acceptance.

Native diagnostics did not support an exporter node-order repair. Renumbering
mixed Bone/Helper IDs distorted the model; converting helpers to bones restored
intact geometry but neither original nor parent-first order changed the pose.
Direct parent translation and a simple rotation both displayed. No exporter
change was made. Evidence: smashcraft:build/node-order-native.png,
smashcraft:build/bone-type-native.png,
smashcraft:build/direct-shift-native.png, and
smashcraft:build/direct-rotation-native.png.

smashcraft:tools/netcode-probe/FighterPlaybackProbe.wurst retains a full
moving clip beside a held contact pose in both facings, enlarged 2x for
inspection. Its generated constant model is a diagnostic only; fighters must
continue through the authored export pipeline.

## Coordinated grab poses — 2026-10-01

Archer and Rifleman now share explicit hold/captive pose authoring. Captive
weapons stay beside their owners; Rifleman's pummel uses a tucked knee while
retaining his grip. Canonical spacing, root positions, timing and damage are
unchanged. Source comparison preserved all 47 Archer and 44 Rifleman actions
outside the grab family, including curve handles and interpolation; package
validation passed. Evidence: smashcraft:build/animation-assets/check-pair-preservation.log
and smashcraft:build/animation-assets/check-pair-package.log.

Native build grab-pose-passive-r1 was exercised with each fighter as holder
against the other. Both right-facing holders visibly reach the captive's upper
body with separated weapons, pummel, and release forward. Both traces record
hold at frame 270, pummel at 295 and forward release at 360, with zero dropped
records. Damage progresses 0 to 3 to 10. Evidence:
smashcraft:build/archer-grab-pose.mp4 and smashcraft:build/archer-grab-pose-trace.txt;
smashcraft:build/rifleman-grab-pose.mp4 and smashcraft:build/rifleman-grab-pose-trace.txt.
Reverse-facing checks now also succeed in `archer-silhouette-passive-r1`.
Archer captures/pummels/releases at frames 354/379/438; Rifleman at
330/355/414. Both show the authored reach, captive pose, pummel and forward
release, with weapons visibly separated and damage progressing 0 to 3 to 10.
Both traces have zero dropped records. Evidence:
smashcraft:build/archer-grab-reverse-r2.mp4,
smashcraft:build/archer-grab-reverse-r2-trace.txt,
smashcraft:build/rifleman-grab-reverse-r2.mp4, and
smashcraft:build/rifleman-grab-reverse-r2-trace.txt.
These establish the repaired hold/pummel/forward-release presentation in both
facings against the other fighter. Mirror grabs, other throw poses in both
facings, exact contact-volume alignment and replay restoration remain open.
These solo checks are not multiplayer validation.

## Native buffered back air — 2026-10-01

Rifleman Jump+C-left is sampled at frame 2233 during jump squat. Both the jump
and back air (style 14) apply at frame 2237, his first airborne frame. The
recording shows the back-kick clip, then recovery and landing. Evidence:
smashcraft:build/rifleman-buffered-bair-native.mp4 and
smashcraft:build/rifleman-buffered-bair-trace.txt (zero dropped records).
This proves this right-facing native buffer case; it is not both-facing
contact/volume acceptance.

Rifleman Jump+Shield+Left also buffers through jump squat: sampled at frame
2594, takeoff/dodge resolves at 2598 and the following trace sample reports
10 landing frames. He visibly slides left from x=284.879; during landing lag
the recorded position reaches x=141.801. No Down input was sent. Evidence:
smashcraft:build/rifleman-buffered-wavedash-native.mp4 and
smashcraft:build/rifleman-buffered-wavedash-trace.txt (zero dropped records).
This verifies the simultaneous-input horizontal wavedash case, not a later
direction change inside jump squat.

The numeric-key variant I+8+W also succeeds with the current custom bindings:
8 maps to action 9, jump+dodge are sampled at 2956, takeoff occurs at 2960,
and the next sample reports 10 landing frames. The recording shows the left
slide (x=29.884 to -113.194 by landing-lag completion). Evidence:
smashcraft:build/rifleman-eight-wavedash-native.mp4 and
smashcraft:build/rifleman-eight-wavedash-trace.txt (zero dropped records).
This is simultaneous input, not a later direction change during jump squat.

## Archer and Rifleman native specials — 2026-10-01

Rifleman's remaining throw directions are also observed in the passive native
match. Forward release at frame 492 takes Archer from 3% after pummel to 10%
and gives 25 hitstun frames. Back release at 1460 takes 13% to 20%, gives 27
hitstun frames and launches behind the left-facing holder. Up release at 1936
takes 23% to 29%, gives 28 hitstun frames and visibly launches vertically.
Combined with the earlier down throw, all four Rifleman directions now have
native selection/contact/release evidence. These older recordings precede the
coordinated grab-pose repair described above.

Evidence: smashcraft:build/rifleman-forward-throw.mp4 and
smashcraft:build/rifleman-forward-throw-trace.txt;
smashcraft:build/rifleman-back-contact.mp4 and
smashcraft:build/rifleman-back-contact-trace.txt;
smashcraft:build/rifleman-up-throw.mp4 and
smashcraft:build/rifleman-up-throw-trace.txt. Each trace has zero dropped records.
The earlier smashcraft:build/rifleman-back-throw.mp4 attempt did not capture:
the approach overshot and the simultaneous turn/grab did not produce contact.
Its trace establishes a missed attempt, not a successful back throw. Settling
position/facing before grabbing produced the recorded successful sequence.
These checks do not establish pivot grabs or both-facing visual acceptance.

Archer's four throw directions have now been exercised through native controls.
Forward is recorded below; the subsequent O-grab/pummel/directional sequences
show the remaining releases:

| Throw | Pummel then throw damage | Release frame | Victim reaction at release |
| --- | --- | --- | --- |
| Back, while facing left | 10% -> 13% -> 20% | 3168 | 26 hitstun frames; victim crosses behind holder and launches right |
| Up, while facing right | 20% -> 23% -> 29% | 3644 | 28 hitstun frames; vertical launch |
| Down, while facing right | 29% -> 32% -> 37% | 4031 | 32 hitstun frames and tumble; floor contact leads to downbound, then prone |

Evidence: smashcraft:build/archer-back-throw.mp4 and
smashcraft:build/archer-back-throw-trace.txt;
smashcraft:build/archer-up-throw.mp4 and
smashcraft:build/archer-up-throw-trace.txt;
smashcraft:build/archer-down-throw.mp4 and
smashcraft:build/archer-down-throw-trace.txt. Each trace reports zero dropped
records. This establishes selection, contact damage and release direction for
these scenarios, not both-facing art acceptance or multiplayer behavior.
Holder/victim overlap is visible in these older recordings; the coordinated
grab-pose section above records the subsequent repair and both-facing checks.

Single-client checks in `special-direction-passive-r1` now show:

- Archer neutral arrow deals 7 damage without a victim hitstun transition.
  Multishot visibly emits its fan after windup; this close-range attempt misses
  after Archer passes the target. Disengage summons the hippogryph, moves Archer
  backward and hits for 8 damage with 5 victim hitlag and 20 hitstun frames.
- Archer Up-B visibly mounts/rises with the hippogryph and returns to the floor.
  The trace ends the special at height 355.12 and records 4 landing frames.
- Rifleman's shot deals 3 damage with 4 victim hitlag and 11 hitstun frames.
  His running bear visibly contacts for 6 damage, 5 hitlag and 15 hitstun.
- Rifleman's trap visibly entombs Archer in ice. Freeze begins at frame 1941;
  Archer becomes actionable at frame 2241 with unchanged damage. This is 300
  simulation frames (five logical seconds at 60 Hz), not physical latency.
- Rifleman Up-B shows a downward projectile and upward fighter movement;
  special 6 ends at height 425.699 before descent and 4 landing frames.

Evidence: smashcraft:build/archer-specials-native.mp4,
smashcraft:build/archer-specials-trace.txt,
smashcraft:build/archer-up-native.mp4,
smashcraft:build/archer-up-trace.txt,
smashcraft:build/rifleman-specials-native.mp4,
smashcraft:build/rifleman-specials-trace.txt,
smashcraft:build/rifleman-up-native.mp4 and
smashcraft:build/rifleman-up-trace.txt.

Arrow jump cancellation remains unverified: the recorded jump follows the end
of the special. Initial Up-B requests during Archer's ledge state and Rifleman's
trap recovery do not activate; separate standing attempts establish activation.
These checks do not establish protection timing, both facings, multishot contact,
complete recovery acceptance, rollback presentation or multiplayer behavior.

Rifleman Shield+O captures Archer at frame 2580, N starts pummel at 2605
(9% -> 12%), and Down selects down-throw at 2641. Release at 2656 gives
29 victim hitstun frames and raises damage to 17%. Video shows pummel/contact
and release, but the held pair overlaps and still needs readability work.
Evidence: smashcraft:build/rifleman-shield-grab.mp4 and
smashcraft:build/rifleman-shield-grab-trace.txt (zero dropped records).
Archer Shield+Attack selects grab style 5, but the preparatory dash overshoots
the opponent; no capture occurs. That recording establishes dispatch only,
not pummel or forward-throw acceptance:
smashcraft:build/archer-shield-grab.mp4 and
smashcraft:build/archer-shield-grab-trace.txt.

With the distance corrected using walk, Archer Shield+Attack captures at frame
2244. N pummels (0% -> 3%); Left while facing left selects forward throw at
2305. Release at 2316 raises Rifleman to 10% and gives 24 hitstun frames.
Evidence: smashcraft:build/archer-shield-grab-contact.mp4, with trace
smashcraft:build/archer-shield-grab-contact-trace.txt (zero dropped records).
Hold/pummel silhouettes still overlap; the forward release is visible.

The near-simultaneous arrow/jump native attempt samples both presses at frame
2616 but starts jump only. It does not prove cancelling an active shot:
smashcraft:build/archer-arrow-jump-native.mp4 and
smashcraft:build/archer-arrow-jump-trace.txt. Current frame ordering advances
movement/jump before starting specials, whose gate rejects jump squat. The
arrow's special state lasts three frames and has zero attack cooldown;
the next-frame shot-to-jump source check now uses complete frame inputs rather
than directly invoking the jump helper. Native sequential cancellation remains
unverified; do not infer it from simultaneous input or a jump after frame three.

A sequential attempt with a 25 ms injected U-to-I gap also arrived in one
synchronized batch: both callbacks at frame 660, both actions sampled at 661,
jump applied at 663, no arrow special started. Evidence:
smashcraft:build/archer-arrow-jump-sequential-native.mp4 and
smashcraft:build/archer-arrow-jump-sequential-trace.txt (zero dropped records).
This documents the baseline's input batching, not a physical latency result
or successful cancellation.

## Demon Hunter completion checklist

Native grounded-action checks in `archer-silhouette-passive-r1` now exercise
Illidan's jab and flat forward/down/up tilts in both facings. The first trace
records activations at frames 247/301/355/403; the reverse trace records
619/673/727/775. Forward and down tilt contact produce victim damage and
hit reactions in the first sequence. Both traces have zero dropped records.
The recordings show distinct blade/body poses, including the low sweep and
raised-blade up tilt. This is action selection and playback evidence, not
exact per-frame volume alignment or acceptance of angled tilts/smashes.
Evidence: smashcraft:build/illidan-ground-attacks-native.mp4,
smashcraft:build/illidan-ground-attacks-trace.txt,
smashcraft:build/illidan-ground-reverse-native.mp4, and
smashcraft:build/illidan-ground-reverse-trace.txt.

Neutral/forward/back aerials also activate from jump-squat inputs in the
left-facing check, at frames 946/1036/1132 (styles 12/13/14). Distinct airborne
poses and return to the stage are visible, with zero dropped trace records.
Evidence: smashcraft:build/illidan-aerials-native.mp4 and
smashcraft:build/illidan-aerials-trace.txt. Contact, opposite-facing aerials,
and exact animation phase restoration remain unverified.

The follow-up left-facing up/down aerial check activates styles 15/16 at
frames 1310/1400. Both play visibly in the air and return to standing; the
down aerial samples neutral movement rather than movement Down. The trace
has zero dropped records. Evidence:
smashcraft:build/illidan-vertical-aerials-native.mp4 and
smashcraft:build/illidan-vertical-aerials-trace.txt. These recordings cover all
five aerial selections in one facing, without establishing aerial contact.

Shield raise/release, spot dodge and both directional rolls are visible in
smashcraft:build/illidan-defense-native.mp4. The fighter changes pose, rolls
along the stage and returns to standing; the short ground sparkle is visible.
smashcraft:build/illidan-defense-trace.txt records the shield/direction inputs
with zero dropped records. This passive-opponent check does not verify the
protection windows or shield-contact reactions.

The earlier normal-bot attempt in smashcraft:build/illidan-parry-native.mp4 and
smashcraft:build/illidan-parry-trace.txt was inconclusive for parry protection.
It does show a stock loss, respawn with damage reset, and resumed actions;
it does not prove every character state resets correctly.

Controlled native parry contact now passes in `illidan-parry-controlled-r1`.
Right+Special starts Illidan's parry and an ordinary Archer jab at frame 91.
At frame 95 the parry cancels, Archer enters the damage pose with 10 hitstun
and 4 hitlag frames, and Illidan remains at 0%. The recording shows his forward
step, the interrupted strike, and Archer recoiling. The unprotected comparison
starts Neutral Special and the same jab at frame 97; contact at frame 101
interrupts Illidan with 7 hitlag, 20 hitstun and 12 damage. Both traces report
zero dropped records. Evidence:
smashcraft:build/illidan-parry-controlled-native.mp4 and
smashcraft:build/illidan-parry-controlled-trace.txt;
smashcraft:build/illidan-control-controlled-native.mp4 and
smashcraft:build/illidan-control-controlled-trace.txt.

Reproduce with `WC3_SCENARIO=parry` through smashcraft:build.sh. Keep the
preselected Illidan versus Archer, start through the menus, and press
Right+Special together. The CPU waits until that physical Special press queues
its jab; neither fighter's contact result or action frame is forced. Load a
fresh match for the Neutral Special comparison. Do not use Ctrl+R: its native
disconnect remains unresolved. The paired smashcraft:wurst/ParryScenarioTests.wurst
test passes through the ordinary match step (1/1); the probe map also builds.
This establishes one grounded, right-facing melee parry. Opposite-facing,
airborne, projectile and exact protection-boundary native cases remain open.

Grounded Immolate contact is observed in Warcraft: one 7-damage hit with
5 victim hitlag frames, 18 hitstun frames and a horizontal launch. Its green
active cue and victim impact are visible. Evidence:
smashcraft:build/illidan-immolate-native.mp4 and
smashcraft:build/illidan-immolate-trace.txt.

The subsequent airborne attempt exposed direction loss, not a verified spike:
Down was held when Special pressed, but both releases arrived before the next
step; Mana Burn was selected. The event trace is
smashcraft:build/illidan-immolate-air-trace.txt (frames 2544–2545).
The input repair captures special direction at its press independently of
current movement axes, records it in frame inputs, and preserves it in copies
and equality checks. The repaired native trace
smashcraft:build/special-direction-release-trace.txt confirms all three events
arrive at frame 1787; frame 1788 has neutral movement and selects Immolate
(special 12). Airborne Immolate also hits a grounded target for 9 damage,
6 victim hitlag and 21 hitstun in
smashcraft:build/special-direction-native-trace.txt and
smashcraft:build/special-direction-native.mp4. That recording establishes
contact against a grounded target, not an offstage spike.

Offstage airborne Immolate now passes in `illidan-spike-controlled-r1`.
The native mirror-match fixture starts both fighters beyond the right ledge,
airborne with ordinary upward velocity. Physical Down+Special is sampled at
frame 13; Immolate contacts at frame 16 for one 9-damage hit, 6 victim hitlag
and 21 hitstun frames. The damage-pose trace records the victim at x=690,
z=296.960 with launch components (+1.172, -9.700), confirming downward
knockback beyond the stage edge at x=600. The recording shows the victim's
damage pose and descent below the stage. Both fighters later lose a stock
and respawn; no recovery inputs were supplied. The trace has zero dropped
records. Evidence: smashcraft:build/illidan-spike-controlled-native.mp4,
smashcraft:build/illidan-spike-controlled-trace.txt and
smashcraft:build/illidan-spike-controlled-sheet.png.

Reproduce with `WC3_SCENARIO=spike` through smashcraft:build.sh; retain the
preselected Illidan mirror match, enable Ctrl+T on Stage Select, start, then
press Down+Special after approximately 0.2 seconds. The fixture seeds only
initial position, facing and airborne motion, and disables CPU decisions;
it does not force the special, contact, damage or launch. The focused
smashcraft:wurst/SpikeScenarioTests.wurst check passes through the ordinary
match step for both sides (1/1 test; smashcraft:build/spike-scenario-test.log).
Native acceptance here is right-facing only; left-facing appearance,
recovery follow-ups and exact contact-volume alignment remain unverified.

Normal and air-dodge landing playback is now observed in Warcraft: both show
the authored contact crouch followed by standing. The clean passive-opponent
trace records 4 normal recovery frames and 10 after air dodge, with no damage
interruptions and zero dropped trace records. Evidence:
smashcraft:build/illidan-landing-passive.mp4,
smashcraft:build/illidan-landing-passive-trace.txt,
smashcraft:build/illidan-normal-landing-frames.png, and
smashcraft:build/illidan-dodge-landing-frames.png. This does not establish
Up-B landing, attack landing, both facings or rollback restoration.

Native checks on 2026-10-01 used `illidan-passive-r1`, the existing knockdown
scenario after both fighters returned to standing. Mana Burn activates from U,
hits for 5 damage and produces victim hitlag/hitstun. E+U activates Immolate
(special 12); R+U activates the parry step (special 10) and moves the fighter.
Those activations do not establish Immolate contact/spike or successful parrying.
The short green/blue-white cues still need closer visual validation.
Earlier active-CPU footage shows Up-B ascent with visible wings.

O captures the passive opponent, N pummels (damage 5 to 8), and Space selects
up-throw (damage 8 to 14), releasing the victim with 25 hitstun frames in the
trace. Pair poses overlap substantially at gameplay scale; readability and
the other three throw directions remain unfinished native checks.
Evidence: smashcraft:build/illidan-passive-specials.mp4,
smashcraft:build/illidan-passive-specials-trace.txt,
smashcraft:build/illidan-passive-grab.mp4,
smashcraft:build/illidan-passive-grab-trace.txt, and
smashcraft:build/illidan-specials-native.mp4. Both passive traces finish with
zero dropped trace records. These are single-client tests, not multiplayer proof.

Illidan selection and HUD integration are implemented in the working source;
he is installed in `illidan-visibility-r1`. Native mirror-match entry works.
The previous black silhouette and surrounding dark geometry are absent in the
recreated match, with both fighters textured in their normal bodies.
The cause is stale mesh action-slot visibility during combat authoring: the
skeleton used Stand Ready while the meshes retained alternate/death visibility.
The author now samples every mesh from Stand Ready. The added scene check fails
on the old jab at frame zero and passes all 81 rebuilt clips while preserving
24 stock actions and 17 source geosets. Export, packaged map build and native mirror-match confirmation passed.
Native evidence: smashcraft:build/illidan-native-match-fixed.png.
Evidence: smashcraft:build/illidan-visibility-before.log and
smashcraft:build/illidan-visibility-after.log. The rebuilt
scene contains 236 bones (including emitter helpers), 17 geosets and 24 stock actions;
At this earlier visibility milestone the authored scene added 81 clips, with 103 exported sequences and validated
bindings in smashcraft:build/illidan-animation/bindings.json. Source commits
096f71e, 57ad0cd and 0ac1db2 preserve the original 24 actions, 17 geosets and
24 FPS timebase. Both-facing previews covered 144 pose samples. Native playback,
action bindings and contact alignment were unverified at that milestone; the
current acceptance below supersedes those gaps. The material repair in
mdl-exporter4 commit 966dbe81178ad1790dc06d1ec58f4792da682349 removes the
white torso polygon in unfiltered side-view previews. Source TeamColor00
panels remain red. Rendered checks cover alpha-over layer composition and
black TeamGlow transparency; export checks preserve source texture paths,
replaceable IDs and filter modes. Native model fidelity was still unverified at that milestone.
Evidence: smashcraft:build/illidan-assets/demonhunter-stock-stand-ready-0-profile.png.

| Required coverage | Current state |
| --- | --- |
| Model, textures, attached blades, both gameplay facings | Rebuilt textured bodies/blades observed against Archer, Rifleman and an Illidan mirror; model, authored contact bounds and local fel cues use scale 0.8 |
| Jab, directional/angled tilts, smashes, dash attack | Authored/bound; both-facing ground-control sequence and charged-smash releases recorded on the rebuilt map |
| Neutral/forward/back/up/down aerials | Authored/bound; all five selections exercised in both facings; exact native collision-volume alignment is not established by the recording |
| Mana Burn, parry/evasion, wing ascent, Immolate | Ground/air clips and fel cues bound; native projectile damage, wings, ground/air Immolate and melee parry observed across the recorded checks |
| Grab, hold, pummel, escape, four coordinated throws | All holder/victim clips bound; native pummel and all four releases contact, including a left-facing back throw; final Illidan mirror capture/pummel/hold/escape shows distinct paired bodies and weapons, with close overlap during the hold |
| Idle, walk/run, turns, crouch, jumps and landings | Dedicated motion history and clips bound; real-control movement/defense sequence and normal/special landing observed |
| Shield, shield reactions/break, spot dodge, rolls, air dodge | Clips bound; ordinary shield depletion visibly pops, lands, stands, enters dizziness and returns to control; repeated native shield contacts select and hold the shield reaction for 4–6 hitlag ticks |
| Ground/air hitstun, tumble, contact-pose hitlag | Authored damage poses; native Illidan mirror contact holds the attacker and victim, then resumes/launches; trace records eight hitlag ticks |
| Knockdown, techs, getup options, ledges, KO and respawn | All clips bound; fourteen floor-contact families pass body/blade grounding; corrected native ledge grip, climb/jump/roll/attack, neutral/both directional techs, and get-up stand/attack/both rolls observed through real controls; offscreen KO exception below |
| Action-frame volumes, interruptions, stock reset and replay | All 88 authored tracks bake body/blade/foot bounds; action sampling follows stretched native clip phase; focused contact, interruption, reset and replay tests pass |
| Portraits, selection, mirror match and rematch retention | Human/CPU selection, mirror entry, HUD, stock loss/respawn and next-match roster retention/damage reset observed |
| Real-control playthrough in Warcraft | Rebuilt map exercised through real keys, including final recovery, paired-pose, shield-contact and incoming-hit checks; normal active-CPU map restored as `illidan-native-complete` |

The completion scene has 88 authored clips / 110 exported sequences, preserving
all 24 stock actions, 17 source geosets, nine original textures, both emitters
and the 24 FPS timebase. The added wing geoset is separate. Every authored clip
has a presentation binding. The resized source suite passes 395/395:
smashcraft:build/wurst-tests/illidan-resized-all.log. Source and package checks
remain distinct from native observation.

Native completion evidence is under smashcraft:build/illidan-native:
completion-controls-r1.mp4, mirror-contact-r1.mp4, mirror-contact-trace.txt,
throw-right-up-trace.txt, throw-back-left-trace.txt, throw-forward-trace.txt,
shield-break-final.mp4 and shield-break-trace.txt. The mirror trace records
15 damage / eight hitlag ticks on the first contact, then a second 5-damage hit
with four hitlag ticks, and zero dropped trace rows. The corrected contact
and release sheets show a held attacker contact pose and victim damage pose,
followed by resumed playback and launch. Recordings are single-client evidence;
they do not prove multiplayer synchronization or every collision frame.

Final native acceptance on 2026-10-01 adds
smashcraft:build/illidan-native/recoveries-final.mp4 and
smashcraft:build/illidan-native/recovery-poses-final.jpg. Neutral tech completes
after 26 frames, both directional techs after 40, get-up stand after 30,
get-up attack after 49, and both get-up rolls after 35. The corresponding
`tech-*-final-trace.txt` and `getup-*-final-trace.txt` files under
smashcraft:build/illidan-native each record zero dropped rows. The mirror grab
sequence captures, pummels, holds, escapes and returns to control; evidence is
smashcraft:build/illidan-native/mirror-pair-escape-final.jpg and
smashcraft:build/illidan-native/mirror-escape-final-trace.txt.

The repaired ledge hang and all four options are recorded in
smashcraft:build/illidan-native/ledge-options-accepted.mp4 and
smashcraft:build/illidan-native/ledge-options-accepted.jpg. The four
`ledge-*-accepted-trace.txt` files under smashcraft:build/illidan-native confirm
the requested transitions and contain zero dropped rows. Final normal-match
shield contact and incoming ground/air reactions are recorded in
smashcraft:build/illidan-native/shield-incoming-accepted.mp4, with the matching
smashcraft:build/illidan-native/shield-contact-accepted-trace.txt and
smashcraft:build/illidan-native/incoming-hit-accepted-trace.txt. Both traces have
zero dropped rows. Build/install of the normal active-CPU map passed in
smashcraft:build/illidan-native/build-normal-complete.log; native entry confirms
build `illidan-native-complete`. This closes the named character acceptance
checks, without claiming exact Melee parity or every native collision frame.

KO is an explicit shared presentation exception: the clip is selected at
blast-zone death, but the offscreen unit is immediately hidden. Visible KO
playback is not claimed. Post-ascent glide remains an unadopted design option.

Wings appear and animate during recovery. Timing and damage live in combat source; new tuning
must remain explicitly provisional, not presented as extracted Melee data.

The earlier packaging milestone passed after repairing binary event and particle import in
mdl-exporter4. The rebuilt model preserves all nine texture entries and two
source particle emitters, suppresses stock particle effects during custom
combat clips, and exported 81 authored clips / 103 sequences. The model and
animation constants are embedded in map builds. Combat bindings cover normal
attacks, aerials, specials, grabs/throws and several defensive/damage states;
movement/defensive mapping and special effects still had gaps at that point.
The current completion checklist above records their subsequent coverage.
Evidence: smashcraft:build/illidan-animation/export-particles-r3.log and
smashcraft:build/illidan-render-r1-map.log.

The integrated source suite passes 360/360 with one existing unused-import
warning: smashcraft:build/wurst-tests/illidan-integration-all.log. Two added
contact regressions first failed in
smashcraft:build/wurst-tests/illidan-integration-before.log: grounded attacks
must reach a standing opponent's origin, and Illidan must retain the shared
grab/getup/ledge attack volumes. This does not verify native controls or poses.

## Archer and Rifleman

Ground-attack pass: Archer's jab now extends her right fist while the left hand
holds the bow back. Her forward tilt and angled variants use extended kicks;
up tilt raises the leg overhead and down tilt lowers into a sweeping kick.
Rifleman now has dedicated rising-rifle up tilt and crouched down tilt clips.
The adapter selects and times these clips explicitly instead of using stock
attack for up/down tilt. Startup, active windows and total combat duration are
unchanged. Walking playback now follows actual horizontal speed.
The shoulder-cloth chain hangs from the moving shoulder during the jab; its
stock inheritance otherwise swings a large flap across the punching arm.

Editable authors: smashcraft:tools/animations/ground_attacks.py and
smashcraft:tools/animations/rifleman.py. Side/reverse previews are generated by
smashcraft:tools/animations/preview-ground.py. The package check verifies contact
timing, held active poses and unchanged non-target clips; see
smashcraft:build/animation-assets/check-ground-preservation.log. This pass still
needs native both-facing checks at gameplay size; Blender views do not prove
Warcraft texture, blend or playback behavior.

Character completion follows the active `smashcraft-character-creation`
skill, owned at
nixos-config:dotfiles/agents/skills/smashcraft-character-creation/SKILL.md.
Every fighter requires grounded/airborne damage reactions and exact hitlag pose
holds, alongside the complete normal, aerial, special, defense and grab/throw
coverage. Hitlag freezes the appropriate contact pose; it is not a looping clip.

Both fighters now have authored Damage Ground, Damage Air, Damage Tumble and
Damage Shield clips in smashcraft:tools/animations/damage.py. Contact is already
posed at frame zero; non-looping clips settle into a held reaction. Wurst selects
ground contact during hitlag, then airborne/tumble presentation on launch.
New damage retriggers the reaction even when the new hitstun is shorter.
Damage selection runs after attack selection, and playback freezes afterward.
Native unit blend time is zero: the first native recording demonstrated that
default blending otherwise retained the old pose throughout the freeze.

Three focused Wurst tests pass; the existing aerial/package preservation check
passes for both fighters. The installed `space-camera-r1` recording shows a
Rifleman grounded recoil held across five simulation hitlag ticks before tumble,
and an Archer grounded recoil held across seven ticks before airborne reaction.
Evidence: smashcraft:build/impact-assets/space-after.mp4 and its matching trace;
contact strips are smashcraft:build/impact-assets/damage-r2-strip.png and
smashcraft:build/impact-assets/damage-archer-r2-strip.png. This verifies those
observed contacts, not exact arbitrary animation seeking or rollback restoration.
Shield reactions, both-facing coverage and replay pose restoration remain open.

The directional-specials pass connects stock bear/hippogryph effect animations
to numerical state. Dedicated body clips now cover neutral fire, fan wind-up,
backward disengage, riding recovery, trap placement and downward
gunshot/recoil. Rifleman summons his bear with the model's stock `Spell`
sequence over the whole 42-frame cast (#111): he rocks back with a raised hand,
then points the rifle forward about as the bear appears on frame 24.
Archer authoring is in smashcraft:tools/animations/archer-specials.py;
Rifleman authoring is in smashcraft:tools/animations/rifleman.py. Separate ground
and air Rifleman shots preserve the frame-2 firing pose despite different
recovery durations. The adapter scales generated clip durations to the current
special's fixed duration and retains hitlag freezing. Simulation tuning is
unchanged. Offline authoring/package checks and the existing aerial-preservation
check pass; native pose alignment and full gameplay acceptance remain open.

Required initial clips from the owner: jab; forward tilt; up-angled forward
tilt; down-angled forward tilt; jump; double jump; forward roll; backward roll;
get-up attack. Blender 5.1.1 is installed. The first Archer jab is authored,
exported and playing in the client. Forward/backward rolls and a spot dodge
are now authored on the same rig, along with jump, double jump, and three
forward-tilt variants. Knockdown, stand-up and get-up attack are also authored;
jab and spot dodge still need visual tuning
at the normal camera distance.

Preserve editable Blender scenes and exported Warcraft model assets. Author
on a rig compatible with the selected Warcraft fighters; do not claim that a
clip from another skeleton can be dropped onto Archer/Rifleman unchanged.
Keep gameplay displacement and collision in simulation; animation follows
logical move timing for anticipation, contact, recovery and invulnerability.

## Candidate tool boundary

Local references downloaded for inspection:

- ~/code/resources/mdl-exporter at 63848b22becd90243cacea661ecc3f0c7d607514
  (https://github.com/khalv/mdl-exporter).
- ~/code/resources/mdl-exporter4 at ce04acf8eb49e31521a09374bec285d5c5e91e89
  (https://github.com/minicolder/mdl-exporter4).

Both are candidate Blender MDL import/export add-ons. The second still declares
Blender 2.80 in its metadata, so its name does not establish compatibility with
the installed Blender. README documents sequence ranges through paired timeline
markers, reference pose at frame zero, and limitations on classic MDL skinning.
The second add-on's animated export is repaired in
~/code/mdl-exporter4/worktrees/blender5 at commit 409e249. Its reader now uses
Blender's layered-action API; the real Blender regression verifies exported
translation keys at 0ms and 833ms. Animated import is repaired at the same API
boundary: actual Archer and Rifleman imports both save editable Blender scenes.
The importer repair is commit 9f8ceb0 in the same checkout.
The Archer check preserves four mesh geosets and animated pose tracks.
The importer warns that version 1800 models load as version 1000; newer model
features may be lost. In-game visual fidelity remains unverified.
The first import → author → export → in-game playback check passed for jab,
but later pose inspection found its imported hierarchy was incomplete.
Tool commit 3631e24 preserves unused imported actions through Blender saves
and preserves the original event tracks. Commit 83d0cf4 preserves Warcraft
texture paths, material layers and replaceable team-color IDs rather than
exporting Blender-local preview paths. These repairs live in the add-on,
not generated-model patches.

Tool commit ebdb212 repairs Parent decoding in the node parser: imported bones
previously became independent roots. The focused Blender regression checks the
expected hierarchy and confirms that root rotation deforms evaluated geometry.
Archer's scene and authored clips were regenerated through the corrected importer.

The add-ons are GPL tools (repository license GPL-3.0; individual source headers
also contain GPL-2.0-or-later notices). They remain standalone local tools,
not code incorporated into Wurst gameplay. Preserve their notices and license
when modifying/distributing tools; do not copy tool code into the game.

The existing local animation-library archive is
~/code/game-assets/quaternius/Universal Animation Library[Standard].zip.
Its listing contains FBX and GLB variants plus License.txt, but rig/clip contents
have not been inspected. It may help with motion reference/retargeting after
skeleton compatibility is established; Warcraft fighters remain the requested
art direction. No assets have been copied from the archive into the map.

## Installed fighter extraction

Run from ~/code/smashcraft/worktrees/test-loop:

```bash
nix shell nixpkgs#gcc nixpkgs#bun --command bash /home/tom/code/smashcraft/worktrees/test-loop/tools/animations/extract.sh
```

Requires ImageMagick on PATH and the built CascLib static library below.
The command extracts Archer and Rifleman from the installed game, converts MDX
to editable MDL, and extracts seven textures to PNG. This installed version
stores DDS textures even though the MDL texture references end in BLP.
Both models have four geosets; Archer has 33 bones/13 sequences, Rifleman has
30 bones/10 sequences. Outputs remain local and ignored under
~/code/smashcraft/worktrees/test-loop/build/animation-assets.
Set the Blender add-on resourceFolder to that directory's textures subfolder.
Extraction does not grant redistribution rights to Blizzard assets.

Save editable scenes with the repaired local add-on:

```bash
blender --background --threads 2 --python-exit-code 1 --python /home/tom/code/smashcraft/worktrees/test-loop/tools/animations/import.py -- archer
blender --background --threads 2 --python-exit-code 1 --python /home/tom/code/smashcraft/worktrees/test-loop/tools/animations/import.py -- rifleman
```

Both commands passed and saved .blend files beside the extracted models.
WC3_MDL_ADDON overrides the local add-on checkout. These scenes preserve
existing motion. The authored jab has a separate editable scene below.

The C++ tool is only the CascLib foreign-library boundary; the TypeScript tool
only converts foreign asset formats. Gameplay remains Wurst.

Dependencies:

- CascLib: https://github.com/ladislav-zezula/CascLib, MIT, upstream
  38a34665624b8775bb875274b36191b21c38d97b plus local portable-pointer repair
  1ccab1a in ~/code/casclib/worktrees/assets. Existing copyright/license notices
  remain in that checkout. No library source is copied into the map project.
- war3-model 4.0.1 (4eb0da/war3-model), pngjs 7.0.0, and transitive gl-matrix
  3.3.0: MIT; exact packages locked in smashcraft:tools/animations/bun.lock.
  Their license notices remain in the installed packages.

Build CascLib from ~/code/casclib/worktrees/assets:

```bash
cmake -S /home/tom/code/casclib/worktrees/assets -B /home/tom/code/casclib/worktrees/assets/build -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_BUILD_TYPE=Release -DCASC_BUILD_SHARED_LIB=OFF -DCASC_BUILD_STATIC_LIB=ON
cmake --build /home/tom/code/casclib/worktrees/assets/build --parallel 2
```

Override CASC_SOURCE or WC3_STORAGE when these local checkout/install paths
change. The full extraction command passed in about five seconds.

## Illidan, portraits and selection art

Illidan's package is regenerated in order from the repository root. Run each
Blender step as `blender --background --python-exit-code 1 --python FILE`:

1. smashcraft:tools/animations/extract-demonhunter.sh extracts the installed
   Demon Hunter model and textures to smashcraft:build/illidan-assets/ with
   the CascLib setup above.
2. smashcraft:tools/animations/import-demonhunter.py saves the editable scene.
3. smashcraft:tools/animations/demonhunter.py authors the combat clips and
   exports the fighter model to smashcraft:build/illidan-animation/.
4. smashcraft:tools/animations/strikes.py `-- illidan` re-authors his weak
   swings (see "Strikes that reach" below), as it does Archer's and Rifleman's
   after their own authoring scripts.
5. smashcraft:tools/animations/check-illidan.py checks that stock actions and
   geosets are unchanged and that combat clips keep the authored visibility,
   root and wing rules, then records the source textures for packaging.
6. `bun tools/animations/package-illidan.ts` encodes the model and regenerates
   smashcraft:ts/src/game/presentation/demonHunterAssetInfo.ts.

smashcraft:tools/selection/render-fighters.ts renders every fighter's grid tile
and card portrait into `ASSETS/fighter-renders/`
(smashcraft:docs/design/fighter-portraits.md), and
smashcraft:tools/selection/build-art.ts renders the selection and HUD textures
from smashcraft:tools/selection/art/ into smashcraft:build/selection-assets/,
with each slot's chip, card and HUD plate in its Warcraft player colour.
The map build imports both from its `--assets` directory.

## Build and play the first authored jab

```bash
nix shell nixpkgs#gcc nixpkgs#bun --command bash /home/tom/code/smashcraft/worktrees/test-loop/tools/animations/build-assets.sh
```

This extracts local game assets, imports a fresh Archer scene, authors jab,
evasion, jump and forward-tilt clips, exports MDL, and packages MDX plus generated Wurst clip metadata. Asset rebuilds
are separate from the normal gameplay loop; smashcraft:build.sh consumes their
outputs without rerunning Blender. The asset command writes logs under
~/code/smashcraft/worktrees/test-loop/build/animation-assets.

Editable scene:
~/code/smashcraft/worktrees/test-loop/build/animation-assets/archer-jab.blend.
Authoring source: smashcraft:tools/animations/jab.py, a Blender API boundary.
The clip uses frames 0–36 at 24fps, with extension at frame 4 and retraction
by frame 18. Wurst scales its exported 1.5-second duration to the simulation's
36 ticks at 60Hz (0.6 seconds), and pauses animation playback during hitlag.
The clip is selected by its generated index rather than Warcraft's random
choice among attack names. Archer's ground dodges also use generated indices;
Rifleman's moves and the remaining Archer moves still use native animations.

Build 212201 loaded the custom model and played jab from the normal N input.
Evidence: ~/code/smashcraft/worktrees/test-loop/build/animation-probe/jab-client.mp4
and ~/code/smashcraft/worktrees/test-loop/build/animation-probe/jab-poses.png.
The first launch became stuck in Warcraft's "Waiting for host" state. Leaving
that map and creating a fresh single-player instance restored input without
restarting the client. The cause remains undiagnosed; it was not counted as
a successful playback check. Full model fidelity and exact visual contact
alignment remain unverified, and the jab motion needs a stronger silhouette.

## Authored Archer evasions

Authoring source: smashcraft:tools/animations/dodges.py. Final editable scene:
~/code/smashcraft/worktrees/test-loop/build/animation-assets/archer-fighter.blend.
The forward/backward clips last 31 source frames (1.292 seconds at 24fps),
and spot dodge lasts 23 frames (0.958 seconds). The adapter scales these
durations to the simulation's 31/23 ticks at 60Hz, freezes playback in hitlag,
and restores normal animation after recovery. The body tumbles in opposite
directions for forward/backward rolls; spot dodge crouches in place.

The full asset build passed after the importer repair, preserving eight
original event tracks. No root translation keys occur within dodge intervals;
gameplay displacement remains solely in Wurst. Generated metadata selects
forward index 7, backward index 6, and spot index 8 in this model, without
hard-coding those numbers into gameplay source. Pose renders establish mesh
deformation; client evidence is recorded separately in smashcraft:evidence/development-plan.md.

The roll authoring axis was corrected after a game-aligned MDX → MDL → Blender
roundtrip render: root X turned the silhouette edge-on, while root Z produced
the stage-plane tumble. This is specific to the imported Archer bone basis;
do not assume another rig shares it. The native forward-roll recording now
shows the tumble. Removing PauseUnit did not solve the wrong-axis motion, so
the adapter retains paused, simulation-controlled bodies.

Spot dodge's pelvis translation uses local negative Y so the exported MDL
translates downward on game Z (0, 0, -13 at its held pose), rather than into
depth. Its visual cue is still subtle at the normal camera and needs stronger
pose tuning. Correct export/playback is not a claim of finished animation art.

## Jump and double jump

`bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
movement-only sequences where stock jumps borrowed an attack or special:
Blademaster and Warden double-jump somersaults, Lich's airborne contraction,
and Dreadlord/Shadow Hunter spring gestures. The flip coils chest, arms and
legs before a full stage-plane rotation, then opens into recovery. It uses
the existing 30 presentation frames; ground jumps retain 24. The tool checks
every previous sequence at start/middle/end, including Blademaster's
Bladestorm, and saves a private both-facing Blademaster silhouette sheet.
Publish the hero-models and original-clips-static-lights families after pool
export. `jumpClips.tests.ts` checks all selectable fighters' jump/double-jump/
fall indices against attacks and grounded/aerial specials in Bun and Lua.

Archer Jump lasts 24 source frames at 24fps; Double Jump lasts 30. Both are
authored by smashcraft:tools/animations/dodges.py in the final fighter scene.
Jump tucks the legs; Double Jump uses the established stage-plane somersault
axis. The packaged MDX roundtrip renders verify the poses and show no root
translation tracks in these clips. Their generated indices remain the only
source for runtime clip selection.

The simulation emits a takeoff counter only when ground squat finishes or an
air jump succeeds. The adapter starts the appropriate clip from that event,
runs it over 24/30 simulation ticks, and cancels it on landing, hitstun,
air dodge or attack. Jump key presses rejected by the simulation cannot restart
the clip. The animation does not change jump velocity or airborne collision.

Build 222152 was observed in Warcraft: ground-jump tuck, double-jump somersault,
descent and return to normal animation. Native playback evidence is at
~/code/smashcraft/worktrees/test-loop/build/animation-probe/jump-client.mp4.
A small arrow-like element remains below the jumping fighter; attachment and
visibility need art cleanup. Native playback is verified, not final visual polish.

Packaged model imports now include a hash of their MDX content in the filename.
The generated Wurst model path and packaged archive entry use the same hash.
This changes resource identity when an asset changes without restarting the
client; unchanged model content retains the same path. A fixed-name restart
kept the previous pose, whereas the new path loaded the regenerated pose.

## Archer forward tilts

The level, up-angled and down-angled forward tilts are authored in
smashcraft:tools/animations/dodges.py and packaged by
smashcraft:tools/animations/package.ts. Each uses 28 source frames, with
extension at frame 5, a held strike through frame 7, and recovery to frame 28.
The adapter scales exported durations to 28 simulation ticks and freezes
playback during hitlag. Generated indices select clips independently of
sequence ordering; simulation owns movement and hit coverage.

The full asset build passed. Exported MDX → Blender side-view strike poses
show distinct level, upward and downward arm positions; evidence is under
~/code/smashcraft/worktrees/test-loop/build/animation-probe/tilt-roundtrip-poses.
These are first-pass animations, not finished Melee-quality motion. Rifleman
still uses its stock attack animation. Native playback evidence and the tested
build are recorded in smashcraft:evidence/development-plan.md.

## Archer knockdown and get-up

smashcraft:tools/animations/dodges.py also authors Knockdown (12 source frames),
Get Up (30), and Get Up Attack (45). The attack sweeps at frames 16–18 and
returns upright by frame 45. As with the other clips, generated metadata
supplies the actual model indices and durations, and Wurst scales playback
onto simulation timing. `grounding.py` now measures the visible skinned mesh at
each source frame and applies the required vertical correction to child and
attachment bones. This keeps the fighter on the stage through the knockdown,
get-up, and get-up attack without adding a `Bone_Root` translation track.

Both fighters now use the same authored recovery clips. The per-frame Blender
check keeps the lowest visible vertex within 0.0001 model units of the preview
stage height across all three clips. The rendered stage-side poses are
smashcraft:build/animation-assets/archer-recovery-knockdown-12.png,
smashcraft:build/animation-assets/archer-recovery-getup-00.png, and the matching
`rifleman-recovery-*` images. Native playback still needs a client check.

One-shot action export is repaired at
~/code/mdl-exporter4/worktrees/blender5, commit 4ce7b32. The action-based path
previously hard-coded looping, which the native recovery check exposed as a
knockdown reset and repeating get-up attack. It now consumes the per-action
`war3_non_looping` property and preserves imported sequence flags. The actual
Blender export regression covers explicit true, false, default and imported
flags. Our authored moves set that property; Stand/Walk remain looping.
Generated model bytes are not patched. Rebuild through the normal asset command.

## Archer projectile ownership

Archer's authored poses now retain the stock held-bow pose through
smashcraft:tools/animations/archer_pose.py. The previous jab keyed only the
right arm; evasions and tilts likewise omitted the left hand and bow grip.
The packaged model consequently had no `Cylinder02` rotation in those clips,
although stock Stand, Walk and Attack rotate that bow bone by 90 degrees.
Its jab roundtrip rendered the bow down beside Archer's legs.

Jab and the other authored body poses now offset Stand Ready, explicitly
keying every bone's rotation and scale and every non-root translation.
Root displacement remains simulation-owned. Non-firing visibility is also
explicit; the bow geometry and original parent hierarchy are preserved.
The packaged MDX check passed for the retained bow rotation in all fourteen
custom clips, complete bone rotation tracks and absent custom root translation.
MDX → MDL → Blender renders show the bow held in jab, all three tilts,
jump and double jump. Sampled stock Stand, Walk and Attack poses still match
the pre-change export. Native attack-to-movement recovery is a separate
adapter/client check; these asset checks do not establish that recovery.

The repaired Archer MDX SHA-256 is
475ae4195dc533dcb6930e208ee52897e1c54fcb7f1f6af0d44082edb9c76372.
Roundtrip images are under
~/code/smashcraft/worktrees/test-loop/build/animation-assets/bow-archer-packaged-*.png.

The fighter no longer includes the stock model's independently animated arrow
geoset. smashcraft:tools/animations/dodges.py removes the unique mesh weighted
only to Arrow, retaining the bone. Actual shots use a separate ArrowMissile
effect positioned by the simulation and destroyed when the shot becomes inactive.

The exporter also now preserves animated and single-key geoset visibility:
~/code/mdl-exporter4/worktrees/blender5 commits edb31e4, 3791fbf, and 40fd706.
The actual-model roundtrip regression failed before repair and passed afterward.
The ordinary asset build completed successfully; its final three geosets retain
their visibility tracks. Model SHA-256:
e9aadd07b65d01276ecc0a582ce48c340f713c17d958e1cb29a45f8b9ff44346.

Native build 062042 shows the shot leaving Archer, moving toward Rifleman, and
vanishing after contact as Rifleman's damage increases. No separate animated
arrow follows Archer. Recorded evidence:
~/code/smashcraft/worktrees/test-loop/build/animation-probe/arrow-native.mp4
and ~/code/smashcraft/worktrees/test-loop/build/animation-probe/arrow-contact-sheet.png.

## Rifleman authored actions

smashcraft:tools/animations/rifleman.py authors jab; level, up-angled and
down-angled forward tilts; jump/double jump; forward/backward roll; spot dodge;
knockdown; stand-up; and get-up attack on Rifleman's own skeleton. The rifle
follows its original grip using baked arm poses; it is not an Archer skeleton
retarget. Root displacement remains simulation-owned. Stock shooting and
unmodified model geometry are retained, while the shell/gore geosets are hidden
during the custom clips.

The normal asset build packages both fighters and generates their clip indices,
durations and model paths in FighterAssetInfo. Model import filenames now use
the full SHA-256 digest; the map builder imports and checks both matching files.
The adapter uses each fighter's generated metadata, scales duration to the
logical move duration, and pauses playback in hitlag. These remain first-pass
combat animations rather than a final polish claim.

The final Rifleman model hash is
6f56de2c8b70c3b18192317024ce69abac54ee3c3832bb2d8f92da55e12c96a3.
Exported checks cover twelve non-looping clips, absent root translation keys,
retained stock Attack, and custom visibility. Exported pose renders and native
build 063805 both show the corrected directional tilts. Native observation and
recording paths are in smashcraft:evidence/development-plan.md.

## Dedicated ledge hang and climb

smashcraft:tools/animations/ledges.py authors Ledge Hang and Ledge Climb on
each fighter's own skeleton, called by the existing Archer and Rifleman author
scripts. Hang holds a raised left arm with relaxed bent legs; climb bends the
supporting arm, lifts the knees and returns to Stand Ready. Rifleman's separate
rifle root follows his torso and retained right-hand grip. The clips contain no
root translation: ledge travel and collision remain simulation-owned.

Hang loops over 24 source frames (1 second); climb is non-looping over 30
frames (1.25 seconds). Generated FighterAssetInfo constants supply
ARCHER_LEDGE_HANG_INDEX, ARCHER_LEDGE_CLIMB_INDEX/SECONDS and the matching
RIFLEMAN constants. The render adapter selects these clips for hang/climb and
scales climb to LEDGE_CLIMB_FRAMES. Roll and attack retain their existing clips.

Both editable fighter scenes and MDX assets were regenerated directly from the
existing source scenes, without extraction or a full asset rebuild. Packaged
MDX checks passed for sequence durations, loop flags, absent root translation
keys and retention of every stock sequence. Exported MDL pose renders show
raised-arm hang and bent-knee pull-up silhouettes for both fighters. Preview
images are local at
~/code/smashcraft/worktrees/test-loop/build/animation-assets/archer-ledge-hang.png,
~/code/smashcraft/worktrees/test-loop/build/animation-assets/archer-ledge-pull.png,
~/code/smashcraft/worktrees/test-loop/build/animation-assets/rifleman-ledge-hang.png
and
~/code/smashcraft/worktrees/test-loop/build/animation-assets/rifleman-ledge-pull.png.
Native Archer fixture ledge-deferred selects the new hanging pose and completes
climb after 25 simulation ticks (entry tick 67, exit tick 92). The original grip
was visibly above/outside the platform endpoint.
The hang screenshot and trace are under
~/code/smashcraft/worktrees/test-loop/build/animation-probe/ledge-climb/.
The original observation did not cover Rifleman or intermediate climb poses.

The contact correction measures the original authored wrists at
(18.386, 7.129, 106.240) for Archer and (17.815, 12.737, 92.941) for Rifleman,
against the former stage-plane requirement (x, z) = (42, 60). The shared hang
anchor is now 24 world units outward and 90 downward, within both rigs' reach.
The Blender boundary reads those dimensions and the climb path dimensions
directly from smashcraft:wurst/Simulation.wurst. Both fighter object definitions
explicitly use model scale one. The support wrist stays on the endpoint through
the first five simulation ticks of climb, then releases toward the ready pose;
root movement remains entirely in the simulation.

Both editable scenes and packaged MDX files were regenerated. MDX → MDL → Blender
checks measured hang wrists at (24.00028, -4.46064, 89.99979) and
(24.00056, 3.55419, 89.99972); all sampled hang and initial climb contact errors
were below 0.001 world units in the stage plane. The generated clips retain
their durations/loop flags and have no root translation keys. All 13 Archer
and 10 Rifleman stock sequence names/loop flags remain; every non-ledge action
channel matches the saved prior scene. The focused Wurst ledge suite passed
13/13 tests. Local check evidence is in
~/code/smashcraft/worktrees/test-loop/build/animation-assets/check-ledge-contact.log
and ~/code/smashcraft/worktrees/test-loop/build/wurst-tests/ledge-contact.log.
Native follow-up in build ledge-contact verified both Archer and Rifleman at
the left endpoint: the supporting hand now meets the lip, and each climbs from
(-624,-90) to (-576,0) in 25 simulation ticks. Screenshots and input traces are
under ~/code/smashcraft/worktrees/test-loop/build/animation-probe/
ledge-contact-archer/ and ledge-contact-rifleman/. This establishes the observed
hang and completed climb, not every intermediate pose or right-edge appearance.

A stock-duration comparison also found existing import/export frame
quantization: Archer Stand - 5 is 3709ms after export versus 3700ms in the
installed model. Non-ledge scene channels are unchanged by this correction;
exact stock millisecond preservation remains an exporter follow-up, outside
this contact fix.

## Aerial clips and interpolation repair

smashcraft:tools/animations/aerials.py authors neutral, forward, back, up and down
aerials for both rigs. The existing author scripts invoke it; generated asset
metadata supplies clip indices/durations to the live attack renderer. Clips
are nonlooping, include complete rotations, retain weapon grips and have no
root travel. These are first-pass authored poses; animation-derived hurtbox
volumes and native active-frame alignment remain outstanding.

Adding alphabetically earlier actions exposed a general exporter defect:
numeric tracks used interpolation selected from the first action, affecting
unrelated clips. Bezier control conversion also used frame±1 evaluations
instead of the authored curve. Upstream repair:
mdl-exporter4 commit 376f0c2a153d1332ae535ad4cada75cd3340ca6a in
~/code/mdl-exporter4/worktrees/blender5. GPL tooling stays standalone; no exporter
implementation is incorporated into the Wurst map.

Numeric actions now sample independently into Linear tracks. Adaptive sampling
uses a 0.0001 criterion, bounded by integer-millisecond representation; this is
an approximation criterion, not a universal world-space vertex-error guarantee.
Constant transitions use the preceding millisecond; visibility/events retain
DontInterp. Serialization produces unique timestamps and inclusive endpoints.
The focused upstream Blender regression passes mixed interpolation, independent
actions, quaternion motion, constant/single-key tracks, timestamps and endpoints.
It compares evaluated source motion independently of the consumer package check.

smashcraft:tools/animations/check-aerials.ts compares the current packages against
unchanged retained pre-aerial Blender scenes exported through the same repaired
exporter. Required local baselines are
smashcraft:build/animation-assets/archer-before-aerial-repaired.mdl and
smashcraft:build/animation-assets/rifleman-before-aerial-repaired.mdl. Their sources
are the corresponding *-before-aerial.blend scenes retained in that directory.
Both fighters pass: track identities/interpolation, exact key counts/values,
strict timestamp ordering and at most 1ms relative timestamp/duration variation
from existing sequence-offset quantization. The independent comparison covered
10,428 tracks. All 29 Archer and 26 Rifleman prior source actions remain unchanged.

Original ArcherBeforeAerial.mdx and RiflemanBeforeAerial.mdx are retained locally.
They fail the former exact-export comparison, recorded in
smashcraft:build/animation-assets/check-aerial-interpolation-old-oracle.log.
Preserving authored motion is the accepted target; correcting the old exporter
can change previously displayed between-key poses. No claim of unchanged old
shipped interpolation, exact stock millisecond durations, or native animation
fidelity follows from the passing source-preservation check.

Native integration: isolated build replay-aerial-isolated executes jump,
double jump and neutral aerial for both fighters. Screenshots at aerial frames
8/11 show Archer's bow and Rifleman's rifle retained; input traces confirm
style 12. Evidence and limits are in smashcraft:evidence/native-capability-report.md.
All five aerials per fighter compile/package, but this native check covers
neutral aerial only, outside its active frames. Frame-perfect contact/hurtbox
alignment and remaining clips need further validation.

## Longer neutral/back aerials and Rifleman backward kick

smashcraft:tools/animations/aerials.py now matches the neutral/back timing in
smashcraft:docs/physics.md: source index 3 begins contact, neutral holds through 30
and back through 18, with recovery ending at 41 / 37. Generated durations
(1.708 / 1.542 seconds at 24fps) scale onto those simulation ticks. Both rigs
use the same provisional timing; forward/up/down clips retain their old motion.

Rifleman kicks with the camera-facing right leg instead of the occluded left
leg. Its imported rest knee is bent, so positive knee rotation straightens the
backward extension. Right thigh −100° / knee +40°, a tucked opposite leg, and
25° torso lean expose the boot behind the body. The packaged model's right
ankle is about 38.9 world units behind its hip during the held contact pose.
Root travel remains absent; the rifle retains the existing baked hand grips.

Both editable scenes and packaged models were regenerated. The existing
package check passed durations, nonlooping flags, complete rotations,
visibility and root-travel checks, plus preserved prior exported tracks.
A separate source comparison found all 32 Archer / 29 Rifleman actions outside
neutral/back unchanged, including the other aerials. The simulation package
passed 150/151 tests initially; the new clock test had incorrectly placed its
fixture beyond the blast ceiling. After correcting that fixture, the three
new timing/late-hit/single-hit tests passed with zero compiler warnings.
The other 150 tests, including up aerial's intentional multihit, had passed.

Exported MDX → MDL → Blender previews show the extended boot from the stage
camera and its reverse, through the late window, then retracted by index 32.
smashcraft:build/animation-assets/rifleman-backair-comparison.png shows the prior
pose, new stage/reverse contact, late contact and retraction; individual views
use smashcraft:build/animation-assets/rifleman-backair-stage-XX.png and
smashcraft:build/animation-assets/rifleman-backair-reverse-XX.png. Check logs are
smashcraft:build/animation-assets/rebuild-backair.log,
smashcraft:build/animation-assets/check-backair.log and
smashcraft:build/wurst-tests/backair-timing-focused.log.

A stricter new all-frame grip probe did not pass its 0.02-unit roundtrip
threshold: maximum reimported wrist error was 0.492 world units during startup,
versus source-scene error below 0.000014. The held contact's error is about
0.0077; the last active index measures 0.086. The importer rounds numeric key
times to whole Blender frames, which is a suspected contributor when importing
adaptive subframe samples; exporter versus importer attribution is not yet
isolated. This small transition discrepancy does not block the visible kick,
but is an open tooling defect, not an exact grip-fidelity claim. The original
failing probe remains smashcraft:build/animation-assets/check-backair-roundtrip.py
and its log; the diagnostic measurement is
smashcraft:build/animation-assets/measure-backair-roundtrip.log. No gate was
relaxed. Native playback, frame-perfect contact and final art quality remain
separate parent-owned checks.

## Grounded recovery and neutral aerial pose

`grounding.py` applies a per-frame vertical adjustment based on the visible
exported skin, moving the pelvis/chest branches and separate attachment roots
while leaving `Bone_Root` translation absent. The authoring run checked every
frame of Knockdown, Get Up, and Get Up Attack for both rigs; the measured floor
error was 0.0000 model units. This verifies authored mesh contact, not Warcraft
unit height or the feel of the native recovery timing.

The generic neutral aerial extends the camera-facing leg horizontally in the
stage plane, with the opposite leg bent backward. The imported Archer thigh
basis requires rotation on three axes: the earlier Z-only lift sent the leg
toward camera depth, foreshortening the kick. Archer raises her held bow above
the leg, and Rifleman lifts his held rifle clear of it. Both retain contact at
source frames 3–30 and recovery through 41. Exported MDX → MDL → Blender
stage-side previews are smashcraft:build/animation-assets/archer-aerial-neutral.png
and smashcraft:build/animation-assets/rifleman-aerial-neutral.png.

Rifleman's Back Air lifts the cape above his extended boot through contact,
then lowers it during recovery to the original drape by frame 32. Its leg pose
and 3–18 contact / 37-frame total timing remain unchanged. Exported contact,
late-contact and settled views use
smashcraft:build/animation-assets/rifleman-backair-stage-03.png,
smashcraft:build/animation-assets/rifleman-backair-stage-18.png and
smashcraft:build/animation-assets/rifleman-backair-stage-32.png.

The existing aerial package check passes. Comparing the saved pre-change models
against the new packages found exact values, counts and relative timestamps for
6,324 Archer and 5,737 Rifleman unchanged tracks, including Rifleman's Back Air
leg and body tracks; only the two Neutral actions and Back Air's Cape04 track
are intentionally changed. Evidence is
smashcraft:build/animation-assets/rebuild-neutral-kick-final.log. These exported
pose checks do not establish native playback or final art quality at game scale.

Archer Down Air now tucks both legs during its seven-frame startup, then extends
the camera-facing leg straight down while keeping the far leg folded through
20 active frames. The body folds over the extended leg, the bow stays on its
hand rig, and `Bone_Root` has no translation. Total clip length remains 38
frames; Rifleman's Down Air keeps its existing seven-startup/three-active pose.
Stage and reverse contact previews are
smashcraft:build/animation-assets/archer-dair-contact-stage.png and
smashcraft:build/animation-assets/archer-dair-contact-reverse.png; startup and
last-active views use the matching `archer-dair-*` names.

Both Spot Dodge clips now end at frame 22, with the protected crouch pose held
from frames 5 through 15. Archer's existing Back Air already reads as one leg
extended backward and the other tucked in the stage-side export; it keeps its
three-startup/16-active/37-total timing. Rifleman's Back Air is unchanged.

## Hero swing alignment

Hero normals play classic stock sequences whose strike rarely sits where the
move's hitbox does. `bun wisp view strikes --assets DIR` (from smashcraft:ts/)
skins every hero's packaged model, including authored clips, from DIR's
hero-models or imported-models. Without packaged assets,
`--extractor CASC_EXTRACT --storage WARCRAFT_DIR` reads the stock archives;
imported heroes require `--assets DIR`. The command
records, per normal and per special that strikes, shoots or places, the clip second where the silhouette reaches farthest
toward the move's first hit region, into
smashcraft:ts/src/game/presentation/heroStrikeMomentInfo.ts. Pose selection
(`strikeAlignedRate` in presentation/fighterPose.ts; specials through `specialRate`, their active window read from the kit) then plays the wind-up
over the startup so that moment lands on the first active frame (at most 4x;
a pooled clip starts past a wind-up longer than that), catches up over the
active frames if it must, and plays the follow-through over recovery. A
measured moment counts only while its clip index matches the table; rerun the
command after a clip or move change. On 7 Oct it moved the strike onto the
active frames for 118 of 120 hero normals (52 had been more than 4 frames off).

## Strikes that reach

Fifteen original swings drew almost no motion toward their hits: the body
stayed put while the volume reached out (#156). smashcraft:tools/animations/strikes.py
re-authors them on each fighter's editable scene (`-- archer`, `-- rifleman`,
`-- illidan`): Archer's jab (a bow-tip thrust), forward tilts (lunging side
kicks: level, head-high, floor-skimming), up tilt (an overhead bow chop) and
get-up attack (a seated sweep kick with the bow behind her); Rifleman's
neutral air (level bayonet lunge, legs split), up air (bayonet driven
overhead) and down air (muzzle-first stamp); Illidan's jab (glaive thrust),
forward tilts (lunging sweeps level, rising and low), down tilt (both glaives
along the floor) and down smash (both glaives thrown wide, with its charge and
release). Each clip lasts exactly its move's frames, so clip frame N plays on
attack frame N: anticipation in the two frames before the first active frame,
the strike pose held over the active frames, follow-through into recovery.
The script replaces only the skeleton's keys; mesh visibility and particle
gates keep their place in the clip.

Rifleman's own ground kit (#151) is authored the same way on his frames: a
rifle-stock shove jab, a lunging bayonet thrust forward tilt (level, rising,
low), an up tilt that swings the rifle overhead and on behind him, and a
crouched floor sweep down tilt. His lunge dash attack replays the forward
tilt, retimed to its own first active frame. Archer's down tilt is a
crouching floor sweep, which her sliding dash attack replays.

The scenes to run it on are the editable scenes behind the shipped models
(their packaged bytes reproduce the shipped hashes), kept with the private
build inputs. The authoring scripts on main no longer rebuild those scenes
exactly: the shipped Illidan, for example, has smash release, combat idle and
ledge catch clips that smashcraft:tools/animations/demonhunter.py lacks.
`bun tools/animations/check-strikes.ts BEFORE.mdx AFTER.mdx NAMES` confirms a
re-export changed no other sequence. `bun wisp view reach --assets DIR`
(smashcraft:docs/hurtboxes.md) measures each swing; the test requires at least
30 units toward the strike, peaking within two frames of the active window.

## Refresh play's clip pools

### Hero drill clips

`bun tools/animations/drill-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
one down-air clip for Blademaster, Warden and Shadow Hunter. It uses each
move's existing startup, active and recovery frames, turning the body during
the active span while articulating shoulders, upper legs and knees. The sword
spin extends its cutting shoulder; the downward drills keep a straight leading
leg and fold the opposite knee. Bone and helper nodes both carry joints in
the stock rigs. Model visibility follows the standing sequence, avoiding a
borrowed cast's cloak flare during the drill.

The output remains private. Eight preparation, quarter-turn and recovery
moments in each facing are written as silhouette sheets beside the models.
The generator checks previous poses at three times per sequence, all active
frames for visible body motion, and exact reconstruction of the source model
after stripping the appended clip and identity parent. Store `hero-models`,
refresh the pool below, and commit the generated
smashcraft:ts/src/game/presentation/drillClipInfo.ts with its pins. The pool
exporter reuses the exact retained source prefix and exports just the three
new sequences. Native playback decides their final appearance.

### Movement and recovery clips

`bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT` appends
turn, brake, jump preparation, aerial evasion, tech and get-up rolls for Archer,
Rifleman and the stock heroes. Stock heroes also gain standing rolls, a spot
dodge, get-up and two-sided get-up attack, and ledge options. Illidan and the
Lich King retain their separately authored rigs. Run it against the packaged
models before this postprocessor has added its clips; rerun the original asset
pipeline or use the prior immutable input view when changing its motion phases.

The MDX boundary inserts an identity helper above the body and weapon roots,
then authors stage-plane body rotation, compression, turning and foot grounding.
Skeleton articulation comes from the fighter's standing or attacking sequence;
shot visibility stays with the original shot. Game physics owns travel. The
generator checks every existing sequence's skinned body at its start, midpoint
and end (less than 0.001 units of change), and every new action's visible motion
over all authored 60 Hz frames. Existing indices remain stable. The output is
private and copied with links dereferenced; linked output families are rejected.

Store the resulting `animation-assets` and `hero-models` with `bun wisp inputs
add`, regenerate the Archer/Rifleman model filenames with `bun
tools/animations/package.ts PRIVATE_OUTPUT/animation-assets --metadata-only`,
then refresh the clip pool below. The generated
smashcraft:ts/src/game/presentation/recoveryClipInfo.ts overlays each fighter's
clip table. `bun wisp view motion --assets DIR` measures those clips through
production pose selection, and the native lane checks their appearance.

The playable build imports one clip model per sequence from its private
`--assets` (`original-clips-static-lights/`), and
smashcraft:ts/src/game/assets/fighterOriginalClipInfo.ts names each by hash.
Any change to a fighter's clips (a re-authored original, a new or remapped
hero) needs a matching pool, committed as its hash in
smashcraft:build-inputs.json with the change (smashcraft:docs/build-inputs.md,
"Change art"); the build's "check script models" failure names the command.
From smashcraft:ts/ in your lane:

1. New packaged fighter models first: `bun wisp inputs add animation-assets DIR`
   (or `illidan-animation`).
2. `cp -rL "$(bun wisp inputs path assets)/original-clips-static-lights" NEW && chmod -R u+w NEW`,
   then from the repository root `bun tools/animations/export-original-clips.ts
   --assets "$(cd ts && bun wisp inputs path assets)" --out NEW --keep-unchanged`.
3. `bun wisp inputs add original-clips-static-lights NEW`, build with
   `bun wisp map build --profile playable --name NAME --out OUT.w3x`, and commit
   build-inputs.json with the clip module.

## Lich King clips on an imported model

The Lich King (#167) is drawn by Kwaliti's Hive model (LichKing2.mdx, kept with
the private build inputs), which has only thirteen stock sequences.
`tools/animations/build-lichking.sh [INPUTS]` authors the rest:
smashcraft:tools/animations/lichking.py imports the model into Blender at 60
frames a second, so clip frame N is attack frame N, and keys every missing action
on its skeleton. It uses the same scheme as strikes.py: body lean, twist, hip
step and somersault, hand and foot goals solved through each limb, and
Frostmourne aimed by an angle in the stage plane.
Built-ins are reused where they fit. Attack - 1 and Attack - 2 (jab 1 and 2),
Spell Throw (Howling Blast) and Death (knockdown) are
retimed piecewise so that the frame where Frostmourne's point reaches farthest
toward the strike (or the chest reaches the floor) lands on the move's first
active frame. Every swing is timed to the kit's frames
(smashcraft:ts/src/game/sim/heroes/lichKingMoves.ts).

The exporter's round trip drops the model's particle emitters and renames
nodes. smashcraft:tools/animations/package-lichking.ts therefore ships the original
MDX unchanged, with each authored sequence appended after the built-ins (whose
indices never move). The skeleton keys come from the export, thinned to those
that linear interpolation cannot reproduce. Every other track (emitters,
geoset colour, events) comes from the clip's donor built-in, scaled to the new
length. It writes `LichKingFighter.mdx`, which the map imports as
war3mapImported\LichKing2.mdx, and regenerates
smashcraft:ts/src/game/presentation/heroes/lichKingClipInfo.ts (sequence name
to index and frames). Run Blender inside the capacity scope (`machine-capacity
run --class moderate`).

Defile's cast (#174) lifts Frostmourne above his shoulder, plants its point in
the ground on frame 20, holds the planted silhouette through frame 26, then
pulls it back into the guard by frame 46, held through frame 50's recovery.
The frame-20 strike stays at the pool placement frame. The pool has a dark
fill and a narrow glowing edge; each body hit flashes that edge for 12 frames.
The non-skeleton tracks retain Spell Channel as their donor. To reauthor only
this shipped sequence while retaining every other clip, pass
`--replace 'Special Down'` after the immutable existing model argument.

Movement transitions and floor recovery (#171) append at indices 66–73,
preserving every combat and stock index. Turn and stop each last eight frames,
jump squat three, neutral tech 26, directional techs 40 and get-up rolls 35.
The techs brace low on contact before returning to the guard; get-up rolls
start from Death's lying pose. Travel remains in the simulation, so the clips
stay centered on the fighter. The original Stand Ready pose and textures are
retained for the portraits.
For additive clips, pass the immutable shipped model as the second argument
to smashcraft:tools/animations/build-lichking.sh; its packager's
`--append-to EXISTING.mdx` retains the existing sequences and their tracks,
then appends only new names. This avoids Blender's millisecond interval
rounding changing previously shipped clips as the export grows.

His third jab plays its full authored thrust, whose shorter hip step leaves
its drawn reach below the forward tilt. `bun wisp view reach --assets DIR
--character 12` measures his normals, aerials, smashes, grab, get-up and ledge
attacks while preserving the other fighters' recorded rows. Omit
`--character` to measure the whole roster. Ledge samples start in the ledge
attack state so they play the climbing attack rather than the get-up clip.

## Paired expansion-hero grabs

From the repository root, `bun tools/animations/grab-clips.ts PRIVATE_ASSETS
PRIVATE_OUTPUT [--character ID]` appends thirteen grab-family gestures to each expansion hero:
reach, holder/captive hold, both pummel roles, and both roles in four throw
directions. Original Archer, Rifleman and Illidan authoring stays in
smashcraft:tools/animations/grab_animations.py. Output models and the motion
report are private; smashcraft:ts/src/game/presentation/grabClipInfo.ts is
generated from their sequence indices.

When paired sequences already exist, the generator replaces their local keys
inside the same intervals and keeps their sequence indices. `--character ID`
limits that replacement to one expansion fighter; the other fighters retain
their existing paired motion. For example, `--character 12` reauthors the
Lich King's paired family. Publish only the model families whose bytes changed,
then refresh the pooled clips and measure the changed fighter with
`bun wisp view reach --assets PRIVATE_ASSETS --character 12` from smashcraft:ts/.

The grip arm reaches while the weapon arm stays separated. Pummels coil then
strike locally; forward throws push, back throws sweep overhead and behind,
up throws compress then extend overhead, and down throws lift then fold toward
the floor. Chest, head, arms and knees move together. Dwarves use compact
shoulders, agile fighters add chest twist, and heavy fighters commit more of
their torso. The floating Lich articulates its existing neck/body rig.
The simulation continues to own the pair's root positions, carry arcs, damage
and release frames.
The captive pummel pose remains held until one frame before contact, then
folds into the localized strike instead of reacting during the windup.
New rotation keys are normalized, and interpolation handles are flattened
for their authored poses. Reusing donor handles or non-unit imported rotation
keys can move a repeated hold pose between keys; the generator checks both
held clips over sixty samples and requires drawn drift below 0.001 model units.

An authored contact time in each action clip lets holder and victim independently
reach their gesture on the actual holder's contact frame. This retains alignment
for unlike kits, hitstop and restored grabs. The victim uses its own selected
clip length and the holder's total action duration. A grab reach uses the kit's
existing startup and active window, and holds remain deliberately still.

The generator checks each unchanged sequence at start/middle/end, samples all
sixty authored frames of each action, and rejects missing bodies or repeated
directional contact poses. These checks establish local motion and preservation;
gameplay-camera readability is checked by the native owner with unlike heights,
a mirror pair, and both facings. Store `hero-models` and `imported-models` through
`bun wisp inputs add`, then refresh `original-clips-static-lights` with
smashcraft:tools/animations/export-original-clips.ts and `--keep-unchanged`.
Stripping only the appended paired suffix must recover the exact input hash
before old pool clips may be reused.

`bun tools/animations/grab-pads.ts` generates eighty mirror and eighty unlike-height scripts in
smashcraft:ts/test/native/pads/180/: each expansion hero, four throw directions,
and both holder facings. Its production-simulation pass selects an ordinary
approach duration, requires the catch/pummel/requested release, and places
captures around accepted damage and completion. Run the directory as one
native pad batch, with headless references alongside it; matching trace
expectations establishes input/selection and the captures establish readability.
Unlike-height captures pair each holder with Mountain King, or Mountain King
with Pit Lord, through `-dev quick pair FIRST / SECOND`.

## Contact pain poses

smashcraft:tools/animations/damage-clips.ts appends nine non-looping clips per
fighter: low, middle and high contact, each small, medium and large. Existing
local joints articulate the face/chest for a high hit, fold the body around
the abdomen for a middle hit, and pull the knees up with a counterbalancing
chest for a low hit. The floating Lich expresses low hits through its neck
and body. Weapons inherit their attached arm transforms.

The contact frame immediately selects the clip's already recoiling first
pose and holds its time zero during hitstop. After hitstop, non-tumbling
damage continues the recoil; a tumble enters the existing tumble clip. No
damage, hitstop, hitstun or launch timing is changed for these visuals.

### Pain pose blending

Every pool clip is its own model, so native in-model blending cannot cross a
clip swap. Instead smashcraft:ts/src/game/presentation/damageBlend.ts dissolves:
the pain clip is drawn fully opaque from the contact frame, and the previous
clip stays frozen at its last drawn pose and yaw, following the body, with
opacity falling 255·(n−k)/(n+1) over n presented simulation frames. Entry takes
3/2/1 frames for small/medium/large hits (heavier hits snap harder), capped at
hitlag − 1 so the first pain pose is always shown alone before hitstop ends
(minimum victim hitlag is 3, or 2 crouching). Leaving a pain pose for tumble,
the end of hitstun or recovery dissolves over 4 frames. Other clip changes
still cut. The timing follows fighting-game practice of showing the hit pose
at once and holding it through hitlag, as Melee and Ultimate do, with a short
17–67 ms softening; Tom delegated the exact durations on 7 October 2026.
The dissolve is timed by the presented simulation frame, so a pause holds it
and a rollback to an earlier frame ends it. Readability and frame cost at
gameplay zoom need native captures.

Height uses the authored strike segment's midpoint or a projectile's actual
height relative to the victim's current hurt-body bounds: below 3/8 is low,
at least 3/4 is high, and the remainder is middle. Contacts without a geometric
point (including throws and pummels) use middle. The chosen strongest contact
supplies both height and intensity. Small/medium/large reuse the existing
visual severity rule: knockback below 80, 80–179, and at least 180. These are
Smashcraft presentation choices, not a claim to Melee's reaction thresholds.

The authoring command checks 117 drawn first poses: each differs from idle by
at least 8 model units, each pair in one fighter differs by at least 2 units,
and every pre-existing sequence retains its drawn body at start/middle/end.
Its private output contains smashcraft-build-inputs:damage-grid.json. Refresh
the pool with smashcraft:tools/animations/export-original-clips.ts using
`--keep-unchanged`; the exact stripped-source hash preserves cached old clips.

### Native pain blending diagnostic

The gameplay-zoom reaction batch for #181 is generated by
`bun tools/animations/pain-pads.ts` into `ts/test/native/pads/181/`.
Its 117 scripts start `-dev pain HEIGHT STRENGTH FIGHTER`, interrupt both
players' ordinary jab with ordinary projectile contacts on frame 150, and
capture the entry dissolve, held reaction and release in both facings.
The contact uses each fighter's hurt-body height and the production damage
resolver; native damage receipts identify height, strength and selected clip.
Run the directory with `bun wisp pad`, the integrity map and its matching
journal helper. The generator checks all 234 hits select the intended clips;
native captures and the existing frame budget remain the issue's closing box.

`bun tools/animations/damage-blend-probe.ts PRIVATE_ASSETS PRIVATE_OUTPUT`
packages Archer's combat-ready and forward-tilt donor clips with a second
`Stand Hit` sequence held at the middle-medium first pain pose. It verifies
the interrupted clip at start/mid/end, the unchanged target pose and its hold.
An identity-only recovery parent absent from the cached donor is removed
through the existing node renumberer, with drawn-pose preservation checked.
The command writes the private models and generates
smashcraft:ts/src/platform/damageBlendProbeModels.ts with their hashed names.

The `damage-blend-probe` profile is an isolated eight-body comparison, one
body per case: ready frozen/running, then tilt frozen/running from left to
right; upper row faces right and lower row left. It freezes the donor at its
middle, sets a 0.05-second blend and selects `Stand Hit` without resetting
the source pose. One copy keeps time scale zero; the other advances only
the native presentation clock, then freezes after six callbacks. The cycle
repeats every three seconds. No match simulation runs in this diagnostic.
Its developer receipt is the client's smashcraft-damage-blend-probe.txt.

Prepare a private copy of a matching full map and its adjacent .base.lua
sidecar, import both generated models
with `smashcraft:build/tools/map-pack replace MAP FILE ARCHIVE_NAME`, then
`bun wisp map rebuild MAP --profile damage-blend-probe` from smashcraft:ts/.
Extract the two imported files afterward and compare their hashes with the
generator output. Native inspection decides whether either clock setting
actually blends from the interrupted pose and reaches the held target;
successful compilation alone establishes no native interpolation claim.
