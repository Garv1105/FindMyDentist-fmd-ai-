"""Build the skeleton, skin the mesh, attach eyes/smile.

blender -b prep.blend --python rig.py -- <landmarks_raw.json> <out.blend>
"""
import bpy, sys, os, json
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
LM, OUT = argv
lm = {k: np.array(v) if not k.startswith("armprofile") else v for k, v in json.load(open(LM)).items()}

body = bpy.data.objects["Mascot"]

# drop tiny detached fragments (Meshy leaves a few floating bits)
import bmesh
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
seen, frags = set(), []
for v in bm.verts:
    if v.index in seen:
        continue
    comp, stack = [v], [v]
    seen.add(v.index)
    while stack:
        cur = stack.pop()
        for e in cur.link_edges:
            o = e.other_vert(cur)
            if o.index not in seen:
                seen.add(o.index)
                comp.append(o)
                stack.append(o)
    frags.append(comp)
frags.sort(key=len, reverse=True)
for comp in frags[1:]:
    c = sum((v.co for v in comp), Vector()) / len(comp)
    if len(comp) >= 10:  # real surface pieces (cuffs, soles) split off by the inner-shell removal
        continue
    print(f"removing fragment of {len(comp)} verts at {tuple(round(a, 3) for a in c)}")
    bmesh.ops.delete(bm, geom=comp, context="VERTS")
bm.to_mesh(body.data)
bm.free()
co = np.array([v.co[:] for v in body.data.vertices])


def yc(zz, xmax=0.06, half=0.012):
    m = (np.abs(co[:, 0]) < xmax) & (np.abs(co[:, 2] - zz) < half)
    return float(co[m, 1].mean())


def sym(a, b):
    """Average a left/right landmark pair into a mirrored pair."""
    a, b = np.array(a, float), np.array(b, float)
    m = (np.abs(a) + np.abs(b)) / 2
    m[1] = (a[1] + b[1]) / 2
    m[2] = (a[2] + b[2]) / 2
    return m * np.array([1, 1, 1]), m * np.array([-1, 1, 1])


P = {}
for name in ("hip", "knee", "ankle", "toe", "handtip"):
    P[name + ".L"], P[name + ".R"] = sym(lm[name + ".L"], lm[name + ".R"])
P["knee.L"][1] -= 0.006  # tiny forward bend hint so knees fold the right way
P["knee.R"][1] -= 0.006
d_l = lm["armdir.L"] / np.linalg.norm(lm["armdir.L"])
for side, sx in (("L", 1), ("R", -1)):
    d = d_l * np.array([sx, 1, 1])
    tip = P["handtip." + side]
    wrist = tip - d * 0.13
    shoulder = wrist - d * 0.2
    shoulder[1] = yc(0.0, xmax=0.16) + 0.01
    elbow = (shoulder + wrist) / 2 + np.array([0, 0.012, 0])  # elbows bend backwards-safe
    P["shoulder." + side], P["elbow." + side], P["wrist." + side] = shoulder, elbow, wrist
    P["hand_end." + side] = wrist + (tip - wrist) * 0.85
    P["clav." + side] = np.array([sx * 0.03, yc(0.045), 0.045])

spine = {zz: np.array([0, yc(zz), zz]) for zz in (-0.258, -0.13, -0.02, 0.065, 0.095)}
spine_top = np.array([0, spine[0.095][1], 0.43])
for k, v in P.items():
    print(f"{k:14s}", np.round(v, 4).tolist())

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
for o in bpy.context.scene.objects:
    o.select_set(o == rig)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None, connect=False, deform=True, roll_up=(0, -1, 0)):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.align_roll(Vector(roll_up))
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    b.use_deform = deform
    return b


