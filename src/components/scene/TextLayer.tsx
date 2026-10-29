"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { glText } from "@/lib/glText";

/**
 * The hero copy, inside the photograph.
 *
 * Every `[data-gl]` line under `glText.root` is redrawn — same font, size,
 * spacing, position, opacity and line-mask clipping as the DOM — into one
 * screen-sized texture on a quad glued to the camera. Because it renders
 * before post-processing, the cursor wake, bloom and grain treat the type
 * exactly like the landscape. While GSAP is moving lines (`glText.live`) the
 * texture is redrawn every frame, so the DOM timeline drives the GL copy.
 *
 * `glText.warp` melts the type on exit: a liquid ripple plus a channel split
 * that leaves prismatic fringes, the same beat as the reference.
 */
const vertex = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uWarp;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float w = uWarp;
    uv.x += sin(uv.y * 38.0 + uTime * 7.0) * 0.010 * w + sin(uv.y * 9.0 - uTime * 3.0) * 0.018 * w * w;
    uv.y += sin(uv.x * 22.0 - uTime * 5.0) * 0.006 * w;
    vec2 off = vec2(0.006, 0.002) * w;
    float r = texture2D(uMap, uv + off).a;
    float g = texture2D(uMap, uv).a;
    float b = texture2D(uMap, uv - off * 1.6).a;
    float a = max(r, max(g, b));
    if (a < 0.003) discard;
    vec3 c = vec3(r, g, b) / a;
    // Fringes lean green/yellow like the reference's melt, core stays white.
    c = mix(c, c * vec3(0.92, 1.0, 0.7), w * 0.6);
    gl_FragColor = vec4(c * 0.9, a);
  }
`;

function alphaOf(el: HTMLElement, root: HTMLElement) {
  let a = 1;
  for (let n: HTMLElement | null = el; n && n !== root.parentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none") return 0;
    a *= parseFloat(cs.opacity);
    if (a < 0.005) return 0;
  }
  return a;
}

export function TextLayer() {
  const { camera } = useThree();
  const mesh = useRef<THREE.Mesh>(null);
  const drawn = useRef(-1);

  const { canvas, texture, material } = useMemo(() => {
    const canvas = document.createElement("canvas");
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uMap: { value: texture }, uWarp: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    return { canvas, texture, material };
  }, []);

  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  const draw = () => {
    const root = glText.root;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (root) {
      g.fillStyle = "#fff";
      g.textBaseline = "alphabetic";
      root.querySelectorAll<HTMLElement>("[data-gl]").forEach((line) => {
        const alpha = alphaOf(line, root);
        if (alpha <= 0) return;
        const cs = getComputedStyle(line);
        const r = line.getBoundingClientRect();
        g.save();
        // Respect the line mask so rise-in / slide-out reveals match the DOM.
        const mask = line.closest<HTMLElement>(".line-mask");
        if (mask) {
          const m = mask.getBoundingClientRect();
          g.beginPath();
          // Clip vertically only: lines also travel sideways with the camera.
          g.rect(0, m.top, w, m.height);
          g.clip();
        }
        g.globalAlpha = alpha;
        g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string; wordSpacing?: string };
        ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
        ctx.wordSpacing = cs.wordSpacing === "normal" ? "0px" : cs.wordSpacing;
        const raw = line.textContent ?? "";
        const text = cs.textTransform === "uppercase" ? raw.toUpperCase() : raw;
        const m = g.measureText(text);
        const asc = m.fontBoundingBoxAscent;
        const desc = m.fontBoundingBoxDescent;
        const baseline = r.top + (r.height - (asc + desc)) / 2 + asc;
        g.fillText(text, r.left, baseline);
        g.restore();
      });
    }
    texture.needsUpdate = true;
  };

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    if (glText.live || drawn.current !== glText.version) {
      draw();
      drawn.current = glText.version;
    }
    material.uniforms.uWarp.value = glText.warp;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    m.visible = glText.visible;
    const cam = camera as THREE.PerspectiveCamera;
    const d = 1;
    const hh = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    m.position.copy(cam.position);
    m.quaternion.copy(cam.quaternion);
    m.translateZ(-d);
    m.scale.set(hh * cam.aspect, hh, 1);
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={1000} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
