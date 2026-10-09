export const character = 9;
export const fighter = 'ShadowHunter';
export const stockPath = 'war3.w3mod:_de.w3mod:units\\orc\\HeroShadowHunter\\HeroShadowHunter.mdx';
// Leg-only fitting otherwise leaves the hands and glaive below Classic's floor while the feet stay planted (#362).
export const limbScales = [['arm_L0_0_jnt', 0.635], ['arm_R0_0_jnt', 0.745]] as const;
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
    weapon: 'Object11',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['pelvis', 'spine_C0_0_jnt'], ['chest', 'spine_C0_1_jnt'],
    ['chest', 'bone_chest'], ['head', 'bone_head'],
    ['head', 'neck_C0_0_jnt'], ['Bone_face', 'ffx_mouth_C0_jaw_jnt'],
    ['Beard1', 'beard_C0_0_jnt'], ['Beard03', 'beard_C0_1_jnt'], ['Beard04', 'beard_C0_2_jnt'],
    ['weapon', 'Wep01_R0_0_jnt'], ['chest', 'back_weapon_root_C0_0_jnt'],
    ['Object02', 'skull_C0_0_jnt'], ['Object02', 'skull_L0_0_jnt'], ['Object02', 'skull_R0_0_jnt'],
    ['shoulder.L', 'arm_L0_0_jnt'],
    ['shoulder.L', 'arm_L0_1_jnt'], ['elbow.L', 'arm_L0_2_jnt'],
    ['elbow.L', 'arm_L0_3_jnt'], ['wrist.L', 'arm_L0_end_jnt'],
    ['shoulder.R', 'arm_R0_0_jnt'],
    ['shoulder.R', 'arm_R0_1_jnt'], ['elbow.R', 'arm_R0_2_jnt'],
    ['elbow.R', 'arm_R0_3_jnt'], ['wrist.R', 'arm_R0_end_jnt'],
    ['hip.L', 'leg_L0_0_jnt'], ['hip.L', 'leg_L0_1_jnt'],
    ['knee.L', 'leg_L0_2_jnt'], ['knee.L', 'leg_L0_3_jnt'],
    ['ankle.L', 'leg_L0_end_jnt'], ['ankle.L', 'foot_L0_0_jnt'],
    ['hip.R', 'leg_R0_0_jnt'], ['hip.R', 'leg_R0_1_jnt'],
    ['knee.R', 'leg_R0_2_jnt'], ['knee.R', 'leg_R0_3_jnt'],
    ['ankle.R', 'leg_R0_end_jnt'], ['ankle.R', 'foot_R0_0_jnt'],
];
