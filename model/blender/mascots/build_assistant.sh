#!/usr/bin/env bash
# The FMD AI assistant mascot → web/public/models/assistant.glb: the guide built exactly as build_porcelain.sh builds
# it (same source, subdivision, porcelain head and texture settings), with rig_assistant.py's rig, face shapes and clips
# in place of rig_mascots.py's light rig.   usage: model/blender/mascots/build_assistant.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../.."
TMP="$(mktemp -d)"
blender -b --python "$HERE/subdivide.py" -- "$ROOT/web/public/models/mascots/guide.glb" "$TMP/sub.glb" | grep -E "^SUBDIV"
blender -b --python "$ROOT/model/blender/tripo/raw/head_material_raw.py" -- "$TMP/sub.glb" "$TMP/mat.glb" --neck 0.53 \
  --largest --keep-normal --relative-tint --matte-mouth --dark-eyes --single-sided | grep -E "^HEAD|^MOUTH"
blender -b --python "$HERE/rig_assistant.py" -- "$TMP/mat.glb" "$TMP/rig.glb" | grep -E "^RIG|^EYE|^MOUTH|^SHAPE|^EXPORTED"
npx --yes @gltf-transform/cli@4 webp "$TMP/rig.glb" "$TMP/webp.glb" --quality 95 | tail -1
NODE_OPTIONS=--max-old-space-size=3072 npx --yes @gltf-transform/cli@4 optimize "$TMP/webp.glb" "$ROOT/web/public/models/assistant.glb" \
  --compress meshopt --texture-compress false --texture-size 1024 --simplify false --instance false --flatten false --join false | tail -1
rm -rf "$TMP"
