"""Standing Tripo mascot, step 2: glove hands, face kit, skeleton and skinning.

blender -b prep.blend --python rig_tripo.py -- <out dir> [sit]

Skeleton (character's left = +X, front = -Y, up = +Z). Bone names match the seated mascot, so its pose helpers
and the web player work on both:
  root ─ hips ─ spine ─ chest ─ neck ─ head ─ {eye, lid, brow}.{L,R}, smile, mouth
                         └ shoulder.L ─ upper_arm.L ─ forearm.L ─ hand.L ─ {thumb,index,middle,ring,pinky}_0{1,2,3}.L
             └ thigh.L ─ shin.L ─ foot.L ─ toe.L
Joints were measured on the prepped mesh (gridded front/side renders and slices); each wrist sits on the sleeve cut
that prep_tripo.py saved in cuffs.json. Finger bones have their local Z on the back of the hand (see sit/hand.py).
"sit": the seated model. No leg bones (the crossed legs ride on the pelvis); the gloves rest palm-up on the cuffs.
"""
import bpy, sys, os, json, tempfile
import numpy as np
from mathutils import Vector, Matrix, kdtree

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "sit"))
import hand as H  # noqa: E402
import sleeve as SL  # noqa: E402
import face_sit as F  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT_DIR, SIT = ARGS[0], ARGS[1:2] == ["sit"]
cuffs = json.load(open(os.path.join(OUT_DIR, "cuffs.json")))
body = bpy.data.objects["Mascot"]
me = body.data
head_obj = bpy.data.objects.get("Head")  # seated: prep_tripo rebuilt the head as its own object (mouth carved)
head_skin = bpy.data.objects.get("HeadSurface")  # ...and its uncarved twin, for placing the face kit and the lid

# ---------------------------------------------------------------- joints (left side; the right is mirrored in x)
SPINE = [(0, -0.045, -0.235), (0, -0.045, -0.160), (0, -0.045, -0.085), (0, -0.040, 0.000), (0, -0.035, 0.045),
         (0, -0.035, 0.490)]  # hips, spine, chest, neck, head start, head top
CLAV = (0.025, -0.040, -0.010)
SHOULDER = (0.125, -0.040, -0.035)
ELBOW = (0.210, -0.042, -0.100)
HIP = (0.077, -0.045, -0.232)
KNEE = (0.081, -0.052, -0.325)   # a hair forward of the hip-ankle line: the knee folds the right way
ANKLE = (0.086, -0.030, -0.415)
BALL = (0.098, -0.098, -0.455)
TOE_END = (0.100, -0.150, -0.462)
HAND_SCALE, WRIST_R = 0.82, 0.036
if SIT:  # seated export: shoulders over a short torso, elbows bent back, forearms forward over the knees
    SPINE = [(0, 0.020, -0.370), (0, 0.020, -0.280), (0, 0.020, -0.180), (0, 0.020, -0.060), (0, 0.000, -0.020),
             (0, 0.000, 0.490)]
    CLAV = (0.040, 0.020, -0.080)
    SHOULDER = (0.165, 0.030, -0.100)
    ELBOW = (0.260, 0.030, -0.235)
MIRROR = Matrix.Diagonal((-1, 1, 1, 1))


def mx(v, s):
    return Vector((v[0] if s == "L" else -v[0], v[1], v[2]))


def hand_matrix(s):
    """Glove frame on this side's sleeve cut: fingers along the cuff axis, back of the hand outward, thumb forward."""
    c, n = Vector(cuffs[s]["centre"]), Vector(cuffs[s]["axis"]).normalized()
    if s == "R":  # build the left-hand frame on the mirrored cuff, then mirror it back
        c, n = Vector((-c.x, c.y, c.z)), Vector((-n.x, n.y, n.z))
    out = Vector((0, 0, -1)) if SIT else Vector((1, 0, 0))  # back of the hand: down (palm up) / outward
    back = (out - out.dot(n) * n).normalized()
    M = Matrix((n, back.cross(n), back)).transposed().to_4x4() @ Matrix.Scale(HAND_SCALE, 4)
    M.translation = c + n * 0.002
    return M if s == "L" else MIRROR @ M


