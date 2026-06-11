# Task Plan — slideshowagent

> Status: **BLUEPRINT NOT YET APPROVED** — execution halted per Protocol 0.

## Phases (B.L.A.S.T.)
- [x] **B — Blueprint** — 5 discovery questions answered, Data Schema defined, APPROVED
- [x] **L — Link** — NanoBanana (Kie.ai) probe 🟢 GREEN; .env set; Remotion has no credential
- [x] **A — Architect** — SOPs ✓, Navigation (run.mjs) ✓, Tools ✓, Remotion app ✓ verified (bundles + renders)
- [~] **S — Stylize** — composition styled (9:16, Inter captions, Ken Burns, crossfades); per-job verify via `remotion still`/Studio
- [~] **T — Trigger** — manual command trigger (`run.mjs <jobId> <step>`); self-healing loop = SOP update on failure

## Blueprint discovery (Phase B)
1. North Star — Generate UGC-style slideshow videos: NanoBanana generates the images, which are assembled into a short slideshow video.
2. Integrations + credentials — NanoBanana (image gen) + Remotion (assembly). NanoBanana key reused from QuickAds RemotionCluade/.env. No voiceover/captions/music for v1.
3. Source of Truth — A text prompt/topic. Agent expands topic -> per-scene descriptions/captions -> NanoBanana image prompts.
4. Delivery Payload — Agent generates images + Remotion composition, then opens Remotion Studio for preview/tweak. "Complete" = Studio runs with a working slideshow wired to generated assets (user renders MP4 themselves).
5. Behavioral Rules — HARD GATE: show scene script + NanoBanana prompts for approval BEFORE generating (no API spend without sign-off). Defaults: 9:16 vertical, authentic phone-shot UGC look, subject/lighting consistency across slides; all overridable per job.

## Approved Blueprint
_None yet._
