# SOP — Generate a UGC Slideshow

> Golden Rule: if the logic changes, update THIS SOP before the code.

## Goal
Turn a text topic into a UGC-style slideshow: NanoBanana images assembled by Remotion,
previewed in Remotion Studio.

## Inputs
- `topic` (required), optional `numScenes` (default 5), `aspectRatio` (default 9:16), `style`.
- `captionStyle` — `pill` (default) | `subtitle` | `highlight` | `minimal`. Implemented in
  `slideshow/src/Slideshow.tsx`. **Offer the user the choices** (render previews if helpful) and
  accept a custom style they describe (add it as a new variant in code).
- Optional `referenceImages` (each a local path under `.tmp/<jobId>/`, auto-uploaded, or a public URL):
  - `style` — an **image OR video** giving the overall look ("make it in this style"); a video is
    auto-reduced to one frame. Matched on EVERY scene.
  - `character` — a person to keep identical across all slides.
  - `product` — a product/context image. Featured ONLY on scenes the agent flags `useProduct:true`
    (the slides that explain the product/solution). Off by default — do NOT put it on every slide.

## Character consistency (core rule)
A single **character anchor** is reused for every scene so the person never changes:
- **Mode A — character image supplied:** that image anchors ALL scenes (uploaded once).
- **Mode B — no character image:** scene 1 is generated text→image, and its output becomes the
  anchor for scenes 2..N. The anchor is FIXED (we do not re-chain each scene's output → no drift).
Scenes that have a reference use `google/nano-banana-edit` with `image_urls`; the generator
prepends explicit "keep this person / this product identical" instructions automatically.
The per-scene `imagePrompt` should still repeat the full subject + setting description (helps
both the text-only scene 1 and the edit prompts).

## Steps (Navigation order)
1. **Plan scenes (agent reasoning).** Expand the topic into a scene script following the
   Data Schema in `CLAUDE.md`. For each scene write:
   - `caption` — short, first-person UGC text overlay (POV/step/result voice).
   - `imagePrompt` — full NanoBanana prompt. **Carry the same subject + setting description
     verbatim across all scenes** (consistency rule). Include realism keywords; avoid AI tells
     (see `nanobanana-api.md`). Default ~5 scenes, ~3s each, final scene ~4s.
   - Set `referenceImages` if the user gave a character/product image; set `useProduct:false`
     on any scene that should NOT show the product. Default ~5 scenes, ~3s each, final ~4s.
   Write to `.tmp/<jobId>/script.json`.
2. **Validate.** `node execution/validate-script.mjs <jobId>` — confirms schema + reports timeline.
3. **HARD GATE — approval.** Show the user the script (captions + image prompts + total length).
   Do NOT generate images until they approve. No API spend without sign-off.
4. **Generate images.** `node execution/generate-images.mjs <jobId>` — creates + downloads PNGs to
   `slideshow/public/<jobId>/`, writes `scene.image` paths back into `script.json`.
5. **Assemble + preview.** Point the Remotion `<Slideshow>` composition at `script.json` and open
   Studio: `node execution/open-studio.mjs <jobId>` (or `cd slideshow && npm run dev`).
   Done = Studio runs showing the slideshow. User renders the MP4 themselves.

## Edge cases / lessons
- NanoBanana URLs expire in 24h → always download immediately (generate-images does this).
- Rate limit 20 req / 10s → tasks are created sequentially; if you batch, throttle.
- If a scene image looks off, regenerate ONLY that scene (re-run with a single-scene script) to
  save credits — never regenerate the whole set.
- Keep captions short enough to fit 9:16 safe area (~2 lines).
