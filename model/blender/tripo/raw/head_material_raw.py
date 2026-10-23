"""The raw head as meditate.png's porcelain: its own material, pure white, glossy, clear-coated.

blender -b --python head_material_raw.py -- <in.glb> <out.glb> [--neck Z] [--largest] [--keep-normal]

meditate.png's head is pure white everywhere (brightness never below ~0.85), glossy, its colour coming from the lights
(cool sky-blue from the left, warm white from the right, lavender underneath; the hero's lights do that). Here:
  * the head's faces (above the neck) get their own material "Head": white texture, roughness HEAD_ROUGH, a clear coat,
    no normal map (Tripo's still carries the sculpted seam, and the porcelain should be smooth);
  * the base-colour texture is whitened inside the head's UV islands: Tripo painted the head off-white (~0.97, faintly
    warm). Near-white texels go pure white; the dark eyes and brows, the red mouth and the pink blush keep their colour.
Options, for the low-poly standing section mascots (model/blender/mascots/build_porcelain.sh; defaults = the hero):
  --neck Z        world z of the head's underside (default -0.012: the hero, centred on the origin)
  --largest       only the largest connected piece above the neck (a raised hand reaches head height)
  --keep-normal   keep the normal map, on the base and on the clear coat: on a low-poly mesh it is what makes it smooth
  --relative-tint the blush is what is pinker than the head's own (median) tint, for heads painted tinted all over
  --matte-mouth   no clear coat on the red mouth/tongue, and satin (roughness 0.55): it keeps its red
  --dark-eyes     (with --matte-mouth) no clear coat on the dark eyes and brows either: black, not grey chrome
  --single-sided  like the original material (a new Blender material exports double-sided)
  --black-suit    the butler: its plum-purple suit texels darkened and desaturated to the artwork's near-black
  --eye-glints    paint the white highlight into eyes whose texture has none
  --deep-blue     the pin: the strongly blue texels on the head piece (its location marker) taken to the artwork's cobalt
"""
import bpy, io, json, os, struct, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ARGS = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = ARGS[:2]
NECK_Z = float(ARGS[ARGS.index("--neck") + 1]) if "--neck" in ARGS else -0.012
HEAD_ROUGH, COAT, COAT_ROUGH = 0.24, 1.0, 0.06