glove_mat = bpy.data.materials.get("Glove") or bpy.data.materials.new("Glove")
glove_mat.use_nodes = True
_p = glove_mat.node_tree.nodes["Principled BSDF"]
_p.inputs["Base Color"].default_value = (0.96, 0.96, 0.975, 1)   # glossy porcelain, like the head
_p.inputs["Roughness"].default_value = 0.07
_p.inputs["Coat Weight"].default_value = 0.9
_p.inputs["Coat Roughness"].default_value = 0.015
_p.inputs["Emission Color"].default_value = (0.96, 0.96, 0.975, 1)
_p.inputs["Emission Strength"].default_value = 0.08
glove_mat.diffuse_color = (0.96, 0.96, 0.975, 1)

# ---------------------------------------------------------------- gloves
hand_bones, gloves = {}, {}
for s in "LR":
    M = hand_matrix(s)
    glove, bones = H.build_hand(f"Glove.{s}", wrist_r=WRIST_R)
    glove.data.transform(M)
    if M.determinant() < 0:
        glove.data.flip_normals()
    glove.data.update()
    glove.data.materials.clear()
    glove.data.materials.append(glove_mat)
    hand_bones[s] = [(n, M @ h, M @ t, par, (M.to_3x3() @ Vector(up)).normalized()) for n, h, t, par, up in bones]
    gloves[s] = glove
    print(f"glove {s}: {len(glove.data.vertices)} v")

# ---------------------------------------------------------------- seated: procedural sleeves + blue cuff bands
# prep_tripo removed the scanned sleeves (fused into the torso and the knee): clean tubes from a ball shoulder inside
# the torso, through a rounded elbow, to a turned-back cuff, sized like Tripo's coat sleeves.
sleeves = {}
if SIT:
    coat_mat, scrubs_mat = bpy.data.materials["Coat"], bpy.data.materials["Scrubs"]
    for s in "LR":
        W_, f_ = Vector(cuffs[s]["centre"]), Vector(cuffs[s]["axis"])
        sl, path, path_s, s_el = SL.build_sleeve(f"Sleeve.{s}", mx(SHOULDER, s), mx(ELBOW, s), W_, f_,
                                                 r_up=0.050, r_el=0.054, r_fo=0.052, r_cuff=0.060, cuff_len=0.034)
        sl.data.materials.append(coat_mat)
        band = SL.build_band(f"Cuff.{s}", W_, f_, r=0.046)
        band.data.materials.append(scrubs_mat)
        sleeves[s] = dict(sleeve=sl, path=path, path_s=path_s, s_el=s_el, band=band)
        print(f"sleeve {s}: {len(sl.data.vertices)} v, band {len(band.data.vertices)} v")

# ---------------------------------------------------------------- face kit (eyes, lids, brows, smile, open mouth, blush)
F.EYE_X, F.EYE_Z, F.EYE_RX, F.EYE_RZ = 0.0935, 0.2095, 0.037, 0.045
F.LID_END_Z, F.LID_SAG, F.LID_HW = 0.2225, 0.028, 0.050
F.BROW_DZ, F.BROW_DX = 0.096, 0.020
F.SMILE_END_Z, F.SMILE_SAG, F.SMILE_HW = 0.150, 0.014, 0.038
F.MOUTH_TOP_Z, F.MOUTH_RX, F.MOUTH_RZ = 0.157, 0.049, 0.033  # a little wider than the paint: reads at small sizes
F.BLUSH_X, F.BLUSH_Z, F.BLUSH_RX, F.BLUSH_RZ = 0.135, 0.152, 0.034, 0.022
if SIT:
    # the scan's own painted face (front view of the glb as it is, head turned 14 deg), about its centre x=0.027:
    # closed-eye arcs 0.127 either side, ends z 0.128, lowest point 0.105; brows 0.139 either side, z 0.229;
    # open mouth 0.091 wide, top edge 0.0705 in the middle curling up to 0.078 at the corners, bottom 0.039;
    # blush 0.151 either side, z 0.068
    F.EYE_X, F.EYE_Z, F.EYE_RX, F.EYE_RZ = 0.127, 0.118, 0.040, 0.048
    F.LID_END_Z, F.LID_SAG, F.LID_HW, F.TUBE_LID = 0.128, 0.023, 0.047, 0.0058
    F.BROW_DZ, F.BROW_DX, F.BROW_HW, F.BROW_SAG, F.TUBE_BROW = 0.229 - 0.118, 0.0095, 0.025, 0.012, 0.004
    F.STROKE_TAPER = 0.35
    F.SMILE_END_Z, F.SMILE_SAG, F.SMILE_HW = 0.076, 0.012, 0.040
    F.MOUTH_TOP_Z, F.MOUTH_RX, F.MOUTH_RZ = 0.0705, 0.0455, 0.031   # (the flat disc is replaced by the 3D mouth)
    F.BLUSH_X, F.BLUSH_Z, F.BLUSH_RX, F.BLUSH_RZ = 0.151, 0.068, 0.036, 0.027
    F.BLUSH_ALPHA, F.BLUSH_FALLOFF, F.BLUSH_RGB = 0.95, 1.0, (1.0, 0.42, 0.55)  # rosy cheeks
