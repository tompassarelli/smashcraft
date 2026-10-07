"""Blender boundary: author the Lich King's fighter clips on Kwaliti's model (#167).

Imports the private LichKing2.mdl at 60 frames a second, so clip frame N is
attack frame N (zero-based, startup N = first active frame N). Built-in
clips are reused where they fit, retimed so their strike lands on the move's
first active frame; every missing action is authored on the skeleton so it
swings toward its strike. Timings are the kit's (sim/heroes/lichKingMoves.ts,
shared timings from sim/moves.ts, sim/ledge.ts, sim/conditions.ts).
Writes the authored MDL and clips.json beside it:

  blender --background --python tools/animations/lichking.py -- SOURCE.mdl OUT_DIR
"""
import json
import os
import sys
from math import cos, radians, sin, sqrt
from pathlib import Path

import addon_utils
import bpy
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 2:
    raise ValueError('pass -- SOURCE.mdl OUT_DIR')
source, out = Path(args[0]), Path(args[1])
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, os.environ.get('WC3_MDL_ADDON', '/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl', default_set=True)
preferences = bpy.context.preferences.addons['export_mdl'].preferences
preferences.resourceFolder = str(source.parent.parent / 'src')
preferences.textureExtension = 'png'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.fps = 60
scene.render.fps_base = 1
if 'FINISHED' not in getattr(bpy.ops, 'import').mdl_exporter(filepath=str(source)):
    raise RuntimeError('Lich King import did not finish')
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.animation_data_create()
bones = rig.pose.bones
BUILT_IN = [a.name for a in bpy.data.actions if a.name not in ('all sequences', '#UNANIMATED')]


def update():
    bpy.context.view_layer.update()


ARMS = {'R': ('RLsh', 'Relbow', 'Rhand'), 'L': ('LLsh', 'Lelbow', 'Lhand')}
LEGS = {'R': ('Rhip', 'Rknee', 'Rfoot'), 'L': ('Lhip', 'Lknee', 'Lfoot')}
# Camera-side lateral sign (the stage camera looks along +Y; the right side,
# Frostmourne's, faces it).
SIDE = {'R': -1, 'L': 1}
# Frostmourne's point in the model's rest pose: the far end of the blade
# geoset (bound to "Weapon" only), measured from the MDX.
TIP_REST = Vector((143.0, -33.0, 66.0))
weapon = bones['Weapon']
weapon_rest_inverse = rig.data.bones['Weapon'].matrix_local.inverted()


def tip():
    return weapon.matrix @ weapon_rest_inverse @ TIP_REST


def aim_bone(bone, endpoint, target):
    pivot = bone.matrix.translation.copy()
    q = (endpoint - pivot).rotation_difference(target - pivot)
    bone.matrix = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ bone.matrix
    update()


def solve(chain, target, pole):
    upper, lower, end = (bones[n] for n in chain)
    start, joint, end_at = (b.matrix.translation.copy() for b in (upper, lower, end))
    a, b = (joint - start).length, (end_at - joint).length
    direction = (target - start).normalized()
    distance = min(max((target - start).length, abs(a - b) + .01), a + b - .01)
    across = pole - start
    across -= direction * across.dot(direction)
    if across.length < 1e-3:
        across = Vector((0, 1, 0))
    along = (a * a - b * b + distance * distance) / (2 * distance)
    bend = start + direction * along + across.normalized() * sqrt(max(0, a * a - along * along))
    aim_bone(upper, joint, bend)
    aim_bone(lower, end.matrix.translation.copy(), start + direction * distance)


def rotate_about(names, pivot, angle, axis='Y'):
    rotation = Matrix.Translation(pivot) @ Matrix.Rotation(radians(angle), 4, axis) @ Matrix.Translation(-pivot)
    for name in names:
        bones[name].matrix = rotation @ bones[name].matrix
    update()


def rig_slot(action):
    return next(s for s in action.slots if s.identifier[2:] == rig.name)


def sample(action, frame):
    rig.animation_data.action = action
    rig.animation_data.action_slot = rig_slot(action)
    scene.frame_set(frame)
    update()
    return {b.name: b.matrix_basis.copy() for b in bones}


def blend(a, b, t):
    result = {}
    for name, m in a.items():
        la, ra, sa = m.decompose()
        lb, rb, sb = b[name].decompose()
        result[name] = Matrix.LocRotScale(la.lerp(lb, t), ra.slerp(rb, t), sa.lerp(sb, t))
    return result


def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return tuple(x * (1 - t) + y * t for x, y in zip(a, b)) if isinstance(a, tuple) else a * (1 - t) + b * t


# Body parameters: lean and twist turn the chest (degrees, lean forward
# positive, twist turning the sword shoulder back positive), spin turns the
# whole body about the hips (forward somersault positive), step moves the hips
# (x forward, z up), rise blends the base pose toward the standing pose.
SCALARS = {'lean': 0., 'twist': 0., 'spin': 0., 'rise': 0., 'step': (0., 0.)}
# Hand and foot goals in the body frame (x forward, y toward the far side, z
# up, model units from the feet); the sword's aim is a world angle in the
# stage plane (0 ahead, 90 straight up, -90 straight down, 180 behind).
TARGETS = ('hand_R', 'hand_L', 'foot_R', 'foot_L')


