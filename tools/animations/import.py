# Blender API boundary: preserve an installed fighter as an editable scene.
import os
from pathlib import Path
import sys

import addon_utils
import bpy

project = Path(__file__).resolve().parents[2]
addon = Path(os.environ.get("WC3_MDL_ADDON", "/home/tom/code/mdl-exporter4/worktrees/blender5"))
sys.path.insert(0, str(addon))
addon_utils.enable("export_mdl", default_set=True)
preferences = bpy.context.preferences.addons["export_mdl"].preferences
preferences.resourceFolder = str(project / "build/animation-assets/textures")
preferences.textureExtension = "png"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(args) != 1 or args[0] != "rifleman":
    raise ValueError("pass -- rifleman")
name = args[0]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
source = project / "build/animation-assets" / (name + ".mdl")
result = getattr(bpy.ops, "import").mdl_exporter(filepath=str(source))
if "FINISHED" not in result:
    raise RuntimeError("fighter import did not finish")
destination = source.with_suffix(".blend")
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
print("WC3_FIGHTER_SCENE", destination)
