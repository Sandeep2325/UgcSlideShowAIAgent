#!/usr/bin/env node
// slideshow-agent — autonomous UGC slideshow generator.
//
// The "brain" is one structured Claude call (claude-opus-4-8) that turns a topic into a scene
// script following the project SOPs. The deterministic tools in execution/ then generate the
// NanoBanana images and assemble the Remotion slideshow.
//
// Usage:
//   node slideshow-agent.mjs "<topic>" [options]
//
// Options:
//   --url <productUrl>      Fetch a product page to ground the script in real details
//   --product <path|url>    Product image — shown only on product/solution slides
//   --character <path|url>  Character image — kept identical across all slides
//   --style <path|url|mp4>  Style reference (image or video) for the overall look
//   --captions <style>      pill | subtitle | highlight | minimal   (default: minimal)
//   --scenes <n>            Number of slides (default: 6)
//   --yes                   Skip the approval gate (generate without confirming)
//   --render                Render the MP4 after generating (default: open Remotion Studio)
//
// Requires ANTHROPIC_API_KEY and KIE_AI_API_KEY in .env.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "./execution/lib/kie.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODEL = "claude-opus-4-8";
const CAPTION_STYLES = ["pill", "subtitle", "highlight", "minimal"];

// ---------- args ----------
function parseArgs(argv) {
  const opts = { scenes: 6, captions: "minimal", yes: false, render: false };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") opts.yes = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--render") opts.render = true;
    else if (a === "--url") opts.url = argv[++i];
    else if (a === "--product") opts.product = argv[++i];
    else if (a === "--character") opts.character = argv[++i];
    else if (a === "--style") opts.style = argv[++i];
    else if (a === "--captions") opts.captions = argv[++i];
    else if (a === "--scenes") opts.scenes = parseInt(argv[++i], 10);
    else if (a.startsWith("--")) throw new Error(`unknown option: ${a}`);
    else positionals.push(a);
  }
  opts.topic = positionals.join(" ").trim();
  return opts;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "slideshow";
}

// ---------- product page → text (dependency-free) ----------
async function fetchProductContext(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 6000);
  } catch (e) {
    console.warn(`⚠️  couldn't fetch ${url}: ${e.message}`);
    return null;
  }
}

// ---------- the planning brain ----------
const SCRIPT_TOOL = {
  name: "emit_script",
  description: "Emit the finished slideshow scene script.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the slideshow" },
      scenes: {
        type: "array",
        description: "Ordered slides",
        items: {
          type: "object",
          properties: {
            caption: { type: "string", description: "Short on-screen UGC caption for the slide" },
            imagePrompt: {
              type: "string",
              description:
                "Full NanoBanana prompt. Repeat the SAME subject + setting description verbatim across every scene for consistency. Include realism keywords (photorealistic, shot on iPhone, natural light, film grain, candid, authentic); avoid AI tells (4K, stunning, vibrant, 3D, rendered).",
            },
            durationInFrames: { type: "integer", description: "Slide length at 30fps (90 = 3s, 120 = 4s)" },
            useProduct: {
              type: "boolean",
              description:
                "true ONLY on slides that explain/feature the product or solution. false on hook/concept/problem slides.",
            },
          },
          required: ["caption", "imagePrompt", "durationInFrames", "useProduct"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "scenes"],
    additionalProperties: false,
  },
};

