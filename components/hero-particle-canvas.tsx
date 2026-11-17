"use client";

import { useEffect, useRef } from "react";

interface TorusPoint {
  x: number;
  y: number;
  z: number;
  accent: boolean;
  phase: number;
}

interface AmbientParticle {
  /** Normalized screen coordinate with subtle radial bias around the torus. */
  nx: number;
  ny: number;
  depth: number;
  size: number;
  driftRadiusX: number;
  driftRadiusY: number;
  speed: number;
  phase: number;
  accent: boolean;
  vx: number;
  vy: number;
  ox: number;
  oy: number;
}

interface RippleWave {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

const TORUS_SEGMENTS = 96;
const TORUS_TUBE_SEGMENTS = 30;
const AMBIENT_PARTICLE_COUNT = 380;
const GRID_SPACING = 46;
const LIME_RGB = "205, 248, 81";
const MIST_RGB = "236, 242, 232";

/**
 * Generates deterministic 3D points along a torus manifold so the canvas never
 * flickers or shifts pattern across hot reloads.
 */
function buildTorusPoints(
  majorSegments: number,
  minorSegments: number,
): TorusPoint[] {
  const points: TorusPoint[] = [];

  for (let i = 0; i < majorSegments; i++) {
    const u = (i / majorSegments) * Math.PI * 2;
    for (let j = 0; j < minorSegments; j++) {
      const v = (j / minorSegments) * Math.PI * 2;
      const band = (i * 3 + j) % 11 === 0 || (i + j * 2) % 13 === 0;
      const phase = ((i * 7 + j * 13) % 100) / 15;

      // Normalized unit torus parameters (major=1, minor=0.48) scaled per frame.
      const ringRadius = 1 + 0.48 * Math.cos(v);
      points.push({
        x: ringRadius * Math.cos(u),
        y: ringRadius * Math.sin(u),
        z: 0.48 * Math.sin(v),
        accent: band,
        phase,
      });
    }
  }

  return points;
}

/**
 * Deterministic PRNG for SSR-safe, stable ambient starfield dispersion across
 * the full Hero viewport, including softly behind the left copy area.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Builds scattered orbital and full-screen ambient particles that radiate from
 * the 3D torus across the entire viewport, keeping the left headline readable
 * while adding atmospheric depth behind the typography.
 */
function buildAmbientParticles(count: number): AmbientParticle[] {
  const rand = createSeededRandom(43113);
  const particles: AmbientParticle[] = [];

  for (let i = 0; i < count; i++) {
    // 45% radiate outward from the right-shifted torus; 55% span edge-to-edge.
    let nx: number;
    let ny: number;
    if (i < count * 0.45) {
      const angle = rand() * Math.PI * 2;
      const radialSpread = Math.pow(rand(), 0.72) * 0.62;
      nx = 0.66 + Math.cos(angle) * radialSpread * 0.85;
      ny = 0.46 + Math.sin(angle) * radialSpread;
    } else {
      nx = rand();
      ny = rand();
    }

    particles.push({
      nx: Math.min(0.99, Math.max(0.01, nx)),
      ny: Math.min(0.97, Math.max(0.03, ny)),
      depth: 0.25 + rand() * 0.75,
      size: 0.8 + rand() * 1.65,
      driftRadiusX: 4 + rand() * 14,
      driftRadiusY: 4 + rand() * 12,
      speed: 0.35 + rand() * 0.75,
      phase: rand() * Math.PI * 2,
      accent: rand() < 0.48,
      vx: 0,
      vy: 0,
      ox: 0,
      oy: 0,
    });
  }

  return particles;
}

/**
 * Renders an interactive Hero backdrop combining:
 * 1. An interactive dotted matrix grid that ripples around pointer movement.
 * 2. An expanded 380-dot radiating ambient particle field spanning under the headline.
 * 3. A right-shifted, drag-rotatable 3D wireframe-point torus in FACET lime & mist.
 */
export function HeroParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const torusPoints = buildTorusPoints(TORUS_SEGMENTS, TORUS_TUBE_SEGMENTS);
    const ambientParticles = buildAmbientParticles(AMBIENT_PARTICLE_COUNT);
    const ripples: RippleWave[] = [];

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;

