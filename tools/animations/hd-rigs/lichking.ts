export const character = 12;
// The installed Definitive Lich King is a one-bone throne scene; the approved helmeted body is Classic (smashcraft:docs/design/hd-fighters.md).
export const classic = {
    root: 'Root',
    pelvis: 'Stomach',
    chest: 'Chest',
    head: 'Head',
    'shoulder.L': 'Lshoulder',
    'elbow.L': 'Lelbow',
    'wrist.L': 'Lhand',
    'hip.L': 'Lhip',
    'knee.L': 'Lknee',
    'ankle.L': 'Lfoot',
    'shoulder.R': 'RShoulder',
    'elbow.R': 'Relbow',
    'wrist.R': 'Rhand',
    'hip.R': 'Rhip',
    'knee.R': 'Rknee',
    'ankle.R': 'Rfoot',
    weapon: 'Weapon',
} as const;
export const pairs: readonly (readonly [string, string])[] = [];
