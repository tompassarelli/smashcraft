"""Blender boundary: authored Illidan combat poses on Warcraft's source rig."""
import os, sys, json
from pathlib import Path
from math import radians, sqrt, sin, pi
import bpy, bmesh, addon_utils
from mathutils import Matrix, Vector, Quaternion

project = Path(__file__).resolve().parents[2]
out = project / 'build/illidan-animation'
out.mkdir(exist_ok=True, parents=True)
sys.path.insert(0, os.environ.get('WC3_MDL_ADDON', '/home/tom/code/mdl-exporter4/worktrees/blender5'))
addon_utils.enable('export_mdl', default_set=True)
bpy.ops.wm.open_mainfile(filepath=str(project/'build/illidan-assets/demonhunter.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
stock=list(bpy.data.actions)
# Preserve the imported scene timebase for every stock action.
ready=bpy.data.actions['Stand Ready']
rig.animation_data_create()
rig.animation_data.action=ready
rig.animation_data.action_slot=ready.slots[0]
scene.frame_set(0)
bpy.context.view_layer.update()
base={b.name:b.matrix_basis.copy() for b in rig.pose.bones}
emitters=[o for o in scene.objects if o.particle_systems]
meshes=[o for o in scene.objects if o.type=='MESH' and not o.particle_systems]
visibility={m.name:float(m.get(m.name,{}).get('visibility',1)) for m in meshes}
# The source demon's wings share a geoset with its body. Duplicate only the
# existing wing triangles and weights; retain the complete source geoset.
wing_roots=['Mesh30ss Alternate','Mesh31ee Alternate']
wing_bones=set(wing_roots)
for root in wing_roots:wing_bones.update(b.name for b in rig.data.bones[root].children_recursive)
source=bpy.data.objects['2 HeroDemonHunter']
wings=source.copy();wings.data=source.data.copy();wings.name='Illidan Wings';scene.collection.objects.link(wings);wings.animation_data_clear()
bm=bmesh.new();bm.from_mesh(wings.data);bm.verts.ensure_lookup_table()
keep={v.index for v in source.data.vertices if any(source.vertex_groups[g.group].name in wing_bones and g.weight>.01 for g in v.groups)}
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in keep],context='VERTS');bm.to_mesh(wings.data);bm.free()
wings[wings.name]={'visibility':0.0,'color':[1.,1.,1.,1.]}
meshes.append(wings);visibility[wings.name]=0.
assert len(wings.data.polygons)>0
for a in stock:
 wings.animation_data_create();wings.animation_data.action=a;wings.animation_data.action_slot=a.slots.new('OBJECT',wings.name)
 for f in a.frame_range:wings[wings.name]['visibility']=0.;wings.keyframe_insert(data_path=f'["{wings.name}"]["visibility"]',frame=f)

def rotate(name,angle,axis=(0,1,0)):
 b=rig.pose.bones[name];m=b.matrix.copy();p=m.translation
 b.matrix=Matrix.Translation(p)@Quaternion(Vector(axis),radians(angle)).to_matrix().to_4x4()@Matrix.Translation(-p)@m
 bpy.context.view_layer.update()

def aim(name,end,target):
 b=rig.pose.bones[name];m=b.matrix.copy();p=m.translation
 q=(end-p).rotation_difference(target-p)
 b.matrix=Matrix.Translation(p)@q.to_matrix().to_4x4()@Matrix.Translation(-p)@m
 bpy.context.view_layer.update()

def limb(side,kind,target,pole):
 names=[f'Bone_{part}_{side}' for part in (('Arm1','Arm2','Hand') if kind=='arm' else ('Leg1','Leg2','Foot'))]
 upper,lower,end=[rig.pose.bones[n] for n in names]
 p=upper.matrix.translation.copy();e=lower.matrix.translation.copy();w=end.matrix.translation.copy()
 a,b=(e-p).length,(w-e).length;d=target-p;length=min(max(d.length,abs(a-b)+.01),a+b-.01);u=d.normalized()
 v=pole-p;v-=u*v.dot(u)
 if v.length<.001:v=Vector((0,1,0))
 along=(a*a-b*b+length*length)/(2*length)
 elbow=p+u*along+v.normalized()*sqrt(max(0,a*a-along*along))
 aim(upper.name,e,elbow);aim(lower.name,end.matrix.translation.copy(),p+u*length)

