/**
 * Oda botlarının çizimleri: basit, tanınır şekiller (ev, güneş, gülen yüz, yıldız, çiçek, ağaç). Her şekil birkaç
 * darbedir; bot her uyanışta bir darbe gönderir. Koordinatlar `DRAW_GRID` (0..1000) ızgarasında.
 */
import { DRAW_GRID, type DrawPen, type DrawSize, type Rng } from "@glix/engine";
import { pick } from "./metin.js";

export interface BotStroke {
  kind: "stroke";
  color: DrawPen;
  size: DrawSize;
  points: number[];
}

type Pt = readonly [number, number];

const clamp = (v: number): number => Math.max(0, Math.min(DRAW_GRID, Math.round(v)));

function flat(points: readonly Pt[]): number[] {
  return points.flatMap(([x, y]) => [clamp(x), clamp(y)]);
}

function circle(cx: number, cy: number, r: number, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

type Shape = (dx: number, dy: number) => { color: DrawPen; points: Pt[] }[];

const house: Shape = (dx, dy) => [
  {
    color: "beyaz",
    points: [
      [300 + dx, 450 + dy],
      [300 + dx, 750 + dy],
      [700 + dx, 750 + dy],
      [700 + dx, 450 + dy],
      [300 + dx, 450 + dy],
    ],
  },
  {
    color: "mavi",
    points: [
      [260 + dx, 470 + dy],
      [500 + dx, 260 + dy],
      [740 + dx, 470 + dy],
    ],
  },
  {
    color: "sari",
    points: [
      [460 + dx, 750 + dy],
      [460 + dx, 610 + dy],
      [540 + dx, 610 + dy],
      [540 + dx, 750 + dy],
    ],
  },
];

const sun: Shape = (dx, dy) => {
  const cx = 500 + dx;
  const cy = 450 + dy;
  const rays: { color: DrawPen; points: Pt[] }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.push({
      color: "turuncu",
      points: [
        [cx + Math.cos(a) * 170, cy + Math.sin(a) * 170],
        [cx + Math.cos(a) * 260, cy + Math.sin(a) * 260],
      ],
    });
  }
  return [{ color: "sari", points: circle(cx, cy, 130) }, ...rays];
};

const smiley: Shape = (dx, dy) => {
  const cx = 500 + dx;
  const cy = 500 + dy;
  return [
    { color: "sari", points: circle(cx, cy, 250, 30) },
    { color: "beyaz", points: circle(cx - 90, cy - 70, 25, 10) },
    { color: "beyaz", points: circle(cx + 90, cy - 70, 25, 10) },
    { color: "pembe", points: arc(cx, cy + 20, 140, 0.2 * Math.PI, 0.8 * Math.PI) },
  ];
};

const star: Shape = (dx, dy) => {
  const cx = 500 + dx;
  const cy = 500 + dy;
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 === 0 ? 280 : 115;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return [{ color: "sari", points: pts }];
};

const flower: Shape = (dx, dy) => {
  const cx = 500 + dx;
  const cy = 400 + dy;
  const petals: { color: DrawPen; points: Pt[] }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    petals.push({ color: "pembe", points: circle(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95, 55, 14) });
  }
  return [
    {
      color: "yesil",
      points: [
        [cx, cy + 60],
        [cx, cy + 420],
      ],
    },
    ...petals,
    { color: "sari", points: circle(cx, cy, 45, 12) },
  ];
};

const tree: Shape = (dx, dy) => [
  {
    color: "turuncu",
    points: [
      [470 + dx, 800 + dy],
      [470 + dx, 560 + dy],
      [530 + dx, 560 + dy],
      [530 + dx, 800 + dy],
    ],
  },
  { color: "yesil", points: circle(500 + dx, 420 + dy, 190, 28) },
  { color: "yesil", points: circle(500 + dx, 420 + dy, 110, 20) },
];

const SHAPES: readonly Shape[] = [house, sun, smiley, star, flower, tree];

/** Rastgele bir şeklin darbeleri (renkler klasik paletin ilk altısından). */
export function shapeStrokes(rng: Rng): BotStroke[] {
  const shape = pick(rng, SHAPES);
  const dx = rng.int(121) - 60;
  const dy = rng.int(121) - 60;
  const size = (2 + rng.int(2)) as DrawSize;
  return shape(dx, dy).map((s) => ({ kind: "stroke", color: s.color, size, points: flat(s.points) }));
}