def params_at(keys, frame):
    frames = sorted(keys)
    left = max(k for k in frames if k <= frame)
    right = min(k for k in frames if k >= frame)
    t = 0. if left == right else ease((frame - left) / (right - left))
    p = {k: lerp(keys[left].get(k, d), keys[right].get(k, d), t) for k, d in SCALARS.items()}
    for k in TARGETS:
        a, b = keys[left].get(k), keys[right].get(k)
        if a is None and b is None:
            continue
        p[k] = (Vector(lerp(a or b, b or a, t)), (1 - t if b is None else t if a is None else 1.))
    a, b = keys[left].get('aim'), keys[right].get('aim')
    if a is not None or b is not None:
        # Unwrapped angles interpolate along the authored arc.
        p['aim'] = (lerp(a if a is not None else b, b if b is not None else a, t), (1 - t if b is None else t if a is None else 1.))
    return p


def pose(p, base, standing, plant):
    for name, m in blend(base, standing, p['rise']).items():
        bones[name].matrix_basis = m
    update()
    planted = {s: bones[LEGS[s][2]].matrix.translation.copy() for s in 'RL'}
    chest_before = bones['Chest'].matrix.copy()
    root = bones['Root']
    pivot = root.matrix.translation.copy()
    if p['spin']:
        rotate_about(['Root'], pivot, p['spin'])
    dx, dz = p['step']
    root.matrix = Matrix.Translation(Vector((dx, 0, dz))) @ root.matrix
    update()
    if p['lean']:
        rotate_about(['Stomach'], bones['Stomach'].matrix.translation.copy(), p['lean'])
    if p['twist']:
        rotate_about(['Chest'], bones['Chest'].matrix.translation.copy(), -p['twist'], 'Z')
    ride = bones['Chest'].matrix @ chest_before.inverted()
    hip = bones['Root'].matrix.translation
    body = Matrix.Translation(Vector((dx, 0, dz))) @ (Matrix.Translation(pivot) @ Matrix.Rotation(radians(p['spin']), 4, 'Y') @ Matrix.Translation(-pivot))
    for s in 'RL':
        target = p.get('foot_' + s)
        if target is None and not plant:
            continue
        goal = planted[s] if target is None else planted[s].lerp(body @ target[0] if not plant else target[0], target[1])
        solve(LEGS[s], goal, hip + body.to_3x3() @ Vector((60, SIDE[s] * 14, 0)))
    chest = bones['Chest'].matrix.translation
    for s in 'RL':
        target = p.get('hand_' + s)
        if target is None:
            continue
        here = bones[ARMS[s][2]].matrix.translation.copy()
        solve(ARMS[s], here.lerp(ride @ target[0], target[1]), chest + ride.to_3x3() @ Vector((-30, SIDE[s] * 40, -20)))
    aim = p.get('aim')
    if aim is not None:
        hand = bones['Rhand']
        grip = hand.matrix.translation.copy()
        now = tip() - grip
        angle = radians(aim[0])
        goal = Vector((cos(angle), 0, sin(angle))) * now.length
        goal.y = now.y
        q = Quaternion().slerp(now.rotation_difference(goal), aim[1])
        hand.matrix = Matrix.Translation(grip) @ q.to_matrix().to_4x4() @ Matrix.Translation(-grip) @ hand.matrix
        update()


CLIPS = []


def key_bones(frame, previous):
    for bone in bones:
        bone.rotation_mode = 'QUATERNION'
        q = bone.rotation_quaternion.copy()
        if bone.name in previous and previous[bone.name].dot(q) < 0:
            q.negate()
            bone.rotation_quaternion = q
        previous[bone.name] = q.copy()
        bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
        bone.keyframe_insert('location', frame=frame, group=bone.name)
        bone.keyframe_insert('scale', frame=frame, group=bone.name)


def clear_rig_curves(action):
    slot = rig_slot(action)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                if bag.slot == slot:
                    for curve in list(bag.fcurves):
                        bag.fcurves.remove(curve)


def warp_curves(action, warp, skip_rig=False):
    slot = rig_slot(action)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                if skip_rig and bag.slot == slot:
                    continue
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        x = warp(key.co.x)
                        key.handle_left.x += x - key.co.x
                        key.handle_right.x += x - key.co.x
                        key.co.x = x
                    curve.update()


def new_action(name, copy_of, last):
    action = bpy.data.actions[copy_of].copy()
    action.name = name
    old_last = action.frame_range[1] - action.frame_range[0]
    first = action.frame_range[0]
    # Other channels (geoset and emitter visibility) keep their place in the clip.
    warp_curves(action, lambda x: round((x - first) * last / max(1, old_last)), skip_rig=True)
    clear_rig_curves(action)
    return action


def finish(action, name, last, looping, source, strike=None):
    action.use_frame_range = True
    action.frame_start, action.frame_end = 0, last
    action['war3_non_looping'] = not looping
    action.use_fake_user = True
    CLIPS.append({'name': name, 'frames': last, 'looping': looping, 'source': source, 'strike': strike})
    print('LICH_KING_CLIP', name, last, 'looping' if looping else 'once', flush=True)


def author(name, keys, base_from='Stand Ready', base_frame=0, standing_from=None, plant=True, looping=False, copy_of=None):
    """A clip of max(keys) frames whose skeleton follows the keyed parameters."""
    last = max(keys)
    base = sample(bpy.data.actions[base_from], base_frame)
    standing = sample(bpy.data.actions[standing_from[0]], standing_from[1]) if standing_from else base
    action = new_action(name, copy_of or 'Stand Ready', last)
    rig.animation_data.action = action
    rig.animation_data.action_slot = rig_slot(action)
    previous = {}
    for frame in range(last + 1):
        scene.frame_set(frame)
        pose(params_at(keys, frame), base, standing, plant)
        key_bones(frame, previous)
    finish(action, name, last, looping, copy_of or 'Stand Ready')
    return action


