"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type Props = {
  url: string;
  align: "bottom" | "center";
  /** false while scrolled away: the canvas stays (no re-setup when it comes back) but stops moving */
  active: boolean;
  onReady: () => void;
  /** a picture of the first rendered frame: the placeholder if this canvas is ever released */
  onSnapshot: (dataUrl: string) => void;
};

const FOV = 20;

type V3 = [number, number, number];
/** a studio: ambient, lavender bounce from below, directional lights [position, intensity, colour] and the softboxes
 *  the glossy head mirrors [position, scale, intensity, colour]; optionally a turn of the model (degrees, to the
 *  artwork's view), a uniform dome around it, and glass (the N·V power of its core glow, see glassify) */
type Look = {
  exposure: number;
  ambient?: [string, number];
  ground?: [string, number];
  dirs: [V3, number, string][];
  panels: [V3, V3, number, string][];
  turn?: number;
  dome?: [string, number];
  glass?: number;
};

// fitted to the artwork (mascot-guide): warm-white porcelain face, the left lobe and edge sky-blue (rims from behind
// and a blue softbox behind-left, which the clear coat mirrors), crisp softbox streaks on the right; nothing strong
// from behind-right, which would light the inside of the mouth (no shadows here)
const PORCELAIN: Look = {
  exposure: 1,
  // the shadows blue, as in the artworks: a cool fill and a blue bounce from below instead of a flat warm front light
  ambient: ["#aac0ff", 0.4],
  ground: ["#6f8fff", 0.9],
  dirs: [
    [[0, 0.3, 4], 1.3, "#eef0ff"],
    [[2.6, 2.4, 3], 2.4, "#fff6ee"],
    [[4, 0.5, 0.5], 0.6, "#fff0e2"],
    [[-4, 0.3, 0.4], 1.5, "#3d8fff"],
    [[-3, -1.5, 1], 0.6, "#3d8fff"],
    [[-2, 1, -3], 10, "#3d8fff"],
    [[-3, 0.5, -2], 8, "#3d8fff"],
  ],
  panels: [
    [[0, 1, 5], [8, 5, 1], 0.8, "#eef2ff"],
    [[5, 0.5, 0], [5, 6, 1], 3, "#fff2e6"],
    [[0, 3.5, -3], [8, 3, 1], 2.5, "#c4bce8"],
    [[3, 0.6, 3], [1.2, 5, 1], 4, "#ffffff"],
    [[3, 3.5, 1], [4, 2, 1], 3, "#ffffff"],
    [[-3, 3.5, 1], [4, 2, 1], 1, "#ffffff"],
    [[-4, 0.5, -3], [5, 5, 1], 20, "#3d8fff"],
    [[-5, 0.5, 0], [5, 6, 1], 1.5, "#3d8fff"],
  ],
};

// the butler's artwork (mascot-edge): the same porcelain head, warm gold on the right and from the floor, and less blue
// light (the blue softbox also tints the black suit)
const BUTLER: Look = {
  exposure: 1,
  ambient: ["#aac0ff", 0.4],
  ground: ["#6f8fff", 0.9],
  dirs: [
    [[0, 0.3, 4], 1.3, "#eef0ff"],
    [[2.6, 2.4, 3], 2.4, "#fff6ee"],
    [[4, 0.5, 0.5], 1.2, "#ffe2bc"],
    [[-4, 0.3, 0.4], 0.5, "#8fb4ff"],
    [[-3, -1.5, 1], 0.3, "#8fb4ff"],
    [[-2, 1, -3], 4, "#5f9cff"],
    [[-3, 0.5, -2], 3, "#5f9cff"],
    [[-3.2, 0.8, 1.6], 0.8, "#ffd9b0"],
  ],
  panels: [
    [[0, 1, 5], [8, 5, 1], 0.8, "#fff4ea"],
    [[5, 0.5, 0], [5, 6, 1], 3.5, "#ffd9a8"],
    [[0, 3.5, -3], [8, 3, 1], 2.5, "#c4bce8"],
    [[3, 0.6, 3], [1.2, 5, 1], 4, "#ffffff"],
    [[3, 3.5, 1], [4, 2, 1], 3, "#ffffff"],
    [[-3, 3.5, 1], [4, 2, 1], 1, "#ffffff"],
    [[-4, 0.5, -3], [5, 5, 1], 10, "#3d8fff"],
    [[0, -4, 1.5], [8, 3, 1], 0.8, "#ffcf8f"],
  ],
};

