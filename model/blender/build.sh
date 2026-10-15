#!/usr/bin/env bash
# Rebuild the rigged, animated mascot from the raw Meshy export.
#   usage: model/blender/build.sh [meshy.glb] [reference-front.png]
# Output: model/mascot/out/mascot_rigged.glb (+ intermediate .blend files for inspection)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MASCOT="$HERE/../mascot"
SRC="${1:-$MASCOT/ed4783cfdb0ce35cb67bdba4e6690059.glb}"
REF="${2:-$MASCOT/A-shape.png}"
OUT="$MASCOT/out"
mkdir -p "$OUT/inspect"
BL=(blender -b --factory-startup)

step() { echo "== $*"; }
step "front silhouette";  "${BL[@]}" --python "$HERE/inspect.py" -- "$SRC" "$OUT/inspect" >/dev/null
step "register reference"; python3 -I "$HERE/register.py" "$OUT/inspect/front.png" "$REF" "$OUT/register.json"
step "face features";     python3 -I "$HERE/features.py" "$REF" "$OUT/register.json" "$OUT"
step "clean + paint";     "${BL[@]}" --python "$HERE/prep.py" -- "$SRC" "$REF" "$OUT/register.json" \
                              "$OUT/features.json" "$OUT/eye.png" "$OUT/prep.blend" | grep -E "fill|interior|holes|labels|saved"
step "joint landmarks";   blender -b "$OUT/prep.blend" --python "$HERE/landmarks.py" -- "$OUT" | grep -E "crotch"
step "rig + skin";        blender -b "$OUT/prep.blend" --python "$HERE/rig.py" -- "$OUT/landmarks_raw.json" "$OUT/rig.blend" \
                              | grep -E "^arm|detached|saved"
step "animate + export";  blender -b "$OUT/rig.blend" --python "$HERE/anim.py" -- "$OUT/mascot_rigged.glb" "$OUT/anim.blend" \
                              | grep -E "^clip|exported"
