"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type Clip =
  | "Idle" | "Walk" | "Meditate"                                   // loops
  | "Wave" | "Point" | "Celebrate" | "Nod" | "HeadShake" | "Think"; // one-shot gestures

type Props = {
  /** looping clip to rest in (e.g. chosen by scroll position) */
  base: string;
  /** one-shot gesture; pass a new object to (re)play it */
  gesture?: { name: string; id: number } | null;
  url?: string;
  /** viewer mode: orbit all the way round and zoom; no hover/click gestures */
  free?: boolean;
};

const MODEL_URL = "/mascot.glb";
const FADE = 0.35;

/** Owns the mixer: cross-fades, gesture -> base fallback, layered blink. */
class MascotAnimator {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private gesture: THREE.AnimationAction | null = null;
  private base = "Idle";
  private blink: THREE.AnimationAction | null = null;
  private nextBlink = 2;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      if (clip.name === "Blink") {
        // eyes/lids only; additive so it layers on top of any clip
        this.blink = this.mixer.clipAction(THREE.AnimationUtils.makeClipAdditive(clip.clone()));
        this.blink.setLoop(THREE.LoopOnce, 1);
      } else {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      }
    }
    this.mixer.addEventListener("finished", (e) => {
      if (e.action === this.gesture) {
        this.gesture = null;
        this.fadeTo(this.base, false);
      }
    });
  }

  get busy() {
    return this.gesture !== null;
  }

  setBase(name: string) {
    this.base = name;
    if (!this.gesture) this.fadeTo(name, false); // a running gesture finishes first
  }

  play(name: string) {
    this.fadeTo(name, true);
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
    const eyesClosed = this.current === this.actions.get("Meditate");

    if (this.blink && time > this.nextBlink) {
      // only over a plain loop with open eyes: an additive blink would fight closed or animated eyes
      if (!eyesClosed && !this.gesture) this.blink.reset().play();
      this.nextBlink = time + 2.5 + Math.random() * 3;
    }

  }

  /** Stop everything but stay reusable: React StrictMode unmounts and remounts with the same instance. */
  stop() {
    this.mixer.stopAllAction();
    this.current = null;
    this.gesture = null;
  }
}

function Model({ base, gesture, url = MODEL_URL, free }: Props) {
  const { scene, animations } = useGLTF(url);
  const animator = useMemo(() => new MascotAnimator(scene, animations), [scene, animations]);
  const lastHoverWave = useRef(-10);

  useEffect(() => {
    // skinned meshes keep their bind-pose bounds; jumps would get culled otherwise
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
    return () => animator.stop();
  }, [scene, animator]);

  useEffect(() => animator.setBase(base), [animator, base]);
  useEffect(() => {
    if (gesture) animator.play(gesture.name);
  }, [animator, gesture]);

  useFrame((state, dt) => animator.update(dt, state.clock.elapsedTime));

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const now = performance.now() / 1000;
    if (!animator.busy && now - lastHoverWave.current > 6) {
      lastHoverWave.current = now;
      animator.play("Wave");
    }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= 4) animator.play("Celebrate"); // larger delta = it was an orbit drag
  };

  return (
    <>
      <primitive object={scene} dispose={null} />
      {/* invisible hit box: raycasting the ~140k-triangle skinned mesh on every pointer move is slow */}
      {!free && (
        <mesh visible={false} onPointerOver={onOver} onClick={onClick}>
          <boxGeometry args={[0.8, 1.05, 0.45]} />
        </mesh>
      )}
    </>
  );
}

useGLTF.preload(MODEL_URL);

export default function Mascot(props: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.08, 2.7], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping; // keeps the royal blue saturated
        gl.toneMappingExposure = 1.05;
      }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} color="#cfe0ff" />

      <Model {...props} />

      <ContactShadows position={[0, -0.5, 0]} opacity={0.35} scale={2.4} blur={2.6} far={1.2} resolution={512} />

      {/* studio reflections generated locally: no HDR download needed */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 4]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#dbe6ff" />
        <Lightformer form="rect" intensity={1.0} position={[5, 1, -1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[2.5, 3, 2]} scale={1.5} />
      </Environment>

      <OrbitControls
        enablePan={false}
        enableZoom={!!props.free}
        minDistance={1.2}
        maxDistance={5}
        target={[0, -0.02, 0]}
        minPolarAngle={props.free ? 0 : Math.PI / 2 - 0.45}
        maxPolarAngle={props.free ? Math.PI : Math.PI / 2 + 0.2}
      />
    </Canvas>
  );
}
