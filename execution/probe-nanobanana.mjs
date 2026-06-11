// Phase L handshake probe — confirms NanoBanana (via Kie.ai) responds and the key is valid.
// Dependency-free. Run: node execution/probe-nanobanana.mjs
// Does ONE cheap createTask + polls until the image URL is returned, then reports.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://api.kie.ai/api/v1";

// --- minimal .env loader (no dotenv dependency) ---
function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const KEY = env.KIE_AI_API_KEY;
if (!KEY) {
  console.error("❌ KIE_AI_API_KEY missing from .env");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${KEY}` };

async function createTask() {
  const res = await fetch(`${BASE}/jobs/createTask`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/nano-banana",
      input: {
        prompt: "a plain white ceramic coffee mug on a wooden table, soft window light, candid phone photo",
        output_format: "png",
        image_size: "9:16",
      },
    }),
  });
  const json = await res.json();
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`createTask failed: HTTP ${res.status} — ${JSON.stringify(json)}`);
  }
  return json.data.taskId;
}

async function poll(taskId, { tries = 24, everyMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/jobs/recordInfo?taskId=${taskId}`, { headers: auth });
    const json = await res.json();
    const state = json.data?.state;
    if (state === "success") {
      const url = JSON.parse(json.data.resultJson).resultUrls[0];
      return url;
    }
    if (state === "fail") throw new Error(`generation failed: ${JSON.stringify(json.data)}`);
    process.stdout.write(`  …${state ?? "?"} (${i + 1}/${tries})\r`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error("timed out waiting for image");
}

(async () => {
  console.log("🔌 NanoBanana (Kie.ai) handshake probe");
  console.log(`   endpoint: ${BASE}`);
  console.log(`   key:      ${KEY.slice(0, 6)}…(${KEY.length} chars)`);
  try {
    const taskId = await createTask();
    console.log(`✅ createTask OK — taskId ${taskId}`);
    const url = await poll(taskId);
    console.log(`\n✅ image ready: ${url}`);
    console.log("🟢 LINK GREEN — NanoBanana is reachable and the key works.");
  } catch (e) {
    console.error(`\n🔴 LINK BROKEN — ${e.message}`);
    process.exit(1);
  }
})();
