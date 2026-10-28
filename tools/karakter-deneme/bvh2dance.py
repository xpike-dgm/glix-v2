"""CMU BVH -> glix-dance-2 (2B, önden görünüm, bizim iskelete göre yerel açılar).

Kullanım: python3 bvh2dance.py <bvh> <pivots.json> <çıktı.json> <başlangıç_sn> <süre_sn>
Açılar: dinlenme pozuna göre, ebeveyne göre yerel, derece, saat yönü pozitif (y aşağı).
"""
import json, math, sys
import numpy as np

def parse_bvh(path):
    tok = open(path).read().split()
    i = 0
    joints, stack, order = {}, [], []
    cur = None
    while tok[i] != "MOTION":
        t = tok[i]
        if t in ("ROOT", "JOINT"):
            name = tok[i + 1]
            joints[name] = {"parent": stack[-1] if stack else None, "offset": None, "channels": [], "end": None}
            order.append(name); cur = name; i += 2
        elif t == "End":
            cur = ("END", stack[-1]); i += 2
        elif t == "{":
            stack.append(cur if isinstance(cur, str) else stack[-1] + "#end"); i += 1
        elif t == "}":
            stack.pop(); i += 1
        elif t == "OFFSET":
            v = np.array([float(x) for x in tok[i + 1:i + 4]])
            if isinstance(cur, tuple): joints[cur[1]]["end"] = v
            else: joints[cur]["offset"] = v
            i += 4
        elif t == "CHANNELS":
            n = int(tok[i + 1]); joints[cur]["channels"] = tok[i + 2:i + 2 + n]; i += 2 + n
        else:
            i += 1
    nframes = int(tok[i + 2]); ft = float(tok[i + 5]); i += 6
    nch = sum(len(joints[j]["channels"]) for j in order)
    data = np.array([float(x) for x in tok[i:i + nframes * nch]]).reshape(nframes, nch)
    return joints, order, data, ft