    // Rotation state with slow idle drift + pointer drag inertia.
    let rotX = 0.56;
    let rotY = -0.34;
    let rotZ = 0.22;
    let dragVx = 0;
    let dragVy = 0;
    let isDragging = false;
    let dragMoved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const pointer = {
      x: -9999,
      y: -9999,
      smoothX: -9999,
      smoothY: -9999,
      active: false,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, window.innerWidth || 0);
      height = Math.max(rect.height, 420);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnRipple = (x: number, y: number, strength = 1) => {
      ripples.push({
        x,
        y,
        radius: 6,
        alpha: 0.45 * strength,
      });
      if (ripples.length > 6) {
        ripples.shift();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (!pointer.active) {
        pointer.smoothX = x;
        pointer.smoothY = y;
      }

      pointer.x = x;
      pointer.y = y;
      pointer.active = true;

      if (isDragging) {
        const dx = x - lastPointerX;
        const dy = y - lastPointerY;
        if (Math.abs(dx) + Math.abs(dy) > 2) {
          dragMoved = true;
        }
        rotY += dx * 0.0052;
        rotX += dy * 0.0052;
        dragVy = dx * 0.0022;
        dragVx = dy * 0.0022;
        lastPointerX = x;
        lastPointerY = y;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      isDragging = true;
      dragMoved = false;
      lastPointerX = event.clientX - rect.left;
      lastPointerY = event.clientY - rect.top;
      pointer.x = lastPointerX;
      pointer.y = lastPointerY;
      pointer.active = true;
    };

    const onPointerUp = () => {
      if (isDragging && !dragMoved && pointer.active) {
        spawnRipple(pointer.x, pointer.y, 1.15);
      }
      isDragging = false;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      isDragging = false;
    };

    const renderFrame = (timeMs: number) => {
      const t = timeMs * 0.001;
      ctx.clearRect(0, 0, width, height);

      if (pointer.active) {
        pointer.smoothX += (pointer.x - pointer.smoothX) * 0.16;
        pointer.smoothY += (pointer.y - pointer.smoothY) * 0.16;
      }

      // Advance active click ripples.
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].radius += 6.2;
        ripples[i].alpha *= 0.94;
        if (ripples[i].alpha < 0.015) {
          ripples.splice(i, 1);
        }
      }

      // 1. Subtle interactive coordinate dot matrix across the entire Hero.
      const offsetX = ((width % GRID_SPACING) * 0.5) | 0;
      const offsetY = ((height % GRID_SPACING) * 0.5) | 0;
      const interactRadius = 190;
      const interactRadiusSq = interactRadius * interactRadius;

      for (let gx = offsetX; gx < width; gx += GRID_SPACING) {
        for (let gy = offsetY; gy < height; gy += GRID_SPACING) {
          let dx = 0;
          let dy = 0;
          let influence = 0;

          if (pointer.active) {
            const vx = gx - pointer.smoothX;
            const vy = gy - pointer.smoothY;
            const distSq = vx * vx + vy * vy;
            if (distSq < interactRadiusSq && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const norm = 1 - dist / interactRadius;
              influence = norm * norm;
              const push = influence * 14;
              dx += (vx / dist) * push;
              dy += (vy / dist) * push;
            }
          }

          for (const ripple of ripples) {
            const rvx = gx - ripple.x;
            const rvy = gy - ripple.y;
            const rDist = Math.sqrt(rvx * rvx + rvy * rvy);
            const bandDiff = Math.abs(rDist - ripple.radius);
            if (bandDiff < 38 && rDist > 0.01) {
              const wave = (1 - bandDiff / 38) * ripple.alpha;
              influence = Math.min(1, influence + wave * 1.3);
              dx += (rvx / rDist) * wave * 16;
              dy += (rvy / rDist) * wave * 16;
            }
          }

          const dotX = gx + dx;
          const dotY = gy + dy;
          // Keep grid slightly softer behind the left copy so contrast stays crisp.
          const leftFade = gx < width * 0.44 ? 0.65 : 1;
          const alpha = (0.085 + influence * 0.58) * leftFade;
          const dotSize = 1.15 + influence * 2.1;

          ctx.fillStyle = `rgba(${LIME_RGB}, ${alpha.toFixed(3)})`;
          ctx.fillRect(
            dotX - dotSize * 0.5,
            dotY - dotSize * 0.5,
            dotSize,
            dotSize,
          );
        }
      }

      // 2. Full-screen radiating ambient particles (behind headline + across right field).
      const pointerAmbientRadius = 155;
      for (const p of ambientParticles) {
        const baseX =
          p.nx * width + Math.sin(t * p.speed + p.phase) * p.driftRadiusX;
        const baseY =
          p.ny * height +
          Math.cos(t * p.speed * 0.85 + p.phase) * p.driftRadiusY;

        let pushFactor = 0;
        if (pointer.active) {
          const mx = baseX + p.ox - pointer.smoothX;
          const my = baseY + p.oy - pointer.smoothY;
          const dist = Math.sqrt(mx * mx + my * my);
          if (dist < pointerAmbientRadius && dist > 0.1) {
            const force =
              ((pointerAmbientRadius - dist) / pointerAmbientRadius) * 1.45;
            p.vx += (mx / dist) * force;
            p.vy += (my / dist) * force;
            pushFactor = force;
          }
        }

        // Spring return & damping so particles float organically back into place.
        p.vx += -p.ox * 0.055;
        p.vy += -p.oy * 0.055;
        p.vx *= 0.84;
        p.vy *= 0.84;
        p.ox += p.vx;
        p.oy += p.vy;

        const px = baseX + p.ox;
        const py = baseY + p.oy;
        const twinkle = 0.65 + 0.35 * Math.sin(t * (1.2 + p.speed) + p.phase);
        // Slightly attenuate opacity right beneath the left headline block.
        const copyZoneMask = px < width * 0.48 && py < height * 0.72 ? 0.62 : 1;
        const alpha =
          Math.min(
            0.88,
            (0.14 + p.depth * 0.28 + pushFactor * 0.35) * twinkle,
          ) * copyZoneMask;
        const size = p.size * (0.85 + p.depth * 0.35) + pushFactor * 0.9;

        const rgb = p.accent || pushFactor > 0.25 ? LIME_RGB : MIST_RGB;
        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
      }

      // 3. Expanded, right-shifted 3D interactive torus manifold.
      if (!isDragging && !prefersReducedMotion) {
        rotY += 0.0021 + dragVy;
        rotX += 0.0007 + dragVx;
        rotZ += 0.00045;
        dragVx *= 0.93;
        dragVy *= 0.93;
      }

      const tiltOffsetX = pointer.active
        ? ((pointer.smoothY - height * 0.5) / Math.max(height, 1)) * 0.16
        : 0;
      const tiltOffsetY = pointer.active
        ? ((pointer.smoothX - width * 0.5) / Math.max(width, 1)) * 0.22
        : 0;

      const rx = rotX + tiltOffsetX;
      const ry = rotY + tiltOffsetY;
      const rz = rotZ;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosZ = Math.cos(rz);
      const sinZ = Math.sin(rz);

      const centerX = width >= 900 ? width * 0.68 : width * 0.54;
      const centerY = height * 0.44;
      const torusScale = Math.min(width * 0.56, height * 0.56) * 0.48;
      const cameraDistance = torusScale * 3.1;

      const torusRepelRadius = 150;

      for (let i = 0; i < torusPoints.length; i++) {
        const pt = torusPoints[i];
        const sx = pt.x * torusScale;
        const sy = pt.y * torusScale;
        const sz = pt.z * torusScale;

        // Rotate X -> Y -> Z
        const y1 = sy * cosX - sz * sinX;
        const z1 = sy * sinX + sz * cosX;
        const x2 = sx * cosY + z1 * sinY;
        const z2 = -sx * sinY + z1 * cosY;
        const x3 = x2 * cosZ - y1 * sinZ;
        const y3 = x2 * sinZ + y1 * cosZ;

        const depthFactor = cameraDistance / Math.max(24, cameraDistance - z2);
        let screenX = centerX + x3 * depthFactor;
        let screenY = centerY + y3 * depthFactor;

        let proximityGlow = 0;
        if (pointer.active) {
          const pdx = screenX - pointer.smoothX;
          const pdy = screenY - pointer.smoothY;
          const pDistSq = pdx * pdx + pdy * pdy;
          if (pDistSq < torusRepelRadius * torusRepelRadius && pDistSq > 0.1) {
            const pDist = Math.sqrt(pDistSq);
            const strength = 1 - pDist / torusRepelRadius;
            proximityGlow = strength;
            const repel = strength * strength * 26 * depthFactor;
            screenX += (pdx / pDist) * repel;
            screenY += (pdy / pDist) * repel;
          }
        }

        if (
          screenX < -20 ||
          screenX > width + 20 ||
          screenY < -20 ||
          screenY > height + 20
        ) {
          continue;
        }

        const normalizedDepth = Math.min(
          1,
          Math.max(0, (depthFactor - 0.68) / 0.72),
        );
        const pulse = 0.85 + 0.15 * Math.sin(t * 1.8 + pt.phase);
        const alpha =
          (0.11 + normalizedDepth * 0.62 + proximityGlow * 0.27) * pulse;
        const dotSize =
          (1.05 + normalizedDepth * 1.45 + proximityGlow * 1.3) *
          (pt.accent ? 1.18 : 1);

        const color = pt.accent || proximityGlow > 0.18 ? LIME_RGB : MIST_RGB;
        ctx.fillStyle = `rgba(${color}, ${Math.min(0.95, alpha).toFixed(3)})`;
        ctx.fillRect(
          screenX - dotSize * 0.5,
          screenY - dotSize * 0.5,
          dotSize,
          dotSize,
        );
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(canvas);
    }

    if (prefersReducedMotion) {
      renderFrame(0);
    } else {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      resizeObserver?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}
