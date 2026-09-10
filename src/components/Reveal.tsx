import type { ReactNode } from "react";

/**
 * Reveals a landing section as it arrives.
 *
 * CSS, not JS, and the resting state is VISIBLE — the animation only gives it
 * somewhere to travel from. A section parked at opacity 0 waiting on an
 * observer is an unreadable section the moment scripting is slow, blocked or
 * broken, and the landing is the one page that has to survive that.
 *
 * `prefers-reduced-motion` is handled globally in globals.css.
 */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="reveal" style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
