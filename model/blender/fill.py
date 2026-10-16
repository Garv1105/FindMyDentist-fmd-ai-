"""Biharmonic hole-free fill: re-solve masked vertices so the surface is as smooth as possible
while matching position + slope of the untouched surface around it.

python3 -I fill.py <in.npz: co (N,3), tris (M,3), mask (N,) bool> <out.npz: co> [axes, default 012]
"""
import sys
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import factorized

src, dst = sys.argv[1:3]
axes = [int(a) for a in (sys.argv[3] if len(sys.argv) > 3 else "012")]
d = np.load(src)
co, tris, mask = d["co"].astype(float), d["tris"], d["mask"].astype(bool)
N = len(co)

i = np.concatenate([tris[:, 0], tris[:, 1], tris[:, 2], tris[:, 1], tris[:, 2], tris[:, 0]])
j = np.concatenate([tris[:, 1], tris[:, 2], tris[:, 0], tris[:, 0], tris[:, 1], tris[:, 2]])
A = sparse.coo_matrix((np.ones(len(i)), (i, j)), shape=(N, N)).tocsr()
A.data[:] = 1.0  # collapse duplicate edges
deg = np.asarray(A.sum(1)).ravel()
L = sparse.diags(1.0 / np.maximum(deg, 1)) @ A - sparse.identity(N)
M = (L @ L).tocsr()

U = np.nonzero(mask)[0]
K = np.nonzero(~mask)[0]
solve = factorized(M[U][:, U].tocsc())
rhs_op = M[U][:, K]
out = co.copy()
for c in axes:
    out[U, c] = solve(-rhs_op @ co[K, c])
moved = np.linalg.norm(out[U] - co[U], axis=1)
print(f"biharmonic fill: {len(U)} verts, mean move {moved.mean():.4f}, max {moved.max():.4f}")
np.savez(dst, co=out)
