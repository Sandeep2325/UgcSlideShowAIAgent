# Progress — slideshowagent

What was done, errors hit, tests run, results.

- **2026-06-11 — Phase B (Blueprint):** 5 discovery questions answered, Data Schema defined, Blueprint APPROVED. Execution unlocked.
- **2026-06-11 — Phase L (Link):**
  - Created `.env` with `KIE_AI_API_KEY` (primary; NanoBanana via Kie.ai) + legacy nanobnana keys.
  - Resolved provider ambiguity → use Kie.ai (matches working QuickAds code). See findings.md.
  - Built `execution/probe-nanobanana.mjs` (dependency-free handshake).
  - **Ran probe → 🟢 LINK GREEN.** createTask OK (taskId 8a2fc844…), image returned in ~10s. Key valid, endpoint live.
  - Remotion = local npm package, no credential; set up in Phase A.
- **2026-06-11 — Phase A (Architect), part 1 (Tools + SOPs):**
  - `execution/lib/kie.mjs` — shared NanoBanana client (loadEnv, createImageTask, pollImage, downloadTo).
  - `execution/validate-script.mjs` — deterministic schema validator/normalizer. ✅ tested on sample (5 scenes / 16.0s).
  - `execution/generate-images.mjs` — generates+downloads images for an approved script (built, NOT yet run — hard gate).
  - SOPs: `architecture/generate-slideshow.md`, `architecture/nanobanana-api.md`.
  - Sample `.tmp/sample-glow-routine/script.json` created for format review.
  - **Remotion app scaffolding HELD** pending user confirmation of the scene-script format.
- **2026-06-11 — Format approved → Phase A part 2 (Remotion app):**
  - Scaffolded `slideshow/` (Remotion 4.0.290, React 19): package.json, tsconfig, remotion.config, src/.
  - `Slideshow.tsx` — TransitionSeries (fade crossfades), Ken Burns zoom, Inter caption pills, image-or-placeholder.
  - `Root.tsx` — 1080×1920 @30fps, duration = scenes − overlaps; reads `active-script.json`.
  - `execution/open-studio.mjs` (copies job script → active) + `execution/run.mjs` (navigation orchestrator).
  - `npm install` OK (214 pkgs). **Verified:** `remotion compositions` → Slideshow 1080×1920 420f/14s;
    `remotion still --frame=200` rendered a correct 9:16 frame (caption pill + placeholder).
  - Added `.gitignore`, `README.md`.
  - **Phase A COMPLETE.** Ready for first real job (needs a topic + approval before image generation).
- **2026-06-11 — Feature: character consistency + reference/product images:**
  - Researched Kie.ai: `google/nano-banana-edit` (input `image_urls` public URLs, up to 10, `aspect_ratio`)
    + base64 upload `POST https://kieai.redpandaai.co/api/file-base64-upload` → `data.downloadUrl`.
  - lib/kie.mjs: added `createEditTask`, `uploadBase64`, `resolveRefToUrl` (local→public URL).
  - generate-images.mjs rewritten: ONE fixed character anchor (user image, or scene-1 output) reused via
    edit model for every scene; product ref injected per scene (skip with `useProduct:false`).
  - Schema (CLAUDE.md) + SOPs + validate-script updated; Remotion app unchanged (filenames identical).
  - **Lesson (self-heal):** upload host is `kieai.redpandaai.co`, NOT `api.kie.ai` (404). SOP corrected.
  - **VERIFIED end-to-end** with `.tmp/consistency-test` (matcha can): uploaded local product → 3 scenes,
    SAME woman + SAME can across slides; real images render in Remotion with Ken Burns + captions. ✅
- **2026-06-11 — Refinements (product scope, caption styles, style ref):**
  - Product now shown ONLY on scenes with `useProduct:true` (default flipped to false) — for product/solution slides.
  - Added 4 caption styles in Slideshow.tsx: `pill` (default), `subtitle` (CapCut outline), `highlight`
    (purple marker), `minimal` (lower-left). Selected via `script.captionStyle`. Custom styles added on request.
  - Added `referenceImages.style` — an image OR video for overall aesthetic; video auto-reduced to one
    frame via ffmpeg (`extractFrame`), applied to every scene. lib: `resolveRefToUrl` handles video.
  - Rendered previews of all 4 caption styles over a real image to verify (all distinct, look good). ✅
  - Schema + SOP + validate-script updated. User picked **minimal** as default caption style (set as
    code fallback). Custom caption style still PENDING — user will describe it later.