MOUTH_HW, MOUTH_TOP, MOUTH_CORNER, MOUTH_DROP, MOUTH_DEPTH = 0.0455, 0.0705, 0.078, 0.039, 0.016
FACE_CX = 0.027 if SIT else 0.0  # same as prep_tripo: the face's centre line on the turned seated head
F.FACE_CX = FACE_CX
face = F.build(head_skin or body, tempfile.mkdtemp())


def mesh_object(name, bm, mats):
    me_ = bpy.data.meshes.new(name)
    bm.to_mesh(me_)
    bm.free()
    o = bpy.data.objects.new(name, me_)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        me_.materials.append(m)
    for p in me_.polygons:
        p.use_smooth = True
    return o


def boolean(target, cutter, op):
    md = target.modifiers.new("bool", "BOOLEAN")
    md.operation, md.object, md.solver = op, cutter, "EXACT"
    md.material_mode = "TRANSFER"
    for o in bpy.context.scene.objects:
        o.select_set(o == target)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=md.name)


if SIT:  # ---------------------------------------------------------------- the 3D mouth's moving parts
    # prep_tripo carved the open mouth into the head. Here: a 3D tongue inside it (on the mouth bone: built sunk, it
    # slides into place when the mouth opens) and the lid, the head's own skin over the opening (on mouth_cover: it
    # closes the mouth for closed-mouth faces and sinks away when the mouth opens).
    import bmesh
    surf = F.Surface(head_skin)
    xs = np.linspace(-MOUTH_HW, MOUTH_HW, 25)
    outline = [(FACE_CX + x, MOUTH_TOP + (MOUTH_CORNER - MOUTH_TOP) * (x / MOUTH_HW) ** 2) for x in xs]
    outline += [(FACE_CX + MOUTH_HW * np.cos(a), MOUTH_CORNER - MOUTH_DROP * np.sin(a))
                for a in np.linspace(0, np.pi, 25)[1:-1]]
    ys = np.array([surf.at(x, z)[0].y for x, z in outline])
    cz = float(np.mean([z for _, z in outline]))
    pb_ = bmesh.new()  # straight-walled prism through the skin, 4 mm outside the outline (the lid overlaps the lips)
    big = [(FACE_CX + (x - FACE_CX) * (1 + 0.004 / MOUTH_HW), cz + (z - cz) * (1 + 0.004 / MOUTH_DROP)) for x, z in outline]
    rings = [[pb_.verts.new((x, surf.at(x, z)[0].y + dy, z)) for x, z in big] for dy in (-0.02, 0.006)]
    for i in range(len(outline)):
        pb_.faces.new((rings[0][i], rings[0][i - 1], rings[1][i - 1], rings[1][i]))
    front, back = pb_.verts.new((FACE_CX, ys.min() - 0.02, cz)), pb_.verts.new((FACE_CX, ys.max() + 0.006, cz))
    for i in range(len(outline)):
        pb_.faces.new((rings[0][i - 1], rings[0][i], front))
        pb_.faces.new((rings[1][i], rings[1][i - 1], back))
    bmesh.ops.recalc_face_normals(pb_, faces=pb_.faces[:])
    prism = mesh_object("MouthPrism", pb_, [bpy.data.materials["MouthInside"]])
    cover = bpy.data.objects.new("MouthCover", head_skin.data.copy())
    bpy.context.scene.collection.objects.link(cover)
    cover.data.materials.clear()
    cover.data.materials.append(head_obj.data.materials[0])  # the tooth porcelain
    boolean(cover, prism, "INTERSECT")
    cb = bmesh.new()
    cb.from_mesh(cover.data)
    bmesh.ops.delete(cb, geom=[f for f in cb.faces if f.material_index != 0], context="FACES")
    bmesh.ops.delete(cb, geom=[v for v in cb.verts if not v.link_faces], context="VERTS")
    # its rim dips just under the skin and its middle sits a hair above it, so no edge or gap ever shows
    rim_v = {v for e in cb.edges if e.is_boundary for v in e.verts}
    rim_xz = np.array([(v.co.x, v.co.z) for v in rim_v])
    cb.normal_update()
    for v in cb.verts:
        d = np.sqrt(((rim_xz - (v.co.x, v.co.z)) ** 2).sum(1)).min()
        t = min(1.0, d / 0.004)
        v.co += v.normal * (-0.0006 + 0.001 * t * t * (3 - 2 * t))
    cb.to_mesh(cover.data)
    cb.free()
    bpy.data.objects.remove(prism)
    tb = bmesh.new()  # the tongue: low in the mouth, its round top showing above the lower lip
    bmesh.ops.create_uvsphere(tb, u_segments=32, v_segments=16, radius=1.0)
    ty = surf.at(FACE_CX, MOUTH_CORNER - MOUTH_DROP * 0.8)[0].y
    for v in tb.verts:
        v.co = Vector((FACE_CX + v.co.x * MOUTH_HW * 0.5, ty + 0.019 + v.co.y * 0.008, MOUTH_CORNER - MOUTH_DROP * 0.8 + v.co.z * 0.011))
    tongue = mesh_object("Tongue3D", tb, [bpy.data.materials["Tongue"]])
    _, hit, n = face["MouthOpen"]
    tongue.data.transform(Matrix.Translation(-n * F.SINK))
    bpy.data.objects.remove(face["MouthOpen"][0])
    face["MouthOpen"] = (tongue, hit, n)
    face["MouthCover"] = (cover, hit, n)
    bpy.data.objects.remove(head_skin)
    print(f"3D mouth: lid {len(cover.data.polygons)} faces")
