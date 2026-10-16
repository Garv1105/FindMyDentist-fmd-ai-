"""Procedural cartoon glove hand + its finger bones, for the seated mascot (the Meshy hands are fused blobs).

Canonical frame (the character's LEFT hand, T-pose palm down): fingers along +X, back of the hand +Z,
palm -Z, thumb toward -Y, wrist joint at the origin. build_hand() returns a mesh object in this frame
and a list of bones (name, head, tail, parent, roll_up); the caller transforms both to the wrist.
The right hand is the same hand mirrored in Y (thumb stays toward the body's front).
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

# (name, base y, splay deg, radius, phalanx lengths)
FINGERS = [  # chunky glove fingers, ~3 mm apart
    ("index", -0.0385, -4, 0.0122, (0.021, 0.015, 0.013)),
    ("middle", -0.0128, -1, 0.0126, (0.023, 0.016, 0.014)),
    ("ring", 0.0128, 2, 0.0121, (0.021, 0.015, 0.013)),
    ("pinky", 0.0380, 6, 0.0110, (0.017, 0.013, 0.011)),
]
KNUCKLE_X = 0.080
THUMB = dict(base=(0.020, -0.036, -0.010), dir=(0.60, -0.74, -0.30), radius=0.0138, lengths=(0.022, 0.020, 0.017))


def _capsule(name, a, b, r, coll):
    """A capsule a->b of radius r as a mesh object (cylinder + two end spheres, unioned later by voxel remesh)."""
    a, b = Vector(a), Vector(b)
    objs = []
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=d.length, location=(a + b) / 2)
    cyl = bpy.context.active_object
    cyl.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    objs.append(cyl)
    for p in (a, b):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=p)
        objs.append(bpy.context.active_object)
    return objs


def _ellipsoid(loc, size):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    return o


def build_hand(name="Hand"):
    parts = []
    # wrist (reaches 3.5 cm back into the sleeve cuff) and palm
    parts += _capsule("wrist", (-0.034, 0, 0), (0.004, 0, 0), 0.032, None)  # fills the sleeve cuff (r≈0.04)
    parts.append(_ellipsoid((0.046, 0.0, 0.0), (0.050, 0.051, 0.024)))  # one egg-shaped palm: no seam
    bones = [("hand", Vector((0, 0, 0)), Vector((KNUCKLE_X, 0, 0)), None, (0, 0, 1))]
    for fname, by, splay, r, lens in FINGERS:
        a = math.radians(splay)
        d = Vector((math.cos(a), math.sin(a), 0))
        p = Vector((KNUCKLE_X - 0.006, by, 0.002))
        parent = "hand"
        for k, L in enumerate(lens):
            q = p + d * L
            rr = r * (1 - 0.06 * k)
            parts += _capsule(f"{fname}{k}", p, q, rr, None)
            bones.append((f"{fname}_{k + 1:02d}", p.copy(), q.copy(), parent, (0, 0, 1)))
            parent = f"{fname}_{k + 1:02d}"
            p = q
    d = Vector(THUMB["dir"]).normalized()
    p = Vector(THUMB["base"])
    parent = "hand"
    for k, L in enumerate(THUMB["lengths"]):
        q = p + d * L
        rr = THUMB["radius"] * (1 - 0.05 * k)
        if k == 0:
            parts.append(_ellipsoid((p + q) / 2, (L * 0.7, rr * 1.15, rr * 1.0)))  # thumb pad on the palm
        parts += _capsule(f"thumb{k}", p, q, rr, None)
        bones.append((f"thumb_{k + 1:02d}", p.copy(), q.copy(), parent, (0, 0, 1)))
        parent = f"thumb_{k + 1:02d}"
        p = q
        d = (d + Vector((0.25, 0.1, 0.05))).normalized()  # the thumb curls gently toward the fingers

    for o in bpy.context.scene.objects:
        o.select_set(o in parts)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    hand = bpy.context.active_object
    hand.name = hand.data.name = name
    rem = hand.modifiers.new("remesh", "REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = 0.0016
    rem.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm = hand.modifiers.new("smooth", "LAPLACIANSMOOTH")
    sm.iterations = 22
    sm.lambda_factor = 0.6
    sm.use_volume_preserve = True
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dec = hand.modifiers.new("dec", "DECIMATE")
    dec.ratio = min(1.0, 7000 / max(1, len(hand.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.shade_smooth()
    return hand, bones
