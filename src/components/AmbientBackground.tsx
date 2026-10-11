"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue,
} from "motion/react";

/* Fondo ambiental (receta 1 de /diseno, adaptada a Squash).
   Aurora suave, una constelación en canvas cuyas líneas son deudas (rojo
   "owed") que se vuelven liquidaciones (verde "settled") al acercarse, y
   objetos CSS 3D del tema: monedas de peso y dólar con canto real, bloques de
   libro mayor y un giroscopio de anillos (el motor de compensación).
   Completa en la landing, tranquila en las pantallas de la app.
   Solo transform y opacity; se pausa con la pestaña oculta. */

type Shape = {
  kind: "cube" | "gyro" | "prism" | "coin";
  x: string;      // left, % of viewport
  y: string;      // top, % of viewport
  size: number;   // px
  depth: number;  // 0 (far) … 1 (near): parallax strength and scale
  spin: number;   // seconds per revolution
  delay?: number;
  tone: "gold" | "info" | "violet";
  label?: string; // símbolo de la cara de la moneda
  mobile?: boolean;
};

const FULL: Shape[] = [
  { kind: "gyro",  x: "88%", y: "30%", size: 220, depth: 0.9, spin: 40, tone: "gold", mobile: true },
  { kind: "coin",  x: "6%",  y: "16%", size: 96,  depth: 0.8, spin: 12, tone: "info", label: "$", mobile: true },
  { kind: "cube",  x: "62%", y: "74%", size: 80,  depth: 0.6, spin: 30, tone: "gold", mobile: true },
  { kind: "coin",  x: "22%", y: "66%", size: 70,  depth: 0.5, spin: 10, delay: -4, tone: "gold", label: "US$", mobile: true },
  { kind: "cube",  x: "54%", y: "84%", size: 50,  depth: 0.3, spin: 18, delay: -4, tone: "violet" },
  { kind: "gyro",  x: "2%",  y: "78%", size: 140, depth: 0.35, spin: 28, delay: -12, tone: "info" },
  { kind: "coin",  x: "42%", y: "30%", size: 46,  depth: 0.22, spin: 9, delay: -6, tone: "info", label: "$" },
  { kind: "prism", x: "78%", y: "88%", size: 44,  depth: 0.18, spin: 14, delay: -2, tone: "gold" },
];

const CALM: Shape[] = [
  { kind: "coin",  x: "80%", y: "8%",  size: 84,  depth: 0.55, spin: 16, tone: "gold", label: "$", mobile: true },
  { kind: "cube",  x: "4%",  y: "58%", size: 70,  depth: 0.4, spin: 34, tone: "info", mobile: true },
  { kind: "gyro",  x: "86%", y: "70%", size: 120, depth: 0.3, spin: 44, delay: -10, tone: "gold" },
  { kind: "coin",  x: "40%", y: "90%", size: 40,  depth: 0.2, spin: 12, delay: -5, tone: "info", label: "US$" },
];

// gold = verde "settled", info = ámbar del riel, violet = rojo "owed" atenuado.
const TONE = {
  gold:   { line: "var(--settled)", face: "color-mix(in srgb, var(--settled) 16%, transparent)" },
  info:   { line: "var(--rail)",    face: "color-mix(in srgb, var(--rail) 16%, transparent)" },
  violet: { line: "var(--owed)",    face: "color-mix(in srgb, var(--owed) 14%, transparent)" },
};

/* Moneda con canto: dos caras con el símbolo y 16 segmentos alrededor. */
function Coin({ size, tone, label }: { size: number; tone: keyof typeof TONE; label?: string }) {
  const t = TONE[tone];
  const thick = Math.max(6, size * 0.12);
  const r = size / 2;
  const seg = 16;
  const segW = (2 * Math.PI * r) / seg + 1;
  return (
    <>
      {[thick / 2, -thick / 2].map((z, i) => (
        <span
          key={z}
          className="amb-coin-face"
          style={{
            width: size, height: size, fontSize: size * (label && label.length > 1 ? 0.26 : 0.42),
            transform: `${i ? "rotateY(180deg) " : ""}translateZ(${Math.abs(z)}px)`,
            color: t.line, borderColor: t.line,
            background: `radial-gradient(circle at 35% 30%, ${t.face}, transparent 75%)`,
          }}
        >
          {label}
        </span>
      ))}
      {Array.from({ length: seg }, (_, i) => (
        <span
          key={i}
          className="amb-coin-edge"
          style={{
            width: segW, height: thick, left: r - segW / 2, top: r - thick / 2,
            transform: `rotateY(${(360 / seg) * i}deg) translateZ(${r}px) rotateX(90deg)`,
            background: t.line,
          }}
        />
      ))}
    </>
  );
}

