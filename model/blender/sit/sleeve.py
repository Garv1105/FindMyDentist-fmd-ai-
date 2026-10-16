"""Procedural lab-coat sleeve for the seated mascot: a smooth tube from a ball shoulder, through a rounded elbow,
to a flat cuff, plus the blue scrubs cuff band the glove comes out of (as in mascot.png)."""
import bpy
import numpy as np
from mathutils import Vector


def _sphere(c, r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=c)
    return bpy.context.active_object


def _cyl(a, b, r, verts=40):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return o


def _finish(objs, name, voxel, smooth_iter, target_faces):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = obj.data.name = name
    m = obj.modifiers.new("remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=m.name)
    sm = obj.modifiers.new("smooth", "LAPLACIANSMOOTH")
    sm.iterations = smooth_iter
    sm.lambda_factor = 0.6
    sm.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dec = obj.modifiers.new("dec", "DECIMATE")
    dec.ratio = min(1.0, target_faces / max(1, len(obj.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.shade_smooth()
    return obj


def build_sleeve(name, S, E, W, fwd, r_up=0.048, r_el=0.051, r_fo=0.050, r_cuff=0.055, cuff_len=0.030):
    """S shoulder pivot, E elbow, W wrist (cuff plane), fwd = cuff direction. Returns (mesh, path samples, s_elbow)."""
    S, E, W, fwd = Vector(S), Vector(E), Vector(W), Vector(fwd).normalized()
    C0 = W - fwd * cuff_len
    P1 = E + (S - E).normalized() * 0.05
    P2 = E + (C0 - E).normalized() * 0.05
    pts = []

    def line(a, b, step=0.007):
        n = max(2, int((b - a).length / step) + 1)
        return [a.lerp(b, i / (n - 1)) for i in range(n)]

    pts += line(S, P1)[:-1]
    for i in range(24):  # quadratic Bezier fillet at the elbow
        t = i / 23
        pts.append((1 - t) ** 2 * P1 + 2 * (1 - t) * t * E + t * t * P2)
    pts += line(P2, C0)[1:]
    s = np.concatenate([[0], np.cumsum([(b - a).length for a, b in zip(pts[:-1], pts[1:])])])
    s_el = s[int(np.argmin([(p - E).length for p in pts]))]
    total = s[-1]
    objs = []
    for p, si in zip(pts, s):
        if si <= s_el:
            r = r_up + (r_el - r_up) * (si / s_el) ** 2
        else:
            r = r_el + (r_fo - r_el) * (si - s_el) / max(total - s_el, 1e-6)
        objs.append(_sphere(p, r))
    objs.append(_cyl(C0 - fwd * 0.01, W, r_cuff))           # turned-back cuff, flat at the wrist
    objs.append(_cyl(C0 - fwd * 0.016, C0 - fwd * 0.004, r_fo + 0.002))  # soft step into the cuff
    sleeve = _finish(objs, name, 0.0024, 10, 9000)
    return sleeve, np.array([p[:] for p in pts]), s, s_el


def build_band(name, W, fwd, r=0.047, back=0.012, front=0.013):
    """Blue scrubs sleeve end peeking out of the coat cuff."""
    W, fwd = Vector(W), Vector(fwd).normalized()
    o = _cyl(W - fwd * back, W + fwd * front, r, verts=48)
    return _finish([o], name, 0.0016, 6, 2500)