def strike_frame(action_name, angle):
    """The built-in clip's frame where Frostmourne's point reaches farthest along a stage-plane direction."""
    action = bpy.data.actions[action_name]
    first, end = int(action.frame_range[0]), int(action.frame_range[1])
    direction = Vector((cos(radians(angle)), 0, sin(radians(angle))))
    best, best_reach = first, -1e9
    for frame in range(first, end + 1):
        sample(action, frame)
        reach = (tip() - Vector((0, 0, 110))).dot(direction)
        if reach > best_reach:
            best, best_reach = frame, reach
    return best - first, end - first


def lie_frame():
    """The first Death frame where his chest has come down to the floor."""
    action = bpy.data.actions["Death"]
    first, end = int(action.frame_range[0]), int(action.frame_range[1])
    heights = []
    for frame in range(first, end + 1):
        sample(action, frame)
        heights.append(bones["Chest"].matrix.translation.z)
    return next(i for i, z in enumerate(heights) if z <= min(heights) + 1.0)


def reuse(name, built_in, startup, total, angle=0.0, looping=False, hit=None):
    """A built-in clip retimed so its strike lands on attack frame `startup` and it ends on `total`."""
    source = bpy.data.actions[built_in]
    length = int(source.frame_range[1] - source.frame_range[0])
    if hit is None and startup is not None:
        hit, length = strike_frame(built_in, angle)
    action = source.copy()
    action.name = name
    first = action.frame_range[0]
    if startup is None:
        warp = lambda x: round((x - first) * total / max(1, action.frame_range[1] - first))
    else:
        def warp(x):
            x -= first
            if x <= hit:
                return x * startup / max(1, hit)
            return startup + (x - hit) * (total - startup) / max(1, length - hit)
        # Key the strike pose itself, so the warp lands it exactly on the first active frame.
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        if len(curve.keyframe_points) > 1:
                            curve.keyframe_points.insert(first + hit, curve.evaluate(first + hit), options={"FAST"})
    warp_curves(action, warp)
    finish(action, name, total, looping, built_in, strike=None if hit is None else {'source': built_in, 'sourceFrame': hit, 'frame': startup})
    return action


def swing(startup, active, total, wind, strike, follow, wind_at=None, follow_at=None, settle=None, start=None):
    """Rest, anticipation, a strike held over the active frames, follow-through, rest."""
    keys = {0: start or {}, wind_at or max(1, startup - 3): wind, startup: strike, startup + active - 1: strike,
            follow_at or min(total - 8, startup + active + 5): follow, total: start or {}}
    if settle is not None:
        keys[settle[0]] = settle[1]
    return keys


def zero(first_active):
    """The kit's one-based first active frame (entry tick = 1) as a zero-based attack frame."""
    return first_active - 1


# Stance pieces in the body frame. Frostmourne hand (R, camera side) and the
# free hand (L); feet planted unless keyed.
GUARD = {'hand_R': (22, -30, 88), 'aim': 20}
WIDE = {'foot_R': (30, -16, 1), 'foot_L': (-24, 14, 1)}

# ---------------------------------------------------------------- ground normals
# Jab chain: Attack - 1, Attack - 2, then an authored Frostmourne thrust.
reuse('Attack Jab', 'Attack - 1', zero(6), 21)
reuse('Attack Jab 2', 'Attack - 2', zero(7), 25)
author('Attack Jab 3', swing(zero(9), 3, 34,
    wind={'step': (-6, -4), 'lean': -10, 'twist': 25, 'hand_R': (-18, -34, 98), 'aim': 5, 'hand_L': (24, 20, 100)},
    strike={'step': (12, -6), 'lean': 18, 'twist': -15, 'hand_R': (44, -26, 92), 'aim': -2, 'hand_L': (-24, 26, 92), 'foot_R': (52, -16, 1)},
    follow={'step': (10, -4), 'lean': 12, 'hand_R': (36, -26, 92), 'aim': 0, 'foot_R': (46, -16, 1)},
    settle=(26, {'step': (4, 0), 'lean': 4, 'hand_R': (20, -30, 90), 'aim': 10})))
# Forward tilt (all three angles): an overhead sweep that comes down in front.
author('Forward Tilt', swing(zero(11), 4, 38,
    wind={'step': (-6, -2), 'lean': -14, 'twist': 20, 'hand_R': (-6, -30, 132), 'aim': 120, 'hand_L': (20, 16, 100)},
    strike={'step': (26, -8), 'lean': 24, 'twist': -10, 'hand_R': (42, -28, 96), 'aim': 5, 'hand_L': (-20, 24, 92), 'foot_R': (46, -16, 1)},
    follow={'step': (14, -10), 'lean': 22, 'hand_R': (38, -28, 70), 'aim': -40, 'foot_R': (42, -16, 1)},
    settle=(30, {'step': (4, -2), 'lean': 6, 'hand_R': (22, -30, 86), 'aim': 10})))
# Up tilt: Frostmourne arcs from in front, over his head, to behind him.
author('Up Tilt', swing(zero(10), 5, 37,
    wind={'step': (2, -8), 'lean': 10, 'hand_R': (30, -30, 74), 'aim': -20},
    strike={'step': (0, 4), 'lean': -10, 'hand_R': (8, -28, 138), 'aim': 92, 'hand_L': (-10, 24, 120)},
    follow={'step': (-4, 0), 'lean': -18, 'hand_R': (-18, -28, 124), 'aim': 160},
    settle=(29, {'lean': -4, 'hand_R': (6, -30, 96), 'aim': 60})))
