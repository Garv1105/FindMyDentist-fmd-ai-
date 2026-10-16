"""Face kit for the seated mascot: built on the head surface by ray casting from the front (-Y).

Placement (mesh units, symmetric about x=0) measured from mascot.png registered onto this mesh (closed-eye
arcs, smile, blush) and, for the open-eye parts, result.png scaled by its head size:
  eye centres x=±0.138 · closed-eye arc ∪: ends z=0.164, sag 0.030, half-width 0.054, stroke r 0.006 ·
  smile ∪: ends z=0.077, sag 0.015, half-width 0.0415 · open eye 0.080 x 0.094 oval · brows 0.085 above it ·
  open mouth 0.085 x 0.055 hanging from the smile line · blush ±0.200, z 0.104.
Hidden parts are built sunk SINK into the (opaque, rigid) head and shown by sliding their bone outward along
the face normal, so the rest pose shows the neutral open-eyed smiling face and every expression is plain
bone translation/scale in glTF (no zero scales, no morph targets).
"""
import math
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

EYE_X, EYE_Z = 0.138, 0.150
EYE_RX, EYE_RZ = 0.040, 0.047
LID_END_Z, LID_SAG, LID_HW = 0.164, 0.030, 0.054
BROW_DZ, BROW_DX = 0.085, 0.010
SMILE_END_Z, SMILE_SAG, SMILE_HW = 0.077, 0.015, 0.0415
MOUTH_TOP_Z, MOUTH_RX, MOUTH_RZ = 0.080, 0.0425, 0.0275
BLUSH_X, BLUSH_Z, BLUSH_RX, BLUSH_RZ = 0.200, 0.104, 0.040, 0.026
SINK = 0.024            # how far hidden parts sit inside the head
TUBE_LID, TUBE_BROW, TUBE_SMILE = 0.0062, 0.0056, 0.0056


class Surface:
    def __init__(self, obj):
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.transform(obj.matrix_world)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()

    def at(self, x, z):
        hit = self.bvh.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))
        n = hit[1] if hit[1].y < 0 else -hit[1]
        return hit[0], n.normalized()


def _mat(name, rgb, rough=0.3, coat=0.0, emit=0.0, alpha=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    lin = tuple((c / 255) ** 2.2 for c in rgb)
    p.inputs["Base Color"].default_value = (*lin, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.04
    if emit:
        p.inputs["Emission Color"].default_value = (*lin, 1)
        p.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*lin, 1)
    return m


def _image(name, rgba, path):
    from PIL import Image
    Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8)).save(path)
    img = bpy.data.images.load(path)
    img.pack()
    img.name = name
    return img


def eye_texture(path):
    """result.png eyes: glossy black, big white highlight upper-right, small one lower-left, faint cool rim."""
    S = 512
    yy, xx = np.mgrid[0:S, 0:S]
    u, v = (xx + 0.5) / S, 1 - (yy + 0.5) / S
    du, dv = (u - 0.5) / 0.5, (v - 0.5) / 0.5
    r = np.sqrt(du ** 2 + dv ** 2)
    col = np.zeros((S, S, 4))
    col[..., 3] = 1
    base = np.array([0.035, 0.035, 0.055])
    col[..., :3] = base * (1 - 0.5 * np.clip((r - 0.7) / 0.3, 0, 1))[..., None]
    col[..., :3] += (np.clip((-dv - 0.25) / 0.75, 0, 1) ** 2 * np.clip((r - 0.5) / 0.4, 0, 1))[..., None] * [0.06, 0.07, 0.12]
    for cu, cv, rad in ((0.64, 0.70, 0.135), (0.36, 0.32, 0.05)):
        hl = np.clip((rad - np.sqrt((u - cu) ** 2 + (v - cv) ** 2)) / 0.012, 0, 1)
        col[..., :3] = col[..., :3] * (1 - hl[..., None]) + hl[..., None] * [0.98, 0.98, 1.0]
    return col


