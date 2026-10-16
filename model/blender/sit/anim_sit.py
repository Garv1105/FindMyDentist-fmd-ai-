"""Seated mascot, step 3: animation clips + GLB export.

blender -b rig.blend --python anim_sit.py -- <out.glb> <out.blend>

Clips (30 fps). Loops: Meditate, Fly, Idle, Talk, Think, Explain. One-shots (start and end in the Idle pose, so they chain):
Wake (from Meditate), Wave, PointRight, PointLeft (viewer's right/left), Present, LookAround, Nod, Smile, Happy.
Blink only keys the eye/lid bones; the web page plays it additively on top of any clip.
Every other clip keys every bone, so cross-fades never inherit a stale pose.
"""
import bpy, sys, os, math, json, struct
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from pose_sit import *  # noqa: E402,F401,F403

OUT_GLB, OUT_BLEND = sys.argv[sys.argv.index("--") + 1:][:2]
rig = bpy.data.objects["Rig"]
scene = bpy.context.scene
scene.render.fps = 30
FACE_ONLY = [f"{p}.{s}" for p in ("eye", "lid") for s in "LR"]
VIEW = Vector((0, -1, 0))  # toward the viewer


def ease(t):
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- poses
REST_UP = (0.484, 0.089, -0.870)   # bind pose directions (left side)
REST_FORE = (0.206, -0.976, -0.059)


def base(breath=0.0, look=(0.0, 0.0), hands="relaxed", smile=1.0):
    """Awake, sitting, hands resting palm-up on the knees."""
    breathe(rig, breath)
    rot(rig, "head", (Vector((-1, 0, 0)), 1.2 * breath))
    for s in "LR":
        arm(rig, s, REST_UP, REST_FORE)
        hand_shape(rig, s, hands)
    eyes(rig, 1.0, look)
    brows(rig, 0.0)
    mouth(rig, 0.0, smile)


FLOAT_UP = (0.66, 0.02, -0.75)     # hands floated up to the belly, palms up
FLOAT_FORE = (0.56, -0.72, 0.41)
MUDRA = [(42, 58, 48), (12, 16, 10), (12, 16, 10), (12, 16, 10)]
OPEN = [(6, 8, 4), (8, 10, 6), (10, 12, 8), (12, 14, 10)]


def meditate(breath=0.0, hover=0.0, lift=0.0, ripple=0.0):
    """breath -1 exhaled .. 1 inhaled; lift 0 hands in mudra on the knees .. 1 floated up, open, palms up;
    ripple: phase of the slow finger wave that runs pinky -> index while the hands are up."""
    move(rig, "root", (0, 0, hover))
    breathe(rig, 1.4 * breath)
    rot(rig, "head", (Vector((1, 0, 0)), 4 - 3 * breath))
    k = ease(lift)
    for s in "LR":
        up = Vector(REST_UP).lerp(Vector(FLOAT_UP), k)
        fo = Vector(REST_FORE).lerp(Vector(FLOAT_FORE), k).normalized()
        arm(rig, s, up, fo)
        # palm stays up; the wrist trails the wave, so the hand flows rather than lifts like a tray
        hand_dir(rig, s, (fo + Vector((0, 0, -0.25 * k * math.sin(ripple)))).normalized(), (0.0, 0.05, -1.0))
        for i, f in enumerate(FINGERS):
            w = 9 * k * math.sin(ripple - 0.7 * (3 - i))
            finger(rig, s, f, [a + (b - a) * k + w for a, b in zip(MUDRA[i], OPEN[i])])
        thumb(rig, s, [a * (1 - 0.7 * k) for a in (18, 22, 18)], 22 * (1 - k))
    eyes(rig, 0.0)
    brows(rig, 0.0)
    mouth(rig, 0.0, 1.0 + 0.15 * max(0.0, breath))