# Down tilt: a crouched frost sweep along the floor in front, then behind.
author('Down Tilt', {
    0: {}, zero(9) - 3: {'step': (0, -22), 'lean': 16, 'hand_R': (6, -30, 70), 'aim': 30},
    zero(9): {'step': (6, -32), 'lean': 30, 'hand_R': (40, -28, 46), 'aim': -12, 'foot_R': (40, -16, 1)},
    zero(10): {'step': (6, -32), 'lean': 30, 'twist': -20, 'hand_R': (34, -28, 44), 'aim': -10, 'foot_R': (40, -16, 1)},
    zero(11): {'step': (-2, -32), 'lean': 18, 'twist': -70, 'hand_R': (-30, -20, 48), 'aim': -170, 'foot_R': (40, -16, 1)},
    zero(12): {'step': (-4, -32), 'lean': 16, 'twist': -80, 'hand_R': (-34, -18, 48), 'aim': -172, 'foot_R': (40, -16, 1)},
    24: {'step': (0, -18), 'lean': 10, 'hand_R': (10, -30, 70), 'aim': 20}, 34: {}})
# Dash attack: a lunging thrust (the body travels in the simulation).
author('Dash Attack', swing(zero(12), 4, 45,
    wind={'step': (-10, -8), 'lean': -8, 'twist': 30, 'hand_R': (-24, -34, 92), 'aim': 4, 'hand_L': (26, 20, 98)},
    strike={'step': (30, -14), 'lean': 30, 'twist': -15, 'hand_R': (48, -26, 86), 'aim': -4, 'hand_L': (-28, 26, 96), 'foot_R': (64, -16, 1), 'foot_L': (-36, 14, 1)},
    follow={'step': (26, -12), 'lean': 24, 'hand_R': (42, -26, 84), 'aim': -6, 'foot_R': (60, -16, 1), 'foot_L': (-34, 14, 1)},
    settle=(34, {'step': (8, -2), 'lean': 6, 'hand_R': (22, -30, 88), 'aim': 10})))

# ---------------------------------------------------------------- smashes
FSMASH_WIND = {'step': (-10, -6), 'lean': -20, 'twist': 10, 'hand_R': (-4, -28, 140), 'aim': 135, 'hand_L': (-2, -10, 140), **WIDE}
FSMASH_HIT = {'step': (24, -18), 'lean': 34, 'hand_R': (48, -26, 92), 'aim': -5, 'hand_L': (40, -12, 94), 'foot_R': (58, -16, 1), 'foot_L': (-30, 14, 1)}
author('Forward Smash', swing(zero(22), 4, 63, wind=FSMASH_WIND, strike=FSMASH_HIT,
    follow={**FSMASH_HIT, 'lean': 30, 'hand_R': (44, -26, 64), 'aim': -45, 'hand_L': (36, -12, 66)},
    wind_at=12, settle=(48, {'step': (6, -4), 'lean': 8, 'hand_R': (22, -30, 86), 'aim': 10})))
# Remorseless Winter: arms and blade thrust up, the burst around him.
USMASH_WIND = {'step': (0, -24), 'lean': 12, 'hand_R': (20, -30, 64), 'aim': -60, 'hand_L': (14, 24, 64)}
USMASH_HIT = {'step': (0, 8), 'lean': -6, 'hand_R': (4, -26, 146), 'aim': 90, 'hand_L': (-2, 30, 146)}
author('Up Smash', swing(zero(18), 8, 63, wind=USMASH_WIND, strike=USMASH_HIT,
    follow={**USMASH_HIT, 'step': (0, -6), 'hand_R': (12, -28, 110), 'aim': 60, 'hand_L': (4, 30, 120)},
    wind_at=10, settle=(50, {'hand_R': (20, -30, 96), 'aim': 40})))
# Quake: Frostmourne raised in both hands and slammed into the ground in front, the quake then spreading behind.
DSMASH_WIND = {'step': (0, -6), 'lean': -16, 'hand_R': (10, -26, 146), 'aim': 100, 'hand_L': (8, -8, 144)}
DSMASH_HIT = {'step': (14, -34), 'lean': 38, 'hand_R': (42, -24, 52), 'aim': -28, 'hand_L': (38, -10, 54), 'foot_R': (44, -16, 1), 'foot_L': (-36, 14, 1)}
author('Down Smash', swing(zero(17), 6, 62, wind=DSMASH_WIND, strike=DSMASH_HIT,
    follow={**DSMASH_HIT, 'step': (10, -30), 'lean': 32},
    wind_at=11, settle=(48, {'step': (4, -8), 'lean': 10, 'hand_R': (22, -30, 84), 'aim': 10})))
# Charging holds the forward smash's wind-up, trembling.
author('Smash Charge', {0: FSMASH_WIND, 8: {**FSMASH_WIND, 'lean': -22, 'step': (-11, -7)}, 16: FSMASH_WIND}, looping=True)

# ---------------------------------------------------------------- movement
CROUCH = {'step': (0, -30), 'lean': 22, 'hand_R': (30, -30, 52), 'aim': -8, 'hand_L': (24, 20, 60)}
author('Crouch', {0: CROUCH, 30: {**CROUCH, 'step': (0, -32)}, 60: CROUCH}, looping=True)
TUCK = {'foot_R': (20, -16, 40), 'foot_L': (-6, 14, 34)}
FALL = {'step': (0, 0), 'lean': 6, 'hand_R': (24, -32, 92), 'aim': -10, 'hand_L': (-10, 30, 104), 'foot_R': (16, -16, 16), 'foot_L': (-14, 14, 8)}
author('Fall', {0: FALL, 30: {**FALL, 'hand_L': (-14, 32, 110), 'foot_R': (18, -16, 20)}, 60: FALL}, plant=False, looping=True)
author('Jump', {0: {'step': (0, -18), 'lean': 14, **GUARD}, 5: {'step': (0, 4), 'lean': -6, 'hand_R': (20, -30, 100), 'aim': 30},
                12: {**TUCK, 'lean': 4, 'hand_R': (22, -30, 96), 'aim': 10}, 24: FALL}, plant=False)