def blush_texture(path):
    S = 256
    yy, xx = np.mgrid[0:S, 0:S]
    r = np.sqrt(((xx + 0.5) / S - 0.5) ** 2 + ((yy + 0.5) / S - 0.5) ** 2) / 0.5
    col = np.zeros((S, S, 4))
    col[..., :3] = [1.0, 0.55, 0.6]
    col[..., 3] = 0.55 * np.clip(1 - r, 0, 1) ** 1.6
    return col


def _new_obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    return o


def disc_on_surface(name, surf, cx, cz, rx, rz, lift, mat, dome=0.0, rings=14, segs=64, outline=None):
    """A UV-mapped elliptical disc (or dome) hugging the surface. outline(theta) -> radius factor for D shapes."""
    _, n0 = surf.at(cx, cz)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    center_hit, _ = surf.at(cx, cz)
    c = bm.verts.new(center_hit + n0 * (lift + dome))
    rings_v, rings_uv = [], []
    for i in range(1, rings + 1):
        t = i / rings
        ring, ruv = [], []
        for j in range(segs):
            th = 2 * math.pi * j / segs
            f = outline(th) if outline else 1.0
            lx, lz = rx * t * f * math.cos(th), rz * t * f * math.sin(th)
            hit, _ = surf.at(cx + lx, cz + lz)
            h = lift + dome * (1 - t * t) ** 0.5
            ring.append(bm.verts.new(hit + n0 * h))
            ruv.append((0.5 + 0.5 * t * f * math.cos(th), 0.5 + 0.5 * t * f * math.sin(th)))
        rings_v.append(ring)
        rings_uv.append(ruv)
    if dome:  # skirt tucked into the head so the edge never shows a gap
        ring = []
        for j in range(segs):
            hit, _ = surf.at(cx + rx * math.cos(2 * math.pi * j / segs), cz + rz * math.sin(2 * math.pi * j / segs))
            ring.append(bm.verts.new(hit - n0 * 0.003))
        rings_v.append(ring)
        rings_uv.append(rings_uv[-1])
    for j in range(segs):
        k = (j + 1) % segs
        f = bm.faces.new((c, rings_v[0][j], rings_v[0][k]))
        for loop, val in zip(f.loops, ((0.5, 0.5), rings_uv[0][j], rings_uv[0][k])):
            loop[uv].uv = val
    for i in range(len(rings_v) - 1):
        for j in range(segs):
            k = (j + 1) % segs
            f = bm.faces.new((rings_v[i][j], rings_v[i + 1][j], rings_v[i + 1][k], rings_v[i][k]))
            for loop, val in zip(f.loops, (rings_uv[i][j], rings_uv[i + 1][j], rings_uv[i + 1][k], rings_uv[i][k])):
                loop[uv].uv = val
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _new_obj(name, bm, mat)


def tube_on_surface(name, surf, xz_points, radius, mat, lift=0.0015, sink=0.0):
    """Round-capped tube hugging the face along (x, z) points; sink pushes it into the head (hidden at rest)."""
    pts = []
    for x, z in xz_points:
        hit, n = surf.at(x, z)
        pts.append(hit + n * (lift - sink))
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (q.x, q.y, q.z, 1)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    caps = []
    for end in (pts[0], pts[-1]):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=16, ring_count=8, location=end)
        caps.append(bpy.context.active_object)
    for o in bpy.context.scene.objects:
        o.select_set(o == obj or o in caps)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def arc(cx, end_z, half_w, sag, n=28):
    """∪ parabola: ends at end_z, centre end_z - sag."""
    return [(cx + x, end_z - sag * (1 - (x / half_w) ** 2)) for x in np.linspace(-half_w, half_w, n)]


