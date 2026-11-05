"""The FMD AI assistant mascot: the guide (rig/guide.glb's build) with a fuller rig, face shape keys and baked clips.

blender -b --python rig_assistant.py -- <in.glb> <out.glb> [--debug <png prefix>]

<in.glb> is the guide after head_material_raw.py (build_assistant.sh makes it); the mesh, materials and textures pass
through untouched. Added:
  bones   root ─ spine (hips) ─┬ head (neck)
                               ├ arm.R (shoulder) ─ hand.R (elbow)   the raised, presenting arm (+x)
                               └ arm.L (shoulder) ─ hand.L (elbow)   the pointing arm (−x)
  shapes  Blink (both eyes shut), Close (the mouth shut: the lower lip up to the upper lip's line), Speak (the mouth
          open wider). The eyes and mouth are painted in the texture, so each slides the skin over the head's surface:
          the eye texture closes to a line, the mouth's to a thin smile line, or opens taller.
  clips   explaining (the guide's own pose, presenting with both hands, talking), idle (the same, barely moving),
          listening (the raised hand up by the ear, head tilted to it), thinking (hand to the chin, the other arm
          across), speaking (the mouth only, shutting fully between syllables: plays over any pose), blink (one blink:
          the page fires it now and then)
Weights are built from shape, as in rig_mascots.py (whose helpers this uses). Blender world coordinates: x the
mascot's left/viewer's right, −y forward, z up, feet at z 0, 0.98 tall.
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig_mascots import capsule, smooth  # noqa: E402

NECK = [0, 0, 0.55]
SPINE = [0.22, 0.42]
# shoulder → elbow → past the hand; radius of the sleeve; the forearm capsule runs on past the hand to take the fingers
ARMS = {
    "R": {"shoulder": [0.13, -0.04, 0.47], "elbow": [0.22, -0.17, 0.44], "hand": [0.33, -0.27, 0.6], "r": (0.075, 0.08)},
    "L": {"shoulder": [-0.14, -0.04, 0.46], "elbow": [-0.24, -0.1, 0.37], "hand": [-0.19, -0.22, 0.41], "r": (0.075, 0.07)},
}
FPS = 30


def vertex_colours(me):
    """the base-colour texture, averaged per vertex"""
    img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.outputs["Color"].links
               and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links))
    W, H = img.size
    px = np.empty(W * H * 4, np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)[..., :3]
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    lv = np.empty(len(me.loops), int)
    me.loops.foreach_get("vertex_index", lv)
    col, cnt = np.zeros((len(me.vertices), 3)), np.zeros(len(me.vertices))
    np.add.at(col, lv, px[np.clip((uv[:, 1] * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1)])
    np.add.at(cnt, lv, 1)
    return col / np.maximum(cnt, 1)[:, None]


def weights(co, head):
    """{bone: per-vertex weight}, summing to 1. A forearm takes its capsule ramping in from the elbow; its upper arm the
    shoulder → elbow capsule ramping in from the shoulder, minus the forearm (a child bone carries its parent's turn)."""
    key = np.unique(np.round(co, 5), axis=0, return_inverse=True)[1].ravel()

    def by_pos(w):  # split vertices at one position move together
        g = np.zeros(key.max() + 1)
        np.maximum.at(g, key, w)
        return g[key]

    hd = by_pos(head)
    out = {"head": hd}
    used = hd.copy()
    for s, a in ARMS.items():
        fore = by_pos(capsule(co, a["elbow"], a["hand"], a["r"][1], ramp=0.3) * (1 - hd))
        upper = by_pos(capsule(co, a["shoulder"], a["elbow"], a["r"][0], ramp=0.6) * (1 - hd))
        upper = np.maximum(upper - fore, 0)
        out["hand." + s], out["arm." + s] = fore, upper
        used = used + fore + upper
    over = np.maximum(used, 1)
    for b in out:
        out[b] = out[b] / over
    rem = np.clip(1 - sum(out.values()), 0, 1)
    spine = smooth(co[:, 2], *SPINE) * rem
    return {"root": rem - spine, "spine": spine, **out}


# --- face shapes ------------------------------------------------------------------------------------------------------

def frame(co, nrm, sel, n=None):
    """centre, right, up, normal of a painted feature (the selected vertices), and its half extents along right/up. The
    normal is the feature's own mean unless given (the mouth's is the skin's around it: its cavity faces every way)"""
    c = co[sel].mean(0)
    if n is None:
        n = nrm[sel].mean(0)
    n = n / np.linalg.norm(n)
    up = np.array([0, 0, 1.0]) - n * n[2]
    up /= np.linalg.norm(up)
    rt = np.cross(up, n)
    d = co[sel] - c
    a, b = d @ rt, d @ up
    c = c + rt * (a.max() + a.min()) / 2 + up * (b.max() + b.min()) / 2
    return c, rt, up, n, (a.max() - a.min()) / 2, (b.max() - b.min()) / 2


def chart(co, c, rt, up, n):
    """coordinates across (right), up and out of a feature's tangent plane"""
    d = co - c
    return d @ rt, d @ up, d @ n


def squash(co, c, rt, up, A, B, line, s, reach):
    """move points toward a horizontal line (at `line` × B from the centre) to `s` of their distance, fully inside the
    ellipse A × B, fading out by `reach` (in ellipse radii), along `up` (slide() then keeps them on the head's curve)"""
    a, b, _ = chart(co, c, rt, up, np.cross(rt, up))
    r = np.sqrt((a / A) ** 2 + (b / B) ** 2)
    w = 1 - smooth(r, *reach)
    l0 = line * B
    return co + up[None, :] * (w * ((l0 + (b - l0) * s) - b))[:, None]


def surface_fit(co, c, rt, up, n, cand):
    """a smooth fit of the skin around a feature: its height over the tangent plane, a cubic in (across, up)"""
    def terms(a, b):
        return np.stack([np.ones_like(a), a, b, a * a, a * b, b * b, a ** 3, a * a * b, a * b * b, b ** 3], -1)
    pa, pb, ph = chart(co[cand], c, rt, up, n)
    coef = np.linalg.lstsq(terms(pa, pb), ph, rcond=None)[0]
    return lambda a, b: terms(np.asarray(a, float), np.asarray(b, float)) @ coef


def slide(prev, new, c, rt, up, n, fit, flat=None):
    """keep points that moved (prev → new, straight along the tangent plane) on the head's curve: each rises or sinks by
    as much as the smooth `fit` of the skin does between where it was and where it went. Straight along `up` alone,
    points would sink into the curve of the face or lift off it (a bulge under the mouth); taking the surface's own
    height instead would tear the painted features' slight relief, which this keeps. `flat` (0–1 per vertex) irons
    that relief out instead, onto the fit: a shut mouth is flush with the skin, not a carved slit"""
    moved = np.linalg.norm(new - prev, axis=1) > 1e-7
    a0, b0, h0 = chart(prev[moved], c, rt, up, n)
    a1, b1, _ = chart(new[moved], c, rt, up, n)
    p0 = fit(a0, b0)
    dh = fit(a1, b1) - p0
    if flat is not None:
        dh -= flat[moved] * (h0 - p0)
    out = new.copy()
    out[moved] += dh[:, None] * n
    return out


def largest_part(sel, edges, key):
    """the biggest connected patch of the selected vertices (split vertices at one position count as joined)"""
    idx = np.nonzero(sel)[0]
    parent = {int(i): int(i) for i in idx}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, j in edges[sel[edges[:, 0]] & sel[edges[:, 1]]]:
        parent[find(int(i))] = find(int(j))
    first = {}
    for i in idx:
        k = int(key[i])
        if k in first:
            parent[find(int(i))] = find(first[k])
        else:
            first[k] = int(i)
    roots = np.array([find(int(i)) for i in idx])
    vals, counts = np.unique(roots, return_counts=True)
    out = np.zeros_like(sel)
    out[idx[roots == vals[counts.argmax()]]] = True
    return out


# where each painted feature sits (x, z ranges, measured off front renders of the guide): the dark discs of the eyes
# without the brows above them, the mouth with its dark rim
EYES = {"L": ([-0.23, -0.11], [0.635, 0.75]), "R": ([-0.005, 0.11], [0.66, 0.775])}
MOUTH = ([-0.13, 0.005], [0.6, 0.672])


MASKS = {}  # what face_shapes found, for the debug view


def face_shapes(co, nrm, col, head, edges, key):
    lum = col @ np.array([0.3, 0.59, 0.11])
    face = (head > 0) & (co[:, 1] < -0.1)
    inbox = lambda xs, zs: face & (co[:, 0] > xs[0]) & (co[:, 0] < xs[1]) & (co[:, 2] > zs[0]) & (co[:, 2] < zs[1])  # noqa: E731
    blink = co.copy()
    eyes = np.zeros(len(co), bool)
    for side, (xs, zs) in EYES.items():
        sel = largest_part(inbox(xs, zs) & (lum < 0.16), edges, key)
        c, rt, up, n, A, B = frame(co, nrm, sel)
        A, B = A * 1.12, B * 1.12  # the dark rim too
        a, b, _ = chart(co, c, rt, up, n)
        fit = surface_fit(co, c, rt, up, n, face & ~sel & (np.abs(a) < 2.5 * A) & (np.abs(b) < 2.5 * B))
        # the upper lid comes down most of the way and the lower one up a little: they meet below the centre, as a
        # thin dark line. The skin pulled over stops short of the brow
        moved = squash(blink, c, rt, up, A, B, line=-0.3, s=0.05, reach=(1.0, 1.35))
        blink = slide(blink, moved, c, rt, up, n, fit)
        eyes |= (a / A) ** 2 + (b / B) ** 2 < 1.5 ** 2
        print(f"EYE {side} centre {np.round(c, 3)} half {A:.3f} x {B:.3f} ({int(sel.sum())} vertices)")

    red = (col[:, 0] - col[:, 1] > 0.18) & (col[:, 0] > 0.3)
    sel = largest_part(inbox(*MOUTH) & (red | (lum < 0.16)), edges, key)
    # the mouth is a carved cavity (some 0.07 deep), so its frame comes from the skin round it
    around = face & ~sel & (np.linalg.norm(co - co[sel].mean(0), axis=1) < 0.08) & (nrm[:, 1] < -0.3)
    c, rt, up, n, A, B = frame(co, nrm, sel, n=nrm[around].mean(0))
    a, b, h = chart(co, c, rt, up, n)
    fit = surface_fit(co, c, rt, up, n, face & ~sel & (nrm @ n > 0.5) & (np.abs(a) < 1.6 * A) & (np.abs(b) < 2 * B))
    # its lips are the opening's edge: the mouth's vertices that border the skin (the painted rim starts just inside);
    # the roof and floor run deep behind them (and, seen along the face, past the lips)
    relief = h - fit(a, b)
    skin_v = face & ~sel
    e0, e1 = edges[:, 0], edges[:, 1]
    rim = np.zeros(len(co), bool)
    rim[e0[sel[e0] & skin_v[e1]]] = True
    rim[e1[sel[e1] & skin_v[e0]]] = True
    cuts = np.linspace(a[rim].min(), a[rim].max(), 15)
    mid = (cuts[:-1] + cuts[1:]) / 2
    bins = [rim & (a >= lo) & (a <= hi) for lo, hi in zip(cuts[:-1], cuts[1:])]
    ok = np.array([m.any() for m in bins])
    top = np.array([b[m].max() if m.any() else 0 for m in bins])[ok]
    bot = np.array([b[m].min() if m.any() else 0 for m in bins])[ok]
    ease = lambda v: np.convolve(np.pad(v, 1, mode="edge"), np.ones(3) / 3, mode="valid")  # noqa: E731
    top, bot, mid = ease(top), ease(bot), mid[ok]
    b_top, b_bot = np.interp(a, mid, top), np.interp(a, mid, bot)  # the lips' lines, across the mouth
    # what moves: the mouth (cavity included) and the skin below it, fading out just past the corners; never the
    # eyes beside it nor anything above the top lip
    w = (1 - smooth(np.abs(a), A, A + 0.012)) * ~eyes * face * ((b <= b_top) | sel)
    below = b < b_bot
    inside = ~below & ((b <= b_top) | sel)

    def mouth(target, flush=False):
        moved = co + up[None, :] * (w * (target - b))[:, None]
        return slide(co, moved, c, rt, up, n, fit, flat=w * inside if flush else None)

    # shut: everything in the mouth squashes up to the top lip's line (a thin line along its curve), ironed flush;
    # the skin below rises with it, the lift fading out before the chin's edge (where the head meets the collar)
    S, CHIN = 0.05, 0.032
    lift = (b_top - b_bot) * (1 - S)
    shut = np.where(b > b_top, b_top - 0.0005, b_top - (b_top - b) * S)  # the roof behind the top lip: just under it
    close = mouth(np.where(below, b + lift * (1 - smooth(b_bot - b, 0, CHIN)), shut), flush=True)
    # wide: the top lip stays, the bottom lip drops a little (less toward the corners), the skin below easing it
    drop = 0.013 * np.clip(1 - (a / A) ** 4, 0, 1)
    frac = np.clip((b_top - b) / np.maximum(b_top - b_bot, 1e-6), 0, 1)
    speak = mouth(np.where(below, b - drop * (1 - smooth(b_bot - b, 0, 0.045)), b - drop * frac))
    print(f"MOUTH centre {np.round(c, 3)} half {A:.3f}; lips {np.max(top - bot):.3f} apart at most; cavity "
          f"{-relief[sel].min():.4f} deep; {int(rim.sum())} of {int(sel.sum())} vertices on the rim")
    MASKS.update(eyes=eyes, mouth=sel, rim=rim)
    return {"Blink": blink, "Close": close, "Speak": speak}


# --- poses and clips ----------------------------------------------------------------------------------------------------

def rot(axis, deg):
    from mathutils import Quaternion
    return Quaternion(axis, math.radians(deg))


# A pose: {bone: [(world axis, degrees), …]} applied in order. Axes are model space: x right, y back, z up.
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
BONES = ("spine", "head", "arm.R", "hand.R", "arm.L", "hand.L")
# or, for an arm ("R"/"L"), {"elbow": point, "hand": point, "twist": degrees}: the upper arm swings so the elbow points at
# the first, the forearm so the hand points at the second, then turns about itself
LISTEN = {"arm.R": [(Y, -14), (Z, -18), (X, -12)], "hand.R": [(Z, 62), (Y, -18), (X, -8)],  # hand up by the ear
          "head": [(Y, 8), (X, 3)], "spine": [(Y, 2)], "hand.L": [(X, 25)]}  # leaning in to it; the other hand lowers
THINK = {"R": {"elbow": [0.12, -0.25, 0.42], "hand": [-0.1, -0.25, 0.57], "twist": 0},  # hand to the chin
         "L": {"elbow": [-0.17, -0.17, 0.34], "hand": [0.1, -0.3, 0.38], "twist": 0},  # the other arm across
         "head": [(Y, -6), (X, -6)], "spine": [(Y, -2)]}  # tilted, looking up


def pose_q(p, bone):
    """the bone's turn in rest space (a child's is applied after its parent's)"""
    from mathutils import Quaternion, Vector
    side = bone.split(".")[-1]
    if bone.startswith(("arm.", "hand.")) and side in p:
        a, t = ARMS[side], p[side]
        S, E, H = (Vector(a[k]) for k in ("shoulder", "elbow", "hand"))
        qu = (E - S).rotation_difference(Vector(t["elbow"]) - S)
        e2 = S + qu @ (E - S)
        qf = (qu @ (H - E)).rotation_difference(Vector(t["hand"]) - e2)
        qf = Quaternion((Vector(t["hand"]) - e2).normalized(), math.radians(t.get("twist", 0))) @ qf
        return qu if bone.startswith("arm.") else qu.inverted() @ qf @ qu
    q = Quaternion()
    for ax, deg in p.get(bone, []):
        q = rot(ax, deg) @ q
    return q


def talk(T, pauses=(), seed=1):
    """the mouth's openness over a loop of T seconds (0 shut, 1 the painted mouth, above 1 wider): syllables that each
    open from fully shut and shut again, varied in length and width, around `pauses` ((start, end): the painted smile,
    resting). It starts and ends on the painted mouth, so the loop's seam (and the model at rest) shows it"""
    rng = np.random.default_rng(seed)
    EDGE = 0.08  # painted mouth → shut, or back
    segs, spans, t0 = [], [], 0.0
    for p0, p1 in pauses:
        spans.append((t0, p0))
        segs.append((p0, p1, lambda u: 1.0))
        t0 = p1
    spans.append((t0, T))
    for s0, s1 in spans:
        segs.append((s0, s0 + EDGE, lambda u: 1 - float(smooth(u, 0, 1))))
        segs.append((s1 - EDGE, s1, lambda u: float(smooth(u, 0, 1))))
        L = s1 - s0 - 2 * EDGE
        raw = rng.uniform(0.75, 1.3, max(1, round(L / 0.22)))
        t = s0 + EDGE
        for d in raw / raw.sum() * L:
            h = min(0.06, d * 0.3)  # shut a moment, then the syllable opens and shuts again
            segs.append((t, t + h, lambda u: 0.0))
            segs.append((t + h, t + d, lambda u, p=rng.uniform(0.8, 1.45): p * math.sin(math.pi * u) ** 0.6))
            t += d
    segs.sort(key=lambda g: g[0])

    def f(t):
        t = t % T
        for a, b, g in segs:
            if a <= t <= b:
                return g((t - a) / max(b - a, 1e-9))
        return 1.0
    return f


def clips():
    """{clip: (seconds, fn(t) → {bone: world quaternion}, fn(t) → {shape: value})}; each loops seamlessly"""
    from mathutils import Quaternion

    def wave(t, T, deg, ax, phase=0.0):
        return rot(ax, deg * math.sin(2 * math.pi * (t / T + phase)))

    def body(t, T, amp):  # breathing sway, shared by every pose
        return {"spine": wave(t, T, 1.6 * amp, Y) @ wave(t, T / 2, 0.8 * amp, X, 0.25),
                "head": wave(t, T, 2.5 * amp, Y, 0.15) @ wave(t, T / 2, 1.5 * amp, X, 0.4)}

    def explaining(t, T=4.0):
        b = body(t, T, 1)
        # the presenting hand opens out and back twice; the pointing hand taps forward
        b["hand.R"] = wave(t, T / 2, 9, Y) @ wave(t, T / 2, 6, Z, 0.25)
        b["arm.R"] = wave(t, T, 4, Y, 0.1)
        b["hand.L"] = wave(t, T / 2, 7, X, 0.5)
        b["arm.L"] = wave(t, T, 3, Y, 0.6)
        return b

    def idle(t, T=5.0):
        b = body(t, T, 0.6)
        b["hand.R"] = wave(t, T, 5, Y) @ wave(t, T / 2, 2.5, Z, 0.3)
        b["hand.L"] = wave(t, T, 3, X, 0.4)
        return b

    def held(p, fn):
        def f(t):
            b = fn(t)
            out = {}
            for bone in BONES:
                out[bone] = b.get(bone, Quaternion()) @ pose_q(p, bone)
            return out
        return f

    def listening(t, T=4.0):
        b = body(t, T, 0.7)
        b["hand.R"] = wave(t, T / 2, 4, Z)  # a small cupping at the ear
        b["head"] = b["head"] @ wave(t, T, 2, Y, 0.5)
        return b

    def thinking(t, T=5.0):
        b = body(t, T, 0.6)
        b["head"] = b["head"] @ wave(t, T, 3, Z, 0.2)  # a slow, pondering turn
        b["hand.R"] = wave(t, T / 2, 2.5, X, 0.1)  # tapping the chin
        return b

    def mouth(o):  # openness → shapes: 0 shut, 1 the painted mouth, above 1 wider
        return {"Close": float(np.clip(1 - o, 0, 1)), "Speak": float(np.clip((o - 1) / 0.45, 0, 1))}

    talk_e, talk_s = talk(4.0, pauses=[(1.8, 2.3)], seed=3), talk(2.4, seed=7)

    def blink(t):
        return {"Blink": float(math.sin(math.pi * min(t / 0.24, 1)) ** 0.7)}

    none = lambda t: {}  # noqa: E731
    return {
        "explaining": (4.0, explaining, lambda t: mouth(talk_e(t))),
        "idle": (5.0, idle, none),
        "listening": (4.0, held(LISTEN, listening), none),
        "thinking": (5.0, held(THINK, thinking), none),
        "speaking": (2.4, none, lambda t: mouth(talk_s(t))),
        "blink": (0.24, none, blink),
    }


def bake(arma, obj, name, seconds, bones_fn, shapes_fn):
    import bpy
    n = max(2, round(seconds * FPS))
    if bones_fn(0):
        arma.animation_data_create()
        act = bpy.data.actions.new(name)
        arma.animation_data.action = act
        for i in range(n + 1):
            qs = bones_fn(i / FPS if i < n else 0)  # the last key repeats the first: a seamless loop
            for bone, qw in qs.items():
                pb = arma.pose.bones[bone]
                R = arma.data.bones[bone].matrix_local.to_3x3()
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = (R.inverted() @ qw.to_matrix() @ R).to_quaternion()
                pb.keyframe_insert("rotation_quaternion", frame=i + 1)
        tr = arma.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 1, act)
        arma.animation_data.action = None
    if shapes_fn(0) or name in ("speaking", "blink"):
        key = obj.data.shape_keys
        key.animation_data_create()
        act = bpy.data.actions.new(name + ".face")
        key.animation_data.action = act
        for i in range(n + 1):
            for k, v in shapes_fn(i / FPS if i < n else 0).items():
                kb = key.key_blocks[k]
                kb.value = v
                kb.keyframe_insert("value", frame=i + 1)
        tr = key.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 1, act)
        key.animation_data.action = None
    # reset to rest
    for pb in arma.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
    for kb in obj.data.shape_keys.key_blocks:
        kb.value = 0


