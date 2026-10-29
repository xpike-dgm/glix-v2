import { describe, expect, it } from "vitest";
import { bitrateFor, CLIP_FORMATS, containerOf, pickClipFormat, planClip } from "./clipFormat.js";
import { clipColumns } from "./clipLayout.js";
import {
  CLIP_FADE,
  CLIP_FPS,
  CLIP_SECONDS,
  clipDone,
  clipFade,
  clipProgress,
  clipTime,
  stepSeconds,
} from "./clipTiming.js";

const only =
  (...ok: string[]) =>
  (m: string) =>
    ok.includes(m);

describe("klip biçimi", () => {
  it("MP4 varsa önce o seçilir (her yerde paylaşılır)", () => {
    expect(pickClipFormat(() => true)?.ext).toBe("mp4");
    expect(pickClipFormat(only("video/mp4"))).toEqual({ mime: "video/mp4", ext: "mp4" });
  });
  it("yalnız WebM varsa VP9, yoksa VP8, yoksa düz WebM", () => {
    expect(pickClipFormat(only("video/webm;codecs=vp9", "video/webm"))?.mime).toBe("video/webm;codecs=vp9");
    expect(pickClipFormat(only("video/webm;codecs=vp8", "video/webm"))?.mime).toBe("video/webm;codecs=vp8");
    expect(pickClipFormat(only("video/webm"))?.mime).toBe("video/webm");
  });
  it("hiçbiri yoksa ya da sorgu yoksa/hata veriyorsa null", () => {
    expect(pickClipFormat(() => false)).toBeNull();
    expect(pickClipFormat(undefined)).toBeNull();
    expect(
      pickClipFormat(() => {
        throw new Error("x");
      }),
    ).toBeNull();
  });
  it("her aday geçerli bir uzantıya sahip", () => {
    for (const f of CLIP_FORMATS) expect(f.mime.startsWith(`video/${f.ext}`)).toBe(true);
  });
  it("plan: hareket azaltma > yakalama yok > kaydedici yok > video", () => {
    const ok = { reducedMotion: false, canCapture: true, isTypeSupported: () => true };
    expect(planClip(ok).kind).toBe("video");
    expect(planClip({ ...ok, reducedMotion: true })).toEqual({ kind: "poster", reason: "reduced-motion" });
    expect(planClip({ ...ok, canCapture: false })).toEqual({ kind: "poster", reason: "no-capture" });
    expect(planClip({ ...ok, isTypeSupported: undefined })).toEqual({
      kind: "poster",
      reason: "no-recorder",
    });
    expect(planClip({ ...ok, isTypeSupported: () => false })).toEqual({
      kind: "poster",
      reason: "no-recorder",
    });
  });
  it("kaydedicinin bildirdiği türden uzantı çıkar; bilinmiyorsa seçilene dönülür", () => {
    const f = CLIP_FORMATS[3] ?? { mime: "video/webm", ext: "webm" as const };
    expect(containerOf("video/mp4;codecs=avc1.42E01E", f)).toEqual({ mime: "video/mp4", ext: "mp4" });
    expect(containerOf("video/webm;codecs=vp9", f)).toEqual({ mime: "video/webm", ext: "webm" });
    expect(containerOf("", f)).toEqual({ mime: "video/webm", ext: "webm" });
  });
  it("bit hızı sınırlı", () => {
    expect(bitrateFor(720, 1280)).toBeGreaterThanOrEqual(1_200_000);
    expect(bitrateFor(720, 1280)).toBeLessThanOrEqual(4_000_000);
    expect(bitrateFor(540, 960)).toBeLessThanOrEqual(bitrateFor(720, 1280));
  });
});

describe("klip zamanı", () => {
  it("süre 4-6 sn arasında, 30 kare/sn", () => {
    expect(CLIP_SECONDS).toBeGreaterThanOrEqual(4);
    expect(CLIP_SECONDS).toBeLessThanOrEqual(6);
    expect(CLIP_FPS).toBe(30);
  });
  it("zaman duvar saatinden gelir ve sıkıştırılır", () => {
    expect(clipTime(-50)).toBe(0);
    expect(clipTime(2500)).toBe(2.5);
    expect(clipTime(99_000)).toBe(CLIP_SECONDS);
    expect(clipTime(Number.NaN)).toBe(0);
    expect(clipDone(CLIP_SECONDS * 1000 - 1)).toBe(false);
    expect(clipDone(CLIP_SECONDS * 1000)).toBe(true);
  });
  it("kare düşse de toplam ilerleme klip süresine eşit (uzamaz)", () => {
    const sum = (times: number[]): number => {
      let prev = 0;
      let total = 0;
      for (const t of times) {
        total += stepSeconds(prev, t);
        prev = t;
      }
      return total;
    };
    const smooth = Array.from({ length: CLIP_SECONDS * 30 + 1 }, (_, i) => clipTime((i / 30) * 1000));
    const dropped = [0, 0.4, 1.9, 2.0, 4.1, CLIP_SECONDS].map((s) => clipTime(s * 1000));
    expect(sum(smooth)).toBeCloseTo(CLIP_SECONDS, 6);
    expect(sum(dropped)).toBeCloseTo(CLIP_SECONDS, 6);
    expect(stepSeconds(3, 2)).toBe(0);
  });
  it("ilerleme ve açılma/kararma", () => {
    expect(clipProgress(0)).toBe(0);
    expect(clipProgress(CLIP_SECONDS / 2)).toBeCloseTo(0.5);
    expect(clipProgress(99)).toBe(1);
    expect(clipFade(0)).toBe(0);
    expect(clipFade(CLIP_FADE)).toBe(1);
    expect(clipFade(CLIP_SECONDS / 2)).toBe(1);
    expect(clipFade(CLIP_SECONDS)).toBe(0);
  });
});

describe("klip yerleşimi", () => {
  it("tek, iki ve üç kişide kazanan danseder; alt sıralar alçak bloktadır", () => {
    expect(clipColumns([])).toEqual([]);
    const three = clipColumns([1, 2, 3]);
    expect(three).toHaveLength(3);
    const win = three.find((c) => c.index === 0);
    expect(win?.cx).toBe(360);
    expect(win?.dances).toBe(true);
    expect(three.filter((c) => c.dances)).toHaveLength(1);
    expect(Math.min(...three.map((c) => c.blockTop))).toBe(win?.blockTop);
  });
  it("beraberlikte birden çok kişi danseder; en çok 3 sütun", () => {
    expect(clipColumns([1, 1, 3]).filter((c) => c.dances)).toHaveLength(2);
    expect(clipColumns([1, 1, 1, 1])).toHaveLength(3);
  });
  it("sütunlar tasarım alanına sığar ve üst üste binmez", () => {
    for (const ranks of [[1], [1, 2], [1, 2, 3], [1, 1, 1]]) {
      const cols = [...clipColumns(ranks)].sort((a, b) => a.cx - b.cx);
      for (const c of cols) {
        expect(c.cx - c.blockW / 2).toBeGreaterThanOrEqual(0);
        expect(c.cx + c.blockW / 2).toBeLessThanOrEqual(720);
      }
      for (let i = 1; i < cols.length; i++) {
        const a = cols[i - 1];
        const b = cols[i];
        if (a && b) expect(a.cx + a.blockW / 2).toBeLessThanOrEqual(b.cx - b.blockW / 2);
      }
    }
  });
});