def pose(p):
 for n,m in base.items():rig.pose.bones[n].matrix_basis=m
 bpy.context.view_layer.update()
 # Body translations deform the visual children; simulation owns travel.
 root=rig.pose.bones['Bone_Root'];root.location=(0,0,0)
 bpy.context.view_layer.update()
 rotate('Bone_Chest',p.get('lean',0))
 if p.get('crouch',0):
  shift=Matrix.Translation((0,0,-p['crouch']))
  for n in ('Bone_Chest','Bone_Pelvis'):rig.pose.bones[n].matrix=shift@rig.pose.bones[n].matrix
 bpy.context.view_layer.update()
 for side in ('R','L'):
  s=-1 if side=='R' else 1
  target=Vector(p.get('hand_'+side,(22 if side=='R' else -35,s*25,91 if side=='R' else 74)))
  limb(side,'arm',target,Vector((0,s*65,90)))
  limb(side,'leg',Vector(p.get('foot_'+side,(30,-15,22) if side=='R' else (-25,15,23))),Vector((65,s*20,70)))
  rotate('Bone_Hand_'+side,p.get('blade_'+side,0),(1,0,0))
 bpy.context.view_layer.update()
 if p.get('spin',0):rotate('Bone_Root',p['spin'])
 for n in wing_roots:
  # Source wing roots are positioned on the demon's shoulders; align them
  # with the humanoid upper back, then flap their existing articulated span.
  b=rig.pose.bones[n];m=b.matrix.copy();m.translation+=Vector((0,0,30));b.matrix=m
  rotate(n,p.get('flap',0)*(1 if n==wing_roots[0] else -1),(1,0,0))
 bpy.context.view_layer.update()

metadata=[]
def author(name,keys,loop=False,ground=False):
 a=bpy.data.actions.new(name);a.use_fake_user=True;a['war3_non_looping']=not loop
 rig.animation_data.action=a;rig.animation_data.action_slot=a.slots.new('OBJECT',rig.name)
 frames=sorted(keys);last=frames[-1];previous={}
 for f in range(last+1):
  scene.frame_set(f);left=max(k for k in frames if k<=f);right=min(k for k in frames if k>=f);t=0 if left==right else (f-left)/(right-left)
  p={}
  for key in set(keys[left])|set(keys[right]):
   default = rest.get(key, (30,-15,22) if key=='foot_R' else (-25,15,23) if key=='foot_L' else 0)
   x=keys[left].get(key,default);y=keys[right].get(key,default)
   p[key]=tuple(v*(1-t)+w*t for v,w in zip(x,y)) if isinstance(x,(tuple,list)) else x*(1-t)+y*t
  pose(p)
  for b in rig.pose.bones:
   if f not in (0,last) and not (b.name.startswith('Bone_') and 'Alternate' not in b.name or b.name in wing_roots):continue
   b.rotation_mode='QUATERNION';q=b.rotation_quaternion.copy()
   if b.name in previous and previous[b.name].dot(q)<0:q.negate();b.rotation_quaternion=q
   previous[b.name]=q.copy()
   for prop in ('rotation_quaternion','location','scale'):b.keyframe_insert(prop,frame=f,group=b.name)
 for m in meshes:
  m.animation_data_create();m.animation_data.action=a;m.animation_data.action_slot=a.slots.new('OBJECT',m.name)
  if m.name not in m:m[m.name]={'visibility':visibility[m.name],'color':[1.,1.,1.,1.]}
  for f in frames:
   m[m.name]['visibility']=keys[f].get('wings',0) if m==wings else visibility[m.name]
   m.keyframe_insert(data_path=f'["{m.name}"]["visibility"]',frame=f)
 for emitter in emitters:
  settings=emitter.particle_systems[0].settings
  settings.animation_data_create();settings.animation_data.action=a
  settings.animation_data.action_slot=a.slots.new('PARTICLE',settings.name)
  settings.mdl_particle_sys.visibility=0
  for f in (0,last):settings.keyframe_insert(data_path='mdl_particle_sys.visibility',frame=f)
 # Imported stock curves are untouched; authored curves use linear samples.
 for layer in a.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for k in curve.keyframe_points:k.interpolation='LINEAR'
 metadata.append({'name':name,'frames':last,'seconds':last/scene.render.fps,'samples':frames})
 print('ILLIDAN_CLIP',name,last,flush=True)

