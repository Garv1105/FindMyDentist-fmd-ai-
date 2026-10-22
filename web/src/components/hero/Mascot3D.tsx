"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MotionValue } from "motion/react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * The seated hero mascot (the Tripo model, built by model/blender/tripo: prep_tripo.py … sit, rig_tripo.py … sit,
 * anim_sit_tripo.py; meshopt-compressed). Clips:
 *   loops     Fly (palms-up T-pose wing beats, back into the yoga pose), Meditate, Idle, Typing, Talk,
 *             Think (hand at chin), Explain (talks while presenting)
 *   one-shots Wake, Wave, PointLeft, PointRight, Present, ThumbsUp, Clap, Happy, LookAround, Brows, Nod, HeadShake,
 *             Smile (each starts and ends in the Idle pose, so they chain)
 *   layer     Blink (eyes/lids only; played additively)
 * Point/Present directions are from the viewer: PointRight points to the viewer's right.
 */
// bump ?v= whenever the GLB is rebuilt, or browsers keep the cached old model
// the raw Tripo seated model, no rig (from "tooth character 3d model sitting.glb": Blender decimate to 400k tris,
// gltf-transform center, the head's sculpted seam/pit faired off with the face pinned, meshopt + WebP 2048 → 2.5 MB);
// it floats, bobs its hands and flutters its coat tails (forearm + coat bones, arms_raw.py); the clips below need the
// rigged one
const MODEL_URL = "/mascot-sitting-raw.glb?v=5";
// const MODEL_URL = "/mascot-sitting.glb?v=20"; // rigged + animated (Fly, Meditate, face)
// const MODEL_URL = "/mascot-sitting-org.glb?v=20";
const FADE = 0.45;
const AMBIENT = ["LookAround", "Smile", "Nod"];

class MascotAnimator {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private gesture: THREE.AnimationAction | null = null;
  private queue: string[] = [];
  private base = "Fly";
  private blink: THREE.AnimationAction | null = null;
  private nextBlink = 2;
  private nextAmbient = Infinity;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      if (clip.name === "Blink") {
        this.blink = this.mixer.clipAction(THREE.AnimationUtils.makeClipAdditive(clip.clone()));
        this.blink.setLoop(THREE.LoopOnce, 1);
      } else {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      }
    }
    this.mixer.addEventListener("finished", (e) => {
      if (e.action !== this.gesture) return;
      this.gesture = null;
      const next = this.queue.shift();
      if (next) this.fadeTo(next, true);
      else this.fadeTo(this.base, false);
    });
  }

  /** Looping clip to rest in; interrupts whatever is playing. */
  setBase(name: string) {
    this.base = name;
    this.queue = [];
    this.fadeTo(name, false);
    this.nextAmbient = Infinity;
  }

  /** Play one-shot clips in order, then return to the base loop. */
  play(...names: string[]) {
    const [first, ...rest] = names.filter((n) => this.actions.has(n));
    if (!first) return;
    this.queue = rest;
    this.fadeTo(first, true);
  }

  private fadeTo(name: string, once: boolean) {
    const next = this.actions.get(name);
    if (!next || (!once && next === this.current)) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, FADE, false);
    next.play();
    this.current = next;
    this.gesture = once ? next : null;
  }

  update(dt: number, time: number) {
    this.mixer.update(dt);
    const idle = !this.gesture && this.current === this.actions.get("Idle");
    const eyesOpen = !this.gesture && ["Idle", "Typing", "Talk", "Think", "Explain"].some((n) => this.current === this.actions.get(n));
    if (this.blink && time > this.nextBlink) {
      if (eyesOpen) this.blink.reset().play(); // only over open eyes: an additive blink would fight closed ones
      this.nextBlink = time + 2.5 + Math.random() * 3;
    }
    // a little life while it waits: an occasional glance around, smile or nod
    if (this.base === "Idle" && this.nextAmbient === Infinity) this.nextAmbient = time + 9;
    if (idle && time > this.nextAmbient) {
      this.play(AMBIENT[Math.floor(Math.random() * AMBIENT.length)]);
      this.nextAmbient = time + 9 + Math.random() * 5;
    }
  }

  stop() {
    this.mixer.stopAllAction();
    this.current = null;
    this.gesture = null;
    this.queue = [];
  }
}

type Props = {
  /** looping clip to rest in (Meditate, Fly, Idle, Talk, Think, Explain) */
  base: string;
  /** one-shot clip; pass a new object to (re)play it, then it returns to `base` */
  gesture?: { name: string; id: number } | null;
  /** scroll-driven turn about its own vertical axis, degrees */
  rotY?: MotionValue<number>;
  onReady?: () => void;
  /** every frame: the mouth's position in % of the canvas, and how much it faces the viewer (0 = turned away, 1 = front) */
  onMouth?: (leftPct: number, topPct: number, facing: number) => void;
};

const _mouth = new THREE.Vector3();
const _head = new THREE.Vector3();
const _bob = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);

