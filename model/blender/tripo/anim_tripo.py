"""Standing Tripo mascot, step 3: animation clips + GLB export.

blender -b rig.blend --python anim_tripo.py -- <out.glb> <out.blend>

Clips (30 fps). Loops: Idle, Walk, Run, Dance, Talk, Think, Sit.
One-shots (start and end in the Idle pose, so they chain): Wave, PointLeft, PointRight (viewer's left/right), Present,
ThumbsUp, Clap, Jump, Celebrate, Bow, Nod, HeadShake, LookAround, Smile, Surprised, Sad, SitDown (ends in Sit),
StandUp (starts from Sit). Blink only keys the eye/lid bones; the web page plays it additively on top of any clip.
Every other clip keys every bone, so cross-fades never inherit a stale pose.

The head is huge (x ±0.29 just above the shoulders), so raised hands go out to the side, never straight up.
Legs use a 2-bone IK in the sagittal plane (leg_ik), so stance feet stay planted and knees fold forward.
"""
import bpy, sys, os, math, json, struct
from mathutils import Vector

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "sit"))
from pose_sit import FINGERS, arm as _arm, brows, eyes, finger, hand_dir, hand_shape, head, mouth, thumb  # noqa: E402
from posing import move, raise_side, reset, rot, turn  # noqa: E402

OUT_GLB, OUT_BLEND = sys.argv[sys.argv.index("--") + 1:][:2]
rig = bpy.data.objects["Rig"]
scene = bpy.context.scene
scene.render.fps = 30
FACE_ONLY = [f"{p}.{s}" for p in ("eye", "lid") for s in "LR"]
VIEW = Vector((0, -1, 0))  # toward the viewer
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FWD_AXIS = Vector((-1, 0, 0))  # rotating about it by + swings a limb (or tips the torso) forward
bl = rig.data.bones


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- legs: sagittal 2-bone IK relative to the bind pose
def _sag(v):
    """(forward, down) of a rest-space vector."""
    return -v.y, -v.z


HIP0, KNEE0, ANK0 = (bl["thigh.L"].head_local, bl["shin.L"].head_local, bl["shin.L"].tail_local)
THIGH, SHIN = (KNEE0 - HIP0).length, (ANK0 - KNEE0).length
REST_THIGH = math.atan2(*_sag(KNEE0 - HIP0))   # bind angles from straight down, forward positive
REST_SHIN = math.atan2(*_sag(ANK0 - KNEE0))
REST_REACH = _sag(ANK0 - HIP0)                  # where the ankle sits relative to the hip in the bind pose


def leg(s, thigh=0.0, knee=0.0, foot=0.0, spread=0.0, toe=0.0):
    """FK in degrees relative to the bind pose: thigh + forward, knee + folds the shin back, foot + toes up."""
    sx = 1 if s == "L" else -1
    rot(rig, f"thigh.{s}", (FWD_AXIS, thigh), (Y, -sx * spread))
    rot(rig, f"shin.{s}", (FWD_AXIS, -knee))
    rot(rig, f"foot.{s}", (FWD_AXIS, foot))
    rot(rig, f"toe.{s}", (FWD_AXIS, toe))


def leg_ik(s, fwd=0.0, up=0.0, sole=0.0, spread=0.0, toe=0.0):
    """Put the ankle `fwd` ahead of / `up` above its bind position relative to the hip (pelvis frame);
    sole: foot pitch in the world-ish sagittal plane, degrees, toes up +."""
    f0, d0 = REST_REACH
    f, d = f0 + fwd, d0 - up
    D = min(math.hypot(f, d), (THIGH + SHIN) * 0.9995)
    phi = math.atan2(f, d)
    alpha = math.acos(max(-1.0, min(1.0, (THIGH ** 2 + D ** 2 - SHIN ** 2) / (2 * THIGH * D))))
    th = phi + alpha                                            # knee in front of the hip-ankle line
    inner = math.acos(max(-1.0, min(1.0, (THIGH ** 2 + SHIN ** 2 - D ** 2) / (2 * THIGH * SHIN))))
    sh = th - (math.pi - inner)
    t_rot = math.degrees(th - REST_THIGH)
    s_rot = math.degrees((sh - th) - (REST_SHIN - REST_THIGH))
    leg(s, t_rot, -s_rot, sole - t_rot - s_rot, spread, toe)


