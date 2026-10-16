"""Cross-legged meditation pose, shared by anim.py (Meditate clip) and medtest.py (preview renders).

Blender space: +X = the character's left, -Y = forward, +Z = up. The mesh has short shins (8 cm) and long shoes
(25 cm heel to toe), so in this pose the shins are scaled up and the shoes down (cartoon "tucked feet"): knees
wide and low, left shin crossing in front of the right, both small feet meeting at the centre like the reference.
Preview: blender -b rig.blend --python medtest.py -- <out_dir>  (MED_P='{...}' overrides, MED_DEBUG=1 colours).
"""
from mathutils import Vector
from posing import aim, eyes_closed, move, orient, rot, scale, side_sign, twist

P = dict(
    drop=-0.175,
    thigh=(0.88, -0.35, -0.32),
    shin_front=(-0.93, -0.36, -0.05),
    shin_back=(-0.82, -0.3, -0.35),
    foot_front=(-0.93, -0.05, 0.2),
    foot_back=(-0.9, -0.15, -0.4),  # heel tucked into the knee, not toward the viewer
    upper_arm=(0.4, -0.15, -0.9),
    forearm=(0.55, -0.65, -0.35),
    hand=(0.68, -0.5, 0.05),
    palm_up=-75,
    shin_scale=1.45,
    foot_scale=0.68,
    foot_up=(0, -0.35, 1),
)


def meditate_pose(rig, breath=0.0, float_z=0.0, p=P):
    move(rig, "root", (0, 0, p["drop"] + float_z))
    rot(rig, "chest", (Vector((-1, 0, 0)), 1.5 * breath))
    rot(rig, "head", (Vector((1, 0, 0)), 2 - 1.5 * breath))
    for s in "LR":
        sg = side_sign(s)
        mirror = lambda v: (sg * v[0], v[1], v[2])  # noqa: E731
        front = s == "L"
        aim(rig, f"thigh.{s}", mirror(p["thigh"]))
        # cartoon proportions: shins a bit longer, shoes smaller (as if tucked), so the legs can cross
        scale(rig, f"shin.{s}", (p["shin_scale"],) * 3)
        aim(rig, f"shin.{s}", mirror(p["shin_front"] if front else p["shin_back"]))
        # shoe top faces up and a little toward the viewer, sole underneath
        orient(rig, f"foot.{s}", mirror(p["foot_front"] if front else p["foot_back"]), p["foot_up"])
        scale(rig, f"foot.{s}", (p["foot_scale"] / p["shin_scale"],) * 3)  # local scale; parent's is inherited
        aim(rig, f"upper_arm.{s}", mirror(p["upper_arm"]))
        aim(rig, f"forearm.{s}", mirror(p["forearm"]))
        h = p["hand"]
        aim(rig, f"hand.{s}", mirror((h[0], h[1], h[2] + 0.03 * breath)))
        twist(rig, f"forearm.{s}", sg * p["palm_up"])
    eyes_closed(rig, 1.0)
