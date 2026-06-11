// Navigation layer — orchestrates the full slideshow pipeline in order.
// Usage: node execution/run.mjs <jobId> <step>
//   steps:  validate | generate | studio
// The PLAN step (topic -> script.json) is done by the agent following
// architecture/generate-slideshow.md, then this orchestrator runs the deterministic tools.
// HARD GATE: `generate` must only run after the user approves .tmp/<jobId>/script.json.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const [jobId, step] = process.argv.slice(2);

if (!jobId || !step) {
  console.error("usage: node execution/run.mjs <jobId> <validate|generate|studio>");
  process.exit(1);
}

const scripts = {
  validate: "validate-script.mjs",
  generate: "generate-images.mjs",
  studio: "open-studio.mjs",
};
const file = scripts[step];
if (!file) {
  console.error(`unknown step "${step}" — use validate | generate | studio`);
  process.exit(1);
}

const r = spawnSync("node", [join(here, file), jobId], { stdio: "inherit" });
process.exit(r.status ?? 0);
