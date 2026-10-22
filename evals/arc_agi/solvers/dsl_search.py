"""Baseline ARC solver: brute-force search over sequences of grid transforms.

Plugin interface (any solver file must expose this):
    solve(train, tests, time_limit, config) -> list (one entry per test input) of
        {"attempts": [grid, ...] (<= 2), "confidence": float in [0, 1], "meta": {...}}
    train: list of (input_grid, output_grid); grids are lists of lists of ints 0-9.

Search: breadth-first over transform sequences up to `depth`, deduplicated by the
tuple of intermediate train grids. A program is train-consistent if, after an optional
learned color remap, it reproduces every train output exactly. If depth `depth` finds no
consistent program, the search is repeated at `retry_depth` (no test labels are used).
Deterministic: no randomness in this solver.
"""
import time
from collections import deque

import numpy as np

# ---------- primitives (grid -> grid or None) ----------

def _bg(g):
    return 0

def crop_nonbg(g):
    ys, xs = np.nonzero(g != _bg(g))
    if len(ys) == 0:
        return None
    return g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def _scale(k):
    return lambda g: np.kron(g, np.ones((k, k), dtype=g.dtype)) if g.shape[0] * k <= 30 and g.shape[1] * k <= 30 else None

def _down(k):
    def f(g):
        h, w = g.shape
        if h % k or w % k:
            return None
        return g[::k, ::k]
    return f

def _tile(a, b):
    return lambda g: np.tile(g, (a, b)) if g.shape[0] * a <= 30 and g.shape[1] * b <= 30 else None

def mirror_h(g):
    return np.hstack([g, g[:, ::-1]]) if g.shape[1] * 2 <= 30 else None

def mirror_v(g):
    return np.vstack([g, g[::-1]]) if g.shape[0] * 2 <= 30 else None

def mirror_4(g):
    m = mirror_h(g)
    return None if m is None else mirror_v(m)

def _gravity(axis, rev):
    def f(g):
        out = np.zeros_like(g)
        a = g if axis == 0 else g.T
        o = out if axis == 0 else out.T
        for j in range(a.shape[1]):
            col = a[:, j]
            nz = col[col != 0]
            if rev:
                o[:len(nz), j] = nz
            else:
                o[a.shape[0] - len(nz):, j] = nz
        return out
    return f

def _components(g):
    h, w = g.shape
    seen = np.zeros_like(g, dtype=bool)
    comps = []
    for y in range(h):
        for x in range(w):
            if g[y, x] == 0 or seen[y, x]:
                continue
            q = [(y, x)]
            seen[y, x] = True
            cells = []
            while q:
                cy, cx = q.pop()
                cells.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and g[ny, nx] != 0:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            comps.append(cells)
    return comps

def _obj(pick):
    def f(g):
        comps = _components(g)
        if len(comps) < 2:
            return None
        c = pick(comps)
        ys = [p[0] for p in c]
        xs = [p[1] for p in c]
        return g[min(ys):max(ys) + 1, min(xs):max(xs) + 1]
    return f

def _half(which):
    def f(g):
        h, w = g.shape
        if which in ("left", "right"):
            if w < 2:
                return None
            k = w // 2
            return g[:, :k] if which == "left" else g[:, w - k:]
        if h < 2:
            return None
        k = h // 2
        return g[:k] if which == "top" else g[h - k:]
    return f

