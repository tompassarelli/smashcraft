# Agency marker asset inspection — 6 October 2026

This inspection used the installed classic `Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdx`, read through Smashcraft's existing CASC extractor. Extracted model and texture remain private under `~/.local/share/smashcraft-build-inputs/agency-marker-repair-20261006/`.

The model contains one geoset and two triangles, with no particles or lights. Its four vertices form an XY quad at z=12.4727, spanning x=-40.6926..41.0513 and y=-40.8857..40.8582. The material is additive, unshaded and unfogged; its geoset colour in RGB is (0.952941, 0.717647, 0), with `Textures\\GenericGlowFaded.blp` as its texture. Its Stand sequence spans 333..2500 ms.

The original marker renderer at e6fb992e left animation and orientation implicit, used scale0.75 and placed the glow5 units above the fighter's feet. A horizontal quad is compressed vertically by the arena camera's10° downward view. This is a confirmed asset/renderer mismatch with the intended visible halo, rather than evidence that the classifier or pause gate is wrong.

The repair explicitly selects and holds Stand, rolls the quad90° toward the side camera, and places it behind the fighter90 units above its feet at scale1.75. Saturated green prevents the model's built-in orange colour from diluting the intended green state. Fighter hitlag and ice colours are untouched.

The focused paired headless fixture check passed for all three fighters: both markers, their explicit drawable pose, actionable absence, and thaw removal. Existing classification, replay and Lua32 results were reused. No native input or new capture occurred during this inspection; this repair still needs the native pair observation described by #94.
