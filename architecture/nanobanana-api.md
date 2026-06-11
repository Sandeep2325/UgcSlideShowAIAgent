# SOP — NanoBanana API (via Kie.ai)

> Verified live 2026-06-11 (Phase L probe, LINK GREEN).

## Auth & endpoint
- `KIE_AI_API_KEY` in `.env` (NOT the legacy `NANOBANANA_API_KEY`/`nanobnana.com` keys — those are unused).
- Base: `https://api.kie.ai/api/v1`
- Header: `Authorization: Bearer {KIE_AI_API_KEY}`

## Create task
`POST /jobs/createTask`
```json
{ "model": "google/nano-banana",
  "input": { "prompt": "…", "output_format": "png", "image_size": "9:16" } }
```
- `image_size`: `1:1 9:16 16:9 3:4 4:3 3:2 2:3 5:4 4:5 21:9 auto`
- `prompt` max 5000 chars.
- Response: `{ code: 200, data: { taskId } }`

## Poll
`GET /jobs/recordInfo?taskId={id}` → `data.state`: `waiting | generating | success | fail`.
- On success: `JSON.parse(data.resultJson).resultUrls[0]` is the PNG URL.
- Poll every 5s; images usually ready in 5–15s; timeout ~3 min.
- **URLs expire in 24h — download immediately.**

## Edit model (reference images → character consistency + product context)
`POST /jobs/createTask`
```json
{ "model": "google/nano-banana-edit",
  "input": { "prompt": "…", "image_urls": ["https://…ref1", "https://…ref2"],
             "output_format": "png", "aspect_ratio": "9:16" } }
```
- `image_urls`: **public URLs only** (not base64/local), up to 10, ≤10MB, jpeg/png/webp.
- Same poll + result extraction as the text model.
- A prior NanoBanana output URL works directly as a reference (valid 24h) — used to chain the
  character anchor across scenes.

## Upload a local image → public URL (free, kept ~3 days)
`POST https://kieai.redpandaai.co/api/file-base64-upload`
> ⚠️ Host is `kieai.redpandaai.co`, NOT `api.kie.ai` (that path 404s). Verified 2026-06-11.
```json
{ "base64Data": "data:image/png;base64,…", "uploadPath": "slideshowagent/refs", "fileName": "x.png" }
```
- Returns `data.downloadUrl` (the public URL). Used to host user-supplied product/character images.

## Limits
- 20 requests / 10s; HTTP 429 = back off.

## Realism keywords (UGC look)
- Include: `photorealistic, shot on iPhone / Sony A7III, natural window light, 35mm, shallow depth of field, film grain, candid, unposed, authentic, imperfect`.
- Avoid (AI tells): `4K, stunning, beautiful, vibrant, 3D, rendered, digital art`.
- Consistency: repeat the FULL subject + setting description in every scene's prompt — never "the same person as before".

## Code
All of the above is implemented in `execution/lib/kie.mjs` (`createImageTask`, `pollImage`, `downloadTo`).
