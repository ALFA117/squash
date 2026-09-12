/**
 * The vector logo, painted in the current text colour.
 *
 * The SVGs in public/brand are used as CSS masks, so one file serves light
 * and dark: the shape comes from the file, the colour from `currentColor`.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`logo-mask logo-mark ${className}`}
      style={{ width: size, height: Math.round(size * (1480 / 1760)) }}
      role="img"
      aria-label="Squash"
    />
  );
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
