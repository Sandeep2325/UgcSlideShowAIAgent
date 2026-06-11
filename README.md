# UGC Slideshow AI Agent

Turn a text topic into a finished **UGC-style slideshow video** — automatically.
The agent plans the scenes with Claude, generates the visuals with NanoBanana, and assembles a
vertical (9:16) slideshow with Remotion (Ken Burns motion, captions, crossfades).

**Repo:** https://github.com/Sandeep2325/UgcSlideShowAIAgent

```python
from slideshowagent import make_slideshow

result = make_slideshow("glowy morning skincare routine", scenes=6, render=True)
print(result["video"])   # → path to the rendered .mp4
```

---

## Install

```bash
pip install "git+https://github.com/Sandeep2325/UgcSlideShowAIAgent.git"
```

**Two prerequisites on the machine:**

1. **Node.js 18+** — the video engine (Remotion) is Node-based, so this is required even when you
   call it from Python. Install from https://nodejs.org. *(The package bundles all the Node code and
   runs `npm install` for you on first use — you don't manage it.)*
2. **Two API keys.** Pass them **straight to the function** (easiest):
   ```python
   make_slideshow("your topic",
                  anthropic_api_key="sk-ant-...",   # console.anthropic.com  (plans the scenes)
                  kie_api_key="...")                # kie.ai                 (NanoBanana images)
   ```
   …or set them as environment variables (`ANTHROPIC_API_KEY`, `KIE_AI_API_KEY`) or in a `.env` file.
   Keys passed to the function take priority. **Don't hard-code keys in committed source** — read
   them from your own config/secrets and pass the values in.

> First call after install copies the bundled Node runtime to `~/.slideshowagent/` and runs
> `npm install` there once (~1 min). Override with `SLIDESHOWAGENT_CACHE`, or point at an existing
> checkout with `SLIDESHOWAGENT_DIR`.

---

## Use from Python

```python
from slideshowagent import make_slideshow

result = make_slideshow(
    "kojic acid face wash for dark spots",
    scenes=6,
    captions="minimal",                # pill | subtitle | highlight | minimal
    product="https://.../tube.png",    # local path or URL — shown only on product/solution slides
    character=None,                    # optional: keep the same person across every slide
    style=None,                        # optional: match a look (image OR video, path or URL)
    render=True,                       # True → render the mp4; False → just generate + wire Studio
    anthropic_api_key="sk-ant-...",    # or set ANTHROPIC_API_KEY env var
    kie_api_key="...",                 # or set KIE_AI_API_KEY env var
)

print(result["video"])                 # absolute path to the .mp4 (None if render=False)
for s in result["scenes"]:
    print(s["id"], s["caption"], s["image"])
```

**Signature**

```python
make_slideshow(topic, *, scenes=6, captions="minimal", product=None, character=None,
               style=None, render=True, anthropic_api_key=None, kie_api_key=None,
               env=None, timeout=1800) -> dict
```

**Returns** `{jobId, topic, title, captionStyle, scriptPath, scenes[], images[], video, studioCommand}`.
Raises `SlideshowError` on failure (the message includes the underlying error output).

## Use from the command line

The package also installs a `slideshowagent` command:

```bash
slideshowagent "cozy oat milk latte for fall mornings" --scenes 4
slideshowagent "kojic acid face wash" --product ./tube.png --captions subtitle --json
```

| Option | Meaning |
|---|---|
| `--scenes <n>` | number of slides (default 6) |
| `--captions <style>` | `pill` · `subtitle` · `highlight` · `minimal` (default minimal) |
| `--product <path\|url>` | product image — shown only on product/solution slides |
| `--character <path\|url>` | keep the same person across every slide |
| `--style <path\|url\|mp4>` | match an overall look (image or video) |
| `--no-render` | skip the MP4 render (just generate + wire Remotion Studio) |
| `--json` | print the full result as JSON |

---

## Running on a server / container

- Install **Node.js 18+**; the package handles its own `npm install` on first run.
- Remotion downloads a headless Chrome shell on first render. On slim Linux images, install its libs:
  `libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1
  libxfixes3 libxrandr2 libgbm1 libasound2`.
- Provide credentials as **environment variables** (no `.env` file needed — the loader reads real
  env vars), or pass `env={...}` to `make_slideshow`.
- Each call renders synchronously (~1–3 min for 6 slides). In a web backend, run `make_slideshow`
  in a **background worker** (Celery / RQ / FastAPI `BackgroundTasks`) rather than blocking the request.

---

## Develop from a checkout

```bash
git clone https://github.com/Sandeep2325/UgcSlideShowAIAgent.git
cd UgcSlideShowAIAgent
bash install.sh            # checks Node, runs both npm installs, asks for the two API keys
pip install -e .           # optional: editable install of the Python package
```

Other entry points (same pipeline, no Python needed):

- **Node CLI:** `node slideshow-agent.mjs "your topic" --scenes 6`
- **Double-click (macOS):** `make-slideshow.command` — prompts for a topic and runs it.
- **`slideshow.py`** at the repo root: the same `make_slideshow(...)` API for running straight from a
  source checkout without installing the package.

The agent always shows the planned script and **waits for approval before spending API credits**
(the Python/CLI paths auto-approve via `--yes`/`render`).

---

## How it works

```
topic ─► Claude (claude-opus-4-8) plans scenes ─► NanoBanana generates images ─► Remotion renders mp4
         (caption + image prompt per slide)        (consistent character/product)   (9:16, captions, motion)
```

- **Character consistency:** one anchor image (yours, or scene 1's output) is reused on every slide.
- **Product/context image:** injected only on the slides that explain the product.
- **Style reference:** an image or video whose look is matched across all slides (video → 1 frame).

### Manual pipeline (advanced)

```bash
node execution/run.mjs <jobId> validate     # check the scene script
node execution/run.mjs <jobId> generate     # NanoBanana images → slideshow/public/<jobId>/
node execution/run.mjs <jobId> studio       # wire the Remotion composition
cd slideshow && npm run dev                  # preview in Remotion Studio
cd slideshow && npm run render               # → slideshow/out/video.mp4
```

## Layout

```
slideshow-agent.mjs   the Node agent (topic → script → approve → generate → Studio/render)
slideshow.py          Python API for source checkouts
src/slideshowagent/   the pip package (make_slideshow, CLI) — bundles the Node runtime in the wheel
execution/            tools: run · validate-script · generate-images · open-studio · probe · lib/kie
architecture/         SOPs the agent reads as its brief (generate-slideshow, nanobanana-api)
slideshow/            Remotion app (9:16, Ken Burns + captions + crossfades)
CLAUDE.md, memory/    project constitution + working notes (built with the B.L.A.S.T. protocol)
```

## Credentials & safety

`.env` (git-ignored) or environment variables hold `ANTHROPIC_API_KEY` and `KIE_AI_API_KEY` — keys are
never committed. Verify NanoBanana connectivity any time with `node execution/probe-nanobanana.mjs`.
