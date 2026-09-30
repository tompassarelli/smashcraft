"""Import Warcraft's installed Demon Hunter into an editable Blender scene."""
import os
from pathlib import Path
import sys

import addon_utils
import bpy

project = Path(__file__).resolve().parents[2]
assets = project / "build/illidan-assets"
addon = Path(os.environ.get("WC3_MDL_ADDON", "/home/tom/code/mdl-exporter4/worktrees/blender5"))
sys.path.insert(0, str(addon))
addon_utils.enable("export_mdl", default_set=True)
preferences = bpy.context.preferences.addons["export_mdl"].preferences
preferences.resourceFolder = str(assets / "textures")
preferences.textureExtension = "png"

# Blender starts with a Cube, camera and light. Import the model into a clean
# scene so those startup objects never enter the fighter rig or its exports.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

source = assets / "demonhunter.mdx"
if not source.is_file():
    raise FileNotFoundError(source)
result = getattr(bpy.ops, "import").mdl_exporter(filepath=str(source))
if "FINISHED" not in result:
    raise RuntimeError(f"Demon Hunter import did not finish: {result}")

armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
if len(armatures) != 1:
    raise RuntimeError(f"expected one Demon Hunter armature, found {len(armatures)}")
rig = armatures[0]
print("DEMON_HUNTER_RIG", rig.name, len(rig.data.bones))
print("DEMON_HUNTER_ACTIONS", ", ".join(sorted(action.name for action in bpy.data.actions)))
destination = assets / "demonhunter.blend"
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
print("DEMON_HUNTER_SCENE", destination)