print("face parts:", sorted(face))
FACE_BONE = {"Eye": "eye", "Lid": "lid", "Brow": "brow", "Smile": "smile", "MouthOpen": "mouth",
             "MouthCover": "mouth_cover"}


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


bone("root", (0, -0.03, -0.49), (0, 0.09, -0.49), up=(0, 0, 1), deform=False)
spine_names = ["hips", "spine", "chest", "neck", "head"]
for i, n in enumerate(spine_names):
    bone(n, SPINE[i], SPINE[i + 1], "root" if i == 0 else spine_names[i - 1], connect=i > 0)
for key, (o, hit, n) in face.items():
    if not key.startswith("Blush"):
        bone(face_bone(key), hit, hit + n * 0.03, "head", up=(0, 0, 1))  # local Y out of the face, Z up
for s in "LR":
    wrist = Vector(cuffs[s]["centre"])
    bone(f"shoulder.{s}", mx(CLAV, s), mx(SHOULDER, s), "chest", up=(0, 0, 1))
    bone(f"upper_arm.{s}", mx(SHOULDER, s), mx(ELBOW, s), f"shoulder.{s}", True, up=(0, -1, 0))
    bone(f"forearm.{s}", mx(ELBOW, s), wrist, f"upper_arm.{s}", True, up=(0, 0, 1))
    for n, h, t, par, up in hand_bones[s]:
        # hand.py's wrist joint is 2 mm past the cut: the hand bone hangs off the forearm unconnected
        bone(f"{n}.{s}", h, t, f"{par}.{s}" if par else f"forearm.{s}", connect=False, up=up)
    if not SIT:
        bone(f"thigh.{s}", mx(HIP, s), mx(KNEE, s), "hips", up=(0, -1, 0))
        bone(f"shin.{s}", mx(KNEE, s), mx(ANKLE, s), f"thigh.{s}", True, up=(0, -1, 0))
        bone(f"foot.{s}", mx(ANKLE, s), mx(BALL, s), f"shin.{s}", True, up=(0, 0, 1))
        bone(f"toe.{s}", mx(BALL, s), mx(TOE_END, s), f"foot.{s}", True, up=(0, 0, 1))
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


