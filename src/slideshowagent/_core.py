"""Core logic: locate/prepare the Node runtime and drive the agent."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

CAPTION_STYLES = ("pill", "subtitle", "highlight", "minimal")

# Where the bundled runtime is copied + npm-installed on first use (wheel installs).
APP_CACHE = Path(os.environ.get("SLIDESHOWAGENT_CACHE") or (Path.home() / ".slideshowagent"))


class SlideshowError(RuntimeError):
    """Raised when slideshow generation (or its setup) fails."""


# ---------- locating the Node runtime ----------
def _bundled_runtime() -> Optional[Path]:
    """The Node project shipped inside the wheel (slideshowagent/_runtime), if present."""
    try:
        from importlib.resources import files

        p = Path(str(files("slideshowagent") / "_runtime"))
        return p if (p / "slideshow-agent.mjs").is_file() else None
    except Exception:
        return None


def _repo_runtime() -> Optional[Path]:
    """When installed editable / run from a source checkout, the project is the repo root."""
    root = Path(__file__).resolve().parents[2]  # src/slideshowagent/_core.py -> repo root
    return root if (root / "slideshow-agent.mjs").is_file() else None


def _npm_install(d: Path) -> None:
    if shutil.which("npm") is None:
        raise SlideshowError("npm not found — install Node.js 18+ (https://nodejs.org)")
    subprocess.run(["npm", "install", "--no-audit", "--no-fund"], cwd=str(d), check=True)


def _ensure_node_deps(root: Path) -> None:
    if not (root / "node_modules").is_dir():
        _npm_install(root)
    slideshow = root / "slideshow"
    if (slideshow / "package.json").is_file() and not (slideshow / "node_modules").is_dir():
        _npm_install(slideshow)


def runtime_dir() -> Path:
    """Return a ready-to-run Node runtime directory, preparing it on first use.

    Resolution order:
      1. SLIDESHOWAGENT_DIR env var (an existing project dir).
      2. The repo root (editable install / source checkout).
      3. The runtime bundled in the wheel, copied to ~/.slideshowagent/runtime and npm-installed.
    """
    env_dir = os.environ.get("SLIDESHOWAGENT_DIR")
    if env_dir:
        d = Path(env_dir)
        if not (d / "slideshow-agent.mjs").is_file():
            raise SlideshowError(f"SLIDESHOWAGENT_DIR={d} does not contain slideshow-agent.mjs")
        _ensure_node_deps(d)
        return d

    repo = _repo_runtime()
    if repo is not None:
        _ensure_node_deps(repo)
        return repo

    bundled = _bundled_runtime()
    if bundled is not None:
        dest = APP_CACHE / "runtime"
        ready = dest / ".ready"
        if not ready.is_file():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(bundled, dest)
            _ensure_node_deps(dest)
            ready.write_text("ok")
        return dest

    raise SlideshowError("could not locate the slideshowagent Node runtime")


# ---------- the public API ----------
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
    env: Optional[dict] = None,
    timeout: int = 1800,
) -> dict:
    """Generate a UGC slideshow and return a result dict.

    Pass your keys directly with `anthropic_api_key=` and `kie_api_key=` (or set them as environment
    variables / a .env file). Keys passed here take priority. See README "Use from Python" for the
    full argument reference. Returns a dict with keys: jobId, topic, title, captionStyle, scriptPath,
    scenes[], images[], video, studioCommand. Raises SlideshowError on failure.
    """
    if captions not in CAPTION_STYLES:
        raise SlideshowError(f"captions must be one of {CAPTION_STYLES}, got {captions!r}")
    if shutil.which("node") is None:
        raise SlideshowError("Node.js not found on PATH — install Node 18+ (https://nodejs.org)")

    keys = {}
    if anthropic_api_key:
        keys["ANTHROPIC_API_KEY"] = anthropic_api_key
    if kie_api_key:
        keys["KIE_AI_API_KEY"] = kie_api_key

    project = runtime_dir()
    agent = project / "slideshow-agent.mjs"

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

    run_env = {**os.environ, **keys, **(env or {})}
    proc = subprocess.run(
        cmd, cwd=str(project), env=run_env,
        capture_output=True, text=True, timeout=timeout,
    )
    if proc.returncode != 0:
        raise SlideshowError(
            f"slideshow agent failed (exit {proc.returncode}):\n{proc.stderr.strip()}"
        )

    out = proc.stdout.strip()
    last = out.splitlines()[-1] if out else ""
    try:
        return json.loads(last)
    except json.JSONDecodeError:
        raise SlideshowError(
            "could not parse agent output as JSON.\n"
            f"stdout:\n{proc.stdout}\n---stderr---\n{proc.stderr}"
        )