if __name__ == "__main__":
    import bpy
    argv = sys.argv[sys.argv.index("--") + 1:]
    SRC, OUT = argv[:2]
    DEBUG = argv[argv.index("--debug") + 1] if "--debug" in argv else None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    obj = next(o for o in bpy.data.objects if o.type == "MESH")
    me = obj.data
    Mw = np.array(obj.matrix_world)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co_local = co.reshape(-1, 3)
    co = co_local @ Mw[:3, :3].T + Mw[:3, 3]
    nrm = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(-1, 3) @ Mw[:3, :3].T
    col = vertex_colours(me)
    hk = {i for i, m in enumerate(me.materials) if m.name == "Head"}
    head = np.zeros(len(co))
    for p in me.polygons:
        if p.material_index in hk:
            head[list(p.vertices)] = 1
    W8 = weights(co, head)
    print("RIG", {b: int((w > 0.5).sum()) for b, w in W8.items()})

    # shape keys, written back in the mesh's own space
    edges = np.empty(len(me.edges) * 2, int)
    me.edges.foreach_get("vertices", edges)
    key = np.unique(np.round(co, 5), axis=0, return_inverse=True)[1].ravel()
    shapes = face_shapes(co, nrm, col, head, edges.reshape(-1, 2), key)
    Minv = np.linalg.inv(Mw)
    obj.shape_key_add(name="Basis", from_mix=False)
    for k, pos in shapes.items():
        sk = obj.shape_key_add(name=k, from_mix=False)
        loc = pos @ Minv[:3, :3].T + Minv[:3, 3]
        sk.data.foreach_set("co", loc.ravel())
        sk.value = 0
        print("SHAPE", k, "moves", int((np.linalg.norm(pos - co, axis=1) > 1e-5).sum()), "vertices")

    arma = bpy.data.objects.new("Rig", bpy.data.armatures.new("Rig"))
    bpy.context.scene.collection.objects.link(arma)
    bpy.context.view_layer.objects.active = arma
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arma.data.edit_bones
    piv = {"root": ([0, 0, 0], None), "spine": ([0, 0, SPINE[0]], "root"), "head": (NECK, "spine")}
    for s, a in ARMS.items():
        piv["arm." + s] = (a["shoulder"], "spine")
        piv["hand." + s] = (a["elbow"], "arm." + s)
    bones = {}
    for bone, (pv, parent) in piv.items():
        b = eb.new(bone)
        b.head, b.tail = pv, (pv[0], pv[1], pv[2] + 0.1)  # all point up: turns are given about model-space axes
        if parent:
            b.parent = bones[parent]
        bones[bone] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    for bone, w in W8.items():
        g = obj.vertex_groups.new(name=bone)
        for i in np.nonzero(w > 1e-3)[0]:
            g.add([int(i)], float(w[i]), "REPLACE")
    mw = obj.matrix_world.copy()
    obj.parent = arma
    obj.matrix_world = mw
    obj.modifiers.new("Armature", "ARMATURE").object = arma

    if DEBUG:
        # weights as colours, then each pose, for a look before export
        palette = {"root": (0.5, 0.5, 0.5), "spine": (0.3, 0.3, 0.9), "head": (0.95, 0.95, 0.95), "arm.R": (0.9, 0.2, 0.2),
                   "hand.R": (1, 0.8, 0.1), "arm.L": (0.2, 0.8, 0.2), "hand.L": (0.1, 0.9, 0.9)}
        rgb = sum(np.outer(W8[b], palette[b]) for b in W8)
        attr = me.color_attributes.new("W", "FLOAT_COLOR", "POINT")
        attr.data.foreach_set("color", np.c_[rgb, np.ones(len(rgb))].ravel())
        sc = bpy.context.scene
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.display.shading.light = "STUDIO"
        sc.render.resolution_x = sc.render.resolution_y = 600
        sc.world = bpy.data.worlds.new("w")
        sc.world.color = (0.15, 0.15, 0.18)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 1.0
        views = {"front": ((0, -3, 0.49), (math.pi / 2, 0, 0)), "side": ((3, 0, 0.49), (math.pi / 2, 0, math.pi / 2)),
                 "face": ((0.02, -3, 0.68), (math.pi / 2, 0, 0))}

        def shoot(tag, kinds=("front", "side"), colour="VERTEX", scale=1.0):
            sc.display.shading.color_type = colour
            cam.data.ortho_scale = scale
            for k in kinds:
                cam.location, cam.rotation_euler = views[k]
                sc.render.filepath = f"{DEBUG}_{tag}_{k}.png"
                bpy.ops.render.render(write_still=True)

        shoot("weights")
        rgb = np.full((len(co), 3), 0.6)
        rgb[MASKS["eyes"]] = (0.2, 0.4, 1)
        rgb[MASKS["mouth"]] = (1, 0.2, 0.2)
        rgb[MASKS["rim"]] = (1, 0.9, 0.1)
        attr.data.foreach_set("color", np.c_[rgb, np.ones(len(rgb))].ravel())
        shoot("masks", kinds=("face",), scale=0.36)
        for tag, p in {"listen": LISTEN, "think": THINK}.items():
            for bone in piv:
                pb = arma.pose.bones[bone]
                R = arma.data.bones[bone].matrix_local.to_3x3()
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = (R.inverted() @ pose_q(p, bone).to_matrix() @ R).to_quaternion()
            shoot(tag, colour="TEXTURE")
        for pb in arma.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
        for k in ("Blink", "Close", "Speak"):
            me.shape_keys.key_blocks[k].value = 1
            shoot(k.lower(), kinds=("face",), colour="TEXTURE", scale=0.36)
            me.shape_keys.key_blocks[k].value = 0
        shoot("rest", kinds=("face",), colour="TEXTURE", scale=0.36)
        me.color_attributes.remove(attr)
        sys.exit(0)

    bpy.context.scene.render.fps = FPS  # the keys are FPS apart
    for name, (sec, bf, sf) in clips().items():
        bake(arma, obj, name, sec, bf, sf)
    for o in bpy.context.scene.objects:
        o.select_set(o in (obj, arma))
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_materials="EXPORT", export_image_format="AUTO", export_skins=True,
                              # positions only: the shapes slide the skin over an unchanged surface, so the basis
                              # normals stay right (Blender's own would replace the model's kept normals)
                              export_morph=True, export_morph_normal=False, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_frame_step=1,
                              export_anim_single_armature=True)
    print("EXPORTED", OUT)
