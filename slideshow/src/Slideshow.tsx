import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont } from "@remotion/google-fonts/Inter";
import type { Scene, SlideshowScript, CaptionStyle } from "./types";

const { fontFamily } = loadFont();
const BRAND = "#6938EF";

// Ken Burns: slow zoom across the scene's lifetime.
const SceneImage: React.FC<{ scene: Scene; duration: number }> = ({ scene, duration }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1.05, 1.18], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0A0A0A" }}>
      {scene.image ? (
        <Img
          src={staticFile(scene.image)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
      ) : (
        // Placeholder shown before images are generated, so Studio works immediately.
        <AbsoluteFill
          style={{
            transform: `scale(${scale})`,
            background: "linear-gradient(135deg, #6938EF 0%, #1b1136 100%)",
            justifyContent: "center",
            alignItems: "center",
            padding: 80,
          }}
        >
          <div style={{ fontFamily, color: "rgba(255,255,255,0.55)", fontSize: 30, textAlign: "center" }}>
            scene {scene.id} — image not generated yet
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; style: CaptionStyle }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [40, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  // 1) PILL — bold white text in a translucent dark rounded pill, bottom center.
  if (style === "pill") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: 120 }}>
        <div
          style={{
            fontFamily, fontWeight: 700, fontSize: 58, lineHeight: 1.2, color: "#FFFFFF",
            textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,0.6)",
            background: "rgba(10,10,10,0.35)", padding: "24px 32px", borderRadius: 28,
            transform: `translateY(${enter}px)`, opacity, maxWidth: "90%",
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    );
  }

  // 2) SUBTITLE — CapCut-style heavy white text with a thick black outline, no background.
  if (style === "subtitle") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: 150 }}>
        <div
          style={{
            fontFamily, fontWeight: 800, fontSize: 66, lineHeight: 1.15, color: "#FFFFFF",
            textAlign: "center", WebkitTextStroke: "3px #0A0A0A",
            textShadow: "0 3px 10px rgba(0,0,0,0.55)",
            transform: `translateY(${enter}px)`, opacity, maxWidth: "92%",
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    );
  }

  // 3) HIGHLIGHT — words sitting on a brand-purple marker block.
  if (style === "highlight") {
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: 130 }}>
        <div style={{ textAlign: "center", maxWidth: "88%", transform: `translateY(${enter}px)`, opacity }}>
          <span
            style={{
              fontFamily, fontWeight: 800, fontSize: 56, lineHeight: 1.5, color: "#FFFFFF",
              background: BRAND, padding: "6px 16px", borderRadius: 10,
              boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
            }}
          >
            {text}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  // 4) MINIMAL — clean thin white text, lower-left lower-third.
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: "0 60px 170px" }}
    >
      <div
        style={{
          fontFamily, fontWeight: 600, fontSize: 42, lineHeight: 1.25, color: "#FFFFFF",
          textAlign: "left", textShadow: "0 2px 14px rgba(0,0,0,0.7)",
          transform: `translateY(${enter}px)`, opacity, maxWidth: "85%",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const Slideshow: React.FC<{ script: SlideshowScript; transitionFrames: number }> = ({
  script,
  transitionFrames,
}) => {
  const captionStyle = script.captionStyle ?? "minimal";
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0A" }}>
      <TransitionSeries>
        {script.scenes.flatMap((scene, i) => {
          const seq = (
            <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
              <SceneImage scene={scene} duration={scene.durationInFrames} />
              <Caption text={scene.caption} style={captionStyle} />
            </TransitionSeries.Sequence>
          );
          if (i === script.scenes.length - 1) return [seq];
          return [
            seq,
            <TransitionSeries.Transition
              key={`t-${scene.id}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: transitionFrames })}
            />,
          ];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
