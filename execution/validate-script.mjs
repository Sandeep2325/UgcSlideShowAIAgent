// Deterministic script validator/normalizer.
// Usage: node execution/validate-script.mjs <jobId|path-to-script.json>
// Validates against the Data Schema, fills defaults, reports the timeline. Writes nothing unless --fix.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/kie.mjs";

const arg = process.argv[2];
const fix = process.argv.includes("--fix");
if (!arg) {
  console.error("usage: node execution/validate-script.mjs <jobId|path> [--fix]");
  process.exit(1);
}

const path = arg.endsWith(".json") ? arg : join(ROOT, ".tmp", arg, "script.json");
const script = JSON.parse(readFileSync(path, "utf8"));

const errors = [];
const fps = script.fps ?? 30;
const imageSize = script.imageSize ?? "9:16";

if (!script.topic) errors.push("missing `topic`");
if (!Array.isArray(script.scenes) || script.scenes.length === 0) errors.push("no `scenes`");

let totalFrames = 0;
(script.scenes ?? []).forEach((s, i) => {
  if (!s.caption) errors.push(`scene ${i + 1}: missing caption`);
  if (!s.imagePrompt) errors.push(`scene ${i + 1}: missing imagePrompt`);
  if (s.imagePrompt && s.imagePrompt.length > 5000)
    errors.push(`scene ${i + 1}: imagePrompt exceeds 5000 chars`);
  s.id = i + 1; // normalize ids
  s.durationInFrames = s.durationInFrames ?? 90; // default 3s @ 30fps
  totalFrames += s.durationInFrames;
});

script.fps = fps;
script.imageSize = imageSize;
script.aspectRatio = script.aspectRatio ?? "9:16";

const refs = script.referenceImages ?? {};
console.log(`📄 ${path}`);
console.log(`   topic:  ${script.topic ?? "(none)"}`);
console.log(`   scenes: ${script.scenes?.length ?? 0}`);
console.log(`   length: ${(totalFrames / fps).toFixed(1)}s (${totalFrames} frames @ ${fps}fps)`);
console.log(`   caption style: ${script.captionStyle ?? "minimal (default)"}`);
console.log(`   style ref:     ${refs.style ?? "(none)"}`);
console.log(`   character ref: ${refs.character ?? "(none — scene 1 output becomes the anchor)"}`);
console.log(`   product ref:   ${refs.product ?? "(none)"}`);
(script.scenes ?? []).forEach((s) => {
  const prod = refs.product && s.useProduct === true ? " [product]" : "";
  console.log(`   #${s.id} ${(s.durationInFrames / fps).toFixed(1)}s${prod} — "${s.caption?.slice(0, 46)}"`);
});

if (errors.length) {
  console.error(`\n❌ ${errors.length} problem(s):`);
  errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}

if (fix) {
  writeFileSync(path, JSON.stringify(script, null, 2));
  console.log("\n💾 normalized script written back (--fix).");
}
console.log("\n✅ script valid.");
