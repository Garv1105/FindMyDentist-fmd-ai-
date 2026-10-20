"""Seated Tripo mascot, step 3: animation clips + GLB export.

blender -b out_tripo_sit/rig.blend --python anim_sit_tripo.py -- <out.glb> <out.blend>

Clips (30 fps), named like the old seated mascot's so the hero player (web Mascot3D.tsx) can use this model too.
Loops: Meditate, Fly, Idle, Typing, Talk, Think, Explain.
One-shots (start and end in the Idle pose, so they chain): Wake (from Meditate), Wave, PointLeft, PointRight
(viewer's left/right), Present, ThumbsUp, Clap, Happy, LookAround, Brows, Nod, HeadShake, Smile.
Blink only keys the eye/lid bones; the web page plays it additively on top of any clip.

Fly (the hero's rise): from the yoga pose the mudra opens, the arms float out to a T with the palms up, wave slowly
up and down twice like wings, and settle back into the yoga pose, so the loop joins up. The hands never go up: the
head is far too big for that.
"""
import bpy, sys, os, math, json, struct
from mathutils import Vector

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "sit"))
from pose_sit import FINGERS, arm, brows, eyes, finger, hand_dir, hand_shape, head, mouth, thumb  # noqa: E402
from posing import move, raise_side, reset, rot, turn  # noqa: E402

OUT_GLB, OUT_BLEND = sys.argv[sys.argv.index("--") + 1:][:2]
rig = bpy.data.objects["Rig"]
scene = bpy.context.scene
scene.render.fps = 30
FACE_ONLY = [f"{p}.{s}" for p in ("eye", "lid") for s in "LR"]
VIEW = Vector((0, -1, 0))  # toward the viewer
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FWD_AXIS = Vector((-1, 0, 0))  # rotating about it by + tips the torso forward
bl = rig.data.bones


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def d(name):
    b = bl[name]
    return (b.tail_local - b.head_local).normalized()


REST_UP, REST_FORE = d("upper_arm.L"), d("forearm.L")   # bind pose (left): elbows back, forearms over the knees
REST_HAND = d("hand.L")
PALM_UP, PALM_DOWN, BACK_OUT = Vector((0, 0, -1)), Vector((0, 0.1, 1)), Vector((1, 0, 0))   # back-of-hand directions


def lerp(a, b, k):
    return Vector(a).lerp(Vector(b), k)


def pose_arm(s, up, fore, hand_fwd, back, shape=None, k=1.0, shrug=None):
    """Blend this arm from the bind pose (k=0) to the given world directions (LEFT values, mirrored for R)."""
    up_k = lerp(REST_UP, up, k).normalized()
    sh = max(0.0, up_k.z + 0.2) if shrug is None else shrug
    rot(rig, f"shoulder.{s}", (raise_side(s), 14 * sh))
    arm(rig, s, up_k, lerp(REST_FORE, fore, k).normalized())
    hand_dir(rig, s, lerp(REST_HAND, hand_fwd, k).normalized(), lerp(PALM_UP, back, k).normalized())
    if shape:
        hand_shape(rig, s, shape)


def breathe(b):
    rot(rig, "spine", (FWD_AXIS, -0.8 * b))
    rot(rig, "chest", (FWD_AXIS, -1.6 * b))


# ---------------------------------------------------------------- poses
MUDRA = [(42, 58, 48), (12, 16, 10), (12, 16, 10), (12, 16, 10)]
OPEN = [(4, 6, 2), (5, 7, 3), (6, 8, 4), (8, 10, 6)]


def mudra_hands(open_k=0.0, ripple=0.0):
    """Gyan mudra (index tip on the thumb) .. open palm; ripple: a slow finger wave, pinky to index."""
    for s in "LR":
        for i, f in enumerate(FINGERS):
            w = 8 * open_k * math.sin(ripple - 0.7 * (3 - i))
            finger(rig, s, f, [a + (b - a) * open_k + w for a, b in zip(MUDRA[i], OPEN[i])])
        thumb(rig, s, [a * (1 - 0.8 * open_k) for a in (18, 22, 18)], 22 * (1 - open_k))