def glb_base_color(path):
    """The base-colour texture of the first material, decoded from the GLB."""
    b = open(path, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    b0 = 20 + n + 8
    ti = j["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    im = j["images"][j["textures"][ti]["source"]]
    bv = j["bufferViews"][im["bufferView"]]
    o = b0 + bv.get("byteOffset", 0)
    return Image.open(io.BytesIO(b[o:o + bv["byteLength"]])).convert("RGB")


def smooth(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


tex = glb_base_color(SRC)
W, H = tex.size
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.data.objects if o.type == "MESH")
me, Mw = obj.data, obj.matrix_world
body = me.materials[0]

# ---------------------------------------------------------------- the head's faces and their UV islands
uv = me.uv_layers.active.data
mask = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask)
head = [p for p in me.polygons if (Mw @ p.center).z > NECK_Z]
if "--largest" in ARGS:  # faces sharing a vertex position are connected (UV seams split vertices)
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    key = {}
    vid = [key.setdefault(tuple(round(c, 6) for c in v.co), len(key)) for v in me.vertices]
    r = [i for i, p in enumerate(head) for _ in p.vertices]
    c = [vid[v] for p in head for v in p.vertices]
    FV = coo_matrix((np.ones(len(r)), (r, c)), shape=(len(head), len(key))).tocsr()
    _, lab = connected_components(FV @ FV.T, directed=False)
    head = [p for p, l in zip(head, lab) if l == np.argmax(np.bincount(lab))]
for p in head:
    draw.polygon([(uv[li].uv[0] * W, (1 - uv[li].uv[1]) * H) for li in p.loop_indices], fill=255)
mask = mask.filter(ImageFilter.MaxFilter(9))     # cover the islands' bleed margins
print(f"HEAD {len(head)} of {len(me.polygons)} faces")

# ---------------------------------------------------------------- whiten the head's texels
a = np.asarray(tex).astype(np.float32) / 255
m = np.asarray(mask, dtype=np.float32) / 255
mx = a.max(2)
sat = (mx - a.min(2)) / np.maximum(mx, 1e-6)
pink = a[..., 0] - (a[..., 1] + a[..., 2]) / 2
w = m * smooth(mx, 0.55, 0.8) * (1 - smooth(sat, 0.12, 0.24))   # near-white only: not the eyes, brows or mouth
if "--relative-tint" in ARGS:  # a head painted tinted all over: only what is pinker than the head itself is blush
    pink = pink - np.median(pink[w > 0.5])
lifted = a + (1 - mx)[..., None]                                # brightest channel to 1, colour kept (blush stays pink)
desat = 1 - smooth(pink, 0.015, 0.035)                           # plain off-white → pure white; the blush keeps its tint
target = lifted + (1 - lifted) * desat[..., None]
before = a[w > 0.5].mean(0)
a = a + (target - a) * w[..., None]
print(f"WHITENED {int((w > 0.5).sum())} texels: mean {before.round(3).tolist()} -> {a[w > 0.5].mean(0).round(3).tolist()}")
if "--deep-blue" in ARGS:  # the pin: Tripo painted its marker in the artwork's highlight azure; its body is deep cobalt
    s = m * smooth(a[..., 2] - a[..., 0], 0.4, 0.55)
    a = a * (1 - s[..., None] * (1 - np.array([0.42, 0.51, 0.77], np.float32)))
    print(f"DEEP BLUE {int((s > 0.5).sum())} texels")
if "--black-suit" in ARGS:  # the butler's plum-purple suit → the artwork's near-black (gold trim, grey bell, white gloves stay)
    s = (1 - m) * (1 - smooth(mx, 0.4, 0.5)) * smooth(sat, 0.12, 0.2) * (a[..., 2] > a[..., 1]) * (a[..., 0] > a[..., 1])
    lum = a.mean(-1, keepdims=True)
    a = a + ((lum + (a - lum) * 0.35) * 0.6 - a) * s[..., None]
    print(f"SUIT {int((s > 0.5).sum())} texels darkened")
if "--eye-glints" in ARGS:
    # some Tripo exports painted the eyes plain black, without the highlight their artwork (and the other mascots) have:
    # paint it, a soft white dot up and to the viewer's right in each eye and a small one down-left. The eyes are the two
    # roundish dark patches of head faces (the brows are thin), found in 3D; the dots are placed in the face's plane (x, z)
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    P = [np.array([tuple(Mw @ me.vertices[v].co) for v in p.vertices]) for p in head]
    U = [np.array([(uv[li].uv[0] * W, (1 - uv[li].uv[1]) * H) for li in p.loop_indices]) for p in head]
    tone = np.array([a[int(np.clip(u[:, 1].mean(), 0, H - 1)), int(np.clip(u[:, 0].mean(), 0, W - 1))].max() for u in U])
    dark = np.nonzero(tone < 0.2)[0]
    key = {}
    vid = [[key.setdefault(tuple(np.round(q, 5)), len(key)) for q in P[i]] for i in dark]
    r = [k for k, vs in enumerate(vid) for _ in vs]
    FV = coo_matrix((np.ones(len(r)), (r, [v for vs in vid for v in vs])), shape=(len(dark), len(key))).tocsr()
    _, lab = connected_components(FV @ FV.T, directed=False)
    blobs = []
    for l in np.unique(lab):
        fs = dark[lab == l]
        pts = np.concatenate([P[i] for i in fs])
        w_, h_ = np.ptp(pts[:, 0]), np.ptp(pts[:, 2])
        if len(fs) >= 6 and w_ > 0 and 0.8 < h_ / w_ < 2.5:
            blobs.append((w_ * h_, fs, pts.mean(0), w_, h_))
    eyes_ = sorted(blobs, key=lambda b: -b[0])[:2]
    glints = [(c + np.array([0.18 * w_, 0, 0.2 * h_]), 0.2 * w_, fs) for _, fs, c, w_, h_ in eyes_] + \
             [(c + np.array([-0.2 * w_, 0, -0.24 * h_]), 0.08 * w_, fs) for _, fs, c, w_, h_ in eyes_]
    for g, rg, fs in glints:
        for i in fs:
            for t in range(1, len(P[i]) - 1):         # fan-triangulate
                tri, tu = P[i][[0, t, t + 1]], U[i][[0, t, t + 1]]
                x0, y0 = np.floor(tu.min(0)).astype(int)
                x1, y1 = np.ceil(tu.max(0)).astype(int)
                xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1 + 1, W)), np.arange(max(y0, 0), min(y1 + 1, H)))
                if not xs.size:
                    continue
                T = np.array([[tu[0, 0] - tu[2, 0], tu[1, 0] - tu[2, 0]], [tu[0, 1] - tu[2, 1], tu[1, 1] - tu[2, 1]]])
                if abs(np.linalg.det(T)) < 1e-9:
                    continue
                l12 = np.linalg.solve(T, np.stack([xs.ravel() - tu[2, 0], ys.ravel() - tu[2, 1]]))
                lam = np.vstack([l12, 1 - l12.sum(0)])
                inside = (lam > -0.02).all(0)
                p3 = lam.T @ tri
                d = np.hypot(p3[:, 0] - g[0], p3[:, 2] - g[2])
                al = (1 - smooth(d, 0.7 * rg, rg)) * inside
                yy, xx = ys.ravel()[al > 0], xs.ravel()[al > 0]
                a[yy, xx] = a[yy, xx] + (1 - a[yy, xx]) * al[al > 0, None]
    print(f"GLINTS {len(eyes_)} eyes: " + ", ".join(f"w {w_:.3f} h {h_:.3f}" for _, _, _, w_, h_ in eyes_))
