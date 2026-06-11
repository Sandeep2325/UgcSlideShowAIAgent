"""slideshowagent — generate UGC-style slideshow videos from a text topic.

    from slideshowagent import make_slideshow

    result = make_slideshow("glowy morning skincare routine", scenes=6, render=True)
    print(result["video"])   # absolute path to the rendered .mp4

Requires Node.js 18+ on the machine (the video engine, Remotion, is Node-based). The Node runtime
ships inside this package and its dependencies are installed automatically on first use.

Credentials: set ANTHROPIC_API_KEY and KIE_AI_API_KEY as environment variables, or pass them via
the `env=` argument to make_slideshow().
"""

from ._core import make_slideshow, runtime_dir, SlideshowError, CAPTION_STYLES

__version__ = "1.1.0"
__all__ = ["make_slideshow", "runtime_dir", "SlideshowError", "CAPTION_STYLES", "__version__"]
