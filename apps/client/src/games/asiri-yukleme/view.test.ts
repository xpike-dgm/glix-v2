import { describe, expect, it } from "vitest";
import {
  barParts,
  parseAsiriYuklemePrivateView,
  parseAsiriYuklemePublicView,
  parseAsiriYuklemeView,
  phaseOf,
  pointsText,
  resultRows,
} from "./view.js";

const pub = { startedAt: 10, danger: false, reveal: null };
const reveal = {
  total: 106,
  before: { a: 40, b: 30, c: 20, d: 10 },
  after: { a: 0, b: 1, c: 0, d: 5 },
  exploders: ["b", "d"],
  points: { a: 2, b: -1, c: 1, d: -2 },
};

describe("Aşırı Yükleme görünümü", () => {
  it("oyun, tehlike ve sonuç evrelerini ayırır", () => {
    expect(phaseOf(parseAsiriYuklemeView(pub, { participant: true }))).toBe("playing");
    expect(phaseOf(parseAsiriYuklemeView({ ...pub, danger: true }, { participant: true }))).toBe("danger");
    expect(phaseOf(parseAsiriYuklemeView({ ...pub, danger: true, reveal }, { participant: false }))).toBe(
      "revealed",
    );
    expect(phaseOf(null)).toBe("playing");
  });

  it("bozuk görünümü reddeder", () => {
    for (const bad of [
      null,
      [],
      "x",
      { ...pub, startedAt: "1" },
      { ...pub, danger: 1 },
      { ...pub, reveal: 3 },
      { ...pub, reveal: { ...reveal, total: "9" } },
      { ...pub, reveal: { ...reveal, total: -1 } },
      { ...pub, reveal: { ...reveal, exploders: "b" } },
      { ...pub, reveal: { ...reveal, exploders: [5] } },
      { ...pub, reveal: { ...reveal, exploders: [""] } },
      { ...pub, reveal: { ...reveal, exploders: ["b", "b"] } },
      { ...pub, reveal: { ...reveal, before: { a: "x" } } },
      { ...pub, reveal: { ...reveal, before: { a: 1.5 } } },
      { ...pub, reveal: { ...reveal, after: { a: -2 } } },
      { ...pub, reveal: { ...reveal, after: undefined } },
      { ...pub, reveal: { ...reveal, points: null } },
    ]) {
      expect(parseAsiriYuklemePublicView(bad)).toBeNull();
    }
    for (const bad of [null, {}, { participant: "evet" }, []]) {
      expect(parseAsiriYuklemePrivateView(bad)).toBeNull();
    }
    expect(parseAsiriYuklemeView(pub, null)).toBeNull();
  });

  it("yeni sonucu eksiksiz okur; patlamasız sonuç boş listedir", () => {
    expect(parseAsiriYuklemePublicView({ ...pub, reveal })?.reveal).toEqual(reveal);
    expect(
      parseAsiriYuklemePublicView({ ...pub, reveal: { ...reveal, exploders: [] } })?.reveal?.exploders,
    ).toEqual([]);
  });

  it("sonuç sırası: patlamayanlar çoktan aza, patlayanlar en sonda ve en ağır ceza en son", () => {
    const rows = resultRows(reveal, ["d", "c", "b", "a"]);
    expect(rows.map((r) => r.playerId)).toEqual(["a", "c", "b", "d"]);
    expect(rows[3]).toMatchObject({ exploded: true, before: 10, after: 5, points: -2 });
    expect(rows[0]).toMatchObject({ exploded: false, before: 40, after: 0, points: 2 });
  });

  it("eşit tıklamada katılım sırası korunur", () => {
    const r = {
      total: 19,
      before: { a: 5, b: 5, c: 9 },
      after: { a: 0, b: 0, c: 0 },
      exploders: [],
      points: { a: 1, b: 1, c: 2 },
    };
    expect(resultRows(r, ["a", "b", "c"]).map((x) => x.playerId)).toEqual(["c", "a", "b"]);
  });

  it("çubuk: önce ve sonra parçaları 0..1 içinde ve toplamı en çok 1", () => {
    const rows = resultRows(reveal, ["a", "b", "c", "d"]);
    const a = rows.find((r) => r.playerId === "a");
    const d = rows.find((r) => r.playerId === "d");
    if (!a || !d) throw new Error("satır yok");
    expect(barParts(a, rows)).toEqual({ before: 1, after: 0 });
    const pd = barParts(d, rows);
    expect(pd.before).toBeCloseTo(0.25);
    expect(pd.after).toBeCloseTo(0.125);
    expect(barParts({ ...d, before: 0, after: 0 }, [])).toEqual({ before: 0, after: 0 });
  });

  it("puan yazısı gerçek eksi işareti kullanır", () => {
    expect(pointsText(2)).toBe("+2");
    expect(pointsText(0)).toBe("0");
    expect(pointsText(-2)).toBe("−2");
  });
});
