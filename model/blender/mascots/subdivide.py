"""Smooth a low-poly Tripo mascot: one level of Catmull-Clark subdivision, its sharp edges creased so props stay crisp.

blender -b --python subdivide.py -- <in.glb> <out.glb> [levels] [crease_degrees]

The section mascots came from Tripo at ~12k vertices: their silhouettes and the head's curves show facets. Subdividing
rounds those off; edges sharper than CREASE (a book's corners) are fully creased, so boxy props keep their edges and the
shading keeps them sharp. Two kinds of part are not smoothed at all (every edge creased), because a thin slab's two sides
round off unevenly and poke through each other (dark cracks):
  * thin parts, found geometrically: a surface with another one facing it from behind within THIN (a laptop lid, book
    covers and pages, glasses frames, a fold in the crown), plus a ring round them;
  * hard-surface props painted neutral grey (the laptop, desk, chair frame, bell).
UV seams are merged first (open seams would split apart). Tripo's meshes also have small open cracks (boundary edges)
that look closed only because their two sides overlap: subdivision would smooth each side's ragged edge into a curve
and pull them apart into see-through slits, so boundary vertices are pinned (vertex crease) and their edges creased.
"""
import numpy as np
import bpy, bmesh, math, sys
from mathutils.kdtree import KDTree

ARGS = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = ARGS[:2]
LEVELS = int(ARGS[2]) if len(ARGS) > 2 else 1
CREASE = math.radians(float(ARGS[3]) if len(ARGS) > 3 else 40)
THIN = 0.014  # of the model's ~0.98 height: thinner than this is a slab, not a limb

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC, merge_vertices=True)
obj = next(o for o in bpy.data.objects if o.type == "MESH")
me = obj.data
before = len(me.polygons)

# the grey props: faces whose texel (at the face's UV centre) is a neutral mid grey
img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.outputs["Color"].links
           and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links))
W, H = img.size
px = np.empty(W * H * 4, np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)[..., :3] ** (1 / 2.2)  # linear → about sRGB
uv = me.uv_layers.active.data
grey = set()
for p in me.polygons:
    u = np.mean([uv[li].uv[:] for li in p.loop_indices], axis=0)
    c = px[min(H - 1, max(0, int(u[1] * H))), min(W - 1, max(0, int(u[0] * W)))]
    if c.max() - c.min() < 0.06 and 0.3 < c.max() < 0.88:
        grey.add(p.index)

bm = bmesh.new()
bm.from_mesh(me)
bm.normal_update()
bm.verts.ensure_lookup_table()
# thin parts: a vertex with another surface behind it, facing back at it, closer than THIN (and not its own neighbours)
kd = KDTree(len(bm.verts))
for v in bm.verts:
    kd.insert(v.co, v.index)
kd.balance()
thin = set()
for v in bm.verts:
    near = {v.index} | {w.index for e in v.link_edges for w in e.verts} | \
           {x.index for e in v.link_edges for w in e.verts for e2 in w.link_edges for x in e2.verts}
    for co, i, _ in kd.find_range(v.co, THIN):
        if i in near:
            continue
        w = bm.verts[i]
        if v.normal.dot(w.normal) < -0.3 and (co - v.co).dot(v.normal) < 0:
            thin.add(v.index)
            break
thin |= {w.index for i in list(thin) for e in bm.verts[i].link_edges for w in e.verts}  # and a ring round them
crease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
pin = bm.verts.layers.float.get("crease_vert") or bm.verts.layers.float.new("crease_vert")
pinned = 0
for v in bm.verts:
    if any(len(e.link_faces) != 2 for e in v.link_edges):
        v[pin] = 1.0
        pinned += 1
n = 0
for e in bm.edges:
    if (len(e.link_faces) != 2 or e.calc_face_angle(0) > CREASE or any(f.index in grey for f in e.link_faces)
            or any(w.index in thin for w in e.verts)):
        e[crease] = 1.0
        n += 1
bm.to_mesh(me)
bm.free()

mod = obj.modifiers.new("Subdivision", "SUBSURF")
mod.levels = mod.render_levels = LEVELS
mod.uv_smooth = "NONE"   # UVs interpolated, not smoothed: smoothing drags neighbouring texture islands in
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.shade_smooth()
me.set_sharp_from_angle(angle=CREASE)
print(f"SUBDIV {before} -> {len(me.polygons)} faces, {n} creased edges, {pinned} crack vertices pinned, {len(grey)} grey prop "
      f"faces and {len(thin)} thin vertices kept hard")

for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO")
print("EXPORTED", OUT)