def stand(drop=0.0, back=0.0, sole=0.0):
    """Lower the pelvis by `drop` and move it back by `back`, both feet planted."""
    move(rig, "root", (0, back, -drop))
    for s in "LR":
        leg_ik(s, back, drop, sole)  # pelvis back = ankles relatively forward


# ---------------------------------------------------------------- arms and hands (world directions, LEFT values)
def arm(s, upper, fore, shrug=None):
    """Aim the arm; the clavicle lifts a little once the elbow rises above the shoulder."""
    k = max(0.0, Vector(upper).normalized().z) if shrug is None else shrug
    rot(rig, f"shoulder.{s}", (raise_side(s), 16 * k))
    _arm(rig, s, upper, fore)


RELAX_UP, RELAX_FORE = Vector((0.40, 0.02, -0.92)), Vector((0.28, -0.20, -0.94))


def arms_relaxed(swing=0.0, s_only=None, shape="relaxed"):
    """Hanging arms; swing + = forward (degrees, per side sign handled by the caller)."""
    for s in "LR":
        if s_only and s != s_only:
            continue
        sw = swing if s == "L" else -swing
        q = Vector((0, -math.sin(math.radians(sw)), 0))
        up = (RELAX_UP + q * 0.9).normalized()
        fo = (RELAX_FORE + q * 1.3 + Vector((0, -0.10 * max(0, sw) / 20, 0))).normalized()
        arm(s, up, fo, 0.0)
        hand_dir(rig, s, (fo + Vector((0.05, -0.04, 0))).normalized(), (1.0, 0.0, 0.15))
        hand_shape(rig, s, shape)


def palm_out(s, fwd):
    """Back of the hand toward the character, palm to the viewer."""
    hand_dir(rig, s, fwd, (0.0, 1.0, 0.05))


# ---------------------------------------------------------------- whole-body building blocks
def breathe(b):
    rot(rig, "spine", (FWD_AXIS, -0.8 * b))
    rot(rig, "chest", (FWD_AXIS, -1.6 * b))


def face(open_mouth=1.0, smile=1.0, look=(0.0, 0.0), eyes_open=1.0, brow_up=0.0, brow_tilt=0.0):
    eyes(rig, eyes_open, look)
    brows(rig, 1.0, brow_up, brow_tilt)
    mouth(rig, open_mouth, smile)


def base(breath=0.0, look=(0.0, 0.0), mouth_open=1.0, smile=1.0):
    """Idle stance: feet planted, soft knees, arms hanging, happy open-mouth smile (the reference face)."""
    stand(0.004)
    breathe(breath)
    head(rig, pitch=-1.0 * breath)
    arms_relaxed()
    face(mouth_open, smile, look)


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
    """Cyclic clip: fn(t) with t in [0, 2pi)."""
    act = new_action(name, frames, cyclic=True)
    for f in range(0, frames + 1, step):
        pose_at(f, lambda f=f: fn(2 * math.pi * (f % frames) / frames))
    finish(act)


def oneshot(name, frames, keys):
    """keys: [(frame, fn)]; frame 0 and the last frame are the Idle pose."""
    act = new_action(name, frames)
    pose_at(0, base)
    for f, fn in keys:
        pose_at(f, fn)
    pose_at(frames, base)
    finish(act)