// the pin's domed eyes mirror the broad softbox on the right as grey chrome: without it (and with a softer strip) they
// stay glossy black, as in its artwork
const PIN: Look = {
  ...PORCELAIN,
  panels: [
    [[0, 1, 5], [8, 5, 1], 0.8, "#fff4ea"],
    [[0, 3.5, -3], [8, 3, 1], 2.5, "#c4bce8"],
    [[3, 0.6, 3], [1.2, 5, 1], 2, "#ffffff"],
    [[3, 3.5, 1], [4, 2, 1], 3, "#ffffff"],
    [[-3, 3.5, 1], [4, 2, 1], 1, "#ffffff"],
    [[-4, 0.5, -3], [5, 5, 1], 20, "#3d8fff"],
    [[-5, 0.5, 0], [5, 6, 1], 1.5, "#3d8fff"],
  ],
};

// the Care Core's artwork: clear glass on the dark page, silver at its edges (a white dome and strip lights, mirrored at
// grazing angles), a blue core glowing through the crown (glass_tooth.py's emission)
const GLASS: Look = {
  exposure: 1,
  dirs: [],
  panels: [
    [[-3, 0.5, 2.5], [0.6, 6, 1], 6, "#ffffff"],
    [[3, 0.5, 2.5], [0.6, 6, 1], 6, "#ffffff"],
    [[0, 4, 1], [6, 0.6, 1], 5, "#ffffff"],
    [[-4, 0.5, -2], [1, 6, 1], 5, "#cfe0ff"],
    [[4, 0.5, -2], [1, 6, 1], 5, "#cfe0ff"],
  ],
  dome: ["#e8eeff", 0.6],
  glass: 1.2,
};

const mirrored = (l: Look): Look => ({
  ...l,
  dirs: l.dirs.map(([[x, y, z], i, c]) => [[-x, y, z], i, c]),
  panels: l.panels.map(([[x, y, z], s, i, c]) => [[-x, y, z], s, i, c]),
});

/** the models re-done as porcelain (model/blender/mascots/build_porcelain.sh) and their studios. guide-left is the
 *  guide facing the other way: its artwork has the blue on the right. Each turn is the view its artwork (public/img/
 *  mascots) shows, measured: the angle at which the model's render best matches the artwork (silhouette and image) */
const LOOKS: Record<string, Look> = {
  "guide.glb": { ...PORCELAIN, turn: 25 },
  "guide-left.glb": { ...mirrored(PORCELAIN), turn: -30 },
  "butler.glb": { ...BUTLER, turn: 32 },
  "laptop.glb": { ...PORCELAIN, turn: 52 },
  "pin.glb": { ...PIN, turn: -12 },
  "scholar.glb": { ...PORCELAIN, turn: 30 },
  "vault.glb": { ...PORCELAIN, turn: 26 },
  "reading.glb": { ...PORCELAIN, turn: 29 },
  "heart.glb": { ...PORCELAIN, turn: 41 },
  "tooth.glb": GLASS,
};
const fileOf = (url: string) => url.split("/").pop()!.split("?")[0];
const lookOf = (url: string) => LOOKS[fileOf(url)];

/*
 * The motions (models/rig/*.glb: bones from model/blender/mascots/rig_mascots.py). Each is a few degrees about a
 * model-space axis at the bone's pivot (x: the mascot's left = the viewer's right when it faces you, y: up, z: towards
 * the viewer; +x pitches the top forward, +z lifts what is on its +x side, +y turns the front towards +x), looping and
 * passing through the artwork's pose. Bones: spine (hips), head (neck), hand.L/R (elbow: forearm, hand, held prop),
 * hold (a prop held in both hands).
 */