def meditate_face(smile=1.0):
    eyes(rig, 0.0)
    brows(rig, 1.0, 0.0)
    mouth(rig, 0.0, smile)  # calm, closed smile


def meditate(breath=0.0, lift=0.0, ripple=0.0):
    """Yoga pose: hands palm-up over the knees in the mudra; breath -1..1; lift: hands float up a little on the
    in-breath and open with a finger ripple (the old hero's breathing loop)."""
    breathe(1.4 * breath)
    head(rig, pitch=-3 + 2.5 * breath)
    k = ease(lift)
    for s in "LR":
        up = lerp(REST_UP, Vector((0.62, -0.10, -0.78)), k).normalized()
        fo = lerp(REST_FORE, Vector((0.45, -0.85, 0.28)), k).normalized()
        rot(rig, f"shoulder.{s}", (raise_side(s), 3 * k))
        arm(rig, s, up, fo)
        hand_dir(rig, s, (fo + Vector((0.1, 0, -0.12 * k * math.sin(ripple)))).normalized(), PALM_UP)
    mudra_hands(k, ripple)
    meditate_face(1.0 + 0.1 * max(0.0, breath))


def base(breath=0.0, look=(0.0, 0.0), smile=1.0, mouth_open=0.0):
    """Awake, seated, hands resting open and palm-up over the knees."""
    breathe(breath)
    head(rig, pitch=-1.0 * breath)
    for s in "LR":
        pose_arm(s, REST_UP, REST_FORE, REST_HAND, PALM_UP, "relaxed", 1.0, 0.0)
    eyes(rig, 1.0, look)
    brows(rig, 1.0, 0.0)
    mouth(rig, mouth_open, smile)


T_UP, T_FORE, T_HAND = Vector((0.97, 0.0, -0.24)), Vector((0.985, -0.06, -0.12)), Vector((0.99, -0.08, -0.06))


def fly_pose(k, wave=0.0, bob=0.0, joy=1.0):
    """k: 0 yoga pose .. 1 T-pose with the palms up; wave: wing beat in degrees (+ = arms up)."""
    move(rig, "root", (0, 0, bob))
    breathe(0.5 * k)
    head(rig, pitch=4 * k, roll=2 * math.sin(math.radians(wave) * 3) * k)
    for s in "LR":
        pose_arm(s, T_UP, T_FORE, T_HAND, PALM_UP, None, ease(k), 0.0)
        # the beat: about the arm's forward axis at the shoulder, the hands lagging a little behind
        turn(rig, f"upper_arm.{s}", Y, (-wave if s == "L" else wave) * k)
        turn(rig, f"hand.{s}", Y, (wave if s == "L" else -wave) * 0.5 * k)
    o = ease(min(1.0, k * 1.6))
    for s in "LR":
        for i, f in enumerate(FINGERS):
            finger(rig, s, f, [a + (b - a) * o for a, b in zip(MUDRA[i], OPEN[i])], (-3, -1, 1, 4)[i] * o)
        thumb(rig, s, [a * (1 - o) for a in (18, 22, 18)], 22 * (1 - o))
    meditate_face(1.0 + 0.15 * k)  # still meditating in the air: eyes closed, a calm smile


# ---------------------------------------------------------------- keying (quaternion continuity per action)
_last = {}


def key(frame, only=None):
    for pb in rig.pose.bones:
        if only and pb.name not in only:
            continue
        q = pb.rotation_quaternion
        prev = _last.get(pb.name)
        if prev is not None and prev.dot(q) < 0:
            pb.rotation_quaternion = -q
        _last[pb.name] = pb.rotation_quaternion.copy()
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("scale", frame=frame)


