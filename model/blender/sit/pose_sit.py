"""Pose helpers for the seated mascot (see rig_sit.py for the skeleton).

World: character's left = +X, front = -Y, up = +Z. Arm/hand helpers take world directions, written for the
LEFT side and mirrored (x -> -x) for the right. Finger and face helpers work in bone-local space.
"""
import math
import os
import sys

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from posing import aim, move, orient, reset, rot, turn, twist  # noqa: E402,F401

FINGERS = ("index", "middle", "ring", "pinky")


def mir(v, s):
    return (v[0] if s == "L" else -v[0], v[1], v[2])


def sgn(s):
    return 1 if s == "L" else -1


def _local(rig, name, q):
    pb = rig.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = q
    return pb


def finger(rig, s, f, curl, spread=0.0):
    """curl: three joint angles in degrees toward the palm; spread: sideways at the knuckle (+ = toward pinky)."""
    for k, d in enumerate(curl):
        q = Quaternion((1, 0, 0), math.radians(-d))
        if k == 0 and spread:
            q = Quaternion((0, 0, 1), math.radians(spread * (1 if s == "L" else -1))) @ q
        _local(rig, f"{f}_{k + 1:02d}.{s}", q)


def thumb(rig, s, curl, across=0.0):
    """across: swing of the thumb's base over the palm (opposition)."""
    for k, d in enumerate(curl):
        q = Quaternion((1, 0, 0), math.radians(-d))
        if k == 0 and across:
            q = Quaternion((0, 1, 0), math.radians(across * (1 if s == "L" else -1))) @ q
        _local(rig, f"thumb_{k + 1:02d}.{s}", q)


HANDS = {
    "open": dict(f=(4, 4, 2), spread=(-3, -1, 1, 4), t=(0, 5, 0), ta=0),
    "relaxed": dict(f=(14, 18, 12), spread=(0, 0, 0, 0), t=(5, 12, 6), ta=5),
    "wave": dict(f=(2, 2, 0), spread=(-7, -2, 3, 9), t=(-5, 0, 0), ta=-8),
    "fist": dict(f=(80, 95, 70), spread=(0, 0, 0, 0), t=(25, 35, 25), ta=25),
    "point": dict(f=None, spread=(0, 0, 0, 0), t=(25, 40, 25), ta=30),
    "mudra": dict(f=None, spread=(0, 0, 0, 0), t=(18, 22, 18), ta=22),
}


def hand_shape(rig, s, name, k=1.0):
    h = HANDS[name]
    for i, f in enumerate(FINGERS):
        if name == "point":
            c = (0, 0, 0) if f == "index" else (80, 95, 70)
        elif name == "mudra":
            c = (42, 58, 48) if f == "index" else (12, 16, 10)
        else:
            c = h["f"]
        finger(rig, s, f, [a * k for a in c], h["spread"][i] * k)
    thumb(rig, s, [a * k for a in h["t"]], h["ta"] * k)


# ---------------------------------------------------------------- face (local: x = character's right, y = out, z = up)
def sink():
    return bpy.context.scene.get("sink", 0.024)


def eyes(rig, open_=1.0, look=(0.0, 0.0), squint=0.0):
    """open_: 1 open, 0 closed (happy ∪ lids); look: (viewer-right, up) in head units ~±0.012."""
    S = sink()
    for s in "LR":
        e = rig.pose.bones[f"eye.{s}"]
        lid = rig.pose.bones[f"lid.{s}"]
        if open_ > 0.12:
            e.scale = (1.0, 1.0, max(0.08, open_ * (1 - 0.35 * squint)))
            e.location = (-look[0], 0.0, look[1])
            lid.location = (0.0, 0.0, 0.0)
        else:
            e.scale = (1.0, 1.0, 0.08)
            e.location = (-look[0], -S, look[1])
            lid.location = (0.0, S * min(1.0, (0.12 - open_) / 0.06), 0.0)


def brows(rig, show=1.0, raise_=0.0, tilt=0.0):
    """tilt + = worried (inner ends up); raise in head units (~0.012)."""
    S = sink()
    for s in "LR":
        b = rig.pose.bones[f"brow.{s}"]
        b.location = (0.0, S * show, raise_)
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion((0, 1, 0), math.radians(tilt * sgn(s)))


def mouth(rig, open_=0.0, smile=1.0):
    """open_: 0 closed smile ∪, 1 open happy mouth; smile: scales the closed smile (1 = reference)."""
    S = sink()
    sm = rig.pose.bones["smile"]
    mo = rig.pose.bones["mouth"]
    sm.scale = (0.85 + 0.15 * smile, 1.0, smile)
    if open_ < 0.5:
        sm.location = (0.0, 0.0, 0.0)
        mo.location = (0.0, 0.0, 0.0)
        mo.scale = (1.0, 1.0, 1.0)
    else:
        sm.location = (0.0, -S, 0.0)
        mo.location = (0.0, S, 0.0)
        mo.scale = (0.85 + 0.15 * open_, 1.0, 0.5 + 0.5 * open_)


# ---------------------------------------------------------------- body
REST_HAND_BACK = {}


def hand_back_rest(rig, s):
    """World direction of the back of the hand in the bind pose (bone local Z)."""
    b = rig.data.bones[f"hand.{s}"]
    return (b.matrix_local.to_3x3() @ Vector((0, 0, 1))).normalized()


def hand_dir(rig, s, fwd, back):
    """Point the hand's fingers along fwd with the back of the hand toward `back` (world, LEFT-side values)."""
    orient(rig, f"hand.{s}", mir(fwd, s), mir(back, s), hand_back_rest(rig, s))


def arm(rig, s, upper, fore):
    aim(rig, f"upper_arm.{s}", mir(upper, s))
    aim(rig, f"forearm.{s}", mir(fore, s))


def head(rig, yaw=0.0, pitch=0.0, roll=0.0, neck_share=0.35):
    """yaw + = toward the viewer's right (character's left); pitch + = look up; roll + = tilt toward its left."""
    n = neck_share
    for b, k in (("neck", n), ("head", 1 - n)):
        rot(rig, b, (Vector((0, 0, 1)), yaw * k), (Vector((-1, 0, 0)), pitch * k), (Vector((0, 1, 0)), roll * k))


def breathe(rig, b):
    rot(rig, "spine", (Vector((-1, 0, 0)), 0.8 * b))
    rot(rig, "chest", (Vector((-1, 0, 0)), 1.6 * b))