function Cube({ size, tone }: { size: number; tone: keyof typeof TONE }) {
  const h = size / 2;
  const t = TONE[tone];
  const faces = [
    `rotateY(0deg) translateZ(${h}px)`,
    `rotateY(90deg) translateZ(${h}px)`,
    `rotateY(180deg) translateZ(${h}px)`,
    `rotateY(-90deg) translateZ(${h}px)`,
    `rotateX(90deg) translateZ(${h}px)`,
    `rotateX(-90deg) translateZ(${h}px)`,
  ];
  return (
    <>
      {faces.map((transform, i) => (
        <span
          key={i}
          className="amb-face"
          style={{ width: size, height: size, transform, color: t.line, borderColor: t.line, background: `linear-gradient(135deg, ${t.face}, transparent 70%)` }}
        />
      ))}
    </>
  );
}

function Prism({ size, tone }: { size: number; tone: keyof typeof TONE }) {
  // Triangular prism: three rectangular faces around the Y axis.
  const t = TONE[tone];
  const w = size * 0.8;
  const r = w / (2 * Math.tan(Math.PI / 3));
  return (
    <>
      {[0, 120, 240].map((deg) => (
        <span
          key={deg}
          className="amb-face"
          style={{
            width: w, height: size, left: (size - w) / 2,
            transform: `rotateY(${deg}deg) translateZ(${r}px)`,
            color: t.line, borderColor: t.line, background: `linear-gradient(180deg, ${t.face}, transparent 80%)`,
          }}
        />
      ))}
    </>
  );
}

function Gyro({ size, tone, animate }: { size: number; tone: keyof typeof TONE; animate: boolean }) {
  const t = TONE[tone];
  const rings = [
    "rotateY(0deg)",
    "rotateY(60deg)",
    "rotateY(120deg)",
    "rotateX(90deg)",
  ];
  return (
    <>
      {rings.map((transform, i) => (
        <span
          key={transform}
          className="amb-ring"
          style={{ width: size, height: size, transform, color: t.line, borderColor: t.line, opacity: 1 - i * 0.14 }}
        />
      ))}
      <span
        className={`amb-core ${animate ? "amb-animate" : ""}`}
        style={{ width: size * 0.14, height: size * 0.14, left: size * 0.43, top: size * 0.43, background: t.line }}
      />
    </>
  );
}

/* Depth star field: particles fly toward the viewer and link into constellations. */
function StarField({ dense, reduce, px, py }: { dense: boolean; reduce: boolean; px: MotionValue<number>; py: MotionValue<number> }) {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = window.innerWidth < 768;
    const COUNT = Math.round((dense ? 140 : 70) * (small ? 0.55 : 1));
    const DEPTH = 1000;
    type Star = { x: number; y: number; z: number; hue: number };
    let w = 0, h = 0, raf = 0;
    const stars: Star[] = [];
    const spawn = (s: Star, far = true) => {
      s.x = (Math.random() - 0.5) * 2;
      s.y = (Math.random() - 0.5) * 2;
      s.z = far ? DEPTH : Math.random() * DEPTH;
      s.hue = Math.random();
    };
    for (let i = 0; i < COUNT; i++) { const s = { x: 0, y: 0, z: 0, hue: 0 }; spawn(s, false); stars.push(s); }

    const resize = () => {
      w = el.clientWidth; h = el.clientHeight;
      el.width = w * dpr; el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Se leen en cada cuadro para que el cambio de tema se note sin recargar.
    let gold = "", info = "";
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      gold = css.getPropertyValue("--settled").trim() || "#1b8058";
      info = css.getPropertyValue("--rail").trim() || "#8a6d1d";
    };
    readColors();
    const themeObs = new MutationObserver(readColors);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const draw = (move: boolean) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2 + px.get() * 30, cy = h / 2 + py.get() * 30;
      const pts: { x: number; y: number; a: number; c: string }[] = [];
      for (const s of stars) {
        if (move) { s.z -= dense ? 2.2 : 1.2; if (s.z < 1) spawn(s); }
        const k = 420 / s.z;
        const x = cx + s.x * w * 0.6 * k, y = cy + s.y * h * 0.6 * k;
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) { if (move) spawn(s); continue; }
        const a = Math.min(1, (1 - s.z / DEPTH) * 1.4);
        const r = Math.max(0.4, 2.2 * (1 - s.z / DEPTH));
        const c = s.hue > 0.72 ? info : gold;
        ctx.globalAlpha = a;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (a > 0.45) pts.push({ x, y, a, c });
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 110) {
            ctx.globalAlpha = (1 - d / 110) * 0.35 * Math.min(pts[i].a, pts[j].a);
            ctx.strokeStyle = pts[i].c;
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    if (reduce) { draw(false); return () => { window.removeEventListener("resize", resize); themeObs.disconnect(); }; }

    const loop = () => { draw(true); raf = requestAnimationFrame(loop); };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      themeObs.disconnect();
    };
  }, [el, dense, reduce, px, py]);

  return <canvas ref={setEl} className="amb-stars" />;
}

