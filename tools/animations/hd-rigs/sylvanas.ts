export const character = 15;
export const fighter = "SylvanasWindrunner";
export const stockPath = "war3.w3mod:_de.w3mod:units/undead/evilsylvanas/evilsylvanas.mdx";
export const visibilityPairs: readonly (readonly [number, number])[] = [[5, 0]];
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
    'hip.R': 'Bone_Leg1_R',
    'knee.R': 'Bone_Leg2_R',
    'ankle.R': 'Bone_Foot_R',
    weapon: 'Cylinder02',
} as const;
export const pairs: readonly (readonly [string, string])[] = [
    ["pelvis", "spine_C0_0_jnt"],
    ["chest", "spine_C0_1_jnt"],
    ["chest", "bone_chest"],
    ["head", "neck_C0_0_jnt"],
    ["head", "bone_head"],
    
    ["shoulder.L", "arm_L0_0_jnt"],
    ["elbow.L", "arm_L0_2_jnt"],
    ["wrist.L", "arm_L0_end_jnt"],
    
    ["shoulder.R", "arm_R0_0_jnt"],
    ["elbow.R", "arm_R0_2_jnt"],
    ["elbow.R", "arm_R0_end_jnt"],
    ["hip.L", "leg_L0_0_jnt"],
    ["knee.L", "leg_L0_2_jnt"],
    ["ankle.L", "leg_L0_end_jnt"],
    ["ankle.L", "foot_L0_0_jnt"],
    ["hip.R", "leg_R0_0_jnt"],
    ["knee.R", "leg_R0_2_jnt"],
    ["ankle.R", "leg_R0_end_jnt"],
    ["ankle.R", "foot_R0_0_jnt"],
    ["weapon", "Wep01_C0_0_jnt"],
    ["Arrow", "WepArrow_C0_0_jnt"],
    ["Arrow01", "WepArrow_C1_0_jnt"],
    ["Mesh18", "cloak_C0_0_jnt"],
    ["Mesh17", "cloak_C0_1_jnt"],
    ["Mesh01", "cloak_C0_2_jnt"],
    ["Object05", "cloak_C0_3_jnt"],
    ["Object05", "cloak_C0_4_jnt"],
];