async function planScript(client, { topic, sceneCount, productContext, hasProduct, hasCharacter, hasStyle }) {
  // The SOPs are the single source of truth — feed them as the (cached) system prompt.
  const sop = readFileSync(join(ROOT, "architecture", "generate-slideshow.md"), "utf8");
  const apiSop = readFileSync(join(ROOT, "architecture", "nanobanana-api.md"), "utf8");
  const system = [
    {
      type: "text",
      text:
        "You are the scene-planning brain of a UGC slideshow generator. You turn a topic into a " +
        "scene script that downstream tools render with NanoBanana + Remotion. Follow the SOPs exactly. " +
        "Captions are short, first-person, authentic UGC text. Image prompts must repeat the SAME subject " +
        "and setting description verbatim across every scene so the person/scene stays identical. " +
        "Call emit_script exactly once.\n\n=== SOP: generate-slideshow ===\n" +
        sop +
        "\n\n=== SOP: nanobanana-api ===\n" +
        apiSop,
      cache_control: { type: "ephemeral" },
    },
  ];

  const refsNote = [
    hasCharacter
      ? "A character reference image IS provided — describe the same person consistently; the tool anchors identity."
      : "No character image — scene 1 establishes the person; repeat their full description in every later scene.",
    hasProduct
      ? "A product reference image IS provided — set useProduct:true ONLY on the slides that explain/feature the product."
      : "No product image — set useProduct:false on every scene.",
    hasStyle ? "A style reference is provided and will be applied to every scene automatically." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user =
    `Topic: ${topic}\n` +
    `Number of slides: ${sceneCount}\n` +
    `${refsNote}\n` +
    (productContext ? `\nProduct page details (use accurate facts, keep claims grounded):\n${productContext}\n` : "") +
    `\nWrite ${sceneCount} slides with a clear arc (hook → build → payoff). Final slide slightly longer.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    tools: [SCRIPT_TOOL],
    tool_choice: { type: "tool", name: "emit_script" },
    messages: [{ role: "user", content: user }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("model did not return a script");
  if (res.usage) {
    const u = res.usage;
    console.log(
      `   tokens: in ${u.input_tokens} (cache write ${u.cache_creation_input_tokens ?? 0}, read ${u.cache_read_input_tokens ?? 0}), out ${u.output_tokens}`
    );
  }
  return block.input;
}

// ---------- approval ----------
function printScript(script) {
  console.log(`\n📋 ${script.title}  —  ${script.scenes.length} slides`);
  const fps = 30;
  let frames = 0;
  for (const s of script.scenes) {
    frames += s.durationInFrames;
    const tag = s.useProduct ? " [product]" : "";
    console.log(`   #${s.id} ${(s.durationInFrames / fps).toFixed(1)}s${tag}  "${s.caption}"`);
  }
  console.log(`   total ≈ ${(frames / fps).toFixed(1)}s\n`);
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

// ---------- pipeline ----------
// In --json mode, child output goes to stderr so stdout stays a clean JSON result for callers.
let JSON_MODE = false;
function childStdio() {
  return JSON_MODE ? ["ignore", 2, 2] : "inherit";
}
function run(jobId, step) {
  const r = spawnSync("node", [join(ROOT, "execution", "run.mjs"), jobId, step], { stdio: childStdio() });
  if (r.status !== 0) throw new Error(`step "${step}" failed`);
}

// ---------- main ----------
(async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.topic) {
    console.error('usage: node slideshow-agent.mjs "<topic>" [--url ..] [--product ..] [--character ..] [--style ..] [--captions minimal] [--scenes 6] [--yes] [--render]');
    process.exit(1);
  }
  if (!CAPTION_STYLES.includes(opts.captions)) {
    console.error(`--captions must be one of: ${CAPTION_STYLES.join(", ")}`);
    process.exit(1);
  }

  // --json: machine-readable mode for callers (e.g. Python). Non-interactive; humans logs → stderr.
  if (opts.json) {
    JSON_MODE = true;
    opts.yes = true;
    const errlog = console.error.bind(console);
    console.log = (...a) => errlog(...a); // keep stdout clean for the final JSON
  }

  const env = loadEnv();
  if (!env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY missing from .env — add it to run the agent.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  console.log(`🤖 slideshow-agent — "${opts.topic}"`);

  let productContext = null;
  if (opts.url) {
    process.stdout.write("   fetching product page… ");
    productContext = await fetchProductContext(opts.url);
    console.log(productContext ? "✓" : "skipped");
  }

  console.log("   planning scenes with claude-opus-4-8…");
  const planned = await planScript(client, {
    topic: opts.topic,
    sceneCount: opts.scenes,
    productContext,
    hasProduct: Boolean(opts.product),
    hasCharacter: Boolean(opts.character),
    hasStyle: Boolean(opts.style),
  });

  // Assemble the full script.json (schema lives in CLAUDE.md).
  const jobId = `${slugify(opts.topic)}-${String(Date.now()).slice(-6)}`;
  const referenceImages = {};
  if (opts.style) referenceImages.style = opts.style;
  if (opts.character) referenceImages.character = opts.character;
  if (opts.product) referenceImages.product = opts.product;

  const script = {
    jobId,
    topic: opts.topic,
    title: planned.title,
    aspectRatio: "9:16",
    fps: 30,
    imageSize: "9:16",
    captionStyle: opts.captions,
    ...(Object.keys(referenceImages).length ? { referenceImages } : {}),
    scenes: planned.scenes.map((s, i) => ({ id: i + 1, ...s })),
  };

  const jobDir = join(ROOT, ".tmp", jobId);
  mkdirSync(jobDir, { recursive: true });
  writeFileSync(join(jobDir, "script.json"), JSON.stringify(script, null, 2));

  printScript(script);
  console.log(`   script: .tmp/${jobId}/script.json`);

  // HARD GATE — approval before any image generation (API spend).
  if (!opts.yes) {
    const ok = await confirm("Generate these images? [y/N] ");
    if (!ok) {
      console.log("Stopped. Edit the script.json above and re-run with --yes, or tweak your prompt.");
      process.exit(0);
    }
  }

  run(jobId, "validate");
  run(jobId, "generate");
  run(jobId, "studio"); // copies this job's script into the Remotion app (active-script.json)

  // Re-read the script — generate-images wrote each scene's image path back into it.
  const finalScript = JSON.parse(readFileSync(join(jobDir, "script.json"), "utf8"));
  const imageAbs = (rel) => (rel ? join(ROOT, "slideshow", "public", rel) : null);

  let videoPath = null;
  if (opts.render) {
    console.log("\n🎬 rendering MP4…");
    const r = spawnSync("npm", ["run", "render"], { cwd: join(ROOT, "slideshow"), stdio: childStdio() });
    if (r.status === 0) videoPath = join(ROOT, "slideshow", "out", "video.mp4");
    else throw new Error("MP4 render failed");
  }

  if (JSON_MODE) {
    const result = {
      jobId,
      topic: opts.topic,
      title: finalScript.title,
      captionStyle: finalScript.captionStyle,
      scriptPath: join(jobDir, "script.json"),
      scenes: finalScript.scenes.map((s) => ({
        id: s.id,
        caption: s.caption,
        useProduct: Boolean(s.useProduct),
        image: imageAbs(s.image),
      })),
      images: finalScript.scenes.map((s) => imageAbs(s.image)).filter(Boolean),
      video: videoPath,
      studioCommand: videoPath ? null : "cd slideshow && npm run dev",
    };
    process.stdout.write(JSON.stringify(result) + "\n");
  } else if (videoPath) {
    console.log(`✅ slideshow/out/video.mp4`);
  } else {
    console.log("\n✅ Done. Preview in Remotion Studio:  cd slideshow && npm run dev");
    console.log(`   Render MP4:  cd slideshow && npm run render`);
  }
})().catch((e) => {
  console.error(`\n🔴 ${e.message}`);
  process.exit(1);
});