- **2026-06-11 — First real job: `derma-kojic-facewash` (The Derma Co 1% Kojic Acid Face Wash):**
  - 6 educational slides, 25s, minimal captions. Product (CDN tube image URL) on slides 3-6 only;
    consistent presenter across all 6 (Mode B, scene 1 = anchor). Approved via hard gate before gen.
  - Generated 6 images — character + product held consistent. Rendered full MP4:
    `slideshow/out/derma-kojic-facewash.mp4` (1080×1920, 675 frames, 28.4 MB). ✅ End-to-end pipeline proven.
- **2026-06-12 — Phase T: shareable standalone agent (`slideshow-agent.mjs`):**
  - Autonomous CLI using `@anthropic-ai/sdk` (0.69) + `claude-opus-4-8`. The planning "brain" is one
    forced-tool structured call (`emit_script`) that reads the two SOPs as a CACHED system prompt and
    returns the scene script; deterministic execution/ tools then generate + assemble.
  - Flags: --url (fetch product page), --product/--character/--style refs, --captions, --scenes, --yes, --render.
    Keeps the HARD GATE (prints script, readline y/N) unless --yes.
  - Root `package.json` + SDK installed. `.env` gains `ANTHROPIC_API_KEY` (placeholder — user must fill).
  - Verified arg-parsing + missing-key guard paths. Full end-to-end run BLOCKED until ANTHROPIC_API_KEY set.
  - README updated with a team "Quick start" + "Sharing" section (plain Node CLI, no Claude Code needed).
- **2026-06-12 — One-click launcher (`make-slideshow.command`):** double-clickable macOS launcher for
  non-technical teammates. Runs first-time npm installs if missing, prompts for the Claude API key once
  (writes to .env via awk), asks for topic + slide count, runs the agent. chmod +x; syntax + key-write
  logic verified. This is the recommended entry point for the user, who found the raw CLI/SDK confusing.
- **2026-06-12 — Python integration (`slideshow.py`) + agent `--json` mode:**
  - User wants to call it from an existing Python project (function import) on a server/container.
  - Added `--json` mode to slideshow-agent.mjs: non-interactive, human logs → stderr, single JSON result
    on stdout (jobId, scriptPath, scenes[], images[], video, studioCommand). Child step output routed to stderr.
  - Made `loadEnv` server-friendly: reads real process.env first, .env file optional (non-empty overrides).
  - `slideshow.py`: `make_slideshow(topic, *, scenes, captions, product, character, style, render,
    project_dir, env, timeout)` → subprocess to the Node agent, returns parsed dict; `SlideshowError` on fail.
  - **VERIFIED end-to-end from Python** with the user's real ANTHROPIC_API_KEY: `make_slideshow('cozy oat
    milk latte...', scenes=3, render=True)` → 3 consistent images + 12 MB MP4, clean dict returned. ✅
  - README: "Use from Python" + server/container deploy notes (Node 18+, headless-chrome libs, env-var creds).
- **2026-06-12 — Cross-machine install (`install.sh`):** one-command installer (macOS/Linux) — checks
  Node ≥18, runs both npm installs, prompts for ANTHROPIC_API_KEY + KIE_AI_API_KEY (awk-writes .env).
  README "Install on another computer" added: zip-without-node_modules/.env transfer (or git), then
  `bash install.sh`. Syntax + key-write logic verified.
- **2026-06-12 — pip-installable package (`slideshowagent`):** proper Python package via hatchling.
  `pyproject.toml` + `src/slideshowagent/` (`__init__`, `_core`, `__main__`). `make_slideshow(...)`,
  `runtime_dir()`, console script `slideshowagent`. The Node runtime (slideshow-agent.mjs, execution/,
  architecture/, slideshow/src+config) is force-included into the wheel under `slideshowagent/_runtime/`;
  on first wheel-run it copies to ~/.slideshowagent/ + npm-installs. Resolution order: SLIDESHOWAGENT_DIR
  → repo (editable) → bundled cache. **Verified:** `pip install -e .` import+API+CLI+runtime_dir ✅;
  wheel build bundles the full _runtime tree ✅. (Clean-venv wheel first-run render not re-run to save
  credits — same subprocess path already proven end-to-end.) .gitignore updated for build artifacts.
