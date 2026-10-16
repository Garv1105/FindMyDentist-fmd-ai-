"""Render test poses of the seated rig.  blender -b rig.blend --python posetest_sit.py -- <out_dir> [pose,...]"""
import bpy, sys, os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from pose_sit import *  # noqa

argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]
only = argv[1].split(",") if len(argv) > 1 else None
rig = bpy.data.objects["Rig"]
s = bpy.context.scene
s.render.engine = "BLENDER_WORKBENCH"
s.display.shading.light = "STUDIO"
s.display.shading.color_type = "MATERIAL"
s.render.resolution_x = s.render.resolution_y = 480
s.render.film_transparent = True
cd = bpy.data.cameras.new("c")
cd.type = "ORTHO"
cd.ortho_scale = 1.2
cam = bpy.data.objects.new("c", cd)
s.collection.objects.link(cam)
s.camera = cam
if os.environ.get("BEAUTY"):  # Cycles + the studio lights used for the reference comparisons
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = int(os.environ.get("BEAUTY"))
    s.cycles.use_denoising = True
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.86, 0.95, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    s.world = world
    for nm, loc, en, sz, colr in (("key", (1.6, -2.4, 2.2), 180, 1.6, (1, 1, 1)), ("fill", (-2.2, -1.6, 0.8), 70, 2.0, (0.85, 0.9, 1)),
                                  ("rim", (0.4, 2.5, 1.8), 120, 1.2, (0.8, 0.88, 1))):
        ld = bpy.data.lights.new(nm, "AREA")
        ld.energy, ld.size, ld.color = en, sz, colr
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0.05)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        s.collection.objects.link(lo)
    cd.type = "PERSP"
    cd.lens = 85
if os.environ.get("POSE_DEBUG"):
    for name, c in (("Glove", (0.1, 0.8, 0.2, 1)), ("Coat", (0.8, 0.8, 0.75, 1))):
        if name in bpy.data.materials:
            bpy.data.materials[name].diffuse_color = c

POSES = {}


def pose(fn):
    POSES[fn.__name__] = fn
    return fn


@pose
def rest():
    pass


@pose
def meditate():
    for sd in "LR":
        hand_shape(rig, sd, "mudra")
    eyes(rig, 0.0)


@pose
def wave():
    rot(rig, "shoulder.R", (Vector((0, 1, 0)), 10))
    arm(rig, "R", (0.8, -0.1, 0.55), (0.3, -0.2, 0.93))
    hand_dir(rig, "R", (0.1, -0.15, 0.98), (0.0, 1.0, 0.1))
    hand_shape(rig, "R", "wave")
    hand_shape(rig, "L", "relaxed")
    head(rig, yaw=-8, roll=-6)
    eyes(rig, 1.0)
    brows(rig, 1.0, 0.006)
    mouth(rig, 1.0)


@pose
def point():
    arm(rig, "L", (0.85, -0.2, 0.45), (0.9, -0.35, 0.25))
    hand_dir(rig, "L", (0.9, -0.38, 0.22), (0.0, 0.25, 1.0))
    hand_shape(rig, "L", "point")
    hand_shape(rig, "R", "relaxed")
    head(rig, yaw=22, pitch=4)
    eyes(rig, 1.0, (0.012, 0.004))
    brows(rig, 1.0, 0.004)
    mouth(rig, 1.0)


@pose
def present():
    arm(rig, "L", (0.65, -0.45, -0.6), (0.72, -0.68, 0.12))
    hand_dir(rig, "L", (0.85, -0.5, 0.15), (0.1, 0.1, -1.0))
    hand_shape(rig, "L", "open")
    head(rig, yaw=14, roll=5)
    eyes(rig, 1.0, (0.01, 0.0))
    mouth(rig, 0.0, 1.25)


@pose
def look_left():
    head(rig, yaw=-25, pitch=3)
    eyes(rig, 1.0, (-0.012, 0.003))
    brows(rig, 1.0, 0.0, 6)


@pose
def fists_up():
    for sd in "LR":
        arm(rig, sd, (0.7, -0.2, 0.68), (0.35, -0.25, 0.9))
        hand_dir(rig, sd, (0.2, -0.2, 0.96), (0.0, 1.0, 0.0))
        hand_shape(rig, sd, "fist")
    eyes(rig, 0.0)
    mouth(rig, 1.0)


import os as _os
views = (("front", Vector((0, -1, 0.06))), ("q", Vector((0.7, -1, 0.2))))
if _os.environ.get("POSE_VIEWS") == "zoomR":  # close-up of the character's right arm (viewer's left)
    cd.ortho_scale = 0.6
    views = (("zf", Vector((0, -1, 0.06))), ("zq", Vector((-0.8, -1, 0.15))), ("zb", Vector((-0.6, 0.6, 0.1))))
for name, fn in POSES.items():
    if only and name not in only:
        continue
    reset(rig)
    for b in rig.pose.bones:
        b.scale = (1, 1, 1)
    fn()
    bpy.context.view_layer.update()
    for vn, d in views:
        t = Vector((0, 0, -0.02)) if not _os.environ.get("POSE_VIEWS") else Vector((-0.2, -0.02, -0.02))
        cam.location = t + d.normalized() * (4 if cd.type == "ORTHO" else 2.6)
        cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
        s.render.filepath = f"{out}/{name}_{vn}.png"
        bpy.ops.render.render(write_still=True)
reset(rig)
