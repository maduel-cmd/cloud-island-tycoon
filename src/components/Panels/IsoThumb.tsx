/** תצוגה מקדימה איזומטרית קטנה לכרטיסי בנק המתקנים */

export type ThumbShape =
  | "coaster"
  | "wheel"
  | "carousel"
  | "cups"
  | "ship"
  | "tower"
  | "water"
  | "stall"
  | "util"
  | "generic";

export function IsoThumb({
  shape,
  color,
  accent = "#fbbf24",
  locked = false,
  size = 88,
  artSrc,
}: {
  shape: ThumbShape;
  color: string;
  accent?: string;
  locked?: boolean;
  size?: number;
  /** Transparent build-bank card art when available */
  artSrc?: string;
}) {
  if (artSrc) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-transparent ${locked ? "grayscale contrast-75" : ""}`}
        style={{ width: size, height: size * 0.85 }}
      >
        <img
          src={artSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${locked ? "grayscale contrast-75" : ""}`}
      style={{
        width: size,
        height: size * 0.85,
        background: `linear-gradient(165deg, ${color}55 0%, #e0f2fe 55%, #bae6fd 100%)`,
      }}
    >
      {/* grass tile */}
      <div
        className="absolute bottom-1 left-1/2 h-8 w-14 -translate-x-1/2"
        style={{
          background: locked ? "#9ca3af" : "#4ade80",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          opacity: 0.85,
        }}
      />
      <svg
        viewBox="0 0 100 90"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {shape === "coaster" && (
          <>
            <path d="M12 70 Q30 20 50 45 T88 30" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
            <circle cx="55" cy="42" r="10" fill="none" stroke={color} strokeWidth="4" />
            <rect x="50" y="36" width="12" height="7" rx="2" fill={accent} />
          </>
        )}
        {shape === "wheel" && (
          <>
            <circle cx="50" cy="42" r="22" fill="none" stroke={color} strokeWidth="4" />
            <line x1="50" y1="42" x2="50" y2="72" stroke={color} strokeWidth="3" />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const r = (deg * Math.PI) / 180;
              const x = 50 + Math.cos(r) * 18;
              const y = 42 + Math.sin(r) * 18;
              return <rect key={deg} x={x - 4} y={y - 3} width="8" height="6" rx="1" fill={accent} />;
            })}
          </>
        )}
        {shape === "carousel" && (
          <>
            <ellipse cx="50" cy="62" rx="28" ry="8" fill={color} opacity="0.5" />
            <path d="M22 58 L50 22 L78 58 Z" fill={accent} stroke={color} strokeWidth="2" />
            <circle cx="50" cy="48" r="10" fill={color} />
            <rect x="34" y="50" width="6" height="14" fill="#fff" opacity="0.9" />
            <rect x="60" y="50" width="6" height="14" fill="#fff" opacity="0.9" />
          </>
        )}
        {shape === "ship" && (
          <>
            <path d="M20 58 Q50 78 80 58 L70 48 L30 48 Z" fill={color} />
            <rect x="46" y="28" width="4" height="22" fill="#78350f" />
            <path d="M50 28 L72 42 L50 42 Z" fill={accent} />
          </>
        )}
        {shape === "tower" && (
          <>
            <rect x="40" y="20" width="20" height="48" rx="3" fill={color} />
            <rect x="36" y="16" width="28" height="8" rx="2" fill={accent} />
            <circle cx="50" cy="38" r="6" fill="#fff" opacity="0.7" />
          </>
        )}
        {shape === "cups" && (
          <>
            <circle cx="50" cy="50" r="20" fill={color} opacity="0.35" />
            <ellipse cx="38" cy="48" rx="8" ry="6" fill={accent} />
            <ellipse cx="62" cy="48" rx="8" ry="6" fill="#38bdf8" />
            <ellipse cx="50" cy="58" rx="8" ry="6" fill="#f472b6" />
          </>
        )}
        {shape === "water" && (
          <>
            <path d="M15 55 Q35 30 55 50 T90 40" fill="none" stroke="#38bdf8" strokeWidth="6" />
            <rect x="48" y="42" width="14" height="8" rx="2" fill={color} />
          </>
        )}
        {shape === "stall" && (
          <>
            <rect x="28" y="48" width="44" height="22" rx="3" fill={color} />
            <path d="M22 48 L50 28 L78 48 Z" fill="#fff7ed" stroke={accent} strokeWidth="2" />
            <circle cx="50" cy="42" r="5" fill={accent} />
          </>
        )}
        {shape === "util" && (
          <>
            <rect x="30" y="40" width="40" height="28" rx="4" fill={color} />
            <circle cx="42" cy="54" r="6" fill="#fff" />
            <circle cx="58" cy="54" r="6" fill="#fff" />
          </>
        )}
        {shape === "generic" && (
          <>
            <rect x="32" y="35" width="36" height="30" rx="4" fill={color} />
            <rect x="38" y="28" width="24" height="10" rx="2" fill={accent} />
          </>
        )}
      </svg>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-3xl drop-shadow">
          🔒
        </div>
      )}
    </div>
  );
}
