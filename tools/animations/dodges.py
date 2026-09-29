"""Add forward/backward roll and spot-dodge clips to Archer's editable scene."""

from pathlib import Path
import sys

import bpy
from mathutils import Euler
import addon_utils

project = Path(__file__).resolve().parents[2]
assets = project / "build/animation-assets"
scene_path = assets / "archer-jab.blend"
addon_path = Path("/home/tom/code/mdl-exporter4/worktrees/blender5")
sys.path.insert(0, str(addon_path))
addon_utils.enable("export_mdl", default_set=True)
preferences = bpy.context.preferences.addons["export_mdl"].preferences
preferences.resourceFolder = str(assets / "textures")
preferences.textureExtension = "png"
bpy.ops.wm.open_mainfile(filepath=str(scene_path))
scene = bpy.context.scene
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
bone_names = {bone.name for bone in rig.data.bones}

required = {
    "Bone_Root", "Bone_Pelvis", "Bone_Chest", "Bone_Head",
    "Bone_Arm1_R", "Bone_Arm2_R", "Bone_Arm1_L", "Bone_Arm2_L",
    "Bone_Leg1_R", "Bone_Leg2_R", "Bone_Leg1_L", "Bone_Leg2_L",
}
missing = required - bone_names
if missing:
    raise RuntimeError(f"Archer rig is missing dodge bones: {sorted(missing)}")

scene.render.fps = 24
scene.render.fps_base = 1.0
radians = 0.017453292519943295


def quaternion(degrees, axis="X"):
    values = [0.0, 0.0, 0.0]
    values["XYZ".index(axis)] = degrees * radians
    return Euler(values, "XYZ").to_quaternion()


def make_action(name, keyframes, frame_end):
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    slot = action.slots.new("OBJECT", rig.name)
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = slot
    rig.animation_data.action_extrapolation = "NOTHING"

    bones = set().union(*(pose.keys() for pose in keyframes.values()))
    for bone_name in bones:
        bone = rig.pose.bones[bone_name]
        bone.rotation_mode = "QUATERNION"

    for frame in sorted(set(keyframes) | {0, frame_end}):
        scene.frame_set(frame)
        pose = keyframes.get(frame, keyframes[max(key for key in keyframes if key <= frame)])
        for bone_name in bones:
            bone = rig.pose.bones[bone_name]
            channels = pose.get(bone_name, {})
            bone.rotation_quaternion = quaternion(channels.get("rotation", 0), channels.get("axis", "X"))
            bone.location = channels.get("location", (0.0, 0.0, 0.0))
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone_name)
            if "location" in channels or any("location" in point.get(bone_name, {}) for point in keyframes.values()):
                bone.keyframe_insert(data_path="location", frame=frame, group=bone_name)
    scene.frame_set(0)
    return action


def roll_pose(angle, tuck):
    return {
        "Bone_Root": {"rotation": angle, "axis": "Z"},
        "Bone_Arm1_R": {"rotation": 35 * tuck},
        "Bone_Arm2_R": {"rotation": -72 * tuck},
        "Bone_Arm1_L": {"rotation": -35 * tuck},
        "Bone_Arm2_L": {"rotation": 72 * tuck},
        "Bone_Leg1_R": {"rotation": -28 * tuck},
        "Bone_Leg2_R": {"rotation": 68 * tuck},
        "Bone_Leg1_L": {"rotation": 28 * tuck},
        "Bone_Leg2_L": {"rotation": -68 * tuck},
    }


roll_phases = {
    0: (0, 0),
    2: (-8, 0.6),
    4: (-35, 1),
    8: (-95, 1),
    12: (-180, 1),
    16: (-265, 1),
    19: (-300, 0.9),
    23: (-360, 0.65),
    27: (-360, 0.25),
    31: (-360, 0),
}
forward_roll = {frame: roll_pose(*phase) for frame, phase in roll_phases.items()}
backward_roll = {
    frame: roll_pose(-angle, tuck)
    for frame, (angle, tuck) in roll_phases.items()
}
make_action("Roll Forward", forward_roll, 31)
make_action("Roll Backward", backward_roll, 31)

jump_poses = {
    0: {},
    3: {
        "Bone_Chest": {"rotation": -5},
        "Bone_Head": {"rotation": 5},
        "Bone_Arm1_R": {"rotation": -24},
        "Bone_Arm2_R": {"rotation": -30},
        "Bone_Arm1_L": {"rotation": 24},
        "Bone_Arm2_L": {"rotation": 30},
        "Bone_Leg1_R": {"rotation": 32, "axis": "Z"},
        "Bone_Leg2_R": {"rotation": -50, "axis": "Z"},
        "Bone_Leg1_L": {"rotation": 32, "axis": "Z"},
        "Bone_Leg2_L": {"rotation": -50, "axis": "Z"},
    },
    8: {
        "Bone_Chest": {"rotation": -8},
        "Bone_Head": {"rotation": 8},
        "Bone_Arm1_R": {"rotation": -48},
        "Bone_Arm2_R": {"rotation": -18},
        "Bone_Arm1_L": {"rotation": 48},
        "Bone_Arm2_L": {"rotation": 18},
        "Bone_Leg1_R": {"rotation": 60, "axis": "Z"},
        "Bone_Leg2_R": {"rotation": -95, "axis": "Z"},
        "Bone_Leg1_L": {"rotation": 60, "axis": "Z"},
        "Bone_Leg2_L": {"rotation": -95, "axis": "Z"},
    },
    14: {
        "Bone_Chest": {"rotation": -4},
        "Bone_Head": {"rotation": 4},
        "Bone_Arm1_R": {"rotation": -38},
        "Bone_Arm1_L": {"rotation": 38},
        "Bone_Leg1_R": {"rotation": 48, "axis": "Z"},
        "Bone_Leg2_R": {"rotation": -80, "axis": "Z"},
        "Bone_Leg1_L": {"rotation": 48, "axis": "Z"},
        "Bone_Leg2_L": {"rotation": -80, "axis": "Z"},
    },
    20: {
        "Bone_Arm1_R": {"rotation": -12},
        "Bone_Arm1_L": {"rotation": 12},
        "Bone_Leg1_R": {"rotation": 25, "axis": "Z"},
        "Bone_Leg2_R": {"rotation": -40, "axis": "Z"},
        "Bone_Leg1_L": {"rotation": 25, "axis": "Z"},
        "Bone_Leg2_L": {"rotation": -40, "axis": "Z"},
    },
    24: {},
}
make_action("Jump", jump_poses, 24)

