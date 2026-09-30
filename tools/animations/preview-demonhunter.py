"""Render stock Demon Hunter clips from both gameplay sides for rig inspection."""
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

project = Path(__file__).resolve().parents[2]
assets = project / "build/illidan-assets"
bpy.ops.wm.open_mainfile(filepath=str(assets / "demonhunter.blend"))
scene = bpy.context.scene
for image in bpy.data.images:
    if image.source != "FILE" or image.packed_file:
        continue
    image_name = image.name.removesuffix(".png")
    matches = list((assets / "textures").rglob(image_name + ".png"))
    if matches:
        image.filepath = str(matches[0])
        image.reload()
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
scene.render.engine = "BLENDER_EEVEE"
scene.world.color = (0.35, 0.35, 0.35)
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = 384
scene.render.resolution_y = 384
scene.render.resolution_percentage = 100
target = Vector((0, -1, 72))
bpy.ops.object.camera_add(location=(0, -420, 72))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 184
scene.camera = camera
bpy.ops.object.light_add(type="AREA", location=(160, -280, 220))
bpy.context.object.data.energy = 3500
bpy.context.object.data.shape = "DISK"
bpy.context.object.data.size = 250

samples = [
    ("Stand Ready", 0), ("Stand Ready", 9), ("Stand Ready", 18),
    ("Attack", 0), ("Attack", 11), ("Attack", 22),
    ("Stand Ready Alternate", 9), ("Attack Alternate", 11),
    ("Spell", 0), ("Spell", 9), ("Spell", 18),
    ("Morph", 0), ("Morph", 18), ("Morph", 36),
]
for name, frame in samples:
    action = bpy.data.actions[name]
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    for mesh in (obj for obj in scene.objects if obj.type == "MESH"):
        slot = next((s for s in action.slots if s.identifier[2:] == mesh.name), None)
        if slot:
            mesh.animation_data_create()
            mesh.animation_data.action = action
            mesh.animation_data.action_slot = slot
    for side in ("profile", "back-profile"):
        camera.location = (420, 0, 72) if side == "profile" else (-420, 0, 72)
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        scene.frame_set(frame)
        for mesh in (obj for obj in scene.objects if obj.type == "MESH"):
            # Respect only visibility authored by the source model. Do not
            # suppress geosets by texture or bone-name heuristics: effect and
            # glow layers are part of the actual model and need review too.
            mesh.hide_render = float(mesh.get(mesh.name, {}).get("visibility", 1.0)) < 0.5
        scene.render.filepath = str(assets / f"demonhunter-stock-{name.lower().replace(' ', '-')}-{frame}-{side}.png")
        bpy.ops.render.render(write_still=True)
print("DEMON_HUNTER_STOCK_PREVIEWS", len(samples) * 2)

action = bpy.data.actions["Stand Ready"]
rig.animation_data.action = action
rig.animation_data.action_slot = action.slots[0]
scene.frame_set(9)
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
for index, selected in enumerate(meshes):
    for mesh in meshes:
        mesh.hide_render = mesh != selected
    scene.render.filepath = str(assets / f"demonhunter-geoset-{index:02d}.png")
    bpy.ops.render.render(write_still=True)
print("DEMON_HUNTER_GEOSET_PREVIEWS", len(meshes))