def wave_arm(swing=0.0, k=1.0):
    """Character's right hand (viewer's left) raised beside the head, palm to the viewer."""
    up = Vector(REST_UP).lerp(Vector((0.92, -0.12, 0.37)), k)
    fo = Vector(REST_FORE).lerp(Vector((0.45, -0.30, 0.84)), k)
    rot(rig, "shoulder.R", (Vector((0, 1, 0)), -8 * k))
    arm(rig, "R", up, fo)
    turn(rig, "forearm.R", VIEW, -swing * k)
    hand_dir(rig, "R", Vector((0.0, -0.3, 0.1)).lerp(Vector((0.30, -0.25, 0.92)), k).normalized(),
             Vector((0.1, 0.1, -1.0)).lerp(Vector((0.0, 1.0, 0.1)), k).normalized())
    turn(rig, "hand.R", VIEW, -swing * 0.6 * k)
    hand_shape(rig, "R", "wave" if k > 0.5 else "relaxed")


def point_arm(s, k=1.0):
    """Point outward to this side at about chin height with the index finger (result.png)."""
    up = Vector(REST_UP).lerp(Vector((0.90, -0.30, 0.32)), k)
    fo = Vector(REST_FORE).lerp(Vector((0.92, -0.33, 0.20)), k)
    arm(rig, s, up, fo)
    hand_dir(rig, s, Vector((0.25, -0.95, -0.05)).lerp(Vector((0.90, -0.38, 0.20)), k).normalized(),
             Vector((0.0, 0.05, -1.0)).lerp(Vector((0.0, 0.30, 1.0)), k).normalized())
    hand_shape(rig, s, "point" if k > 0.4 else "relaxed")


def present_arm(s, k=1.0):
    """Open palm sweeping out to this side: "here it is"."""
    up = Vector(REST_UP).lerp(Vector((0.86, -0.22, -0.46)), k)
    fo = Vector(REST_FORE).lerp(Vector((0.84, -0.46, 0.28)), k)
    arm(rig, s, up, fo)
    hand_dir(rig, s, Vector((0.25, -0.95, -0.05)).lerp(Vector((0.88, -0.40, 0.25)), k).normalized(),
             Vector((0.0, 0.05, -1.0)).lerp(Vector((0.05, 0.10, -1.0)), k).normalized())
    hand_shape(rig, s, "open")


def cheer_arms(k=1.0):
    for s in "LR":
        up = Vector(REST_UP).lerp(Vector((0.88, -0.18, 0.44)), k)
        fo = Vector(REST_FORE).lerp(Vector((0.42, -0.28, 0.86)), k)
        arm(rig, s, up, fo)
        hand_dir(rig, s, Vector((0.25, -0.95, -0.05)).lerp(Vector((0.20, -0.25, 0.95)), k).normalized(),
                 Vector((0.0, 0.05, -1.0)).lerp(Vector((0.0, 1.0, 0.0)), k).normalized())
        hand_shape(rig, s, "fist", k)


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
    for pb in rig.pose.bones:
        pb.scale = (1, 1, 1)
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


# ---------------------------------------------------------------- clips
def clip_meditate():
    # 8 s: inhale while the hands float up and open with a slow finger wave, exhale back into the mudra
    act = new_action("Meditate", 240, cyclic=True)
    for f in range(0, 241, 4):
        t = 2 * math.pi * f / 240
        b = -math.cos(t)
        pose_at(f, lambda t=t, b=b: meditate(b, 0.012 * math.sin(t - 0.6), 0.5 + 0.5 * b, 2 * t))
    finish(act)


