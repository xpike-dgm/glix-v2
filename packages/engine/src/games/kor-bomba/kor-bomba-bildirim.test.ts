import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.js";
import { zamanBombasiHafizasi } from "../zaman-bombasi-hafizasi/index.js";
import { korBomba } from "./index.js";

const players = ["a", "b", "c"];
const ctx = () => ({ now: 1_000, rng: createRng(7), connected: players });

describe("sıra bildirimi kancası (notify)", () => {
  it("Kör Bomba: yalnız bombayı taşıyan; pas sonrası yeni taşıyıcı", () => {
    const s = korBomba.setup(players, ctx());
    expect(korBomba.notify?.(s, ctx())).toEqual([s.holder]);
    const to = players.find((p) => p !== s.holder) as string;
    const next = korBomba.reduce(s, s.holder, { kind: "pass", to }, { ...ctx(), now: 2_000 });
    if ("rejected" in next) throw new Error(next.rejected);
    expect(korBomba.notify?.(next, ctx())).toEqual([to]);
  });

  it("Zaman Bombası: yalnız sırası gelen oyuncu, herkese açık görünümdeki aktifle aynı", () => {
    const s = zamanBombasiHafizasi.setup(players, ctx());
    const active = zamanBombasiHafizasi.publicView(s, ctx()).active;
    expect(zamanBombasiHafizasi.notify?.(s, ctx())).toEqual([active]);
  });
});
