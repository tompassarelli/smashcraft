"""Check original motion/geometry preservation and authored pose claims."""
from pathlib import Path
import bpy, hashlib, json, os, sys, struct, addon_utils
sys.path.insert(0,os.environ.get('WC3_MDL_ADDON','/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl',default_set=True)
project=Path(__file__).resolve().parents[2];out=project/'build/illidan-animation'
def snapshot():
 actions={}
 for a in bpy.data.actions:
  curves=[]
  for layer in a.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     slot=next(s for s in a.slots if s.handle==bag.slot_handle)
     if slot.identifier[2:]=='Illidan Wings':continue
     for c in bag.fcurves:curves.append((slot.identifier,c.data_path,c.array_index,[(tuple(k.co),k.interpolation,tuple(k.handle_left),tuple(k.handle_right)) for k in c.keyframe_points]))
  actions[a.name]=hashlib.sha256(repr(curves).encode()).hexdigest()
 geometry={o.name:([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]) for o in bpy.context.scene.objects if o.type=='MESH' and not o.particle_systems and o.name!='Illidan Wings'}
 return actions,geometry,bpy.context.scene.render.fps
bpy.ops.wm.open_mainfile(filepath=str(project/'build/illidan-assets/demonhunter.blend'));stock,geometry,fps=snapshot()
ready=bpy.data.actions['Stand Ready']
source_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.particle_systems]
for mesh in source_meshes:
 slot=next((s for s in ready.slots if s.identifier[2:]==mesh.name),None)
 if slot:
  mesh.animation_data_create();mesh.animation_data.action=ready;mesh.animation_data.action_slot=slot
bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
ready_visibility={m.name:float(m.get(m.name,{}).get('visibility',1)) for m in source_meshes}
bpy.ops.wm.open_mainfile(filepath=str(out/'demonhunter-fighter.blend'));authored,newgeo,newfps=snapshot()
assert geometry==newgeo,'Original geometry changed'
assert len(geometry)==17,'Expected all 17 original geosets'
assert fps==newfps,'Original action timebase changed'
for name,digest in stock.items():assert authored[name]==digest,('Original action changed',name)
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');wing=bpy.data.objects['Illidan Wings']
for clip in json.loads((out/'clips.json').read_text()):
 a=bpy.data.actions[clip['name']];r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 for name in ready_visibility:
  mesh=bpy.data.objects[name];mesh.animation_data.action=a
  mesh.animation_data.action_slot=next(s for s in a.slots if s.identifier[2:]==name)
 wing.animation_data.action=a;wing.animation_data.action_slot=next(s for s in a.slots if s.identifier[2:]==wing.name)
 emitters=[o for o in bpy.context.scene.objects if o.particle_systems]
 assert len(emitters)==2,'Source particle emitters missing'
 for emitter in emitters:
  settings=emitter.particle_systems[0].settings
  settings.animation_data.action=a
  settings.animation_data.action_slot=next(s for s in a.slots if s.target_id_type=='PARTICLE' and s.name_display==settings.name)
 for frame in [0,clip['frames']//2,clip['frames']]:
  bpy.context.scene.frame_set(frame)
  for name,expected in ready_visibility.items():
   mesh=bpy.data.objects[name]
   assert float(mesh[mesh.name]['visibility'])==expected,('Combat body visibility differs from ready pose',a.name,frame,name,expected,float(mesh[mesh.name]['visibility']))
  for emitter in emitters:assert emitter.particle_systems[0].settings.mdl_particle_sys.visibility==0,('Stock effect in combat',a.name,frame)
  assert r.pose.bones['Bone_Root'].location.length<.001,('Root displacement',a.name,frame)
  visible=wing[wing.name]['visibility']
  if not a.name.startswith('Special Up'):assert visible==0,('Wing visible outside ascent',a.name)
 bpy.context.scene.frame_set(clip['frames']);assert wing[wing.name]['visibility']==0,('Wing interruption endpoint',a.name)
print('ILLIDAN_SCENE_PASS',len(stock),'stock actions exactly preserved;',len(geometry),'source geosets exactly preserved;',len(authored)-len(stock),'authored actions;',fps,'FPS')


from export_mdl.import_stuff.mdx_parser.parse_textures import parse_textures
source=(project/'build/illidan-assets/demonhunter.mdx').read_bytes()
assert source[:4]==b'MDLX'
position=4;source_textures=[]
while position<len(source):
 tag=source[position:position+4];size=struct.unpack_from('<I',source,position+4)[0];position+=8
 if tag==b'TEXS':source_textures.extend(parse_textures(source[position:position+size]))
 position+=size
assert source_textures
(out/'source-textures.json').write_text(json.dumps([{'Image':t.texture_path,'ReplaceableId':t.replaceable_id} for t in source_textures],indent=2))