# Double jump: a forward somersault with Frostmourne held out.
author('Double Jump', {0: {**FALL, **TUCK}, 6: {**TUCK, 'spin': 90, 'hand_R': (20, -30, 90), 'aim': 0},
                       14: {**TUCK, 'spin': 220, 'hand_R': (20, -30, 90), 'aim': 0}, 22: {**TUCK, 'spin': 360, 'hand_R': (22, -30, 92), 'aim': 0},
                       30: {**FALL, 'spin': 360}}, plant=False)
author('Landing', {0: {'step': (0, -26), 'lean': 18, 'hand_R': (30, -30, 60), 'aim': -20, 'hand_L': (20, 24, 64)}, 6: {'step': (0, -20), 'lean': 12, 'hand_R': (26, -30, 70), 'aim': -10}, 16: {}})
author('Fall Special', {0: {**FALL, 'lean': 16, 'hand_R': (10, -32, 70), 'aim': -70, 'hand_L': (0, 30, 74)},
                        30: {**FALL, 'lean': 20, 'hand_R': (8, -32, 66), 'aim': -75, 'hand_L': (-2, 30, 70)}, 60: {**FALL, 'lean': 16, 'hand_R': (10, -32, 70), 'aim': -70, 'hand_L': (0, 30, 74)}}, plant=False, looping=True)

# ---------------------------------------------------------------- defense
# Shield: Frostmourne raised upright before him, braced.
SHIELD = {'step': (0, -12), 'lean': 6, 'hand_R': (30, -24, 94), 'aim': 88, 'hand_L': (26, -6, 100), **WIDE}
author('Shield', {0: SHIELD, 30: {**SHIELD, 'step': (0, -13)}, 60: SHIELD}, looping=True)
author('Damage Shield', {0: SHIELD, 4: {**SHIELD, 'step': (-8, -14), 'lean': -6}, 24: SHIELD})
# Spot dodge: he sinks and leans away, the blade drawn in.
author('Spot Dodge', {0: {}, 4: {'step': (-10, -24), 'lean': -18, 'hand_R': (0, -30, 90), 'aim': 80}, 14: {'step': (-10, -24), 'lean': -18, 'hand_R': (0, -30, 90), 'aim': 80}, 22: {}})
# Rolls: a low cape-swirling stride; the body travels in the simulation.
author('Roll Forward', {0: {}, 6: {'step': (0, -30), 'lean': 40, 'spin': 30, 'hand_R': (10, -30, 70), 'aim': -60},
                        18: {'step': (0, -30), 'lean': 40, 'spin': 30, 'hand_R': (10, -30, 70), 'aim': -60}, 31: {}})
author('Roll Backward', {0: {}, 6: {'step': (0, -28), 'lean': -26, 'spin': -20, 'hand_R': (10, -30, 90), 'aim': 70},
                         18: {'step': (0, -28), 'lean': -26, 'spin': -20, 'hand_R': (10, -30, 90), 'aim': 70}, 31: {}})
AIR_DODGE = {**FALL, **TUCK, 'lean': 30, 'hand_R': (8, -30, 84), 'aim': 70, 'hand_L': (14, 24, 90)}
author('Air Dodge', {0: FALL, 6: AIR_DODGE, 34: AIR_DODGE, 49: FALL}, plant=False)

# ---------------------------------------------------------------- aerials (from the fall pose)
# Neutral air: Frostmourne spins around him, ahead on the front hit (10-13), behind on the back hit (14-17).
NAIR_FRONT = {**TUCK, 'twist': -10, 'hand_R': (40, -26, 94), 'aim': 0, 'hand_L': (-26, 26, 96)}
NAIR_BACK = {**TUCK, 'twist': 40, 'hand_R': (-34, -20, 94), 'aim': 180, 'hand_L': (24, 26, 96)}
author('Aerial Neutral', {0: FALL, zero(10) - 3: {**TUCK, 'twist': 30, 'hand_R': (-10, -32, 100), 'aim': 160},
                          zero(10): NAIR_FRONT, zero(13): {**NAIR_FRONT, 'hand_R': (30, -26, 110), 'aim': 60},
                          zero(14): NAIR_BACK, zero(17): {**NAIR_BACK, 'aim': 200}, 28: {**FALL, 'hand_R': (10, -30, 96), 'aim': 120}, 41: FALL},
       base_from='Fall', plant=False)
author('Aerial Forward', swing(zero(14), 4, 47, start=FALL,
    wind={**TUCK, 'lean': -16, 'hand_R': (-2, -28, 140), 'aim': 115},
    strike={**TUCK, 'lean': 26, 'hand_R': (44, -26, 90), 'aim': -15, 'hand_L': (-14, 26, 100)},
    follow={**TUCK, 'lean': 22, 'hand_R': (32, -26, 60), 'aim': -70},
    wind_at=8), base_from='Fall', plant=False)
author('Aerial Back', swing(zero(11), 4, 40, start=FALL,
    wind={**TUCK, 'twist': -30, 'hand_R': (30, -28, 104), 'aim': 30},
    strike={**TUCK, 'lean': -20, 'twist': 50, 'hand_R': (-34, -20, 100), 'aim': 182, 'hand_L': (24, 26, 96)},
    follow={**TUCK, 'lean': -14, 'twist': 40, 'hand_R': (-30, -22, 84), 'aim': 210}), base_from='Fall', plant=False)
author('Aerial Up', swing(zero(10), 5, 39, start=FALL,
    wind={**TUCK, 'hand_R': (30, -28, 84), 'aim': -10},
    strike={**TUCK, 'lean': -14, 'hand_R': (10, -26, 140), 'aim': 92, 'hand_L': (-10, 26, 120)},
    follow={**TUCK, 'lean': -18, 'hand_R': (-16, -26, 128), 'aim': 150}), base_from='Fall', plant=False)