type Turn = [bone: string, axis: "x" | "y" | "z", radians: number];
type Motion = { bones?: (t: number) => Turn[]; spin?: number; pulse?: [amount: number, seconds: number] };
const TAU = Math.PI * 2;
const wave = (t: number, period: number, phase = 0) => Math.sin((t / period + phase) * TAU);
/** 0 → 1 → 0 over `width` seconds, starting `at` seconds into every `period`: a tap, a hop, a glance */
const bump = (t: number, period: number, at: number, width: number) => {
  const u = ((((t % period) + period) % period) - at) / width;
  return u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0;
};
const breathe = (t: number): Turn => ["spine", "x", 0.012 * wave(t, 5)];

const MOTIONS: Record<string, Motion> = {
  // presenting the features: the open palm sweeps a little up and out, the head tilts towards it
  "guide.glb": {
    bones: (t) => [
      breathe(t),
      ["hand.R", "z", 0.1 * wave(t, 4)],
      ["hand.R", "y", 0.06 * wave(t, 4, 0.25)],
      ["head", "z", -0.04 * wave(t, 4, 0.1)],
      ["head", "x", 0.025 * wave(t, 3.2)],
    ],
  },
  // offering the Care Core: the open hand rises gently under it, the head leans towards it
  "guide-left.glb": {
    bones: (t) => [
      breathe(t),
      ["hand.L", "z", -0.09 * wave(t, 4.5)],
      ["head", "z", 0.045 * wave(t, 4.5, 0.15)],
      ["head", "x", 0.02 * wave(t, 3.4)],
    ],
  },
  // at your service: the bell hand bobs twice (a ring) every few seconds, then a slow polite bow
  "butler.glb": {
    bones: (t) => [
      ["spine", "x", 0.04 * bump(t, 7, 3.5, 2.4)],
      ["head", "x", 0.05 * bump(t, 7, 3.6, 2.2)],
      ["hand.R", "x", -0.07 * (bump(t, 7, 0.4, 0.35) + 0.7 * bump(t, 7, 0.8, 0.35))],
    ],
  },
  // typing: the hands tap in turn; every few seconds a glance up at the viewer (the artwork is seen from its right)
  "laptop.glb": {
    bones: (t) => [
      ["hand.L", "x", 0.05 * Math.max(0, wave(t, 0.36))],
      ["hand.R", "x", 0.05 * Math.max(0, wave(t, 0.36, 0.5))],
      ["head", "y", -0.22 * bump(t, 6, 3, 1.8)],
      ["head", "x", 0.03 * wave(t, 2.4) - 0.04 * bump(t, 6, 3, 1.8)],
    ],
  },
  // dropping a pin: the marker hand hops, the pointing hand taps towards it, the head bobs along
  "pin.glb": {
    bones: (t) => [
      breathe(t),
      ["hand.R", "x", -0.08 * bump(t, 2.6, 0, 0.9)],
      ["hand.L", "x", 0.05 * bump(t, 2.6, 1.1, 0.5)],
      ["head", "x", 0.025 * bump(t, 2.6, 0.1, 0.9)],
      ["head", "z", 0.02 * wave(t, 5.2)],
    ],
  },
  // here's a tip: the raised finger wags, the head bobs as it talks
  "scholar.glb": {
    bones: (t) => [
      breathe(t),
      ["hand.R", "z", 0.09 * wave(t, 1.4)],
      ["head", "x", 0.025 * wave(t, 0.7)],
      ["head", "z", 0.03 * wave(t, 4.2)],
    ],
  },
  // your records are safe: the folder is held close, then shown a little outwards
  "vault.glb": {
    bones: (t) => [
      breathe(t),
      ["hold", "x", 0.06 * (0.5 - 0.5 * Math.cos((t / 5) * TAU))],
      ["head", "z", 0.035 * wave(t, 5, 0.25)],
      ["head", "x", -0.02 * wave(t, 5)],
    ],
  },
  // reading: the eyes on the page, the book tilting with it, then a look up from it every few seconds
  "reading.glb": {
    bones: (t) => [
      breathe(t),
      ["hold", "x", 0.03 * wave(t, 5)],
      ["head", "x", 0.04 - 0.07 * bump(t, 7, 4, 2)],
      ["head", "z", 0.02 * wave(t, 3.5)],
    ],
  },
  // a promise: the hand pats the heart twice, a slow warm nod
  "heart.glb": {
    bones: (t) => [
      breathe(t),
      ["hand.L", "y", -0.05 * (bump(t, 4, 0.5, 0.45) + bump(t, 4, 1.05, 0.45))],
      ["head", "x", 0.04 * bump(t, 4, 0.4, 1.6)],
    ],
  },
  // the Care Core: a slow turn, its core glowing like a heartbeat
  "tooth.glb": { spin: 0.25, pulse: [0.25, 2.6] },
};

