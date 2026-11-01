import { describe, expect, it } from "vitest";
import { snapshot } from "../net/fixtures.js";
import { parseServerMessage } from "../net/parse.js";
import { botControlsVisible } from "./lobbyHints.js";

const read = (extra: Record<string, unknown>) => {
  const base = snapshot("lobby");
  const m = parseServerMessage(JSON.stringify({ type: "room", snapshot: { ...base, ...extra } }));
  if (m?.type !== "room") throw new Error("room kabul edilmedi");
  return m.snapshot;
};

describe("bot düğmeleri (yalnız test ortamı)", () => {
  it("canlı sunucu `bots` göndermez: ev sahibine bile düğme çıkmaz", () => {
    const snap = read({});
    expect(snap.bots).toBeUndefined();
    expect(botControlsVisible({ ...snap, hostId: snap.selfId })).toBe(false);
  });
  it("bozuk değer izin sayılmaz", () => {
    for (const bots of ["true", 1, {}, null]) expect(read({ bots }).bots).toBeUndefined();
  });
  it("test ortamında yalnız ev sahibine ve yalnız lobide", () => {
    const snap = read({ bots: true });
    expect(snap.bots).toBe(true);
    expect(botControlsVisible({ ...snap, hostId: snap.selfId })).toBe(true);
    expect(botControlsVisible({ ...snap, hostId: "baskasi" })).toBe(false);
    expect(botControlsVisible({ ...snap, hostId: snap.selfId, phase: "playing" })).toBe(false);
  });
  it("oyuncu kartında bot işareti yalnız true ise okunur", () => {
    const base = snapshot("lobby");
    const players = base.players.map((p, i) => ({ ...p, bot: i === 0 ? true : "evet" }));
    const snap = read({ players });
    expect(snap.players[0]?.bot).toBe(true);
    expect(snap.players.slice(1).every((p) => p.bot === undefined)).toBe(true);
  });
});
