// Copies a job's script into the Remotion app as the active script, then prints how to open Studio.
// Usage: node execution/open-studio.mjs <jobId>
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/kie.mjs";

const jobId = process.argv[2];
if (!jobId) {
  console.error("usage: node execution/open-studio.mjs <jobId>");
  process.exit(1);
}

const src = join(ROOT, ".tmp", jobId, "script.json");
if (!existsSync(src)) {
  console.error(`❌ no script at ${src}`);
  process.exit(1);
}
const dst = join(ROOT, "slideshow", "src", "active-script.json");
copyFileSync(src, dst);
console.log(`✅ active-script.json ← ${jobId}`);
console.log("▶  Open Studio:  cd slideshow && npm run dev");
console.log("⬇  Render MP4:   cd slideshow && npm run render");
