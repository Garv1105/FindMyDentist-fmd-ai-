"""Seated mascot, step 2: procedural sleeves + glove hands, face kit, skeleton and skinning.

blender -b prep.blend --python rig_sit.py -- <original meshy.glb> <out.blend>

Skeleton (measured on the seated mesh; character's left = +X, front = -Y):
  root ─ hips ─ spine ─ chest ─ neck ─ head ─ {eye, lid, brow}.{L,R}, smile, mouth
                              └ shoulder.L ─ upper_arm.L ─ forearm.L ─ hand.L ─ {thumb,index,middle,ring,pinky}_0{1,2,3}.L
The crossed legs are part of the seat and ride on hips. prep_sit removed the scanned arms (fused into the body);
the sleeves here are clean tubes with a ball shoulder that stays inside the closed torso at any angle.
Finger bones have their local Z on the back of the hand: a finger curls toward the palm about its local -X.
"""
import bpy, bmesh, sys, os, tempfile
import numpy as np
from mathutils import Vector, Matrix, kdtree
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(__file__))
import hand as H  # noqa: E402
import face_sit as F  # noqa: E402
import sleeve as SL  # noqa: E402

SRC, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
body = bpy.data.objects["Mascot"]
me = body.data

# ---------------------------------------------------------------- joints
SPINE = [(0, 0.050, -0.340), (0, 0.050, -0.235), (0, 0.045, -0.130), (0, 0.040, -0.050), (0, 0.035, -0.008),
         (0, 0.035, 0.450)]  # hips, spine, chest, neck, head start, head top
CLAV = (0.045, 0.060, -0.058)
SHOULDER = (0.150, 0.100, -0.065)
ELBOW = (0.243, 0.117, -0.232)
CUFF = Vector((0.2932, -0.1221, -0.2464))          # centre of the scanned sleeve opening
FWD = Vector((0.314, -0.948, -0.044)).normalized()  # its normal = forearm direction at the wrist
WRIST = CUFF + FWD * 0.004
HAND_SCALE = 1.3  # chunky cartoon gloves (reference); the wrist then sits snugly in the cuff band
MIRROR = Matrix.Diagonal((-1, 1, 1, 1))


def mx(v, s):
    return Vector((v[0] if s == "L" else -v[0], v[1], v[2]))


def hand_matrix_left():
    thumb_out = Vector((-FWD.y, FWD.x, 0)).normalized()   # horizontal, outward: the left thumb when palm-up
    back = thumb_out.cross(FWD).normalized()               # back of the hand faces down -> palm up
    M = Matrix((FWD, -thumb_out, back)).transposed().to_4x4() @ Matrix.Scale(HAND_SCALE, 4)
    M.translation = WRIST
    return M


def principled(name, rgb, rough, coat=0.0, coat_rough=0.08):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    m.diffuse_color = (*rgb, 1)
    return m


glove_mat = principled("Glove", (0.94, 0.925, 0.95), 0.3, 0.45)
coat_mat = bpy.data.materials["Coat"]

# ---------------------------------------------------------------- sleeves, cuff bands, gloves
hand_bones, parts = {}, {}
ML = hand_matrix_left()
for s, M in (("L", ML), ("R", MIRROR @ ML)):
    S_, E_, W_, f_ = mx(SHOULDER, s), mx(ELBOW, s), mx(WRIST, s), mx(FWD, s)
    sleeve, path, path_s, s_el = SL.build_sleeve(f"Sleeve.{s}", S_, E_, W_, f_)
    sleeve.data.materials.append(coat_mat)
    band = SL.build_band(f"Cuff.{s}", W_, f_)
    band.data.materials.append(bpy.data.materials["Scrubs"])  # navy scrubs cuff, as in the meditation art
    glove, bones = H.build_hand(f"Glove.{s}")
    glove.data.transform(M)
    if M.determinant() < 0:
        glove.data.flip_normals()
    glove.data.update()
    glove.data.materials.clear()
    glove.data.materials.append(glove_mat)
    hand_bones[s] = [(n, M @ h, M @ t, par, (M.to_3x3() @ Vector(up)).normalized()) for n, h, t, par, up in bones]
    parts[s] = dict(sleeve=sleeve, path=path, path_s=path_s, s_el=s_el, band=band, glove=glove)
    print(f"arm {s}: sleeve {len(sleeve.data.vertices)} v, band {len(band.data.vertices)} v, "
          f"glove {len(glove.data.vertices)} v")