def _split2(g, vertical):
    """Split into two equal halves, dropping a uniform separator line if present."""
    a = g if vertical else g.T
    w = a.shape[1]
    if w % 2 == 1:
        mid = a[:, w // 2]
        if len(set(mid.tolist())) != 1:
            return None
        l, r = a[:, :w // 2], a[:, w // 2 + 1:]
    else:
        l, r = a[:, :w // 2], a[:, w // 2:]
    return (l, r) if vertical else (l.T, r.T)

def _logic(op, vertical):
    def f(g):
        s = _split2(g, vertical)
        if s is None:
            return None
        a, b = s[0] != 0, s[1] != 0
        m = {"and": a & b, "or": a | b, "xor": a ^ b, "nor": ~(a | b)}[op]
        return m.astype(g.dtype)
    return f

def fill_enclosed(g):
    h, w = g.shape
    reach = np.zeros_like(g, dtype=bool)
    q = deque((y, x) for y in range(h) for x in range(w) if (y in (0, h - 1) or x in (0, w - 1)) and g[y, x] == 0)
    for y, x in q:
        reach[y, x] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not reach[ny, nx] and g[ny, nx] == 0:
                reach[ny, nx] = True
                q.append((ny, nx))
    holes = (g == 0) & ~reach
    if not holes.any():
        return None
    out = g.copy()
    out[holes] = 10  # placeholder color; the learned color remap must map it
    return out

def _sym_complete(kind):
    def f(g):
        cands = {"lr": [g[:, ::-1]], "ud": [g[::-1]], "both": [g[:, ::-1], g[::-1], g[::-1, ::-1]],
                 "diag": [g.T] if g.shape[0] == g.shape[1] else []}[kind]
        if not cands or not (g == 0).any():
            return None
        out = g.copy()
        for c in cands:
            m = out == 0
            out[m] = c[m]
        return out
    return f

def keep_major(g):
    v, c = np.unique(g[g != 0], return_counts=True)
    if len(v) < 2:
        return None
    return np.where(g == v[c.argmax()], g, 0)

def remove_major(g):
    v, c = np.unique(g[g != 0], return_counts=True)
    if len(v) < 2:
        return None
    return np.where(g == v[c.argmax()], 0, g)

PRIMITIVES = {
    "rot90": lambda g: np.rot90(g, 1), "rot180": lambda g: np.rot90(g, 2), "rot270": lambda g: np.rot90(g, 3),
    "flipud": lambda g: g[::-1], "fliplr": lambda g: g[:, ::-1], "transpose": lambda g: g.T,
    "antitranspose": lambda g: np.rot90(g, 2).T,
    "crop": crop_nonbg,
    "up2": _scale(2), "up3": _scale(3), "down2": _down(2), "down3": _down(3),
    "tile2x2": _tile(2, 2), "tile3x3": _tile(3, 3), "tile1x2": _tile(1, 2), "tile2x1": _tile(2, 1),
    "mirror_h": mirror_h, "mirror_v": mirror_v, "mirror_4": mirror_4,
    "grav_down": _gravity(0, False), "grav_up": _gravity(0, True),
    "grav_right": _gravity(1, False), "grav_left": _gravity(1, True),
    "largest_obj": _obj(lambda cs: max(cs, key=len)), "smallest_obj": _obj(lambda cs: min(cs, key=len)),
    "left": _half("left"), "right": _half("right"), "top": _half("top"), "bottom": _half("bottom"),
    "and_v": _logic("and", True), "or_v": _logic("or", True), "xor_v": _logic("xor", True), "nor_v": _logic("nor", True),
    "and_h": _logic("and", False), "or_h": _logic("or", False), "xor_h": _logic("xor", False), "nor_h": _logic("nor", False),
    "fill_enclosed": fill_enclosed,
    "sym_lr": _sym_complete("lr"), "sym_ud": _sym_complete("ud"), "sym_both": _sym_complete("both"), "sym_diag": _sym_complete("diag"),
    "keep_major": keep_major, "remove_major": remove_major,
}
NAMES = sorted(PRIMITIVES)

# ---------- consistency ----------

def _color_map(preds, outs):
    """Return a dict color->color making every pred equal its out, or None. {} means identity."""
    m = {}
    for p, o in zip(preds, outs):
        if p.shape != o.shape:
            return None
        for a, b in zip(p.ravel().tolist(), o.ravel().tolist()):
            if m.setdefault(a, b) != b:
                return None
    return m

def _apply_map(g, m):
    if any(v > 9 for v in np.unique(g).tolist() if v not in m):
        return None
    lut = np.arange(11)
    for a, b in m.items():
        lut[a] = b
    return lut[g]

def _key(gs):
    return tuple((g.shape, g.tobytes()) for g in gs)

def _search(ins, outs, tests, depth, deadline, max_programs):
    found = []  # (program, predictions per test)
    start = tuple(ins)
    frontier = [((), start, tuple(tests))]
    seen = {_key(start)}
    for d in range(depth + 1):
        nxt = []
        for prog, st, ts in frontier:
            if time.monotonic() > deadline:
                return found, True
            m = _color_map(st, outs)
            if m is not None:
                preds = [_apply_map(t, m) if t is not None else None for t in ts]
                if all(p is not None for p in preds):
                    found.append((prog, preds))
                    if len(found) >= max_programs:
                        return found, False
            if d == depth:
                continue
            for name in NAMES:
                f = PRIMITIVES[name]
                try:
                    ns = tuple(f(g) for g in st)
                    if any(g is None or g.size == 0 for g in ns):
                        continue
                    k = _key(ns)
                    if k in seen:
                        continue
                    seen.add(k)
                    nt = tuple(f(t) if t is not None else None for t in ts)
                except Exception:
                    continue
                nxt.append((prog + (name,), ns, nt))
        frontier = nxt
    return found, False

def solve(train, tests, time_limit, config):
    t0 = time.monotonic()
    deadline = t0 + time_limit
    depth = int(config.get("depth", 2))
    retry = config.get("retry_depth", 3)
    max_programs = int(config.get("max_programs", 50))
    ins = [np.array(a, dtype=np.int64) for a, _ in train]
    outs = [np.array(b, dtype=np.int64) for _, b in train]
    tst = [np.array(t, dtype=np.int64) for t in tests]
    found, timed_out = _search(ins, outs, tst, depth, deadline, max_programs)
    used = depth
    if not found and retry and int(retry) > depth and not timed_out:
        found, timed_out = _search(ins, outs, tst, int(retry), deadline, max_programs)
        used = int(retry)
    results = []
    for i in range(len(tests)):
        votes = {}
        order = []
        for prog, preds in found:
            p = preds[i]
            k = (p.shape, p.tobytes())
            if k not in votes:
                votes[k] = [p, 0, prog]
                order.append(k)
            votes[k][1] += 1
        # rank: shortest program first (found order is BFS), tie -> more votes
        ranked = sorted(order, key=lambda k: (len(votes[k][2]), -votes[k][1]))[:2]
        total = sum(v[1] for v in votes.values())
        attempts = [votes[k][0].tolist() for k in ranked]
        conf = (votes[ranked[0]][1] / total) if ranked else 0.0
        results.append({"attempts": attempts, "confidence": round(conf, 4),
                        "meta": {"programs": [list(votes[k][2]) for k in ranked], "n_consistent": len(found),
                                 "depth_used": used, "timed_out": timed_out,
                                 "seconds": round(time.monotonic() - t0, 3)}})
    return results
