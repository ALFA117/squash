"use client";

import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Motion for the landing page — every piece answers to something the reader
 * does (scrolls, points, arrives), never motion for its own sake, and every
 * one of them stands still under prefers-reduced-motion. Content is always
 * rendered in its final state first; motion only adds the travel.
 */

/** A thin bar that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />;
}

/** A button that leans a few pixels toward the pointer — and springs back. */
export function Magnetic({ children, strength = 0.22 }: { children: ReactNode; strength?: number }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 300, damping: 20 });
  const y = useSpring(0, { stiffness: 300, damping: 20 });
  if (reduce) return <>{children}</>;
  return (
    <motion.span
      className="magnetic"
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * A card that tilts toward the pointer, with a soft light that follows it.
 * On touch there is no hover, so nothing moves — the card is simply there.
 */
export function TiltCard({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });
  const lx = useTransform(px, (v) => `${v * 100}%`);
  const ly = useTransform(py, (v) => `${v * 100}%`);
  const light = useMotionTemplate`radial-gradient(420px circle at ${lx} ${ly}, var(--spot), transparent 60%)`;

  if (reduce) return <article className={className}>{children}</article>;

  return (
    <motion.article
      className={`${className} tilt`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      <motion.span className="tilt-light" style={{ background: light }} aria-hidden="true" />
      {children}
    </motion.article>
  );
}

/**
 * A number that counts up the first time it comes into view. It renders its
 * final value first, so a reader who never scrolls, or reads without
 * scripts, still sees the right number.
 */
export function CountUp({
  to,
  from = 0,
  format,
  duration = 1.4,
  className,
  style,
}: {
  to: number;
  from?: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [text, setText] = useState(format(to));
  const armed = useRef(false);
  // Callers pass an inline formatter; keep the latest in a ref so a new
  // function each render does not restart the count on every frame.
  const fmt = useRef(format);
  fmt.current = format;

  // Before it is seen, show the starting value — only once the page is live.
  useEffect(() => {
    if (reduce || armed.current || typeof IntersectionObserver === "undefined") return;
    const r = ref.current?.getBoundingClientRect();
    const alreadyVisible = r && r.top < window.innerHeight && r.bottom > 0;
    if (!alreadyVisible) {
      armed.current = true;
      setText(fmt.current(from));
    }
  }, [reduce, from]);

  useEffect(() => {
    if (!inView || reduce || !armed.current) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setText(fmt.current(v)),
    });
    // If frames stall (a hidden tab, a starved device), land on the true
    // number anyway — a count-up must never leave a wrong figure on screen.
    const settle = setTimeout(() => setText(fmt.current(to)), (duration + 0.6) * 1000);
    return () => {
      controls.stop();
      clearTimeout(settle);
    };
  }, [inView, reduce, from, to, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {text}
    </span>
  );
}

/**
 * Re-mounts its child the first time it scrolls into view, so a CSS entrance
 * that already played on load plays again where someone can see it.
 */
export function ReplayInView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  return (
    <div ref={ref} className={className}>
      <div key={inView ? "seen" : "unseen"}>{children}</div>
    </div>
  );
}
