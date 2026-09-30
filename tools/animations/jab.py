"""Author Archer ground attacks while retaining the imported animations."""

from pathlib import Path
import sys

import bpy

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
from ground_attacks import author_archer_ground
author_archer_ground(rig)

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