function Float({ s, index, px, py, scroll, reduce }: {
  s: Shape; index: number; px: MotionValue<number>; py: MotionValue<number>; scroll: MotionValue<number>; reduce: boolean;
}) {
  const range = 40 * s.depth;
  const x = useTransform(px, (v) => v * range);
  const yPointer = useTransform(py, (v) => v * range);
  const yScroll = useTransform(scroll, (v) => -v * 260 * s.depth);
  const y = useTransform([yPointer, yScroll] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const scale = 0.7 + s.depth * 0.5;

  return (
    <motion.div
      className="amb-float"
      style={{
        left: s.x, top: s.y, width: s.size, height: s.size,
        x: reduce ? 0 : x, y: reduce ? 0 : y, scale,
        opacity: 0.35 + s.depth * 0.45,
      }}
    >
      <div
        className={`${s.kind === "coin" ? "amb-flip" : "amb-spin"} ${reduce ? "" : "amb-animate"}`}
        style={{
          width: s.size, height: s.size,
          animationDuration: `${s.spin}s`,
          animationDelay: `${s.delay ?? -index * 3}s`,
          ["--tilt" as string]: `${(index % 3) * 18 - 18}deg`,
        }}
      >
        {s.kind === "cube" && <Cube size={s.size} tone={s.tone} />}
        {s.kind === "prism" && <Prism size={s.size} tone={s.tone} />}
        {s.kind === "gyro" && <Gyro size={s.size} tone={s.tone} animate={!reduce} />}
        {s.kind === "coin" && <Coin size={s.size} tone={s.tone} label={s.label} />}
      </div>
    </motion.div>
  );
}

export function AmbientBackground() {
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;
  const full = pathname === "/";
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Pointer parallax (desktop, fine pointer only), smoothed with a spring.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 40, damping: 18 });
  const py = useSpring(rawY, { stiffness: 40, damping: 18 });
  useEffect(() => {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, rawX, rawY]);

  const { scrollYProgress } = useScroll();
  const scroll = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });
  const auroraShift = useTransform(scroll, (v) => v * -120);

  const shapes = (full ? FULL : CALM).filter((s) => !isMobile || s.mobile);

  return (
    <div aria-hidden className={`amb-root ${full ? "amb-full" : "amb-calm"}`}>
      <motion.div className="amb-aurora" style={{ y: reduce ? 0 : auroraShift }}>
        <span className={`amb-blob amb-blob-1 ${reduce ? "" : "amb-animate"}`} />
        <span className={`amb-blob amb-blob-2 ${reduce ? "" : "amb-animate"}`} />
        <span className={`amb-blob amb-blob-3 ${reduce ? "" : "amb-animate"}`} />
      </motion.div>
      <StarField dense={full} reduce={reduce} px={px} py={py} />
      <div className="amb-beams">
        <span className={`amb-beam ${reduce ? "" : "amb-animate"}`} />
        <span className={`amb-beam ${reduce ? "" : "amb-animate"}`} />
      </div>
      <div className="amb-stage">
        {shapes.map((s, i) => (
          <Float key={`${s.kind}-${i}`} s={s} index={i} px={px} py={py} scroll={scroll} reduce={reduce} />
        ))}
      </div>
      <div className="amb-vignette" />
          </div>
  );
}