tmp = os.path.join(tempfile.mkdtemp(), "basecolor_white.png")
Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(tmp)
white = bpy.data.images.load(tmp)
white.pack()
white.name = "basecolor_white"
for node in body.node_tree.nodes:  # the body samples the same atlas: it gets the whitened copy too (only head texels changed)
    if node.type == "TEX_IMAGE" and node.outputs["Color"].links and \
            any(l.to_socket.name == "Base Color" for l in node.outputs["Color"].links):
        node.image = white

# ---------------------------------------------------------------- the porcelain material
mat = bpy.data.materials.new("Head")
mat.use_nodes = True
nt = mat.node_tree
p = nt.nodes["Principled BSDF"]
tx = nt.nodes.new("ShaderNodeTexImage")
tx.image = white
nt.links.new(tx.outputs["Color"], p.inputs["Base Color"])
p.inputs["Metallic"].default_value = 0.0
p.inputs["Roughness"].default_value = HEAD_ROUGH
p.inputs["Coat Weight"].default_value = COAT
p.inputs["Coat Roughness"].default_value = COAT_ROUGH
if "--single-sided" in ARGS:  # as the original: double-sided, the mouth cavity's back faces catch the rim lights
    mat.use_backface_culling = True
if "--matte-mouth" in ARGS:
    # the red mouth/tongue under a mirror coat reads pale pink (it shows the studio, not its red): no coat there, satin
    mouth = m * smooth(sat, 0.45, 0.6) * (a[..., 0] > a[..., 1] + 0.2)
    mouth = np.asarray(Image.fromarray((mouth * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
                       .filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    def packed(name, rgb):
        path = os.path.join(tempfile.mkdtemp(), name + ".png")
        Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)
        im = bpy.data.images.load(path)
        im.pack()
        im.colorspace_settings.name = "Non-Color"
        return im
    zero = np.zeros_like(mouth)
    rough = HEAD_ROUGH + (0.55 - HEAD_ROUGH) * mouth
    coat = 1 - mouth
    if "--dark-eyes" in ARGS:
        # the eyes and brows under the mirror coat read grey chrome (they mirror the bright studio): no coat, a smooth
        # dark base (its 4% reflection keeps them glossy), so they stay black with their painted blue rim and highlight
        eyes = m * (1 - smooth(mx, 0.3, 0.5))
        eyes = np.asarray(Image.fromarray((eyes * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
                          .filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
        rough = rough + (0.2 - rough) * eyes
        coat = coat * (1 - eyes)
        # and no reflection at all (KHR_materials_specular 0): they show their painted highlight and blue rim
        spec = nt.nodes.new("ShaderNodeTexImage")           # glTF reads specular from the alpha channel
        spec.image = packed("head_spec", np.dstack([np.ones_like(eyes)] * 3 + [1 - eyes]))   # exported as is: 1 = the usual 4%
        nt.links.new(spec.outputs["Alpha"], p.inputs["Specular IOR Level"])
        print(f"EYES {int((eyes > 0.5).sum())} texels uncoated, unreflective")
    for img, outs in ((packed("head_mr", np.dstack([zero, rough, zero])), (("Green", "Roughness"), ("Blue", "Metallic"))),
                      (packed("head_coat", np.dstack([coat] * 3)), (("Red", "Coat Weight"),))):
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tn.outputs["Color"], sep.inputs["Color"])
        for ch, socket in outs:
            nt.links.new(sep.outputs[ch], p.inputs[socket])
    print(f"MOUTH {int((mouth > 0.5).sum())} texels matte")
if "--keep-normal" in ARGS:
    src_nm = next(n for n in body.node_tree.nodes if n.type == "NORMAL_MAP")
    src_tx = src_nm.inputs["Color"].links[0].from_node
    ntx = nt.nodes.new("ShaderNodeTexImage")
    ntx.image = src_tx.image
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = src_nm.inputs["Strength"].default_value
    nt.links.new(ntx.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Coat Normal"])
me.materials.append(mat)
k = len(me.materials) - 1
for poly in head:
    poly.material_index = k

for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO")
print("EXPORTED", OUT)
