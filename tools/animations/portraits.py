"""Blender boundary: render the authored Warcraft fighters for selection cards."""
from pathlib import Path
import sys

import addon_utils
import bpy
from mathutils import Matrix, Vector

project = Path(__file__).resolve().parents[2]
assets = project / "build/animation-assets"
output = project / "build/selection-assets"
output.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, "/home/tom/code/mdl-exporter4/worktrees/blender5")
addon_utils.enable("export_mdl", default_set=True)
prefs = bpy.context.preferences.addons["export_mdl"].preferences
prefs.resourceFolder = str(assets / "textures")
prefs.textureExtension = "png"

arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
fighters = [arg for arg in arguments if arg != "--inspect"]
if len(fighters) != 1 or fighters[0] not in ("Archer", "Rifleman", "DemonHunter"):
    raise ValueError("pass -- Archer, -- Rifleman, or -- DemonHunter, optionally --inspect")

for fighter in fighters:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    if fighter == "DemonHunter":
        bpy.ops.wm.open_mainfile(filepath=str(project / "build/illidan-animation/demonhunter-fighter.blend"))
    else:
        getattr(bpy.ops, "import").mdl_exporter(
            filepath=str(assets / f"{fighter.lower()}-fighter.mdl"),
            setTeamColor="1" if fighter == "Rifleman" else "0",
        )
    scene = bpy.context.scene
    rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
    action_name = "Stand" if fighter == "DemonHunter" else "Stand Ready"
    action = next(action for action in bpy.data.actions if action.name == action_name and any(slot.identifier[2:] == rig.name for slot in action.slots))
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    for obj in (obj for obj in scene.objects if obj.type == "MESH"):
        slot = next((slot for slot in action.slots if slot.identifier[2:] == obj.name), None)
        if slot:
            obj.animation_data_create()
            obj.animation_data.action = action
            obj.animation_data.action_slot = slot
    scene.frame_set(int(action.frame_range[0]))
    bpy.context.view_layer.update()
    for obj in (obj for obj in scene.objects if obj.type == "MESH"):
        obj.hide_render = obj.get(obj.name, {}).get("visibility", 1) < 0.5
        if fighter == "DemonHunter":
            # Selection portraits frame the body and weapons, without the
            # world-space hero aura or alternate-form effect geometry.
            obj.hide_render = obj.hide_render or obj.name not in {
                f"{index} HeroDemonHunter" for index in (0, 1, 3, 4, 5)
            }
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if "--inspect" in sys.argv:
        print("PORTRAIT_ACTION", fighter, action.name, tuple(action.frame_range))
        for obj in (obj for obj in scene.objects if obj.type == "MESH"):
            print("PORTRAIT_MESH", fighter, obj.name, dict(obj.get(obj.name, {})), obj.hide_render, tuple(obj.dimensions))
        for material in bpy.data.materials:
            if material.node_tree:
                print("PORTRAIT_MATERIAL", material.name, [(node.name, [(item.name, str(item.default_value)) for item in node.inputs if hasattr(item, "default_value")]) for node in material.node_tree.nodes if node.type == "MATH"])
        continue
    if fighter == "DemonHunter":
        scene.render.engine = "BLENDER_EEVEE"
        scene.eevee.taa_render_samples = 64
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = 1.5
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.8, 0.85, 1.0, 1.0)
    background.inputs["Strength"].default_value = 0.7
    target = Vector((0, 0, 85 if fighter == "DemonHunter" else 55))
    camera_position = (340, -150, 115) if fighter == "Rifleman" else (210, -300, 115)
    if fighter == "DemonHunter":
        camera_position = (210, 300, 115)
    bpy.ops.object.camera_add(location=camera_position)
    camera = bpy.context.object
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 240 if fighter == "DemonHunter" else 150
    scene.camera = camera
    for position, power, size in [((120, -150, 200), 52000, 140), ((-100, -60, 110), 22000, 100), ((30, 130, 180), 65000, 100)]:
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(output / f"{fighter}Portrait.png")
    bpy.ops.render.render(write_still=True)
    print("SELECTION_PORTRAIT", fighter, scene.render.filepath)
