export const character = 4;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\human\\heromountainking\\heromountainking.mdx';
// The stock torso and head are larger relative to the legs than Classic's shared body (#362).
export const fitScale = 0.65;
// The axe and hammer are separate root bones in DE, rather than hand children.
export const classic = {
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
    weapon: '1Cylinder04',
    'weapon.L': '1Cylinder03',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['pelvis', 'spine_C0_0_jnt'], ['chest', 'spine_C0_1_jnt'],
    ['chest', 'bone_chest'], ['head', 'bone_head'],
    ['shoulder.L', 'arm_L0_0_jnt'], ['elbow.L', 'arm_L0_2_jnt'], ['wrist.L', 'arm_L0_end_jnt'],
    ['shoulder.R', 'arm_R0_0_jnt'], ['elbow.R', 'arm_R0_2_jnt'], ['wrist.R', 'arm_R0_end_jnt'],
    ['hip.L', 'leg_L0_0_jnt'], ['knee.L', 'leg_L0_2_jnt'], ['ankle.L', 'leg_L0_end_jnt'],
    ['hip.R', 'leg_R0_0_jnt'], ['knee.R', 'leg_R0_2_jnt'], ['ankle.R', 'leg_R0_end_jnt'],
    ['weapon.L', 'Wep01_L0_0_jnt'], ['weapon', 'Wep01_R0_0_jnt'],
];
