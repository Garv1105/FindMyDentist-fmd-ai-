"""A light rig for each section mascot, so the page can play small motions on it (MascotModel.tsx MOTIONS).

blender -b --python rig_mascots.py -- <name> <in.glb> <out.glb>

Bones (Blender world coordinates: x the mascot's left/viewer's right, -y forward, z up; feet at z 0):
  root ─ spine (pivot at the hips: a bow or a sway) ─┬ head  (pivot at the neck)
                                                     └ part bones: a forearm with its hand and held prop (pivot at the
                                                       elbow), or a held prop with both hands (pivot behind it)
Weights are built from shape, not painted: the head is the "Head" material (head_material_raw.py), a forearm a capsule
elbow → hand ramping in from the elbow, a prop a sphere; colour masks keep a hand off what it lies on. The motions are a
few degrees, so this is enough. At rest the model is unchanged.
"""
import json
import sys
import numpy as np

# per model: spine ramp (z from, z to), neck pivot, parts
#   capsule: [elbow, hand, radius] (ramping in from the elbow); bar: [a, b, radius] (full); sphere: [centre, radius];
#   not: colour masks a part may not take ("blue" = the scrubs, "grey" = the laptop/desk); prop: a mask it takes whole
SPECS = {
    "guide": {"spine": [0.22, 0.42], "neck": [0, 0, 0.55],
              "parts": {"hand.R": {"capsule": [[0.17, -0.14, 0.42], [0.33, -0.27, 0.6], 0.075]}}},
    "guide-left": {"spine": [0.22, 0.42], "neck": [0, 0, 0.55],
                   "parts": {"hand.L": {"capsule": [[-0.18, -0.12, 0.46], [-0.33, -0.28, 0.6], 0.075]}}},
    "butler": {"spine": [0.22, 0.42], "neck": [0, 0, 0.56],
               "parts": {"hand.R": {"capsule": [[0.17, -0.08, 0.39], [0.27, -0.29, 0.44], 0.07],
                                    "sphere": [[0.25, -0.25, 0.54], 0.11]}}},
    # laptop: no spine (the desk, laptop, plant and chair would bow with it)
    "laptop": {"spine": None, "neck": [0, 0.02, 0.6],
               "parts": {"hand.L": {"capsule": [[-0.17, 0.0, 0.42], [-0.07, -0.16, 0.42], 0.05], "not": ["grey"]},
                         "hand.R": {"capsule": [[0.17, 0.0, 0.42], [0.07, -0.16, 0.42], 0.05], "not": ["grey"]}}},
    "pin": {"spine": [0.22, 0.42], "neck": [0, 0, 0.55], "head_not": ["marker"],
            "parts": {"hand.R": {"capsule": [[0.16, -0.08, 0.38], [0.31, -0.02, 0.43], 0.07],
                                 "prop": "marker"},
                      "hand.L": {"capsule": [[-0.12, -0.08, 0.38], [0.1, -0.2, 0.45], 0.05], "not": ["blue"]}}},
    "scholar": {"spine": [0.22, 0.42], "neck": [-0.05, 0, 0.55],
                "parts": {"hand.R": {"capsule": [[0.15, -0.08, 0.42], [0.12, -0.22, 0.55], 0.065]}}},
    "vault": {"spine": [0.22, 0.42], "neck": [0, 0, 0.55],
              "parts": {"hold": {"pivot": [0.0, -0.05, 0.42], "sphere": [[0.02, -0.22, 0.47], 0.1]}}},
    "reading": {"spine": [0.2, 0.4], "neck": [0, 0, 0.47],
                "parts": {"hold": {"pivot": [0.0, -0.05, 0.3], "bar": [[-0.24, -0.19, 0.35], [0.17, -0.19, 0.35], 0.09],
                                  "z_min": 0.27}}},
    "heart": {"spine": [0.22, 0.42], "neck": [0, 0, 0.56],
              "parts": {"hand.L": {"capsule": [[-0.2, -0.05, 0.42], [-0.05, -0.15, 0.45], 0.06], "not": ["blue"]}}},
}