rest={'hand_R':(22,-25,91),'hand_L':(-35,25,74)}
def attack(name,start,active,total,contact,wind=None):
 wind=wind or {'hand_R':(-30,-30,110),'hand_L':(-45,25,80),'lean':-12}
 author(name,{0:rest,max(1,start-2):wind,start:contact,start+active-1:contact,total-6:rest,total:rest})
attack('Attack Jab',4,2,36,{'hand_R':(54,-18,96),'hand_L':(-25,25,80),'lean':12})
for name,z in [('Forward Tilt',88),('Forward Tilt Up',121),('Forward Tilt Down',48)]:attack(name,5,2,28,{'hand_R':(53,-15,z),'hand_L':(-42,25,88),'lean':10,'blade_R':-45})
attack('Up Tilt',6,2,29,{'hand_R':(15,-20,155),'hand_L':(-20,25,135),'lean':-12})
attack('Down Tilt',5,2,28,{'hand_R':(50,-15,48),'hand_L':(-25,25,75),'crouch':24,'lean':24})
for name,start,contact in [('Forward Smash',6,{'hand_R':(58,-15,100),'hand_L':(40,18,94),'lean':22}),('Up Smash',8,{'hand_R':(12,-20,160),'hand_L':(5,20,153),'lean':-18}),('Down Smash',8,{'hand_R':(55,-15,47),'hand_L':(-60,15,50),'crouch':25,'lean':16})]:
 attack(name,start,3,36 if name=='Forward Smash' else 42,contact)
 author(name+' Charge',{0:rest,6:{'hand_R':(-35,-30,125),'hand_L':(-40,25,125),'crouch':12},24:{'hand_R':(-35,-30,125),'hand_L':(-40,25,125),'crouch':12}},True)
attack('Dash Attack',4,2,32,{'hand_R':(60,-15,87),'hand_L':(30,22,85),'lean':30,'foot_L':(-45,15,28)})
attack('Aerial Neutral',3,28,41,{'foot_R':(68,-15,90),'foot_L':(-28,20,57),'hand_R':(-8,-35,125),'hand_L':(-40,28,110),'lean':-10})
attack('Aerial Forward',5,2,31,{'hand_R':(62,-18,100),'hand_L':(30,20,135),'foot_R':(30,-15,50),'foot_L':(-25,20,65),'lean':20})
attack('Aerial Back',3,16,37,{'foot_L':(-80,15,93),'foot_R':(15,-15,58),'hand_R':(20,-30,130),'hand_L':(-20,30,130),'lean':30})
attack('Aerial Up',5,3,34,{'hand_R':(12,-20,165),'hand_L':(-10,20,150),'foot_R':(20,-15,50),'foot_L':(-20,15,55),'lean':-15})
attack('Aerial Down',7,3,38,{'foot_R':(0,-15,5),'foot_L':(-30,15,68),'hand_R':(35,-20,70),'hand_L':(-25,20,95),'lean':30}, {'foot_R':(20,-15,75),'foot_L':(-20,15,75),'hand_R':(10,-25,130),'hand_L':(-25,25,130)})
for suffix in ('',' Air'):
 attack('Special Neutral'+suffix,8,1,33,{'hand_R':(60,-15,105),'hand_L':(-30,25,130),'lean':15})
 author('Special Side'+suffix,{0:rest,3:{'hand_R':(30,-15,115),'hand_L':(20,15,108),'crouch':10},4:{'hand_R':(30,-15,115),'hand_L':(20,15,108),'lean':-25,'crouch':20},9:{'hand_R':(30,-15,115),'hand_L':(20,15,108),'lean':-25,'crouch':20},16:rest,22:rest})
 author('Special Up'+suffix,{0:rest,2:{'crouch':20,'wings':1,'flap':-40},5:{'hand_R':(25,-35,140),'hand_L':(-20,35,140),'foot_R':(30,-15,55),'foot_L':(-20,15,55),'wings':1,'flap':35},11:{'wings':1,'flap':-35,'lean':-15},17:{'wings':1,'flap':35,'lean':-10},24:{'wings':1,'flap':-20},28:{'wings':0}})
 attack('Special Down'+suffix,4,4,27,{'hand_R':(45,-40,100),'hand_L':(-45,40,100),'crouch':12 if not suffix else 0,'foot_R':(0,-15,20) if suffix else (30,-15,22),'lean':-10})
