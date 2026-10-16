"""Author all animation clips and export the final GLB.

blender -b rig.blend --python anim.py -- <out.glb> <out.blend>
Every clip keys every bone (so cross-fades in three.js never inherit stale poses),
except Blink, which only keys the eye/lid bones so it can be layered.
"""
import bpy, sys, os, math
from mathutils import Vector, Quaternion

sys.path.insert(0, os.path.dirname(__file__))
from posing import *  # noqa
import medpose  # noqa: E402

OUT_GLB, OUT_BLEND = sys.argv[sys.argv.index("--") + 1:][:2]
rig = bpy.data.objects["Rig"]
scene = bpy.context.scene
scene.render.fps = 30
EYE_LID = [f"{p}.{s}" for p in ("eye", "lid") for s in "LR"]

bl = rig.data.bones
THIGH = (bl["thigh.L"].head_local - bl["thigh.L"].tail_local).length
SHIN = (bl["shin.L"].head_local - bl["shin.L"].tail_local).length


def ease(t):
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- pose building blocks
def base(arm_drop=14, elbow=8):
    """Relaxed stand: arms closer to the body than the A-pose, soft elbows."""
    for s in "LR":
        rot(rig, f"upper_arm.{s}", (raise_side(s), -arm_drop), (bring_forward(), 4))
        rot(rig, f"forearm.{s}", (bring_forward(), elbow))


def squat(depth):
    """Lower the pelvis by `depth` keeping the feet planted (2-bone solve in the sagittal plane)."""
    if depth <= 1e-5:
        return
    span = THIGH + SHIN - depth
    lo, hi = 0.0, math.pi / 2
    for _ in range(40):  # find thigh angle a with shin angle b = asin(T sin a / S)
        a = (lo + hi) / 2
        b = math.asin(min(1, THIGH * math.sin(a) / SHIN))
        if THIGH * math.cos(a) + SHIN * math.cos(b) > span:
            lo = a
        else:
            hi = a
    a_deg, b_deg = math.degrees(a), math.degrees(b)
    move(rig, "root", (0, 0, -depth))
    for s in "LR":
        rot(rig, f"thigh.{s}", (bring_forward(), a_deg))
        rot(rig, f"shin.{s}", (bring_forward(), -(a_deg + b_deg)))
        rot(rig, f"foot.{s}", (bring_forward(), b_deg))


def wave_pose(swing):
    rot(rig, "shoulder.R", (raise_side("R"), 12))
    aim(rig, "upper_arm.R", (-0.93, -0.22, 0.12))
    aim(rig, "forearm.R", (-0.38, -0.2, 0.9))
    twist(rig, "forearm.R", 60)
    turn(rig, "forearm.R", (0, -1, 0), swing)      # swing about the elbow, in the frontal plane
    turn(rig, "hand.R", (0, -1, 0), swing * 0.6)   # the hand flaps a little extra


def point_pose(amount):
    aim_dir = Vector((0.92, -0.32, 0.18))
    rest = Vector((0.67, -0.25, -0.70))
    d = rest.lerp(aim_dir, amount)
    aim(rig, "upper_arm.L", d)
    aim(rig, "forearm.L", d + Vector((0, -0.05, 0.03)))
    aim(rig, "hand.L", d + Vector((0, -0.08, 0.06)))
    rot(rig, "head", (Z, 22 * amount), (Y, 6 * amount))
    rot(rig, "chest", (Z, 8 * amount))


def meditate_pose(breath=0.0, float_z=0.0):
    medpose.meditate_pose(rig, breath=breath, float_z=float_z)


# ---------------------------------------------------------------- keying with quaternion continuity
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


def new_action(name, start, end, cyclic=False):
    _last.clear()
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    act.use_frame_range = True
    act.frame_start, act.frame_end = start, end
    act.use_cyclic = cyclic
    rig.animation_data_create()
    rig.animation_data.action = act
    return act