def rot(axis, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    if axis == "X": return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "Y": return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def fk(joints, order, row):
    pos, R = {}, {}
    k = 0
    for j in order:
        J = joints[j]; ch = J["channels"]; vals = row[k:k + len(ch)]; k += len(ch)
        t = J["offset"].copy(); r = np.eye(3)
        for c, v in zip(ch, vals):
            if c.endswith("position"): t["XYZ".index(c[0])] = v
            else: r = r @ rot(c[0], v)
        if J["parent"] is None:
            pos[j] = t; R[j] = r
        else:
            p = J["parent"]; pos[j] = pos[p] + R[p] @ t; R[j] = R[p] @ r
        if J["end"] is not None: pos[j + "#end"] = pos[j] + R[j] @ J["end"]
    return pos

# bizim kemik -> (BVH başlangıç, BVH bitiş). İzleyicinin solu = karakterin sağı.
MAP = {
    "torso": ("Hips", "Neck1"),
    "head": ("Neck1", "Head#end"),
    "left_upper_arm": ("RightArm", "RightForeArm"),
    "left_forearm": ("RightForeArm", "RightHand"),
    "right_upper_arm": ("LeftArm", "LeftForeArm"),
    "right_forearm": ("LeftForeArm", "LeftHand"),
    "left_thigh": ("RightUpLeg", "RightLeg"),
    "left_shin": ("RightLeg", "RightFoot"),
    "right_thigh": ("LeftUpLeg", "LeftLeg"),
    "right_shin": ("LeftLeg", "LeftFoot"),
}
CHILD_FOR_DIR = {"torso": "head", "left_upper_arm": "left_forearm", "left_forearm": "left_hand",
                 "right_upper_arm": "right_forearm", "right_forearm": "right_hand",
                 "left_thigh": "left_shin", "left_shin": "left_foot", "right_thigh": "right_shin", "right_shin": "right_foot"}

def main():
    bvh, pivots, out, start, dur = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
    rig = json.load(open(pivots)); parts = rig["parts"]
    joints, order, data, ft = parse_bvh(bvh)
    fps_out = 30; step = max(1, round(1 / (fps_out * ft)))
    f0 = max(1, int(start / ft)); f1 = min(len(data), f0 + int(dur / ft))
    rest = {}
    for b, c in CHILD_FOR_DIR.items():
        x, y = parts[c]["position"]; rest[b] = math.atan2(y, x)
    rest["head"] = math.atan2(-1, 0)
    # ölçek: bizim uyluk+baldır boyu / BVH bacak boyu
    p0 = fk(joints, order, data[f0])
    leg_bvh = np.linalg.norm(p0["RightUpLeg"] - p0["RightLeg"]) + np.linalg.norm(p0["RightLeg"] - p0["RightFoot"])
    leg_px = math.hypot(*parts["left_shin"]["position"]) + math.hypot(*parts["left_foot"]["position"])
    scale = leg_px / leg_bvh
    frames, prev_world, yaw_prev, base = [], {}, None, None
    for f in range(f0, f1, step):
        p = fk(joints, order, data[f])
        h = (p["RightUpLeg"] - p["LeftUpLeg"]) + (p["RightArm"] - p["LeftArm"])
        yaw = math.atan2(h[2], h[0])  # sağ tarafı -X'e döndür
        if yaw_prev is not None:  # sarma ve hafif yumuşatma
            while yaw - yaw_prev > math.pi: yaw -= 2 * math.pi
            while yaw - yaw_prev < -math.pi: yaw += 2 * math.pi
            yaw = yaw_prev + (yaw - yaw_prev) * 0.5
        yaw_prev = yaw
        a = math.pi - yaw  # h -> (-1,0,0)
        Ry = rot("Y", math.degrees(-a))
        def scr(name):
            v = Ry @ (p[name] - p["Hips"]); return np.array([v[0], -v[1], v[2]])
        world = {}
        for b, (s, e) in MAP.items():
            d = scr(e) - scr(s); L2 = math.hypot(d[0], d[1]); L3 = np.linalg.norm(d) + 1e-9
            ang = math.atan2(d[1], d[0])
            # kameraya doğru uzanan uzuvda yön güvenilmez: öncekine doğru çek
            w = min(1.0, (L2 / L3) / 0.5)
            if b in prev_world:
                pa = prev_world[b]; diff = math.atan2(math.sin(ang - pa), math.cos(ang - pa))
                ang = pa + diff * w
            world[b] = ang
        prev_world = world
        delta = {b: world[b] - rest[b] for b in world}
        parent = {n: parts[n]["parent"] for n in parts}
        local = {}
        for n in parts:
            if n in delta:
                pd = delta.get(parent[n], 0.0) if parent[n] != "root" else 0.0
                local[n] = math.degrees(math.atan2(math.sin(delta[n] - pd), math.cos(delta[n] - pd)))
            else:
                local[n] = 0.0  # el ve ayak ön kol/baldırla birlikte döner
        hips = p["Hips"]
        if base is None: base = hips.copy()
        root = {"x": 0.0, "y": round(float(-(hips[1] - base[1]) * scale), 1)}
        frames.append({"root": root, "angles": {k: round(v, 1) for k, v in local.items()}})
    # döngü: son 0,4 sn başa doğru karışsın
    n = len(frames); m = min(12, n // 4)
    for i in range(m):
        t = (i + 1) / (m + 1); A = frames[n - m + i]; B = frames[i]
        for k in A["angles"]:
            d = math.atan2(math.sin(math.radians(B["angles"][k] - A["angles"][k])), math.cos(math.radians(B["angles"][k] - A["angles"][k])))
            A["angles"][k] = round(A["angles"][k] + math.degrees(d) * t, 1)
        A["root"]["y"] = round(A["root"]["y"] + (B["root"]["y"] - A["root"]["y"]) * t, 1)
    json.dump({"format": "glix-dance-2", "fps": fps_out, "loop": True, "source": bvh.split("/")[-1],
               "frames": frames}, open(out, "w"), separators=(",", ":"))
    print(out, len(frames), "kare", round(len(frames) / fps_out, 1), "sn")

main()