def pose_at(frame, fn, only=None):
    reset(rig)
    bpy.context.view_layer.update()
    fn()
    key(frame, only)


def new_action(name, end, cyclic=False):
    _last.clear()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    act.use_frame_range = True
    act.frame_start, act.frame_end = 0, end
    act.use_cyclic = cyclic
    rig.animation_data_create()
    rig.animation_data.action = act
    return act


def finish(act):
    track = rig.animation_data.nla_tracks.new()
    track.name = act.name
    track.strips.new(act.name, 0, act)
    track.mute = True
    rig.animation_data.action = None
    print(f"clip {act.name}: 0-{int(act.frame_end)}")


def loop(name, frames, step, fn):
    act = new_action(name, frames, cyclic=True)
    for f in range(0, frames + 1, step):
        pose_at(f, lambda f=f: fn(2 * math.pi * (f % frames) / frames))
    finish(act)


def oneshot(name, frames, keys):
    act = new_action(name, frames)
    pose_at(0, base)
    for f, fn in keys:
        pose_at(f, fn)
    pose_at(frames, base)
    finish(act)


# ---------------------------------------------------------------- gestures
def wave_pose(swing=0.0, k=1.0):
    """Right hand (viewer's left) up beside the head, out past its rim, palm to the viewer."""
    pose_arm("R", (0.88, -0.15, 0.45), (0.55, -0.22, 0.80), (0.28, -0.18, 0.94), (0.0, 1.0, 0.05),
             "wave" if k > 0.5 else "relaxed", k)
    turn(rig, "forearm.R", VIEW, -swing * k)
    turn(rig, "hand.R", VIEW, -swing * 0.6 * k)


def point_pose(s, k=1.0):
    pose_arm(s, (0.85, -0.45, -0.25), (0.80, -0.58, 0.12), (0.78, -0.60, 0.16), (0.0, 0.25, 1.0),
             "point" if k > 0.4 else "relaxed", k)


def present_pose(s, k=1.0):
    pose_arm(s, (0.88, -0.30, -0.36), (0.72, -0.55, 0.42), (0.70, -0.50, 0.50), PALM_UP, "open", k)


def thumbs_up_pose(s, k=1.0):
    pose_arm(s, (0.45, -0.60, -0.66), (0.05, -0.88, 0.47), (0.02, -0.95, 0.30), BACK_OUT, None, k)
    for f in FINGERS:
        finger(rig, s, f, [80 * k, 95 * k, 70 * k])
    thumb(rig, s, [-10 * k, -5 * k, 0], -25 * k)


def clap_pose(apart=0.0):
    for s in "LR":
        fo = Vector((-0.42 + 0.5 * apart, -0.85, 0.30)).normalized()
        pose_arm(s, (0.35, -0.62, -0.70), fo, (fo + Vector((0, -0.2, 0.25))).normalized(), BACK_OUT, "open")


def think_pose(look=0.0, k=1.0):
    """Hmm...: right hand (viewer's left) at the chin, head tilted, eyes up to the side, brows knit."""
    pose_arm("R", (0.25, -0.62, -0.74), (-0.45, -0.40, 0.80), (-0.30, -0.45, 0.84), (0.3, -0.4, 0.0), None, k)
    hand_shape(rig, "R", "fist", 0.7 * k)
    head(rig, yaw=-6 * k + 4 * look, pitch=4 * k, roll=-7 * k)
    eyes(rig, 1.0, ((-0.007 + 0.010 * look) * k, 0.008 * k))
    brows(rig, 1.0, 0.004 * k, 6 * k)
    mouth(rig, 0.0, 0.7)


TYPE_UP, TYPE_FORE, TYPE_HAND = Vector((0.33, -0.55, -0.77)), Vector((-0.10, -0.98, -0.14)), Vector((-0.04, -0.96, -0.27))


