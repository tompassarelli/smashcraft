export const character = 26;
export const stockPath = 'war3.w3mod:_de.w3mod:units\\creeps\\Kobold\\Kobold.mdx';
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
    weapon: 'PickAxe',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ['root', 'local_C0_0_jnt'], ['pelvis', 'spine_C0_0_jnt'], ['chest', 'bone_chest'],
    ['head', 'neck_C0_2_jnt'], ['Candle', 'bone_head'],
    ['shoulder.L', 'arm_L0_0_jnt'], ['elbow.L', 'arm_L0_2_jnt'], ['wrist.L', 'arm_L0_end_jnt'],
    ['shoulder.R', 'arm_R0_0_jnt'], ['elbow.R', 'arm_R0_2_jnt'], ['wrist.R', 'arm_R0_end_jnt'],
    ['hip.L', 'leg_L0_0_jnt'], ['knee.L', 'leg_L0_2_jnt'], ['ankle.L', 'leg_L0_end_jnt'],
    ['hip.R', 'leg_R0_0_jnt'], ['knee.R', 'leg_R0_2_jnt'], ['ankle.R', 'leg_R0_end_jnt'],
    ['weapon', 'Wep01_R0_0_jnt'],
    ['K_Tail', 'tail_C0_0_jnt'], ['K_tail2', 'tail_C0_1_jnt'], ['K_tail3', 'tail_C0_2_jnt'], ['K_tail4', 'tail_C0_3_jnt'],
    ['EarL', 'ear_L0_0_jnt'], ['EarR', 'ear_R0_0_jnt'],
    ['K_strapL1', 'hat_L0_0_jnt'], ['K_strapL2', 'hat_L0_1_jnt'], ['K_strapR1', 'hat_R0_0_jnt'], ['K_strapR2', 'hat_R0_1_jnt'],
];
