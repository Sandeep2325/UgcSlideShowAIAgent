// Generates + downloads NanoBanana images for an APPROVED script, with CHARACTER CONSISTENCY
// and optional PRODUCT/CONTEXT reference images.
// Usage: node execution/generate-images.mjs <jobId>
// HARD GATE: only run after the user approves .tmp/<jobId>/script.json.
//
// Reference model (all optional):
//   - style     = script.referenceImages.style — an image OR video defining the overall look/aesthetic.
//                 Applied to EVERY scene. A video is auto-reduced to one style frame.
//   - character = a single anchor reused for every scene so the person stays identical.
//       * if script.referenceImages.character is set -> that image is the anchor (uploaded if local).
//       * otherwise -> scene 1 is generated and ITS output becomes the anchor for scenes 2..N.
//   - product   = script.referenceImages.product — featured ONLY on scenes flagged `useProduct: true`
//                 (i.e. when the slide explains the product/solution). Off by default.
//
// Writes PNGs to slideshow/public/<jobId>/scene-N.png and records local paths back into script.json.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, createImageTask, createEditTask, pollImage, downloadTo, resolveRefToUrl } from "./lib/kie.mjs";

const jobId = process.argv[2];
if (!jobId) {
  console.error("usage: node execution/generate-images.mjs <jobId>");
  process.exit(1);
}

const jobDir = join(ROOT, ".tmp", jobId);
const scriptPath = join(jobDir, "script.json");
const script = JSON.parse(readFileSync(scriptPath, "utf8"));
const size = script.imageSize ?? script.aspectRatio ?? "9:16";
const refs = script.referenceImages ?? {};

const tick = (state, i, n) => process.stdout.write(`${state}(${i}/${n}) `);

// Build the edit prompt + ordered image list, with explicit "keep identical" instructions.
function buildEdit(scene, { styleUrl, characterUrl, productUrl, useProduct }) {
  const urls = [];
  const parts = [];
  if (styleUrl) {
    urls.push(styleUrl);
    parts.push(
      `Reference image ${urls.length} defines the VISUAL STYLE — match its overall aesthetic, color grading, lighting mood, framing and texture.`
    );
  }
  if (characterUrl) {
    urls.push(characterUrl);
    parts.push(
      `Reference image ${urls.length} is the SAME PERSON for this whole video — keep their face, hairstyle, skin tone, body and identity exactly identical; do not change who they are.`
    );
  }
  if (productUrl && useProduct) {
    urls.push(productUrl);
    parts.push(
      `Reference image ${urls.length} is the EXACT PRODUCT to feature — keep its shape, color, label and branding unchanged and clearly visible.`
    );
  }
  const preamble = parts.length ? parts.join(" ") + " Now create this scene: " : "";
  return { imageUrls: urls, prompt: preamble + scene.imagePrompt };
}

console.log(`🎨 "${script.topic}" — ${script.scenes.length} scenes @ ${size}`);

// Resolve reference images to public URLs up front.
let styleUrl = null;
let characterUrl = null;
let productUrl = null;
if (refs.style) {
  process.stdout.write("  ↑ uploading style reference… ");
  styleUrl = await resolveRefToUrl(refs.style, { localBase: jobDir });
  console.log("✓");
}
if (refs.character) {
  process.stdout.write("  ↑ uploading character reference… ");
  characterUrl = await resolveRefToUrl(refs.character, { localBase: jobDir });
  console.log("✓");
}
if (refs.product) {
  process.stdout.write("  ↑ uploading product reference… ");
  productUrl = await resolveRefToUrl(refs.product, { localBase: jobDir });
  console.log("✓");
}

for (const scene of script.scenes) {
  const useProduct = scene.useProduct === true; // product only on scenes that explain the product/solution
  process.stdout.write(`  #${scene.id} `);

  let resultUrl;
  const haveRef = styleUrl || characterUrl || (productUrl && useProduct);
  if (haveRef) {
    const { imageUrls, prompt } = buildEdit(scene, { styleUrl, characterUrl, productUrl, useProduct });
    process.stdout.write(`edit[${imageUrls.length} ref] `);
    const taskId = await createEditTask({ prompt, imageUrls, aspectRatio: size });
    resultUrl = await pollImage(taskId, { onTick: tick });
  } else {
    process.stdout.write("text→image ");
    const taskId = await createImageTask({ prompt: scene.imagePrompt, imageSize: size });
    resultUrl = await pollImage(taskId, { onTick: tick });
  }

  // First generated scene with no supplied character becomes the anchor for the rest.
  if (!characterUrl) {
    characterUrl = resultUrl;
    console.log("(→ character anchor set)");
  }

  const rel = `${jobId}/scene-${scene.id}.png`; // relative to slideshow/public for staticFile()
  await downloadTo(resultUrl, join(ROOT, "slideshow", "public", rel));
  scene.image = rel;
  console.log(`✓ ${rel}`);
}

writeFileSync(scriptPath, JSON.stringify(script, null, 2));
console.log(`\n✅ Images saved under slideshow/public/${jobId}/ and paths written to script.json`);