def fly(bob=0.0, shout=1.0):
    """Superman rise: right fist (viewer's left) punched straight up, the other hand still in the mudra,
    mouth open in a "woohoo" shout."""
    move(rig, "root", (0, 0, bob))
    breathe(rig, 0.6)
    head(rig, 0, 7)
    rot(rig, "shoulder.R", (Vector((0, 1, 0)), -10))
    # out to the side first: straight up would hide the arm behind the big head
    arm(rig, "R", (0.88, -0.20, 0.43), (0.22, -0.30, 0.93))
    hand_dir(rig, "R", Vector((0.15, -0.30, 0.94)).normalized(), (0.3, 1.0, 0.1))
    hand_shape(rig, "R", "fist")
    arm(rig, "L", REST_UP, REST_FORE)
    hand_shape(rig, "L", "mudra")
    eyes(rig, 1.0, (0.0, 0.006))
    brows(rig, 1.0, 0.004, -6)
    mouth(rig, 1.0)
    rig.pose.bones["mouth"].scale = (1.15 + 0.2 * shout, 1.0, 1.3 + 0.5 * shout)  # wide-open shout, bigger than a smile


def clip_fly():
    act = new_action("Fly", 60, cyclic=True)
    for f in range(0, 61, 6):
        s = math.sin(2 * math.pi * f / 60)
        pose_at(f, lambda s=s: fly(0.01 * s, 0.5 + 0.5 * s))  # the shout swells as it bobs up
    finish(act)


def clip_idle():
    act = new_action("Idle", 120, cyclic=True)
    for f in range(0, 121, 6):
        t = 2 * math.pi * f / 120
        pose_at(f, lambda t=t: base(math.sin(t)))
    finish(act)


def clip_wake():
    act = new_action("Wake", 54)
    pose_at(0, lambda: meditate(0.0, 0.0))
    pose_at(8, lambda: (meditate(0.3, 0.0), rot(rig, "head", (Vector((-1, 0, 0)), 3))))

    def opening(open_, lift, brow):
        base(0.2)
        move(rig, "root", (0, 0, lift))
        rot(rig, "head", (Vector((-1, 0, 0)), 5 * lift / 0.012))
        eyes(rig, open_)
        brows(rig, brow, 0.006 * brow)
    pose_at(14, lambda: opening(0.35, 0.004, 0.0))
    pose_at(18, lambda: opening(1.0, 0.012, 1.0))
    pose_at(24, lambda: (opening(1.0, 0.004, 1.0), mouth(rig, 1.0)))
    pose_at(30, lambda: (opening(0.15, 0.0, 1.0), mouth(rig, 1.0)))   # quick happy blink
    pose_at(34, lambda: (opening(1.0, 0.0, 1.0), mouth(rig, 0.0, 1.2)))
    pose_at(46, lambda: (base(0.0, smile=1.15), brows(rig, 0.6, 0.002)))
    pose_at(54, lambda: base(0.0))
    finish(act)


def clip_wave():
    act = new_action("Wave", 84)
    pose_at(0, base)

    def w(swing, k=1.0, head_k=1.0):
        base(0.3, look=(-0.004 * head_k, 0.002 * head_k))
        head(rig, yaw=-7 * head_k, roll=-6 * head_k, pitch=2 * head_k)
        wave_arm(swing, k)
        eyes(rig, 1.0, (-0.004 * head_k, 0.002 * head_k))
        brows(rig, head_k, 0.007 * head_k)
        mouth(rig, 1.0 if head_k > 0.5 else 0.0, 1.2)
    pose_at(8, lambda: w(-6, 0.55, 0.6))
    for f, sw in ((14, 18), (21, -16), (28, 18), (35, -16), (42, 18), (49, -10), (55, 4)):
        pose_at(f, lambda sw=sw: w(sw))
    pose_at(66, lambda: w(0, 0.45, 0.5))
    pose_at(76, lambda: base(0.1, smile=1.15))
    pose_at(84, base)
    finish(act)


