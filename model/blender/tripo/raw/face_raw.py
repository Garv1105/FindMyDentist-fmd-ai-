"""Hero mascot with a living face: the raw sculpt's body and hands + the rigged model's head and face kit.

blender -b --factory-startup --python face_raw.py -- web/public/mascot-sitting-raw.glb web/public/mascot-sitting.glb <out.glb>
then: npx @gltf-transform/cli@4 optimize <out.glb> web/public/mascot-sitting-face.glb --compress meshopt --texture-compress webp
      --texture-size 2048 --simplify false --instance false --flatten false --join false   (and bump ?v= in Mascot3D.tsx)

Both GLBs come from the same Tripo sculpt and sit in the same space (heads agree to ~3-8 mm), so:
  - raw: keep everything below the neck cut (the sculpted mudra hands, coat, legs) and its hand/coat bones
  - rigged: keep the head, eyes, lids, brows, smile, mouth, blush, and the bones root..head + face bones (root renamed
    face_root so it can't be confused with the raw rig's root); body meshes and other bones dropped
  - every clip keeps only the channels of the bones that remain, so Meditate (eyes shut), Wake, Idle (+ Blink) etc.
    drive the face on top of the untouched raw body
  - the rigged head is moved back onto the raw sculpt's shape (head_restore.py: puffy face, full crown), and gets the
    reference art's bolder closed-eye arcs (the mouth stays the rig's own closed smile; mouth_decal.py, an open
    "D" smile, is kept but not used)
"""
import bpy, math, os, sys
from mathutils import Vector

RAW, RIGGED, OUT = sys.argv[sys.argv.index("--") + 1:][:3]
NECK_Z = -0.02  # the rigged model splits head from body here (Head min z -0.025, body max z -0.019)
KEEP_CHAIN = {"root", "hips", "spine", "chest", "neck", "head"}
DROP_MESHES = {"Mascot", "Glove.L", "Glove.R", "Cuff.L", "Cuff.R", "Sleeve.L", "Sleeve.R", "Icosphere"}
CLOSED_EYE = 0.15

bpy.ops.wm.read_factory_settings(use_empty=True)


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


raw = load(RAW)
raw_names = {o.name for o in raw}
rig = load(RIGGED)

# the raw sculpt's head shape (features filled), taken before its head is cut away: the rigged head is moved onto it
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import head_restore  # noqa: E402
sculpt = head_restore.raw_target(next(o for o in raw if o.type == "MESH" and not o.name.startswith("Icosphere")), NECK_Z)

# --- raw: drop the head above the neck cut (the collar hides the join)
for o in raw:
    if o.type == "MESH" and o.name.startswith("Icosphere"):
        bpy.data.objects.remove(o)
        continue
    if o.type != "MESH":
        continue
    me, mw = o.data, o.matrix_world
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    doomed = [f for f in bm.faces if min((mw @ v.co).z for v in f.verts) > NECK_Z]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(me)
    bm.free()
    print(f"RAW {o.name}: removed {len(doomed)} head faces, {len(me.polygons)} left")

# --- rigged: drop body meshes
for o in list(rig):
    if o.type == "MESH" and o.name.split(".0")[0] in DROP_MESHES:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o.name not in raw_names)

# --- the rigged head takes the sculpt's shape back (puffy face, full crown); the face kit rides along
head_restore.restore(bpy.data.objects["Head"], {n: bpy.data.objects[n] for n in head_restore.KIT}, sculpt, NECK_Z)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["Head"]
bpy.data.objects["Head"].select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()  # its stored normals were for the old shape
bpy.ops.object.shade_smooth()

# --- face it straight out over the body: the rigged head and its face came turned ~11° and ~3 cm to one side (the body
# is square to x=0). Turn the head, the face kit and the face bones about the neck until the eyes are level front to
# back, then slide them so the eyes are centred on x=0.
from mathutils import Matrix  # noqa: E402
eL = sum((bpy.data.objects["Eye.L"].matrix_world @ v.co for v in bpy.data.objects["Eye.L"].data.vertices), Vector()) / len(bpy.data.objects["Eye.L"].data.vertices)
eR = sum((bpy.data.objects["Eye.R"].matrix_world @ v.co for v in bpy.data.objects["Eye.R"].data.vertices), Vector()) / len(bpy.data.objects["Eye.R"].data.vertices)
d = eL - eR
turn = Matrix.Rotation(-math.atan2(d.y, d.x), 4, "Z")
mid = turn @ ((eL + eR) / 2)
fix = Matrix.Translation((-mid.x, 0, 0)) @ turn
print(f"STRAIGHTEN head turned {-math.degrees(math.atan2(d.y, d.x)):+.1f} deg, slid {-mid.x * 1000:+.1f} mm")
for o in [bpy.data.objects["Head"]] + [bpy.data.objects[n] for n in head_restore.KIT]:
    mw, mwi = o.matrix_world, o.matrix_world.inverted()
    for v in o.data.vertices:
        v.co = mwi @ (fix @ (mw @ v.co))
    o.data.update()
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
A = arm.matrix_world
eb_head = arm.data.edit_bones["head"]
eb_head.use_connect = False
for eb in [eb_head] + list(eb_head.children_recursive):
    eb.transform(A.inverted() @ fix @ A)
