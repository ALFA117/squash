"use client";

import Link from "next/link";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ComponentProps } from "react";

/**
 * Press feedback for the things people tap.
 *
 * A spring, not a tween: a press can be interrupted and released halfway,
 * and a spring reverses from wherever it is. Only transform moves, so no
 * layout shifts under the finger. With reduced motion the press is still
 * shown — by the button's own :active styles — just without the travel.
 */
const PRESS = { type: "spring", stiffness: 420, damping: 22 } as const;

export function PressButton({ disabled, ...props }: HTMLMotionProps<"button">) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      {...props}
      disabled={disabled}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={PRESS}
    />
  );
}

const MotionLink = motion.create(Link);

export function PressLink(props: ComponentProps<typeof MotionLink>) {
  const reduce = useReducedMotion();
  return <MotionLink {...props} whileTap={reduce ? undefined : { scale: 0.97 }} transition={PRESS} />;
}