def clip_point(name, s, yaw_sign):
    act = new_action(name, 90)
    pose_at(0, base)

    def p(k, bounce=0.0, eyes_k=1.0):
        base(0.2)
        point_arm(s, k)
        if bounce:  # world-space nudge on top of the aim (rot() would replace it)
            turn(rig, f"forearm.{s}", Vector((0, 0, 1)), yaw_sign * 5 * bounce)
        head(rig, yaw=yaw_sign * 20 * eyes_k, pitch=4 * eyes_k, roll=yaw_sign * 4 * eyes_k)
        eyes(rig, 1.0, (yaw_sign * 0.012 * eyes_k, 0.004 * eyes_k))
        brows(rig, eyes_k, 0.006 * eyes_k)
        mouth(rig, 1.0 if eyes_k > 0.5 else 0.0, 1.2)
    pose_at(10, lambda: p(0.7, 0, 0.6))
    pose_at(16, lambda: p(1.0, 1.0))
    pose_at(21, lambda: p(1.0, -0.4))
    pose_at(26, lambda: p(1.0, 0.0))
    pose_at(62, lambda: p(1.0, 0.0))
    pose_at(74, lambda: (base(0.1, smile=1.15), point_arm(s, 0.3)))
    pose_at(90, base)
    finish(act)


def clip_present():
    act = new_action("Present", 84)
    pose_at(0, base)

    def pr(k, smile=1.25):
        base(0.2, smile=smile)
        present_arm("L", k)
        head(rig, yaw=14 * k, roll=6 * k)
        eyes(rig, 1.0, (0.010 * k, -0.002 * k))
        brows(rig, k, 0.004 * k)
    pose_at(12, lambda: pr(0.8))
    pose_at(18, lambda: pr(1.05))
    pose_at(24, lambda: pr(1.0))
    pose_at(60, lambda: pr(1.0))
    pose_at(72, lambda: pr(0.3, 1.1))
    pose_at(84, base)
    finish(act)


def clip_look_around():
    act = new_action("LookAround", 96)
    pose_at(0, base)
    for f, yaw, ex in ((10, -6, -0.012), (24, -22, -0.012), (40, -22, -0.010), (52, 6, 0.012), (64, 22, 0.012),
                       (80, 22, 0.010), (90, 0, 0.0)):
        def la(yaw=yaw, ex=ex):
            base(0.0, look=(ex, 0.002))
            head(rig, yaw=yaw, pitch=2)
            brows(rig, 0.6, 0.0, 4)
        pose_at(f, la)
    pose_at(96, base)
    finish(act)


def clip_nod():
    act = new_action("Nod", 40)
    pose_at(0, base)
    for f, a in ((7, 12), (14, -3), (21, 9), (28, -1)):
        pose_at(f, lambda a=a: (base(0.0, smile=1.2), head(rig, pitch=-a, neck_share=0.4)))
    pose_at(40, base)
    finish(act)


def clip_smile():
    """^‿^ : eyes close into happy arcs, smile widens, little shoulder lift."""
    act = new_action("Smile", 48)
    pose_at(0, base)
    for f, k in ((6, 0.6), (10, 1.0), (34, 1.0), (40, 0.4)):
        def sm(k=k):
            base(0.0, smile=1.0 + 0.35 * k)
            eyes(rig, 1.0 - k if k < 0.9 else 0.0)
            for s in "LR":
                rot(rig, f"shoulder.{s}", (Vector((0, 1, 0)), (6 if s == "L" else -6) * k))
            head(rig, roll=5 * k, pitch=2 * k)
        pose_at(f, sm)
    pose_at(48, base)
    finish(act)


def clip_happy():
    act = new_action("Happy", 60)
    pose_at(0, base)
    for f, k, lift in ((8, 0.7, 0.0), (13, 1.0, 0.03), (19, 1.0, 0.0), (24, 1.0, 0.022), (30, 1.0, 0.0),
                       (44, 0.6, 0.0)):
        def hp(k=k, lift=lift):
            base(0.0, smile=1.3)
            move(rig, "root", (0, 0, lift))
            cheer_arms(k)
            eyes(rig, 0.0)  # ^ ^
            mouth(rig, 1.0)
            brows(rig, 1.0, 0.008)
        pose_at(f, hp)
    pose_at(60, base)
    finish(act)


