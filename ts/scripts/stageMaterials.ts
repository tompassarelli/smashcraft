import type { DeckPalette, PlatformMaterialSet } from "../src/game/assets/stagePalette";
import type { DeckFace } from "./stageDeck";

const parts = ["top", "lip", "body", "underside"] as const;
const vec = (values: readonly number[]) => `{ ${values.join(", ")} }`;

/** Cut into 128-unit cells before mapping a crop: wrapping an atlas repeats neighbouring tiles. */
function tileFace(face: DeckFace): { corners: number[][]; uv: number[][] }[] {
  const axes = Math.abs(face.normal[2]) > 0.5 ? [0, 1] : Math.abs(face.normal[1]) > 0.5 ? [0, 2] : [1, 2];
  const a = axes[0] ?? 0, b = axes[1] ?? 2;
  const lowA = Math.floor(Math.min(...face.corners.map(p => p[a] ?? 0)) / 128);
  const highA = Math.ceil(Math.max(...face.corners.map(p => p[a] ?? 0)) / 128);
  const lowB = Math.floor(Math.min(...face.corners.map(p => p[b] ?? 0)) / 128);
  const highB = Math.ceil(Math.max(...face.corners.map(p => p[b] ?? 0)) / 128);
  const clip = (polygon: number[][], axis: number, limit: number, above: boolean): number[][] => {
    const result: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      if (p === undefined || q === undefined) continue;
      const pv = p[axis] ?? 0, qv = q[axis] ?? 0;
      const insideP = above ? pv >= limit : pv <= limit;
      const insideQ = above ? qv >= limit : qv <= limit;
      if (insideP) result.push(p);
      if (insideP !== insideQ) {
        const t = (limit - pv) / (qv - pv);
        result.push(p.map((v, n) => Math.fround(v + ((q[n] ?? 0) - v) * t)));
      }
    }
    return result;
  };
  const cells: { corners: number[][]; uv: number[][] }[] = [];
  for (let x = lowA; x < highA; x++) for (let y = lowB; y < highB; y++) {
    let corners = face.corners.map(p => [...p]);
    for (const [axis, limit, above] of [[a,x*128,true],[a,(x+1)*128,false],[b,y*128,true],[b,(y+1)*128,false]] as const) corners = clip(corners,axis,limit,above);
    if (corners.length < 3) continue;
    cells.push({ corners, uv: corners.map(p => [((p[a] ?? 0)-x*128)/128,((p[b] ?? 0)-y*128)/128]) });
  }
  return cells;
}

/** Stock texture faces with static tint, keeping the collision silhouette and winding. */
export function texturedDeckMdl(faces: readonly DeckFace[], materials: PlatformMaterialSet, palette: DeckPalette): string {
  const textures = parts.map(part => materials[part]);
  const points = faces.flatMap(face => face.corners);
  const low = [0,1,2].map(axis => Math.min(...points.map(p=>p[axis] ?? 0)));
  const high = [0,1,2].map(axis => Math.max(...points.map(p=>p[axis] ?? 0)));
  const radius = Math.ceil(Math.max(...points.map(([x,y,z])=>Math.hypot(x,y,z))));
  const extent = `MinimumExtent ${vec(low)}, MaximumExtent ${vec(high)}, BoundsRadius ${radius},`;
  const geosets = parts.map((part, material) => {
    const source = textures[material];
    if (source === undefined) throw new Error(`missing ${part} texture`);
    const [u0,v0,u1,v1] = source.crop ?? (source.texture.startsWith("TerrainArt\\") ? [0,0,0.25,0.25] : [0,0,1,1]);
    const vertices: number[][] = [], normals: number[][] = [], uv: number[][] = [], triangles: number[] = [];
    for (const face of faces.filter(f=>f.material===material)) for (const cell of tileFace(face)) {
      const offset=vertices.length;
      vertices.push(...cell.corners); normals.push(...cell.corners.map(()=>[...face.normal]));
      const bottom = Math.min(...face.corners.map(p => p[2] ?? 0));
      const height = Math.max(...face.corners.map(p => p[2] ?? 0)) - bottom;
      uv.push(...cell.uv.map(([u,v], index)=>[u0+(u ?? 0)*(u1-u0),v0+(source.fitHeight && height > 0 && Math.abs(face.normal[2]) < 0.5 ? ((cell.corners[index]?.[2] ?? bottom)-bottom)/height : v ?? 0)*(v1-v0)]));
      for(let i=1;i+1<cell.corners.length;i++) triangles.push(offset,offset+i,offset+i+1);
    }
    const tint = source.tint ?? (part === "top" ? materials.tint ?? palette.top : palette[part]);
    return `Geoset {
      Vertices ${vertices.length} { ${vertices.map(v=>`${vec(v)},`).join("\n")} }
      Normals ${normals.length} { ${normals.map(v=>`${vec(v)},`).join("\n")} }
      TVertices ${uv.length} { ${uv.map(v=>`${vec(v)},`).join("\n")} }
      VertexGroup { ${vertices.map(()=>"0,").join(" ")} }
      Faces 1 ${triangles.length} { Triangles { ${vec(triangles)}, } }
      Groups 1 1 { Matrices { 0 }, } ${extent} Anim { ${extent} }
      MaterialID ${material}, SelectionGroup 0,
    }
    GeosetAnim { static Alpha 1, static Color ${vec([...tint].reverse().map(v=>v/255))}, GeosetId ${material}, }`;
  });
  return `Version { FormatVersion 800, }
Model "Smashcraft textured deck" { NumGeosets 4, NumGeosetAnims 4, NumBones 1, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 4 { ${textures.map(({texture})=>`Bitmap { Image "${texture}", }`).join("\n")} }
Materials 4 { ${parts.map((_,i)=>`Material { Layer { FilterMode None, Unshaded, static TextureID ${i}, static Alpha 1, } }`).join("\n")} }
${geosets.join("\n")}
Bone "Deck" { ObjectId 0, GeosetId Multiple, GeosetAnimId None, }
PivotPoints 1 { { 0, 0, 0 }, }
`;
}

/** Thin pass-through deck, with a lip and tapered frame under the walking line. */
export function platformDeckFaces(): DeckFace[] {
  const faces: DeckFace[]=[];
  for(const [top,bottom,width,lower,material] of [[0,-3,50,50,0],[-3,-6,50,50,1],[-6,-14,50,42,2],[-14,-17,42,38,3]] as const){
    const points=[[-width,-60,top],[width,-60,top],[width,60,top],[-width,60,top],[-lower,-48,bottom],[lower,-48,bottom],[lower,48,bottom],[-lower,48,bottom]] as const;
    const polygons=[[0,1,2,3],[5,4,7,6],[4,5,1,0],[5,6,2,1],[6,7,3,2],[7,4,0,3]];
    const normals=[[0,0,1],[0,0,-1],[0,-1,0],[1,0,0],[0,1,0],[-1,0,0]] as const;
    polygons.forEach((polygon,i)=>faces.push({ material,normal:normals[i] ?? [0,0,1],corners:polygon.map(index=>points[index] ?? points[0]) }));
  }
  return faces;
}
