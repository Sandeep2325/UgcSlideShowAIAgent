"""Python client for slideshowagent — generate UGC slideshow videos from a text topic.

    from slideshow import make_slideshow

    result = make_slideshow("glowy morning skincare routine", scenes=6, render=True)
    print(result["video"])          # absolute path to the rendered .mp4

Under the hood this calls the project's Node agent, which plans the scenes with Claude
(claude-opus-4-8), generates the images with NanoBanana, and assembles the video with Remotion.
Node.js 18+ must be installed and the slideshowagent project must be present.

Credentials: set ANTHROPIC_API_KEY and KIE_AI_API_KEY as environment variables (recommended on a
server) or in the project's .env file. You can also pass them via the `env=` argument.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

# slideshow.py lives in the project root next to slideshow-agent.mjs
DEFAULT_PROJECT_DIR = Path(__file__).resolve().parent

CAPTION_STYLES = ("pill", "subtitle", "highlight", "minimal")


class SlideshowError(RuntimeError):
    """Raised when slideshow generation fails."""


def make_slideshow(
    topic: str,
    *,
    scenes: int = 6,
    captions: str = "minimal",
    product: Optional[str] = None,
    character: Optional[str] = None,
    style: Optional[str] = None,
    render: bool = True,
    anthropic_api_key: Optional[str] = None,
    kie_api_key: Optional[str] = None,
    project_dir: Optional[str] = None,
    env: Optional[dict] = None,
    timeout: int = 1800,
) -> dict:
    """Generate a UGC slideshow and return a result dict.

    Args:
        topic:      What the slideshow is about (e.g. "kojic acid face wash for dark spots").
        scenes:     Number of slides (default 6).
        captions:   Caption style: pill | subtitle | highlight | minimal.
        product:    Optional product image — local path or URL. Shown only on product/solution slides.
        character:  Optional character image — kept identical across all slides.
        style:      Optional style reference — image OR video (local path or URL).
        render:     True → render the .mp4 (returned in result["video"]).
                    False → just generate images + wire the Remotion composition (preview yourself).
        project_dir: Path to the slideshowagent project. Defaults to this file's folder,
                     or the SLIDESHOWAGENT_DIR env var.
        env:        Extra environment variables (e.g. {"ANTHROPIC_API_KEY": "...", "KIE_AI_API_KEY": "..."}).
        timeout:    Max seconds to wait (default 1800).

    Returns:
        dict with keys: jobId, topic, title, captionStyle, scriptPath, scenes[], images[],
        video (abs path or None), studioCommand.

    Raises:
        SlideshowError on any failure (message includes the agent's stderr).
    """
    if captions not in CAPTION_STYLES:
        raise SlideshowError(f"captions must be one of {CAPTION_STYLES}, got {captions!r}")

    project = Path(project_dir or os.environ.get("SLIDESHOWAGENT_DIR") or DEFAULT_PROJECT_DIR)
    agent = project / "slideshow-agent.mjs"
    if not agent.exists():
        raise SlideshowError(
            f"agent not found at {agent} — pass project_dir=... or set SLIDESHOWAGENT_DIR"
        )
    if shutil.which("node") is None:
        raise SlideshowError("Node.js not found on PATH — it is required to render the video")

    cmd = ["node", str(agent), topic, "--json", "--yes",
           "--scenes", str(scenes), "--captions", captions]
    if product:
        cmd += ["--product", str(product)]
    if character:
        cmd += ["--character", str(character)]
    if style:
        cmd += ["--style", str(style)]
    if render:
        cmd += ["--render"]

    keys = {}
    if anthropic_api_key:
        keys["ANTHROPIC_API_KEY"] = anthropic_api_key
    if kie_api_key:
        keys["KIE_AI_API_KEY"] = kie_api_key
    run_env = {**os.environ, **keys, **(env or {})}
    proc = subprocess.run(
        cmd, cwd=str(project), env=run_env,
        capture_output=True, text=True, timeout=timeout,
    )
    if proc.returncode != 0:
        raise SlideshowError(
            f"slideshow agent failed (exit {proc.returncode}):\n{proc.stderr.strip()}"
        )

    # stdout is a single JSON line; progress logs went to stderr.
    out = proc.stdout.strip()
    last = out.splitlines()[-1] if out else ""
    try:
        return json.loads(last)
    except json.JSONDecodeError:
        raise SlideshowError(
            "could not parse agent output as JSON.\n"
            f"stdout:\n{proc.stdout}\n---stderr---\n{proc.stderr}"
        )


if __name__ == "__main__":
    import sys

    topic = sys.argv[1] if len(sys.argv) > 1 else "glowy morning skincare routine"
    result = make_slideshow(topic, scenes=4, render=True)
    print("jobId:", result["jobId"])
    print("video:", result["video"])
    for s in result["scenes"]:
        print(f"  #{s['id']} {'[product] ' if s['useProduct'] else ''}{s['caption']} -> {s['image']}")
