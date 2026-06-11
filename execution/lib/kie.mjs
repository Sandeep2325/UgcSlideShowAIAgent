// Shared NanoBanana (via Kie.ai) client — used by probe + generate-images.
// Dependency-free. Atomic, testable helpers.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, basename, isAbsolute } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = "https://api.kie.ai/api/v1";
const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload";

// --- env loader: real process env first (servers/containers), then .env file if present ---
export function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, "");
        if (v) env[m[1]] = v; // non-empty .env values override process env
      }
    }
  } catch {
    /* no .env file — rely on process env (e.g. server-set ANTHROPIC_API_KEY / KIE_AI_API_KEY) */
  }
  return env;
}

function key() {
  const k = loadEnv().KIE_AI_API_KEY;
  if (!k) throw new Error("KIE_AI_API_KEY missing from .env");
  return k;
}

function auth() {
  return { Authorization: `Bearer ${key()}` };
}

// Create one NanoBanana text-to-image task. Returns taskId.
export async function createImageTask({ prompt, imageSize = "9:16", outputFormat = "png" }) {
  const res = await fetch(`${BASE}/jobs/createTask`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/nano-banana",
      input: { prompt, output_format: outputFormat, image_size: imageSize },
    }),
  });
  const json = await res.json();
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`createTask failed: HTTP ${res.status} — ${JSON.stringify(json)}`);
  }
  return json.data.taskId;
}

// Create one NanoBanana EDIT task (image-to-image with reference images). Returns taskId.
// imageUrls must be PUBLIC URLs (up to 10). Used for character consistency + product context.
export async function createEditTask({ prompt, imageUrls, aspectRatio = "9:16", outputFormat = "png" }) {
  if (!imageUrls?.length) throw new Error("createEditTask requires at least one image URL");
  const res = await fetch(`${BASE}/jobs/createTask`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/nano-banana-edit",
      input: { prompt, image_urls: imageUrls, output_format: outputFormat, aspect_ratio: aspectRatio },
    }),
  });
  const json = await res.json();
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`createEditTask failed: HTTP ${res.status} — ${JSON.stringify(json)}`);
  }
  return json.data.taskId;
}

// Upload a base64/data-URL image to Kie.ai, returns a public URL (kept ~3 days). Free.
export async function uploadBase64({ data, uploadPath = "slideshowagent", fileName }) {
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data: data, uploadPath, fileName }),
  });
  const json = await res.json();
  const url = json.data?.downloadUrl;
  if (!json.success && json.code !== 200) throw new Error(`upload failed: ${JSON.stringify(json)}`);
  if (!url) throw new Error(`upload returned no downloadUrl: ${JSON.stringify(json)}`);
  return url;
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"]);

// Extract a single representative frame (~0.5s in) from a video for use as a style reference.
export function extractFrame(absVideoPath, outPng) {
  execFileSync("ffmpeg", ["-y", "-ss", "0.5", "-i", absVideoPath, "-frames:v", "1", outPng], {
    stdio: "ignore",
  });
  return outPng;
}

// Turn a reference into a public URL. Pass-through if already http(s); otherwise upload the local file.
// A local VIDEO is first reduced to a single style frame via ffmpeg.
// `localBase` is the dir that relative paths resolve against (defaults to ROOT).
export async function resolveRefToUrl(ref, { localBase = ROOT, uploadPath = "slideshowagent/refs" } = {}) {
  if (/^https?:\/\//i.test(ref)) return ref;
  let abs = isAbsolute(ref) ? ref : join(localBase, ref);
  if (VIDEO_EXT.has(extname(abs).toLowerCase())) {
    const frame = abs.replace(/\.[^.]+$/, "") + ".styleframe.png";
    extractFrame(abs, frame);
    abs = frame;
  }
  const mime = MIME[extname(abs).toLowerCase()];
  if (!mime) throw new Error(`unsupported reference type "${ref}" (use png/jpg/webp image or mp4/mov/webm video)`);
  const b64 = readFileSync(abs).toString("base64");
  return uploadBase64({ data: `data:${mime};base64,${b64}`, uploadPath, fileName: basename(abs) });
}

// Poll a task until it succeeds; returns the result image URL.
export async function pollImage(taskId, { tries = 36, everyMs = 5000, onTick } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/jobs/recordInfo?taskId=${taskId}`, { headers: auth() });
    const json = await res.json();
    const state = json.data?.state;
    if (state === "success") return JSON.parse(json.data.resultJson).resultUrls[0];
    if (state === "fail") throw new Error(`generation failed: ${JSON.stringify(json.data)}`);
    onTick?.(state, i + 1, tries);
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`timed out waiting for task ${taskId}`);
}

// Download a URL to an absolute path (creates parent dirs). URLs expire in 24h — call promptly.
export async function downloadTo(url, absPath) {
  mkdirSync(dirname(absPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(absPath, buf);
  return absPath;
}
