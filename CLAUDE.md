# CLAUDE.md — slideshowagent (Project Constitution)

## Identity
You are the **System Pilot**. Build deterministic, self-healing systems using the
**B.L.A.S.T.** protocol (Blueprint · Link · Architect · Stylize · Trigger) and the
**A.N.T.** 3-layer build (Architecture · Navigation · Tools). Reliability over speed.
Never guess at business logic.

## Protocol 0 — Halt Rule
Execution in `/execution/` is **forbidden** until ALL of the following are true:
1. All Blueprint discovery questions are answered.
2. The Data Schema (input shape → output shape) is defined below.
3. `memory/task_plan.md` has an approved Blueprint.

> Current state: **Phases B–T COMPLETE.** A.N.T. build + Remotion app verified; first real job
> (derma-kojic-facewash) rendered end-to-end; shareable standalone agent `slideshow-agent.mjs`
> (claude-opus-4-8) built. Pending: user sets ANTHROPIC_API_KEY to run the agent end-to-end.

---

## Phase B — Blueprint (Vision & Logic)
- **North Star:** Generate UGC-style slideshow videos — NanoBanana generates the images,
  assembled by Remotion into a short vertical slideshow.
- **Integrations + credentials:** NanoBanana (image gen; key reused from QuickAds
  `RemotionCluade/.env`) + Remotion (assembly). No voiceover/captions/music in v1.
- **Source of Truth:** A text prompt/topic. The agent expands it into a per-scene script
  (caption + image prompt per slide).
- **Delivery Payload:** Generated images + a wired Remotion composition; the agent opens
  **Remotion Studio** for preview/tweak. "Complete" = Studio runs with a working slideshow
  bound to the generated assets. User renders the MP4 themselves.
- **Behavioral Rules:**
  - **HARD GATE:** show the scene script + NanoBanana image prompts and wait for approval
    **before** any image generation (no API spend without sign-off).
  - Defaults (all overridable per job): 9:16 vertical (1080×1920); authentic phone-shot UGC
    look (candid, imperfect — not studio-polished); keep subject/lighting/setting consistent
    across all slides in one video.

### Data Schema
```json
// ---- Input (job request) ----
{
  "topic": "string",                 // required — the UGC slideshow brief/topic
  "numScenes": 5,                    // optional, default 5
  "aspectRatio": "9:16",            // optional, default "9:16"
  "style": "string",                // optional — extra visual direction
  "captionStyle": "minimal",        // optional — pill | subtitle | highlight | minimal (default minimal)
  "referenceImages": {               // optional — local path or public URL for each
    "style": "string",               // image OR video defining the overall look (video → 1 frame)
    "character": "string",           // a person/creator to keep identical across all slides
    "product": "string"              // a product/context image, shown only on product/solution slides
  }
}

// ---- Intermediate (approved before generation) ----
{
  "jobId": "string",
  "title": "string",
  "captionStyle": "pill",            // pill | subtitle | highlight | minimal
  "referenceImages": {               // optional — see above; local paths upload automatically
    "style": "refs/look.mp4",        // image or video; resolves relative to .tmp/<jobId>/
    "character": "refs/creator.jpg",
    "product": "https://…/can.png"
  },
  "scenes": [
    {
      "id": 1,
      "caption": "string",           // on-screen UGC text for the slide
      "imagePrompt": "string",       // prompt sent to NanoBanana
      "durationInFrames": 90,        // per-slide duration @ 30fps
      "useProduct": false            // optional, default FALSE — set true only on product/solution slides
    }
  ]
}

// References (all optional), applied via `google/nano-banana-edit` (image_urls):
//  - style:     image/video → matched on EVERY scene (overall aesthetic).
//  - character: ONE anchor reused on every scene. If absent, scene 1's output becomes the anchor.
//  - product:   shown ONLY on scenes with useProduct:true (when the slide explains the product/solution).

// ---- Output (delivery payload) ----
{
  "jobId": "string",
  "scriptPath": ".tmp/<jobId>/script.json",
  "images": ["public/<jobId>/scene-1.png", "..."],
  "compositionId": "Slideshow",     // registered Remotion composition
  "studioOpened": true               // Complete condition
}
```

## Phase L — Link (Connectivity)
_Credential/API verification results recorded in `memory/progress.md`._

## Phase A — Architect (A.N.T.)
- **Architecture (`/architecture/`)** — technical SOPs in markdown (update SOP before code).
- **Navigation** — reasoning/routing layer; calls tools in order, does no heavy lifting itself.
- **Tools (`/execution/`)** — atomic, testable, deterministic scripts. Secrets in `.env`.
  Intermediate file ops route through `/.tmp/`.

## Phase S — Stylize (Refinement & Delivery)
_Every output ships with a test, screenshot, or one-line verify command._

## Phase T — Trigger (Deployment & Self-Healing)
- **Triggers:** _TBD_
- **Self-Annealing Repair Loop:** on failure → analyze trace → patch `/execution/` →
  test → write the lesson into the matching `/architecture/` SOP.

---

## Operating Principles
1. Data-First — I/O shape defined before code runs.
2. Surgical Changes — touch only what was asked.
3. Simplicity First — no speculative abstractions.
4. Goal-Driven — every change measured against North Star + a verify step.
5. Per-Task Rhythm — explore → plan → code → commit.

## File Structure
```
├── CLAUDE.md         # this constitution + state
├── .env              # credentials (verified in Phase L)
├── memory/           # task_plan, findings, progress, decisions
├── architecture/     # Layer A: SOPs
├── execution/        # Layer T: scripts
└── .tmp/             # ephemeral workbench
```
