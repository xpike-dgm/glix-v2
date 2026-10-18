import { describe, expect, it } from "vitest";
import {
  barRatio,
  parseAsiriYuklemePrivateView,
  parseAsiriYuklemePublicView,
  parseAsiriYuklemeView,
  phaseOf,
  resultRows,
} from "./view.js";

const pub = { startedAt: 10, danger: false, reveal: null };
const reveal = {
  total: 101,
  exploder: "c",
  clicks: { a: 30, b: 12, c: 9 },
  points: { a: 2, b: 1, c: -1 },
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
      { ...pub, reveal: { ...reveal, exploder: 5 } },
      { ...pub, reveal: { ...reveal, exploder: "" } },
      { ...pub, reveal: { ...reveal, clicks: { a: "x" } } },
      { ...pub, reveal: { ...reveal, points: null } },
    ]) {
      expect(parseAsiriYuklemePublicView(bad)).toBeNull();
    }
    for (const bad of [null, {}, { participant: "evet" }, []]) {
      expect(parseAsiriYuklemePrivateView(bad)).toBeNull();
    }
    expect(parseAsiriYuklemeView(pub, null)).toBeNull();
  });

  it("patlamasız sonucu (exploder null) okur", () => {
    expect(
      parseAsiriYuklemePublicView({ ...pub, reveal: { ...reveal, exploder: null } })?.reveal?.exploder,
    ).toBeNull();
  });

  it("sonuç satırları: çok tıklayandan aza, patlayan en sonda", () => {
    const rows = resultRows(reveal, ["c", "a", "b"]);
    expect(rows.map((r) => r.playerId)).toEqual(["a", "b", "c"]);
    expect(rows[2]).toMatchObject({ exploded: true, points: -1 });
  });

  it("eşit tıklamada katılım sırası korunur", () => {
    const r = { total: 100, exploder: null, clicks: { a: 5, b: 5, c: 9 }, points: { a: 0, b: 0, c: 2 } };
    expect(resultRows(r, ["a", "b", "c"]).map((x) => x.playerId)).toEqual(["c", "a", "b"]);
  });

  it("çubuk oranı patlayanı saymaz ve 0..1 kalır", () => {
    const rows = resultRows(reveal, ["a", "b", "c"]);
    expect(barRatio(30, rows)).toBe(1);
    expect(barRatio(15, rows)).toBe(0.5);
    expect(barRatio(999, rows)).toBe(1);
    expect(barRatio(0, [])).toBe(0);
  });
});
