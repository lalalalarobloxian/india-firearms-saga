import type { Skin } from "@/game/rewards";

/**
 * Lightweight silhouette preview of a weapon wrap — the equipped skin's body
 * colour fills the frame/stock, the accent fills metal parts.
 */
export function SkinPreview({ skin, className = "" }: { skin: Skin; className?: string }) {
  const body = skin.color;
  const accent = skin.accent;
  const melee = skin.weapon === "khanda";
  const gradId = `g-${skin.id}`;

  return (
    <svg viewBox="0 0 200 80" className={className} role="img" aria-label={`${skin.name} preview`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={body} />
          <stop offset="60%" stopColor={accent} />
          <stop offset="100%" stopColor={body} />
        </linearGradient>
      </defs>
      {melee ? (
        <>
          <rect x="20" y="36" width="120" height="8" rx="4" fill={`url(#${gradId})`} />
          <path d="M140 32 L184 40 L140 48 Z" fill={accent} />
          <rect x="10" y="30" width="14" height="20" rx="3" fill={body} />
          <circle cx="17" cy="40" r="4" fill={accent} />
        </>
      ) : (
        <>
          {/* receiver */}
          <rect x="52" y="32" width="82" height="16" rx="3" fill={`url(#${gradId})`} />
          {/* barrel */}
          <rect x="134" y="37" width="52" height="6" rx="3" fill={accent} />
          {/* handguard */}
          <rect x="120" y="44" width="34" height="9" rx="3" fill={body} />
          {/* magazine */}
          <path d="M88 48 L112 48 L108 70 L92 70 Z" fill={accent} />
          {/* stock */}
          <path d="M52 34 L20 44 L20 56 L52 48 Z" fill={body} />
          <rect x="14" y="42" width="8" height="16" rx="3" fill={accent} />
          {/* grip */}
          <path d="M66 48 L80 48 L74 68 L62 66 Z" fill={body} />
          {/* sight */}
          <rect x="126" y="26" width="6" height="8" rx="2" fill={accent} />
        </>
      )}
    </svg>
  );
}