# ---------------------------------------------------------------- body skin: bone heat on a voxel proxy
# Blender's heat solver gives up on this mesh (decimated, with very thin coat edges), so the weights are solved on a
# watertight voxel remesh of the body and transferred back by nearest surface point (barycentric).
import bmesh  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

LIMBS = ("shoulder", "upper_arm", "forearm") + (() if SIT else ("thigh", "shin", "foot", "toe"))
BODY_BONES = ["hips", "spine", "chest", "neck", "head"] + [f"{p}.{s}" for s in "LR" for p in LIMBS]
proxy = bpy.data.objects.new("WeightProxy", me.copy())
bpy.context.scene.collection.objects.link(proxy)
for o in bpy.context.scene.objects:
    o.select_set(o == proxy)
bpy.context.view_layer.objects.active = proxy
rm = proxy.modifiers.new("remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.006 if SIT else 0.0045  # the seated body is bigger: a denser proxy makes the heat solve fail
bpy.ops.object.modifier_apply(modifier=rm.name)
# keep the outer skin only: closed pockets inside (the seated scan's deep sculpted mouth) become separate inner
# shells that no bone can "see", and the heat solve then fails for every bone
pbm = bmesh.new()
pbm.from_mesh(proxy.data)
seen, shells = set(), []
for v0 in pbm.verts:
    if v0 in seen:
        continue
    seen.add(v0)
    members, stack = [v0], [v0]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            w = e.other_vert(v)
            if w not in seen:
                seen.add(w)
                members.append(w)
                stack.append(w)
    shells.append(members)
shells.sort(key=len, reverse=True)
bmesh.ops.delete(pbm, geom=[v for sh in shells[1:] for v in sh], context="VERTS")
pbm.to_mesh(proxy.data)
pbm.free()
print(f"proxy shells: {len(shells)} (kept the outer one, {len(shells[0])} verts)")
saved = {b.name: b.use_deform for b in arm.bones}

for b in arm.bones:
    b.use_deform = b.name in BODY_BONES
for o in bpy.context.scene.objects:
    o.select_set(o in (proxy, rig))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
for b in arm.bones:
    b.use_deform = saved[b.name]
col = {n: i for i, n in enumerate(BODY_BONES)}
pn = {g.index: g.name for g in proxy.vertex_groups}
PW = np.zeros((len(proxy.data.vertices), len(BODY_BONES)))
for v in proxy.data.vertices:
    for g in v.groups:
        if pn[g.group] in col:
            PW[v.index, col[pn[g.group]]] = g.weight
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
bpy.data.objects.remove(proxy)
print(f"heat weights: unweighted {int((W.sum(1) < 1e-6).sum())} of {len(co)} verts")
np.save(os.path.join(OUT_DIR, "heat_W.npy"), W)

edges = np.array([e.vertices[:] for e in me.edges])
vmat = np.zeros(len(co), int)
mat_of = {m.name: i for i, m in enumerate(me.materials)}
for p in me.polygons:
    vmat[list(p.vertices)] = p.material_index
is_tooth = np.zeros(len(co), bool)
is_feet = np.zeros(len(co), bool)
for p in me.polygons:  # any vertex touching such a face, so no face straddles two rigid parts
    if p.material_index == mat_of["Tooth"]:
        is_tooth[list(p.vertices)] = True
    if p.material_index == mat_of["Feet"]:
        is_feet[list(p.vertices)] = True


def ramp(v, a, b):
    return np.clip((v - a) / (b - a), 0, 1)


def to_bone(rows, k, name):
    """Move fraction k of these rows' weight onto one bone."""
    W[rows] *= (1 - k)[:, None]
    W[rows, col[name]] += k


def smooth_weights(n):
    global W
    deg = np.bincount(edges.ravel(), minlength=len(co)).astype(float)
    for _ in range(n):
        acc = np.zeros_like(W)
        np.add.at(acc, edges[:, 0], W[edges[:, 1]])
        np.add.at(acc, edges[:, 1], W[edges[:, 0]])
        W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)[:, None]