def finish(act):
    track = rig.animation_data.nla_tracks.new()
    track.name = act.name
    track.strips.new(act.name, int(act.frame_start), act)
    track.mute = True
    rig.animation_data.action = None
    print(f"clip {act.name}: frames {int(act.frame_start)}-{int(act.frame_end)}")


def pose_at(frame, fn, only=None):
    reset(rig)
    fn()
    key(frame, only)


# ---------------------------------------------------------------- clips
def clip_idle():
    act = new_action("Idle", 0, 120, cyclic=True)
    for f in range(0, 121, 4):
        t = 2 * math.pi * f / 120

        def p():
            base(arm_drop=14 + 2 * math.sin(t), elbow=8 + 3 * math.sin(t))
            move(rig, "root", (0, 0, 0.004 * math.sin(2 * t)))
            rot(rig, "spine", (Vector((-1, 0, 0)), 1.0 * math.sin(t)))
            rot(rig, "chest", (Vector((-1, 0, 0)), 1.5 * math.sin(t)), (Z, 2 * math.sin(t + 1)))
            # calm: a slight breathing nod only, no side-to-side head turning
            rot(rig, "head", (X, 1.2 * math.cos(2 * t)))
        pose_at(f, p)
    finish(act)


def clip_wave():
    act = new_action("Wave", 0, 90)
    pose_at(0, base)
    swings = {12: 0, 19: 22, 27: -18, 35: 22, 43: -18, 51: 22, 59: -18, 66: 0}
    for f, sw in swings.items():
        def p(sw=sw):
            base()
            rot(rig, "chest", (Y, -4), (Z, -5))
            rot(rig, "head", (Y, -9), (Z, -6))
            wave_pose(sw)
        pose_at(f, p)
    pose_at(80, base)
    pose_at(90, base)
    finish(act)


def clip_point():
    act = new_action("Point", 0, 75)
    pose_at(0, base)
    for f, amt, bounce in ((14, 1.0, 0), (20, 1.0, 1), (26, 1.0, 0), (58, 1.0, 0)):
        def p(amt=amt, bounce=bounce):
            base()
            point_pose(amt)
            if bounce:
                rot(rig, "forearm.L", (Vector((0, -1, 0)), 6))
                move(rig, "root", (0, 0, 0.006))
        pose_at(f, p)
    pose_at(75, base)
    finish(act)


def clip_celebrate():
    act = new_action("Celebrate", 0, 60)
    pose_at(0, base)

    def crouch(d, arms_back):
        base()
        squat(d)
        rot(rig, "spine", (Vector((1, 0, 0)), 8 * d / 0.035))
        for s in "LR":
            rot(rig, f"upper_arm.{s}", (bring_forward(), -arms_back))

    def air(h, tuck):
        move(rig, "root", (0, 0, h))
        for s in "LR":
            sg = side_sign(s)
            aim(rig, f"upper_arm.{s}", (sg * 0.82, -0.12, 0.55))
            aim(rig, f"forearm.{s}", (sg * 0.5, -0.15, 0.85))
            aim(rig, f"hand.{s}", (sg * 0.4, -0.2, 0.9))
            rot(rig, f"thigh.{s}", (bring_forward(), tuck))
            rot(rig, f"shin.{s}", (bring_forward(), -tuck * 1.4))
        rot(rig, "head", (Vector((-1, 0, 0)), 8))

    pose_at(9, lambda: crouch(0.035, 25))
    pose_at(16, lambda: air(0.09, 10))
    pose_at(22, lambda: air(0.14, 22))
    pose_at(29, lambda: air(0.08, 12))
    pose_at(34, lambda: crouch(0.03, -10))
    pose_at(42, lambda: (base(), squat(0.008)))
    pose_at(60, base)
    finish(act)


def clip_nod():
    act = new_action("Nod", 0, 45)
    pose_at(0, base)
    for f, a in ((8, 14), (16, -4), (24, 11), (32, -2)):
        def p(a=a):
            base()
            rot(rig, "head", (X, a))
            rot(rig, "chest", (X, a * 0.15))
        pose_at(f, p)
    pose_at(45, base)
    finish(act)