# ---------------------------------------------------------------- locomotion
def gait(t, stride, lift, stance, bob, lean, arm_swing, elbow, run=False):
    """One in-place step cycle. t in [0, 2pi); the left foot is planted at t=0 (heel strike)."""
    # pelvis: lowest at heel strike, highest at passing (or in the flight phase of a run)
    move_z = -bob * (0.5 + 0.5 * math.cos(2 * t)) - (0.004 if not run else 0.012)
    move(rig, "root", (0, 0, move_z))
    for s, ph in (("L", 0.0), ("R", 0.5)):
        q = (t / (2 * math.pi) + ph) % 1.0
        if q < stance:                                   # planted: slides back under the body
            k = q / stance
            fwd = stride * (1 - 2 * k)
            up = 0.0
            sole = 8 * (1 - ease(k * 4)) - 22 * ease((k - 0.7) / 0.3)    # heel strike .. push off
            toe = 22 * ease((k - 0.7) / 0.3)
        else:                                            # swing: lifts and comes through
            k = (q - stance) / (1 - stance)
            fwd = stride * (2 * ease(k) - 1)
            up = lift * math.sin(math.pi * k) ** 0.8
            sole = -22 * (1 - ease(k * 3)) + 8 * ease((k - 0.6) / 0.4)
            toe = 10 * (1 - ease(k * 2))
        leg_ik(s, fwd, up - move_z, sole, 1.5, toe)     # the lowered pelvis brings the ankle relatively up
    rot(rig, "hips", (Z, 5 * math.sin(t)), (Y, 2.5 * math.cos(t)))
    rot(rig, "spine", (FWD_AXIS, lean * 0.5), (Z, -3 * math.sin(t)))
    rot(rig, "chest", (FWD_AXIS, lean * 0.5), (Z, -4 * math.sin(t)))
    head(rig, yaw=2 * math.sin(t), pitch=-lean * 0.6, roll=-1.5 * math.cos(t))
    for s, sg in (("L", 1), ("R", -1)):
        sw = -arm_swing * math.sin(t) * sg              # arms swing opposite to the legs
        q = Vector((0, -math.sin(math.radians(sw)), 0))
        up = (RELAX_UP + q * 1.1 + Vector((0, 0, 0.1))).normalized()
        fo = (up + Vector((0, -math.sin(math.radians(elbow)), 0)) * 1.4 + q * 0.5).normalized()
        arm(s, up, fo, 0.0)
        hand_dir(rig, s, (fo + Vector((0.05, -0.05, 0))).normalized(), (1.0, 0.0, 0.15))
        hand_shape(rig, s, "fist" if run else "relaxed", 0.6 if run else 1.0)


def walk(t):
    gait(t, 0.046, 0.042, 0.6, 0.008, 3, 26, 25)
    face(1.0, 1.1)


def run(t):
    gait(t, 0.066, 0.085, 0.40, 0.018, 14, 42, 85, run=True)
    face(1.0, 1.2, brow_up=0.004)


# ---------------------------------------------------------------- gestures
def wave_pose(swing=0.0, k=1.0):
    """Character's right hand (viewer's left) up beside the head, out past its rim, palm to the viewer."""
    up = RELAX_UP.lerp(Vector((0.93, -0.12, 0.34)), k)
    fo = RELAX_FORE.lerp(Vector((0.62, -0.22, 0.76)), k)
    arm("R", up, fo)
    turn(rig, "forearm.R", VIEW, -swing * k)
    palm_out("R", Vector((0.25, -0.15, 0.96)).lerp(Vector((0.25, -0.15, 0.96)), k).normalized())
    turn(rig, "hand.R", VIEW, -swing * 0.6 * k)
    hand_shape(rig, "R", "wave" if k > 0.5 else "relaxed")


def point_pose(s, k=1.0):
    """Index finger toward this side at chest height."""
    up = RELAX_UP.lerp(Vector((0.93, -0.30, 0.05)), k)
    fo = RELAX_FORE.lerp(Vector((0.92, -0.38, 0.12)), k)
    arm(s, up, fo)
    hand_dir(rig, s, Vector((0.25, -0.2, -0.95)).lerp(Vector((0.92, -0.36, 0.14)), k).normalized(),
             Vector((1.0, 0.0, 0.15)).lerp(Vector((0.0, 0.25, 1.0)), k).normalized())
    hand_shape(rig, s, "point" if k > 0.4 else "relaxed")


def present_pose(s, k=1.0):
    """Open palm sweeping out to this side: "here it is"."""
    up = RELAX_UP.lerp(Vector((0.82, -0.40, -0.40)), k)
    fo = RELAX_FORE.lerp(Vector((0.70, -0.70, 0.12)), k)
    arm(s, up, fo)
    hand_dir(rig, s, Vector((0.25, -0.2, -0.95)).lerp(Vector((0.80, -0.55, 0.20)), k).normalized(),
             Vector((1.0, 0.0, 0.15)).lerp(Vector((0.05, 0.15, -1.0)), k).normalized())
    hand_shape(rig, s, "open")


