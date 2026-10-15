import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, outdir = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()

bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
print("BBOX min", tuple(round(c, 3) for c in mn), "max", tuple(round(c, 3) for c in mx))

mat = bpy.data.materials.new("clay")
mat.diffuse_color = (0.8, 0.8, 0.85, 1)
obj.data.materials.append(mat)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x = scene.render.resolution_y = 768
scene.render.film_transparent = True

center = (mn + mx) / 2
size = max(mx - mn)
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

def shot(name, direction, scale=1.1, target=None):
    t = target if target is not None else center
    cam_data.ortho_scale = size * scale
    cam.location = t + direction * 5
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{outdir}/{name}.png"
    bpy.ops.render.render(write_still=True)

# glTF import is Y-up -> Blender Z-up; front faces -Y
shot("front", Vector((0, -1, 0)))
shot("side", Vector((1, 0, 0)))
shot("back", Vector((0, 1, 0)))
face = Vector((center.x, center.y, mn.z + (mx.z - mn.z) * 0.78))
shot("face", Vector((0, -1, 0)), scale=0.35, target=face)
