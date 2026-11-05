import bpy, sys
src, out, tris = sys.argv[-3], sys.argv[-2], int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
o = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = o; o.select_set(True)
m = o.modifiers.new("dec", "DECIMATE"); m.ratio = tris / len(o.data.polygons); m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=m.name)
print("TRIS", len(o.data.polygons))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="AUTO")