# Down air: Frostmourne plunged point-first beneath him in both hands.
author('Aerial Down', swing(zero(18), 5, 55, start=FALL,
    wind={**TUCK, 'lean': -8, 'hand_R': (14, -24, 140), 'aim': 92, 'hand_L': (12, -6, 138)},
    strike={'foot_R': (10, -16, 30), 'foot_L': (-10, 14, 26), 'lean': 10, 'hand_R': (16, -22, 76), 'aim': -90, 'hand_L': (14, -8, 80)},
    follow={'foot_R': (10, -16, 28), 'foot_L': (-10, 14, 24), 'lean': 8, 'hand_R': (16, -22, 78), 'aim': -88, 'hand_L': (14, -8, 82)},
    wind_at=10, follow_at=zero(22) + 10), base_from='Fall', plant=False)

# ---------------------------------------------------------------- grabs and throws
# The free hand reaches with Frostmourne levelled beside it.
GRAB_HIT = {'step': (18, -12), 'lean': 26, 'twist': 20, 'hand_L': (56, 16, 96), 'hand_R': (10, -30, 90), 'aim': 12}
author('Grab', swing(zero(9), 2, 40, wind={'lean': -4, 'hand_L': (4, 26, 104), 'hand_R': (-6, -32, 96), 'aim': 85}, strike=GRAB_HIT,
    follow={**GRAB_HIT, 'hand_L': (40, 16, 92), 'aim': 30}, settle=(28, {'hand_L': (16, 20, 96), 'hand_R': (6, -32, 90), 'aim': 50})))
HOLD = {'step': (6, -4), 'lean': 10, 'hand_L': (40, 14, 104), 'hand_R': (-4, -32, 92), 'aim': 70}
author('Grab Hold', {0: HOLD, 30: {**HOLD, 'hand_L': (40, 14, 106)}, 60: HOLD}, looping=True)
author('Pummel', {0: HOLD, 52: {**HOLD, 'twist': 25, 'hand_R': (-14, -34, 110), 'aim': 120}, 59: {**HOLD, 'twist': -10, 'hand_R': (30, -26, 100), 'aim': 40}, 68: HOLD})
author('Throw Forward', swing(zero(15), 1, 38, start=HOLD, wind={**HOLD, 'twist': 30, 'hand_L': (24, 18, 100), 'hand_R': (-20, -32, 120), 'aim': 120},
    strike={'step': (20, -10), 'lean': 26, 'hand_L': (50, 14, 100), 'hand_R': (46, -26, 96), 'aim': 0, 'foot_R': (50, -16, 1)},
    follow={'step': (14, -8), 'lean': 18, 'hand_L': (34, 16, 96), 'hand_R': (40, -26, 80), 'aim': -30}))
author('Throw Back', swing(zero(18), 1, 46, start=HOLD, wind={**HOLD, 'twist': -40, 'hand_L': (30, 14, 110)},
    strike={'step': (-14, -6), 'lean': -16, 'twist': 70, 'hand_L': (-40, 18, 100), 'hand_R': (-30, -22, 96), 'aim': 180},
    follow={'step': (-10, -4), 'lean': -10, 'twist': 50, 'hand_L': (-30, 18, 96), 'hand_R': (-24, -24, 90), 'aim': 200}))
author('Throw Up', swing(zero(16), 1, 30, start=HOLD, wind={**HOLD, 'step': (4, -20), 'hand_L': (34, 14, 80)},
    strike={'step': (0, 6), 'lean': -10, 'hand_L': (12, 16, 150), 'hand_R': (6, -26, 140), 'aim': 90},
    follow={'step': (0, 2), 'lean': -6, 'hand_L': (10, 18, 130), 'hand_R': (10, -26, 120), 'aim': 80}, wind_at=10, follow_at=24))
# Harvest Soul: the victim held down before him while Frostmourne's point draws the soul in.
HARVEST = {'step': (8, -20), 'lean': 26, 'hand_L': (44, 14, 58), 'hand_R': (20, -28, 110), 'aim': -40}
author('Throw Down', swing(zero(24), 1, 50, start=HOLD, wind={**HOLD, 'step': (6, -10), 'hand_L': (42, 14, 76), 'hand_R': (0, -28, 128), 'aim': 60},
    strike={**HARVEST, 'hand_R': (40, -26, 72), 'aim': -45}, follow={**HARVEST, 'hand_R': (30, -28, 96), 'aim': -20}, wind_at=12, follow_at=36))
# Held and thrown, he recoils with Frostmourne hanging.
GRABBED = {'step': (-4, 0), 'lean': -18, 'hand_R': (6, -32, 74), 'aim': -70, 'hand_L': (14, 26, 112), **TUCK}
author('Grabbed', {0: GRABBED, 30: {**GRABBED, 'lean': -20}, 60: GRABBED}, plant=False, looping=True)

