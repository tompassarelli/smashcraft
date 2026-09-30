"""Author frame-aligned Archer bow, disengage, and hippogryph special clips."""
from pathlib import Path
import sys

import addon_utils
import bpy
from mathutils import Euler, Matrix, Vector

project = Path(__file__).resolve().parents[2]
assets = project / "build/animation-assets"
addon_path = Path("/home/tom/code/mdl-exporter4/worktrees/blender5")
sys.path.insert(0, str(addon_path))
addon_utils.enable("export_mdl", default_set=True)
preferences = bpy.context.preferences.addons["export_mdl"].preferences
preferences.resourceFolder = str(assets / "textures")
preferences.textureExtension = "png"
bpy.ops.wm.open_mainfile(filepath=str(assets / "archer-fighter.blend"))

scene = bpy.context.scene
scene.render.fps = 24
scene.render.fps_base = 1.0
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
sys.path.insert(0, str(project / "tools/animations"))
sys.dont_write_bytecode = True
from archer_pose import ready_pose, key_pose, key_visibility

base = ready_pose(rig)
bpy.context.view_layer.update()
grab_rest = {bone.name: bone.matrix.copy() for bone in rig.pose.bones}
required = {
    "Bone_Root", "Bone_Pelvis", "Bone_Chest", "Bone_Head",
    "Bone_Arm1_R", "Bone_Arm2_R", "Bone_Arm1_L", "Bone_Arm2_L",
    "Bone_Leg1_R", "Bone_Leg2_R", "Bone_Leg1_L", "Bone_Leg2_L",
}
missing = required - {bone.name for bone in rig.pose.bones}
if missing:
    raise RuntimeError(f"Archer rig is missing special-animation bones: {sorted(missing)}")

def pose(values):
    for bone in rig.pose.bones:
        bone.matrix_basis = base[bone.name]
        bone.rotation_mode = "QUATERNION"

    radians = 0.017453292519943295
    def rotate(name, x=0, y=0, z=0):
        bone = rig.pose.bones[name]
        local = Euler((x*radians, y*radians, z*radians), "XYZ").to_quaternion()
        bone.rotation_quaternion = base[name].to_quaternion() @ local

    rotate("Bone_Root", z=values.get("spin", 0))
    rotate("Bone_Pelvis", z=values.get("hip", 0))
    rotate("Bone_Chest", z=values.get("lean", 0))
    rotate("Bone_Head", z=values.get("head", 0))
    rotate("Bone_Arm1_R", x=values.get("draw", 0), z=values.get("arm_r", 0))
    rotate("Bone_Arm2_R", x=values.get("release", 0), z=values.get("forearm_r", 0))
    rotate("Bone_Arm1_L", x=values.get("bow_arm", 0), z=values.get("bow_arm_z", 0))
    rotate("Bone_Arm2_L", x=values.get("bow_forearm", 0), z=values.get("bow_forearm_z", 0))
    for side in ("R", "L"):
        rotate(f"Bone_Leg1_{side}", z=values.get(f"leg_{side.lower()}", 0))
        rotate(f"Bone_Leg2_{side}", z=values.get(f"knee_{side.lower()}", 0))
    pelvis = rig.pose.bones["Bone_Pelvis"]
    pelvis.location = base["Bone_Pelvis"].translation + Vector((0, -values.get("crouch", 0), 0))
    if values.get('grab_pose', 0):
        from ground_attacks import limb
        strength = values['grab_pose']
        bpy.context.view_layer.update()
        limb(rig, 'Bone_Arm1_R', 'Bone_Arm2_R', 'Hand Right Ref ',
             grab_rest['Hand Right Ref '].translation.lerp(
                 Vector((values.get('reach_x', 36), -5, values.get('reach_z', 68))), strength),
             Vector((-10, -30, 65)))
        limb(rig, 'Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L',
             grab_rest['Bone_Hand_L'].translation.lerp(Vector((-12, 18, 52)), strength),
             Vector((-10, 30, 65)))
        if values.get('kick', 0):
            limb(rig, 'Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R',
                 grab_rest['Bone_Foot_R'].translation.lerp(
                     Vector((48, -10, values.get('kick_z', 43))), values['kick']),
                 Vector((35, -25, 62)))
        limb(rig, 'Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L',
             grab_rest['Bone_Foot_L'].translation, Vector((35, 10, 35)))
        # Shoulder cloth must hang from the arm, not rotate over the palm.
        cloth = rig.pose.bones['Object08']
        location, orientation, scale = cloth.matrix.decompose()
        orientation = orientation.slerp(grab_rest['Object08'].to_quaternion(), strength)
        cloth.matrix = Matrix.LocRotScale(location, orientation, scale)
        bpy.context.view_layer.update()