# Shared motions use the same authored body/weapon solve.
shield={'hand_R':(30,-15,117),'hand_L':(25,15,111),'crouch':8,'lean':-8}
tuck={'foot_R':(20,-15,70),'foot_L':(-20,15,70),'hand_R':(10,-30,115),'hand_L':(-25,25,110)}
for name,keys,loop in [
 ('Shield Raise',{0:rest,4:shield},False),('Shield Hold',{0:shield,24:shield},True),('Shield Release',{0:shield,5:rest},False),
 ('Shield Break',{0:shield,6:{'lean':-48},24:{'lean':25,'crouch':20}},False),
 ('Jump Squat',{0:rest,4:{'crouch':15}},False),('Jump',{0:{'crouch':12},5:tuck,16:{**tuck,'lean':-10},24:tuck},False),
 ('Fall',{0:tuck,24:tuck},True),('Fast Fall',{0:{**tuck,'lean':25},24:{**tuck,'lean':25}},True),
 ('Fall Special',{0:{**tuck,'lean':-25},24:{**tuck,'lean':-25}},True),
 ('Land',{0:{'crouch':20,'lean':15},8:rest},False),('Land Special',{0:{'crouch':25,'lean':20},10:rest},False),
 ('Crouch',{0:rest,5:{'crouch':25,'lean':20},24:{'crouch':25,'lean':20}},False),
 ('Dash Start',{0:rest,4:{'lean':25,'hand_R':(-15,-25,100)},10:{'lean':20}},False),
 ('Turnaround',{0:{'lean':25},4:{'crouch':15,'lean':-20},8:rest},False),('Stop',{0:{'lean':-25},8:rest},False),
 ('Spot Dodge',{0:rest,2:{'crouch':20},5:{'crouch':32,'lean':-30},15:{'crouch':32,'lean':-30},22:rest},False),
 ('Air Dodge',{0:tuck,4:{**tuck,'lean':-35},29:{**tuck,'lean':-35},49:tuck},False),
 ('Damage Ground',{0:{'lean':-38,'hand_R':(15,-35,130),'crouch':10},8:{'lean':-25,'crouch':6},20:{'lean':-25,'crouch':6}},False),
 ('Damage Air',{0:{**tuck,'lean':-50},8:{**tuck,'lean':-35},24:{**tuck,'lean':-35}},False),
 ('Damage Shield',{0:{**shield,'lean':-30},8:shield,20:shield},False),
 ('Grab',{0:rest,5:{'hand_L':(55,15,98),'hand_R':(-20,-25,115)},7:{'hand_L':(55,15,98)},24:rest,36:rest},False),
 ('Grab Hold',{0:{'hand_L':(50,15,100)},24:{'hand_L':(50,15,100)}},True),
 ('Grabbed',{0:{'lean':30,'crouch':8},24:{'lean':30,'crouch':8}},True),
 ('Grab Escape',{0:{'lean':30},4:{'hand_R':(45,-30,115),'hand_L':(-40,30,115),'lean':-20},15:rest},False),
 ('Ledge Hang',{0:{'hand_R':(25,-15,155),'hand_L':(25,15,155),'foot_R':(-10,-15,20)},24:{'hand_R':(25,-15,155),'hand_L':(25,15,155),'foot_R':(-10,-15,20)}},True),
 ('Ledge Climb',{0:{'hand_R':(25,-15,155),'hand_L':(25,15,155)},12:{'crouch':25,'lean':35},30:rest},False),
 ('Respawn',{0:{'hand_R':(40,-40,130),'hand_L':(-40,40,130)},24:rest},False),
]:author(name,keys,loop)
for name,sign,last in [('Roll Forward',1,31),('Roll Backward',-1,31),('Double Jump',-1,30),('Damage Tumble',1,24),('Get Up Roll Forward',1,31),('Get Up Roll Back',-1,31),('Tech Forward',1,26),('Tech Back',-1,26),('Ledge Roll',1,31)]:
 author(name,{0:tuck,last//4:{**tuck,'spin':90*sign},last//2:{**tuck,'spin':180*sign},last*3//4:{**tuck,'spin':270*sign},last:{'spin':360*sign}})
prone={**tuck,'spin':90,'crouch':35}
for name,keys in [('Knockdown',{0:{'lean':-35},6:prone,12:prone}),('Down Wait',{0:prone,24:prone}),('Down Damage',{0:{**prone,'lean':-25},13:prone}),('Get Up',{0:prone,12:{'crouch':35,'lean':40},30:rest}),('Tech Neutral',{0:prone,8:{'crouch':30},26:rest}),('KO',{0:{**tuck,'lean':-40},12:prone,30:prone})]:author(name,keys)
attack('Get Up Attack',16,3,45,{'hand_R':(60,-15,65),'hand_L':(-55,15,65),'crouch':25},prone)
attack('Ledge Attack',16,3,45,{'hand_R':(60,-15,90),'hand_L':(20,20,120),'lean':25})
author('Ledge Jump',{0:{'hand_R':(25,-15,155)},5:tuck,24:tuck})
sys.path.insert(0,str(project/'tools/animations'));sys.dont_write_bytecode=True
from grab_animations import timing
for name,key,target in [('Pummel','GRAB_PUMMEL',(40,-15,95)),('Throw Forward','THROW_FORWARD',(60,15,100)),('Throw Back','THROW_BACK',(-60,15,105)),('Throw Up','THROW_UP',(10,15,160)),('Throw Down','THROW_DOWN',(40,15,35))]:
 contact,duration=timing(key);hold={'hand_L':(50,15,100)}
 author(name,{0:hold,max(1,contact-3):{**hold,'lean':-15},contact-1:{'hand_L':target,'hand_R':target,'lean':20},contact+2:{'hand_L':target,'lean':15},duration:hold if name=='Pummel' else rest})
 author('Victim '+name,{0:{'lean':25},contact-1:{**tuck,'lean':-45 if name!='Throw Down' else 45},duration:{**tuck,'lean':-30}})
# Ground the prone recovery geometry once using the existing evaluated-mesh solver.
import importlib.util
module_spec=importlib.util.spec_from_file_location('illidan_ground',project/'tools/animations/demonhunter-ground.py')
ground_module=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(ground_module)
ground_recovery=ground_module.ground_recovery
for name in ['Knockdown','Down Wait','Down Damage','Get Up','Get Up Attack','Tech Neutral','KO']:
 a=bpy.data.actions[name];ground_recovery(rig,a,int(a.frame_range[1]))
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'demonhunter-fighter.blend'))
(out/'clips.json').write_text(json.dumps(metadata,indent=2))
if '--no-export' not in sys.argv:
 result=bpy.ops.export.mdl_exporter(filepath=str(out/'demonhunter-fighter.mdl'),use_actions=True)
 assert 'FINISHED' in result,result
print('ILLIDAN_AUTHORED',len(metadata),'clips',len(wings.data.polygons),'source wing polygons',flush=True)