def thumbs_up_pose(s, k=1.0):
    up = RELAX_UP.lerp(Vector((0.55, -0.62, -0.55)), k)
    fo = RELAX_FORE.lerp(Vector((0.10, -0.85, 0.52)), k)
    arm(s, up, fo)
    hand_dir(rig, s, Vector((0.25, -0.2, -0.95)).lerp(Vector((0.05, -0.95, 0.30)), k).normalized(),
             Vector((1.0, 0.0, 0.15)).lerp(Vector((1.0, 0.1, 0.0)), k).normalized())
    for f in FINGERS:
        finger(rig, s, f, [80 * k, 95 * k, 70 * k])
    thumb(rig, s, [-10 * k, -5 * k, 0], -25 * k)


def cheer_arms(k=1.0, fist=True):
    for s in "LR":
        up = RELAX_UP.lerp(Vector((0.88, -0.14, 0.46)), k)
        fo = RELAX_FORE.lerp(Vector((0.62, -0.22, 0.75)), k)
        arm(s, up, fo)
        hand_dir(rig, s, Vector((0.25, -0.2, -0.95)).lerp(Vector((0.45, -0.25, 0.86)), k).normalized(),
                 Vector((1.0, 0.0, 0.15)).lerp(Vector((0.3, 1.0, 0.0)), k).normalized())
        hand_shape(rig, s, "fist" if fist else "open", k)


def clap_pose(apart=0.0):
    """Hands meet in front of the chest; apart 0 touching .. 1 open."""
    for s in "LR":
        up = Vector((0.45, -0.70, -0.55))
        fo = Vector((-0.30 + 0.45 * apart, -0.92, 0.25)).normalized()
        arm(s, up, fo, 0.0)
        hand_dir(rig, s, (fo + Vector((0, -0.2, 0.25))).normalized(), (1.0, 0.0, 0.0))
        hand_shape(rig, s, "open")


def think_pose(look=0.0, k=1.0):
    """Hmm...: right hand (viewer's left) at the chin, head tilted, eyes up to the side, brows knit."""
    up = RELAX_UP.lerp(Vector((0.25, -0.62, -0.74)), k)
    fo = RELAX_FORE.lerp(Vector((-0.50, -0.42, 0.76)), k)
    arm("R", up, fo, 0.0)
    hand_dir(rig, "R", Vector((0.25, -0.2, -0.95)).lerp(Vector((-0.30, -0.45, 0.84)), k).normalized(),
             Vector((1.0, 0.0, 0.15)).lerp(Vector((0.3, -0.4, 0.0)), k).normalized())
    hand_shape(rig, "R", "fist", 0.7 * k)
    head(rig, yaw=-6 * k + 4 * look, pitch=4 * k, roll=-7 * k)
    eyes(rig, 1.0, ((-0.007 + 0.010 * look) * k, 0.008 * k))
    brows(rig, 1.0, 0.004 * k, 6 * k)
    mouth(rig, 0.0, 0.7)


def sit_pose(breath=0.0, k=1.0):
    """Seated on an (invisible) chair: pelvis back and down, thighs level, hands on the knees."""
    stand(0.085 * k, 0.075 * k)
    rot(rig, "spine", (FWD_AXIS, 10 * k))
    rot(rig, "chest", (FWD_AXIS, 2 * k - 0.8 * breath))
    head(rig, pitch=-6 * k)
    for s in "LR":
        up = RELAX_UP.lerp(Vector((0.30, -0.45, -0.84)), k)
        fo = RELAX_FORE.lerp(Vector((0.15, -0.90, -0.40)), k)
        arm(s, up, fo, 0.0)
        hand_dir(rig, s, Vector((0.25, -0.2, -0.95)).lerp(Vector((0.10, -0.85, -0.50)), k).normalized(),
                 Vector((1.0, 0.0, 0.15)).lerp(Vector((0.2, -0.3, 1.0)), k).normalized())
        hand_shape(rig, s, "relaxed")


# ---------------------------------------------------------------- clips
def clip_idle():
    def p(t):
        base(math.sin(t))
        move(rig, "root", (0.003 * math.sin(t * 0.5), 0, 0))
        rot(rig, "hips", (Y, 1.2 * math.sin(t * 0.5)))
        head(rig, yaw=2 * math.sin(t * 0.5), pitch=-1.0 * math.sin(t), roll=1.5 * math.sin(t * 0.5))
    act = new_action("Idle", 120, cyclic=True)
    for f in range(0, 121, 6):  # t*0.5 must close the loop too: 120 frames = one full 0.5-rate cycle at 4pi
        pose_at(f, lambda f=f: p(4 * math.pi * (f % 120) / 120))
    finish(act)


