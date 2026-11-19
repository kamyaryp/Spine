"""Lumbar vertebra (L3-ish) as an SDF in millimetres, projected orthographically to pixel art.

Axes: x = subject's left (+), y = superior (+), z = anterior (+). Origin = centre of vertebral body
height, on the midline at the posterior wall of the body.
One model -> every view, so angles stay consistent. Tones are quantised to a fixed ramp.
"""
import numpy as np
from PIL import Image

# ---------- palette (restrained bone ramp, dark -> light, plus outline) ----------
PAL = {
    "outline": "#2b211b",
    "line":    "#5c4a3b",   # interior contour / cavities / core shadow
    "shade":   "#8e7860",
    "mid":     "#bca98a",
    "light":   "#e0d4b8",
    "hi":      "#faf4e3",
}
def hx(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
TONES = ["line", "shade", "mid", "light", "hi"]   # lit ramp (index 0 darkest)

# ---------- SDF primitives (vectorised, p: (N,3)) ----------
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def obox(p, c, u, v, he, r=0.0):
    """Oriented rounded box: centre c, axis u (long), v (second), w = u x v; half extents he."""
    u = np.asarray(u, float); u /= np.linalg.norm(u)
    v = np.asarray(v, float); v -= u * (v @ u); v /= np.linalg.norm(v)
    w = np.cross(u, v)
    q = p - np.asarray(c, float)
    l = np.stack([q @ u, q @ v, q @ w], 1)
    d = np.abs(l) - (np.asarray(he, float) - r)
    return np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(1), 0) - r

