export const character = 2;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\nightelf\\herodemonhunter\\herodemonhunter.mdx';
export const fitScale = 0.812;
// DE weapons are independent root children; both need their authored blade transform.
export const classic = {
    root: 'Bone_Root',
    pelvis: 'Bone_Pelvis',
    chest: 'Bone_Chest',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_L',
    'elbow.L': 'Bone_Arm2_L',
    'wrist.L': 'Bone_Hand_L',
    'hip.L': 'Bone_Leg1_L',
    'knee.L': 'Bone_Leg2_L',
    'ankle.L': 'Bone_Foot_L',
    'shoulder.R': 'Bone_Arm1_R',
    'elbow.R': 'Bone_Arm2_R',
    'wrist.R': 'Bone_Hand_R',
    'hip.R': 'Bone_Leg1_R',
    'knee.R': 'Bone_Leg2_R',
    'ankle.R': 'Bone_Foot_R',
    weapon: 'blade_base',
    'weapon.L': 'stand_blade_L',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['pelvis', 'Pelvis'], ['root', 'Spine1'],
    ['chest', 'bone_chest'], ['head', 'bone_head'],
    ['shoulder.L', 'Shoulder_L'], ['elbow.L', 'Elbow_L'], ['wrist.L', 'Wrist_L'],
    ['shoulder.R', 'Shoulder_R'], ['elbow.R', 'Elbow_R'], ['wrist.R', 'Wrist_R'],
    ['hip.L', 'Hip_L'], ['knee.L', 'Knee_L'], ['ankle.L', 'Ankle_L'],
    ['hip.R', 'Hip_R'], ['knee.R', 'Knee_R'], ['ankle.R', 'Ankle_R'],
    ['weapon.L', 'Weapon_L'], ['weapon', 'Weapon_R'],
];
