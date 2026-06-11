import { Composition } from "remotion";
import { Slideshow } from "./Slideshow";
import type { SlideshowScript } from "./types";
// The active job's script is copied here by execution/open-studio.mjs.
// Seeded with the sample so Studio works out of the box.
import script from "./active-script.json";

const TRANSITION_FRAMES = 15; // crossfade length; overlaps between scenes

export const RemotionRoot: React.FC = () => {
  const s = script as SlideshowScript;
  const fps = s.fps ?? 30;

  // Total duration = sum of scene durations minus the overlap consumed by each crossfade.
  const total =
    s.scenes.reduce((sum, sc) => sum + sc.durationInFrames, 0) -
    TRANSITION_FRAMES * Math.max(0, s.scenes.length - 1);

  return (
    <Composition
      id="Slideshow"
      component={Slideshow}
      durationInFrames={total}
      fps={fps}
      width={1080}
      height={1920}
      defaultProps={{ script: s, transitionFrames: TRANSITION_FRAMES }}
    />
  );
};
