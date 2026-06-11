# Findings — slideshowagent

Research, discoveries, and constraints. Logged during Phase B (Research) and Phase L.

## Phase L — Link

- **NanoBanana is called via Kie.ai, not the `nanobnana.com` provider.**
  The QuickAds `.env` carries both `NANOBANANA_API_KEY`/`NANOBANANA_BASE_URL`
  (`https://nanobnana.com/`) AND `KIE_AI_API_KEY`. The actual working code
  (`quickads-demo/generate-video.ts`) uses **Kie.ai**:
  - `KIE_AI_API_KEY` @ `https://api.kie.ai/api/v1`
  - Create: `POST /jobs/createTask` body `{ model: "google/nano-banana", input: { prompt, output_format, image_size } }`, header `Authorization: Bearer {KIE_AI_API_KEY}`
  - Poll: `GET /jobs/recordInfo?taskId=...` → `data.state` in waiting|generating|success|fail
  - Result URL: `JSON.parse(data.data.resultJson).resultUrls[0]` (URLs expire in 24h — download immediately)
  - The `nanobnana.com` keys look legacy/unused. **Decision: use Kie.ai.**

- **Rate limits:** max 20 req / 10s; HTTP 429 = back off. Images ready in ~5–15s.

- **Reference images (edit model):** `google/nano-banana-edit` takes `input.image_urls`
  (PUBLIC URLs only, up to 10, ≤10MB, jpg/png/webp) + `prompt` + `aspect_ratio`. A prior
  NanoBanana result URL works directly as a reference (valid 24h) → used to chain the character anchor.
- **Local image upload:** `POST https://kieai.redpandaai.co/api/file-base64-upload`
  (⚠️ NOT `api.kie.ai` — that 404s), body `{base64Data, uploadPath, fileName}`, Bearer auth,
  returns `data.downloadUrl`. Free, files kept ~3 days.

- **Realism keywords (from video-generation skill):** include
  `photorealistic, shot on Sony A7III, 35mm lens, shallow depth of field, natural lighting, film grain, candid unposed`;
  avoid `4K, stunning, beautiful, vibrant, 3D, rendered`. Fits the authentic-UGC rule.
