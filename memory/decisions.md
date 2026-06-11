# Decisions — slideshowagent

Architectural choices and the reason behind each.

- **2026-06-11** — Project created fresh in its own directory (not inside the QuickAds Remotion project) to keep the B.L.A.S.T. scaffold isolated from existing work.
- **2026-06-11** — Character consistency uses a SINGLE FIXED anchor image (user-supplied character image, or scene 1's output) referenced by `google/nano-banana-edit` for every scene — rather than re-chaining each scene's output into the next. Reason: a fixed anchor prevents identity drift across a long slideshow; chaining compounds small changes scene-to-scene.
- **2026-06-11** — Reference images must be public URLs for the edit model, so local product/character files are auto-uploaded via Kie.ai's free base64 upload (host `kieai.redpandaai.co`). Reason: keeps the user workflow to "just give a file path" while satisfying the API's URL-only constraint.
