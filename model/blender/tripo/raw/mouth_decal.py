"""A clean open smile for the hero mascot, as in the reference art: a "D" (gently curved top, round bottom), dark and
glossy inside, a pink tongue in its lower half.

The rigged head's own open mouth is a pocket cut into a remeshed surface, and its rim is jagged; it stays shut (its
skin lid in place) and this sits on the skin over it, laid onto the face by casting each vertex onto the head, and
skinned rigidly to the head bone so it turns with it. The thin closed-smile line it replaces is removed.
"""
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

W, H = 0.104, 0.06  # width, depth of the D (the reference: ~0.8 of an eye's width, height ~0.6 of its width)
TOP_SAG = 0.005  # the top edge dips this much at the middle: a smile, corners up
LIFT = 0.0015  # above the skin (the tongue sits a hair higher still)


def _outline(n=72):
    top = [(u, -TOP_SAG * (1 - (2 * u / W) ** 2)) for u in np.linspace(-W / 2, W / 2, n // 3)]
    bottom = [(W / 2 * np.cos(a), -H * np.sin(a) - 0.0) for a in np.linspace(0, np.pi, n)][1:-1]
    return top + bottom  # left corner → along the top → round the bottom, back toward the left


def _tongue(n=48):
    cx, cy, rx, ry = 0.0, -H * 0.72, W * 0.27, H * 0.24
    return [(cx + rx * np.cos(a), cy + ry * np.sin(a)) for a in np.linspace(0, 2 * np.pi, n, endpoint=False)]


def _material(name, rgb, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def _flat_mesh(name, pts2d, cuts):
    bm = bmesh.new()
    vs = [bm.verts.new((u, 0, v)) for u, v in pts2d]
    bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.y > 0:  # face the viewer (-Y): three.js draws front faces only
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    for _ in range(cuts):  # enough vertices to follow the face's curve
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def add(head, arm, centre_obj):
    """Lay the mouth on `head` at `centre_obj`'s centre (the old mouth's skin lid); skin it to arm's head bone."""
    def tree(o):
        return BVHTree.FromPolygons([o.matrix_world @ v.co for v in o.data.vertices], [p.vertices[:] for p in o.data.polygons])

    face, lid = tree(head), tree(centre_obj)
    c = np.array([tuple(centre_obj.matrix_world @ v.co) for v in centre_obj.data.vertices])
    cx, cz = (c[:, 0].min() + c[:, 0].max()) / 2, c[:, 2].max() + 0.004  # its top edge where the old mouth's top was
    parts = [("Mouth", _outline(), (0.23, 0.035, 0.06), 0.28, LIFT), ("Tongue", _tongue(), (0.98, 0.5, 0.56), 0.4, LIFT * 1.6)]
    meshes = [(_flat_mesh(name, pts, 3), name, rgb, rough, lift) for name, pts, rgb, rough, lift in parts]
    # laid on the smooth face, then brought forward evenly until clear of the old mouth's skin lid, which stands a
    # little proud and is bumpy: following it would crumple the mouth
    # the skin under each point: the face, or the lid where the face has the old mouth's hole (a ray through the hole
    # would find the pocket behind it)
    down = Vector((0, 1, 0))
    xs, zs, ys = [], [], []
    for me, *_ in meshes:
        for v in me.vertices:
            o = Vector((cx + v.co.x, -1.0, cz + v.co.z))
            f, l = face.ray_cast(o, down, 2.0)[0], lid.ray_cast(o, down, 2.0)[0]
            hit = l if (l and (not f or f.y - l.y > 0.0)) else f
            if hit:
                xs.append(o.x), zs.append(o.z), ys.append(hit.y)
    # one smooth (quadratic) surface through that skin, brought forward evenly until nothing pokes through it
    xs, zs, ys = map(np.array, (xs, zs, ys))
    A = np.stack([np.ones_like(xs), xs, zs, xs * xs, xs * zs, zs * zs], 1)
    coef = np.linalg.lstsq(A, ys, rcond=None)[0]
    proud = max(0.0, float((A @ coef - ys).max()))
    print(f"MOUTH skin fit: {len(ys)} points, {proud * 1000:.1f} mm brought forward")
    for me, name, rgb, rough, lift in meshes:
        for v in me.vertices:
            x, z = cx + v.co.x, cz + v.co.z
            v.co = Vector((x, float(np.array([1, x, z, x * x, x * z, z * z]) @ coef) - proud - lift, z))
        me.materials.append(_material(name, rgb, rough))
        for p in me.polygons:
            p.use_smooth = True
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = arm
        obj.matrix_parent_inverse = arm.matrix_world.inverted()
        obj.vertex_groups.new(name="head").add(range(len(me.vertices)), 1.0, "REPLACE")
        obj.modifiers.new("Armature", "ARMATURE").object = arm
        print(f"MOUTH {name}: {len(me.vertices)} verts at x {cx:.3f} z {cz:.3f}")
    smile = bpy.data.objects.get("Smile")
    if smile:
        bpy.data.objects.remove(smile)