def smoothstep(v, a, b):
    t = ramp(v, a, b)
    return t * t * (3 - 2 * t)


is_coat = np.zeros(len(co), bool)
for p in me.polygons:
    if p.material_index == mat_of["Coat"]:
        is_coat[list(p.vertices)] = True
nrm = np.array([v.normal[:] for v in me.vertices])
ARM_BONES = ("upper_arm", "forearm")
LEG_BONES = () if SIT else ("thigh", "shin", "foot", "toe")
Z_CHEST, Z_SPINE = (-0.15, -0.26) if SIT else (-0.06, -0.15)
torso_receiver = np.where(z > Z_CHEST, col["chest"], np.where(z > Z_SPINE, col["spine"], col["hips"]))


def strip(rows, names, receiver):
    """Hand these bones' weight on `rows` to receiver (a bone column, or one per row)."""
    for n in names:
        np.add.at(W, (rows, receiver if np.ndim(receiver) == 0 else receiver[rows]), W[rows, col[n]])
        W[rows, col[n]] = 0


# Heat weights are soft: thigh weight reaches the shirt and coat, arm weight the coat panels beside the arm, so
# they crumple in big poses. Heat stays for the shoulders and torso; the limbs are weighted along their bones.
for s, sx in (("L", 1), ("R", -1)):  # nothing on one side follows the other side's limbs
    wrong = np.nonzero(sx * x < -0.02)[0]
    strip(wrong, [f"{p}.{s}" for p in ("shoulder",) + ARM_BONES], col["chest"])
    strip(wrong, [f"{p}.{s}" for p in LEG_BONES], col["hips"])