def author(name, phases, duration):
    existing = bpy.data.actions.get(name)
    if existing is not None:
        bpy.data.actions.remove(existing)
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    action["war3_non_looping"] = True
    slot = action.slots.new("OBJECT", rig.name)
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot
    rig.animation_data.action_extrapolation = "NOTHING"
    frames = sorted(phases)
    for frame in range(duration + 1):
        left = max(key for key in frames if key <= frame)
        right = min(key for key in frames if key >= frame)
        amount = 0 if left == right else (frame - left) / (right - left)
        a, b = phases[left], phases[right]
        channels = set(a) | set(b)
        values = {channel: a.get(channel, 0)*(1-amount) + b.get(channel, 0)*amount
                  for channel in channels}
        scene.frame_set(frame)
        pose(values)
        key_pose(rig, frame)
    key_visibility(action, duration)
    print("ARCHER_SPECIAL_CLIP", name, duration, "frames")


# The neutral arrow is emitted by the simulation on logical frame 2 of 3.
# Both variants therefore show the draw, release, and short follow-through in
# that same first-frame action, rather than replaying a long stock bow shot.
author("Special Neutral", {
    0: {}, 1: {"draw": -12, "release": 8},
    2: {"draw": 14, "release": -34, "lean": -6},
    3: {"draw": 3, "release": -12, "lean": -2},
}, 3)
author("Special Neutral Air", {
    0: {}, 1: {"draw": -12, "release": 8},
    2: {"draw": 14, "release": -34, "lean": -6},
    3: {"draw": 3, "release": -12, "lean": -2},
}, 3)

# Side-B holds a visible drawn-bow aim during its twelve-tick wind-up. The
# fan releases on logical frame 12; the shoulders and bow then relax gradually.
author("Special Side", {
    0: {}, 3: {"draw": -18, "bow_arm": 8, "lean": 5},
    8: {"draw": -52, "release": -8, "bow_arm": 12, "lean": 10, "hip": -6},
    11: {"draw": -56, "release": -12, "bow_arm": 14, "lean": 12, "hip": -8},
    12: {"draw": 32, "release": -48, "bow_arm": 18, "lean": -9, "hip": 5},
    16: {"draw": 18, "release": -26, "bow_arm": 8, "lean": -4},
    24: {"draw": 0, "release": 0, "bow_arm": 0, "lean": 0, "hip": 0},
    34: {},
}, 34)

# Down-B is a backward somersault while the hippogryph rushes past. Root
# rotation supplies the flip; tuck and open poses make its phases readable.
author("Special Down", {
    0: {}, 2: {"spin": -22, "crouch": 8, "hip": -8, "leg_r": 30, "leg_l": 30},
    7: {"spin": -112, "crouch": 3, "hip": -16, "leg_r": 80, "leg_l": 80,
        "knee_r": -65, "knee_l": -65, "draw": -20, "bow_arm": 22},
    14: {"spin": -212, "hip": 10, "leg_r": 64, "leg_l": 64,
         "knee_r": -52, "knee_l": -52, "draw": -14, "bow_arm": 16},
    21: {"spin": -308, "hip": 16, "leg_r": 18, "leg_l": 18,
         "knee_r": -18, "knee_l": -18, "draw": 2, "bow_arm": 4},
    26: {"spin": -360, "lean": 7, "leg_r": -8, "leg_l": -8},
    30: {"spin": -360},
}, 30)

# Up-B presents a forward-leaning riding silhouette: arms reach toward a
# saddle/neck and the legs open around it while all displacement stays in game.
author("Special Up", {
    0: {}, 2: {"lean": -16, "head": 8, "bow_arm": -22, "draw": -24,
              "leg_r": 35, "leg_l": -28, "knee_r": -42, "knee_l": 30},
    6: {"lean": -30, "head": 12, "bow_arm": -36, "draw": -32,
        "leg_r": 68, "leg_l": -54, "knee_r": -62, "knee_l": 48, "hip": -6},
    13: {"lean": -24, "head": 8, "bow_arm": -28, "draw": -22,
         "leg_r": 58, "leg_l": -46, "knee_r": -55, "knee_l": 38},
    20: {"lean": -10, "head": 4, "bow_arm": -12, "draw": -10,
         "leg_r": 26, "leg_l": -22, "knee_r": -24, "knee_l": 15},
    24: {},
}, 24)

from damage import author_archer_damage
author_archer_damage(author)
grabbed = {'lean': 26, 'head': -12, 'draw': -12, 'release': 25,
           'bow_arm': -20, 'hip': -8, 'crouch': 5}
author('Grabbed', {0: grabbed, 24: grabbed}, 24)

from grab_animations import author_grabs
author_grabs(author, 'Archer')

scene.frame_set(0)
editable = assets / "archer-fighter.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(editable))
exported = assets / "archer-fighter.mdl"
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if "FINISHED" not in result or not exported.is_file():
    raise RuntimeError(f"Archer special export failed: {result}")
print("ARCHER_SPECIALS_EXPORTED", exported, exported.stat().st_size)
