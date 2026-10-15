"""Studio preview renders of a .blend.

blender -b <file.blend> --python render.py -- <out_dir> [views=front,face,...] [action=Name@frame ...]
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
out_dir = argv[0]
opts = dict(a.split("=", 1) for a in argv[1:])
views = opts.get("views", "front,three_quarter,side,back,face").split(",")
size = int(opts.get("size", 640))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = int(opts.get("samples", 48))
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"

if "action" in opts:  # e.g. action=Wave@20
    name, frame = opts["action"].split("@")
    arm = next(o for o in scene.objects if o.type == "ARMATURE")
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions[name]
    if arm.animation_data.action_slot is None and bpy.data.actions[name].slots:
        arm.animation_data.action_slot = bpy.data.actions[name].slots[0]
    scene.frame_set(int(frame))

world = bpy.data.worlds.new("studio")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.82, 0.86, 0.95, 1)
bg.inputs["Strength"].default_value = 0.7
scene.world = world


def light(name, loc, energy, size_, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, "AREA")
    d.energy, d.size, d.color = energy, size_, color
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0.05)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


light("key", (1.6, -2.4, 2.2), 180, 1.6)
light("fill", (-2.2, -1.6, 0.8), 70, 2.0, (0.85, 0.9, 1.0))
light("rim", (0.4, 2.5, 1.8), 120, 1.2, (0.8, 0.88, 1.0))

meshes = [o for o in scene.objects if o.type == "MESH" and o.visible_get()]
deps = bpy.context.evaluated_depsgraph_get()
pts = []
for o in meshes:
    ev = o.evaluated_get(deps)
    pts += [ev.matrix_world @ Vector(c) for c in ev.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center = (mn + mx) / 2
extent = max(mx - mn)

cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 85
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam

SHOTS = {
    "front": (Vector((0, -1, 0.04)), 1.0, center),
    "three_quarter": (Vector((0.75, -1, 0.15)), 1.0, center),
    "side": (Vector((1, 0, 0.04)), 1.0, center),
    "back": (Vector((0, 1, 0.04)), 1.0, center),
    "face": (Vector((0, -1, 0.0)), 0.36, Vector((0, 0, 0.22))),
}
for v in views:
    direction, zoom, target = SHOTS[v]
    dist = extent * zoom / (2 * math.tan(cam_d.angle / 2)) * 1.12
    cam.location = target + direction.normalized() * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{out_dir}/{v}.png"
    bpy.ops.render.render(write_still=True)