double_jump_phases = {
    0: (0, 0),
    3: (-28, 0.8),
    7: (-85, 1),
    12: (-170, 1),
    17: (-250, 1),
    22: (-320, 0.9),
    27: (-360, 0.45),
    30: (-360, 0),
}
double_jump_poses = {
    frame: roll_pose(angle, tuck)
    for frame, (angle, tuck) in double_jump_phases.items()
}
make_action("Double Jump", double_jump_poses, 30)

spot_pose = {
    0: {
        "Bone_Pelvis": {"location": (0, 0, 0)},
        "Bone_Chest": {"rotation": 0},
        "Bone_Head": {"rotation": 0},
        "Bone_Leg1_R": {"rotation": 0},
        "Bone_Leg1_L": {"rotation": 0},
    },
    2: {
        "Bone_Pelvis": {"location": (0, -5, 0)},
        "Bone_Chest": {"rotation": -8},
        "Bone_Head": {"rotation": 5},
        "Bone_Leg1_R": {"rotation": -12},
        "Bone_Leg1_L": {"rotation": -12},
    },
    5: {
        "Bone_Pelvis": {"location": (0, -13, 0)},
        "Bone_Chest": {"rotation": -18},
        "Bone_Head": {"rotation": 12},
        "Bone_Leg1_R": {"rotation": -30},
        "Bone_Leg1_L": {"rotation": -30},
        "Bone_Leg2_R": {"rotation": 28},
        "Bone_Leg2_L": {"rotation": 28},
        "Bone_Arm1_R": {"rotation": 18},
        "Bone_Arm2_R": {"rotation": -30},
        "Bone_Arm1_L": {"rotation": -18},
        "Bone_Arm2_L": {"rotation": 30},
    },
    15: {
        "Bone_Pelvis": {"location": (0, -13, 0)},
        "Bone_Chest": {"rotation": -18},
        "Bone_Head": {"rotation": 12},
        "Bone_Leg1_R": {"rotation": -30},
        "Bone_Leg1_L": {"rotation": -30},
        "Bone_Leg2_R": {"rotation": 28},
        "Bone_Leg2_L": {"rotation": 28},
        "Bone_Arm1_R": {"rotation": 18},
        "Bone_Arm2_R": {"rotation": -30},
        "Bone_Arm1_L": {"rotation": -18},
        "Bone_Arm2_L": {"rotation": 30},
    },
    19: {
        "Bone_Pelvis": {"location": (0, -8, 0)},
        "Bone_Chest": {"rotation": -8},
        "Bone_Head": {"rotation": 5},
        "Bone_Leg1_R": {"rotation": -14},
        "Bone_Leg1_L": {"rotation": -14},
        "Bone_Arm1_R": {"rotation": 8},
        "Bone_Arm1_L": {"rotation": -8},
    },
    23: {
        "Bone_Pelvis": {"location": (0, 0, 0)},
        "Bone_Chest": {"rotation": 0},
        "Bone_Head": {"rotation": 0},
        "Bone_Leg1_R": {"rotation": 0},
        "Bone_Leg1_L": {"rotation": 0},
        "Bone_Leg2_R": {"rotation": 0},
        "Bone_Leg2_L": {"rotation": 0},
        "Bone_Arm1_R": {"rotation": 0},
        "Bone_Arm2_R": {"rotation": 0},
        "Bone_Arm1_L": {"rotation": 0},
        "Bone_Arm2_L": {"rotation": 0},
    },
}
make_action("Spot Dodge", spot_pose, 23)

editable = assets / "archer-fighter.blend"
exported = assets / "archer-fighter.mdl"
bpy.ops.wm.save_as_mainfile(filepath=str(editable))
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if "FINISHED" not in result or not exported.is_file():
    raise RuntimeError(f"Archer dodge export failed: {result}")
print("ARCHER_FIGHTER_EXPORTED", exported, exported.stat().st_size)
print("ARCHER_FIGHTER_EDITABLE", editable, editable.stat().st_size)
print("AUTHORED_ACTIONS", "Attack Jab, Jump, Double Jump, Roll Forward, Roll Backward, Spot Dodge")
