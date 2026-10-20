"""Stress-test the standing rig: render a contact sheet of extreme poses (front + three-quarter view each).

blender -b rig.blend --python posetest_tripo.py -- <out.png> [pose names...]
"""
import bpy, sys, os, math, tempfile
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from posing import aim, bring_forward, move, reset, rot, twist  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT, ONLY = args[0], args[1:]
rig = bpy.data.objects["Rig"]
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def legs(s, thigh, knee, foot=0.0, spread=0.0):
    """thigh: forward swing (deg), knee: bend (deg, + folds the shin back), foot: toes up (deg)."""
    sx = 1 if s == "L" else -1
    rot(rig, f"thigh.{s}", (bring_forward(), thigh), (Y, -sx * spread))
    rot(rig, f"shin.{s}", (bring_forward(), -knee))
    rot(rig, f"foot.{s}", (bring_forward(), foot))


POSES = {
    "rest": lambda: None,
    "t_pose": lambda: [aim(rig, f"upper_arm.{s}", (sx, 0, 0)) or aim(rig, f"forearm.{s}", (sx, 0, 0))
                       for s, sx in (("L", 1), ("R", -1))],
    "arms_up": lambda: [aim(rig, f"upper_arm.{s}", (0.35 * sx, 0, 1)) or aim(rig, f"forearm.{s}", (0.2 * sx, 0, 1))
                        for s, sx in (("L", 1), ("R", -1))],
    "walk": lambda: (legs("L", 30, 5, -10), legs("R", -20, 35, 10), rot(rig, "chest", (Z, 6)),
                     aim(rig, "upper_arm.L", (0.3, 0.45, -0.85)), aim(rig, "upper_arm.R", (-0.3, -0.5, -0.8))),
    "run": lambda: (move(rig, "root", (0, 0, -0.02)), legs("L", 60, 95, 0), legs("R", -35, 70, 20),
                    rot(rig, "spine", (X, -10)),
                    aim(rig, "upper_arm.L", (0.25, 0.7, -0.6)), aim(rig, "forearm.L", (0.2, -0.3, 0.9)),
                    aim(rig, "upper_arm.R", (-0.25, -0.7, -0.6)), aim(rig, "forearm.R", (-0.2, -0.95, 0.1))),
    "sit": lambda: (move(rig, "root", (0, 0, -0.07)), legs("L", 90, 90, 0, 4), legs("R", 90, 90, 0, 4)),
    "crouch": lambda: (move(rig, "root", (0, 0, -0.06)), legs("L", 60, 110, 50), legs("R", 60, 110, 50),
                       rot(rig, "spine", (X, -20))),
    "kick": lambda: (legs("L", 75, 0, -15), legs("R", -5, 5, 0), rot(rig, "spine", (X, 8))),
    "twist_bend": lambda: (rot(rig, "spine", (X, -18), (Z, 15)), rot(rig, "chest", (X, -12), (Z, 15)),
                           rot(rig, "neck", (Z, 15)), rot(rig, "head", (Z, 20), (X, 6))),
    "wave": lambda: (aim(rig, "upper_arm.R", (-0.93, -0.22, 0.22)), aim(rig, "forearm.R", (-0.25, -0.2, 0.95)),
                     twist(rig, "forearm.R", 60),
                     aim(rig, "upper_arm.L", (0.7, -0.6, -0.3)), aim(rig, "forearm.L", (0.2, -0.95, 0.1)),
                     rot(rig, "head", (Y, -8), (Z, -10))),
    "fly": lambda: [aim(rig, f"upper_arm.{s}", (0.96 * sx, -0.05, -0.26)) or aim(rig, f"forearm.{s}", (0.97 * sx, -0.18, -0.12))
                    for s, sx in (("L", 1), ("R", -1))],
    "type": lambda: [aim(rig, f"upper_arm.{s}", (0.25 * sx, -0.45, -0.86)) or aim(rig, f"forearm.{s}", (-0.15 * sx, -0.98, -0.12))
                     for s, sx in (("L", 1), ("R", -1))],
    "hug": lambda: [aim(rig, f"upper_arm.{s}", (0.45 * sx, -0.88, 0.0)) or aim(rig, f"forearm.{s}", (-0.6 * sx, -0.8, 0.0))
                    for s, sx in (("L", 1), ("R", -1))],
}

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_specular_highlight = True
RES = int(os.environ.get("RES", 380))
sc.render.resolution_x = sc.render.resolution_y = RES
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = float(os.environ.get("ORTHO", 1.2))
CZ = float(os.environ.get("CZ", -0.02))
tmp = tempfile.mkdtemp()
shots = []
for name, fn in POSES.items():
    if ONLY and name not in ONLY:
        continue
    reset(rig)
    bpy.context.view_layer.update()
    try:
        fn()
    except KeyError:  # the seated rig has no leg bones
        continue
    bpy.context.view_layer.update()
    for view, ang in (("f", 0), ("q", 50)):
        a = math.radians(ang)
        cam.location = (3 * math.sin(a), -3 * math.cos(a), CZ)
        cam.rotation_euler = (math.radians(90), 0, a)
        sc.render.filepath = f"{tmp}/{name}_{view}.png"
        bpy.ops.render.render(write_still=True)
        shots.append((name, sc.render.filepath))

from PIL import Image, ImageDraw  # noqa: E402
cols = 4
rows = math.ceil(len(shots) / cols)
sheet = Image.new("RGB", (cols * RES, rows * RES), (20, 20, 20))
for i, (name, path) in enumerate(shots):
    im = Image.open(path).convert("RGB")
    ImageDraw.Draw(im).text((6, 6), name, fill=(255, 220, 90))
    sheet.paste(im, ((i % cols) * RES, (i // cols) * RES))
sheet.save(OUT)
print("sheet", OUT, len(shots))
