# slideshowagent

Generate UGC-style slideshow videos: a text topic → NanoBanana images → a Remotion
slideshow you preview in Studio and render to MP4.

Built with the **B.L.A.S.T.** protocol. See `CLAUDE.md` (constitution) and `memory/` (state).

## Quick start (the agent — for everyone)

One command turns a topic into a finished slideshow. The agent plans the scenes, shows them
for approval, generates the images, and opens Remotion Studio.

```bash
# one-time setup
npm install                    # installs the agent's Anthropic SDK
cd slideshow && npm install && cd ..   # installs Remotion
# add ANTHROPIC_API_KEY and KIE_AI_API_KEY to .env

# make a slideshow
node slideshow-agent.mjs "glowy morning skincare routine for oily skin"

# from a product page, with the product image on the solution slides
node slideshow-agent.mjs "kojic acid face wash for dark spots" \
  --url https://thedermaco.com/products/...                    \
  --product ./tube.png --scenes 6

# all options
#   --url <productUrl>      fetch real product details to ground the script
#   --product <path|url>    product image — shown only on product/solution slides
#   --character <path|url>  keep the same person across every slide
#   --style <path|url|mp4>  match an overall look (image or video)
#   --captions <pill|subtitle|highlight|minimal>   default: minimal
#   --scenes <n>            default: 6
#   --yes                   skip the approval gate
#   --render                render the MP4 instead of opening Studio
```

The agent always shows the script and **waits for your approval before spending any API credits.**

## Use from Python (pip package)

Install it like any Python package, then import one function. **Node.js 18+ must be installed** on
the machine (the video engine, Remotion, is Node-based) — but the package ships all the Node code and
installs its dependencies automatically on first use.

```bash
# build a wheel from this repo …
pip install build && python -m build --wheel        # → dist/slideshowagent-1.0.0-py3-none-any.whl
# … then install it anywhere
pip install slideshowagent-1.0.0-py3-none-any.whl

# or, from a clone of the repo (editable):
pip install -e .

# or straight from git once pushed:
pip install "git+https://github.com/<you>/slideshowagent.git"
```

```python
from slideshowagent import make_slideshow

result = make_slideshow(
    "kojic acid face wash for dark spots",
    scenes=6,
    captions="minimal",
    product="https://.../tube.png",   # local path or URL; shown only on product slides
    render=True,                       # render the mp4 (False = just generate + wire Studio)
    env={"ANTHROPIC_API_KEY": "...", "KIE_AI_API_KEY": "..."},  # or set as real env vars
)

print(result["video"])    # absolute path to the .mp4
for s in result["scenes"]:
    print(s["id"], s["caption"], s["image"])
```

There's also a CLI: `slideshowagent "your topic" --scenes 6` (installed with the package).

> First call after a wheel install copies the bundled Node runtime to `~/.slideshowagent/` and runs
> `npm install` there (one-time, ~1 min). Override that location with `SLIDESHOWAGENT_CACHE`, or point
> at an existing project with `SLIDESHOWAGENT_DIR`.

> `slideshow.py` in the repo root is the same API for running directly from a source checkout, without
> installing the package. Both expose `make_slideshow(...)`.

`make_slideshow(topic, *, scenes=6, captions="minimal", product=None, character=None, style=None,
render=True, project_dir=None, env=None, timeout=1800)` → returns
`{jobId, topic, title, captionStyle, scriptPath, scenes[], images[], video, studioCommand}`.
Raises `SlideshowError` on failure (message includes the agent's stderr).

### Running on a server / container
- Install **Node.js 18+**, then in the project run `npm install` (root) and `npm install` in `slideshow/`.
- Remotion downloads a headless Chrome shell on first render; on slim Linux images install its libs
  (e.g. `libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2`).
- Provide credentials as **environment variables** `ANTHROPIC_API_KEY` and `KIE_AI_API_KEY`
  (no `.env` needed — the loader reads real env vars), or pass `env={...}` to `make_slideshow`.
- Point Python at the project with `project_dir=...` or the `SLIDESHOWAGENT_DIR` env var if it's not
  co-located with `slideshow.py`.

## Under the hood (manual pipeline)

The agent orchestrates these deterministic steps — you can also run them by hand:

1. **Plan** — topic → `/.tmp/<jobId>/script.json` (caption + NanoBanana prompt per scene).
2. **Validate** — `node execution/run.mjs <jobId> validate`
3. **Approve** — review captions + image prompts (HARD GATE: no generation before sign-off).
4. **Generate** — `node execution/run.mjs <jobId> generate`  → images into `slideshow/public/<jobId>/`
5. **Preview** — `node execution/run.mjs <jobId> studio`  then `cd slideshow && npm run dev`
6. **Render** — `cd slideshow && npm run render`  → `slideshow/out/video.mp4`

## Setup
- `.env` holds `KIE_AI_API_KEY` (NanoBanana via Kie.ai) and `ANTHROPIC_API_KEY` (the agent's planner).
  Verify NanoBanana with `node execution/probe-nanobanana.mjs`.
- Remotion app lives in `slideshow/` (run `npm install` there once).

## Install on another computer

**Prerequisites on the new machine:** Node.js 18+ (everyone), and Python 3 (only if using `slideshow.py`).

1. **Copy the project folder over.** On this Mac, make a zip *without* the huge/secret bits:
   ```bash
   cd "/Users/macbook/Personal/Personal Projects"
   zip -r slideshowagent.zip slideshowagent \
     -x "slideshowagent/node_modules/*" \
        "slideshowagent/slideshow/node_modules/*" \
        "slideshowagent/slideshow/out/*" \
        "slideshowagent/.env"
   ```
   Send `slideshowagent.zip` (email / Drive / USB) and unzip it on the other computer.
   *(Or, for a team: `git init` + push to GitHub, then `git clone` on the other machine — the
   `.gitignore` already excludes node_modules, .env, renders, and per-job assets.)*

2. **Run the installer** (handles Node check, both `npm install`s, and asks for the API keys):
   ```bash
   cd slideshowagent
   bash install.sh
   ```

3. **Make a video:**
   ```bash
   node slideshow-agent.mjs "glowy morning skincare routine"
   ```
   (macOS users can instead double-click `make-slideshow.command`.)

## Sharing with your team
Commit everything **except `.env`** (already git-ignored). Each teammate clones the repo, runs the
two `npm install`s, drops their own `ANTHROPIC_API_KEY` + `KIE_AI_API_KEY` into a local `.env`, and
runs `node slideshow-agent.mjs "<topic>"`. No Claude Code required — it's a plain Node CLI.

## Layout
```
slideshow-agent.mjs  the agent (topic → script → approve → generate → Studio)
CLAUDE.md            constitution + state
memory/              task_plan · findings · progress · decisions
architecture/        SOPs (generate-slideshow, nanobanana-api) — the agent reads these as its brief
execution/           tools: run · validate-script · generate-images · open-studio · probe · lib/kie
slideshow/           Remotion app (Slideshow composition: 9:16, Ken Burns + captions + crossfades)
.tmp/                per-job scripts (sample-glow-routine included)
```