function Model({ base, gesture, rotY, onReady, onMouth }: Props) {
  const gltf = useGLTF(MODEL_URL);
  // each canvas gets its own copy: one three.js object can't sit in two scenes (hero rise + search bar)
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const animations = gltf.animations;
  const animator = useMemo(() => new MascotAnimator(scene, animations), [scene, animations]);
  const group = useRef<THREE.Group>(null);
  // the raw model's forearm and coat-tail bones (bone axis points forward, so turning about it raises/lowers what hangs
  // off it), each with its rest pose and side sign (+ for the left bone, so both sides rise together)
  const swing = useMemo(
    () =>
      ["handL", "handR", "coatL", "coatR"].flatMap((name) => {
        const bone = scene.getObjectByName(name);
        return bone ? [{ bone, rest: bone.quaternion.clone(), sign: name.endsWith("L") ? 1 : -1, coat: name.startsWith("coat") }] : [];
      }),
    [scene],
  );

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; // skinned bounds are bind-pose only
    });
    onReady?.();
    return () => animator.stop();
  }, [scene, animator, onReady]);

  useEffect(() => animator.setBase(base), [animator, base]);
  useEffect(() => {
    if (gesture) animator.play(gesture.name);
  }, [animator, gesture]);

  useFrame((state, dt) => {
    animator.update(Math.min(dt, 0.1), state.clock.elapsedTime);
    if (group.current && rotY) group.current.rotation.y = THREE.MathUtils.degToRad(rotY.get());
    // a model without clips (the raw one) gets a gentle float so it doesn't sit frozen
    if (group.current && animations.length === 0) group.current.position.y = 0.01 * Math.sin(state.clock.elapsedTime * 1.2);
    // …its hands bob a few degrees about the elbows, and its coat tails flutter about the hips, a bit faster
    const t = state.clock.elapsedTime;
    for (const { bone, rest, sign, coat } of swing) {
      const a = coat ? 0.08 * Math.sin(t * 2.2) : 0.12 * Math.sin(t * 1.2);
      bone.quaternion.copy(rest).multiply(_bob.setFromAxisAngle(_axisY, sign * a));
    }
    const mouth = scene.getObjectByName("mouth");
    const head = scene.getObjectByName("head");
    if (onMouth && mouth && head) {
      group.current?.updateMatrixWorld();
      mouth.getWorldPosition(_mouth);
      head.getWorldPosition(_head);
      // facing: the mouth is nearer the camera than the head's centre
      const facing = _head.distanceTo(state.camera.position) - _mouth.distanceTo(state.camera.position);
      _mouth.project(state.camera);
      onMouth((_mouth.x + 1) * 50, (1 - _mouth.y) * 50, THREE.MathUtils.clamp(facing / 0.04, 0, 1));
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);

export default function Mascot3D({ active, ...props }: Props & { active: boolean }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      // measure the unscaled box: the parent is CSS-scaled while rising, and a scaled measure shrinks the canvas off-centre
      resize={{ offsetSize: true }}
      // the model is 1 unit tall, sitting on y=-0.5; the canvas is wider than tall so waving/pointing arms fit
      camera={{ position: [0, 0.03, 2.15], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      style={{ pointerEvents: "none" }}
    >
      {/* meditate.png's light (fitted to it colour for colour): a high-key studio - the white porcelain reads faintly
          pink-white, its left side and left lobe sky-blue with a blue rim, the right warm with a peach rim, a lavender
          rim along the top and lavender underneath */}
      <ambientLight intensity={0.9} color="#fff3f3" />
      <hemisphereLight args={["#000000", "#b4a8f0", 0.5]} />
      <directionalLight position={[0, 0.3, 4]} intensity={1} color="#fff0f0" />
      <directionalLight position={[2.6, 2.4, 3]} intensity={2} color="#ffe6dc" />
      <directionalLight position={[-4, 0.3, 0.4]} intensity={2.6} color="#6fb1ff" />
      <directionalLight position={[-3, -1.5, 1]} intensity={1.4} color="#6fb1ff" />
      {/* rims from behind: blue on the left contours, peach on the right */}
      <directionalLight position={[-2, 1, -3]} intensity={7} color="#6fb1ff" />
      <directionalLight position={[-3, 0.5, -2]} intensity={5} color="#6fb1ff" />
      <directionalLight position={[2, 1, -3]} intensity={5} color="#ffd6c2" />
      <Model {...props} />
      {/* softboxes the glossy, clear-coated head mirrors: streaks on the lobes and sides, the lavender top rim */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={5} position={[0, 3.5, -3]} scale={[8, 3, 1]} color="#b4a8f0" />
        <Lightformer form="rect" intensity={6} position={[3, 3.5, 1]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={4} position={[-3, 3.5, 1]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={4} position={[3, 0.6, 3]} scale={[1.2, 5, 1]} />
        <Lightformer form="rect" intensity={2} position={[-3, 0.6, 3]} scale={[1.2, 5, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-5, 0.5, 1.5]} scale={[6, 5, 1]} color="#6fb1ff" />
      </Environment>
    </Canvas>
  );
}
