"""Forearm and coat-tail bones on the raw seated model, so the hero can bob its hands and flutter the coat
(Mascot3D.tsx turns them). Looks identical at rest.

blender -b --python arms_raw.py -- <in.glb> <out.glb>

Each bone points forward (Blender -Y → glTF +Z): turning it about its own axis raises/lowers what hangs off it.
  hand.L/R  pivot at the elbow; geometric weights: the forearms and hands sit alone in |x| > 0.2, between the coat hem
            (z ≈ -0.3) and the shoulders; the blend runs out near the elbow, so the sleeve bends smoothly
  coat.L/R  pivot at the hip; the white coat tails spread on the floor beside the legs: weighted by the texture's
            white (the blue pants and the centred white feet stay put), more towards the outer edge, then smoothed
            over the mesh so the coat/pants border stretches instead of tearing
"""
import bpy, sys
import numpy as np
import scipy.sparse as sp

SRC, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
PIVOT = (0.22, -0.08, -0.2)          # elbow, world (x mirrored for the other side)
COAT_PIVOT = (0.28, 0.0, -0.38)      # hip, beside the crossed legs


def smooth(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.data.objects if o.type == "MESH")
me = obj.data
co = np.empty(len(me.vertices) * 3)
me.vertices.foreach_get("co", co)
M = np.array(obj.matrix_world)
co = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
x, z = co[:, 0], co[:, 2]
arm = smooth(np.abs(x), 0.19, 0.29) * smooth(z, -0.31, -0.27) * (1 - smooth(z, -0.06, -0.02))

# the coat tails: white texels (vertex average of the base-colour texture) low and out to the sides
img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.outputs["Color"].links
           and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links))
W, H = img.size
px = np.empty(W * H * 4, np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)[..., :3]
uv = np.empty(len(me.loops) * 2)
me.uv_layers.active.data.foreach_get("uv", uv)
uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), int)
me.loops.foreach_get("vertex_index", lv)
col, cnt = np.zeros((len(me.vertices), 3)), np.zeros(len(me.vertices))
np.add.at(col, lv, px[np.clip((uv[:, 1] * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1)])
np.add.at(cnt, lv, 1)
col /= np.maximum(cnt, 1)[:, None]
white = smooth(col.min(1), 0.35, 0.5) * (1 - smooth(col.max(1) - col.min(1), 0.2, 0.3))
coat = white * smooth(np.abs(x), 0.27, 0.4) * (1 - smooth(z, -0.31, -0.27))
ed = np.empty(len(me.edges) * 2, int)
me.edges.foreach_get("vertices", ed)
ed = ed.reshape(-1, 2)
A = sp.coo_matrix((np.ones(len(ed) * 2), (np.r_[ed[:, 0], ed[:, 1]], np.r_[ed[:, 1], ed[:, 0]])), shape=(len(co),) * 2).tocsr()
A = sp.diags(1 / np.maximum(np.asarray(A.sum(1)).ravel(), 1)) @ A
for _ in range(20):
    coat = 0.5 * coat + 0.5 * (A @ coat)
total = arm + coat
arm, coat = arm / np.maximum(total, 1), coat / np.maximum(total, 1)

arma = bpy.data.objects.new("Rig", bpy.data.armatures.new("Rig"))
bpy.context.scene.collection.objects.link(arma)
bpy.context.view_layer.objects.active = arma
bpy.ops.object.mode_set(mode="EDIT")
root = arma.data.edit_bones.new("root")
root.head, root.tail = (0, 0, -0.1), (0, 0, 0)
for side, s in (("L", 1), ("R", -1)):
    b = arma.data.edit_bones.new(f"hand.{side}")
    b.head = (s * PIVOT[0], PIVOT[1], PIVOT[2])
    b.tail = (s * PIVOT[0], PIVOT[1] - 0.1, PIVOT[2])
    b.parent = root
    c = arma.data.edit_bones.new(f"coat.{side}")
    c.head = (s * COAT_PIVOT[0], COAT_PIVOT[1], COAT_PIVOT[2])
    c.tail = (s * COAT_PIVOT[0], COAT_PIVOT[1] - 0.1, COAT_PIVOT[2])
    c.parent = root
bpy.ops.object.mode_set(mode="OBJECT")

groups = {n: obj.vertex_groups.new(name=n) for n in ("root", "hand.L", "hand.R", "coat.L", "coat.R")}
for i in range(len(co)):
    side = "L" if x[i] > 0 else "R"
    if arm[i] > 1e-3:
        groups[f"hand.{side}"].add([i], float(arm[i]), "REPLACE")
    if coat[i] > 1e-3:
        groups[f"coat.{side}"].add([i], float(coat[i]), "REPLACE")
    if arm[i] + coat[i] < 1 - 1e-3:
        groups["root"].add([i], float(1 - arm[i] - coat[i]), "REPLACE")
print(f"ARMS {int((arm > 0.5).sum())} hand verts, {int((coat > 0.5).sum())} coat verts of {len(co)}")

mw = obj.matrix_world.copy()
obj.parent = arma
obj.matrix_world = mw
obj.modifiers.new("Armature", "ARMATURE").object = arma
for o in bpy.context.scene.objects:
    o.select_set(o in (obj, arma))
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO", export_skins=True, export_animations=False)
print("EXPORTED", OUT)
