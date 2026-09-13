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

/** A bump that rises fast and falls slowly — how a pulse feels. */
function bump(p: number, at: number, rise: number, fall: number) {
  const d = (p - at) / (p < at ? rise : fall);
  return Math.exp(-d * d);
}

/** One heartbeat over a period of 0..1: a strong beat, a softer one, rest. */
function beat(p: number) {
  return bump(p, 0.06, 0.025, 0.09) + 0.62 * bump(p, 0.27, 0.03, 0.1);
}

const PERIOD = 1.3; // seconds per beat
const RIPPLE = 0.38; // fraction of a beat for the wave to reach the rim
const SWING = 0.55; // at the top of the beat: ~1.55x its resting size

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
      const glow = new THREE.Color("#2fbf84");
      // Vertices light up on their own: the emissive term is scaled per
      // instance by an attribute the beat drives, so each one can flare.
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.45,
        roughness: 0.25,
        emissive: new THREE.Color("#0c9e60"),
      });
      nodeMat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vGlow;")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;");
      };

      // A soft halo around each vertex, always facing the camera.
      const haloMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: glow.clone() }, uScale: { value: 1 } },
        vertexShader: `
          attribute float aSize;
          attribute float aAlpha;
          varying float vAlpha;
          uniform float uScale;
          void main() {
            vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
            gl_FragColor = vec4(uColor, a * vAlpha);
          }`,
      });

      const ink = new THREE.Color();
      const nodeBase = new THREE.Color();
      const beatColor = new THREE.Color("#12b36f"); // deeper than the glow, so the peak reads as green, not mint
      let dark = false;
      const scene = new THREE.Scene();
      const rim = new THREE.PointLight(0x2fbf84, 18, 10);
      const paint = () => {
        ink.set(readInk());
        dark = document.documentElement.dataset.theme === "dark";
        // On paper: deep slate that still shows its bevel. On a dark ground:
        // a cool pewter, so the green of the beat is what catches the eye.
        // Dark ground: the network is neutral light steel — no green in it at
        // all — so it stands clear of the background, and green belongs only
        // to a vertex that is beating. Paper: slate with green-lit edges.
        face.color.set(dark ? "#b4c2d0" : ink.getHex());
        side.color.set(dark ? "#6f8296" : ink.clone().lerp(glow, 0.45).getHex());
        nodeBase.set(dark ? "#f4f7fa" : ink.getHex());
        rim.color.set(dark ? "#b9c9dd" : "#2fbf84");
        rim.intensity = dark ? 10 : 18;
        scene.environmentIntensity = dark ? 0.9 : 0.35;
        // Strong enough to glow, not so strong the tone mapping bleaches it to mint.
        nodeMat.emissiveIntensity = dark ? 1.15 : 0.7;
        haloMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        haloMat.needsUpdate = true;
      };
      paint();

      const network = new THREE.Mesh(geometry, [face, side]);
      network.scale.set(unit, -unit, unit); // SVG y points down

      // ── the vertices: one sphere each, all in one draw call ──────────────
      const nodes = nodeData.nodes;
      const reach = Math.max(...nodes.map((n) => Math.hypot(n.x - center.x, n.y - center.y))) || 1;
      const sphere = new THREE.SphereGeometry(1, 32, 24);
      const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1);
      sphere.setAttribute("aGlow", glowAttr);
      const beads = new THREE.InstancedMesh(sphere, nodeMat, nodes.length);
      const place = nodes.map((n, i) => ({
        x: (n.x - center.x) * unit,
        y: -(n.y - center.y) * unit,
        r: restRadius(n.r) * unit,
        // Outward from the eye, with a little per-vertex drift so the wave
        // reads as alive rather than mechanical.
        delay: (Math.hypot(n.x - center.x, n.y - center.y) / reach) * RIPPLE + Math.sin(i * 12.9898) * 0.025,
      }));

      const haloGeo = new THREE.BufferGeometry();
      haloGeo.setAttribute("position", new THREE.Float32BufferAttribute(place.flatMap((p) => [p.x, p.y, 0.02]), 3));
      const haloSize = new THREE.Float32BufferAttribute(new Float32Array(nodes.length), 1);
      const haloAlpha = new THREE.Float32BufferAttribute(new Float32Array(nodes.length), 1);
      haloGeo.setAttribute("aSize", haloSize);
      haloGeo.setAttribute("aAlpha", haloAlpha);
      const halos = new THREE.Points(haloGeo, haloMat);
      halos.renderOrder = 2;
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
          const k = Math.min(1, b);
          beads.setColorAt(i, tint.copy(nodeBase).lerp(beatColor, k));
          glowAttr.setX(i, k);
          haloSize.setX(i, p.r * (dark ? 5.5 + 5 * k : 4 + 3.5 * k));
          haloAlpha.setX(i, dark ? 0.06 + 0.9 * k : 0.03 + 0.45 * k);
        });
        beads.instanceMatrix.needsUpdate = true;
        if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
        glowAttr.needsUpdate = true;
        haloSize.needsUpdate = true;
        haloAlpha.needsUpdate = true;
      };
      pulse(reduce ? null : 0);

      const pivot = new THREE.Group();
      pivot.add(network, beads, halos);
      scene.add(pivot);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(2.5, 3, 4);
      scene.add(key);
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
        haloMat.uniforms.uScale.value =
          renderer.domElement.height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
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
      let frozen = false; // development only: hold one instant to inspect it
      const clock = new THREE.Clock();
      const frame = () => {
        const t = clock.getElapsedTime();
        pulse(t);
        const swayY = Math.sin(t * 0.45) * 0.22;
        const swayX = Math.sin(t * 0.31) * 0.08;
        pivot.rotation.y += (swayY + target.y - pivot.rotation.y) * 0.06;
        pivot.rotation.x += (swayX + target.x - pivot.rotation.x) * 0.06;
        renderer.render(scene, camera);
        if (visible && !document.hidden && !frozen) raf = requestAnimationFrame(frame);
      };

      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __logo3d?: unknown }).__logo3d = {
          at(t: number, ry = -0.28) {
            frozen = true;
            stop();
            pulse(t);
            pivot.rotation.set(0.08, ry, 0);
            renderer.render(scene, camera);
          },
          play: () => {
            frozen = false;
            start();
          },
        };
      }

      // First frame before showing anything: never a blank flash.
      pivot.rotation.set(0.08, -0.28, 0);
      renderer.render(scene, camera);
      setReady(true);

      const start = () => {
        if (reduce || raf || frozen) return;
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
        haloGeo.dispose();
        haloMat.dispose();
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