def clip_dance():
    def p(t):
        b = 0.5 + 0.5 * math.cos(2 * t)          # two bounces per bar
        sway = math.sin(t)
        stand(0.018 * b)
        move(rig, "root", (0.014 * sway, 0, 0))
        rot(rig, "hips", (Y, -5 * sway), (Z, 8 * sway))
        rot(rig, "chest", (Y, 7 * sway), (Z, -6 * sway))
        head(rig, yaw=8 * sway, roll=10 * sway, pitch=3 * b)
        for s, sg in (("L", 1), ("R", -1)):
            k = ease(0.5 + 0.5 * sg * sway)      # the arm on the leaning side goes up
            up = RELAX_UP.lerp(Vector((0.90, -0.20, 0.38)), k)
            fo = Vector((0.45, -0.55, -0.70)).lerp(Vector((0.62, -0.22, 0.76)), k)
            arm(s, up, fo)
            hand_dir(rig, s, fo, Vector((1.0, 0.0, 0.15)).lerp(Vector((0.0, 1.0, 0.0)), k).normalized())
            hand_shape(rig, s, "point" if k > 0.6 else "relaxed")
        face(1.0, 1.3, (0.004 * sway, 0.0), brow_up=0.004 * b)
    loop("Dance", 48, 3, p)


def clip_talk():
    opens = (0, 1, 0.3, 1, 0, 0.8, 0.2, 1, 0.5, 0, 1, 0.3, 0)
    act = new_action("Talk", 60, cyclic=True)
    for i, o in enumerate(opens):
        def tk(o=o, i=i):
            base(0.2 * math.sin(i), mouth_open=1.0 if o > 0.25 else 0.0, smile=1.1)
            if o > 0.25:
                rig.pose.bones["mouth"].scale = (0.85 + 0.15 * o, 1, 0.45 + 0.55 * o)
            present_pose("L", 0.35 + 0.15 * math.sin(i * 0.8))
            head(rig, yaw=4 * math.sin(i * 0.6), pitch=2 * math.sin(i * 1.3), roll=2 * math.sin(i * 0.7))
            brows(rig, 1.0, 0.003 * o)
        pose_at(round(i * 60 / (len(opens) - 1)), tk)
    finish(act)


def clip_think():
    loop("Think", 120, 10, lambda t: (base(0.0), think_pose(math.sin(t))))


def clip_sit():
    def p(t):
        sit_pose(math.sin(t))
        face(1.0, 1.0, (0.003 * math.sin(t * 0.5), 0))
    act = new_action("Sit", 120, cyclic=True)
    for f in range(0, 121, 8):
        pose_at(f, lambda f=f: p(2 * math.pi * (f % 120) / 120))
    finish(act)


def clip_sit_down():
    act = new_action("SitDown", 48)
    for f in range(0, 49, 4):
        k = ease(f / 40)
        pose_at(f, lambda k=k: (base(0.0) if k < 1e-6 else sit_pose(0.0, k), face(1.0, 1.0)))
    finish(act)


def clip_stand_up():
    act = new_action("StandUp", 44)
    for f in range(0, 45, 4):
        k = 1 - ease(f / 36)
        # push off: lean forward a bit more on the way up
        pose_at(f, lambda k=k: (sit_pose(0.0, k), rot(rig, "spine", (FWD_AXIS, 10 * k + 12 * math.sin(math.pi * k))),
                                face(1.0, 1.0)))
    finish(act)


def clip_wave():
    def w(sw, k=1.0, hk=1.0):
        base(0.3)
        wave_pose(sw, k)
        head(rig, yaw=-7 * hk, roll=-6 * hk, pitch=2 * hk)
        face(1.0, 1.2, (-0.004 * hk, 0.002 * hk), brow_up=0.006 * hk)
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
        rot(rig, "chest", (Z, sg * 8 * ek))
        head(rig, yaw=sg * 18 * ek, pitch=3 * ek, roll=sg * 4 * ek)
        face(1.0, 1.2, (sg * 0.010 * ek, 0.003 * ek), brow_up=0.005 * ek)
    oneshot(name, 84, [(10, lambda: p(0.7, 0, 0.6)), (16, lambda: p(1.0, 1.0)), (21, lambda: p(1.0, -0.4)),
                       (26, lambda: p(1.0)), (60, lambda: p(1.0)), (72, lambda: p(0.3, 0, 0.3))])


