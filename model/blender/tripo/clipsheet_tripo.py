"""Contact sheet of animation clips: N evenly spaced frames per clip, one row per clip.

blender -b anim.blend --python clipsheet_tripo.py -- <out.png> <frames per clip> <clip names...>
Env: RES (px per cell, default 260), VIEW (deg around Z, default 25).
"""
import bpy, sys, os, math, tempfile
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUT, N, NAMES = args[0], int(args[1]), args[2:]
RES = int(os.environ.get("RES", 260))
rig = bpy.data.objects["Rig"]
for t in rig.animation_data.nla_tracks:
    t.mute = True
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_specular_highlight = True
sc.render.resolution_x = sc.render.resolution_y = RES
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = float(os.environ.get("ORTHO", 1.3))
a = math.radians(float(os.environ.get("VIEW", 25)))
cam.location = (3 * math.sin(a), -3 * math.cos(a), float(os.environ.get("CZ", 0.0)))
cam.rotation_euler = (math.radians(90), 0, a)
tmp = tempfile.mkdtemp()
from PIL import Image, ImageDraw  # noqa: E402
sheet = Image.new("RGB", (N * RES, len(NAMES) * RES), (18, 18, 24))
for r, name in enumerate(NAMES):
    act = bpy.data.actions[name]
    rig.animation_data.action = act
    f0, f1 = act.frame_range
    for c in range(N):
        f = round(f0 + (f1 - f0) * c / max(1, N - 1))
        sc.frame_set(f)
        sc.render.filepath = f"{tmp}/{name}_{c}.png"
        bpy.ops.render.render(write_still=True)
        im = Image.open(sc.render.filepath).convert("RGB")
        ImageDraw.Draw(im).text((4, 4), f"{name} {f}", fill=(255, 220, 90))
        sheet.paste(im, (c * RES, r * RES))
sheet.save(OUT)
print("sheet", OUT)
