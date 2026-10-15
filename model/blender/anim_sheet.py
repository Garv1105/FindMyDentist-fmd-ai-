"""Contact sheet of keyframes per clip.  blender -b anim.blend --python anim_sheet.py -- <out_dir> [Clip,...]"""
import bpy, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]
only = argv[1].split(",") if len(argv) > 1 else None
rig = bpy.data.objects["Rig"]
s = bpy.context.scene
s.render.engine = "BLENDER_WORKBENCH"
s.display.shading.light = "STUDIO"
s.display.shading.color_type = "MATERIAL"
s.render.resolution_x = s.render.resolution_y = 360
s.render.film_transparent = True
cd = bpy.data.cameras.new("c")
cd.type = "ORTHO"
cd.ortho_scale = 1.3
cam = bpy.data.objects.new("c", cd)
s.collection.objects.link(cam)
s.camera = cam
t = Vector((0, 0, -0.0))
d = Vector((0.45, -1, 0.15)).normalized()
cam.location = t + d * 4
cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
for tr in rig.animation_data.nla_tracks:
    tr.mute = True
for act in bpy.data.actions:
    if only and act.name not in only:
        continue
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    a, b = int(act.frame_range[0]), int(act.frame_range[1])
    frames = sorted({a + round((b - a) * k / 5) for k in range(6)})
    for f in frames:
        s.frame_set(f)
        s.render.filepath = f"{out}/{act.name}_{f:03d}.png"
        bpy.ops.render.render(write_still=True)
