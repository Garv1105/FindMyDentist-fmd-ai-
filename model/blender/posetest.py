"""Render static test poses to check skinning.  blender -b rig.blend --python posetest.py -- <out_dir>"""
import bpy, sys, os, math
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from posing import *  # noqa

out = sys.argv[sys.argv.index("--") + 1]
rig = bpy.data.objects["Rig"]
s = bpy.context.scene
s.render.engine = "BLENDER_WORKBENCH"
s.display.shading.light = "STUDIO"
s.display.shading.color_type = "MATERIAL"
s.render.resolution_x = s.render.resolution_y = 480
s.render.film_transparent = True
cd = bpy.data.cameras.new("c")
cd.type = "ORTHO"
cd.ortho_scale = 1.25
cam = bpy.data.objects.new("c", cd)
s.collection.objects.link(cam)
s.camera = cam


def shoot(name, views=(("front", Vector((0, -1, 0.05))), ("q", Vector((0.8, -1, 0.25))))):
    bpy.context.view_layer.update()
    for vn, d in views:
        t = Vector((0, 0, -0.02))
        cam.location = t + d.normalized() * 4
        cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
        s.render.filepath = f"{out}/{name}_{vn}.png"
        bpy.ops.render.render(write_still=True)


POSES = {}


def pose(fn):
    POSES[fn.__name__] = fn
    return fn


@pose
def arms_up():
    for sd in "LR":
        rot(rig, f"upper_arm.{sd}", (raise_side(sd), 100))
        rot(rig, f"forearm.{sd}", (raise_side(sd), 20))


@pose
def wave():
    rot(rig, "shoulder.R", (raise_side("R"), 10))
    rot(rig, "upper_arm.R", (raise_side("R"), 55), (bring_forward(), 20))
    rot(rig, "forearm.R", (raise_side("R"), 55))
    rot(rig, "hand.R", (raise_side("R"), 10))
    rot(rig, "head", (Y, -8))


@pose
def point():
    rot(rig, "upper_arm.L", (raise_side("L"), 50), (bring_forward(), 25))
    rot(rig, "forearm.L", (raise_side("L"), 10))
    rot(rig, "head", (Z, 25))


@pose
def step():
    rot(rig, "thigh.L", (bring_forward(), 35))
    rot(rig, "shin.L", (bring_forward(), -30))
    rot(rig, "thigh.R", (bring_forward(), -25))
    rot(rig, "shin.R", (bring_forward(), -25))
    rot(rig, "upper_arm.L", (bring_forward(), -25))
    rot(rig, "upper_arm.R", (bring_forward(), 25))


@pose
def head_turn():
    rot(rig, "head", (Z, 30), (Y, 12))
    rot(rig, "chest", (Z, 8))


@pose
def meditate():
    move(rig, "root", (0, 0, -0.17))
    for sd in "LR":
        sg = side_sign(sd)
        aim(rig, f"thigh.{sd}", (sg * 0.8, -0.55, -0.12))
        top = sd == "L"  # left shin crosses in front/on top
        aim(rig, f"shin.{sd}", (-sg * 0.92, -0.38 if top else -0.25, 0.06 if top else -0.04))
        aim(rig, f"foot.{sd}", (-sg * 0.7, -0.2, -0.5))
        aim(rig, f"upper_arm.{sd}", (sg * 0.5, -0.12, -0.86))
        aim(rig, f"forearm.{sd}", (sg * 0.85, -0.45, 0.08))
        aim(rig, f"hand.{sd}", (sg * 0.9, -0.3, 0.2))
        twist(rig, f"forearm.{sd}", -sg * 70)
    eyes_closed(rig, 1.0)


for name, fn in POSES.items():
    reset(rig)
    fn()
    shoot(name)
reset(rig)