# ---------------------------------------------------------------- face kit
face = F.build(body, tempfile.mkdtemp())
print("face parts:", sorted(face))
FACE_BONE = {"Eye": "eye", "Lid": "lid", "Brow": "brow", "Smile": "smile", "MouthOpen": "mouth"}


def face_bone(key):
    base, _, side = key.partition(".")
    return f"{FACE_BONE[base]}.{side}" if side else FACE_BONE[base]


# ---------------------------------------------------------------- armature
arm = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
for o in bpy.context.scene.objects:
    o.select_set(o == rig)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.edit_bones


def bone(name, head, tail, parent=None, connect=False, up=(0, -1, 0), deform=True):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    b.align_roll(Vector(up))
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    b.use_deform = deform
    return b


bone("root", (0, 0.04, -0.5), (0, 0.16, -0.5), up=(0, 0, 1), deform=False)
spine_names = ["hips", "spine", "chest", "neck", "head"]
for i, n in enumerate(spine_names):
    bone(n, SPINE[i], SPINE[i + 1], "root" if i == 0 else spine_names[i - 1], connect=i > 0)
for key, (o, hit, n) in face.items():
    if not key.startswith("Blush"):
        bone(face_bone(key), hit, hit + n * 0.03, "head", up=(0, 0, 1))  # local Y out of the face, Z up
for s in "LR":
    bone(f"shoulder.{s}", mx(CLAV, s), mx(SHOULDER, s), "chest", up=(0, 0, 1))
    bone(f"upper_arm.{s}", mx(SHOULDER, s), mx(ELBOW, s), f"shoulder.{s}", True, up=(0, -1, 0))
    bone(f"forearm.{s}", mx(ELBOW, s), mx(WRIST, s), f"upper_arm.{s}", True, up=(0, 0, 1))
    for n, h, t, par, up in hand_bones[s]:
        bone(f"{n}.{s}", h, t, f"{par}.{s}" if par else f"forearm.{s}", connect=par is None, up=up)
bpy.ops.object.mode_set(mode="OBJECT")
print("bones:", len(arm.bones))


def skin(obj, groups):
    """groups: {bone name: weights array over obj's vertices}; adds the armature modifier."""
    for bname, w in groups.items():
        g = obj.vertex_groups.get(bname) or obj.vertex_groups.new(name=bname)
        for vi in np.nonzero(w > 1e-4)[0]:
            g.add([int(vi)], float(w[vi]), "REPLACE")
    obj.parent = rig
    m = obj.modifiers.new("Armature", "ARMATURE")
    m.object = rig


# ---------------------------------------------------------------- body skin
# Heat weighting needs a closed surface; the cleaned body has open seams from the inner-shell removal, so the
# weights are solved on a watertight voxel remesh of the ORIGINAL scan and transferred by nearest surface point.
BODY_BONES = ["hips", "spine", "chest", "neck", "head", "shoulder.L", "shoulder.R"]
bpy.ops.import_scene.gltf(filepath=SRC)
proxy = [o for o in bpy.context.selected_objects if o.type == "MESH"][0]
proxy.name = "WeightProxy"
for o in bpy.context.scene.objects:
    o.select_set(o == proxy)
