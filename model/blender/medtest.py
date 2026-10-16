"""Render the meditate pose from several angles (pose from anim.meditate_pose).
blender -b rig.blend --python medtest.py -- <out_dir>
"""
import bpy, sys, os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from posing import reset  # noqa: E402
import medpose  # noqa: E402

out = sys.argv[sys.argv.index("--") + 1]

rig = bpy.data.objects["Rig"]
s = bpy.context.scene
if rig.animation_data:
    rig.animation_data.action = None
    for t in rig.animation_data.nla_tracks:
        t.mute = True
reset(rig)
import json
medpose.meditate_pose(rig, p={**medpose.P, **json.loads(os.environ.get("MED_P", "{}"))})
bpy.context.view_layer.update()

if os.environ.get("MED_DEBUG"):
    for name, col in (("Shoe", (1, 0, 0, 1)), ("Hand", (0, 0.8, 0, 1)), ("Coat", (0.75, 0.75, 0.7, 1))):
        bpy.data.materials[name].diffuse_color = col
s.render.engine = "BLENDER_WORKBENCH"
s.display.shading.light = "STUDIO"
s.display.shading.color_type = "MATERIAL"
s.render.resolution_x = s.render.resolution_y = 520
s.render.film_transparent = True
cd = bpy.data.cameras.new("c")
cd.type = "ORTHO"
cam = bpy.data.objects.new("c", cd)
s.collection.objects.link(cam)
s.camera = cam
for name, d, tgt, sc in (
    ("front", (0, -1, 0.12), (0, 0, -0.15), 1.0),
    ("q", (0.8, -1, 0.35), (0, 0, -0.15), 1.0),
    ("side", (1, 0, 0.05), (0, 0, -0.15), 1.0),
    ("legs", (0, -1, 0.45), (0, -0.05, -0.47), 0.55),
):
    cd.ortho_scale = sc
    t = Vector(tgt)
    cam.location = t + Vector(d).normalized() * 3
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.render.filepath = f"{out}/{name}.png"
    bpy.ops.render.render(write_still=True)