def typing_pose(t):
    """Typing on a laptop over the lap: palms down, fingers tapping in a rolling pattern, eyes on the keys."""
    breathe(0.2 * math.sin(t))
    head(rig, pitch=-9, yaw=2 * math.sin(t * 0.5))
    for s, ph in (("L", 0.0), ("R", 1.7)):
        pose_arm(s, TYPE_UP, TYPE_FORE, TYPE_HAND, PALM_DOWN, None, 1.0, 0.0)
        turn(rig, f"forearm.{s}", X, 3 * math.sin(2 * t + ph))           # the hands hop across the keys
        for i, f in enumerate(FINGERS):
            tap = max(0.0, math.sin(4 * t + ph + 1.3 * i)) ** 3          # one finger at a time strikes
            finger(rig, s, f, [18 + 30 * tap, 22 + 25 * tap, 12 + 10 * tap])
        thumb(rig, s, [10, 18, 10], 15)
    eyes(rig, 1.0, (0.002 * math.sin(t), -0.009))
    brows(rig, 1.0, -0.001, 3)     # focused
    mouth(rig, 0.0, 0.8)


def happy_pose(k, bounce=0.0):
    move(rig, "root", (0, 0, bounce))
    for s in "LR":
        pose_arm(s, (0.62, -0.50, -0.60), (0.20, -0.55, 0.81), (0.15, -0.55, 0.82), BACK_OUT, "fist", k)
    eyes(rig, 0.0)  # ^ ^
    brows(rig, 1.0, 0.008)
    mouth(rig, 1.0, 1.3)


# ---------------------------------------------------------------- clips
def clip_meditate():
    # 8 s: in-breath floats the hands up a little and opens them with a finger ripple, out-breath settles them
    act = new_action("Meditate", 240, cyclic=True)
    for f in range(0, 241, 4):
        t = 2 * math.pi * f / 240
        b = -math.cos(t)
        pose_at(f, lambda t=t, b=b: meditate(b, 0.35 + 0.35 * b, 2 * t))
    finish(act)


def clip_fly():
    # 8 s loop: yoga pose -> palms open, arms float out to a T (palms up) -> two slow wing beats -> back into the
    # yoga pose (frame 240 = frame 0). The body hovers on a gentle bob throughout.
    act = new_action("Fly", 240, cyclic=True)
    for f in range(0, 241, 3):
        u = f / 240
        if u < 0.25:
            k = ease(u / 0.25)
        elif u < 0.78:
            k = 1.0
        else:
            k = 1 - ease((u - 0.78) / 0.2)
        beat = 12 * math.sin(2 * math.pi * (u - 0.25) / 0.265) if 0.25 <= u < 0.78 else 0.0
        bob = 0.012 * math.sin(2 * math.pi * u * 2)
        pose_at(f, lambda k=k, beat=beat, bob=bob: (meditate(0.0) if k < 1e-4 else fly_pose(k, beat, bob)))
    finish(act)


def clip_idle():
    act = new_action("Idle", 120, cyclic=True)
    for f in range(0, 121, 6):
        t = 4 * math.pi * f / 120
        pose_at(f, lambda t=t: (base(math.sin(t)), head(rig, yaw=2 * math.sin(t * 0.5), pitch=-1.0 * math.sin(t),
                                                         roll=1.5 * math.sin(t * 0.5))))
    finish(act)


def clip_wake():
    act = new_action("Wake", 54)
    pose_at(0, lambda: meditate(0.0))
    pose_at(8, lambda: (meditate(0.3), head(rig, pitch=2)))

    def opening(open_, lift, brow):
        base(0.2)
        move(rig, "root", (0, 0, lift))
        eyes(rig, open_)
        brows(rig, 1.0, 0.006 * brow)
    pose_at(14, lambda: opening(0.35, 0.004, 0.0))
    pose_at(18, lambda: opening(1.0, 0.012, 1.0))
    pose_at(24, lambda: (opening(1.0, 0.004, 1.0), mouth(rig, 1.0)))
    pose_at(30, lambda: (opening(0.15, 0.0, 1.0), mouth(rig, 1.0)))   # quick happy blink
    pose_at(34, lambda: (opening(1.0, 0.0, 1.0), mouth(rig, 0.0, 1.2)))
    pose_at(46, lambda: (base(0.0, smile=1.15), brows(rig, 1.0, 0.002)))
    pose_at(54, base)
    finish(act)


