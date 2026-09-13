/**
 * The vector logo, painted in the current text colour.
 *
 * The SVGs in public/brand are used as CSS masks, so one file serves light
 * and dark: the shape comes from the file, the colour from `currentColor`.
 */
/**
 * Below ~72px the fine network of the full mark falls under a pixel and
 * disappears, so small sizes use a heavier cut of the same drawing — the
 * way a brand keeps an icon version of its logo.
 */
export function LogoMark({ size = 32, className = "", badge = false }: { size?: number; className?: string; badge?: boolean }) {
  const mark = (
    <span
      className={`logo-mask ${size < 72 ? "logo-mark-bold" : "logo-mark"} ${badge ? "" : className}`}
      style={{ width: size, height: Math.round(size * (1480 / 1760)) }}
      role="img"
      aria-label="Squash"
    />
  );
  if (!badge) return mark;
  return <span className={`logo-badge ${className}`}>{mark}</span>;
}

export function Wordmark({ width = 112, className = "" }: { width?: number; className?: string }) {
  return (
    <span
      className={`logo-mask logo-word ${className}`}
      style={{ width, height: Math.round(width * (334 / 2024)) }}
      role="img"
      aria-label="Squash"
    />
  );
}
