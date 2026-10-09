export const character = 24;
// Definitive Malfurion carries a stag; the approved fighter walks (smashcraft:docs/design/hd-fighters.md).
export const classic = {
    root: 'Bone_RootArchDruid',
    pelvis: 'Bone_PelvisArchDruid',
    chest: 'Bone_ChestArchDruid',
    head: 'Bone_Head',
    'shoulder.L': 'Bone_Arm1_LArchDruid',
    'elbow.L': 'Bone_Arm2_LArchDruid',
    'wrist.L': 'Bone_Hand_LArchDruid',
    'hip.L': 'Bone_Leg1_LArchDruid',
    'knee.L': 'Bone_Leg2_LArchDruid',
    'ankle.L': 'Bone_Foot_LArchDruid',
    'shoulder.R': 'Bone_Arm1_RArchDruid',
    'elbow.R': 'Bone_Arm2_RArchDruid',
    'wrist.R': 'Bone_Hand_RArchDruid',
    'hip.R': 'Bone_Leg1_RArchDruid',
    'knee.R': 'Bone_Leg2_RArchDruid',
    'ankle.R': 'Bone_Foot_RArchDruid',
} as const;
export const pairs: readonly (readonly [string, string])[] = [];
