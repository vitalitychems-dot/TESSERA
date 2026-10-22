"""Default-off ARC solver. Baseline is returned unchanged when it attempted or timed out.
Object programs reuse dsl_search primitives. Recolor-by-size is not searched.
"""
import importlib.util
import os
import time

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("dsl_search_base", os.path.join(_HERE, "dsl_search.py"))
dsl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(dsl)

# Shape-stable primitives. A shape change cannot be pasted back into the box.
EACH = (
    "rot90", "rot180", "rot270", "flipud", "fliplr", "transpose", "antitranspose",
    "grav_down", "grav_up", "grav_left", "grav_right", "keep_major", "remove_major",
    "sym_lr", "sym_ud", "sym_both", "sym_diag", "fill_enclosed",
)

def components(g):
    return dsl._components(g)

def apply_each(name):
    fn = dsl.PRIMITIVES[name]

    def f(g, fn=fn):
        comps = components(g)
        if not comps:
            return None
        out = np.zeros_like(g)
        changed = False
        for cells in comps:
            ys = [p[0] for p in cells]
            xs = [p[1] for p in cells]
            y0, x0, y1, x1 = min(ys), min(xs), max(ys), max(xs)
            patch = np.zeros((y1 - y0 + 1, x1 - x0 + 1), dtype=g.dtype)
            for y, x in cells:
                patch[y - y0, x - x0] = g[y, x]
            got = fn(patch)
            if got is None or got.shape != patch.shape:
                return None
            changed = changed or not np.array_equal(got, patch)
            view = out[y0:y0 + got.shape[0], x0:x0 + got.shape[1]]
            nz = got != 0
            view[nz] = got[nz]
        return out if changed else None

    return f

def _paint(g, color_of):
    comps = components(g)
    if len(comps) < 2:
        return None
    out = g.copy()
    for cells in comps:
        color = color_of(cells, comps)
        if color is None or not 1 <= int(color) <= 10:
            return None
        for y, x in cells:
            out[y, x] = color
    return None if np.array_equal(out, g) else out

def recolor_size(g):
    """Paint each component with its cell count. Needs two or more."""
    return _paint(g, lambda cells, _comps: len(cells))

def recolor_rank(g):
    def color_of(cells, comps):
        sizes = sorted({len(c) for c in comps}, reverse=True)
        rank = sizes.index(len(cells)) + 1
        return None if rank > 10 else rank
    return _paint(g, color_of)

def infer_size(ins, outs):
    """Same, crop-to-bbox, one scale factor, a constant shape, or unknown."""
    pairs = list(zip(ins, outs))
    if pairs and all(a.shape == b.shape for a, b in pairs):
        return ("same", None)
    crops = [_crop_shape(a) for a, _b in pairs]
    if pairs and crops == [b.shape for _a, b in pairs] and any(a.shape != b.shape for a, b in pairs):
        return ("crop", None)
    scale = _scale_factor(pairs)
    if scale is not None:
        return ("scale", scale)
    if pairs and all(b.shape == outs[0].shape for b in outs):
        return ("constant", outs[0].shape)
    return ("unknown", None)
def _crop_shape(g):
    cropped = dsl.crop_nonbg(g)
    return None if cropped is None else cropped.shape
def _scale_factor(pairs):
    found = []
    for src, dst in pairs:
        sh, sw, dh, dw = *src.shape, *dst.shape
        if sh and sw and dh % sh == 0 and dw % sw == 0 and dh // sh == dw // sw > 1:
            found.append(dh // sh)
        elif dh and dw and sh % dh == 0 and sw % dw == 0 and sh // dh == sw // dw > 1:
            found.append(-(sh // dh))
        else:
            return None
    return found[0] if found and all(k == found[0] for k in found) else None
def expected_shape(g, rule):
    kind, param = rule
    if kind == "same":
        return g.shape
    if kind == "constant":
        return param
    if kind == "crop":
        return _crop_shape(g)
    if kind != "scale":
        return None
    k, (h, w) = param, g.shape
    if k > 1:
        return (h * k, w * k)
    k = -k
    return None if h % k or w % k else (h // k, w // k)
def _constant_window(shape):
    """Top-left window. Cells outside that window must be background."""
    th, tw = shape

    def f(g, th=th, tw=tw):
        h, w = g.shape
        if (h, w) == (th, tw):
            return g
        if h < th or w < tw or np.any(g[th:, :]) or np.any(g[:th, tw:]):
            return None
        return g[:th, :tw]

    return f
def _size_op(rule):
    kind, param = rule
    if kind == "crop":
        return dsl.crop_nonbg
    if kind == "scale":
        return dsl._scale(param) if param > 1 else dsl._down(-param)
    if kind == "constant":
        return _constant_window(param)
    return None
def programs(rule):
    """One primitive per component, size-rank recolor, and the inferred size op."""
    prog = [(f"each_{name}", apply_each(name)) for name in EACH]
    prog.append(("recolor_rank", recolor_rank))
    op = _size_op(rule)
    if op is not None and rule[0] != "same":
        prog.append(("size", op))
    return prog

def _fit(fn, ins, outs, tests, rule):
    try:
        preds = [fn(g) for g in ins]
        mapping = None if any(p is None or p.size == 0 for p in preds) else dsl._color_map(preds, outs)
    except Exception:
        return None
    if mapping is None:
        return None
    out = []
    for grid in tests:
        try:
            pred = dsl._apply_map(fn(grid), mapping)
        except Exception:
            return None
        want = expected_shape(grid, rule)
        if pred is None or pred.size == 0 or want is None or tuple(pred.shape) != tuple(want):
            return None
        out.append(pred)
    return out

def _unanimous(found, n_tests):
    if not found:
        return None
    chosen = []
    for i in range(n_tests):
        head = found[0][1][i]
        if any(g.shape != head.shape or not np.array_equal(g, head) for _n, preds in found for g in (preds[i],)):
            return None
        chosen.append(head)
    return chosen

def solve(train, tests, time_limit, config):
    t0 = time.monotonic()
    deadline = t0 + float(time_limit)
    base = dsl.solve(train, tests, time_limit, config)
    if any(row.get("attempts") for row in base):
        return base
    if (base and base[0]["meta"].get("timed_out")) or time.monotonic() > deadline:
        return base
    ins = [np.asarray(a, dtype=np.int64) for a, _ in train]
    outs = [np.asarray(b, dtype=np.int64) for _, b in train]
    tst = [np.asarray(t, dtype=np.int64) for t in tests]
    rule = infer_size(ins, outs)
    if rule[0] == "unknown":
        return base
    found, timed = [], False
    for name, fn in programs(rule):
        if time.monotonic() > deadline:
            timed = True
            break
        preds = _fit(fn, ins, outs, tst, rule)
        if preds is not None:
            found.append((name, preds))
    agreed = _unanimous(found, len(tests))
    if agreed is None:
        return base
    meta = {
        "programs": [[name for name, _preds in found]], "n_consistent": len(found),
        "depth_used": 1, "timed_out": timed, "size_rule": rule[0],
        "seconds": round(time.monotonic() - t0, 3),
    }
    return [{"attempts": [agreed[i].tolist()], "confidence": 1.0, "meta": meta} for i in range(len(tests))]