def clip_typing():
    loop("Typing", 60, 2, typing_pose)


def clip_talk():
    opens = (0, 1, 0.3, 1, 0, 0.8, 0.2, 1, 0.5, 0, 1, 0.3, 0)
    act = new_action("Talk", 60, cyclic=True)
    for i, o in enumerate(opens):
        def tk(o=o, i=i):
            base(0.2 * math.sin(i), mouth_open=1.0 if o > 0.25 else 0.0, smile=1.1)
            if o > 0.25:
                rig.pose.bones["mouth"].scale = (0.85 + 0.15 * o, 1, 0.45 + 0.55 * o)
            head(rig, yaw=4 * math.sin(i * 0.6), pitch=2 * math.sin(i * 1.3), roll=2 * math.sin(i * 0.7))
            brows(rig, 1.0, 0.003 * o)
        pose_at(round(i * 60 / (len(opens) - 1)), tk)
    finish(act)


def clip_explain():
    """Talking while presenting with the open hand (viewer's right)."""
    opens = (0, 1, 0.3, 1, 0, 0.8, 0.2, 1, 0.5, 0, 1, 0.3, 0)
    act = new_action("Explain", 60, cyclic=True)
    for i, o in enumerate(opens):
        def ex(o=o, i=i):
            base(0.2 * math.sin(i), mouth_open=1.0 if o > 0.25 else 0.0, smile=1.2)
            if o > 0.25:
                rig.pose.bones["mouth"].scale = (0.85 + 0.15 * o, 1, 0.45 + 0.55 * o)
            present_pose("L", 0.9 + 0.1 * math.sin(i * 0.9))
            head(rig, yaw=10, pitch=2 * math.sin(i * 1.3), roll=4 + 2 * math.sin(i * 0.7))
            eyes(rig, 1.0, (0.008, -0.001))
        pose_at(round(i * 60 / (len(opens) - 1)), ex)
    finish(act)


def clip_think():
    loop("Think", 120, 10, lambda t: (base(0.0), think_pose(math.sin(t))))


def clip_wave():
    def w(sw, k=1.0, hk=1.0):
        base(0.3)
        wave_pose(sw, k)
        head(rig, yaw=-7 * hk, roll=-6 * hk, pitch=2 * hk)
        eyes(rig, 1.0, (-0.004 * hk, 0.002 * hk))
        brows(rig, 1.0, 0.006 * hk)
        mouth(rig, 1.0 if hk > 0.5 else 0.0, 1.2)
    keys = [(8, lambda: w(-6, 0.55, 0.6))]
    keys += [(f, lambda sw=sw: w(sw)) for f, sw in ((14, 18), (21, -16), (28, 18), (35, -16), (42, 18), (49, -10), (55, 4))]
    keys += [(66, lambda: w(0, 0.45, 0.5))]
    oneshot("Wave", 80, keys)


def clip_point(name, s, sg):
    def p(k, bounce=0.0, ek=1.0):
        base(0.2)
        point_pose(s, k)
        if bounce:
            turn(rig, f"forearm.{s}", Z, sg * 5 * bounce)
        head(rig, yaw=sg * 18 * ek, pitch=3 * ek, roll=sg * 4 * ek)
        eyes(rig, 1.0, (sg * 0.010 * ek, 0.003 * ek))
        brows(rig, 1.0, 0.005 * ek)
        mouth(rig, 1.0 if ek > 0.5 else 0.0, 1.2)
    oneshot(name, 84, [(10, lambda: p(0.7, 0, 0.6)), (16, lambda: p(1.0, 1.0)), (21, lambda: p(1.0, -0.4)),
                       (26, lambda: p(1.0)), (60, lambda: p(1.0)), (72, lambda: p(0.3, 0, 0.3))])