def clip_shake():
    act = new_action("HeadShake", 0, 45)
    pose_at(0, base)
    for f, a in ((7, 18), (15, -18), (23, 14), (31, -10), (38, 0)):
        def p(a=a):
            base()
            rot(rig, "head", (Z, a), (X, 3))
        pose_at(f, p)
    pose_at(45, base)
    finish(act)


def clip_walk():
    act = new_action("Walk", 0, 32, cyclic=True)
    for f in range(0, 33, 2):
        ph = 2 * math.pi * f / 32

        def p(ph=ph):
            base(arm_drop=10)
            move(rig, "root", (0, 0, 0.008 * abs(math.cos(ph)) - 0.004))
            rot(rig, "hips", (Z, 4 * math.sin(ph)))
            rot(rig, "chest", (Z, -6 * math.sin(ph)), (Vector((1, 0, 0)), 3))
            rot(rig, "head", (Z, 3 * math.sin(ph)))
            for s, off in (("L", 0), ("R", math.pi)):
                sw = math.sin(ph + off)
                rot(rig, f"thigh.{s}", (bring_forward(), 24 * sw))
                knee = 32 * max(0, math.sin(ph + off - 1.2))
                rot(rig, f"shin.{s}", (bring_forward(), -knee))
                rot(rig, f"foot.{s}", (bring_forward(), -0.5 * 24 * sw + 0.6 * knee))
                rot(rig, f"upper_arm.{s}", (bring_forward(), -22 * sw))
                rot(rig, f"forearm.{s}", (bring_forward(), 10 + 8 * max(0, -sw)))
        pose_at(f, p)
    finish(act)


def clip_meditate():
    act = new_action("Meditate", 0, 120, cyclic=True)
    for f in range(0, 121, 6):
        t = 2 * math.pi * f / 120
        pose_at(f, lambda t=t: meditate_pose(breath=math.sin(t), float_z=0.006 * math.sin(t + 0.8)))
    finish(act)


def clip_think():
    act = new_action("Think", 0, 90)
    pose_at(0, base)

    def think(tap=0.0):
        base()
        aim(rig, "upper_arm.R", (-0.2, -0.6, -0.77))
        aim(rig, "forearm.R", (0.62, -0.5, 0.6))
        aim(rig, "hand.R", (0.15, -0.35, 0.92 - 0.05 * tap))
        twist(rig, "forearm.R", 40)
        rot(rig, "head", (Y, 10), (Z, -12), (X, -7 + 2 * tap))
        rot(rig, "chest", (Z, -4))
    pose_at(14, think)
    pose_at(30, lambda: think(1))
    pose_at(38, think)
    pose_at(46, lambda: think(1))
    pose_at(54, think)
    pose_at(74, think)
    pose_at(90, base)
    finish(act)


def clip_blink():
    act = new_action("Blink", 0, 8)
    for f, c in ((0, 0), (2, 0.6), (3, 1), (5, 1), (6, 0.6), (8, 0)):
        pose_at(f, lambda c=c: eyes_closed(rig, c), only=EYE_LID)
    finish(act)


for clip in (clip_idle, clip_wave, clip_point, clip_celebrate, clip_nod, clip_shake,
             clip_walk, clip_meditate, clip_think, clip_blink):
    clip()

reset(rig)
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

for o in bpy.context.scene.objects:
    o.select_set(o.type in ("MESH", "ARMATURE"))
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_skins=True,
    export_all_influences=False,
    export_def_bones=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_force_sampling=True,
    export_frame_step=1,
    export_reset_pose_bones=True,
    export_anim_single_armature=True,
    export_optimize_animation_size=True,
)


def strip_blink(path):
    """The exporter samples every bone into every clip; Blink must only touch eyes/lids so it can layer."""
    import json, struct
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
