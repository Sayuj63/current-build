"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { KEY, KEY_PORTRAIT, RING_STEP, thetaAt } from "@/lib/journey";
import { JOURNEY_END, motion } from "@/lib/motion";
import { MARK } from "./terrain";
import { useApp } from "@/lib/store";

const START = new THREE.Vector3(0, 4.2, 19);

/** Catmull-Rom through keyframes: smooth even when passing chapters mid-move. */
function spline(k: number[], p: number) {
  const n = k.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(p)));
  const t = Math.min(1, Math.max(0, p - i));
  const p0 = k[Math.max(0, i - 1)];
  const p1 = k[i];
  const p2 = k[Math.min(n, i + 1)];
  const p3 = k[Math.min(n, i + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Glides in from a high, pulled-back position as the portal opens, then
 * circles the mark as the visitor scrolls — one full revolution, ending face
 * to face with the ring — with parallax that follows the cursor.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const orbit = useMemo(() => new THREE.Vector3(), []);
  const par = useRef({ x: 0, y: 0 });
  const roll = useRef(0);

  useFrame((state, dt) => {
    const k = motion.intro;
    const t = state.clock.elapsedTime;
    const p = Math.min(JOURNEY_END, Math.max(0, motion.p));
    const key = size.width < size.height ? KEY_PORTRAIT : KEY;

    // Angle is linear between keyframes (never runs backwards); the spring
    // on motion.p supplies the ease in and out of every move.
    const theta = thetaAt(p);
    const r = spline(key.radius, p);
    const h = spline(key.height, p);
    const side = spline(key.side, p);
    const lookY = spline(key.lookY, p);
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    orbit.set(MARK.x + sin * r, h, MARK.z + cos * r);

    // Hand-held life fades out as we dive, so the ring stays dead centre.
    const live = k * (1 - Math.min(1, Math.max(0, (p - RING_STEP) / 0.6)));
    par.current.x = THREE.MathUtils.damp(par.current.x, motion.pointer.x, 2.2, dt);
    par.current.y = THREE.MathUtils.damp(par.current.y, motion.pointer.y, 2.2, dt);
    pos.lerpVectors(START, orbit, k);
    // Parallax and drift move along the camera's own right vector.
    const lateral = par.current.x * 0.45 + Math.sin(t * 0.13) * 0.28;
    pos.x += cos * lateral * live;
    pos.z += -sin * lateral * live;
    pos.y += (par.current.y * 0.2 + Math.sin(t * 0.21) * 0.09) * live;
    camera.position.copy(pos);

    look.set(MARK.x + cos * side, lookY, MARK.z - sin * side);
    look.x += cos * par.current.x * 0.25 * live;
    look.z += -sin * par.current.x * 0.25 * live;
    look.y += par.current.y * 0.1 * live + (1 - k) * 0.8;
    camera.lookAt(look);

    // Bank into the orbit in proportion to its speed, like a drone.
    roll.current = THREE.MathUtils.damp(roll.current, -motion.v * 0.035 * (p < RING_STEP ? 1 : 0), 3, dt);
    camera.rotateZ(roll.current + Math.sin(t * 0.15) * 0.006 * live);
  });
  return null;
}

/**
 * GPU warm-up. Runs once everything inside <Suspense> has resolved: compiles
 * every program up front, then lets a few real frames go through so textures
 * and render targets are allocated. Only then does the loader reach 100.
 */
export function Warmup() {
  const { gl, scene, camera } = useThree();
  const setProgress = useApp((s) => s.setProgress);
  const frames = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    gl.compile(scene, camera);
  }, [gl, scene, camera]);

  useFrame(() => {
    if (done.current) return;
    frames.current += 1;
    setProgress({ gpu: Math.min(1, frames.current / 8) });
    if (frames.current >= 8) done.current = true;
  });
  return null;
}
