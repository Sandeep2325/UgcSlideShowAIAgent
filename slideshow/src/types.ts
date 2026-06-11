export type CaptionStyle = "pill" | "subtitle" | "highlight" | "minimal";

export type Scene = {
  id: number;
  caption: string;
  imagePrompt: string;
  durationInFrames: number;
  useProduct?: boolean; // include the product reference in this scene (product/solution slides)
  image?: string; // path relative to public/ (set by generate-images), e.g. "<jobId>/scene-1.png"
};

export type SlideshowScript = {
  jobId: string;
  topic: string;
  title?: string;
  aspectRatio?: string;
  fps?: number;
  imageSize?: string;
  captionStyle?: CaptionStyle;
  referenceImages?: { style?: string; character?: string; product?: string };
  scenes: Scene[];
};