armish = np.zeros(len(co), bool)  # anything the arms own: the leg/skirt passes below must leave it alone
# sleeves: the surface around the arm chain that faces away from it (the coat panel beside the arm faces toward it)
for s, sx in (("L", 1), ("R", -1)):
    S_, E_, Wr = np.array(mx(SHOULDER, s)), np.array(mx(ELBOW, s)), np.array(cuffs[s]["centre"])
    L1 = np.linalg.norm(E_ - S_)
    t1 = ((co - S_) @ (E_ - S_)) / L1 ** 2
    c1 = S_ + np.clip(t1, 0, 1)[:, None] * (E_ - S_)
    t2 = ((co - E_) @ (Wr - E_)) / np.linalg.norm(Wr - E_) ** 2
    c2 = E_ + np.clip(t2, 0, 1)[:, None] * (Wr - E_)
    d1, d2 = np.linalg.norm(co - c1, axis=1), np.linalg.norm(co - c2, axis=1)
    c = np.where((d1 < d2)[:, None], c1, c2)
    d = np.minimum(d1, d2)
    facing = (nrm * (c - co)).sum(1) / np.maximum(d, 1e-9)
    # soft split (Tripo fused the underarm to the coat side, so a hard cut tears it): arm share from distance x
    # facing, keeping heat weights that already favour the arm, faded in from the shoulder joint
    # (seated: heat hands the knees under the forearms to the arm, so only the geometric test counts)
    a = np.zeros(len(co)) if SIT else W[:, [col[f"upper_arm.{s}"], col[f"forearm.{s}"]]].sum(1)
    target = ramp(-d, -0.10, -0.068) * ramp(-facing, -0.2, 0.3) * (sx * x > 0.05)
    target = np.where(a > 0.5, np.maximum(a, target), target)
    g = smoothstep(t1, -0.05, 0.35)
    share = np.clip(a + (target - a) * g, 0, 1) * ~is_tooth
    if SIT:  # the seated arms lift far from where they were scanned: spread the hand-over so the coat panel fused
        # to the sleeve lifts with it as fabric instead of tearing along a sharp line
        soft = ramp(-d, -0.13, -0.06) * ramp(-facing, -0.6, 0.45) * (sx * x > 0.04) * g * ~is_tooth
        share = np.maximum(share, soft)
        deg = np.bincount(edges.ravel(), minlength=len(co)).astype(float)
        for _ in range(12):
            acc = np.zeros(len(co))
            np.add.at(acc, edges[:, 0], share[edges[:, 1]])
            np.add.at(acc, edges[:, 1], share[edges[:, 0]])
            share = 0.5 * share + 0.5 * acc / np.maximum(deg, 1)
        share = np.where(d < 0.055, np.maximum(share, target), share)  # the sleeve itself stays whole
        # whatever lies inside the sleeve tube (the blue scrub sleeve, the cuff lining) faces the axis, so the facing
        # test leaves it on the torso and it pokes through once the sleeve lifts: it follows the arm too
        share = np.where(d < 0.045, np.maximum(share, g), share) * ~is_tooth
        share = np.where(np.linalg.norm(co - Wr, axis=1) < 0.065, 1.0, share)  # the smoothing diluted the cuff pin
        # each forearm rests just above its knee: the knee top (below the cuff line, facing up at the arm) stays put
        share[(z < -0.255) & (facing > 0.3)] = 0.0
    # the cuff (band, cap, inner lining) faces along or into the sleeve; nothing else is this close to the wrist
    share = np.where(np.linalg.norm(co - Wr, axis=1) < 0.065, 1.0, share)
    sleeve = share > 0.5
    fore = smoothstep(np.where(d1 < d2, t1 * L1 - L1, t2 * np.linalg.norm(Wr - E_)), -0.018, 0.018)
    side_rows = np.nonzero(sx * x > 0)[0]
    strip(side_rows, [f"{p}.{s}" for p in ARM_BONES], torso_receiver)  # arm weight only where computed below
    if SIT:  # the body has no sleeves left: nothing on it follows the arms (anywhere: heat leaks onto the chest)
        share = np.zeros(len(co))
        strip(np.arange(len(co)), [f"{p}.{s}" for p in ARM_BONES], torso_receiver)
    rows = np.nonzero(share > 1e-3)[0]
    armish[rows] = True
    W[rows] *= (1 - share[rows])[:, None]
    W[rows, col[f"upper_arm.{s}"]] += share[rows] * (1 - fore[rows])
    W[rows, col[f"forearm.{s}"]] += share[rows] * fore[rows]
    print(f"sleeve {s}: {int(sleeve.sum())} verts, fully on the arm {int((share > 0.99).sum())}")

if SIT:  # the crossed legs, the feet and the coat spread on the floor ride on the pelvis
    rows = np.nonzero(~armish & ~is_tooth)[0]
    to_bone(rows, ramp(-z[rows], 0.25, 0.30), "hips")
else:
    # legs (pants): height bands. Thigh fades in below the hip, shin below the knee; the two legs split evenly at x=0
    legs = (z < -0.19) & ~is_coat & ~is_tooth & ~armish
    rows = np.nonzero(legs)[0]
    t_leg = ramp(-z[rows], 0.19, 0.275)
    t_shin = smoothstep(-z[rows], -KNEE[2] - 0.022, -KNEE[2] + 0.022)
    W[rows] = 0
    W[rows, col["hips"]] = 1 - t_leg
    for s, sx in (("L", 1), ("R", -1)):
        side = smoothstep(sx * x[rows], -0.012, 0.012)
        W[rows, col[f"thigh.{s}"]] = t_leg * (1 - t_shin) * side
        W[rows, col[f"shin.{s}"]] = t_leg * t_shin * side
    print(f"leg verts: {len(rows)}")

    # coat skirt: rides on the pelvis, with a share of each thigh growing toward the hem, so it lifts with the legs
    skirt = is_coat & (z < -0.12) & (np.abs(x) < 0.21) & ~armish
    rows = np.nonzero(skirt)[0]
    strip(rows, [f"{p}.{s}" for s in "LR" for p in LEG_BONES], col["hips"])
    share = 0.45 * ramp(-z[rows], 0.15, 0.26)
    W[rows] *= (1 - share)[:, None]
    for s, sx in (("L", 1), ("R", -1)):
        W[rows, col[f"thigh.{s}"]] += share * smoothstep(sx * x[rows], -0.04, 0.04)
    # nothing else above the legs follows them
    rows = np.nonzero(~legs & ~skirt)[0]
    strip(rows, [f"{p}.{s}" for s in "LR" for p in LEG_BONES], col["hips"])