def clip_present():
    def pr(k):
        base(0.2, smile=1.25)
        present_pose("L", k)
        head(rig, yaw=12 * k, roll=6 * k)
        eyes(rig, 1.0, (0.008 * k, -0.002 * k))
        brows(rig, 1.0, 0.004 * k)
    oneshot("Present", 80, [(12, lambda: pr(0.8)), (18, lambda: pr(1.05)), (24, lambda: pr(1.0)), (58, lambda: pr(1.0)),
                            (70, lambda: pr(0.3))])


def clip_thumbs_up():
    def tu(k, pump=0.0):
        base(0.2, smile=1.3)
        thumbs_up_pose("L", k)
        if pump:
            turn(rig, "forearm.L", X, -6 * pump)
        head(rig, yaw=6 * k, roll=5 * k)
        eyes(rig, 1.0 if k < 0.9 else 0.0)  # ^ ^ at the peak
        brows(rig, 1.0, 0.005 * k)
        mouth(rig, 1.0 if k > 0.5 else 0.0, 1.3)
    oneshot("ThumbsUp", 70, [(10, lambda: tu(0.8)), (15, lambda: tu(1.0, 1.0)), (20, lambda: tu(1.0)),
                             (48, lambda: tu(1.0)), (60, lambda: tu(0.3))])


def clip_clap():
    keys = [(6, lambda: (base(0.2), clap_pose(1.0), mouth(rig, 1.0, 1.3)))]
    for f in range(10, 50, 6):
        keys.append((f, lambda: (base(0.2), clap_pose(0.0), eyes(rig, 0.0), mouth(rig, 1.0, 1.35))))
        keys.append((f + 3, lambda: (base(0.2), clap_pose(0.8), mouth(rig, 1.0, 1.35))))
    keys.append((56, lambda: (base(0.1), clap_pose(1.0), mouth(rig, 1.0, 1.2))))
    oneshot("Clap", 66, keys)


def clip_happy():
    oneshot("Happy", 60, [(f, lambda k=k, lift=lift: (base(0.0, smile=1.3), happy_pose(k, lift)))
                          for f, k, lift in ((8, 0.7, 0.0), (13, 1.0, 0.025), (19, 1.0, 0.0), (24, 1.0, 0.02),
                                             (30, 1.0, 0.0), (44, 0.6, 0.0))])


def clip_look_around():
    """Eyes lead, the head follows."""
    keys = []
    for f, yaw, ex, ey in ((8, 0, -0.011, 0.0), (18, -18, -0.011, 0.002), (34, -20, -0.006, 0.006),
                           (46, 0, 0.011, 0.0), (56, 18, 0.011, 0.002), (72, 20, 0.006, -0.004), (84, 0, 0.0, 0.0)):
        keys.append((f, lambda yaw=yaw, ex=ex, ey=ey: (base(0.0, look=(ex, ey)), head(rig, yaw=yaw, pitch=2),
                                                       brows(rig, 1.0, 0.003 if ey > 0 else 0.0, 4))))
    oneshot("LookAround", 96, keys)


def clip_brows():
    """Eyebrow play: both up (surprise), a cheeky one-sided raise, worried tilt, back to calm."""
    def br(up_l=0.0, up_r=0.0, tilt=0.0, look=(0.0, 0.0), mo=0.0):
        base(0.0, look=look, mouth_open=mo, smile=1.1)
        brows(rig, 1.0, 0.0, tilt)
        rig.pose.bones["brow.L"].location.z += up_l
        rig.pose.bones["brow.R"].location.z += up_r
    oneshot("Brows", 90, [(8, lambda: br(0.022, 0.022, 0, (0, 0.004), 1.0)), (18, lambda: br(0.022, 0.022, 0, (0, 0.004), 1.0)),
                          (26, lambda: br(0.0, 0.0)), (34, lambda: br(0.022, -0.004, 0, (0.007, 0))),
                          (42, lambda: br(-0.004, 0.022, 0, (-0.007, 0))), (50, lambda: br(0.022, -0.004, 0, (0.007, 0))),
                          (60, lambda: br(0.004, 0.004, -15)), (72, lambda: br(0.004, 0.004, -15)), (80, lambda: br())])


