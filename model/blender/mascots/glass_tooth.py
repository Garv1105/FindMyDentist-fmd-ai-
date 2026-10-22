"""The Care Core tooth as clear glass with a glowing blue core (its artwork: care-core-v2, the owner's render).

blender -b --python glass_tooth.py -- <in.glb> <out.glb> [glow]

Tripo exported it as a blue chrome mirror (metallic 1, roughness 0), which renders dark navy. Glass on the page's dark
background is its edges catching the studio (Fresnel: silver-white at grazing angles, dark head-on, where you see the
background through it) and the light inside it. So:
  * a black, dielectric, clear-coated surface: all its brightness is reflection. MascotModel's GLASS studio surrounds it
    with a white dome and strip lights, and keys the canvas alpha to brightness like the artwork (dark = see-through);
  * emission: Tripo's blue texture (the artwork's inner glow, projected) kept to the crown and body by height, fading
    out down the roots (clear in the artwork). MascotModel also fades it towards the silhouette (seen through the core).
"""
import bpy, io, json, os, struct, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ARGS = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = ARGS[:2]
GLOW = float(ARGS[2]) if len(ARGS) > 2 else 0.7
BLUE = (0.16, 0.45, 1.0)          # sRGB, the artwork's electric blue


def smooth(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def glb_image(path, slot):
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    pbr = j["materials"][0]["pbrMetallicRoughness"]
    im = j["images"][j["textures"][pbr[slot]["index"]]["source"]]
    bv = j["bufferViews"][im["bufferView"]]
    o = 20 + n + 8 + bv.get("byteOffset", 0)
    return Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB")


def packed(name, arr):
    path = os.path.join(tempfile.mkdtemp(), name + ".png")
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)
    im = bpy.data.images.load(path)
    im.pack()
    return im


tex = np.asarray(glb_image(SRC, "baseColorTexture")).astype(np.float32) / 255
H, W = tex.shape[:2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.data.objects if o.type == "MESH")
me, Mw = obj.data, obj.matrix_world

# ---------------------------------------------------------------- where it glows: the crown and body, not the roots
zs = np.array([(Mw @ p.center).z for p in me.polygons])
z0, z1 = zs.min(), zs.max()
uv = me.uv_layers.active.data
mask = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask)
for p, z in zip(me.polygons, zs):
    h = (z - z0) / (z1 - z0)                      # 0 = root tips, 1 = crown top
    w = float(smooth(h, 0.3, 0.55))
    draw.polygon([(uv[li].uv[0] * W, (1 - uv[li].uv[1]) * H) for li in p.loop_indices], fill=int(w * 255))
# grown well past each UV island before softening, so island borders don't dim (they would show as seams)
mask = np.asarray(mask.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
# a saturated blue (kept below the tone mapper's white point so it stays blue), its light and dark from Tripo's texture
pattern = smooth(tex.max(-1, keepdims=True), 0.55, 0.95) ** 2
glow = np.array(BLUE, np.float32) * (0.03 + 0.97 * pattern) * mask[..., None]

# ---------------------------------------------------------------- the glass
mat = me.materials[0]
nt = mat.node_tree
p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
for s in ("Base Color", "Metallic", "Roughness"):
    for l in list(p.inputs[s].links):
        nt.links.remove(l)
p.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
em = nt.nodes.new("ShaderNodeTexImage")
em.image = packed("glass_glow", glow)
nt.links.new(em.outputs["Color"], p.inputs["Emission Color"])
p.inputs["Emission Strength"].default_value = GLOW
p.inputs["Metallic"].default_value = 0.0
p.inputs["Roughness"].default_value = 0.3
p.inputs["Coat Weight"].default_value = 1.0
p.inputs["Coat Roughness"].default_value = 0.1
nm = next((n for n in nt.nodes if n.type == "NORMAL_MAP"), None)
if nm:
    nt.links.new(nm.outputs["Normal"], p.inputs["Coat Normal"])
print(f"GLASS glow {GLOW}: crown/body mask covers {float((mask > 0.5).mean()):.0%} of the atlas")

for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO")
print("EXPORTED", OUT)