def seg_box(p, a, b, v, hv, hw, r):
    """Box spanning segment a->b, cross-section half extents (hv along v, hw along u x v)."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    u = b - a; L = np.linalg.norm(u)
    return obox(p, (a + b) / 2, u, v, (L / 2 + r, hv, hw), r)

def capsule(p, a, b, ra, rb, scale=(1, 1, 1)):
    s = np.asarray(scale, float)
    q = p / s; a = np.asarray(a, float) / s; b = np.asarray(b, float) / s
    ba = b - a; pa = q - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    r = ra + (rb - ra) * h
    return (np.linalg.norm(pa - h[:, None] * ba, axis=1) - r) * s.min()

def ellipsoid(p, c, rad):
    rad = np.asarray(rad, float); q = (p - np.asarray(c, float)) / rad
    k0 = np.linalg.norm(q, axis=1); k1 = np.linalg.norm(q / rad, axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-6)

# ---------- the vertebra ----------
def body(p):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    hh = 13.5
    waist = 1 - 0.0 * (1 - (y / hh) ** 2).clip(0)          # concave waist
    rx, rz = 23 * waist, 16.5 * waist
    q = np.stack([x / rx, (z - 15.5) / rz], 1)
    de = (np.linalg.norm(q, axis=1) - 1) * np.minimum(rx, rz)
    back = (2.2 - 2.6 * (x / 20) ** 2) - z                    # posterior wall, gently concave
    d = np.maximum(de, back)
    d = np.maximum(d, np.abs(y) - hh)
    # shallow cupped end plates leave a raised ring (ring apophysis)
    cup = ellipsoid(p * np.array([1, 1, 1]), (0, hh + 2.6, 15.5), (17.5, 4.0, 12))
    cupb = ellipsoid(p, (0, -hh - 2.6, 15.5), (17.5, 4.0, 12))
    d = np.maximum(d, -cup); d = np.maximum(d, -cupb)
    # ring apophysis: slight lip at each end plate
    for sy in (1, -1):
        q = np.stack([x / 23.6, (z - 15.5) / 17.1], 1)
        dl = (np.linalg.norm(q, axis=1) - 1) * 17.1
        lip = np.maximum(np.maximum(dl, back + 0.6), np.abs(y - sy * (hh - 1.2)) - 1.2)
        lip = np.maximum(lip, -cup if sy > 0 else -cupb)
        d = np.minimum(d, lip)
    return d - 0.8

def arch(p):
    d = 1e9
    for s in (-1, 1):
        # pedicle: short thick strut from posterolateral body backwards
        d = np.minimum(d, capsule(p, (s * 15.5, 4, 1), (s * 16, 3.5, -11), 5.0, 5.0, scale=(1, 1.55, 1)))
        # lamina: plate sloping back and in to the midline
        d = np.minimum(d, seg_box(p, (s * 15.5, 1.5, -11), (s * 2, -2.5, -24), (0, 1, 0), 7.5, 5.2, 2.2))
        # transverse process: long, slender, flattened front-to-back
        d = np.minimum(d, seg_box(p, (s * 17, 3.5, -8.5), (s * 39, 4.5, -12.5), (0, 1, 0), 4.8, 3.2, 2.2))
        d = np.minimum(d, ellipsoid(p, (s * 38, 4.5, -12.5), (4.0, 5.0, 3.3)))   # rounded tip
        # superior articular process: rises above the pedicle, faces back-and-in
        d = np.minimum(d, seg_box(p, (s * 16, 5, -12), (s * 17.5, 21, -16), (s * -0.35, 0, -1), 3.8, 6.8, 2.4))
        d = np.minimum(d, ellipsoid(p, (s * 20, 15, -20), (3.0, 4.0, 3.0)))       # mammillary process
        # inferior articular process: hangs below the lamina
        d = np.minimum(d, seg_box(p, (s * 8.5, -6, -23), (s * 9.5, -23, -24), (s * 1, 0, 0.3), 3.6, 5.2, 2.4))
    # spinous process: tall, hatchet-shaped, thick rounded posterior border
    d = np.minimum(d, seg_box(p, (0, -1.5, -21), (0, -3.5, -49), (0, 1, 0), 11.0, 4.0, 2.5))
    d = smin(d, capsule(p, (0, 6.5, -49), (0, -14, -48.5), 4.0, 4.0), 3)
    return d

def sdf(p):
    return smin(body(p), arch(p), 2.6)

# ---------- views ----------
def rot(yaw, pitch):
    a, b = np.radians(yaw), np.radians(pitch)
    Ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    return Rx @ Ry          # model -> view

PIVOT = np.array([0.0, 0.0, -11.0])   # model point every view rotates about (canvas centre)
LIGHT = np.array([-0.62, 0.60, 0.55]); LIGHT /= np.linalg.norm(LIGHT)   # view space: top-left, toward viewer

def render(yaw, pitch, mm_per_px=1.5, size=(64, 48), ss=4, center=(0, 0)):
    W, H = size
    R = rot(yaw, pitch); Rinv = R.T
    # subpixel grid in view space
    xs = (np.arange(W * ss) + 0.5) / ss - W / 2
    ys = H / 2 - (np.arange(H * ss) + 0.5) / ss
    X, Y = np.meshgrid(xs * mm_per_px + center[0], ys * mm_per_px + center[1])
    n = X.size
    o = np.stack([X.ravel(), Y.ravel(), np.full(n, 120.0)], 1)
    dvec = np.array([0, 0, -1.0])
    t = np.zeros(n); hit = np.zeros(n, bool); alive = np.ones(n, bool)
    for _ in range(220):
        idx = np.where(alive)[0]
        if not len(idx): break
        pm = (o[idx] + t[idx, None] * dvec) @ R + PIVOT          # view -> model (R orthonormal: v = R m => m = R^T v = v @ R)
        d = sdf(pm)
        t[idx] += d * 0.8
        h = d < 0.05; hit[idx[h]] = True; alive[idx[h]] = False
        alive[idx[t[idx] > 240]] = False
    # normals + AO for hits
    hi = np.where(hit)[0]
    pv = o[hi] + t[hi, None] * dvec
    pm = pv @ R + PIVOT
    e = 0.15
    nm = np.stack([sdf(pm + [e, 0, 0]) - sdf(pm - [e, 0, 0]),
                   sdf(pm + [0, e, 0]) - sdf(pm - [0, e, 0]),
                   sdf(pm + [0, 0, e]) - sdf(pm - [0, 0, e])], 1)
    nm /= np.linalg.norm(nm, axis=1, keepdims=True)
    nv = nm @ Rinv.T                                       # model normal -> view normal (R @ n)
    nv = (R @ nm.T).T
    lam = np.clip(nv @ LIGHT, 0, 1)
    ao = np.zeros(len(hi))
    for i, dd in enumerate((0.8, 1.8, 3.2)):
        ao += (dd - np.minimum(sdf(pm + nm * dd), dd)) / dd * (0.6 ** i)
    ao = np.clip(1 - 0.75 * ao, 0, 1)
    facing = np.clip(nv[:, 2], 0, 1)
    shade = np.zeros(n); shade[hi] = (0.16 + 0.76 * lam ** 1.25 + 0.10 * facing) * (0.30 + 0.70 * ao)
    depth = np.full(n, np.nan); depth[hi] = t[hi]
    # resolve subpixels -> pixels
    hitg = hit.reshape(H, ss, W, ss).mean((1, 3))
    sh = np.where(hit, shade, 0).reshape(H, ss, W, ss).sum((1, 3))
    dp = np.where(hit, t, 0).reshape(H, ss, W, ss).sum((1, 3))
    cnt = hit.reshape(H, ss, W, ss).sum((1, 3))
    cover = hitg >= 0.45
    with np.errstate(invalid="ignore", divide="ignore"):
        shp = sh / cnt; dpp = dp / cnt
    return cover, shp, dpp

def stylise(cover, shade, depth, thresholds=(0.22, 0.45, 0.70, 0.92), line_gap=3.0):
    H, W = cover.shape
    tone = np.full((H, W), -1, int)
    tone[cover] = np.digitize(shade[cover], thresholds)       # 0..5
    # clusters: 3x3 majority filter on tones (coverage untouched), then kill any remaining lone pixels
    for it in range(3):
        out = tone.copy()
        for y in range(H):
            for x in range(W):
                if tone[y, x] < 0: continue
                if it == 0:
                    win = tone[max(0, y-1):y+2, max(0, x-1):x+2].ravel()
                else:
                    win = np.array([tone[yy, xx] for yy, xx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1))
                                    if 0 <= yy < H and 0 <= xx < W])
                win = win[win >= 0]
                if it > 0 and tone[y, x] in win: continue
                vals, c = np.unique(win, return_counts=True)
                if it == 0:
                    if c.max() >= 5: out[y, x] = vals[c.argmax()]
                elif len(vals): out[y, x] = vals[c.argmax()]
        tone = out
    img = np.zeros((H, W, 4), np.uint8)
    lab = np.full((H, W), "", object)
    for y in range(H):
        for x in range(W):
            if tone[y, x] < 0: continue
            lab[y, x] = TONES[tone[y, x]]
    # interior contour: nearer pixel next to a much farther surface
    for y in range(H):
        for x in range(W):
            if not cover[y, x]: continue
            edge = False; inner = False
            for yy, xx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if not (0 <= yy < H and 0 <= xx < W) or not cover[yy, xx]: edge = True
                elif depth[yy, xx] - depth[y, x] > line_gap: inner = True
            if edge: lab[y, x] = "outline"
            elif inner: lab[y, x] = "line" if tone[y, x] >= 1 else "outline"
    # rim light: inner pixel just below/right of the outline on the lit (top-left) side steps up a tone,
    # inner pixel just above the bottom outline steps down (pixel-art edge modelling)
    lab2 = lab.copy()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            L = lab[y, x]
            if L not in TONES: continue
            ti = TONES.index(L)
            if lab[y-1, x] == "outline" and lab[y, x-1] != "" and ti in (1, 2):
                lab2[y, x] = TONES[ti + 1]
            elif lab[y+1, x] == "outline" and ti >= 2 and lab[y-1, x] in TONES:
                lab2[y, x] = TONES[ti - 1]
    lab = lab2
    # interior lines must be strokes, not dots: drop line pixels with no line/outline neighbour
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if lab[y, x] == "line":
                nb = [lab[y-1, x], lab[y+1, x], lab[y, x-1], lab[y, x+1], lab[y-1, x-1], lab[y-1, x+1], lab[y+1, x-1], lab[y+1, x+1]]
                if not any(n in ("line", "outline") for n in nb):
                    lab[y, x] = TONES[max(1, tone[y, x])]
    for y in range(H):
        for x in range(W):
            if lab[y, x]: img[y, x] = (*hx(PAL[lab[y, x]]), 255)
    return img

VIEWS = [  # name, yaw, pitch
    ("Front", 0, 0), ("Front 3/4", 45, 0), ("Side", 90, 0),
    ("Back 3/4", 135, 0), ("Back", 180, 0), ("Top", 0, 90),
]

if __name__ == "__main__":
    import sys, os
    mm = float(sys.argv[1]) if len(sys.argv) > 1 else 1.5
    out = sys.argv[2] if len(sys.argv) > 2 else "out"
    os.makedirs(out, exist_ok=True)
    W = H = int(round(96 / mm))          # square 96 x 96 mm frame for every view
    for name, yaw, pitch in VIEWS:
        size = (W, H)
        c = (0, 0)       # top view: centre the AP span
        cov, sh, dp = render(yaw, pitch, mm, size, center=c)
        img = stylise(cov, sh, dp)
        Image.fromarray(img).save(f"{out}/{name.lower().replace(' ', '').replace('/', '-')}.png")
        print(name, img.shape)
