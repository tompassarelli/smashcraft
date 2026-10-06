// Foreign MDX boundary: one body clip per original sequence and one static
// light component per fighter, retaining native selected-sequence evaluation.
import {parseMDX, generateMDX, model as mdx} from 'war3-model';
import {isDeepStrictEqual} from 'node:util';
import {renumberNodes} from '../../ts/scripts/clipNodes';

/** Each fighter's original model under the private assets directory, in Character order. */
export const fighters = [
    {name: 'Archer', source: 'animation-assets/ArcherFighter.mdx'},
    {name: 'Rifleman', source: 'animation-assets/RiflemanFighter.mdx'},
    {name: 'Illidan', source: 'illidan-animation/DemonHunterFighter.mdx'},
] as const;
export function ensure(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(why); }
export const hash = (bytes: ArrayBuffer) => new Bun.CryptoHasher('sha256').update(new Uint8Array(bytes)).digest('hex');

export function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = '') {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if ('Keys' in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
    // Nodes aliases Bones, Helpers, etc.; visiting it would transform each node twice.
    for (const [key, child] of Object.entries(value)) if (key !== 'Nodes') tracks(child, visit, `${path}.${key}`);
}

export function bounds(items: mdx.GeosetAnimInfo[]) {
    ensure(items.length > 0, 'Cannot union empty extents');
    return {
        MinimumExtent: new Float32Array([0, 1, 2].map(i => Math.min(...items.map(x => x.MinimumExtent[i])))),
        MaximumExtent: new Float32Array([0, 1, 2].map(i => Math.max(...items.map(x => x.MaximumExtent[i])))),
        BoundsRadius: Math.max(...items.map(x => x.BoundsRadius)),
    };
}

export function removeBodyEffects(model: mdx.Model) {
    ensure(!model.ParticleEmitterPopcorns?.length, 'Unsupported ParticleEmitterPopcorns: no body-effect dependency policy');
    const removed = [...model.EventObjects, ...model.ParticleEmitters, ...model.ParticleEmitters2, ...model.RibbonEmitters];
    const ids = new Set(removed.map(n => n.ObjectId));
    for (const node of model.Nodes) if (node && !ids.has(node.ObjectId)) {
        ensure(node.Parent == null || !ids.has(node.Parent), `${node.Name}: body depends on removed effect node ${node.Parent}`);
    }
    for (const geoset of model.Geosets) for (const group of geoset.Groups) for (const id of group) {
        ensure(!ids.has(id), `Geoset matrix group depends on removed effect node ${id}`);
    }
    const counts = {EventObjects: model.EventObjects.length, ParticleEmitters: model.ParticleEmitters.length,
        ParticleEmitters2: model.ParticleEmitters2.length, RibbonEmitters: model.RibbonEmitters.length};
    model.EventObjects = [];
    model.ParticleEmitters = [];
    model.ParticleEmitters2 = [];
    model.RibbonEmitters = [];
    // Keep object IDs and pivot indices and only clear the removed aliases; originalBodyClip renumbers.
    for (const id of ids) delete model.Nodes[id];
    return counts;
}

export function encodeVerified(model: mdx.Model) {
    const bytes = generateMDX(model), decoded = parseMDX(bytes);
    const before = new Map<string, mdx.AnimVector>(), after = new Map<string, mdx.AnimVector>();
    tracks(model, (t, p) => before.set(p, t)); tracks(decoded, (t, p) => after.set(p, t));
    ensure(isDeepStrictEqual(before, after), 'MDX track round trip changed keys/interpolation');
    for (const key of ['Sequences', 'Textures', 'Materials', 'Geosets', 'GeosetAnims', 'PivotPoints',
        'Bones', 'Helpers', 'Attachments', 'CollisionShapes', 'Cameras', 'Lights', 'TextureAnims',
        'EventObjects', 'ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'GlobalSequences'] as const) {
        ensure(isDeepStrictEqual(model[key], decoded[key]), `MDX ${key} round trip changed content`);
    }
    return bytes;
}

/**
 * Checks a clip against its source: same textures, materials, geometry,
 * skin, pivots and bone/helper hierarchy, with each kept node renumbered by
 * its place in the clip's node order.
 */
export function verifyPreservedBody(original: mdx.Model, timeline: mdx.Model) {
    const kept = ['Bones', 'Helpers', 'Attachments', 'CollisionShapes'] as const;
    const renumbered = new Map<number, number>();
    for (const key of kept) {
        ensure(original[key].length === timeline[key].length, `Source ${key} count changed`);
        original[key].forEach((node, index) => renumbered.set(node.ObjectId, timeline[key][index].ObjectId));
    }
    const id = (objectId: number) => {
        const place = renumbered.get(objectId);
        ensure(place !== undefined, `Source ObjectId ${objectId} has no node in the clip`);
        return place;
    };
    for (const key of kept) original[key].forEach((node, index) => {
        ensure(isDeepStrictEqual(original.PivotPoints[node.ObjectId], timeline.PivotPoints[timeline[key][index].ObjectId]),
            `${node.Name}: source pivot point changed`);
    });
    ensure(isDeepStrictEqual(original.Textures, timeline.Textures), 'Source texture references changed');
    // Like bone transforms below, material animation has its own key-preservation
    // check. Normalize only source-animated Alpha; fixed material values stay exact.
    const staticMaterials = (m: mdx.Model) => m.Materials.map((material, i) => ({...material,
        Layers: material.Layers.map((layer, j) => {
            if (typeof original.Materials[i]?.Layers[j]?.Alpha === 'number') return layer;
            ensure(typeof layer.Alpha !== 'number' || layer.Alpha === 1, 'Source material Alpha backing changed');
            return {...layer, Alpha: 1};
        }),
    }));
    ensure(isDeepStrictEqual(staticMaterials(original), staticMaterials(timeline)), 'Source materials changed');
    const geometry = (m: mdx.Model, skin: (objectId: number) => number) =>
        m.Geosets.map(({Anims, ...g}) => ({...g, Groups: g.Groups.map(group => group.map(skin))}));
    ensure(isDeepStrictEqual(geometry(original, id), geometry(timeline, objectId => objectId)), 'Source geometry/skin/UV changed');
    for (const key of ['Bones', 'Helpers'] as const) {
        const staticNodes = (m: mdx.Model, place: (objectId: number) => number) => m[key].map(({Translation, Rotation, Scaling, ...n}) =>
            ({...n, ObjectId: place(n.ObjectId), Parent: n.Parent == null ? n.Parent : place(n.Parent)}));
        ensure(isDeepStrictEqual(staticNodes(original, id), staticNodes(timeline, objectId => objectId)), `Source ${key} hierarchy changed`);
    }
}

export function parseSource(bytes: ArrayBuffer) {
    const source = parseMDX(bytes);
    // This also rejects parser-discarded chunks or hidden static defaults. The current
    // source packages are emitted by this same pinned MDX codec.
    ensure(hash(generateMDX(source)) === hash(bytes), 'Source MDX is not lossless through the pinned codec; unsupported source fields/defaults');
    return source;
}

export type OriginalClipMode = 'compact' | 'untrimmed-reference' | 'diagnostic-zero-key';

export const staticLightGate = {
    activeAnimation: 'Stand', activeInterval: [0, 1000],
    inactiveAnimation: 'Death', inactiveInterval: [2000, 3000], seconds: .5,
} as const;

// Independent static illumination belongs to the fighter, not each body clip.
// The body keeps its node IDs until originalBodyClip numbers each clip's nodes by
// place; the light's IDs and pivots are dense.
export function splitStaticLights(source: mdx.Model): {body: mdx.Model, lights: mdx.Model | null} {
    const body = structuredClone(source);
    if (!source.Lights.length) return {body, lights: null};
    for (const light of source.Lights) {
        ensure(light.Parent == null, `${light.Name}: parented light is unsupported by static component extraction`);
        tracks(light, (_, path) => { throw new Error(`${light.Name}${path}: animated light is unsupported by static component extraction`); });
        ensure(source.PivotPoints[light.ObjectId] != null, `${light.Name}: missing original light pivot`);
    }
    const ids = new Set(source.Lights.map(light => light.ObjectId));
    ensure(ids.size === source.Lights.length, 'Duplicate original light node IDs');
    for (const node of source.Nodes) if (node && !ids.has(node.ObjectId))
        ensure(node.Parent == null || !ids.has(node.Parent), `${node.Name}: body depends on a light node`);
    for (const geoset of source.Geosets) for (const group of geoset.Groups) for (const id of group)
        ensure(!ids.has(id), 'Body matrix references a light node');
    body.Lights = [];
    for (const id of ids) delete body.Nodes[id];
    const lights = structuredClone(source);
    removeBodyEffects(lights);
    lights.Geosets = [];
    lights.GeosetAnims = [];
    lights.Materials = [];
    lights.Textures = [];
    lights.TextureAnims = [];
    lights.Bones = [];
    lights.Helpers = [];
    lights.Attachments = [];
    lights.CollisionShapes = [];
    lights.Cameras = [];
    lights.GlobalSequences = [];
    ensure(source.Sequences.length > 0, 'Static light component requires source sequence bounds');
    lights.Sequences = [
        {...source.Sequences[0], Name: staticLightGate.activeAnimation, Interval: new Uint32Array(staticLightGate.activeInterval), NonLooping: false, Rarity: 0, MoveSpeed: 0},
        {...source.Sequences[0], Name: staticLightGate.inactiveAnimation, Interval: new Uint32Array(staticLightGate.inactiveInterval), NonLooping: true, Rarity: 0, MoveSpeed: 0},
    ];
    lights.PivotPoints = lights.Lights.map(light => structuredClone(source.PivotPoints[light.ObjectId]));
    lights.Lights.forEach((light, id) => {
        light.ObjectId = id;
        light.Visibility = {LineType: mdx.LineType.DontInterp, GlobalSeqId: null, Keys: [
            ...staticLightGate.activeInterval.map(Frame => ({Frame, Vector: new Float32Array([1])})),
            ...staticLightGate.inactiveInterval.map(Frame => ({Frame, Vector: new Float32Array([0])})),
        ]};
    });
    lights.Nodes = [...lights.Lights];
    return {body, lights};
}

export function originalBodyClip(source: mdx.Model, sequenceIndex: number, mode: OriginalClipMode = 'compact') {
    ensure(mode === 'compact' || mode === 'untrimmed-reference' || mode === 'diagnostic-zero-key', 'Unknown original clip export mode');
    const trimKeys = mode !== 'untrimmed-reference';
    const omitEmptyTracks = mode === 'compact';
    ensure(Number.isInteger(sequenceIndex) && sequenceIndex >= 0 && sequenceIndex < source.Sequences.length,
        `Invalid original sequence index ${sequenceIndex}`);
    ensure(source.GlobalSequences.length === 0, 'Original clip replay does not support global animation clocks');
    tracks(source, (track, path) => ensure(track.GlobalSeqId == null || track.GlobalSeqId === -1 || track.GlobalSeqId === 0xffffffff,
        `${path}: original clip replay does not support a global track`));
    const model = structuredClone(source);
    const omittedEffects = removeBodyEffects(model);
    const sequence = model.Sequences[sequenceIndex];
    const [start, end] = sequence.Interval;
    ensure(end >= start, `${sequence.Name}: reversed source interval`);
    model.Sequences = [{...sequence, Name: 'Stand'}];
    for (const geoset of model.Geosets)
        geoset.Anims = [geoset.Anims[sequenceIndex] ?? bounds([geoset])];
    let originalKeys = 0, retainedKeys = 0, trackCount = 0;
    const emptyTracks: string[] = [];
    const omittedEmptyTracks: string[] = [];
    tracks(model, (track, path) => {
        const sourceKeyCount = track.Keys.length;
        ensure(!omitEmptyTracks || sourceKeyCount > 0, `${path}: source zero-key track requires explicit diagnostic or untrimmed-reference mode`);
        originalKeys += track.Keys.length;
        trackCount++;
        // Zero-key chunks fail the native compact probe. Keep them only in the
        // named diagnostic; normal compact assets omit emptied channels.
        if (trimKeys) track.Keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end);
        retainedKeys += track.Keys.length;
        if (!track.Keys.length) emptyTracks.push(path);
        if (omitEmptyTracks && sourceKeyCount > 0 && !track.Keys.length) {
            const parts = path.slice(1).split('.');
            const property = parts.pop()!;
            let owner: object = model;
            for (const part of parts) owner = Reflect.get(owner, part);
            ensure(Reflect.get(owner, property) === track, `${path}: track property identity changed`);
            if (/^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/.test(path)) {
                // GEOA/LAYS require static Alpha even without KGAO/KMTA. The codec
                // writes that backing scalar as 1 for animated Alpha; sources
                // admitted by parseSource round-trip that exact stored value.
                Reflect.set(owner, property, 1);
            } else if (/^\.(Bones|Helpers)\.\d+\.(Translation|Rotation|Scaling)$/.test(path)) {
                ensure(Reflect.deleteProperty(owner, property), `${path}: cannot omit emptied track`);
            } else if (/^\.Attachments\.\d+\.Visibility$/.test(path)) {
                // ATCH visibility has no serialized backing scalar. Absent KATV
                // retains the attachment node/path and its normal visibility.
                ensure(Reflect.deleteProperty(owner, property), `${path}: cannot omit emptied visibility`);
            } else {
                throw new Error(`${path}: unsupported empty-channel static backing semantics`);
            }
            omittedEmptyTracks.push(path);
        }
    });
    // Body preservation checks compare material structure separately from these
    // animation channels. Check retained keys and omissions against source data.
    const expectedTracks = new Map<string, mdx.AnimVector>();
    const bodySource = structuredClone(source);
    removeBodyEffects(bodySource);
    tracks(bodySource, (track, path) => {
        const Keys = trimKeys ? track.Keys.filter(key => key.Frame >= start && key.Frame <= end) : track.Keys;
        if (!omitEmptyTracks || Keys.length) expectedTracks.set(path, {...track, Keys});
    });
    const retainedTracks = new Map<string, mdx.AnimVector>();
    tracks(model, (track, path) => retainedTracks.set(path, track));
    ensure(isDeepStrictEqual(retainedTracks, expectedTracks), 'Original clip changed retained animation channels');
    // Removed lights and effect nodes leave gaps, and Warcraft does not read ObjectIds as written (ts/scripts/clipNodes.ts).
    renumberNodes(model);
    return {model, mode, sequenceIndex, name: sequence.Name, interval: [start, end], looping: !sequence.NonLooping,
        originalKeys, retainedKeys, trackCount, emptyTracks, omittedEmptyTracks, omittedEffects};
}