def clip_present():
    def pr(k):
        base(0.2, smile=1.25)
        present_pose("L", k)
        rot(rig, "chest", (Z, 6 * k))
        head(rig, yaw=12 * k, roll=6 * k)
        face(1.0, 1.25, (0.008 * k, -0.002 * k), brow_up=0.004 * k)
    oneshot("Present", 80, [(12, lambda: pr(0.8)), (18, lambda: pr(1.05)), (24, lambda: pr(1.0)),
                            (58, lambda: pr(1.0)), (70, lambda: pr(0.3))])


def clip_thumbs_up():
    def tu(k, pump=0.0):
        base(0.2, smile=1.3)
        thumbs_up_pose("L", k)
        if pump:
            turn(rig, "forearm.L", X, -6 * pump)
        head(rig, yaw=6 * k, roll=5 * k)
        face(1.0, 1.3, eyes_open=1.0 if k < 0.9 else 0.0, brow_up=0.005 * k)  # ^ ^ happy eyes at the peak
    oneshot("ThumbsUp", 70, [(10, lambda: tu(0.8)), (15, lambda: tu(1.0, 1.0)), (20, lambda: tu(1.0)),
                             (48, lambda: tu(1.0)), (60, lambda: tu(0.3))])


def clip_clap():
    keys = [(6, lambda: (base(0.2), clap_pose(1.0), face(1.0, 1.3)))]
    for i, f in enumerate(range(10, 50, 6)):
        keys.append((f, lambda: (base(0.2), clap_pose(0.0), face(1.0, 1.35, eyes_open=0.0))))
        keys.append((f + 3, lambda: (base(0.2), clap_pose(0.8), face(1.0, 1.35))))
    keys.append((56, lambda: (base(0.1), clap_pose(1.0), face(1.0, 1.2))))
    oneshot("Clap", 66, keys)


def clip_jump(name="Jump", cheer=False):
    def crouch(d, arms_back):
        stand(d, 0.0, 0.0)
        rot(rig, "spine", (FWD_AXIS, 14 * d / 0.05))
        head(rig, pitch=-4 * d / 0.05)
        arms_relaxed(-arms_back)
        face(1.0, 1.2, brow_up=0.004)

    def air(h, tuck, k_arms):
        move(rig, "root", (0, 0, h))
        for s in "LR":
            leg_ik(s, 0.01 * tuck, 0.05 * tuck, -10 * (1 - tuck), 3)
        if cheer:
            cheer_arms(k_arms)
        else:
            arms_relaxed(25 * k_arms)
        head(rig, pitch=6)
        face(1.0, 1.4, eyes_open=0.0 if cheer and k_arms > 0.9 else 1.0, brow_up=0.008)
    oneshot(name, 54, [(6, lambda: crouch(0.03, 15)), (11, lambda: crouch(0.05, 30)),
                       (15, lambda: air(0.06, 0.0, 0.6)), (20, lambda: air(0.15, 1.0, 1.0)),
                       (25, lambda: air(0.15, 1.0, 1.0)), (30, lambda: air(0.06, 0.2, 0.8)),
                       (33, lambda: crouch(0.045, -10)), (39, lambda: crouch(0.02, 0)),
                       (46, lambda: (base(0.2), face(1.0, 1.3)))])


def clip_bow():
    def bw(k):
        stand(0.004, 0.012 * k)
        rot(rig, "spine", (FWD_AXIS, 14 * k))
        rot(rig, "chest", (FWD_AXIS, 12 * k))
        head(rig, pitch=-8 * k)
        arms_relaxed(10 * k)
        face(0.0 if k > 0.5 else 1.0, 1.1, eyes_open=0.0 if k > 0.6 else 1.0)
    oneshot("Bow", 60, [(14, lambda: bw(1.0)), (34, lambda: bw(1.0)), (48, lambda: bw(0.2))])


def clip_nod():
    oneshot("Nod", 40, [(f, lambda a=a: (base(0.0, smile=1.2), head(rig, pitch=-a, neck_share=0.4)))
                        for f, a in ((7, 10), (14, -2), (21, 8), (28, -1))])


def clip_head_shake():
    oneshot("HeadShake", 44, [(f, lambda a=a: (base(0.0, mouth_open=0.0, smile=0.6), head(rig, yaw=a),
                                               brows(rig, 1.0, 0.0, 5)))
                              for f, a in ((6, 14), (13, -14), (20, 12), (27, -10), (33, 4))])


