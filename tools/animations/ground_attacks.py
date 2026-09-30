"""Blender boundary: bake readable Archer fist and directional kick poses."""
from math import sqrt, radians
import bpy
from mathutils import Matrix, Quaternion, Vector
from archer_pose import ready_pose, key_pose, key_visibility


def aim(bone, endpoint, target):
    origin = bone.matrix.translation.copy()
    rotation = (endpoint - origin).rotation_difference(target - origin)
    bone.matrix = (Matrix.Translation(origin) @ rotation.to_matrix().to_4x4()
                   @ Matrix.Translation(-origin) @ bone.matrix)
    bpy.context.view_layer.update()


def limb(rig, upper_name, lower_name, tip_name, target, pole):
    upper, lower, tip = [rig.pose.bones[n] for n in (upper_name, lower_name, tip_name)]
    start, elbow, end = [b.matrix.translation.copy() for b in (upper, lower, tip)]
    a, b = (elbow-start).length, (end-elbow).length
    direction = (target-start).normalized()
    distance = min(max((target-start).length, abs(a-b)+.01), a+b-.01)
    across = pole-start
    across -= direction*across.dot(direction)
    along = (a*a-b*b+distance*distance)/(2*distance)
    bend = start+direction*along+across.normalized()*sqrt(max(0, a*a-along*along))
    aim(upper, elbow, bend)
    aim(lower, tip.matrix.translation.copy(), start+direction*distance)


def author_archer_ground(rig, attacks_only=False):
    scene = bpy.context.scene
    base = ready_pose(rig)
    world = {b.name: b.matrix.copy() for b in rig.pose.bones}
    foot = world['Bone_Foot_R'].translation
    # One source frame maps to one logical frame through the render rate.
    clips = [
        ('Attack Jab', 4, 36, None, 0),
        ('Grab', 5, 36, None, 0),
        ('Grab Hold', 0, 24, None, 0),
        ('Forward Tilt', 5, 28, (44, -10, 43), 3),
        ('Forward Tilt Up', 5, 28, (39, -10, 67), 3),
        ('Forward Tilt Down', 5, 28, (48, -10, 23), 8),
        ('Up Tilt', 6, 29, (20, -10, 102), 3),
        ('Down Tilt', 5, 28, (48, -10, 8), 22),
    ]
    for name, contact, duration, kick, crouch in clips:
        grabbing = name.startswith('Grab')
        if attacks_only and grabbing:
            continue
        existing = bpy.data.actions.get(name)
        if existing is not None:
            bpy.data.actions.remove(existing)
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        action['war3_non_looping'] = True
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots.new('OBJECT', rig.name)
        phases = {0: 0., 2: -.2, contact: 1., contact+2: 1.,
                  contact+7: .45, duration-6: 0., duration: 0.}
        if name == 'Grab Hold':
            phases = {0: 1., duration: 1.}
        previous = {}
        for frame in range(duration+1):
            scene.frame_set(frame)
            for bone in rig.pose.bones:
                bone.matrix_basis = base[bone.name]
            left = max(f for f in phases if f <= frame)
            right = min(f for f in phases if f >= frame)
            t = 0 if left == right else (frame-left)/(right-left)
            amount = phases[left]*(1-t)+phases[right]*t
            strength = max(0, amount)
            pelvis = rig.pose.bones['Bone_Pelvis']
            bpy.context.view_layer.update()
            pelvis.matrix = Matrix.Translation(Vector((0, 0, -crouch*strength))) @ pelvis.matrix
            chest = rig.pose.bones['Bone_Chest']
            chest.rotation_quaternion = base[chest.name].to_quaternion() @ Quaternion(Vector((0, 0, 1)), radians(-8*amount))
            bpy.context.view_layer.update()
            if not grabbing:
                # The chest and pelvis are separate children of the root.
                # Crouch both, then lean from the waist to expose the striking
                # limb without moving its contact target or the fighter root.
                lean = (-40 if name == 'Up Tilt' else 20 if name == 'Down Tilt'
                        else 10 if name == 'Attack Jab' else -16)
                pivot = chest.matrix.translation.copy()
                chest.matrix = (Matrix.Translation(Vector((0, 0, -crouch*strength)))
                                @ Matrix.Translation(pivot)
                                @ Matrix.Rotation(radians(lean*strength), 4, 'Y')
                                @ Matrix.Translation(-pivot) @ chest.matrix)
                bpy.context.view_layer.update()
            # Keep the bow below and behind the punching arm, still parented
            # to its original hand. No weapon/root translation is simulated here.
            bow_start = world['Bone_Hand_L'].translation
            bow_target = bow_start.lerp(Vector((-12, 18, 52)), strength)
            limb(rig, 'Bone_Arm1_L', 'Bone_Arm2_L', 'Bone_Hand_L', bow_target,
                 world['Bone_Arm2_L'].translation.lerp(Vector((-10, 30, 65)), abs(amount)))
            hand_start = world['Hand Right Ref '].translation
            reach = (36, -5, 68) if name.startswith('Grab') else (32, -12, 76)
            hand_target = hand_start.lerp(Vector(reach), amount if kick is None else strength*.3)
            if name == 'Up Tilt':
                hand_target = hand_start.lerp(Vector((-18, -20, 62)), strength)
            limb(rig, 'Bone_Arm1_R', 'Bone_Arm2_R', 'Hand Right Ref ', hand_target,
                 world['Bone_Arm2_R'].translation.lerp(Vector((-10, -30, 65)), abs(amount)))
            # The stock shoulder-cloth chain inherits the upper-arm swing.
            # Let it hang from the moving shoulder instead of covering the fist.
            cloth = rig.pose.bones['Object08']
            location, orientation, scale = cloth.matrix.decompose()
            orientation = orientation.slerp(world['Object08'].to_quaternion(), strength)
            if not grabbing:
                # Let the long shoulder cloth trail behind the attack instead
                # of hiding the extended thigh or forearm in the side view.
                orientation = Quaternion(Vector((0, 1, 0)), radians(25*strength)) @ orientation
            cloth.matrix = Matrix.LocRotScale(location, orientation, scale)
            bpy.context.view_layer.update()
            if kick is not None:
                limb(rig, 'Bone_Leg1_R', 'Bone_Leg2_R', 'Bone_Foot_R',
                     foot.lerp(Vector(kick), strength), Vector((35, -25, 62)))
                # Plant the supporting foot as the pelvis lowers.
                limb(rig, 'Bone_Leg1_L', 'Bone_Leg2_L', 'Bone_Foot_L',
                     world['Bone_Foot_L'].translation, Vector((35, 10, 35)))
            for bone in rig.pose.bones:
                bone.rotation_mode = 'QUATERNION'
                q = bone.rotation_quaternion.copy()
                if bone.name in previous and previous[bone.name].dot(q) < 0:
                    q.negate()
                    bone.rotation_quaternion = q
                previous[bone.name] = q.copy()
            key_pose(rig, frame)
        key_visibility(action, duration)
        print('ARCHER_GROUND_CLIP', name, duration)
