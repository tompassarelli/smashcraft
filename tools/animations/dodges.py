"""Add forward/backward roll and spot-dodge clips to Archer's editable scene."""

from pathlib import Path
import sys

import bpy
from mathutils import Euler, Vector
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
sys.path.insert(0, str(project / "tools/animations"))
sys.dont_write_bytecode = True
from archer_pose import ready_pose, key_pose, key_visibility
base = ready_pose(rig)
bone_names = {bone.name for bone in rig.data.bones}

# Archer's source model animates a separate arrow geoset along the Arrow bone.
# Gameplay shots are simulated and rendered by Wurst, so omit that travelling
# projectile geometry from the fighter while retaining the skeleton.
arrow_geosets = []
for mesh in (obj for obj in scene.objects if obj.type == "MESH"):
    arrow_group = mesh.vertex_groups.get("Arrow")
    if arrow_group is None:
        continue
    weighted_groups = {
        element.group
        for vertex in mesh.data.vertices
        for element in vertex.groups
        if element.weight > 0
    }
    if weighted_groups == {arrow_group.index}:
        arrow_geosets.append(mesh)
if len(arrow_geosets) != 1:
    raise RuntimeError(f"expected one Arrow-only projectile geoset, found {len(arrow_geosets)}")
removed_mesh_names = [mesh.name for mesh in arrow_geosets]
for mesh in arrow_geosets:
    mesh_data = mesh.data
    bpy.data.objects.remove(mesh, do_unlink=True)
    if mesh_data.users == 0:
        bpy.data.meshes.remove(mesh_data)
print("REMOVED_AUTHORED_PROJECTILE_GEOMETRY", removed_mesh_names)

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
    action["war3_non_looping"] = True
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
        for bone in rig.pose.bones:
            bone.matrix_basis = base[bone.name]
        pose = keyframes.get(frame, keyframes[max(key for key in keyframes if key <= frame)])
        for bone_name in bones:
            bone = rig.pose.bones[bone_name]
            channels = pose.get(bone_name, {})
            if "rotations" in channels:
                rotation = quaternion(0)
                for axis, degrees in channels["rotations"]:
                    rotation = rotation @ quaternion(degrees, axis)
                bone.rotation_quaternion = base[bone_name].to_quaternion() @ rotation
            else:
                bone.rotation_quaternion = base[bone_name].to_quaternion() @ quaternion(channels.get("rotation", 0), channels.get("axis", "X"))
            bone.location = base[bone_name].translation + Vector(channels.get("location", (0.0, 0.0, 0.0)))
        key_pose(rig, frame)
    key_visibility(action, frame_end)
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

def tilt_pose(angle, elevation, extension):
    return {
        "Bone_Chest": {"rotation": -5 * extension},
        "Bone_Head": {"rotation": 4 * extension},
        "Bone_Arm1_R": {"rotations": [("X", angle), ("Y", elevation)]},
        "Bone_Arm2_R": {"rotations": [("X", -42 * extension), ("Y", elevation * 0.65)]},
        "Bone_Arm1_L": {"rotation": -12 * extension},
        "Bone_Arm2_L": {"rotation": 8 * extension},
        "Bone_Leg1_R": {"rotation": -8 * extension},
        "Bone_Leg2_R": {"rotation": 10 * extension},
        "Bone_Leg1_L": {"rotation": 5 * extension},
        "Bone_Leg2_L": {"rotation": -8 * extension},
    }


def make_tilt(name, arm_degrees):
    phases = {
        0: (0, 0.0),
        2: (-12, 0.45),
        5: (arm_degrees, 1),
        7: (arm_degrees, 1),
        11: (arm_degrees * 0.55, 0.75),
        17: (arm_degrees * 0.2, 0.3),
        23: (0, 0.05),
        28: (0, 0),
    }
    elevation = {"Forward Tilt Up": 65, "Forward Tilt Down": -65}.get(name, 0)
    poses = {}
    for frame, (angle, extension) in phases.items():
        poses[frame] = tilt_pose(angle, elevation * extension, extension)
    make_action(name, poses, 28)


make_tilt("Forward Tilt", 68)
make_tilt("Forward Tilt Up", 34)
make_tilt("Forward Tilt Down", 94)

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


def getup_pose(root_angle, tuck, sweep=0):
    return {
        "Bone_Root": {"rotation": root_angle, "axis": "Z"},
        "Bone_Pelvis": {"location": (0, -7 * tuck, 0)},
        "Bone_Chest": {"rotation": -12 * tuck},
        "Bone_Head": {"rotation": 9 * tuck},
        "Bone_Arm1_R": {"rotations": [("X", 25 * tuck + 60 * sweep), ("Z", -25 * sweep)]},
        "Bone_Arm2_R": {"rotations": [("X", -42 * tuck - 35 * sweep), ("Z", -20 * sweep)]},
        "Bone_Arm1_L": {"rotations": [("X", -25 * tuck - 60 * sweep), ("Z", 25 * sweep)]},
        "Bone_Arm2_L": {"rotations": [("X", 42 * tuck + 35 * sweep), ("Z", 20 * sweep)]},
        "Bone_Leg1_R": {"rotation": -30 * tuck, "axis": "Z"},
        "Bone_Leg2_R": {"rotation": 45 * tuck, "axis": "Z"},
        "Bone_Leg1_L": {"rotation": 30 * tuck, "axis": "Z"},
        "Bone_Leg2_L": {"rotation": -45 * tuck, "axis": "Z"},
    }


make_action("Knockdown", {
    0: getup_pose(0, 0),
    3: getup_pose(28, 0.6),
    7: getup_pose(78, 1),
    10: getup_pose(90, 1),
    12: getup_pose(90, 1),
}, 12)

make_action("Get Up", {
    0: getup_pose(90, 1),
    5: getup_pose(88, 1),
    12: getup_pose(65, 0.8),
    20: getup_pose(30, 0.45),
    26: getup_pose(8, 0.15),
    30: getup_pose(0, 0),
}, 30)

make_action("Get Up Attack", {
    0: getup_pose(90, 1),
    5: getup_pose(87, 1, -0.4),
    10: getup_pose(82, 0.9, -0.6),
    16: getup_pose(72, 0.75, 1),
    18: getup_pose(66, 0.65, 1),
    23: getup_pose(48, 0.5, 0.45),
    30: getup_pose(18, 0.2),
    38: getup_pose(0, 0),
    45: getup_pose(0, 0),
}, 45)

sys.path.insert(0, str(project / "tools/animations"))
sys.dont_write_bytecode = True
from aerials import author_archer_aerials
author_archer_aerials(make_action, tilt_pose)
from ledges import author_ledges
author_ledges(rig, "Archer")

editable = assets / "archer-fighter.blend"
exported = assets / "archer-fighter.mdl"
bpy.ops.wm.save_as_mainfile(filepath=str(editable))
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if "FINISHED" not in result or not exported.is_file():
    raise RuntimeError(f"Archer dodge export failed: {result}")
print("ARCHER_FIGHTER_EXPORTED", exported, exported.stat().st_size)
print("ARCHER_FIGHTER_EDITABLE", editable, editable.stat().st_size)
print("AUTHORED_ACTIONS", "Attack Jab, Forward Tilt, Forward Tilt Up, Forward Tilt Down, Jump, Double Jump, Roll Forward, Roll Backward, Spot Dodge, Knockdown, Get Up, Get Up Attack")
