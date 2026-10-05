import type { CSSProperties } from "react";
import { GAME_ANIMATIONS, isAssetReady } from "../config/assets";

interface AnimatedStaffProps {
  type: keyof typeof GAME_ANIMATIONS;
  x: number;
  y: number;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * שכבת וידאו לצוות (מנקה / טכנאי) — נטענת מ־GAME_ANIMATIONS.
 * בלי src מקומי מוכן (`isAssetReady`) לא מרנדרים — אין googleusercontent / placeholder בפרוד.
 * Fallback: ציור Canvas / look billboard ב־ParkRenderer / ThreeParkWorld.
 */
export function AnimatedStaff({
  type,
  x,
  y,
  width = 120,
  height = 120,
  className,
  style,
}: AnimatedStaffProps) {
  const asset = GAME_ANIMATIONS[type];

  if (!asset || !isAssetReady(asset) || asset.type !== "video_animation") {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
        transform: "translate(-50%, -50%)",
        ...style,
      }}
    >
      <video
        src={asset.src}
        autoPlay
        loop={asset.loop}
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
