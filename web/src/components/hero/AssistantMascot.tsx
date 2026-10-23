"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PORCELAIN } from "../MascotModel";

/**
 * FMD AI's mascot beside the search bar: the guide (web/public/models/assistant.glb, built by
 * model/blender/mascots/build_assistant.sh) with a mood for each moment of the chat, crossfading between its clips:
 * idle (a little hand movement), listening (hand up by the ear, while the visitor types or speaks), thinking (hand to
 * the chin, while the answer comes, with a "…" thought bubble by its head) and explaining (presenting with both hands
 * and talking, while it types out). It blinks now and then over all of them, and turns: towards the visitor while it
 * waits or listens, towards the chat on its right as it explains. Bump ?v= when the GLB is rebuilt.
 */
export const ASSISTANT_URL = "/models/assistant.glb?v=1";

export type Mood = "idle" | "listening" | "thinking" | "explaining";

const FADE = 0.5;
const FOV = 20;
// its turn about its own vertical axis, degrees (positive: its front towards the chat on its right; the guide's own
// three-quarter view, MascotModel's LOOKS, is 25)
const TURNS: Record<Mood, number> = { idle: 6, listening: 8, thinking: 14, explaining: 24 };
const MORPHS = ".morphTargetInfluences";

/** glTF moves all of a mesh's face shapes in one track: split it per shape (three binds `morphTargetInfluences[name]`)
 *  and drop the shapes a clip never moves, so clips layer (a blink over the talking mouth, not half of each) */
function perShape(clip: THREE.AnimationClip, root: THREE.Object3D) {
  const tracks = clip.tracks.flatMap((t) => {
    if (!t.name.endsWith(MORPHS)) return [t];
    const node = t.name.slice(0, -MORPHS.length);
    const mesh = (root.getObjectByName(node) ?? root.getObjectByProperty("uuid", node)) as THREE.Mesh | undefined;
    const names = Object.entries(mesh?.morphTargetDictionary ?? {})
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
    if (names.length !== t.getValueSize()) return [t];
    return names.flatMap((name, k) => {
      const v = t.values.filter((_, i) => i % names.length === k);
      return v.some((x) => x !== 0) ? [new THREE.NumberKeyframeTrack(`${node}${MORPHS}[${name}]`, t.times, v)] : [];
    });
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

class Animator {
  private mixer: THREE.AnimationMixer;
  private moods = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private blink: THREE.AnimationAction | null = null;
  // blinks are spaced on the clips' own clock: where frames are slow (each step capped), a blink keeps its length
  private time = 0;
  private nextBlink = 1.5;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const action = this.mixer.clipAction(perShape(clip, root));
      if (clip.name === "blink") {
        action.setLoop(THREE.LoopOnce, 1);
        this.blink = action;
      } else this.moods.set(clip.name, action);
    }
  }

  set(mood: Mood) {
    const next = this.moods.get(mood);
    if (!next || next === this.current) return;
    // from the clip's start: explaining opens on the painted smile, then starts talking
    next.reset().setEffectiveWeight(1).play();
    if (this.current) next.crossFadeFrom(this.current, FADE, false);
    this.current = next;
  }

  update(dt: number) {
    this.mixer.update(dt);
    this.time += dt;
    if (this.blink && this.time > this.nextBlink) {
      this.blink.reset().play();
      this.nextBlink = this.time + 2.2 + Math.random() * 3.5;
    }
  }

  stop() {
    this.mixer.stopAllAction();
  }
}

function Model({ mood, onReady }: { mood: Mood; onReady: () => void }) {
  const gltf = useGLTF(ASSISTANT_URL);
  const still = useReducedMotion();
  const aniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // its own copy (skinned: its own skeleton), fitted 1 unit tall, feet at y = -0.5, centred for turning about; the
  // textures at full anisotropy, as on the section mascots
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const mesh = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh) : null;
      if (!mesh) return;
      mesh.frustumCulled = false; // skinned bounds are the bind pose's
      const m = mesh.material as THREE.MeshPhysicalMaterial;
      for (const t of [m.map, m.normalMap, m.roughnessMap, m.clearcoatNormalMap])
        if (t && t.anisotropy !== aniso) {
          t.anisotropy = aniso;
          t.needsUpdate = true;
        }
    });
    const b = new THREE.Box3().setFromObject(s);
    const k = 1 / b.getSize(new THREE.Vector3()).y;
    s.scale.setScalar(k);
    const c = b.getCenter(new THREE.Vector3()).multiplyScalar(k);
    s.position.set(-c.x, -0.5 - b.min.y * k, -c.z);
    return s;
  }, [gltf.scene, aniso]);

  const animator = useMemo(() => new Animator(scene, gltf.animations), [scene, gltf.animations]);
  useEffect(() => () => animator.stop(), [animator]);
  useEffect(() => animator.set(mood), [animator, mood]);
  useEffect(() => onReady(), [onReady]);

  // a few frames as soon as it loads, so its shaders are built and it's posed before the chat ever shows it; the turn
  // eases to its mood's (set at once when motion is reduced, which renders only on changes)
  const frames = useRef(0);
  const turner = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (still && turner.current) turner.current.rotation.y = THREE.MathUtils.degToRad(TURNS[mood]);
    invalidate();
  }, [still, mood, invalidate]);
  useFrame((state, dt) => {
    const step = Math.min(dt, 0.1);
    if (!still) {
      animator.update(step);
      const g = turner.current;
      if (g) g.rotation.y = THREE.MathUtils.damp(g.rotation.y, THREE.MathUtils.degToRad(TURNS[mood]), 3, step);
    }
    if (frames.current < 3) {
      frames.current += 1;
      state.invalidate();
    }
  });

  return (
    <group ref={turner} rotation-y={THREE.MathUtils.degToRad(TURNS.idle)}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

/** `active`: the chat is on screen (it renders only then, at the display's rate) */
export default function AssistantMascot({ mood, active }: { mood: Mood; active: boolean }) {
  const still = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onReady = useMemo(() => () => setReady(true), []);
  // frames the 1-unit-tall model with a little room above (a raised hand, a tilted head); the feet near the bottom edge
  const dist = 0.56 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const look = PORCELAIN;
  return (
    <div aria-hidden className={`relative size-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
      <Canvas
        frameloop={active && !still ? "always" : "demand"}
        dpr={[1, 2]}
        camera={{ position: [0, 0.04, dist], fov: FOV }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = look.exposure;
        }}
        style={{ pointerEvents: "none" }}
      >
        {look.ambient && <ambientLight intensity={look.ambient[1]} color={look.ambient[0]} />}
        {look.ground && <hemisphereLight args={["#000000", look.ground[0], look.ground[1]]} />}
        {look.dirs.map(([p, i, c], k) => (
          <directionalLight key={k} position={p} intensity={i} color={c} />
        ))}
        <Suspense fallback={null}>
          <Model mood={mood} onReady={onReady} />
          <Environment resolution={256}>
            {look.panels.map(([p, s, i, c], k) => (
              <Lightformer key={k} form="rect" position={p} scale={s} intensity={i} color={c} />
            ))}
          </Environment>
        </Suspense>
      </Canvas>
      {/* thinking: a "…" by its head, its dots rising in turn */}
      <AnimatePresence>
        {mood === "thinking" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="chat-pane pointer-events-none absolute -top-3 left-[74%] flex origin-bottom-left items-center gap-[3px] rounded-full px-2 py-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1 rounded-full bg-[var(--accent)]"
                animate={still ? { opacity: [0.4, 1, 0.4] } : { y: [0, -2.5, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