bpy.context.view_layer.objects.active = proxy
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
rm = proxy.modifiers.new("remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.0055
bpy.ops.object.modifier_apply(modifier=rm.name)
saved = {b.name: b.use_deform for b in arm.bones}
for b in arm.bones:
    b.use_deform = b.name in BODY_BONES
for o in bpy.context.scene.objects:
    o.select_set(o in (proxy, rig))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
for b in arm.bones:
    b.use_deform = saved[b.name]
pn = [g.name for g in proxy.vertex_groups]
PW = np.zeros((len(proxy.data.vertices), len(BODY_BONES)))
for v in proxy.data.vertices:
    for g in v.groups:
        PW[v.index, BODY_BONES.index(pn[g.group])] = g.weight
print(f"proxy {len(PW)} verts, heat-unweighted {int((PW.sum(1) < 1e-6).sum())}")
pbm = bmesh.new()
pbm.from_mesh(proxy.data)
bmesh.ops.triangulate(pbm, faces=pbm.faces)
pbm.faces.ensure_lookup_table()
pbvh = BVHTree.FromBMesh(pbm)
co = np.array([v.co[:] for v in me.vertices])
x, y, z = co.T
W = np.zeros((len(co), len(BODY_BONES)))
for i, c in enumerate(co):
    loc, _, fi, _ = pbvh.find_nearest(Vector(c))
    f = pbm.faces[fi]
    a, b_, c_ = (v.co for v in f.verts)
    v0, v1, v2 = b_ - a, c_ - a, loc - a
    d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
    den = d00 * d11 - d01 * d01 or 1e-12
    vv = (d11 * d20 - d01 * d21) / den
    ww = (d00 * d21 - d01 * d20) / den
    W[i] = sum(max(0.0, bc) * PW[v.index] for bc, v in zip((1 - vv - ww, vv, ww), f.verts))
pbm.free()

# Liner: the cleaned torso has a few hairline slits where the scan's coat flaps met the removed arms. A hidden
# white surface 1.2 cm inside the watertight proxy, kept only where it is clearly inside the body, makes them read
# as soft folds instead of see-through cracks.
lbm = bmesh.new()
lbm.from_mesh(proxy.data)
lbm.normal_update()
for v in lbm.verts:
    v.co -= v.normal * 0.012
bmesh.ops.delete(lbm, geom=[v for v in lbm.verts if not (abs(v.co.x) < 0.17 and -0.30 < v.co.z < -0.012)],
                 context="VERTS")
bbm = bmesh.new()
bbm.from_mesh(me)
bbvh = BVHTree.FromBMesh(bbm)
bbm.free()
outside = []
for v in lbm.verts:
    loc, nrm_, _, _ = bbvh.find_nearest(v.co)
    if loc is None or (v.co - loc).dot(nrm_) > -0.004:  # outside the body or hugging its surface
        outside.append(v)
bmesh.ops.delete(lbm, geom=outside, context="VERTS")
liner_me = bpy.data.meshes.new("Liner")
lbm.to_mesh(liner_me)
lbm.free()
liner = bpy.data.objects.new("Liner", liner_me)
bpy.context.scene.collection.objects.link(liner)
for o in bpy.context.scene.objects:
    o.select_set(o == liner)
bpy.context.view_layer.objects.active = liner
dm = liner.modifiers.new("dec", "DECIMATE")
dm.ratio = min(1.0, 6000 / max(1, len(liner_me.polygons)))
bpy.ops.object.modifier_apply(modifier=dm.name)
liner_me.materials.append(coat_mat)
for p_ in liner_me.polygons:  # smooth: flat shading would split every vertex per face in the export
    p_.use_smooth = True
print(f"liner: {len(liner_me.vertices)} verts")
bpy.data.objects.remove(proxy)
col = {n: i for i, n in enumerate(BODY_BONES)}
edges = np.array([e.vertices[:] for e in me.edges])


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def to_bone(k, name):
    W[:] *= (1 - k)[:, None]
    W[:, col[name]] += k


for _ in range(3):  # smooth heat-weight spikes
    acc = np.zeros_like(W)
    cnt = np.zeros(len(co))
    np.add.at(acc, edges[:, 0], W[edges[:, 1]])
    np.add.at(acc, edges[:, 1], W[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1)
    np.add.at(cnt, edges[:, 1], 1)
    W = 0.5 * W + 0.5 * acc / np.maximum(cnt, 1)[:, None]
to_bone(ramp(-z, 0.27, 0.31), "hips")   # the seat: crossed legs, feet, coat on the floor
to_bone(ramp(z, -0.04, -0.006), "head")  # rigid head
for s, sx in (("L", 1), ("R", -1)):      # nothing on one side follows the other shoulder
    wrong = sx * x < -0.03
    W[wrong, col["chest"]] += W[wrong, col[f"shoulder.{s}"]]
    W[wrong, col[f"shoulder.{s}"]] = 0
W[W < 0.01] = 0
fb = W.sum(1) < 1e-6
W[fb, col["chest"]] = 1
W /= W.sum(1, keepdims=True)

# pieces split off by the inner-shell removal follow the nearest vertex of the main surface
comp = np.full(len(co), -1)
nb = [[] for _ in range(len(co))]
for a_, b_ in edges:
    nb[a_].append(b_)
    nb[b_].append(a_)
nc = 0
for st in range(len(co)):
    if comp[st] >= 0:
        continue
    comp[st] = nc
    stack = [st]
    while stack:
        c_ = stack.pop()
        for w_ in nb[c_]:
            if comp[w_] < 0:
                comp[w_] = nc
                stack.append(w_)
    nc += 1
main = np.bincount(comp).argmax()
main_idx = np.nonzero(comp == main)[0]
kd = kdtree.KDTree(len(main_idx))
for k, vi in enumerate(main_idx):
    kd.insert(co[vi], k)
kd.balance()
det = np.nonzero(comp != main)[0]
for vi in det:
    W[vi] = W[main_idx[kd.find(co[vi])[1]]]
print(f"body: fallback {int(fb.sum())}, detached pieces {nc - 1} ({len(det)} verts)")
skin(body, {n: W[:, i] for i, n in enumerate(BODY_BONES)})
kd_all = kdtree.KDTree(len(co))
for i, c in enumerate(co):
    kd_all.insert(c, i)
kd_all.balance()
LV = np.array([v.co[:] for v in liner.data.vertices])
LW = np.array([W[kd_all.find(p)[1]] for p in LV]) if len(LV) else np.zeros((0, len(BODY_BONES)))
skin(liner, {n: LW[:, i] for i, n in enumerate(BODY_BONES)})

# ---------------------------------------------------------------- sleeves, bands, gloves
for s, p in parts.items():
    V = np.array([v.co[:] for v in p["sleeve"].data.vertices])
    d = np.linalg.norm(V[:, None, :] - p["path"][None, :, :], axis=2)
    sv = p["path_s"][d.argmin(1)]
    fo = np.clip((sv - (p["s_el"] - 0.035)) / 0.07, 0, 1)
    fo = fo * fo * (3 - 2 * fo)
    skin(p["sleeve"], {f"upper_arm.{s}": 1 - fo, f"forearm.{s}": fo})
    skin(p["band"], {f"forearm.{s}": np.ones(len(p["band"].data.vertices))})
    segs = [(n, np.array(h), np.array(t)) for n, h, t, _, _ in hand_bones[s]]
    G = np.array([v.co[:] for v in p["glove"].data.vertices])
    D = []
    for n, h, t in segs:
        ab = t - h
        tt = np.clip(((G - h) @ ab) / (ab @ ab), 0, 1)
        dist = np.linalg.norm(G - (h + tt[:, None] * ab), axis=1)
        D.append(dist - (0.022 * HAND_SCALE if n == "hand" else 0.0))  # the palm is thick: favour it inside
    D = np.stack(D, 1)
    Wg = np.exp(-(D - D.min(1, keepdims=True)) / (0.0025 * HAND_SCALE))
    Wg[Wg < 0.05] = 0
    Wg /= Wg.sum(1, keepdims=True)
    skin(p["glove"], {f"{n}.{s}": Wg[:, j] for j, (n, _, _) in enumerate(segs)})

# ---------------------------------------------------------------- face parts ride on their bones
for key, (o, _, _) in face.items():
    skin(o, {("head" if key.startswith("Blush") else face_bone(key)): np.ones(len(o.data.vertices))})

bpy.context.scene["sink"] = F.SINK
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