# ---------------------------------------------------------------- damage and recovery
author('Damage Ground', {0: {}, 3: {'step': (-8, -6), 'lean': -22, 'twist': -15, 'hand_R': (6, -32, 80), 'aim': -40, 'hand_L': (-10, 30, 110)}, 24: {}})
author('Damage Air', {0: FALL, 3: {**FALL, 'lean': -26, 'hand_R': (6, -32, 80), 'aim': -40, 'hand_L': (-10, 30, 116), **TUCK}, 24: FALL}, plant=False)
# Tumble: a full backward turn, limbs loose.
TUMBLE = {'hand_R': (0, -34, 104), 'aim': 150, 'hand_L': (-4, 32, 110), 'foot_R': (14, -16, 30), 'foot_L': (-18, 14, 24)}
author('Damage Tumble', {0: {**TUMBLE, 'spin': 0}, 12: {**TUMBLE, 'spin': -180}, 24: {**TUMBLE, 'spin': -360}}, plant=False, looping=True)
death = bpy.data.actions['Death']
lie = lie_frame()
reuse('Knockdown', 'Death', 20, 26, hit=lie)
author('Down Damage', {0: {}, 3: {'step': (0, 4)}, 13: {}}, base_from='Death', base_frame=int(death.frame_range[0]) + lie, plant=False)
author('Get Up', {0: {'rise': 0}, 10: {'rise': .25, 'step': (0, 4)}, 22: {'rise': .85}, 30: {'rise': 1}},
       base_from='Death', base_frame=int(death.frame_range[0]) + lie, standing_from=('Stand Ready', 0), plant=False)
author('Get Up Attack', {0: {'rise': 0}, 10: {'rise': .3, 'hand_R': (-10, -30, 80), 'aim': 170},
                         16: {'rise': .45, 'step': (24, 0), 'hand_R': (40, -26, 70), 'aim': 0}, 18: {'rise': .45, 'step': (24, 0), 'hand_R': (40, -26, 68), 'aim': -4},
                         28: {'rise': .7, 'step': (10, 0), 'hand_R': (30, -28, 80), 'aim': 10}, 49: {'rise': 1}},
       base_from='Death', base_frame=int(death.frame_range[0]) + lie, standing_from=('Stand Ready', 0), plant=False)

# Ledge: hanging by his free hand, Frostmourne lowered; climb, roll and attack.
# The ledge is LEDGE_HANG_DEPTH (90) above his origin, about 100 model units at his draw scale: shoulders just below it, the free hand on the lip.
HANG = {'step': (10, -30), 'lean': 6, 'hand_L': (17, 20, 130), 'hand_R': (4, -32, 74), 'aim': -80, 'foot_R': (0, -16, 6), 'foot_L': (-14, 14, 4)}
author('Ledge Hang', {0: HANG, 30: {**HANG, 'step': (-30, -98)}, 60: HANG}, plant=False, looping=True)
author('Ledge Climb', {0: HANG, 8: {**HANG, 'step': (14, -14), 'hand_L': (14, 20, 112)}, 16: {'step': (0, -14), 'lean': 20, 'hand_R': (20, -30, 70), 'aim': -20}, 25: {}}, plant=False)
author('Ledge Roll', {0: HANG, 8: {**HANG, 'step': (14, -14), 'hand_L': (14, 20, 112)}, 16: {'step': (0, -30), 'lean': 40, 'spin': 40, 'hand_R': (10, -30, 70), 'aim': -60},
                      28: {'step': (0, -26), 'lean': 30, 'spin': 30, 'hand_R': (10, -30, 72), 'aim': -50}, 36: {}}, plant=False)
author('Ledge Attack', {0: HANG, 8: {**HANG, 'step': (14, -14), 'hand_L': (14, 20, 112)}, 13: {'step': (-4, -18), 'lean': -6, 'twist': 25, 'hand_R': (-10, -32, 100), 'aim': 150},
                        16: {'step': (14, -16), 'lean': 22, 'hand_R': (44, -26, 88), 'aim': 0, 'foot_R': (44, -16, 1)},
                        18: {'step': (14, -16), 'lean': 22, 'hand_R': (42, -26, 84), 'aim': -10, 'foot_R': (44, -16, 1)},
                        28: {'step': (6, -6), 'lean': 8, 'hand_R': (24, -30, 86), 'aim': 10}, 40: {}}, plant=False)
# Wall jump: braced against the wall behind, he springs away from it; a wall tech is a quick push off.
author('Wall Jump', {0: {**FALL, **TUCK, 'lean': 20, 'hand_L': (-34, 26, 100)}, 5: {**TUCK, 'lean': 26, 'hand_L': (-40, 26, 96), 'step': (-6, 0)},
                     14: {**FALL, 'lean': -10, 'hand_R': (30, -28, 104), 'aim': 30}, 45: FALL}, plant=False)
author('Wall Tech', {0: {**TUMBLE}, 5: {**TUCK, 'lean': 24, 'hand_L': (-40, 26, 96), 'step': (-6, 0)}, 31: FALL}, plant=False)

# ---------------------------------------------------------------- specials
# Howling Blast reuses Spell Throw; the cast lands on the release frame.
reuse('Special Neutral', 'Spell Throw', zero(16), 44)
# Defile plants Frostmourne at the existing frame-20 pool placement.
DEFILE_WIND = {'step': (-6, 0), 'lean': -10, 'twist': -16, 'hand_R': (24, -32, 160), 'hand_L': (28, 16, 146), 'aim': 90}
DEFILE_CAST = {'step': (10, -8), 'lean': 6, 'twist': 8, 'hand_R': (62, -28, 150), 'hand_L': (48, 12, 140), 'aim': -90, 'foot_L': (42, 14, 1)}
author('Special Down', {0: {}, 9: DEFILE_WIND, 14: DEFILE_WIND, zero(20): DEFILE_CAST, 25: DEFILE_CAST,
                        33: {'step': (6, -10), 'lean': 16, 'hand_R': (34, -30, 114), 'hand_L': (32, 20, 106), 'aim': -65}, 46: {}, 50: {}}, copy_of='Spell Channel')
