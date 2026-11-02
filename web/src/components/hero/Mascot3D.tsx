"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MotionValue } from "motion/react";
import { Canvas, useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
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
// the hero model: that raw sculpt's body and mudra hands + the rigged model's head and face kit (eyes, lids, brows,
// mouth) with all the clips driving the face (model/blender/tripo/raw/face_raw.py)
const MODEL_URL = "/mascot-sitting-face.glb?v=9";
// const MODEL_URL = "/mascot-sitting-raw.glb?v=5"; // raw sculpt only, eyes sculpted shut
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
  /** idle fidgets; LookAround is left out while the eyes follow the cursor */
  private ambient = AMBIENT;
  setAmbient(names: string[]) {
    this.ambient = names;
  }

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

  private eyesOpen() {
    return !this.gesture && ["Idle", "Typing", "Talk", "Think", "Explain"].some((n) => this.current === this.actions.get(n));
  }

  /** Blink now, if the eyes are open (people blink as their gaze jumps a long way). */
  blinkNow(time: number) {
    if (!this.blink || !this.eyesOpen()) return;
    this.blink.reset().play();
    this.nextBlink = time + 2.5 + Math.random() * 3;
  }

  update(dt: number, time: number) {
    this.mixer.update(dt);
    const idle = !this.gesture && this.current === this.actions.get("Idle");
    if (this.blink && time > this.nextBlink) {
      if (this.eyesOpen()) this.blink.reset().play(); // only over open eyes: an additive blink would fight closed ones
      this.nextBlink = time + 2.5 + Math.random() * 3;
    }
    // a little life while it waits: an occasional glance around, smile or nod
    if (this.base === "Idle" && this.nextAmbient === Infinity) this.nextAmbient = time + 9;
    if (idle && time > this.nextAmbient) {
      this.play(this.ambient[Math.floor(Math.random() * this.ambient.length)]);
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
  /** eyes (and a little of the head) follow the mouse; mouse devices only */
  lookAt?: boolean;
  /** it can be poked and spun by dragging; `onPlay` reports where each poke landed, and a poke-flurry spin */
  playful?: boolean;
  onPlay?: (kind: Spot | "spin") => void;
};

/** Where a poke landed. */
export type Spot = "crown" | "eyes" | "face" | "head" | "tummy" | "hands" | "legs";

/*
 * Play. A poke (press and let go without moving) is answered by the part it lands on (REACT): a face (one of the clips,
 * picked at random), a springy hop that squashes then stretches it, and a knock to the head, away from the poke, that
 * wobbles out. Three pokes in quick succession send it into a spin. A sideways drag turns it with the pointer; let go
 * and it coasts on the throw, slows, and comes round to face the viewer again, at the next whole turn in the direction
 * it was going. Presses land on two invisible shapes round the head and body: cheap to hit, unlike the 300k-triangle
 * model; the hit point, in the model's own frame, says which part.
 */
const REACT: Record<Spot, { faces: string[]; hop: number; knock: number }> = {
  crown: { faces: ["Brows", "HeadShake"], hop: 1.2, knock: 1 }, // ducks: the head is knocked down and away
  eyes: { faces: ["HeadShake"], hop: 0.6, knock: 0.7 }, // flinches, blinks twice
  face: { faces: ["Happy", "Smile"], hop: 0.8, knock: 0.6 }, // giggles, the head pushed back
  head: { faces: ["Brows", "Smile"], hop: 0.8, knock: 0.9 }, // side or back of the head: tilts away
  tummy: { faces: ["Happy"], hop: 3.2, knock: 0.2 }, // ticklish: a big bouncy giggle
  hands: { faces: ["Wake", "Nod"], hop: 0.5, knock: 0.1 }, // mid-mudra: closes its eyes a moment, opens them again
  legs: { faces: ["Brows", "Nod"], hop: 1.6, knock: 0.2 },
};
const TAU = Math.PI * 2;
const HOP_W = 13; // hop spring: stiffness, and damping under 1 so it bounces a couple of times
const HOP_DAMP = 0.3;
const KNOCK_W = 10; // the head's wobble after a knock: a little looser than the hop
const KNOCK_DAMP = 0.35;
const HEAD_PIVOT = new THREE.Vector3(0, 0.26, 0); // the middle of the head, model frame
const SPIN_PER_PX = 0.012; // radians of turn per pixel dragged

const _mouth = new THREE.Vector3();
const _head = new THREE.Vector3();
const _bob = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);

/*
 * Gaze. It looks at the point under the cursor, as if the page were a window part of the way between it and the viewer:
 * the angle from its eyes to that point (model frame: x = viewer's right, y = up, z = toward the viewer).
 *
 * Head and eyes move as one: a single smoothed gaze drives both, so they start, travel and settle together. The head
 * takes HEAD_SHARE of it (within its limits) and the eyes the rest, a small turn in their sockets: EYE_YAW / EYE_PITCH
 * of angle = EYE_X / EYE_Y of slide across the face, inside an ellipse. The eyes are glossy black beads whose
 * catchlights are painted into their texture; a real bead turning under a fixed light keeps its highlight toward the
 * light, so the texture is shifted against the turn (CATCHLIGHT per radian). The brows ride up a little when it looks
 * up. All of it is applied after the mixer each frame and taken back off before the next, so it rides on any clip.
 */
const GAZE_SPEED = 9; // spring stiffness: a new target is reached in ~0.45 s, eased in and out
const HEAD_SHARE = 0.75;
const HEAD_YAW = 0.3; // ~17°
const HEAD_DOWN = 0.16;
const HEAD_UP = 0.06; // tipping back shows the underside of the head: up is kept small
const EYE_X = 0.006; // max slide, model units: a turn in the socket, not a trip across the face
const EYE_Y = 0.004;
const EYE_YAW = 0.25; // eye angle at the max slide, radians
const EYE_PITCH = 0.2;
const CATCHLIGHT = 0.24; // catchlight shift, in texture widths per radian of turn (sign: CATCH_U / CATCH_V)
const CATCH_U = 1;
const CATCH_V = -1;
const BROW_LIFT = 0.006; // brow rise at full upward gaze
const WINDOW_DEPTH = 0.55; // the page sits this far from the eyes toward the viewer: nearer = livelier at small moves
const BLINK_JUMP = 0.5; // a gaze jump bigger than this (radians) comes with a blink

type Spring = { x: number; v: number };
/** Critically damped spring toward `to`: eases in and out, never overshoots. Substepped so big frames stay stable. */
function spring(s: Spring, to: number, w: number, dt: number) {
  for (let n = Math.ceil(dt / 0.008), h = dt / n; n > 0; n--) {
    s.v += (w * w * (to - s.x) - 2 * w * s.v) * h;
    s.x += s.v * h;
  }
}
const _gq = new THREE.Quaternion();
const _bq = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _v = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
const _m3b = new THREE.Matrix3();
// the head's centre relative to the midpoint between the eyes, model frame (measured in Blender: 11 cm up, 22 cm back)
const HEAD_CENTRE = new THREE.Vector3(0, 0.11, -0.22);
const _inv = new THREE.Matrix4();
const _o = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _p = new THREE.Vector3();
const fineMouse = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches;

function Model({ base, gesture, rotY, onReady, onMouth, lookAt = false, playful = false, onPlay }: Props) {
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

  // gaze: the face bones and what's currently applied on top of the clip; the eyes' textures, for the catchlights
  const gaze = useMemo(() => {
    const bones = (names: string[]) => names.map((n) => scene.getObjectByName(n)).filter((b): b is THREE.Object3D => !!b);
    const eyes = bones(["eyeL", "eyeR"]);
    const brows = bones(["browL", "browR"]);
    const maps = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).isMesh && /^Eye/.test(o.name) ? ((o as THREE.Mesh).material as THREE.MeshStandardMaterial) : null;
      for (const tex of [mat?.map, mat?.emissiveMap]) {
        if (!tex) continue;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; // shifted, the black edge spreads in, not the far side
        tex.needsUpdate = true;
        maps.add(tex);
      }
    });
    return {
      eyes,
      brows,
      head: scene.getObjectByName("head"),
      maps: [...maps],
      eyeOff: eyes.map(() => new THREE.Vector3()),
      browOff: brows.map(() => new THREE.Vector3()),
      headOff: new THREE.Quaternion(),
    };
  }, [scene]);
  // the mouse on the page (null once it leaves the window), and when it last moved (performance.now ms)
  const mouse = useRef<{ x: number; y: number; at: number } | null>(null);
  // gaze state, radians in the model frame: the one smoothed gaze (yaw, pitch), a tiny drift while the mouse rests,
  // blink cooldown
  const look = useRef({
    gy: { x: 0, v: 0 } as Spring,
    gp: { x: 0, v: 0 } as Spring,
    drift: { x: 0, y: 0 },
    nextDrift: 0,
    blinkAt: 0,
  });
  const tracking = lookAt && fineMouse();
  useEffect(() => {
    animator.setAmbient(tracking ? AMBIENT.filter((n) => n !== "LookAround") : AMBIENT);
    if (!tracking) return;
    const onMove = (e: PointerEvent) => (mouse.current = { x: e.clientX, y: e.clientY, at: performance.now() });
    // left the window (no element under the pointer) or the tab lost focus: drift back to the viewer
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) mouse.current = null;
    };
    const onBlur = () => (mouse.current = null);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", onBlur);
    };
  }, [animator, tracking]);

  useEffect(() => animator.setBase(base), [animator, base]);
  useEffect(() => {
    if (gesture) animator.play(gesture.name);
  }, [animator, gesture]);

  /** Aim the head and eyes at the point under the mouse (or back at the viewer when there's none). */
  const applyGaze = (state: RootState, dt: number, root: THREE.Object3D) => {
    const head = gaze.head!;
    const l = look.current;
    const t = state.clock.elapsedTime;
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_gq);
    const m = tracking ? mouse.current : null;
    let yaw = 0;
    let pitch = 0;
    if (m) {
      // the mouse as a ray from the camera; where it meets the "window": a plane facing the camera, WINDOW_DEPTH of the
      // way from the eyes to it. The angle from the eyes to that point is where it should look.
      const cam = state.camera;
      const r = state.gl.domElement.getBoundingClientRect();
      _dir.set(((m.x - r.left) / r.width) * 2 - 1, 1 - ((m.y - r.top) / r.height) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
      gaze.eyes[0].getWorldPosition(_o).add(gaze.eyes[gaze.eyes.length - 1].getWorldPosition(_v)).multiplyScalar(0.5);
      cam.getWorldDirection(_fwd);
      _p.copy(_o).lerp(cam.position, WINDOW_DEPTH).sub(cam.position);
      _v.copy(cam.position).addScaledVector(_dir, _p.dot(_fwd) / _dir.dot(_fwd)).sub(_o);
      _v.applyQuaternion(_q.copy(_gq).invert()); // world → model frame
      yaw = Math.atan2(_v.x, _v.z);
      pitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
      // a resting mouse: the eyes don't freeze, they make tiny moves about it now and then
      if (performance.now() - m.at > 1200) {
        if (t > l.nextDrift) {
          l.drift = { x: (Math.random() - 0.5) * 0.08, y: (Math.random() - 0.5) * 0.05 };
          l.nextDrift = t + 0.7 + Math.random() * 1.1;
        }
      } else l.drift = { x: 0, y: 0 };
      yaw += l.drift.x;
      pitch += l.drift.y;
    }
    // a long jump of the gaze comes with a blink
    if (Math.hypot(yaw - l.gy.x, pitch - l.gp.x) > BLINK_JUMP && t > l.blinkAt) {
      animator.blinkNow(t);
      l.blinkAt = t + 1.5;
    }
    // one gaze, eased; the head takes its share of it and the eyes the rest, so both move together
    spring(l.gy, yaw, GAZE_SPEED, dt);
    spring(l.gp, pitch, GAZE_SPEED, dt);
    const hy = THREE.MathUtils.clamp(l.gy.x * HEAD_SHARE, -HEAD_YAW, HEAD_YAW);
    const hp = THREE.MathUtils.clamp(l.gp.x * HEAD_SHARE, -HEAD_DOWN, HEAD_UP);
    let ey = (l.gy.x - hy) / EYE_YAW;
    let ep = (l.gp.x - hp) / EYE_PITCH;
    const over = Math.hypot(ey, ep);
    if (over > 1) {
      ey /= over;
      ep /= over;
    }
    // catchlights stay toward the light: shifted against the whole turn, head and eyes
    for (const tex of gaze.maps) tex.offset.set(CATCH_U * CATCHLIGHT * (hy + ey * EYE_YAW), CATCH_V * CATCHLIGHT * (hp + ep * EYE_PITCH));

    // head: a model-frame turn (yaw about up, pitch about the viewer's x; up is a negative turn), into the bone's frame
    head.getWorldQuaternion(_bq);
    // (plus any knock from a poke, wobbling out: forward/back about x, sideways about z)
    const knock = play.current.knock;
    _q.setFromEuler(_e.set(-hp + knock.x.x, hy, knock.z.x));
    _q.premultiply(_gq).multiply(_gq.clone().invert()); // model frame → world
    gaze.headOff.copy(_bq).invert().multiply(_q).multiply(_bq); // world → bone-local, applied after the clip's rotation
    head.quaternion.multiply(gaze.headOff);
    head.updateMatrixWorld(true);

    // eyes: slide across the face. The face is curved, so each eye moves along its own patch of surface (the slide minus
    // its part along the line from the head's centre through the eye); a flat slide sinks one eye into the head
    _m3.setFromMatrix4(root.matrixWorld);
    gaze.eyes[0].getWorldPosition(_mouth).add(gaze.eyes[gaze.eyes.length - 1].getWorldPosition(_head)).multiplyScalar(0.5);
    _mouth.add(_head.copy(HEAD_CENTRE).applyMatrix3(_m3)); // the head's centre: above and behind the eyes
    const slide = (b: THREE.Object3D, off: THREE.Vector3, x: number, y: number) => {
      const n = b.getWorldPosition(_head).sub(_mouth).normalize();
      _v.set(x, y, 0).applyMatrix3(_m3);
      const len = _v.length();
      _v.addScaledVector(n, -_v.dot(n)).setLength(len);
      _v.applyMatrix3(_m3b.setFromMatrix4(_inv.copy(b.parent!.matrixWorld).invert()));
      off.copy(_v);
      b.position.add(_v);
    };
    gaze.eyes.forEach((b, i) => slide(b, gaze.eyeOff[i], ey * EYE_X, ep * EYE_Y));
    // brows: up with an upward look, only a touch down with a downward one
    const up = THREE.MathUtils.clamp(l.gp.x / 0.35, -1, 1);
    const lift = (Math.max(up, 0) + 0.3 * Math.min(up, 0)) * BROW_LIFT;
    gaze.brows.forEach((b, i) => slide(b, gaze.browOff[i], 0, lift));
  };

  // play: the hop spring, the extra turn and its speed, the drag in progress, where a coasting turn will come to rest,
  // recent pokes, and the clock (for blinks)
  const play = useRef({
    hop: { x: 0, v: 0 },
    spin: 0,
    spinV: 0,
    home: null as number | null,
    knock: { x: { x: 0, v: 0 }, z: { x: 0, v: 0 } },
    drag: null as { x: number; spin: number; lastX: number; lastT: number; moved: boolean; spot: Spot; at: THREE.Vector3 } | null,
    pokes: [] as number[],
    clock: 0,
  });

  /** Which part a press landed on, and where, in the model's own frame (x right, y up, z toward the viewer). */
  const spotOf = (e: ThreeEvent<PointerEvent>): [Spot, THREE.Vector3] => {
    const g = group.current!;
    const at = g.worldToLocal(e.point.clone());
    if (e.object.name === "head") {
      // the hit shape sits a little proud of the face, so the eyes are matched across the face, not in depth
      const onEye = gaze.eyes.some((b) => {
        const eye = g.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
        return at.z > 0 && Math.hypot(at.x - eye.x, at.y - eye.y) < 0.065;
      });
      if (onEye) return ["eyes", at];
      if (at.y > 0.3) return ["crown", at]; // forehead and up
      if (at.z > 0.12 && at.y < 0.3) return ["face", at];
      return ["head", at];
    }
    if (Math.abs(at.x) > 0.27) return ["hands", at];
    if (at.y < -0.29) return ["legs", at]; // the crossed legs fill the lower part of the body
    return ["tummy", at];
  };

  const poke = (spot: Spot, at: THREE.Vector3) => {
    const p = play.current;
    const r = REACT[spot];
    p.hop.v -= 0.9 * r.hop; // pressed down: it squashes, and the spring throws it back up
    // the head is knocked away from the poke: a poke from above nods it down, from the front tips it back, from a side
    // tilts it to the other
    const dir = at.clone().sub(HEAD_PIVOT).normalize();
    p.knock.x.v += 1.8 * r.knock * (dir.y - dir.z);
    p.knock.z.v += 1.8 * r.knock * Math.sign(at.x) * Math.min(1, Math.abs(dir.x) * 2);
    animator.play(r.faces[Math.floor(Math.random() * r.faces.length)]);
    animator.blinkNow(p.clock);
    if (spot === "eyes") setTimeout(() => animator.blinkNow(play.current.clock), 280); // and again: a flinch
    const now = performance.now();
    p.pokes = [...p.pokes.filter((t) => now - t < 1200), now];
    if (p.pokes.length >= 3) {
      p.pokes = [];
      p.spinV = 3 * TAU; // a poke-flurry: a big spin
      p.home = null;
      onPlay?.("spin");
    } else onPlay?.(spot);
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = play.current;
    const cursor = e.nativeEvent.target as HTMLElement;
    const [spot, at] = spotOf(e);
    p.drag = { x: e.clientX, spin: p.spin, lastX: e.clientX, lastT: performance.now(), moved: false, spot, at };
    p.spinV = 0;
    p.home = null;
    cursor.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => {
      const d = p.drag;
      if (!d) return;
      if (Math.abs(ev.clientX - d.x) > 6) d.moved = true;
      if (!d.moved) return;
      const t = performance.now();
      p.spinV = THREE.MathUtils.clamp(((ev.clientX - d.lastX) * SPIN_PER_PX) / Math.max((t - d.lastT) / 1000, 0.008), -25, 25);
      d.lastX = ev.clientX;
      d.lastT = t;
      p.spin = d.spin + (ev.clientX - d.x) * SPIN_PER_PX;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cursor.style.cursor = "grab";
      const d = p.drag;
      p.drag = null;
      if (!d) return;
      if (!d.moved) poke(d.spot, d.at);
      else if (performance.now() - d.lastT > 90) p.spinV = 0; // held still before letting go: no throw
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** The hop, the head's knock and the extra turn, each frame. */
  const stepPlay = (dt: number) => {
    const p = play.current;
    for (let n = Math.ceil(dt / 0.008), h = dt / n; n > 0; n--) {
      p.hop.v += (-HOP_W * HOP_W * p.hop.x - 2 * HOP_DAMP * HOP_W * p.hop.v) * h;
      p.hop.x += p.hop.v * h;
      for (const k of [p.knock.x, p.knock.z]) {
        k.v += (-KNOCK_W * KNOCK_W * k.x - 2 * KNOCK_DAMP * KNOCK_W * k.v) * h;
        k.x += k.v * h;
      }
      if (p.drag) continue;
      if (p.home === null && Math.abs(p.spinV) < 3) {
        // slowing: come round to the next whole turn in the direction it's going
        p.home = (p.spinV >= 0 ? Math.ceil(p.spin / TAU - 0.02) : Math.floor(p.spin / TAU + 0.02)) * TAU;
      }
      if (p.home === null) p.spinV -= 2 * p.spinV * h; // coasting: a hard throw makes about two turns
      else p.spinV += (25 * (p.home - p.spin) - 10 * p.spinV) * h; // the pull home, critically damped
      p.spin += p.spinV * h;
    }
  };

  useFrame((state, dt) => {
    play.current.clock = state.clock.elapsedTime;
    stepPlay(Math.min(dt, 0.1));
    // take last frame's gaze back off, so a clip without a track for these bones doesn't accumulate it
    gaze.eyes.forEach((b, i) => b.position.sub(gaze.eyeOff[i]));
    gaze.brows.forEach((b, i) => b.position.sub(gaze.browOff[i]));
    gaze.head?.quaternion.multiply(_q.copy(gaze.headOff).invert());
    animator.update(Math.min(dt, 0.1), state.clock.elapsedTime);
    const g = group.current;
    const p = play.current;
    if (g) {
      g.rotation.y = (rotY ? THREE.MathUtils.degToRad(rotY.get()) : 0) + p.spin;
      // a gentle float so it doesn't sit frozen (the body has no clips of its own; they only drive the face), plus the
      // hop: squashed (wide, low) below rest, stretched (tall, up) above it
      const s = p.hop.x;
      g.position.y = 0.01 * Math.sin(state.clock.elapsedTime * 1.2) + s * 0.35;
      g.scale.set(1 - 0.45 * s, 1 + s, 1 - 0.45 * s);
    }
    if (group.current && gaze.head && gaze.eyes.length) applyGaze(state, Math.min(dt, 0.1), group.current);
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
      {playful && (
        // what a press can land on: the head and the body (the model is 1 unit tall, feet at y -0.5)
        <group
          onPointerDown={onDown}
          onPointerOver={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = play.current.drag ? "grabbing" : "grab")}
          onPointerOut={(e) => !play.current.drag && ((e.nativeEvent.target as HTMLElement).style.cursor = "")}
        >
          <mesh name="head" position={[0, 0.24, 0]} scale={[0.4, 0.27, 0.32]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          <mesh name="body" position={[0, -0.27, 0.02]}>
            <boxGeometry args={[0.85, 0.46, 0.55]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      )}
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
      // playable: presses reach it (its invisible shapes decide what's a hit); vertical swipes still scroll the page
      style={{ pointerEvents: props.playful ? "auto" : "none", touchAction: "pan-y" }}
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