def build(head_obj, tmpdir):
    """Create all face parts; returns {name: (object, anchor point, outward normal)}."""
    surf = Surface(head_obj)
    eye_img = _image("EyeTex", eye_texture(None), f"{tmpdir}/eye_sit.png")
    blush_img = _image("BlushTex", blush_texture(None), f"{tmpdir}/blush.png")

    def tex_mat(name, img, rough, coat, blend=False, emit=0.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        p = nt.nodes["Principled BSDF"]
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = img
        nt.links.new(tx.outputs["Color"], p.inputs["Base Color"])
        if emit:
            nt.links.new(tx.outputs["Color"], p.inputs["Emission Color"])
            p.inputs["Emission Strength"].default_value = emit
        p.inputs["Roughness"].default_value = rough
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.03
        if blend:
            nt.links.new(tx.outputs["Alpha"], p.inputs["Alpha"])
            m.surface_render_method = "BLENDED"
        m.diffuse_color = (0.02, 0.02, 0.04, 1) if not blend else (1, 0.6, 0.65, 0.4)
        return m

    eye_mat = tex_mat("Eye", eye_img, 0.12, 0.6, emit=0.25)
    blush_mat = tex_mat("Blush", blush_img, 0.6, 0.0, blend=True)
    ink = _mat("Ink", (18, 18, 28), rough=0.25, coat=0.4)
    mouth_mat = _mat("MouthInside", (70, 16, 26), rough=0.45)
    tongue_mat = _mat("Tongue", (236, 128, 142), rough=0.4)

    def sunk(o, n, depth=SINK):
        o.data.transform(Matrix.Translation(-n * depth))
        o.data.update()
        return o

    parts = {}
    for s, sx in (("L", 1), ("R", -1)):
        cx = sx * EYE_X
        o = disc_on_surface(f"Eye.{s}", surf, cx, EYE_Z, EYE_RX, EYE_RZ, 0.0006, eye_mat, dome=0.010)
        hit, n = surf.at(cx, EYE_Z)
        parts[f"Eye.{s}"] = (o, hit, n)
        o = tube_on_surface(f"Lid.{s}", surf, arc(cx, LID_END_Z, LID_HW, LID_SAG), TUBE_LID, ink)
        hit, n = surf.at(cx, LID_END_Z - LID_SAG)
        parts[f"Lid.{s}"] = (sunk(o, n), hit, n)
        bx, bz = cx + sx * BROW_DX, EYE_Z + BROW_DZ
        brow_pts = [(bx + x, bz - 0.010 * (x / 0.036) ** 2) for x in np.linspace(-0.036, 0.036, 22)]
        o = tube_on_surface(f"Brow.{s}", surf, brow_pts, TUBE_BROW, ink)
        hit, n = surf.at(bx, bz)
        parts[f"Brow.{s}"] = (sunk(o, n), hit, n)
        o = disc_on_surface(f"Blush.{s}", surf, sx * BLUSH_X, BLUSH_Z, BLUSH_RX, BLUSH_RZ, 0.0012, blush_mat)
        hit, n = surf.at(sx * BLUSH_X, BLUSH_Z)
        parts[f"Blush.{s}"] = (o, hit, n)

    smile = tube_on_surface("Smile", surf, arc(0.0, SMILE_END_Z, SMILE_HW, SMILE_SAG), TUBE_SMILE, ink)
    hit, n = surf.at(0.0, SMILE_END_Z - SMILE_SAG)
    parts["Smile"] = (smile, hit, n)

    # open mouth (result.png): a "D" - fairly flat smiling top edge, round bottom - with the tongue low inside
    mz = MOUTH_TOP_Z - MOUTH_RZ * 0.62

    def d_outline(th):
        s_ = math.sin(th)
        return 1.0 if s_ < 0 else 1.0 - 0.38 * s_  # upper half flattened toward the smile line
    mouth = disc_on_surface("MouthOpen", surf, 0.0, mz, MOUTH_RX, MOUTH_RZ, 0.0009, mouth_mat, outline=d_outline)
    tongue = disc_on_surface("Tongue", surf, 0.0, mz - MOUTH_RZ * 0.42, MOUTH_RX * 0.55, MOUTH_RZ * 0.42, 0.0017,
                             tongue_mat)
    for o in bpy.context.scene.objects:
        o.select_set(o in (mouth, tongue))
    bpy.context.view_layer.objects.active = mouth
    bpy.ops.object.join()
    mouth = bpy.context.view_layer.objects.active
    mouth.name = mouth.data.name = "MouthOpen"
    hit, n = surf.at(0.0, mz)
    parts["MouthOpen"] = (sunk(mouth, n), hit, n)
    return parts