def clip_nod():
    oneshot("Nod", 40, [(f, lambda a=a: (base(0.0, smile=1.2), head(rig, pitch=-a, neck_share=0.4)))
                        for f, a in ((7, 10), (14, -2), (21, 8), (28, -1))])


def clip_head_shake():
    oneshot("HeadShake", 44, [(f, lambda a=a: (base(0.0, smile=0.6), head(rig, yaw=a), brows(rig, 1.0, 0.0, 5)))
                              for f, a in ((6, 14), (13, -14), (20, 12), (27, -10), (33, 4))])


def clip_smile():
    def sm(k):
        base(0.0, smile=1.0 + 0.35 * k)
        eyes(rig, 1.0 - k if k < 0.9 else 0.0)
        for s in "LR":
            rot(rig, f"shoulder.{s}", (raise_side(s), 6 * k))
        head(rig, roll=5 * k, pitch=2 * k)
    oneshot("Smile", 48, [(6, lambda: sm(0.6)), (10, lambda: sm(1.0)), (34, lambda: sm(1.0)), (40, lambda: sm(0.4))])


def clip_blink():
    act = new_action("Blink", 8)
    for f, o in ((0, 1.0), (2, 0.4), (3, 0.0), (5, 0.0), (6, 0.4), (8, 1.0)):
        pose_at(f, lambda o=o: eyes(rig, o), only=FACE_ONLY)
    finish(act)


CLIPS = [clip_meditate, clip_fly, clip_idle, clip_wake, clip_typing, clip_talk, clip_explain, clip_think, clip_wave,
         lambda: clip_point("PointRight", "L", 1), lambda: clip_point("PointLeft", "R", -1), clip_present,
         clip_thumbs_up, clip_clap, clip_happy, clip_look_around, clip_brows, clip_nod, clip_head_shake, clip_smile,
         clip_blink]

for fn in CLIPS:
    fn()
reset(rig)
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

for o in bpy.context.scene.objects:
    o.select_set(o.type in ("MESH", "ARMATURE"))
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
    export_texcoords=True, export_normals=True, export_materials="EXPORT", export_skins=True,
    export_all_influences=False, export_def_bones=False, export_animations=True,
    export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_step=1,
    export_reset_pose_bones=True, export_anim_single_armature=True, export_optimize_animation_size=True,
)


def strip_blink(path):
    """The exporter samples every bone into every clip; Blink must only touch eyes/lids so it can layer."""
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    jlen, jtype = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + jlen])
    tail = data[20 + jlen:]
    keep = {i for i, n in enumerate(gltf["nodes"]) if n.get("name", "").split(".")[0] in ("eye", "lid")}
    for a in gltf["animations"]:
        if a["name"] != "Blink":
            continue
        chans = [c for c in a["channels"] if c["target"].get("node") in keep]
        used = sorted({c["sampler"] for c in chans})
        remap = {old: new for new, old in enumerate(used)}
        a["samplers"] = [a["samplers"][k] for k in used]
        for c in chans:
            c["sampler"] = remap[c["sampler"]]
        a["channels"] = chans
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    out = struct.pack("<III", magic, version, 20 + len(js) + len(tail)) + struct.pack("<II", len(js), jtype) + js + tail
    open(path, "wb").write(out)


strip_blink(OUT_GLB)
print("exported", OUT_GLB, os.path.getsize(OUT_GLB) // 1024, "KB")