def clip_talk():
    act = new_action("Talk", 60, cyclic=True)
    opens = (0, 1, 0.3, 1, 0, 0.8, 0.2, 1, 0.5, 0, 1, 0.3, 0)
    for i, o in enumerate(opens):
        f = round(i * 60 / (len(opens) - 1))

        def tk(o=o, i=i):
            base(0.2 * math.sin(i))
            mouth(rig, 1.0 if o > 0.5 else 0.0, 1.1)
            if o > 0.5:
                rig.pose.bones["mouth"].scale = (0.9 + 0.1 * o, 1, 0.55 + 0.45 * o)
            head(rig, pitch=2 * math.sin(i * 1.3), roll=2 * math.sin(i * 0.7))
            brows(rig, 0.6, 0.003 * o)
        pose_at(f, tk)
    finish(act)


def think(look=0.0, k=1.0):
    """Hmm...: right hand (viewer's left) up at the chin, head tilted, eyes up and to the side, brows knit."""
    base(0.0, (0.0, 0.0), smile=0.7)
    up = Vector(REST_UP).lerp(Vector(THINK_UP), k)
    fo = Vector(REST_FORE).lerp(Vector(THINK_FORE), k).normalized()
    arm(rig, "R", up, fo)
    hand_dir(rig, "R", Vector((0.25, -0.95, -0.05)).lerp(Vector(THINK_HAND), k).normalized(),
             Vector((0.0, 0.05, -1.0)).lerp(Vector((0.3, -0.4, 0.0)), k).normalized())
    hand_shape(rig, "R", "fist", 0.7 * k)
    head(rig, yaw=-6 * k + 4 * look, pitch=5 * k, roll=-7 * k)
    eyes(rig, 1.0, ((-0.008 + 0.012 * look) * k, 0.010 * k))
    brows(rig, k, 0.006 * k, 6 * k)


THINK_UP, THINK_FORE, THINK_HAND = (0.45, -0.62, -0.64), (-0.40, -0.40, 0.82), (-0.35, -0.45, 0.82)


def clip_think():
    act = new_action("Think", 120, cyclic=True)
    for f in range(0, 121, 10):
        t = 2 * math.pi * f / 120
        pose_at(f, lambda t=t: think(math.sin(t)))
    finish(act)


def clip_explain():
    """Talking while presenting the answer with the open hand (viewer's right)."""
    act = new_action("Explain", 60, cyclic=True)
    opens = (0, 1, 0.3, 1, 0, 0.8, 0.2, 1, 0.5, 0, 1, 0.3, 0)
    for i, o in enumerate(opens):
        f = round(i * 60 / (len(opens) - 1))

        def ex(o=o, i=i):
            base(0.2 * math.sin(i), smile=1.2)
            k = 0.95 + 0.05 * math.sin(i * 0.9)
            present_arm("L", k)
            head(rig, yaw=10, pitch=2 * math.sin(i * 1.3), roll=4 + 2 * math.sin(i * 0.7))
            eyes(rig, 1.0, (0.008, -0.001))
            brows(rig, 0.8, 0.003 * o)
            mouth(rig, 1.0 if o > 0.5 else 0.0, 1.2)
            if o > 0.5:
                rig.pose.bones["mouth"].scale = (0.9 + 0.1 * o, 1, 0.55 + 0.45 * o)
        pose_at(f, ex)
    finish(act)


def clip_blink():
    act = new_action("Blink", 8)
    for f, o in ((0, 1.0), (2, 0.4), (3, 0.0), (5, 0.0), (6, 0.4), (8, 1.0)):
        pose_at(f, lambda o=o: eyes(rig, o), only=FACE_ONLY)
    finish(act)


for fn in (clip_meditate, clip_fly, clip_idle, clip_wake, clip_wave, lambda: clip_point("PointRight", "L", 1),
           lambda: clip_point("PointLeft", "R", -1), clip_present, clip_look_around, clip_nod, clip_smile,
           clip_happy, clip_talk, clip_think, clip_explain, clip_blink):
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
