// Foreign model boundary: contact timing and required ground-attack tracks.
export const archerGroundReplacements = ['Attack Jab', 'Forward Tilt', 'Forward Tilt Up', 'Forward Tilt Down'];

export function checkGroundClips(model: any, fighter: string) {
    const require = (ok: unknown, message: string) => { if (!ok) throw new Error(`${fighter}: ${message}`); };
    const bones = [...model.Bones, ...model.Helpers];
    const root = bones.find(b => b.Name === 'Bone_Root');
    const plans = [['Attack Jab', 4, 36], ['Forward Tilt', 5, 28],
        ['Forward Tilt Up', 5, 28], ['Forward Tilt Down', 5, 28],
        ['Up Tilt', 6, 29], ['Down Tilt', 5, 28]] as const;
    for (const [name, contact, duration] of plans) {
        const sequence = model.Sequences.find((s: any) => s.Name === name);
        require(sequence?.NonLooping, `${name} missing or looping`);
        require(Math.abs(sequence.Interval[1] - sequence.Interval[0] - duration * 1000 / 24) < 2, `${name} duration`);
        const within = (k: any) => k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1];
        require(!(root.Translation?.Keys ?? []).some(within), `${name} moves the simulation root`);
        const limb = bones.find(b => b.Name === (fighter === 'Rifleman' ? 'Rifle01' : name === 'Attack Jab' ? 'Bone_Arm1_R' : 'Bone_Leg1_R'));
        const sample = (frame: number) => {
            const at = sequence.Interval[0] + frame * 1000 / 24;
            const key = limb.Rotation.Keys.filter(within).find((k: any) => Math.abs(k.Frame - at) < 2);
            require(key, `${name} missing contact key ${frame}`);
            return key.Vector as number[];
        };
        const dot = (a: number[], b: number[]) => Math.abs(a.reduce((sum, v, i) => sum + v*b[i], 0));
        require(dot(sample(0), sample(contact)) < .99, `${name} has no readable limb extension`);
        require(dot(sample(contact), sample(contact + 1)) > .999, `${name} retracts inside its active window`);
    }
}
