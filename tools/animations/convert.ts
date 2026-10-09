
import { decodeBLP, getBLPImageData, generateMDL } from "war3-model";
import { parseModelMDX } from "../../ts/scripts/mdxCodec";
import { renumberNodes } from "../../ts/scripts/clipNodes";
import { PNG } from "pngjs";

const [source, destination] = Bun.argv.slice(2);
if (!source || !destination) throw new Error("usage: convert.ts INPUT.mdx|INPUT.blp OUTPUT");
const bytes = await Bun.file(source).arrayBuffer();
if (source.toLowerCase().endsWith(".mdx")) {
    const model = parseModelMDX(bytes);
    if (Bun.argv.includes("--body-only")) {
        model.ParticleEmitters = []; model.ParticleEmitters2 = [];
        model.ParticleEmitterPopcorns = []; model.RibbonEmitters = [];
        model.Lights = []; model.EventObjects = [];
    }
    renumberNodes(model);
    await Bun.write(destination, generateMDL(model));
} else if (source.toLowerCase().endsWith(".blp")) {
    const texture = decodeBLP(bytes);
    const pixels = getBLPImageData(texture, 0);
    const png = new PNG({ width: texture.width, height: texture.height });
    png.data = Buffer.from(pixels.data);
    await Bun.write(destination, PNG.sync.write(png));
} else {
    throw new Error("expected an MDX model or BLP texture");
}
