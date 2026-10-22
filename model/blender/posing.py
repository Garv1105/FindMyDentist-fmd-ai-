"""Pose helpers: rotations given in armature (world) space, character faces -Y, left = +X."""
import math
import bpy
from mathutils import Quaternion, Vector

FWD, BACK, UP, DOWN = Vector((0, -1, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), Vector((0, 0, -1))
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def side_sign(side):
    return 1 if side == "L" else -1


def rot(rig, bone, *turns):
    """turns: (axis, degrees) applied in order, axes in armature rest space."""
    pb = rig.pose.bones[bone]
    R = Quaternion()
    for axis, deg in turns:
        R = Quaternion(Vector(axis).normalized(), math.radians(deg)) @ R
    B = pb.bone.matrix_local.to_quaternion()
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = B.inverted() @ R @ B
    return pb


# anatomical shorthands (positive = the natural direction for that side)
def raise_side(side):      # arm/forearm up and out in the frontal plane
    return Vector((0, -side_sign(side), 0))


def bring_forward():       # arm / thigh swings to the front
    return Vector((-1, 0, 0))


def roll_in(side):         # twist about the limb pointing outward
    return Vector((side_sign(side), 0, 0))


def move(rig, bone, offset):
    """Translate a bone by a world-space offset (root/hips)."""
    pb = rig.pose.bones[bone]
    B = pb.bone.matrix_local.to_3x3()
    pb.location = B.inverted() @ Vector(offset)
    return pb


def scale(rig, bone, s):
    pb = rig.pose.bones[bone]
    pb.scale = s
    return pb


def _apply_world(rig, bone, R):
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    M = pb.matrix.copy()
    t = M.translation.copy()
    M = R.to_matrix().to_4x4() @ M
    M.translation = t
    pb.matrix = M
    bpy.context.view_layer.update()
    return pb


def aim(rig, bone, target):
    """Point a bone (head->tail) along a world direction, given its parents' current pose."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    R = (pb.tail - pb.head).normalized().rotation_difference(Vector(target).normalized())
    return _apply_world(rig, bone, R)


def turn(rig, bone, axis, deg):
    """Extra world-space rotation about the bone's head, on top of its current pose."""
    return _apply_world(rig, bone, Quaternion(Vector(axis).normalized(), math.radians(deg)))


def orient(rig, bone, fwd, up, rest_up=(0, 0, 1)):
    """Point a bone along `fwd` (world) AND roll it so the side that faced `rest_up` at rest now faces `up`."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    rest = pb.bone.matrix_local
    d0 = (rest.to_3x3() @ Vector((0, 1, 0))).normalized()

    def frame(d, u):
        d = Vector(d).normalized()
        u = (Vector(u) - Vector(u).dot(d) * d).normalized()
        from mathutils import Matrix
        return Matrix((d, u, d.cross(u))).transposed()

    R = frame(fwd, up) @ frame(d0, rest_up).transposed()
    M = (R @ rest.to_3x3()).to_4x4()
    M.translation = pb.matrix.translation
    pb.matrix = M
    bpy.context.view_layer.update()
    return pb


def twist(rig, bone, deg):
    """Spin a bone about its own (posed) length axis."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    return _apply_world(rig, bone, Quaternion((pb.tail - pb.head).normalized(), math.radians(deg)))


def eyes_closed(rig, c, depth=None):
    """0 = open, 1 = closed (eye domes shrink into the head, closed-eye arcs slide out)."""
    depth = depth if depth is not None else bpy.context.scene.get("lid_depth", 0.02)
    sz = max(0.001, 1 - c) if c < 0.85 else 0.001
    for s in "LR":
        rig.pose.bones[f"eye.{s}"].scale = (1, 1, sz) if c < 0.85 else (0.001, 0.001, 0.001)
        k = min(1, max(0, (c - 0.75) / 0.25))
        move(rig, f"lid.{s}", (0, -depth * k, 0))


def reset(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("scale", frame=frame)