/**
 * Glass on a dark page, made like its artwork (a black-background render keyed to alpha): the glow fades towards the
 * silhouette (it is the core, seen through the glass), and each pixel's alpha is its brightness, so the dark glass shows
 * the page through it while the silver edges and the blue core stay.
 */
function glassify(root: THREE.Object3D, power: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.Material) : null;
    if (!m) return;
    m.transparent = true;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= pow( saturate( dot( normal, normalize( vViewPosition ) ) ), ${power.toFixed(2)} );`,
        )
        .replace(
          "#include <colorspace_fragment>",
          "#include <colorspace_fragment>\ngl_FragColor.a = max( max( gl_FragColor.r, gl_FragColor.g ), gl_FragColor.b );\ngl_FragColor.rgb /= max( gl_FragColor.a, 1e-4 );",
        );
    };
    m.customProgramCacheKey = () => `glass${power}`;
  });
}

type Bone = { bone: THREE.Object3D; rest: THREE.Quaternion; parent: THREE.Quaternion };
const _q = new THREE.Quaternion();
const _p = new THREE.Quaternion();
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** One Tripo model in its artwork's pose, scaled to fill a square box (feet on the floor or centred), playing its motion. */
function Model({ url, align, active, onReady, onSnapshot }: Props) {
  const { scene } = useGLTF(url);
  const still = useReducedMotion();
  const look = lookOf(url);
  const motion = still ? undefined : MOTIONS[fileOf(url)];
  const exposure = look?.exposure ?? 1.05;
  const frames = useRef(0);
  const spin = useRef<THREE.Group>(null);
  const aniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  // each box gets its own copy (the same model can be on screen twice; skinned, so with its own skeleton); turned to
  // its artwork's view, fitted to a 1-unit box once; its textures filtered at full anisotropy (crisp where the surface
  // turns away: the head's sides, the face's edges)
  const fitted = useMemo(() => {
    const s = cloneSkinned(scene);
    s.traverse((o) => {
      const m = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.MeshPhysicalMaterial) : null;
      for (const t of m ? [m.map, m.normalMap, m.roughnessMap, m.clearcoatNormalMap] : [])
        if (t && t.anisotropy !== aniso) {
          t.anisotropy = aniso;
          t.needsUpdate = true;
        }
    });
    if (look?.glass) glassify(s, look.glass);
    if (look?.turn) {
      s.rotation.y = THREE.MathUtils.degToRad(look.turn);
      s.updateMatrixWorld(true);
    }
    const b = new THREE.Box3().setFromObject(s);
    const size = b.getSize(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y);
    s.scale.setScalar(k);
    const c = b.getCenter(new THREE.Vector3()).multiplyScalar(k);
    s.position.set(-c.x, align === "bottom" ? -0.5 - b.min.y * k : -c.y, -c.z);
    s.updateMatrixWorld(true);
    return s;
  }, [scene, align, look, aniso]);

  // what moves: the bones, with their rest pose and their parent's turn in model space (to turn them about model-space
  // axes), and the glowing materials with their base glow
  const parts = useRef<{ bones: Map<string, Bone>; glow: { m: THREE.MeshStandardMaterial; base: number }[] } | null>(null);
  useEffect(() => {
    const inv = fitted.getWorldQuaternion(new THREE.Quaternion()).invert();
    const bones = new Map<string, Bone>();
    const glow: { m: THREE.MeshStandardMaterial; base: number }[] = [];
    fitted.traverse((o) => {
      if ((o as THREE.Bone).isBone && o.parent)
        bones.set(o.name, { bone: o, rest: o.quaternion.clone(), parent: inv.clone().multiply(o.parent.getWorldQuaternion(new THREE.Quaternion())) });
      const m = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.MeshStandardMaterial) : null;
      if (m?.emissiveIntensity) glow.push({ m, base: m.emissiveIntensity });
    });
    parts.current = { bones, glow };
  }, [fitted]);

  // ~30 frames a second while on screen and moving; otherwise just the first few frames (ready, then the snapshot)
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    if (!motion || !active) return;
    const id = setInterval(() => invalidate(), 33);
    return () => clearInterval(id);
  }, [invalidate, fitted, motion, active]);

  useFrame(({ gl, invalidate }) => {
    gl.toneMappingExposure = exposure; // per model: one canvas can switch models (e.g. the journey's steps)
    if (motion && parts.current) {
      const { bones, glow } = parts.current;
      // page time, not canvas time: a canvas that is re-created carries on mid-motion instead of restarting
      const t = performance.now() / 1000;
      for (const { bone, rest } of bones.values()) bone.quaternion.copy(rest);
      for (const [name, axis, a] of motion.bones?.(t) ?? []) {
        const b = bones.get(name.replace(".", "")); // three drops the dot from glTF node names
        if (!b) continue;
        // bone.local ← parent⁻¹ · turn(model axis) · parent · bone.local
        _q.setFromAxisAngle(AXES[axis], a);
        b.bone.quaternion.premultiply(_p.copy(b.parent).invert().multiply(_q).multiply(b.parent));
      }
      if (motion.spin && spin.current) spin.current.rotation.y = (t * motion.spin) % TAU;
      if (motion.pulse) for (const { m, base } of glow) m.setValues({ emissiveIntensity: base * (1 + motion.pulse[0] * wave(t, motion.pulse[1])) });
    }
    frames.current += 1;
    if (frames.current === 2) onReady();
    if (frames.current === 3) onSnapshot(gl.domElement.toDataURL("image/webp", 0.9));
    if (frames.current < 3) invalidate();
  });

  return (
    <group ref={spin}>
      <primitive object={fitted} />
    </group>
  );
}

export default function MascotModel(props: Props) {
  // camera distance that frames the 1-unit box with a little room
  const dist = 0.56 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const look = lookOf(props.url);
  return (
    <Canvas
      frameloop="demand"
      // up to 2x: crisp on retina screens (only the boxes on screen animate, so the cost stays small)
      dpr={[1, 2]}
      camera={{ position: [0, 0, dist], fov: FOV }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ pointerEvents: "none" }}
    >
      {look ? (
        <>
          {look.ambient && <ambientLight intensity={look.ambient[1]} color={look.ambient[0]} />}
          {look.ground && <hemisphereLight args={["#000000", look.ground[0], look.ground[1]]} />}
          {look.dirs.map(([p, i, c], k) => (
            <directionalLight key={k} position={p} intensity={i} color={c} />
          ))}
        </>
      ) : (
        <>
          <ambientLight intensity={0.35} />
          <directionalLight position={[1.5, 3, 3]} intensity={2.2} />
          <directionalLight position={[-2, 1, -2]} intensity={0.9} color="#8fb4ff" />
        </>
      )}
      <Suspense fallback={null}>
        <Model key={props.url} {...props} />
        {look ? (
          // rebuilt when the canvas switches models (its own key: the Model beside it is keyed by the url)
          <Environment key={`env:${props.url}`} resolution={256}>
            {look.panels.map(([p, s, i, c], k) => (
              <Lightformer key={k} form="rect" position={p} scale={s} intensity={i} color={c} />
            ))}
            {look.dome && (
              <mesh scale={50}>
                <sphereGeometry args={[1, 32, 16]} />
                <meshBasicMaterial side={THREE.BackSide} toneMapped={false} color={new THREE.Color(look.dome[0]).multiplyScalar(look.dome[1])} />
              </mesh>
            )}
          </Environment>
        ) : (
          <Environment resolution={64}>
            <Lightformer form="rect" intensity={2.2} position={[0, 4, 4]} scale={[8, 4, 1]} />
            <Lightformer form="rect" intensity={1} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#dbe6ff" />
            <Lightformer form="rect" intensity={1.2} position={[0, -3, -3]} scale={[8, 2, 1]} color="#7aa2ff" />
          </Environment>
        )}
      </Suspense>
    </Canvas>
  );
}
