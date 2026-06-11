"""CLI: `slideshowagent "<topic>" [options]` (installed as a console script)."""

from __future__ import annotations

import argparse
import json
import sys

from ._core import make_slideshow, SlideshowError, CAPTION_STYLES


def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        prog="slideshowagent",
        description="Generate a UGC slideshow video from a topic.",
    )
    p.add_argument("topic", help="What the slideshow is about")
    p.add_argument("--scenes", type=int, default=6, help="Number of slides (default 6)")
    p.add_argument("--captions", default="minimal", choices=CAPTION_STYLES, help="Caption style")
    p.add_argument("--product", help="Product image (local path or URL)")
    p.add_argument("--character", help="Character image (local path or URL)")
    p.add_argument("--style", help="Style reference image or video (local path or URL)")
    p.add_argument("--no-render", action="store_true", help="Skip MP4 render (just generate + wire Studio)")
    p.add_argument("--json", action="store_true", help="Print the full result as JSON")
    args = p.parse_args(argv)

    try:
        result = make_slideshow(
            args.topic,
            scenes=args.scenes,
            captions=args.captions,
            product=args.product,
            character=args.character,
            style=args.style,
            render=not args.no_render,
        )
    except SlideshowError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"jobId: {result['jobId']}")
        if result.get("video"):
            print(f"video: {result['video']}")
        else:
            print(f"preview: {result.get('studioCommand')}")
        for s in result["scenes"]:
            tag = "[product] " if s["useProduct"] else ""
            print(f"  #{s['id']} {tag}{s['caption']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
