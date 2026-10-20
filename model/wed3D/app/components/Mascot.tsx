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
  /** raise the model so its feet sit on the floor (for GLBs whose origin isn't at the feet) */
  lift?: number;
  /** code-driven motion for GLBs that ship without clips (raw Tripo exports) */
  motion?: string;
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

/** whole-body motion on the wrapper group + a bone wave if the model has a mixamo skeleton */
function applyMotion(motion: string, t: number, g: THREE.Group, bones: Map<string, { bone: THREE.Object3D; rest: THREE.Quaternion }>) {
  g.position.set(0, -0.5, 0);
  g.rotation.set(0, 0, 0);
  g.scale.setScalar(0.85); // Tripo models are taller than ours; leave headroom for the jump
  bones.forEach(({ bone, rest }) => bone.quaternion.copy(rest));
  const turn = (name: string, axis: "x" | "y" | "z", rad: number) => {
    const b = bones.get(name);
    if (b) b.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(+(axis === "x"), +(axis === "y"), +(axis === "z")), rad));
  };

  if (motion === "Float") {
    g.position.y += 0.03 + 0.03 * Math.sin(t * 2);
    g.rotation.z = 0.05 * Math.sin(t * 1.3);
    g.rotation.y = 0.25 * Math.sin(t * 0.7);
  } else if (motion === "Spin") {
    g.rotation.y = t * 1.2;
  } else if (motion === "Jump") {
    const p = (t * 1.2) % 1;
    const crouch = p < 0.25 ? Math.sin((p / 0.25) * Math.PI) : 0; // squash before take-off
    g.position.y += p < 0.25 ? 0 : 0.15 * Math.sin(((p - 0.25) / 0.75) * Math.PI);
    g.scale.multiply(new THREE.Vector3(1 + 0.08 * crouch, 1 - 0.12 * crouch, 1 + 0.08 * crouch));
  } else if (motion === "Wave") {
    turn("Hips", "y", 0.15 * Math.sin(t * 1.5));
    turn("Spine1", "z", 0.08 * Math.sin(t * 1.5));
    turn("RightArm", "z", 1.4);
    turn("RightForeArm", "z", 0.5 + 0.4 * Math.sin(t * 7));
    turn("Head", "y", 0.3 * Math.sin(t * 1.5));
  }
}

function Model({ base, gesture, url = MODEL_URL, free, lift = 0, motion }: Props) {
  const { scene, animations } = useGLTF(url);
  const animator = useMemo(() => new MascotAnimator(scene, animations), [scene, animations]);
  const lastHoverWave = useRef(-10);
  const group = useRef<THREE.Group>(null);
  const bones = useMemo(() => {
    const m = new Map<string, { bone: THREE.Object3D; rest: THREE.Quaternion }>();
    // GLTFLoader strips the ":" from "mixamorig:RightArm"
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) m.set(o.name.replace(/^mixamorig:?/, ""), { bone: o, rest: o.quaternion.clone() });
    });
    return m;
  }, [scene]);

  useEffect(() => {
    // skinned meshes keep their bind-pose bounds; jumps would get culled otherwise
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
    return () => animator.stop();
  }, [scene, animator]);

  // gesture first: a gesture and a new base in the same render (SitDown -> Sit) must not blend into the base early
  useEffect(() => {
    if (gesture) animator.play(gesture.name);
  }, [animator, gesture]);
  useEffect(() => animator.setBase(base), [animator, base]);

  useFrame((state, dt) => {
    // a hitch (or a background tab) must not skip a whole gesture in one frame; same clamp as the hero player
    animator.update(Math.min(dt, 0.1), state.clock.elapsedTime);
    if (motion && group.current) applyMotion(motion, state.clock.elapsedTime, group.current, bones);
  });

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
      {motion ? (
        <group ref={group} position-y={-0.5}>
          <primitive object={scene} dispose={null} position-y={lift} />
        </group>
      ) : (
        <primitive object={scene} dispose={null} />
      )}
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
