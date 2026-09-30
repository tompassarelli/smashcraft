"""Author and export an Archer jab while retaining the imported animations."""

from pathlib import Path
import sys

import bpy
from mathutils import Euler

project = Path(__file__).resolve().parents[2]
assets = project / "build/animation-assets"
scene_path = assets / "archer.blend"
addon_path = Path("/home/tom/code/mdl-exporter4/worktrees/blender5")
sys.path.insert(0, str(addon_path))
import addon_utils

addon_utils.enable("export_mdl", default_set=True)
preferences = bpy.context.preferences.addons["export_mdl"].preferences
preferences.resourceFolder = str(assets / "textures")
preferences.textureExtension = "png"
bpy.ops.wm.open_mainfile(filepath=str(scene_path))

scene = bpy.context.scene
scene.render.fps = 24
scene.render.fps_base = 1.0
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
sys.path.insert(0, str(project / "tools/animations"))
sys.dont_write_bytecode = True
from archer_pose import ready_pose, key_pose, key_visibility
base = ready_pose(rig)
bone_names = {bone.name for bone in rig.data.bones}
upper_name = "Bone_Arm1_R"
forearm_name = "Bone_Arm2_R"
if upper_name not in bone_names or forearm_name not in bone_names:
    raise RuntimeError("Archer rig is missing the arm bones needed for a jab")

# This clip is 36 source frames. The strike reaches contact on frame 4, then
# holds through the authored duration so gameplay's contact timing is explicit.
action = bpy.data.actions.new(name="Attack Jab")
action.use_fake_user = True
action["war3_non_looping"] = True
slot = action.slots.new("OBJECT", rig.name)
rig.animation_data_create()
rig.animation_data.action = action
rig.animation_data.action_slot = slot
rig.pose.bones[upper_name].rotation_mode = "QUATERNION"
rig.pose.bones[forearm_name].rotation_mode = "QUATERNION"

# Local X offsets the held-bow ready pose. The upper arm leads the strike;
# the forearm extends it, with a quick retract.
poses = {
    0: (0, 0),
    2: (-10, 4),
    4: (28, -34),
    8: (28, -34),
    12: (14, -18),
    18: (0, 0),
    36: (0, 0),
}
for frame, (upper_degrees, forearm_degrees) in poses.items():
    scene.frame_set(frame)
    for bone in rig.pose.bones:
        bone.matrix_basis = base[bone.name]
    upper = rig.pose.bones[upper_name]
    forearm = rig.pose.bones[forearm_name]
    upper.rotation_quaternion = base[upper_name].to_quaternion() @ Euler((upper_degrees * 0.017453292519943295, 0, 0), "XYZ").to_quaternion()
    forearm.rotation_quaternion = base[forearm_name].to_quaternion() @ Euler((forearm_degrees * 0.017453292519943295, 0, 0), "XYZ").to_quaternion()
    key_pose(rig, frame)

key_visibility(action, 36)

scene.frame_set(0)
editable = assets / "archer-jab.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(editable))

exported = assets / "archer-jab.mdl"
result = bpy.ops.export.mdl_exporter(filepath=str(exported), use_actions=True)
if "FINISHED" not in result or not exported.is_file():
    raise RuntimeError(f"Archer jab export failed: {result}")
print("ARCHER_JAB_EXPORTED", exported, exported.stat().st_size)
print("ARCHER_JAB_EDITABLE", editable, editable.stat().st_size)
print("RETAINED_ACTIONS", ", ".join(sorted(a.name for a in bpy.data.actions)))