def smooth(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def masks(col, co):
    mx, mn = col.max(1), col.min(1)
    blue = (col[:, 2] - col[:, 0] > 0.25).astype(float)
    return {"blue": blue,
            "grey": ((mx - mn < 0.06) & (mx > 0.25) & (mx < 0.85)).astype(float),
            # the pin's location marker: blue, right of the eyes (whose rims are blue too), above the hand
            "marker": blue * (co[:, 0] > 0.155) * (co[:, 2] > 0.4)}


def capsule(co, a, b, r, ramp=0.45):
    """weight round the segment a → b; ramping in from a (an elbow) unless ramp is None (a bar: full all along)"""
    a, b = np.array(a), np.array(b)
    ab = b - a
    t = np.clip((co - a) @ ab / (ab @ ab), -0.2, 1.4)
    d = np.linalg.norm(co - (a + np.clip(t, 0, 1)[:, None] * ab), axis=1)
    return (1 if ramp is None else smooth(t, 0.05, ramp)) * (1 - smooth(d, r, r * 1.5))


def sphere(co, c, r):
    return 1 - smooth(np.linalg.norm(co - np.array(c), axis=1), r, r * 1.4)


def weights(name, co, col, head):
    """{bone: per-vertex weight}, summing to 1; split vertices at the same position get the same weights."""
    s = SPECS[name]
    m = masks(col, co)
    key = np.unique(np.round(co, 5), axis=0, return_inverse=True)[1].ravel()
    def by_pos(w, how=np.maximum):  # one weight per position
        g = np.zeros(key.max() + 1)
        how.at(g, key, w)
        return g[key]
    hd = head.copy()
    for k in s.get("head_not", []):
        hd *= 1 - m[k]
    hd = by_pos(hd)
    parts = {}
    for bone, p in s["parts"].items():
        w = np.zeros(len(co))
        if "capsule" in p:
            w = np.maximum(w, capsule(co, *p["capsule"]))
        if "sphere" in p:
            w = np.maximum(w, sphere(co, *p["sphere"]))
        if "bar" in p:
            w = np.maximum(w, capsule(co, *p["bar"], ramp=None))
        if "prop" in p:
            w = np.maximum(w, m[p["prop"]])
        if "z_min" in p:
            w *= smooth(co[:, 2], p["z_min"] - 0.02, p["z_min"] + 0.02)
        for k in p.get("not", []):
            w *= 1 - m[k]
        parts[bone] = by_pos(w * (1 - hd))
    total = sum(parts.values()) if parts else np.zeros(len(co))
    over = np.maximum(total, 1)
    parts = {b: w / over for b, w in parts.items()}
    rem = np.clip(1 - sum(parts.values()) - hd, 0, 1)
    spine = (smooth(co[:, 2], *s["spine"]) if s["spine"] else np.zeros(len(co))) * rem
    return {"root": rem - spine, "spine": spine, "head": hd, **parts}


def pivots(name):
    s = SPECS[name]
    out = {"spine": [0, 0, s["spine"][0] if s["spine"] else 0.3], "head": s["neck"]}
    for bone, p in s["parts"].items():
        out[bone] = p.get("pivot") or p["capsule"][0]
    return out


if __name__ == "__main__":
    try:
        import bpy
    except ImportError:
        sys.exit("run inside Blender")
    NAME, SRC, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    obj = next(o for o in bpy.data.objects if o.type == "MESH")
    me = obj.data
    Mw = np.array(obj.matrix_world)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) @ Mw[:3, :3].T + Mw[:3, 3]
    # the base-colour texture, averaged per vertex; the Head material's faces
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
    col, cnt = np.zeros((len(co), 3)), np.zeros(len(co))
    np.add.at(col, lv, px[np.clip((uv[:, 1] * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1)])
    np.add.at(cnt, lv, 1)
    col /= np.maximum(cnt, 1)[:, None]
    hk = {i for i, m in enumerate(me.materials) if m.name == "Head"}
    head = np.zeros(len(co))
    for p in me.polygons:
        if p.material_index in hk:
            head[list(p.vertices)] = 1
    W8 = weights(NAME, co, col, head)

    arma = bpy.data.objects.new("Rig", bpy.data.armatures.new("Rig"))
    bpy.context.scene.collection.objects.link(arma)
    bpy.context.view_layer.objects.active = arma
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arma.data.edit_bones
    root = eb.new("root")
    root.head, root.tail = (0, 0, 0), (0, 0, 0.1)
    bones = {"root": root}
    for bone, pv in pivots(NAME).items():
        b = eb.new(bone)
        b.head = pv
        b.tail = (pv[0], pv[1], pv[2] + 0.1)  # all point up: the page turns them about model-space axes
        b.parent = bones["spine"] if bone != "spine" else root
        bones[bone] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    for bone, w in W8.items():
        g = obj.vertex_groups.new(name=bone)
        for i in np.nonzero(w > 1e-3)[0]:
            g.add([int(i)], float(w[i]), "REPLACE")
    print("RIG " + NAME + " " + json.dumps({b: int((w > 0.5).sum()) for b, w in W8.items()}))
    mw = obj.matrix_world.copy()
    obj.parent = arma
    obj.matrix_world = mw
    obj.modifiers.new("Armature", "ARMATURE").object = arma
    for o in bpy.context.scene.objects:
        o.select_set(o in (obj, arma))
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                              export_materials="EXPORT", export_image_format="AUTO", export_skins=True,
                              export_animations=False)
    print("EXPORTED", OUT)