def clip_look_around():
    keys = []
    for f, yaw, ex in ((10, -6, -0.010), (24, -22, -0.010), (40, -22, -0.008), (52, 6, 0.010), (64, 22, 0.010),
                       (80, 22, 0.008), (90, 0, 0.0)):
        keys.append((f, lambda yaw=yaw, ex=ex: (base(0.0, look=(ex, 0.002), mouth_open=0.0),
                                                head(rig, yaw=yaw, pitch=2), rot(rig, "chest", (Z, yaw * 0.25)),
                                                brows(rig, 1.0, 0.0, 4))))
    oneshot("LookAround", 98, keys)


def clip_smile():
    """^‿^ : eyes close into happy arcs, the smile widens, a little shoulder lift."""
    def sm(k):
        base(0.0, smile=1.0 + 0.35 * k)
        eyes(rig, 1.0 - k if k < 0.9 else 0.0)
        for s in "LR":
            rot(rig, f"shoulder.{s}", (raise_side(s), 6 * k))
        head(rig, roll=5 * k, pitch=2 * k)
    oneshot("Smile", 48, [(6, lambda: sm(0.6)), (10, lambda: sm(1.0)), (34, lambda: sm(1.0)), (40, lambda: sm(0.4))])


def clip_surprised():
    def su(k):
        stand(0.004, 0.012 * k)
        rot(rig, "chest", (FWD_AXIS, -6 * k))
        head(rig, pitch=5 * k)
        for s in "LR":
            up = RELAX_UP.lerp(Vector((0.70, -0.30, -0.65)), k)
            fo = RELAX_FORE.lerp(Vector((0.55, -0.70, 0.45)), k)
            arm(s, up, fo, 0.0)
            hand_dir(rig, s, fo, Vector((1.0, 0.0, 0.15)).lerp(Vector((0.0, 1.0, 0.0)), k).normalized())
            hand_shape(rig, s, "open")
        eyes(rig, 1.0)
        for s in "LR":
            rig.pose.bones[f"eye.{s}"].scale = (1 + 0.12 * k, 1, 1 + 0.15 * k)
        brows(rig, 1.0, 0.012 * k)
        mouth(rig, 1.0)
        rig.pose.bones["mouth"].scale = (1 - 0.35 * k, 1, 1 + 0.3 * k)   # round "O"
    oneshot("Surprised", 60, [(5, lambda: su(1.1)), (9, lambda: su(1.0)), (40, lambda: su(1.0)), (50, lambda: su(0.3))])


def clip_sad():
    def sd(k):
        stand(0.004)
        rot(rig, "chest", (FWD_AXIS, 6 * k))
        for s in "LR":
            rot(rig, f"shoulder.{s}", (raise_side(s), -5 * k))
        arms_relaxed()
        head(rig, pitch=-8 * k, roll=-4 * k)
        eyes(rig, 1.0, (0.0, -0.006 * k), squint=0.3 * k)
        brows(rig, 1.0, -0.002 * k, -10 * k)   # inner ends up: worried
        mouth(rig, 0.0, 1.0 - 0.8 * k)
    oneshot("Sad", 80, [(14, lambda: sd(1.0)), (60, lambda: sd(1.0)), (70, lambda: sd(0.3))])


def clip_blink():
    act = new_action("Blink", 8)
    for f, o in ((0, 1.0), (2, 0.4), (3, 0.0), (5, 0.0), (6, 0.4), (8, 1.0)):
        pose_at(f, lambda o=o: eyes(rig, o), only=FACE_ONLY)
    finish(act)


CLIPS = [clip_idle, lambda: loop("Walk", 32, 2, walk), lambda: loop("Run", 20, 1, run), clip_dance, clip_talk,
         clip_think, clip_sit, clip_wave, lambda: clip_point("PointRight", "L", 1),
         lambda: clip_point("PointLeft", "R", -1), clip_present, clip_thumbs_up, clip_clap, clip_jump,
         lambda: clip_jump("Celebrate", cheer=True), clip_bow, clip_nod, clip_head_shake, clip_look_around,
         clip_smile, clip_surprised, clip_sad, clip_sit_down, clip_stand_up, clip_blink]

if __name__ == "__main__":
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
