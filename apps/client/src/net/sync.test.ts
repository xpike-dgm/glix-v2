import { diffMerge } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { snapshot } from "./fixtures.js";
import { initialSync, onPatch, onReconnect, onRoom } from "./sync.js";

const patchOf = (a: ReturnType<typeof snapshot>, b: ReturnType<typeof snapshot>) => {
  const patch = diffMerge(a, b);
  if (!patch) throw new Error("yama ifade edilemedi");
  return { baseRev: a.rev, rev: b.rev, patch };
};

describe("istemci senkron durum makinesi", () => {
  it("tam room kabul edilir", () => {
    const s = snapshot("lobby", { rev: 3 });
    const step = onRoom(initialSync, s);
    expect(step.accepted).toBe(s);
    expect(step.state.snapshot).toBe(s);
  });

  it("baseRev eşitse yama uygulanır", () => {
    const a = snapshot("lobby", { rev: 3 });
    const b = snapshot("lobby", { rev: 4, serverNow: 2000, hostId: "b" });
    const step = onPatch(onRoom(initialSync, a).state, patchOf(a, b));
    expect(step.sendResync).toBe(false);
    expect(step.accepted).toEqual(b);
  });

  it("baseRev uyuşmazsa yama atılır ve bir kez resync istenir", () => {
    const a = snapshot("lobby", { rev: 3 });
    const b = snapshot("lobby", { rev: 4, hostId: "b" });
    const c = snapshot("lobby", { rev: 5, hostId: "a" });
    let st = onRoom(initialSync, a).state;
    // b yaması kaçtı; c yaması baseRev 4 ile gelir
    const first = onPatch(st, patchOf(b, c));
    expect(first.accepted).toBeNull();
    expect(first.sendResync).toBe(true);
    expect(first.state.snapshot).toBe(a);
    st = first.state;
    // tam room gelene kadar sonraki yamalar sessizce atılır, tekrar resync istenmez
    const second = onPatch(st, patchOf(b, c));
    expect(second.sendResync).toBe(false);
    expect(second.accepted).toBeNull();
    // tam room rev eşit olsa bile kabul edilir ve beklemeyi bitirir
    const full = onRoom(st, snapshot("lobby", { rev: 3, hostId: "z" }));
    expect(full.accepted?.hostId).toBe("z");
    expect(full.state.awaitingFull).toBe(false);
    // artık yamalar yeniden uygulanır
    const after = onPatch(
      full.state,
      patchOf(full.accepted as never, snapshot("lobby", { rev: 4, hostId: "q" })),
    );
    expect(after.accepted?.hostId).toBe("q");
  });

  it("snapshot yokken gelen yama resync ister", () => {
    const a = snapshot("lobby", { rev: 3 });
    const step = onPatch(initialSync, patchOf(a, snapshot("lobby", { rev: 4 })));
    expect(step.sendResync).toBe(true);
  });

  it("yama sonucu geçersizse ya da rev tutmuyorsa atılır ve resync istenir", () => {
    const a = snapshot("lobby", { rev: 3 });
    const st = onRoom(initialSync, a).state;
    const badShape = onPatch(st, { baseRev: 3, rev: 4, patch: { phase: "yok" } });
    expect(badShape.accepted).toBeNull();
    expect(badShape.sendResync).toBe(true);
    const badRev = onPatch(st, { baseRev: 3, rev: 9, patch: { rev: 4 } });
    expect(badRev.accepted).toBeNull();
    expect(badRev.sendResync).toBe(true);
  });

  it("eski room (düşük rev) beklemiyorken yok sayılır", () => {
    const a = snapshot("lobby", { rev: 5 });
    const step = onRoom(onRoom(initialSync, a).state, snapshot("lobby", { rev: 4 }));
    expect(step.accepted).toBeNull();
  });

  it("yeniden bağlanınca resync beklemesi sıfırlanır", () => {
    const a = snapshot("lobby", { rev: 3 });
    const waiting = onPatch(onRoom(initialSync, a).state, { baseRev: 99, rev: 100, patch: {} }).state;
    expect(waiting.awaitingFull).toBe(true);
    expect(onReconnect(waiting).awaitingFull).toBe(false);
  });

  it("null'a dönen alan tam room ile gelir ve doğru işlenir", () => {
    const a = snapshot("playing", { rev: 3 });
    const b = snapshot("final", { rev: 4 });
    expect(diffMerge(a, b)).toBeNull();
    expect(onRoom(onRoom(initialSync, a).state, b).accepted).toBe(b);
  });
});