smooth_weights(4)

# rigid tooth head (the collar keeps its heat weights)
rows = np.nonzero(is_tooth)[0]
to_bone(rows, np.ones(len(rows)), "head")

# rigid shoes: foot, with the part in front of the ball on the toe
if not SIT:
    for s, sx in (("L", 1), ("R", -1)):
        rows = np.nonzero(is_feet & (sx * x > 0))[0]
        k_toe = ramp(-(y[rows] - BALL[1]), -0.008, 0.012)
        W[rows] = 0
        W[rows, col[f"foot.{s}"]] = 1 - k_toe
        W[rows, col[f"toe.{s}"]] = k_toe
        # the trouser hem resting on the shoe follows the foot a little, so a bent ankle doesn't uncover the shoe top
        hem = np.nonzero(~is_feet & (sx * x > 0) & (z < ANKLE[2] + 0.03))[0]
        to_bone(hem, 0.6 * ramp(-z[hem], -(ANKLE[2] + 0.03), -(ANKLE[2] + 0.005)), f"foot.{s}")
        print(f"shoe {s}: {len(rows)} verts rigid, hem {len(hem)} verts blended")

W[W < 0.01] = 0
fb = W.sum(1) < 1e-6
W[fb, col["chest"]] = 1
W /= W.sum(1, keepdims=True)
top = np.argsort(-W, 1)[:, 4:]  # glTF: 4 influences per vertex
np.put_along_axis(W, top, 0, 1)
W /= W.sum(1, keepdims=True)
print(f"body: fallback {int(fb.sum())} verts")
skin(body, {n: W[:, i] for i, n in enumerate(BODY_BONES)})


# ---------------------------------------------------------------- gloves: nearest finger segment, soft blend
for s in "LR":
    segs = [(n, np.array(h), np.array(t)) for n, h, t, _, _ in hand_bones[s]]
    G = np.array([v.co[:] for v in gloves[s].data.vertices])
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
    skin(gloves[s], {f"{n}.{s}": Wg[:, j] for j, (n, _, _) in enumerate(segs)})

# ---------------------------------------------------------------- seated sleeves: upper arm -> forearm round the elbow
for s, p in sleeves.items():
    V = np.array([v.co[:] for v in p["sleeve"].data.vertices])
    dd = np.linalg.norm(V[:, None, :] - p["path"][None, :, :], axis=2)
    sv = p["path_s"][dd.argmin(1)]
    fo = np.clip((sv - (p["s_el"] - 0.035)) / 0.07, 0, 1)
    fo = fo * fo * (3 - 2 * fo)
    skin(p["sleeve"], {f"upper_arm.{s}": 1 - fo, f"forearm.{s}": fo})
    skin(p["band"], {f"forearm.{s}": np.ones(len(p["band"].data.vertices))})

# ---------------------------------------------------------------- the seated head and the face parts ride on their bones
if head_obj:
    skin(head_obj, {"head": np.ones(len(head_obj.data.vertices))})
for key, (o, _, _) in face.items():
    skin(o, {("head" if key.startswith("Blush") else face_bone(key)): np.ones(len(o.data.vertices))})

bpy.context.scene["sink"] = F.SINK
out = os.path.join(OUT_DIR, "rig.blend")
bpy.ops.wm.save_as_mainfile(filepath=out)
print("saved", out)
