"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Squash mark, in three dimensions, with a heartbeat.
 *
 * The logo is split in two, both taken from the real artwork:
 *  - the network — every edge and the eye — traced to SVG with the vertices
 *    cut out (public/brand/mark-network.svg), extruded into one solid that
 *    never changes shape;
 *  - the 40 vertices, found in the artwork by shape (public/brand/
 *    mark-nodes.json), each a sphere that beats: lub-dub, then rest. The beat
 *    starts at the eye and ripples outward, and each vertex flushes green at
 *    the top of its beat. Only the vertices move; the edges hold still.
 *
 * Built to never cost the page anything it cannot afford:
 *  - the flat logo shows first and stays if WebGL is missing or anything
 *    fails, so the hero is never empty;
 *  - three.js is loaded only here, after the page is interactive;
 *  - it renders one frame before it is shown, so it never flashes blank;
 *  - it stops drawing when off screen or when the tab is hidden;
 *  - with reduced motion it is a still, lit render — no loop at all;
 *  - it follows the light/dark theme.
 */

interface NodeSpec {
  x: number;
  y: number;
  r: number;
}

/** One heartbeat over a period of 0..1: a strong beat, a softer one, rest. */
function beat(p: number) {
  const lub = Math.exp(-(((p - 0.07) / 0.05) ** 2));
  const dub = 0.65 * Math.exp(-(((p - 0.26) / 0.06) ** 2));
  return lub + dub;
}

const PERIOD = 1.25; // seconds per beat
const RIPPLE = 0.42; // fraction of a beat for the wave to reach the rim
const SWING = 0.42; // at the top of the beat: ~1.4x its resting size

/** The hole cut for each vertex in mark-network.svg is 1.06·r + 3 (artwork
 * units); at rest the sphere fills it exactly, so the logo reads as drawn. */
const restRadius = (r: number) => r * 1.06 + 3.5;

