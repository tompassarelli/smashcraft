"""Blender boundary: render one Warcraft fighter model for the selection portraits.

Blender's only scripting interface is Python; tools/selection/render-fighters.ts
drives this script once per fighter, so every fighter gets the same camera
direction, lights and framing.

Usage: blender --background --python render-fighter.py -- MODEL RESOURCES OUTPUT.png ADDON TEAM
TEAM is the Warcraft team colour index the model's team-colour layers show.
Prints RENDER_HEAD x y (pixels from the top left) when the model has a head bone.
"""
import math
import sys
from pathlib import Path

import addon_utils
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

model, resources, output, addon, team = sys.argv[sys.argv.index("--") + 1:]
sys.path.insert(0, addon)
addon_utils.enable("export_mdl", default_set=True)
prefs = bpy.context.preferences.addons["export_mdl"].preferences
prefs.resourceFolder = resources
prefs.textureExtension = "png"

RESOLUTION = 1024
# Three-quarter view from the fighter's front right, slightly above; Warcraft models face +X.
VIEW = Vector((0.82, -0.52, 0.24)).normalized()
POSES = ("Stand Ready", "Stand Victory", "Stand")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
getattr(bpy.ops, "import").mdl_exporter(filepath=model, setTeamColor=team)
scene = bpy.context.scene
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")


def pose_action():
    owned = [action for action in bpy.data.actions if any(slot.identifier[2:] == rig.name for slot in action.slots)]
    for name in POSES:
        for action in owned:
            if action.name == name or action.name.startswith(name + " "):
                return action
    return owned[0]


action = pose_action()
for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
rig.animation_data_create()
rig.animation_data.action = action
rig.animation_data.action_slot = action.slots[0]
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
for obj in meshes:
    slot = next((slot for slot in action.slots if slot.identifier[2:] == obj.name), None)
    if slot:
        obj.animation_data_create()
        obj.animation_data.action = action
        obj.animation_data.action_slot = slot
scene.frame_set(int(action.frame_range[0]))
bpy.context.view_layer.update()
visible = []
for obj in meshes:
    # Hidden geometry stays hidden; the hero glow ring under the feet is not the fighter.
    glow = any(material is not None and material.name.startswith("TeamGlow") for material in obj.data.materials)
    obj.hide_render = glow or obj.get(obj.name, {}).get("visibility", 1) < 0.5
    if not obj.hide_render:
        visible.append(obj)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
print("RENDER_POSE", action.name, len(visible), "meshes")

depsgraph = bpy.context.evaluated_depsgraph_get()
points = []
for obj in visible:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
    evaluated.to_mesh_clear()
low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
center = (low + high) / 2
radius = (high - low).length / 2

bpy.ops.object.camera_add(location=center + VIEW * radius * 4)
camera = bpy.context.object
camera.rotation_euler = (-VIEW).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.clip_end = radius * 10
scene.camera = camera
bpy.context.view_layer.update()
# Fit the silhouette, not the bounding sphere: the projected extent sets the ortho scale.
view = camera.matrix_world.inverted()
projected = [view @ p for p in points]
width = max(p.x for p in projected) - min(p.x for p in projected)
height = max(p.y for p in projected) - min(p.y for p in projected)
camera.data.ortho_scale = max(width, height) * 1.08
offset = Vector(((max(p.x for p in projected) + min(p.x for p in projected)) / 2, (max(p.y for p in projected) + min(p.y for p in projected)) / 2, 0))
camera.location = camera.matrix_world @ offset
bpy.context.view_layer.update()

scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = RESOLUTION
scene.render.resolution_y = RESOLUTION
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = 1.5
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.8, 0.85, 1.0, 1.0)
background.inputs["Strength"].default_value = 0.7
# Key from the camera side, fill from the left, warm rim from behind; scaled to the model.
for direction, power, size in [((0.6, -0.9, 1.1), 2.4, 1.0), ((-0.9, -0.5, 0.4), 1.0, 0.7), ((0.2, 1.0, 1.0), 2.8, 0.7)]:
    position = center + Vector(direction).normalized() * radius * 3
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.data.energy = power * (radius * 3) ** 2
    light.data.shape = "DISK"
    light.data.size = radius * size
    light.rotation_euler = (center - position).to_track_quat("-Z", "Y").to_euler()

head = next((bone for bone in rig.pose.bones if "head" in bone.name.lower()), None)
if head is not None:
    at = world_to_camera_view(scene, camera, rig.matrix_world @ head.head)
    print("RENDER_HEAD", round(at.x * RESOLUTION), round((1 - at.y) * RESOLUTION))
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = output
bpy.ops.render.render(write_still=True)
print("RENDER_DONE", output)
