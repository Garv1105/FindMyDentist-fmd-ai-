#!/usr/bin/env bash
# The section mascots as the site loads them: porcelain (build_porcelain.sh's steps) and rigged (rig_mascots.py)
# → web/public/models/rig/. The page's motions are MOTIONS in web/src/components/MascotModel.tsx. Afterwards re-render
# the phones' stills (render_stills.cjs) and bump the ?v= in MascotArt.tsx.
#   usage: model/blender/mascots/build_rig.sh [name …]     (default: all)
set -euo pipefail
RIG=1 exec "$(cd "$(dirname "$0")" && pwd)/build_porcelain.sh" "$@"