bone("root", (0, 0, -0.5), (0, 0.12, -0.5), deform=False, roll_up=(0, 0, 1))
bone("hips", spine[-0.258], spine[-0.13], "root")
bone("spine", spine[-0.13], spine[-0.02], "hips", True)
bone("chest", spine[-0.02], spine[0.065], "spine", True)
bone("neck", spine[0.065], spine[0.095], "chest", True)
bone("head", spine[0.095], spine_top, "neck", True)
eyes = {"L": bpy.data.objects["Eye.L"], "R": bpy.data.objects["Eye.R"]}
for s, o in eyes.items():
    c = sum((o.matrix_world @ v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
    bone(f"eye.{s}", c + Vector((0, 0.02, 0)), c + Vector((0, -0.03, 0)), "head", roll_up=(0, 0, 1))
    bone(f"lid.{s}", c + Vector((0, 0.03, 0)), c + Vector((0, -0.02, 0)), "head", roll_up=(0, 0, 1))
for s in ("L", "R"):
    bone(f"shoulder.{s}", P[f"clav.{s}"], P[f"shoulder.{s}"], "chest")
    bone(f"upper_arm.{s}", P[f"shoulder.{s}"], P[f"elbow.{s}"], f"shoulder.{s}", True)
    bone(f"forearm.{s}", P[f"elbow.{s}"], P[f"wrist.{s}"], f"upper_arm.{s}", True)
    bone(f"hand.{s}", P[f"wrist.{s}"], P[f"hand_end.{s}"], f"forearm.{s}", True)
    bone(f"thigh.{s}", P[f"hip.{s}"], P[f"knee.{s}"], "hips")
    bone(f"shin.{s}", P[f"knee.{s}"], P[f"ankle.{s}"], f"thigh.{s}", True)
    bone(f"foot.{s}", P[f"ankle.{s}"], P[f"toe.{s}"], f"shin.{s}", True, roll_up=(0, 0, 1))
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- skin
for o in bpy.context.scene.objects:
    o.select_set(o in (body, rig))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

vg = body.vertex_groups
names = [g.name for g in vg]
W = np.zeros((len(co), len(names)))
for v in body.data.vertices:
    for g in v.groups:
        W[v.index, g.group] = g.weight
unweighted = (W.sum(1) < 1e-6).sum()
print("auto weights: unweighted verts", int(unweighted), "of", len(co))
np.savez(os.path.join(os.path.dirname(OUT), "heat_weights.npz"), W=W, co=co, names=np.array(names),
         **{k: v for k, v in P.items()})

col = {n: i for i, n in enumerate(names)}
z = co[:, 2]
me = body.data
vmat = np.zeros(len(co), int)
for p in me.polygons:
    for vi in p.vertices:
        vmat[vi] = p.material_index
is_coat = vmat == me.materials.find("Coat")
edges = np.array([e.vertices[:] for e in me.edges])


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def scale_into(rows, bone_names, factor, receiver):
    """Scale some bones' weights and hand the removed weight to `receiver` (normally the parent)."""
    for n in bone_names:
        before = W[rows, col[n]].copy()
        W[rows, col[n]] = before * factor
        W[rows, col[receiver]] += before * (1 - factor)


every = np.arange(len(co))
skirt = np.nonzero(is_coat & (z < -0.12))[0]
for s in ("L", "R"):
    # leg bones only influence their own segment, with soft ramps at each joint (child -> parent)
    scale_into(every, [f"foot.{s}"], ramp(-z, 0.425, 0.44), f"shin.{s}")
    scale_into(every, [f"shin.{s}"], ramp(-z, 0.33, 0.36), f"thigh.{s}")
    scale_into(every, [f"thigh.{s}"], ramp(-z, 0.17, 0.27), "hips")
    # the coat skirt hangs from the pelvis and only loosely follows the legs
    scale_into(skirt, [f"shin.{s}", f"foot.{s}"], 0.0, f"thigh.{s}")
    scale_into(skirt, [f"thigh.{s}"], 0.3, "hips")
# left side must not follow right limbs and vice versa
for s, sx in (("L", 1), ("R", -1)):
    wrong = np.nonzero(sx * co[:, 0] < -0.015)[0]
    scale_into(wrong, [f"{p}.{s}" for p in ("hand", "forearm", "upper_arm", "shoulder")], 0.0, "chest")
    scale_into(wrong, [f"{p}.{s}" for p in ("foot", "shin", "thigh")], 0.0, "hips")

def dist_to_chain(p, chain):
    d = np.full(len(p), 9.0)
    for a, b in zip(chain[:-1], chain[1:]):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        d = np.minimum(d, np.linalg.norm(p - (a + t[:, None] * ab), axis=1))
    return d


# Heat weighting gives the open coat's front panels 10-50% arm influence (they crumple when the
# arms go up) and some inner-sleeve vertices too little (they get left behind). Distance alone
# can't separate them (both sit 0.06-0.10 from the arm) and Meshy fused the surfaces, so topology
# can't either. Facing direction can: the arm's own surface (sleeve, inner sleeve, palm) faces
# away from the arm bone, a coat panel beside the arm faces toward it. Arm share =
# distance factor x facing factor, faded in from the shoulder joint (the shoulder keeps heat weights).
receiver_of = np.where(z > -0.06, col["chest"], np.where(z > -0.18, col["spine"], col["hips"]))
nrm = np.array([v.normal[:] for v in me.vertices])


def nearest_on_chain(p, chain):
    best_d, best_c, best_k = np.full(len(p), 9.0), np.zeros_like(p), np.zeros(len(p), int)
    for k, (a, b) in enumerate(zip(chain[:-1], chain[1:])):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        c = a + t[:, None] * ab
        d = np.linalg.norm(p - c, axis=1)
        better = d < best_d
        best_d[better], best_c[better], best_k[better] = d[better], c[better], k
    return best_d, best_c, best_k


for s, sx in (("L", 1), ("R", -1)):
    arm_bones = [f"upper_arm.{s}", f"forearm.{s}", f"hand.{s}"]
    arm_cols = [col[n] for n in arm_bones]
    chain = [P[f"shoulder.{s}"], P[f"elbow.{s}"], P[f"wrist.{s}"], P[f"hand_end.{s}"]]
    dmin, cpt, nearest = nearest_on_chain(co, chain)
    to_axis = (cpt - co) / np.maximum(dmin, 1e-9)[:, None]
    facing = (nrm * to_axis).sum(1)                     # >0: surface faces the arm (coat panel)
    k_face = ramp(-facing, -0.2, 0.3)
    k_dist = ramp(-dmin, -0.13, -0.085)
    up = chain[1] - chain[0]
    t0 = ((co - chain[0]) @ up) / (up @ up)            # 0 at the shoulder joint, 1 at the elbow
    g = ramp(t0, 0.0, 0.4) * (sx * co[:, 0] > 0.04)
    a = W[:, arm_cols].sum(1)
    target = k_dist * k_face
    # vertices heat weighting already gives mostly to the arm (hand, outer sleeve) keep it: the
    # facing test is meaningless between the fingers, whose sides face the hand's centre line
    target = np.where(a > 0.5, np.maximum(a, target), target)
    print(f"arm {s}: sleeve verts {((target > 0.99) & (g > 0.5)).sum()}, "
          f"coat verts losing arm weight {((target < 0.01) & (a > 0.1) & (g > 0.5)).sum()}")
    new_a = a + (target - a) * g
    rows = np.nonzero(np.abs(new_a - a) > 1e-4)[0]
    for r in rows:
        other = [k for k in range(len(names)) if k not in arm_cols]
        rest = W[r, other].sum()
        if a[r] > 1e-6:
            W[r, arm_cols] *= new_a[r] / a[r]
        else:
            W[r, arm_cols[nearest[r]]] = new_a[r]
        if rest > 1e-6:
            W[r, other] *= (1 - new_a[r]) / rest
        else:
            W[r, receiver_of[r]] += 1 - new_a[r]
    print(f"arm/torso split {s}: adjusted {len(rows)} verts")

# laplacian smoothing of all weights removes spikes from heat weighting
for _ in range(4):
    acc = np.zeros_like(W)
    cnt = np.zeros(len(co))
    np.add.at(acc, edges[:, 0], W[edges[:, 1]])
    np.add.at(acc, edges[:, 1], W[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1)
    np.add.at(cnt, edges[:, 1], 1)
    W = 0.5 * W + 0.5 * acc / np.maximum(cnt, 1)[:, None]

# rigid head: everything above the collar follows the head; short blend into the neck
head_w = np.clip((z - 0.07) / 0.03, 0, 1)
for n in names:
    if n != "head":
        W[:, col[n]] *= (1 - head_w)
W[:, col["head"]] = np.maximum(W[:, col["head"]] * (1 - head_w), head_w)
for s in ("L", "R"):
    W[:, col[f"eye.{s}"]] = 0
    W[:, col[f"lid.{s}"]] = 0
# keep top 4, normalise
top = np.argsort(-W, 1)[:, 4:]
np.put_along_axis(W, top, 0, 1)
W[W < 0.01] = 0
fallback = W.sum(1) < 1e-6
W[fallback, col["hips"]] = 1  # anything heat weighting missed rides with the pelvis
W /= W.sum(1, keepdims=True)
print("fallback-to-hips verts", int(fallback.sum()))

# Pieces split off by the inner-shell removal (shoe rims, cuff bits) got their own heat weights and
# drift in big poses: give each the weights of the nearest vertex on the main surface.
from mathutils import kdtree
comp_id = np.full(len(co), -1)
nbrs = [[] for _ in range(len(co))]
for i0, i1 in edges:
    nbrs[i0].append(i1)
    nbrs[i1].append(i0)
n_comp = 0
for start in range(len(co)):
    if comp_id[start] >= 0:
        continue
    comp_id[start] = n_comp
    stack = [start]
    while stack:
        cur = stack.pop()
        for nb in nbrs[cur]:
            if comp_id[nb] < 0:
                comp_id[nb] = n_comp
                stack.append(nb)
    n_comp += 1
main = np.bincount(comp_id).argmax()
kd = kdtree.KDTree(int((comp_id == main).sum()))
main_idx = np.nonzero(comp_id == main)[0]
for k, vi in enumerate(main_idx):
    kd.insert(co[vi], k)
kd.balance()
detached = np.nonzero(comp_id != main)[0]
for vi in detached:
    _, k, _ = kd.find(co[vi])
    W[vi] = W[main_idx[k]]
print(f"detached pieces: {n_comp - 1}, {len(detached)} verts now follow the nearest main-surface vertex")

# Shoes are rigid (and set last so nothing above can undo it): heat weights + smoothing leave ~30% shin/thigh
# on them, which smears the shoe into a cone whenever the ankle bends; the heel sits 10 cm behind the ankle.
shoe_idx = me.materials.find("Shoe")
is_shoe = np.zeros(len(co), bool)  # any vertex touching a shoe face, so no shoe face straddles two bones
for p in me.polygons:
    if p.material_index == shoe_idx:
        is_shoe[list(p.vertices)] = True
for s, sx in (("L", 1), ("R", -1)):
    rows = np.nonzero(is_shoe & (sx * co[:, 0] > 0))[0]
    k = np.ones(len(rows))  # the whole shoe; the trouser hem above it absorbs the bend
    W[rows] *= (1 - k)[:, None]
    W[rows, col[f"foot.{s}"]] += k
    print(f"shoe {s}: {len(rows)} verts, fully rigid {(k > 0.999).sum()}")

# The trouser hem drapes over the low heel down to the sole. If it follows the shin, a bent ankle uncovers the
# heel as a flat tail, so the hem within 3 cm of the shoe follows the foot, blending into the shin above it.
for s, sx in (("L", 1), ("R", -1)):
    shoe_v = np.nonzero(is_shoe & (sx * co[:, 0] > 0))[0]
    kd_shoe = kdtree.KDTree(len(shoe_v))
    for k_, vi in enumerate(shoe_v):
        kd_shoe.insert(co[vi], k_)
    kd_shoe.balance()
    cand = np.nonzero(~is_shoe & (sx * co[:, 0] > 0) & (z < -0.40))[0]
    near = np.array([kd_shoe.find(co[vi])[2] < 0.03 for vi in cand], bool)
    rows = cand[near]
    k = ramp(-z[rows], 0.41, 0.445)
    W[rows] *= (1 - k)[:, None]
    W[rows, col[f"foot.{s}"]] += k
    print(f"hem {s}: {len(rows)} verts blended toward the foot")

for i, n in enumerate(names):
    g = vg[n]
    g.remove(range(len(co)))
    nz = np.nonzero(W[:, i] > 1e-4)[0]
    for vi in nz:
        g.add([int(vi)], float(W[vi, i]), "REPLACE")

# glossy hand material where the hand bone dominates
hand_mat = body.data.materials.find("Hand")
for p in body.data.polygons:
    hw = max(W[list(p.vertices), col["hand.L"]].mean(), W[list(p.vertices), col["hand.R"]].mean())
    if hw > 0.5:
        p.material_index = hand_mat

# ---------------------------------------------------------------- eyes + smile ride on bones
for obj, bname in ((eyes["L"], "eye.L"), (eyes["R"], "eye.R"), (bpy.data.objects["Smile"], "head"),
                   (bpy.data.objects["Lid.L"], "lid.L"), (bpy.data.objects["Lid.R"], "lid.R")):
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    g = obj.vertex_groups.new(name=bname)
    g.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    m = obj.modifiers.new("Armature", "ARMATURE")
    m.object = rig

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