bpy.ops.object.mode_set(mode="OBJECT")


# --- a short neck inside the collar, in the head's porcelain: when the head turns or tips back on its base, the gap
# between its rim and the collar shows neck, not the head's shaded underside (bottom opening ±0.16 x, y -0.17..0.12)
head_obj = bpy.data.objects["Head"]
porcelain = max(head_obj.material_slots, key=lambda s: sum(p.material_index == s.slot_index for p in head_obj.data.polygons)).material
# z -0.035..0: above the V-neck opening (from z -0.04 down), which must keep showing the chest inside it
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1, depth=0.035, location=(0, -0.015, -0.0175))
neck = bpy.context.active_object
neck.name = neck.data.name = "Neck"
neck.scale = (0.085, 0.08, 1)  # front at y -0.095: behind the scrubs (front -0.12), top inside the head
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()
# its own copy, faintly self-lit: it sits in the head's shadow, and unlit it reads as a grey gap above the bright chest
neck_mat = porcelain.copy()
neck_mat.name = "Neck"
bsdf = neck_mat.node_tree.nodes["Principled BSDF"]
for link in list(bsdf.inputs["Emission Color"].links):
    neck_mat.node_tree.links.remove(link)
bsdf.inputs["Emission Color"].default_value = (1, 1, 1, 1)
bsdf.inputs["Emission Strength"].default_value = 0.35
neck.data.materials.append(neck_mat)
print("NECK", porcelain.name)


def is_face(b):
    while b:
        if b.name == "head":
            return True
        b = b.parent
    return False


keep = {b.name for b in arm.data.bones if b.name in KEEP_CHAIN or is_face(b)}
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for eb in list(arm.data.edit_bones):
    if eb.name not in keep:
        arm.data.edit_bones.remove(eb)
arm.data.edit_bones["root"].name = "face_root"
bpy.ops.object.mode_set(mode="OBJECT")
keep = (keep - {"root"}) | {"face_root"}
arm.name = arm.data.name = "FaceRig"
print("FACE BONES", len(keep), sorted(keep))

# --- clips: only channels of remaining bones; root's channels follow the rename
for act in bpy.data.actions:
    def fix(fcurves):
        dropped = 0
        for fc in list(fcurves):
            p = fc.data_path
            if p.startswith('pose.bones["'):
                name = p.split('"')[1]
                # the body under the head never moves, so neither may the chain carrying it (a straightening spine
                # lifts the head off the collar); the head only turns about its base, and doesn't slide
                still = name in KEEP_CHAIN - {"head"} or (name == "head" and not p.endswith("rotation_quaternion"))
                if name not in keep or still:
                    fcurves.remove(fc)
                    dropped += 1
        return dropped
    if hasattr(act, "layers") and act.layers:  # Blender 4.4+ layered actions
        d = sum(fix(cb.fcurves) for l in act.layers for s in l.strips for cb in s.channelbags)
    else:
        d = fix(act.fcurves)
    print(f"CLIP {act.name}: dropped {d} body channels")
    # bold closed-eye arcs, as in the reference art (the eyes squashed to 15%, not 8%)
    hold = {}
    if act.name in ("Meditate", "Fly"):
        hold.update({("eye.L", "scale", 2): CLOSED_EYE, ("eye.R", "scale", 2): CLOSED_EYE})
    curves = [fc for l in act.layers for s in l.strips for cb in s.channelbags for fc in cb.fcurves]
    for fc in curves:
        key = (fc.data_path.split('"')[1], fc.data_path.rsplit(".", 1)[-1], fc.array_index)
        if key in hold:
            for k in fc.keyframe_points:
                k.co.y = k.handle_left.y = k.handle_right.y = hold[key]

# glTF export of every action on the face rig; the raw rig has none
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animation_mode="ACTIONS", export_force_sampling=True,
                          export_yup=True, export_apply=False)
print("EXPORTED", OUT)