export function Logo3D({ alt }: { alt: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let disposed = false;
    let cleanup = () => {};

    const probe = document.createElement("canvas");
    const hasGL = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    if (!hasGL) return;

    (async () => {
      const THREE = await import("three");
      const { SVGLoader } = await import("three/addons/loaders/SVGLoader.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const [svgText, nodeData] = await Promise.all([
        fetch("/brand/mark-network.svg").then((r) => r.text()),
        fetch("/brand/mark-nodes.json").then((r) => r.json() as Promise<{ nodes: NodeSpec[] }>),
      ]);
      if (disposed) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // ── the network: edges and eye, extruded ─────────────────────────────
      const data = new SVGLoader().parse(svgText);
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: 70,
        bevelEnabled: true,
        bevelThickness: 10,
        bevelSize: 5,
        bevelSegments: 3,
        curveSegments: 5,
      });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const center = new THREE.Vector3();
      box.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
      const size = new THREE.Vector3();
      box.getSize(size);
      const unit = 2 / Math.max(size.x, size.y);

      // ── look: follows the theme's ink colour ─────────────────────────────
      const readInk = () =>
        getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1b2430";
      const face = new THREE.MeshStandardMaterial({ metalness: 0.65, roughness: 0.34 });
      const side = new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.22 });
      const nodeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.28 });
      const ink = new THREE.Color();
      const glow = new THREE.Color("#2fbf84");
      const scene = new THREE.Scene();
      const paint = () => {
        ink.set(readInk());
        const dark = document.documentElement.dataset.theme === "dark";
        // On paper: deep slate that still shows its bevel. On a dark ground:
        // the light ink becomes polished metal.
        face.color.copy(ink);
        side.color.copy(ink).lerp(glow, dark ? 0.22 : 0.45);
        scene.environmentIntensity = dark ? 1 : 0.35;
      };
      paint();

      const network = new THREE.Mesh(geometry, [face, side]);
      network.scale.set(unit, -unit, unit); // SVG y points down

      // ── the vertices: one sphere each, all in one draw call ──────────────
      const nodes = nodeData.nodes;
      const reach = Math.max(...nodes.map((n) => Math.hypot(n.x - center.x, n.y - center.y))) || 1;
      const sphere = new THREE.SphereGeometry(1, 28, 20);
      const beads = new THREE.InstancedMesh(sphere, nodeMat, nodes.length);
      const place = nodes.map((n) => ({
        x: (n.x - center.x) * unit,
        y: -(n.y - center.y) * unit,
        r: restRadius(n.r) * unit,
        delay: (Math.hypot(n.x - center.x, n.y - center.y) / reach) * RIPPLE,
      }));
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const tint = new THREE.Color();
      // t === null: at rest (reduced motion) — every vertex its drawn size.
      const pulse = (t: number | null) => {
        place.forEach((p, i) => {
          const b = t === null ? 0 : beat((((t / PERIOD - p.delay) % 1) + 1) % 1);
          const s = p.r * (1 + SWING * b);
          pos.set(p.x, p.y, 0);
          scl.set(s, s, s);
          m.compose(pos, q, scl);
          beads.setMatrixAt(i, m);
          beads.setColorAt(i, tint.copy(ink).lerp(glow, Math.min(1, b) * 0.7));
        });
        beads.instanceMatrix.needsUpdate = true;
        if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
      };
      pulse(reduce ? null : 0);

      const pivot = new THREE.Group();
      pivot.add(network, beads);
      scene.add(pivot);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(2.5, 3, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0x2fbf84, 18, 10);
      rim.position.set(-2.4, -1.2, 1.6);
      scene.add(rim);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0, 4.6);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // A soft studio to reflect: metal without an environment is just black.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envMap;
      pmrem.dispose();
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.className = "logo3d-canvas";

      const fit = () => {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      fit();
      el.appendChild(renderer.domElement);

      // ── motion: the beat, an idle sway, and a lean toward the pointer ────
      const target = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        target.y = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
        target.x = ((e.clientY - r.top) / r.height - 0.5) * 0.6;
      };
      const onLeave = () => {
        target.x = 0;
        target.y = 0;
      };

      let raf = 0;
      let visible = true;
      const clock = new THREE.Clock();
      const frame = () => {
        const t = clock.getElapsedTime();
        pulse(t);
        const swayY = Math.sin(t * 0.55) * 0.3;
        const swayX = Math.sin(t * 0.38) * 0.1;
        pivot.rotation.y += (swayY + target.y - pivot.rotation.y) * 0.06;
        pivot.rotation.x += (swayX + target.x - pivot.rotation.x) * 0.06;
        renderer.render(scene, camera);
        if (visible && !document.hidden) raf = requestAnimationFrame(frame);
      };

      // First frame before showing anything: never a blank flash.
      pivot.rotation.set(0.08, -0.28, 0);
      renderer.render(scene, camera);
      setReady(true);

      const start = () => {
        if (reduce || raf) return;
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
      io.observe(el);
      const onVisibility = () => (document.hidden ? stop() : visible && start());
      document.addEventListener("visibilitychange", onVisibility);

      const ro = new ResizeObserver(() => {
        fit();
        if (reduce || !raf) renderer.render(scene, camera);
      });
      ro.observe(el);

      const mo = new MutationObserver(() => {
        paint();
        if (reduce || !raf) {
          pulse(reduce ? null : clock.getElapsedTime());
          renderer.render(scene, camera);
        }
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      if (!reduce) {
        el.addEventListener("pointermove", onPointer);
        el.addEventListener("pointerleave", onLeave);
      }
      start();

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        mo.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        el.removeEventListener("pointermove", onPointer);
        el.removeEventListener("pointerleave", onLeave);
        geometry.dispose();
        sphere.dispose();
        beads.dispose();
        envMap.dispose();
        face.dispose();
        side.dispose();
        nodeMat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {
      // Anything goes wrong: the flat logo is already there, and stays.
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={host} className={ready ? "logo3d is-ready" : "logo3d"}>
      <img src="/brand/mark.svg" alt={alt} width={420} height={353} className="logo3d-flat" />
    </div>
  );
}