# Val'kyr Shadowguard: he raises his free hand and sends the Val'kyr out ahead.
author('Special Side', swing(zero(14), 4, 40,
    wind={'step': (-6, 0), 'lean': -12, 'twist': -20, 'hand_L': (-6, 26, 140), 'hand_R': (-6, -32, 92), 'aim': 70},
    strike={'step': (12, -6), 'lean': 18, 'twist': 20, 'hand_L': (50, 14, 112), 'hand_R': (-10, -32, 90), 'aim': 60, 'foot_L': (40, 14, 1)},
    follow={'step': (10, -4), 'lean': 14, 'twist': 14, 'hand_L': (44, 14, 106), 'hand_R': (-8, -32, 90), 'aim': 60, 'foot_L': (36, 14, 1)}))
# Ascension of the Damned: he rises on the ice column, Frostmourne raised, the vortex turning about him.
RISE = {'lean': -8, 'hand_R': (6, -26, 148), 'aim': 92, 'hand_L': (24, 30, 132), 'foot_R': (4, -16, 6), 'foot_L': (-4, 14, 6)}
author('Special Up', {0: {}, 5: {'step': (0, -24), 'lean': 14, 'hand_R': (20, -30, 64), 'aim': -40, 'hand_L': (16, 24, 70)},
                      zero(8): RISE, 18: {**RISE, 'twist': -25, 'aim': 96}, 24: {**RISE, 'twist': 25, 'aim': 88}, zero(30): RISE,
                      38: {**FALL, 'lean': 10, 'hand_R': (20, -30, 100), 'aim': 40}, 46: FALL}, plant=False)

# Append transitions and floor recovery after the combat clips: their existing
# sequence indices are used by the clip pool and must remain stable (#171).
author('Turn', {0: {'step': (0, -10), 'lean': -14, 'twist': 24, **GUARD},
                4: {'step': (0, -18), 'lean': 10, 'twist': -24, **GUARD}, 8: {}})
author('Stop', {0: {'step': (0, -8), 'lean': 24, **GUARD},
                3: {'step': (-6, -16), 'lean': -16, **GUARD}, 8: {}})
author('Jump Squat', {0: {}, 3: {'step': (0, -18), 'lean': 14, **GUARD}})
# Neutral tech braces low on contact, then pushes back into the guard.
TECH_BRACE = {'step': (0, -42), 'lean': 38, 'hand_R': (14, -30, 64), 'aim': -30,
              'hand_L': (42, 20, 24), **WIDE}
author('Tech', {0: TECH_BRACE, 6: {**TECH_BRACE, 'step': (0, -34)},
                15: {'step': (0, -18), 'lean': 18, **GUARD}, 26: {}})
# Directional techs tuck on contact; their travel is owned by the simulation.
for name, sign in [('Tech Forward', 1), ('Tech Backward', -1)]:
    author(name, {0: TECH_BRACE,
                  8: {'step': (0, -36), 'lean': sign * 32, 'spin': sign * 24,
                      'hand_R': (10, -30, 78), 'aim': sign * -50, 'hand_L': (12, 24, 64)},
                  24: {'step': (0, -28), 'lean': sign * 24, 'spin': sign * 18, **GUARD},
                  40: {}})
# Get-up rolls start at the same lying pose as get-up, with the free hand
# bracing while the body rises into a low directional escape.
for name, sign in [('Get Up Roll Forward', 1), ('Get Up Roll Backward', -1)]:
    author(name, {0: {'rise': 0},
                  7: {'rise': .3, 'step': (0, 6), 'lean': sign * 12},
                  16: {'rise': .7, 'step': (0, -14), 'lean': sign * 32, 'spin': sign * 20,
                       'hand_R': (12, -30, 78), 'aim': sign * -40, 'hand_L': (24, 24, 42)},
                  26: {'rise': 1, 'step': (0, -20), 'lean': sign * 18, **GUARD},
                  35: {'rise': 1}},
           base_from='Death', base_frame=int(death.frame_range[0]) + lie,
           standing_from=('Stand Ready', 0), plant=False)

# Where Frostmourne's point and the sword hand are on the clip's first and strike frames.
for name, frame in [('Attack Jab', 5), ('Attack Jab 2', 6), ('Attack Jab 3', 8), ('Forward Tilt', 10), ('Up Tilt', 9), ('Down Tilt', 8), ('Dash Attack', 11),
                    ('Forward Smash', 21), ('Up Smash', 17), ('Down Smash', 16), ('Aerial Neutral', 9), ('Aerial Forward', 13), ('Aerial Back', 10),
                    ('Aerial Up', 9), ('Aerial Down', 17), ('Grab', 8), ('Get Up Attack', 16), ('Ledge Attack', 16), ('Special Neutral', 15), ('Special Side', 13)]:
    rows = []
    for f in (0, frame):
        sample(bpy.data.actions[name], f)
        rows.append('f%d tip (%.0f, %.0f) hand (%.0f, %.0f) lhand (%.0f, %.0f)' % (f, tip().x, tip().z, bones['Rhand'].matrix.translation.x, bones['Rhand'].matrix.translation.z, bones['Lhand'].matrix.translation.x, bones['Lhand'].matrix.translation.z))
    print('LICH_KING_STRIKE', name, ' | '.join(rows), flush=True)

scene.frame_set(0)
rig.animation_data.action = bpy.data.actions['Stand Ready']
rig.animation_data.action_slot = rig_slot(bpy.data.actions['Stand Ready'])
exported = out / 'LichKingFighter.mdl'
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'LichKingFighter.blend'))
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if 'FINISHED' not in result or not exported.is_file():
    raise RuntimeError(f'Lich King export failed: {result}')
(out / 'clips.json').write_text(json.dumps({'builtIn': BUILT_IN, 'authored': CLIPS}, indent=2))
print('LICH_KING_EXPORTED', exported, exported.stat().st_size, flush=True)
