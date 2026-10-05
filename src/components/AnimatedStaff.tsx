import { useEffect, useState, type CSSProperties } from "react";
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
 * שכבת אנימציה לצוות (מנקה / טכנאי) — נטענת מ־GAME_ANIMATIONS.
 * מעדיפה motion frames מקומיים תחת looks/staff; וידאו רק אם type=video_animation ו־src מוכן.
 * בלי נכס מוכן (`isAssetReady`) לא מרנדרים — אין googleusercontent / src="" בפרוד.
 * Fallback נוסף: look billboard ב־ParkRenderer / ThreeParkWorld.
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
  const frames =
    asset?.frames && asset.frames.length > 0
      ? asset.frames
      : asset?.src
        ? [asset.src]
        : [];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
  }, [type]);

  useEffect(() => {
    if (!asset || !isAssetReady(asset) || frames.length <= 1 || !asset.loop) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 160);
    return () => window.clearInterval(id);
  }, [asset, frames.length]);

  if (!asset || !isAssetReady(asset) || frames.length === 0) {
    return null;
  }

  const wrapStyle: CSSProperties = {
    position: "absolute",
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: "none",
    transform: "translate(-50%, -50%)",
    ...style,
  };

  if (asset.type === "video_animation") {
    return (
      <div className={className} style={wrapStyle}>
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

  return (
    <div className={className} style={wrapStyle}>
      <img
        src={frames[frame] ?? asset.src}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
